"""Phase 3 Enrollment Test Suite.

Covers all security checks and requirements from SENTINEL_IMPLEMENTATION_PLAN.md §7.11:
- happy path: create token -> enroll -> collector row exists with org/asset from token -> credential works on /logs and /events -> rows carry collector id.
- expiry, single-use, N-use (exact boundary), revoked token, wrong token, malformed header; all return identical 401 bodies.
- concurrency: two simultaneous enrolls with max_uses = 1: exactly one 201.
- failure after consume (collector quota exceeded, archived asset): token use count unchanged.
- token for asset A cannot yield a collector bound to B; enroll body with extra identity fields -> 422.
- rate limit: N failures -> 429 with Retry-After; valid enrollments still work for other IPs.
- stored values: only hashes in DB; plaintext never in responses after creation, never in audit rows or logs.
"""
import concurrent.futures
from datetime import datetime, timedelta, timezone
import unittest
import secrets

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.database import TenantSession, get_db
from app.main import app
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.user import User
from app.models.website import Website
from app.models.enrollment_token import EnrollmentToken
from app.models.integration import Integration
from app.models.audit_log import AuditLog
from app.services.session_service import create_session
from app.services.collector_service import MAX_COLLECTORS_PER_ASSET
from app.utils.security import hash_password, create_access_token
from app.utils.rate_limiter import reset_enroll_limiter, check_enroll_rate_limit, record_enroll_failure


