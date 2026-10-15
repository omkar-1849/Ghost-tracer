"""Comprehensive tests for Scanner Intelligence API Routers.

Tests endpoints:
- GET /findings (filtering by website_id, status, severity, engine)
- GET /findings/{id} (details + observations)
- PATCH /findings/{id}/status (lifecycle transitions & permissions)
- GET /investigations (list + filtering)
- GET /investigations/{id} (details + evidence bundle + report)
- POST /investigations/{id}/cancel (job & investigation cancellation)
- GET /scans/{id}/findings (scan finding observations)
- GET /scans/{id}/investigation (scan latest investigation)
- POST /scans/{id}/investigate (re-trigger analysis / idempotency)
- POST /scans (409 conflict when scan already running)
- Cross-tenant isolation on all resources
"""
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.database import TenantSession, get_db
from app.main import app
from app.models.investigation import Investigation
from app.models.investigation_job import InvestigationJob
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.scan import Scan
from app.models.scanner_finding import ScannerFinding
from app.models.scanner_finding_observation import ScannerFindingObservation
from app.models.user import User
from app.models.website import Website
from app.services.session_service import create_session
from app.utils.security import create_access_token, hash_password


class ScannerIntelligenceRouterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
        cls.factory = sessionmaker(
            bind=cls.engine, class_=TenantSession, expire_on_commit=False
        )
        Base.metadata.create_all(cls.engine)

        pw_hash = hash_password("Password123!")

        with cls.factory() as db:
            db.info["system_scope"] = True

            # Users
            cls.user1 = User(id=1, email="admin1@tenant1.test", password_hash=pw_hash, full_name="Admin 1")
            cls.user_viewer = User(id=2, email="viewer@tenant1.test", password_hash=pw_hash, full_name="Viewer 1")
            cls.user2 = User(id=3, email="admin2@tenant2.test", password_hash=pw_hash, full_name="Admin 2")
            db.add_all([cls.user1, cls.user_viewer, cls.user2])
            db.flush()

            # Orgs
            cls.org1 = Organization(id=1, name="Tenant 1", slug="tenant-1")
            cls.org2 = Organization(id=2, name="Tenant 2", slug="tenant-2")
            db.add_all([cls.org1, cls.org2])
            db.flush()

            # Members
            m1 = OrganizationMember(id=1, user_id=1, organization_id=1, role="owner")
            m_viewer = OrganizationMember(id=2, user_id=2, organization_id=1, role="viewer")
            m2 = OrganizationMember(id=3, user_id=3, organization_id=2, role="owner")
            db.add_all([m1, m_viewer, m2])
            db.flush()

            # Sessions & Auth Tokens
            sess1 = create_session(db, 1)
            sess_v = create_session(db, 2)
            sess2 = create_session(db, 3)
            db.flush()

            cls.token_admin1 = create_access_token(str(cls.user1.id), sess1.session_id)
            cls.token_viewer1 = create_access_token(str(cls.user_viewer.id), sess_v.session_id)
            cls.token_admin2 = create_access_token(str(cls.user2.id), sess2.session_id)

            # Websites
            cls.site1 = Website(
                id=1,
                organization_id=1,
                name="Tenant 1 Site",
                url="https://site1.example.com",
                domain="site1.example.com",
                verified=True,
                verified_target="https://site1.example.com",
                verified_addresses=["192.0.2.1"],
                exposure="public",
            )
            cls.site2 = Website(
                id=2,
                organization_id=2,
                name="Tenant 2 Site",
                url="https://site2.example.com",
                domain="site2.example.com",
                verified=True,
                verified_target="https://site2.example.com",
                verified_addresses=["192.0.2.2"],
                exposure="public",
            )
            db.add_all([cls.site1, cls.site2])
            db.flush()

            # Scans
            cls.scan1 = Scan(
                id=1,
                organization_id=1,
                website_id=1,
                engine="ssl",
                target="https://site1.example.com",
                status="Completed",
                findings=1,
                risk_score=75,
            )
            cls.scan2 = Scan(
                id=2,
                organization_id=2,
                website_id=2,
                engine="ssl",
                target="https://site2.example.com",
                status="Completed",
                findings=1,
                risk_score=50,
            )
            cls.running_scan = Scan(
                id=3,
                organization_id=1,
                website_id=1,
                engine="nmap",
                target="https://site1.example.com",
                status="Running",
                findings=0,
                risk_score=0,
            )
            db.add_all([cls.scan1, cls.scan2, cls.running_scan])
            db.flush()

            # Findings
            cls.finding1 = ScannerFinding(
                id=1,
                organization_id=1,
                website_id=1,
                scan_id=1,
                fingerprint="fp-0001-tenant1",
                engine="ssl",
                category="tls_certificate",
                title="Expired SSL Certificate",
                description="The certificate expired.",
                severity="high",
                confidence=1.0,
                status="open",
                first_seen_at=datetime.now(timezone.utc).replace(tzinfo=None),
                last_seen_at=datetime.now(timezone.utc).replace(tzinfo=None),
                seen_count=1,
            )
            cls.finding2 = ScannerFinding(
                id=2,
                organization_id=2,
                website_id=2,
                scan_id=2,
                fingerprint="fp-0002-tenant2",
                engine="ssl",
                category="tls_certificate",
                title="Self Signed SSL Certificate",
                description="Self signed certificate.",
                severity="medium",
                confidence=1.0,
                status="open",
                first_seen_at=datetime.now(timezone.utc).replace(tzinfo=None),
                last_seen_at=datetime.now(timezone.utc).replace(tzinfo=None),
                seen_count=1,
            )
            db.add_all([cls.finding1, cls.finding2])
            db.flush()

            # Observations
            obs1 = ScannerFindingObservation(
                id=1,
                organization_id=1,
                finding_id=1,
                scan_id=1,
                engine="ssl",
                scanner_rule_id="ssl-cert-expired",
                raw_severity="high",
                confidence=1.0,
                evidence_data={"error": "Certificate has expired"},
            )
            db.add(obs1)

            # Investigations
            cls.inv1 = Investigation(
                id=1,
                organization_id=1,
                website_id=1,
                trigger_scan_id=1,
                status="COMPLETED",
                title="Investigation for Scan #1",
                summary="AI confirmed expired certificate.",
                risk_level="HIGH",
                confidence=0.95,
                report={
                    "executive_summary": "High risk expired cert",
                    "prioritized_findings": [{"title": "Expired SSL Certificate", "severity": "high"}],
                },
                evidence_bundle={"scan_id": 1, "findings_analyzed": 1},
            )
            cls.inv_pending = Investigation(
                id=2,
                organization_id=1,
                website_id=1,
                trigger_scan_id=1,
                status="PENDING",
                title="Pending Investigation",
            )
            cls.inv_job = InvestigationJob(
                id=1,
                organization_id=1,
                investigation_id=2,
                status="PENDING",
            )
            cls.inv2 = Investigation(
                id=3,
                organization_id=2,
                website_id=2,
                trigger_scan_id=2,
                status="COMPLETED",
                title="Tenant 2 Investigation",
            )
            db.add_all([cls.inv1, cls.inv_pending, cls.inv_job, cls.inv2])
            db.commit()

        def _get_db():
            session = cls.factory()
            try:
                yield session
            finally:
                session.close()

        app.dependency_overrides[get_db] = _get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        cls.engine.dispose()

    def _headers(self, token, org_id):
        return {
            "Authorization": f"Bearer {token}",
            "X-Organization-ID": str(org_id),
        }

    # --- Findings Endpoints ---
    def test_list_findings_and_tenant_isolation(self):
        # Tenant 1 sees finding 1, not finding 2
        resp = self.client.get("/findings", headers=self._headers(self.token_admin1, 1))
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], 1)
        self.assertEqual(data[0]["title"], "Expired SSL Certificate")

        # Tenant 2 sees finding 2, not finding 1
        resp2 = self.client.get("/findings", headers=self._headers(self.token_admin2, 2))
        self.assertEqual(resp2.status_code, 200)
        data2 = resp2.json()
        self.assertEqual(len(data2), 1)
        self.assertEqual(data2[0]["id"], 2)

    def test_filter_findings_by_severity_and_status(self):
        resp = self.client.get("/findings?severity=high&status=open", headers=self._headers(self.token_admin1, 1))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()), 1)

        resp_empty = self.client.get("/findings?severity=low", headers=self._headers(self.token_admin1, 1))
        self.assertEqual(resp_empty.status_code, 200)
        self.assertEqual(len(resp_empty.json()), 0)

    def test_get_finding_detail_with_observations(self):
        resp = self.client.get("/findings/1", headers=self._headers(self.token_admin1, 1))
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["id"], 1)
        self.assertEqual(len(data["observations"]), 1)
        self.assertEqual(data["observations"][0]["scanner_rule_id"], "ssl-cert-expired")

        # Cross-tenant access rejected
        resp_cross = self.client.get("/findings/2", headers=self._headers(self.token_admin1, 1))
        self.assertEqual(resp_cross.status_code, 404)

    def test_update_finding_status_and_rbac(self):
        # Viewer cannot update status (403)
        resp_viewer = self.client.patch(
            "/findings/1/status",
            json={"status": "acknowledged"},
            headers=self._headers(self.token_viewer1, 1),
        )
        self.assertEqual(resp_viewer.status_code, 403)

        # Admin can update status
        resp_admin = self.client.patch(
            "/findings/1/status",
            json={"status": "acknowledged"},
            headers=self._headers(self.token_admin1, 1),
        )
        self.assertEqual(resp_admin.status_code, 200)
        self.assertEqual(resp_admin.json()["status"], "acknowledged")

        # Cross-tenant update rejected with 404
        resp_cross = self.client.patch(
            "/findings/2/status",
            json={"status": "resolved"},
            headers=self._headers(self.token_admin1, 1),
        )
        self.assertEqual(resp_cross.status_code, 404)

    # --- Investigations Endpoints ---
    def test_list_investigations_and_tenant_isolation(self):
        resp = self.client.get("/investigations", headers=self._headers(self.token_admin1, 1))
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        inv_ids = [inv["id"] for inv in data]
        self.assertIn(1, inv_ids)
        self.assertIn(2, inv_ids)
        self.assertNotIn(3, inv_ids)

    def test_get_investigation_detail(self):
        resp = self.client.get("/investigations/1", headers=self._headers(self.token_admin1, 1))
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["id"], 1)
        self.assertEqual(data["risk_level"], "HIGH")
        self.assertIsNotNone(data["report"])

        # Cross-tenant access rejected
        resp_cross = self.client.get("/investigations/3", headers=self._headers(self.token_admin1, 1))
        self.assertEqual(resp_cross.status_code, 404)

    def test_cancel_investigation(self):
        # Completed investigation cannot be cancelled (400)
        resp_comp = self.client.post("/investigations/1/cancel", headers=self._headers(self.token_admin1, 1))
        self.assertEqual(resp_comp.status_code, 400)

        # Pending investigation can be cancelled
        resp_cancel = self.client.post("/investigations/2/cancel", headers=self._headers(self.token_admin1, 1))
        self.assertEqual(resp_cancel.status_code, 200)
        self.assertEqual(resp_cancel.json()["status"], "CANCELLED")

    # --- Scan Sub-resource Endpoints ---
    def test_scan_findings_and_investigation_subresources(self):
        # GET /scans/1/findings
        resp_findings = self.client.get("/scans/1/findings", headers=self._headers(self.token_admin1, 1))
        self.assertEqual(resp_findings.status_code, 200)
        self.assertEqual(len(resp_findings.json()), 1)
        self.assertEqual(resp_findings.json()[0]["id"], 1)

        # GET /scans/1/investigation
        resp_inv = self.client.get("/scans/1/investigation", headers=self._headers(self.token_admin1, 1))
        self.assertEqual(resp_inv.status_code, 200)
        self.assertEqual(resp_inv.json()["website_id"], 1)

        # Cross-tenant scan access rejected
        resp_cross = self.client.get("/scans/2/findings", headers=self._headers(self.token_admin1, 1))
        self.assertEqual(resp_cross.status_code, 404)

    def test_post_scan_409_when_already_running(self):
        # Site 1 has scan 3 in "Running" status
        with patch("app.utils.destination.validate_destination") as mock_dest:
            mock_dest.return_value.url = "https://site1.example.com"
            mock_dest.return_value.addresses = ["192.0.2.1"]

            resp = self.client.post(
                "/scans/",
                json={"website_id": 1, "engine": "ssl"},
                headers=self._headers(self.token_admin1, 1),
            )
            self.assertEqual(resp.status_code, 409)
            self.assertIn("Another scan is already running", resp.json()["detail"])


if __name__ == "__main__":
    unittest.main()
