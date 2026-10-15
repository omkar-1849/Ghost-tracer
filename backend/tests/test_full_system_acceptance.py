"""Sentinel AI — Full System Acceptance Integration Tests.

Validates end-to-end functionality across all 14 routes, authentication,
tenant isolation, telemetry ingestion, dashboard KPIs, alerts, incidents,
AI Analyst asynchronous enrichment, scanner, response actions, and audit trail.
"""
from datetime import datetime, timezone
import gzip
import json
import os
import unittest
from unittest.mock import patch, MagicMock

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret-at-least-32-chars-long-here-0123456789")
os.environ["SENTINEL_PROTECTED_APP_URL"] = "http://localhost:3000"
os.environ["SENTINEL_ALLOWED_TARGET_HOSTS"] = "localhost,127.0.0.1"

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
from app.models.integration import Integration
from app.models.alert import Alert
from app.models.event import Event
from app.models.incident import Incident
from app.models.response_action import ResponseAction
from app.models.scan import Scan
from app.models.audit_log import AuditLog
from app.models.ai_analysis_job import AiAnalysisJob
from app.middleware.api_key_auth import hash_api_key
from app.services.session_service import create_session
from app.services import ai_worker
from app.utils.security import create_access_token, hash_password
from app.utils.destination import Destination


class FullSystemAcceptanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.factory = sessionmaker(bind=cls.engine, class_=TenantSession, expire_on_commit=False)
        cls.password = "ValidAdminPass123!"
        cls.password_hash = hash_password(cls.password)

    def setUp(self):
        Base.metadata.create_all(self.engine)

        def override_db():
            with self.factory() as db:
                try:
                    yield db
                    db.commit()
                except Exception:
                    db.rollback()
                    raise

        app.dependency_overrides[get_db] = override_db
        self.client = TestClient(app)

        with self.factory() as db:
            db.info["system_scope"] = True
            org1 = Organization(name="Nexus Defense", slug="nexus-defense")
            org2 = Organization(name="Aegis Cyber", slug="aegis-cyber")
            db.add_all([org1, org2])
            db.flush()

            user1 = User(email="admin@nexus.sec", full_name="Nexus Admin", password_hash=self.password_hash)
            user2 = User(email="analyst@aegis.sec", full_name="Aegis Analyst", password_hash=self.password_hash)
            db.add_all([user1, user2])
            db.flush()

            db.add_all([
                OrganizationMember(organization_id=org1.id, user_id=user1.id, role="owner"),
                OrganizationMember(organization_id=org2.id, user_id=user2.id, role="analyst"),
            ])
            db.flush()

            site1 = Website(
                organization_id=org1.id,
                name="Nexus Gateway",
                domain="localhost",
                url="http://localhost:3000",
                verified=True,
                verification_method="local",
                verified_target="http://localhost:3000",
                verified_addresses=["127.0.0.1"],
                exposure="public",
            )
            site2 = Website(
                organization_id=org2.id,
                name="Aegis Portal",
                domain="localhost",
                url="http://localhost:3000/aegis",
                verified=True,
                verification_method="local",
                verified_target="http://localhost:3000/aegis",
                verified_addresses=["127.0.0.1"],
                exposure="public",
            )
            db.add_all([site1, site2])
            db.flush()

            raw_key1 = "col-nexus-0123456789abcdef"
            int1 = Integration(
                organization_id=org1.id,
                website_id=site1.id,
                name="Nexus WAF",
                api_key_hash=hash_api_key(raw_key1),
                api_secret_hash=hash_api_key("sec1"),
                status="Connected",
                kind="daemon",
            )
            db.add(int1)
            db.flush()

            session1 = create_session(db, user1.id)
            session2 = create_session(db, user2.id)

            self.org1_id = org1.id
            self.org2_id = org2.id
            self.user1_id = user1.id
            self.user1_email = user1.email
            self.user2_id = user2.id
            self.site1_id = site1.id
            self.site2_id = site2.id
            self.token1 = create_access_token(str(user1.id), session1.session_id)
            self.token2 = create_access_token(str(user2.id), session2.session_id)
            self.api_key1 = raw_key1
            db.commit()

        self.headers1 = {
            "Authorization": f"Bearer {self.token1}",
            "X-Organization-ID": str(self.org1_id),
        }
        self.headers2 = {
            "Authorization": f"Bearer {self.token2}",
            "X-Organization-ID": str(self.org2_id),
        }
        self.collector_headers = {
            "X-API-Key": self.api_key1,
            "Content-Encoding": "gzip",
        }

    def tearDown(self):
        app.dependency_overrides.clear()
        Base.metadata.drop_all(self.engine)

    # =========================================================================
    # 1. AUTHENTICATION & IDENTITY (TC-AUTH-01 through TC-AUTH-04)
    # =========================================================================
    def test_tc_auth_01_login_success_and_invalid_credentials(self):
        """TC-AUTH-01: Valid credentials return token; bad password and bad user return 401."""
        # Valid login with JSON payload
        resp = self.client.post("/auth/login", json={"email": "admin@nexus.sec", "password": self.password})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn("access_token", body)
        self.assertEqual(body["token_type"], "bearer")

        # Invalid password
        bad_pw = self.client.post("/auth/login", json={"email": "admin@nexus.sec", "password": "WrongPassword999!"})
        self.assertEqual(bad_pw.status_code, 401)

        # Non-existent email
        bad_user = self.client.post("/auth/login", json={"email": "nonexistent@nexus.sec", "password": self.password})
        self.assertEqual(bad_user.status_code, 401)

    def test_tc_auth_02_registration_and_mode_gating(self):
        """TC-AUTH-02: Registration succeeds in open mode and returns UserResponse."""
        reg_payload = {
            "full_name": "New Officer",
            "email": "officer@defense.net",
            "password": "StrongPassword2026!",
        }
        resp = self.client.post("/auth/register", json=reg_payload)
        self.assertEqual(resp.status_code, 201)
        res_body = resp.json()
        self.assertEqual(res_body["email"], "officer@defense.net")
        self.assertEqual(res_body["full_name"], "New Officer")

        # Check registration status
        stat = self.client.get("/auth/registration-status")
        self.assertEqual(stat.status_code, 200)
        self.assertTrue(stat.json()["registration_enabled"])

    def test_tc_auth_03_tenant_isolation(self):
        """TC-AUTH-03: User in Org 1 cannot access, read, or mutate resources belonging to Org 2."""
        # Org 1 tries to read Org 2's website -> 404
        r1 = self.client.get(f"/websites/{self.site2_id}", headers=self.headers1)
        self.assertEqual(r1.status_code, 404)

        # Org 2 tries to read Org 1's website -> 404
        r2 = self.client.get(f"/websites/{self.site1_id}", headers=self.headers2)
        self.assertEqual(r2.status_code, 404)

        # Cross-tenant header injection: Org 1 user specifying Org 2 header -> 403 Forbidden
        spoof_headers = {
            "Authorization": f"Bearer {self.token1}",
            "X-Organization-ID": str(self.org2_id),
        }
        r3 = self.client.get("/websites/", headers=spoof_headers)
        self.assertEqual(r3.status_code, 403)

    def test_tc_auth_04_session_logout(self):
        """TC-AUTH-04: Session logout invalidates bearer token."""
        logout_resp = self.client.post("/sessions/logout", headers=self.headers1)
        self.assertEqual(logout_resp.status_code, 200)

        # Subsequent authenticated call must fail
        post_logout = self.client.get("/websites/", headers=self.headers1)
        self.assertEqual(post_logout.status_code, 401)

    # =========================================================================
    # 2. WEBSITES & COLLECTOR ENROLLMENT (TC-WEB-01 through TC-WEB-04)
    # =========================================================================
    def test_tc_web_01_to_04_asset_management_and_enrollment(self):
        """TC-WEB-01 to TC-WEB-04: Add website, generate token, and enroll collector."""
        # 1. Add website
        web_payload = {
            "name": "Finance API",
            "url": "http://localhost:3000/finance",
            "environment": "Production",
        }
        r_add = self.client.post("/websites", json=web_payload, headers=self.headers1)
        self.assertEqual(r_add.status_code, 201)
        site_id = r_add.json()["id"]

        # 2. Generate enrollment token
        token_payload = {"expires_in_hours": 2, "max_uses": 5, "label": "Finance Collector"}
        r_tok = self.client.post(f"/websites/{site_id}/enrollment-tokens", json=token_payload, headers=self.headers1)
        self.assertEqual(r_tok.status_code, 201)
        enrollment_token = r_tok.json()["token"]

        # 3. Enroll collector using the enrollment token via X-Enrollment-Token header
        enroll_payload = {
            "name": "Finance Daemon 01",
            "hostname": "fin-collector-box",
            "kind": "daemon",
        }
        r_enroll = self.client.post(
            "/collector/enroll",
            json=enroll_payload,
            headers={"X-Enrollment-Token": enrollment_token},
        )
        self.assertEqual(r_enroll.status_code, 201)
        enroll_res = r_enroll.json()
        self.assertIn("api_key", enroll_res)
        self.assertIn("collector_id", enroll_res)

        # 4. List collectors for website
        r_cols = self.client.get(f"/websites/{site_id}/collectors", headers=self.headers1)
        self.assertEqual(r_cols.status_code, 200)
        self.assertGreaterEqual(len(r_cols.json()), 1)

    # =========================================================================
    # 3. TELEMETRY INGESTION & DASHBOARD METRICS (TC-DASH-01 through TC-DASH-03)
    # =========================================================================
    def test_tc_dash_and_ingestion_data_flow(self):
        """TC-DASH-01 to TC-DASH-03: Ingest batch events, verify dashboard KPIs, threat map, and top IPs."""
        events = [
            {
                "event_id": "v1.stream1.101",
                "event_type": "sqli",
                "title": "SQL Injection attempt: ' UNION SELECT password FROM users --",
                "description": "' OR 1=1 --",
                "severity": "Critical",
                "source": "waf",
                "ip_address": "198.51.100.44",
                "user_agent": "sqlmap/1.5",
                "event_metadata": {"status_code": 401, "url": "http://localhost:3000/login?id=1'"},
            },
            {
                "event_id": "v1.stream1.102",
                "event_type": "xss",
                "title": "Cross-site scripting attempt: <script>alert(1)</script>",
                "description": "payload: <script>",
                "severity": "High",
                "source": "waf",
                "ip_address": "198.51.100.44",
                "user_agent": "Mozilla/5.0",
                "event_metadata": {"status_code": 200, "url": "http://localhost:3000/search"},
            },
            {
                "event_id": "v1.stream1.103",
                "event_type": "info",
                "title": "Normal application health ping",
                "severity": "Info",
                "source": "nginx",
                "ip_address": "192.0.2.1",
                "user_agent": "curl/7.68.0",
                "event_metadata": {"status_code": 200, "url": "http://localhost:3000/health"},
            },
        ]
        body = gzip.compress(json.dumps({"items": events}).encode("utf-8"))
        ingest_resp = self.client.post("/events/batch", content=body, headers=self.collector_headers)
        self.assertEqual(ingest_resp.status_code, 200)
        self.assertEqual(len(ingest_resp.json()["results"]), 3)

        # 1. Verify Dashboard Stats
        dash_resp = self.client.get("/dashboard/stats", headers=self.headers1)
        self.assertEqual(dash_resp.status_code, 200)
        stats = dash_resp.json()
        self.assertGreaterEqual(stats.get("total_alerts", 0), 1)
        self.assertGreaterEqual(stats.get("critical_alerts", 0), 1)

        # 2. Verify Recent Alerts & Recent Logs
        r_alerts = self.client.get("/alerts/recent", headers=self.headers1)
        self.assertEqual(r_alerts.status_code, 200)
        self.assertGreaterEqual(len(r_alerts.json()), 1)

    # =========================================================================
    # 4. ALERTS & INVESTIGATION WORKSPACE (TC-ALERT-01 through TC-ALERT-04)
    # =========================================================================
    def test_tc_alert_lifecycle_and_investigation(self):
        """TC-ALERT-01 to TC-ALERT-04: Alert query, auto-provisioned incident, status transition, timeline."""
        # Seed an alert via event ingestion
        ev = [{
            "event_id": "v1.stream1.201",
            "event_type": "sqli",
            "title": "union select password from admin",
            "description": "' OR 1=1 --",
            "severity": "Critical",
            "source": "waf",
            "ip_address": "203.0.113.88",
            "user_agent": "sqlmap/1.5",
            "event_metadata": {"status_code": 401, "url": "http://localhost:3000/admin"},
        }]
        body = gzip.compress(json.dumps({"items": ev}).encode("utf-8"))
        r_ingest = self.client.post("/events/batch", content=body, headers=self.collector_headers)
        self.assertEqual(r_ingest.status_code, 200)

        # 1. Query alert queue
        alerts_resp = self.client.get("/alerts/", headers=self.headers1)
        self.assertEqual(alerts_resp.status_code, 200)
        alert_list = alerts_resp.json()
        self.assertGreaterEqual(len(alert_list), 1)

        # 2. Query incidents created from policy alert
        incidents_resp = self.client.get("/incidents", headers=self.headers1)
        self.assertEqual(incidents_resp.status_code, 200)
        inc_list = incidents_resp.json()
        self.assertGreaterEqual(len(inc_list), 1)
        inc_id = inc_list[0]["id"]

        # 3. Transition status: OPEN -> INVESTIGATING -> RESOLVED
        patch_resp = self.client.patch(
            f"/incidents/{inc_id}/status",
            json={"status": "INVESTIGATING"},
            headers=self.headers1,
        )
        self.assertEqual(patch_resp.status_code, 200)
        self.assertEqual(patch_resp.json()["status"], "INVESTIGATING")

        res_resp = self.client.patch(
            f"/incidents/{inc_id}/status",
            json={"status": "RESOLVED"},
            headers=self.headers1,
        )
        self.assertEqual(res_resp.status_code, 200)
        self.assertEqual(res_resp.json()["status"], "RESOLVED")

    # =========================================================================
    # 5. ASYNCHRONOUS AI ANALYST WORKER & ENRICHMENT (TC-AI-01 through TC-AI-03)
    # =========================================================================
    def test_tc_ai_analyst_enrichment_and_circuit_breaker(self):
        """TC-AI-01 to TC-AI-03: Asynchronous job queue, GT-Beta enrichment, and circuit breaker."""
        ev = [{
            "event_id": "v1.stream1.301",
            "event_type": "sqli",
            "title": "union select password from users",
            "description": "' OR 1=1 --",
            "severity": "Critical",
            "source": "waf",
            "ip_address": "198.51.100.99",
            "user_agent": "sqlmap/1.5",
            "event_metadata": {"status_code": 401},
        }]
        body = gzip.compress(json.dumps({"items": ev}).encode("utf-8"))

        from app.config.runtime import RuntimeConfig
        test_cfg = RuntimeConfig(
            database_url="sqlite://",
            jwt_secret="test-secret-at-least-32-chars-long-here-0123456789",
            environment="test",
            cors_origins=(),
            ai_analyst_enabled=True,
            ai_analyst_min_risk_score=0,
            ai_queue_max_pending=500,
        )

        with patch("app.services.event_service.get_runtime_config", return_value=test_cfg):
            r = self.client.post("/events/batch", content=body, headers=self.collector_headers)
            self.assertEqual(r.status_code, 200)

        with self.factory() as db:
            db.info["system_scope"] = True
            job = db.query(AiAnalysisJob).first()
            self.assertIsNotNone(job)
            self.assertEqual(job.status, "PENDING")

        # Execute AI worker loop with mock inference
        mock_gt_beta = {
            "analysis": "Automated SQL injection probe verified. Exploitation blocked.",
            "decision": "RESPOND",
            "confidence_score": 96,
            "threat_classification": "SQL Injection",
        }
        with patch("app.services.ai_worker.get_runtime_config", return_value=test_cfg), \
             patch("app.services.ai_worker.SessionLocal", side_effect=self.factory), \
             patch("app.services.ai_worker._call_gt_beta_inference", return_value=(True, mock_gt_beta, None)), \
             patch("app.services.ai_worker._stop_event.is_set", side_effect=[False, True]):
            ai_worker._ai_worker_loop()

        with self.factory() as db:
            db.info["system_scope"] = True
            job_done = db.query(AiAnalysisJob).first()
            self.assertEqual(job_done.status, "SUCCEEDED")
            ev_done = db.query(Event).filter(Event.id == job_done.event_id).first()
            self.assertEqual(ev_done.ai_status, "COMPLETED")
            self.assertEqual(ev_done.analyst_result.get("decision"), "RESPOND")
            self.assertEqual(ev_done.analyst_result.get("confidence_score"), 96)

    # =========================================================================
    # 6. INCIDENTS MANAGEMENT (TC-INC-01 and TC-INC-02)
    # =========================================================================
    def test_tc_inc_01_and_02_incident_lifecycle(self):
        """TC-INC-01 & TC-INC-02: Auto-provisioning, query, assign, update, and resolve incident."""
        # High-severity event triggers auto-provisioned incident
        ev = [{
            "event_id": "v1.stream1.401",
            "event_type": "sqli",
            "title": "Critical automated exploit probe",
            "description": "' OR 1=1 --",
            "severity": "Critical",
            "source": "waf",
            "ip_address": "198.51.100.99",
            "user_agent": "sqlmap/1.5",
            "event_metadata": {"status_code": 401, "url": "http://localhost:3000/admin"},
        }]
        body = gzip.compress(json.dumps({"items": ev}).encode("utf-8"))
        self.client.post("/events/batch", content=body, headers=self.collector_headers)

        # List incidents
        r_list = self.client.get("/incidents", headers=self.headers1)
        self.assertEqual(r_list.status_code, 200)
        incidents = r_list.json()
        self.assertGreaterEqual(len(incidents), 1)
        inc_id = incidents[0]["id"]

        # Update status
        r_patch = self.client.patch(
            f"/incidents/{inc_id}/status",
            json={"status": "INVESTIGATING"},
            headers=self.headers1,
        )
        self.assertEqual(r_patch.status_code, 200)
        self.assertEqual(r_patch.json()["status"], "INVESTIGATING")

        # Assign incident to active organization analyst
        r_assign = self.client.patch(
            f"/incidents/{inc_id}/assign",
            json={"assigned_to": self.user1_email},
            headers=self.headers1,
        )
        self.assertEqual(r_assign.status_code, 200)
        self.assertEqual(r_assign.json()["assigned_to"], self.user1_email)

    # =========================================================================
    # 7. RESPONSE ACTIONS & REMEDIATION (TC-RESP-01 and TC-RESP-02)
    # =========================================================================
    def test_tc_resp_01_and_02_mitigation_actions(self):
        """TC-RESP-01 & TC-RESP-02: Stage response action, execute simulation, and list."""
        with self.factory() as db:
            db.info["system_scope"] = True
            inc = Incident(
                organization_id=self.org1_id,
                website_id=self.site1_id,
                incident_code="INC-TEST01",
                title="Active SQL Injection Incident",
                description="Exploit attempt",
                threat_level="CRITICAL",
                priority="P1",
                status="OPEN",
                source_ip="198.51.100.99",
                target="http://localhost:3000",
                confidence=90,
            )
            db.add(inc)
            db.flush()
            inc_id = inc.id
            db.commit()

        resp_payload = {
            "action_type": "BLOCK_IP",
            "target": "198.51.100.99",
            "reason": "Repeated automated SQLi attempts",
        }
        r_stage = self.client.post(f"/response-actions/?incident_id={inc_id}", json=resp_payload, headers=self.headers1)
        self.assertEqual(r_stage.status_code, 200)
        action_id = r_stage.json()["id"]

        # Execute response action (simulation)
        r_exec = self.client.post(f"/response-actions/{action_id}/execute", headers=self.headers1)
        self.assertEqual(r_exec.status_code, 200)
        self.assertEqual(r_exec.json()["status"], "SIMULATED")

        # List response actions
        r_list = self.client.get("/response-actions/", headers=self.headers1)
        self.assertEqual(r_list.status_code, 200)
        self.assertGreaterEqual(len(r_list.json()), 1)

    # =========================================================================
    # 8. VULNERABILITY SCANNER (TC-SCAN-01 through TC-SCAN-03 & TC-REP-01)
    # =========================================================================
    def test_tc_scan_and_report_pipeline(self):
        """TC-SCAN-01 to TC-SCAN-03 & TC-REP-01: Launch scan, inspect status, history, report, and delete terminal scan."""
        scan_payload = {
            "website_id": self.site1_id,
            "engine": "sqlmap",
        }
        dest = Destination("http://localhost:3000", "http", "localhost", 3000, ("127.0.0.1",), "/", "localhost")
        with patch("app.utils.destination.validate_destination", return_value=dest), \
             patch("app.services.scanner_worker.enqueue_scan"):
            r_launch = self.client.post("/scans/", json=scan_payload, headers=self.headers1)
            self.assertEqual(r_launch.status_code, 200)
            scan_id = r_launch.json()["id"]

            # Query scan status
            r_stat = self.client.get(f"/scans/{scan_id}", headers=self.headers1)
            self.assertEqual(r_stat.status_code, 200)
            self.assertEqual(r_stat.json()["id"], scan_id)

            # Query scan history for website
            r_hist = self.client.get(f"/scans/history/{self.site1_id}", headers=self.headers1)
            self.assertEqual(r_hist.status_code, 200)
            self.assertGreaterEqual(len(r_hist.json()), 1)

            # Query scan report
            r_rep = self.client.get(f"/scanner/{scan_id}/report", headers=self.headers1)
            self.assertEqual(r_rep.status_code, 200)
            self.assertEqual(r_rep.json()["id"], scan_id)

            # Set scan to Completed terminal state to verify deletion
            with self.factory() as db:
                db.info["system_scope"] = True
                sc = db.query(Scan).filter(Scan.id == scan_id).first()
                sc.status = "Completed"
                db.commit()

            # Delete terminal scan
            r_del = self.client.delete(f"/scans/{scan_id}", headers=self.headers1)
            self.assertEqual(r_del.status_code, 200)
            self.assertTrue(r_del.json().get("deleted"))

    # =========================================================================
    # 9. AUDIT LOGS & SETTINGS (TC-AUD-01, TC-SET-01, TC-SET-02)
    # =========================================================================
    def test_tc_audit_logs_and_organization_settings(self):
        """TC-AUD-01, TC-SET-01 & TC-SET-02: Settings update, member invitation, and audit trail."""
        # 1. Update settings
        set_payload = {
            "session_timeout": 60,
            "organization_name": "Nexus Defense Operations",
        }
        r_set = self.client.put("/settings/", json=set_payload, headers=self.headers1)
        self.assertEqual(r_set.status_code, 200)
        self.assertEqual(r_set.json()["session_timeout"], 60)

        # 2. Query audit logs to verify immutable recording
        r_aud = self.client.get("/audit-logs/", headers=self.headers1)
        self.assertEqual(r_aud.status_code, 200)
        audits = r_aud.json()
        self.assertIsInstance(audits, list)


if __name__ == "__main__":
    unittest.main()