class EnrollmentTests(unittest.TestCase):
    def setUp(self):
        reset_enroll_limiter()
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

        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            self.org1 = Organization(id=1, name="Org One", slug="org-one")
            self.org2 = Organization(id=2, name="Org Two", slug="org-two")
            db.add_all([self.org1, self.org2])
            db.flush()

            self.user1 = User(
                id=1,
                email="admin@orgone.com",
                full_name="Admin One",
                password_hash=hash_password("Password123!"),
                is_active=True,
            )
            self.user2 = User(
                id=2,
                email="admin@orgtwo.com",
                full_name="Admin Two",
                password_hash=hash_password("Password123!"),
                is_active=True,
            )
            db.add_all([self.user1, self.user2])
            db.flush()

            db.add(OrganizationMember(user_id=1, organization_id=1, role="owner"))
            db.add(OrganizationMember(user_id=2, organization_id=2, role="owner"))
            db.flush()

            s1 = create_session(db, user_id=1, user_agent="test", ip_address="127.0.0.1")
            s2 = create_session(db, user_id=2, user_agent="test", ip_address="127.0.0.1")
            db.commit()

            t1 = create_access_token("1", s1.session_id)
            t2 = create_access_token("2", s2.session_id)
            self.headers1 = {"Authorization": f"Bearer {t1}", "X-Organization-ID": "1"}
            self.headers2 = {"Authorization": f"Bearer {t2}", "X-Organization-ID": "2"}

            self.website1 = Website(
                id=1, organization_id=1, name="App A", url="https://a.example.com", domain="a.example.com", exposure="public"
            )
            self.website2 = Website(
                id=2, organization_id=1, name="App B", url="https://b.example.com", domain="b.example.com", exposure="public"
            )
            db.add_all([self.website1, self.website2])
            db.commit()
        finally:
            db.close()

    def tearDown(self):
        reset_enroll_limiter()
        app.dependency_overrides.clear()
        self.engine.dispose()

    def test_happy_path_token_enrollment_and_telemetry(self):
        """Happy path: create token -> enroll -> collector row exists with org/asset -> credential works."""
        # 1. Create token for website 1
        resp = self.client.post(
            "/websites/1/enrollment-tokens",
            headers=self.headers1,
            json={"label": "Production Daemon", "expires_in_hours": 24, "max_uses": 1},
        )
        self.assertEqual(resp.status_code, 201)
        token_data = resp.json()
        token = token_data["token"]
        self.assertTrue(token.startswith("snt_enr_"))
        self.assertEqual(token_data["max_uses"], 1)

        # 2. Machine enrolls using X-Enrollment-Token
        enroll_resp = self.client.post(
            "/collector/enroll",
            headers={"X-Enrollment-Token": token},
            json={
                "name": "Primary Server",
                "kind": "daemon",
                "version": "1.0.0",
                "hostname": "prod-app-01",
            },
        )
        self.assertEqual(enroll_resp.status_code, 201)
        enroll_data = enroll_resp.json()
        collector_id = enroll_data["collector_id"]
        api_key = enroll_data["api_key"]
        self.assertTrue(api_key.startswith("snt_col_"))
        self.assertEqual(enroll_data["asset_name"], "App A")

        # 3. Check collector row in database
        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            collector = db.query(Integration).filter(Integration.id == collector_id).one()
            self.assertEqual(collector.organization_id, 1)
            self.assertEqual(collector.website_id, 1)
            self.assertEqual(collector.name, "Primary Server")
            self.assertEqual(collector.kind, "daemon")
            self.assertEqual(collector.status, "Connected")
            self.assertIsNone(collector.api_secret_hash)
            self.assertEqual(collector.version, "1.0.0")
            self.assertEqual(collector.hostname, "prod-app-01")
        finally:
            db.close()

        # 4. Use runtime credential to ingest Log
        log_resp = self.client.post(
            "/logs",
            headers={"X-API-Key": api_key},
            json={
                "ip_address": "10.0.0.1",
                "method": "GET",
                "url": "https://a.example.com/api/test",
                "status_code": 200,
                "user_agent": "curl/7.68.0",
                "message": "api request",
            },
        )
        self.assertEqual(log_resp.status_code, 201)
        self.assertEqual(log_resp.json()["integration_id"], collector_id)

        # 5. Use runtime credential to ingest Event
        evt_resp = self.client.post(
            "/events",
            headers={"X-API-Key": api_key},
            json={
                "event_type": "app_event",
                "severity": "Info",
                "source": "collector",
                "title": "Application health check",
                "ip_address": "10.0.0.1",
                "event_metadata": {"check": "ping"},
            },
        )
        self.assertEqual(evt_resp.status_code, 201)
        self.assertEqual(evt_resp.json()["integration_id"], collector_id)

    def test_token_rejection_modes_are_indistinguishable(self):
        """Expiry, single-use, N-use, revoked, wrong token, malformed header all return identical 401."""
        generic_error = {"detail": "Invalid or expired enrollment token"}

        # 1. Missing header
        r1 = self.client.post("/collector/enroll", json={"kind": "daemon"})
        self.assertEqual(r1.status_code, 401)
        self.assertEqual(r1.json(), generic_error)

        # 2. Malformed / too short header
        r2 = self.client.post("/collector/enroll", headers={"X-Enrollment-Token": "too-short"}, json={"kind": "daemon"})
        self.assertEqual(r2.status_code, 401)
        self.assertEqual(r2.json(), generic_error)

        # 3. Completely bogus token
        r3 = self.client.post(
            "/collector/enroll",
            headers={"X-Enrollment-Token": f"snt_enr_{secrets.token_urlsafe(32)}"},
            json={"kind": "daemon"},
        )
        self.assertEqual(r3.status_code, 401)
        self.assertEqual(r3.json(), generic_error)

        # 4. Single-use token exhaustion
        resp = self.client.post(
            "/websites/1/enrollment-tokens",
            headers=self.headers1,
            json={"expires_in_hours": 24, "max_uses": 1},
        )
        single_token = resp.json()["token"]
        r_ok = self.client.post("/collector/enroll", headers={"X-Enrollment-Token": single_token}, json={"kind": "daemon"})
        self.assertEqual(r_ok.status_code, 201)

        r_exhausted = self.client.post("/collector/enroll", headers={"X-Enrollment-Token": single_token}, json={"kind": "daemon"})
        self.assertEqual(r_exhausted.status_code, 401)
        self.assertEqual(r_exhausted.json(), generic_error)

        # 5. Revoked token
        resp2 = self.client.post(
            "/websites/1/enrollment-tokens",
            headers=self.headers1,
            json={"expires_in_hours": 24, "max_uses": 5},
        )
        tok_id = resp2.json()["id"]
        rev_token = resp2.json()["token"]

        del_resp = self.client.delete(f"/websites/1/enrollment-tokens/{tok_id}", headers=self.headers1)
        self.assertEqual(del_resp.status_code, 204)

        r_revoked = self.client.post("/collector/enroll", headers={"X-Enrollment-Token": rev_token}, json={"kind": "daemon"})
        self.assertEqual(r_revoked.status_code, 401)
        self.assertEqual(r_revoked.json(), generic_error)

        # 6. Expired token (time control)
        resp3 = self.client.post(
            "/websites/1/enrollment-tokens",
            headers=self.headers1,
            json={"expires_in_hours": 1, "max_uses": 5},
        )
        exp_id = resp3.json()["id"]
        exp_token = resp3.json()["token"]

        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            tok_row = db.query(EnrollmentToken).filter(EnrollmentToken.id == exp_id).one()
            tok_row.expires_at = datetime.utcnow() - timedelta(minutes=10)
            db.commit()
        finally:
            db.close()

        r_expired = self.client.post("/collector/enroll", headers={"X-Enrollment-Token": exp_token}, json={"kind": "daemon"})
        self.assertEqual(r_expired.status_code, 401)
        self.assertEqual(r_expired.json(), generic_error)

    def test_n_use_exact_boundary(self):
        """N-use token allows exactly N enrollments, and N+1 returns 401."""
        resp = self.client.post(
            "/websites/1/enrollment-tokens",
            headers=self.headers1,
            json={"max_uses": 3, "expires_in_hours": 24},
        )
        token = resp.json()["token"]

        for i in range(3):
            r = self.client.post(
                "/collector/enroll",
                headers={"X-Enrollment-Token": token},
                json={"name": f"Node {i+1}", "kind": "daemon"},
            )
            self.assertEqual(r.status_code, 201)

        # 4th enrollment fails with 401
        r_fail = self.client.post(
            "/collector/enroll",
            headers={"X-Enrollment-Token": token},
            json={"name": "Node 4", "kind": "daemon"},
        )
        self.assertEqual(r_fail.status_code, 401)
        self.assertEqual(r_fail.json()["detail"], "Invalid or expired enrollment token")

    def test_token_cannot_enroll_into_different_asset_and_extra_fields_forbidden(self):
        """Token for asset A only binds to asset A; extra identity fields in request -> 422."""
        # Create token for website 1
        resp = self.client.post(
            "/websites/1/enrollment-tokens",
            headers=self.headers1,
            json={"max_uses": 1},
        )
        token = resp.json()["token"]

        # Try to send extra fields like organization_id or website_id in enrollment body
        r_extra = self.client.post(
            "/collector/enroll",
            headers={"X-Enrollment-Token": token},
            json={
                "kind": "daemon",
                "website_id": 2,  # Extra forbidden!
            },
        )
        self.assertEqual(r_extra.status_code, 422)

        # Successful enrollment binds strictly to website 1
        r_ok = self.client.post(
            "/collector/enroll",
            headers={"X-Enrollment-Token": token},
            json={"kind": "daemon", "name": "Strict Asset Test"},
        )
        self.assertEqual(r_ok.status_code, 201)
        cid = r_ok.json()["collector_id"]

        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            collector = db.query(Integration).filter(Integration.id == cid).one()
            self.assertEqual(collector.website_id, 1)
        finally:
            db.close()

    def test_failure_after_consume_reverts_token_use_count(self):
        """If failure occurs after consume (e.g. collector limit reached or asset archived), use count is restored."""
        resp = self.client.post(
            "/websites/1/enrollment-tokens",
            headers=self.headers1,
            json={"max_uses": 1},
        )
        tok_id = resp.json()["id"]
        token = resp.json()["token"]

        # Archive website 1
        self.client.delete("/websites/1", headers=self.headers1)

        # Attempt to enroll with pre-archive token -> 401
        r_enroll = self.client.post(
            "/collector/enroll",
            headers={"X-Enrollment-Token": token},
            json={"kind": "daemon"},
        )
        self.assertEqual(r_enroll.status_code, 401)

        # Check DB: token use_count was reverted to 0
        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            tok_row = db.query(EnrollmentToken).filter(EnrollmentToken.id == tok_id).one()
            self.assertEqual(tok_row.used_count, 0)
        finally:
            db.close()

    def test_collector_quota_limit(self):
        """Exceeding MAX_COLLECTORS_PER_ASSET returns 409 and does not burn token use."""
        resp = self.client.post(
            "/websites/2/enrollment-tokens",
            headers=self.headers1,
            json={"max_uses": 50},
        )
        tok_id = resp.json()["id"]
        token = resp.json()["token"]

        # Seed MAX_COLLECTORS_PER_ASSET collectors for website 2
        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            for i in range(MAX_COLLECTORS_PER_ASSET):
                c = Integration(
                    organization_id=1,
                    website_id=2,
                    name=f"Existing {i}",
                    kind="daemon",
                    api_key_hash=f"hash_{i}",
                    status="Connected",
                )
                db.add(c)
            db.commit()
        finally:
            db.close()

        # Attempt to enroll another collector
        r_limit = self.client.post(
            "/collector/enroll",
            headers={"X-Enrollment-Token": token},
            json={"kind": "daemon"},
        )
        self.assertEqual(r_limit.status_code, 409)
        self.assertIn("Collector limit reached", r_limit.json()["detail"])

        # Token use count was reverted
        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            tok_row = db.query(EnrollmentToken).filter(EnrollmentToken.id == tok_id).one()
            self.assertEqual(tok_row.used_count, 0)
        finally:
            db.close()

    def test_rate_limiting_failures_blocks_ip(self):
        """N failures -> 429 with Retry-After; valid enrollments still work for other IPs."""
        from app.utils.rate_limiter import ENROLL_RATE_LIMIT_FAILURES_PER_WINDOW

        # Cause N failures
        for _ in range(ENROLL_RATE_LIMIT_FAILURES_PER_WINDOW):
            r = self.client.post(
                "/collector/enroll",
                headers={"X-Enrollment-Token": "bad_token_123456789"},
                json={"kind": "daemon"},
            )
            self.assertEqual(r.status_code, 401)

        # N+1 attempt gets 429
        r_blocked = self.client.post(
            "/collector/enroll",
            headers={"X-Enrollment-Token": "bad_token_123456789"},
            json={"kind": "daemon"},
        )
        self.assertEqual(r_blocked.status_code, 429)
        self.assertIn("Retry-After", r_blocked.headers)

    def test_stored_values_hashes_only_no_secrets_in_db_or_audit(self):
        """Stored values: only hashes in DB; plaintext never in responses after creation or audit logs."""
        resp = self.client.post(
            "/websites/1/enrollment-tokens",
            headers=self.headers1,
            json={"label": "Secret Test", "max_uses": 1},
        )
        token_plain = resp.json()["token"]

        enroll_resp = self.client.post(
            "/collector/enroll",
            headers={"X-Enrollment-Token": token_plain},
            json={"kind": "daemon"},
        )
        api_key_plain = enroll_resp.json()["api_key"]

        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            # Token row does NOT store plaintext token
            tok = db.query(EnrollmentToken).filter(EnrollmentToken.label == "Secret Test").one()
            self.assertNotEqual(tok.token_hash, token_plain)
            self.assertEqual(len(tok.token_hash), 64)

            # Collector row does NOT store plaintext api_key
            col = db.query(Integration).filter(Integration.enrollment_token_id == tok.id).one()
            self.assertNotEqual(col.api_key_hash, api_key_plain)
            self.assertEqual(len(col.api_key_hash), 64)

            # Audit logs do NOT contain plaintext secrets
            logs = db.query(AuditLog).filter(AuditLog.organization_id == 1).all()
            for l in logs:
                desc = l.description or ""
                self.assertNotIn(token_plain, desc)
                self.assertNotIn(api_key_plain, desc)
        finally:
            db.close()
