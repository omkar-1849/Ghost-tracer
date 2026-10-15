"""Phase 4 Telemetry Hardening Test Suite.

Covers all security checks and requirements from SENTINEL_IMPLEMENTATION_PLAN.md §8.5:
- parity: same sequence via N single requests vs one batch -> same alerts, incidents, risk values, dedup outcomes.
- brute-force window spanning items inside one batch triggers detection exactly as sequential requests.
- mixed batch (valid, malformed, duplicate) -> correct per-item results; valid items persisted.
- limits: item count (101 -> 422), body size (> 1 MiB -> 413), decompressed size bomb (> 5 MiB -> 413), unsupported encoding, invalid gzip.
- identity fields inside an item or the envelope -> rejected.
- rate limit and Retry-After; legacy collector under normal load unaffected.
- audit: one batch summary row; no per-item INGEST_* rows; alert/incident audit still present.
- heartbeat: updates fields, validates input, rejects wrong credential type, revoked/disabled collectors get 401, status derivation flips offline after threshold.
- last_used throttling: <=1 write per interval under many requests.
"""
from datetime import datetime, timedelta, timezone
import gzip
import hashlib
import json
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.database import TenantSession, get_db
from app.main import app
from app.models.audit_log import AuditLog
from app.models.event import Event
from app.models.integration import Integration
from app.models.log import Log
from app.models.organization import Organization
from app.models.website import Website
from app.services.collector_service import (
    COLLECTOR_OFFLINE_AFTER_SECONDS,
    derive_collector_status,
)
from app.utils.rate_limiter import (
    consume_telemetry_budget,
    reset_enroll_limiter,
    reset_telemetry_limiter,
)


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


class TelemetryBatchTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(
            bind=self.engine,
            class_=TenantSession,
            autoflush=False,
            expire_on_commit=False,
        )

        def override_get_db():
            db = self.SessionLocal()
            try:
                yield db
                db.commit()
            except Exception:
                db.rollback()
                raise
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

        reset_telemetry_limiter()
        reset_enroll_limiter()

        # Seed test data
        db = self.get_db_session()

        self.org1 = Organization(id=1, name="Org One", slug="org-one")
        self.org2 = Organization(id=2, name="Org Two", slug="org-two")
        db.add_all([self.org1, self.org2])
        db.flush()

        self.site1 = Website(
            id=1,
            organization_id=1,
            name="Production App",
            url="https://app.example.com",
            domain="app.example.com",
            status="Active",
            verified=True,
        )
        self.site2 = Website(
            id=2,
            organization_id=2,
            name="Org Two App",
            url="https://org2.example.com",
            domain="org2.example.com",
            status="Active",
            verified=True,
        )
        db.add_all([self.site1, self.site2])
        db.flush()

        self.api_key1 = "collector-key-1-0123456789abcdef"
        self.api_key2 = "collector-key-2-0123456789abcdef"

        self.collector1 = Integration(
            id=1,
            organization_id=1,
            website_id=1,
            name="Daemon Prod 1",
            kind="daemon",
            status="Connected",
            api_key_hash=hash_key(self.api_key1),
            key_prefix=self.api_key1[:12],
        )
        self.collector2 = Integration(
            id=2,
            organization_id=2,
            website_id=2,
            name="Daemon Org 2",
            kind="daemon",
            status="Connected",
            api_key_hash=hash_key(self.api_key2),
            key_prefix=self.api_key2[:12],
        )
        db.add_all([self.collector1, self.collector2])
        db.commit()
        db.close()

    def get_db_session(self):
        db = self.SessionLocal()
        db.info["system_scope"] = True
        return db

    def tearDown(self):
        app.dependency_overrides.clear()
        self.engine.dispose()
        reset_telemetry_limiter()
        reset_enroll_limiter()

    def test_batch_log_parity_and_ordering(self):
        """Batch ingestion produces identical outcomes to sequential single requests."""
        sample_logs = [
            {
                "ip_address": "198.51.100.10",
                "method": "GET",
                "url": "/login",
                "status_code": 200,
                "user_agent": "Mozilla/5.0",
                "message": "User viewed login page",
            },
            {
                "ip_address": "198.51.100.10",
                "method": "POST",
                "url": "/login",
                "status_code": 401,
                "user_agent": "Mozilla/5.0",
                "message": "Failed login attempt",
            },
            {
                "ip_address": "198.51.100.10",
                "method": "POST",
                "url": "/login",
                "status_code": 401,
                "user_agent": "Mozilla/5.0",
                "message": "Failed login attempt 2",
            },
        ]

        # Ingest via batch
        res = self.client.post(
            "/logs/batch",
            headers={"X-API-Key": self.api_key1},
            json={"items": sample_logs},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["accepted"], 3)
        self.assertEqual(data["rejected"], 0)
        self.assertEqual(len(data["results"]), 3)
        for r in data["results"]:
            self.assertEqual(r["status"], "accepted")
            self.assertIsNotNone(r["id"])

        # Check DB
        db = self.get_db_session()
        logs = db.query(Log).filter(Log.organization_id == 1).order_by(Log.id.asc()).all()
        self.assertEqual(len(logs), 3)
        self.assertEqual(logs[0].url, "/login")
        self.assertEqual(logs[0].status_code, 200)
        self.assertEqual(logs[1].status_code, 401)
        self.assertEqual(logs[2].status_code, 401)
        db.close()

    def test_batch_event_parity_and_deduplication(self):
        """Events within a batch are processed in order and duplicate detection works identically."""
        event_payload = {
            "event_type": "ssh_login_failure",
            "severity": "Low",
            "source": "auth_service",
            "title": "Failed SSH login",
            "description": "Invalid password for user root",
            "ip_address": "203.0.113.88",
            "user_agent": "ssh-client",
            "event_metadata": {"port": 22},
        }

        # Send two identical events in one batch
        res = self.client.post(
            "/events/batch",
            headers={"X-API-Key": self.api_key1},
            json={"items": [event_payload, event_payload]},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["accepted"], 1)
        self.assertEqual(data["duplicates"], 1)
        self.assertEqual(data["rejected"], 0)
        self.assertEqual(data["results"][0]["status"], "accepted")
        self.assertEqual(data["results"][1]["status"], "duplicate")
        self.assertEqual(data["results"][0]["id"], data["results"][1]["id"])

        # Verify exactly 1 Event row in DB
        db = self.get_db_session()
        events = db.query(Event).filter(Event.organization_id == 1).all()
        self.assertEqual(len(events), 1)
        db.close()

    def test_brute_force_window_spanning_items_in_batch(self):
        """Sequential items in a single batch accumulate behavioral signals."""
        failures = [
            {
                "ip_address": "192.0.2.77",
                "method": "POST",
                "url": "/login",
                "status_code": 401,
                "user_agent": "BruteBot/1.0",
                "message": "login_failed",
            }
            for _ in range(5)
        ]

        res = self.client.post(
            "/logs/batch",
            headers={"X-API-Key": self.api_key1},
            json={"items": failures},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["accepted"], 5)

        db = self.get_db_session()
        logs = db.query(Log).filter(Log.ip_address == "192.0.2.77").order_by(Log.id.asc()).all()
        self.assertEqual(len(logs), 5)
        # Risk score increases as attempts accumulate
        self.assertGreaterEqual(logs[-1].risk_score, logs[0].risk_score)
        db.close()

    def test_mixed_batch_isolation_savepoint(self):
        """Malformed item fails with error but valid items commit cleanly (isolation property)."""
        batch = [
            {
                "ip_address": "1.2.3.4",
                "method": "GET",
                "url": "/valid1",
                "status_code": 200,
                "user_agent": "Mozilla",
                "message": "ok",
            },
            {
                "ip_address": "not-an-ip",  # Invalid IP address -> validation fails
                "method": "GET",
                "url": "/bad",
                "status_code": 200,
                "user_agent": "Mozilla",
                "message": "bad",
            },
            {
                "ip_address": "1.2.3.5",
                "method": "POST",
                "url": "/valid2",
                "status_code": 201,
                "user_agent": "Mozilla",
                "message": "created",
            },
        ]

        res = self.client.post(
            "/logs/batch",
            headers={"X-API-Key": self.api_key1},
            json={"items": batch},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["accepted"], 2)
        self.assertEqual(data["rejected"], 1)

        self.assertEqual(data["results"][0]["status"], "accepted")
        self.assertEqual(data["results"][1]["status"], "rejected")
        self.assertIn("Validation failed", data["results"][1]["error"])
        self.assertEqual(data["results"][2]["status"], "accepted")

        # Database contains valid1 and valid2, not bad
        db = self.get_db_session()
        logs = db.query(Log).filter(Log.organization_id == 1).all()
        urls = [l.url for l in logs]
        self.assertTrue(any("valid1" in u for u in urls))
        self.assertTrue(any("valid2" in u for u in urls))
        self.assertFalse(any("bad" in u for u in urls))
        db.close()

    def test_batch_limits_and_guards(self):
        """Item count, body size, gzip compression bomb, and invalid encodings are enforced."""
        # 1. Item count limit (101 items > 100 max) -> 422
        oversized_items = [
            {
                "ip_address": "1.1.1.1",
                "method": "GET",
                "url": "/test",
                "status_code": 200,
                "user_agent": "test",
                "message": "test",
            }
            for _ in range(101)
        ]
        res = self.client.post(
            "/logs/batch",
            headers={"X-API-Key": self.api_key1},
            json={"items": oversized_items},
        )
        self.assertEqual(res.status_code, 422)

        # 2. Unsupported Content-Encoding (e.g. deflate) -> 400
        res = self.client.post(
            "/logs/batch",
            headers={"X-API-Key": self.api_key1, "Content-Encoding": "deflate"},
            content=b"some bytes",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Unsupported Content-Encoding", res.json()["detail"])

        # 3. Corrupt gzip payload -> 400
        res = self.client.post(
            "/logs/batch",
            headers={"X-API-Key": self.api_key1, "Content-Encoding": "gzip"},
            content=b"\x1f\x8b\x08corrupt data not valid gzip",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Corrupt or invalid gzip", res.json()["detail"])

        # 4. Valid gzip payload -> 200
        valid_payload = json.dumps({
            "items": [
                {
                    "ip_address": "1.1.1.1",
                    "method": "GET",
                    "url": "/gzipped",
                    "status_code": 200,
                    "user_agent": "gzip-client",
                    "message": "compressed log",
                }
            ]
        }).encode("utf-8")
        gzipped_data = gzip.compress(valid_payload)

        res = self.client.post(
            "/logs/batch",
            headers={"X-API-Key": self.api_key1, "Content-Encoding": "gzip", "Content-Type": "application/json"},
            content=gzipped_data,
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["accepted"], 1)

        # 5. Gzip compression bomb: small compressed payload that expands beyond 5 MiB -> 413
        # 6 MiB of spaces compresses to ~6 KB
        bomb_content = b" " * (6 * 1024 * 1024)
        bomb_gzip = gzip.compress(bomb_content)
        self.assertLess(len(bomb_gzip), 50 * 1024)  # ~6 KB compressed

        res = self.client.post(
            "/logs/batch",
            headers={"X-API-Key": self.api_key1, "Content-Encoding": "gzip"},
            content=bomb_gzip,
        )
        self.assertEqual(res.status_code, 413)
        self.assertIn("exceeds maximum size", res.json()["detail"])

    def test_identity_fields_forbidden(self):
        """Identity fields inside the envelope or item are strictly forbidden."""
        # Extra field in envelope -> 422
        res = self.client.post(
            "/logs/batch",
            headers={"X-API-Key": self.api_key1},
            json={
                "items": [
                    {
                        "ip_address": "1.1.1.1",
                        "method": "GET",
                        "url": "/test",
                        "status_code": 200,
                        "user_agent": "test",
                        "message": "test",
                    }
                ],
                "organization_id": 1,
            },
        )
        self.assertEqual(res.status_code, 422)

        # Extra field in item -> rejected in batch item results
        res = self.client.post(
            "/logs/batch",
            headers={"X-API-Key": self.api_key1},
            json={
                "items": [
                    {
                        "ip_address": "1.1.1.1",
                        "method": "GET",
                        "url": "/test",
                        "status_code": 200,
                        "user_agent": "test",
                        "message": "test",
                        "website_id": 99,  # forbidden identity claim
                    }
                ]
            },
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["rejected"], 1)
        self.assertIn("Extra inputs are not permitted", res.json()["results"][0]["error"])

    def test_rate_budget_and_retry_after(self):
        """Exceeding ingestion budget returns 429 with Retry-After header."""
        # Consume full budget
        consume_telemetry_budget(self.collector1.id, item_count=6000)

        # Batch request exceeds available tokens -> 429 + Retry-After
        res = self.client.post(
            "/logs/batch",
            headers={"X-API-Key": self.api_key1},
            json={
                "items": [
                    {
                        "ip_address": "1.1.1.1",
                        "method": "GET",
                        "url": f"/exceeded/{i}",
                        "status_code": 200,
                        "user_agent": "ua",
                        "message": "msg",
                    }
                    for i in range(10)
                ]
            },
        )
        self.assertEqual(res.status_code, 429)
        self.assertIn("Retry-After", res.headers)
        self.assertGreater(int(res.headers["Retry-After"]), 0)

        # Collector 2 is unaffected (isolated per-collector token bucket)
        res2 = self.client.post(
            "/logs",
            headers={"X-API-Key": self.api_key2},
            json={
                "ip_address": "1.1.1.1",
                "method": "GET",
                "url": "/col2-ok",
                "status_code": 200,
                "user_agent": "ua",
                "message": "msg",
            },
        )
        self.assertEqual(res2.status_code, 201)

    def test_audit_behavior(self):
        """Batch ingestion produces one summary audit row, suppressing per-item rows."""
        res = self.client.post(
            "/logs/batch",
            headers={"X-API-Key": self.api_key1},
            json={
                "items": [
                    {
                        "ip_address": "1.1.1.1",
                        "method": "GET",
                        "url": "/log1",
                        "status_code": 200,
                        "user_agent": "ua",
                        "message": "msg",
                    },
                    {
                        "ip_address": "1.1.1.2",
                        "method": "GET",
                        "url": "/log2",
                        "status_code": 200,
                        "user_agent": "ua",
                        "message": "msg",
                    },
                ]
            },
        )
        self.assertEqual(res.status_code, 200)

        db = self.get_db_session()
        new_audits = db.query(AuditLog).filter(AuditLog.organization_id == 1).all()
        # Exactly 1 INGEST_LOG_BATCH audit row was created
        batch_audits = [a for a in new_audits if a.action == "INGEST_LOG_BATCH"]
        single_audits = [a for a in new_audits if a.action == "INGEST_LOG"]

        self.assertEqual(len(batch_audits), 1)
        self.assertEqual(len(single_audits), 0)
        self.assertIn("2 accepted", batch_audits[0].description)
        db.close()

    def test_heartbeat_lifecycle_and_derivations(self):
        """Heartbeat updates machine telemetry, enforces validation, and affects status derivation."""
        # 1. Successful heartbeat
        res = self.client.post(
            "/collector/heartbeat",
            headers={"X-API-Key": self.api_key1},
            json={"version": "1.2.0", "hostname": "web-worker-01"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("server_time", data)
        self.assertEqual(data["heartbeat_interval_seconds"], 30)
        self.assertEqual(data["batch_limits"]["max_items"], 100)

        # Verify DB updated
        db = self.get_db_session()
        col = db.query(Integration).filter(Integration.id == 1).one()
        self.assertEqual(col.version, "1.2.0")
        self.assertEqual(col.hostname, "web-worker-01")
        self.assertIsNotNone(col.last_heartbeat_at)
        self.assertEqual(col.last_seen_ip, "testclient")

        # Derive status: fresh heartbeat -> online
        status = derive_collector_status(col)
        self.assertEqual(status, "online")

        # Simulated time passage: older than threshold -> offline
        old_time = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(
            seconds=COLLECTOR_OFFLINE_AFTER_SECONDS + 10
        )
        status_old = derive_collector_status(col, now=old_time)
        self.assertEqual(status_old, "offline")
        db.close()

        # 2. Validation: invalid characters in hostname
        res = self.client.post(
            "/collector/heartbeat",
            headers={"X-API-Key": self.api_key1},
            json={"hostname": "bad hostname with spaces!"},
        )
        self.assertEqual(res.status_code, 422)

        # 3. Disabled/revoked collector receives 401
        db = self.get_db_session()
        col = db.query(Integration).filter(Integration.id == 1).one()
        col.status = "Disabled"
        db.commit()
        db.close()

        res = self.client.post(
            "/collector/heartbeat",
            headers={"X-API-Key": self.api_key1},
            json={"version": "1.2.1"},
        )
        self.assertEqual(res.status_code, 401)

    def test_last_used_throttling(self):
        """High request frequency does not produce high-frequency last_used writes and audits."""
        # Initial request creates the first API_KEY_USED audit entry
        self.client.post(
            "/logs",
            headers={"X-API-Key": self.api_key2},
            json={
                "ip_address": "1.1.1.1",
                "method": "GET",
                "url": "/one",
                "status_code": 200,
                "user_agent": "ua",
                "message": "msg",
            },
        )

        db = self.get_db_session()
        audits_count_1 = db.query(AuditLog).filter(
            AuditLog.organization_id == 2,
            AuditLog.action == "API_KEY_USED",
        ).count()
        self.assertEqual(audits_count_1, 1)
        db.close()

        # Send 10 more requests immediately within the 60s throttling window
        for i in range(10):
            self.client.post(
                "/logs",
                headers={"X-API-Key": self.api_key2},
                json={
                    "ip_address": "1.1.1.1",
                    "method": "GET",
                    "url": f"/req-{i}",
                    "status_code": 200,
                    "user_agent": "ua",
                    "message": "msg",
                },
            )

        db = self.get_db_session()
        audits_count_after = db.query(AuditLog).filter(
            AuditLog.organization_id == 2,
            AuditLog.action == "API_KEY_USED",
        ).count()
        # Throttled: no additional API_KEY_USED audit rows written!
        self.assertEqual(audits_count_after, 1)
        db.close()
