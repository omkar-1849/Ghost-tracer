"""Tests for Token-First Protected Asset Onboarding and Collector Auto-Provisioning.

Covers:
- POST /enrollment-tokens creates tenant-scoped tokens without requiring a website_id.
- Role checks: owner/admin allowed, analyst/viewer denied.
- POST /collector/v1/enroll automatically creates the protected asset with exposure='internal'.
- Name, domain, and safe internal URL auto-provisioning.
- GET /enrollment-tokens/{id}/status returns token, website, and collector state for polling.
"""
from datetime import datetime, timedelta, timezone
import unittest

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
from app.utils.security import hash_password, create_access_token
from app.utils.rate_limiter import reset_enroll_limiter


class TokenFirstOnboardingTests(unittest.TestCase):
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

        with self.SessionLocal() as db:
            db.info["system_scope"] = True
            self.org = Organization(name="Acme Corp", slug="acme")
            self.other_org = Organization(name="Other Corp", slug="other")
            db.add_all([self.org, self.other_org])
            db.flush()

            self.owner = User(
                email="owner@acme.test",
                password_hash=hash_password("Secret123!"),
                is_active=True,
            )
            self.admin = User(
                email="admin@acme.test",
                password_hash=hash_password("Secret123!"),
                is_active=True,
            )
            self.analyst = User(
                email="analyst@acme.test",
                password_hash=hash_password("Secret123!"),
                is_active=True,
            )
            self.viewer = User(
                email="viewer@acme.test",
                password_hash=hash_password("Secret123!"),
                is_active=True,
            )
            db.add_all([self.owner, self.admin, self.analyst, self.viewer])
            db.flush()

            db.add_all([
                OrganizationMember(organization_id=self.org.id, user_id=self.owner.id, role="owner"),
                OrganizationMember(organization_id=self.org.id, user_id=self.admin.id, role="admin"),
                OrganizationMember(organization_id=self.org.id, user_id=self.analyst.id, role="analyst"),
                OrganizationMember(organization_id=self.org.id, user_id=self.viewer.id, role="viewer"),
            ])
            db.commit()

        self.owner_headers = self._headers(self.owner, self.org.id)
        self.admin_headers = self._headers(self.admin, self.org.id)
        self.analyst_headers = self._headers(self.analyst, self.org.id)
        self.viewer_headers = self._headers(self.viewer, self.org.id)

    def tearDown(self):
        reset_enroll_limiter()
        app.dependency_overrides.clear()
        Base.metadata.drop_all(self.engine)

    def _headers(self, user: User, org_id: int) -> dict:
        with self.SessionLocal() as db:
            session = create_session(db, user_id=user.id, user_agent="test", ip_address="127.0.0.1")
            db.commit()
            token = create_access_token(str(user.id), session.session_id)
            return {
                "Authorization": f"Bearer {token}",
                "X-Organization-ID": str(org_id),
            }

    def test_create_tenant_token_as_owner_and_admin(self):
        """Owner and admin can create tenant-scoped enrollment tokens."""
        # Owner creates token
        res_owner = self.client.post(
            "/enrollment-tokens",
            json={"label": "Production Nginx", "expires_in_hours": 48, "max_uses": 1},
            headers=self.owner_headers,
        )
        self.assertEqual(res_owner.status_code, 201)
        data = res_owner.json()
        self.assertTrue(data["token"].startswith("snt_enr_"))
        self.assertEqual(data["max_uses"], 1)

        # Admin creates token
        res_admin = self.client.post(
            "/enrollment-tokens",
            json={"label": "Staging Backend", "expires_in_hours": 24, "max_uses": 2},
            headers=self.admin_headers,
        )
        self.assertEqual(res_admin.status_code, 201)
        data_admin = res_admin.json()
        self.assertTrue(data_admin["token"].startswith("snt_enr_"))
        self.assertEqual(data_admin["max_uses"], 2)

    def test_analyst_and_viewer_cannot_create_tenant_token(self):
        """Analyst and viewer cannot create enrollment tokens."""
        res_analyst = self.client.post(
            "/enrollment-tokens",
            json={"label": "Unauthorized"},
            headers=self.analyst_headers,
        )
        self.assertEqual(res_analyst.status_code, 403)

        res_viewer = self.client.post(
            "/enrollment-tokens",
            json={"label": "Unauthorized"},
            headers=self.viewer_headers,
        )
        self.assertEqual(res_viewer.status_code, 403)

    def test_tenant_token_auto_provisions_protected_asset(self):
        """Enrolling with a tenant token auto-registers the Protected Asset."""
        # Step 1: Owner creates tenant enrollment token
        res = self.client.post(
            "/enrollment-tokens",
            json={"label": "My Web Server", "expires_in_hours": 24, "max_uses": 1},
            headers=self.owner_headers,
        )
        self.assertEqual(res.status_code, 201)
        token_info = res.json()
        raw_token = token_info["token"]
        token_id = token_info["id"]

        # Step 2: Poll status before enrollment
        status_res = self.client.get(
            f"/enrollment-tokens/{token_id}/status",
            headers=self.owner_headers,
        )
        self.assertEqual(status_res.status_code, 200)
        status_data = status_res.json()
        self.assertEqual(status_data["status"], "active")
        self.assertEqual(status_data["used_count"], 0)
        self.assertIsNone(status_data["website"])
        self.assertIsNone(status_data["collector"])

        # Step 3: Machine-plane collector enrolls using the token
        enroll_res = self.client.post(
            "/collector/enroll",
            headers={"X-Enrollment-Token": raw_token},
            json={
                "name": "Nginx Ingress",
                "kind": "daemon",
                "version": "1.0.0",
                "hostname": "prod-srv-01",
            },
        )
        self.assertEqual(enroll_res.status_code, 201)
        enroll_data = enroll_res.json()
        self.assertTrue(enroll_data["api_key"].startswith("snt_col_"))
        self.assertEqual(enroll_data["asset_name"], "My Web Server")

        # Step 4: Verify in database that website was created properly
        with self.SessionLocal() as db:
            db.info["system_scope"] = True
            token_row = db.query(EnrollmentToken).filter(EnrollmentToken.id == token_id).first()
            self.assertIsNotNone(token_row.website_id)
            self.assertEqual(token_row.used_count, 1)

            website = db.query(Website).filter(Website.id == token_row.website_id).first()
            self.assertIsNotNone(website)
            self.assertEqual(website.organization_id, self.org.id)
            self.assertEqual(website.name, "My Web Server")
            self.assertEqual(website.domain, "prod-srv-01")
            self.assertEqual(website.exposure, "internal")
            self.assertEqual(website.status, "Active")
            self.assertTrue(website.monitoring_enabled)

            # Check collector
            collector = db.query(Integration).filter(Integration.id == enroll_data["collector_id"]).first()
            self.assertIsNotNone(collector)
            self.assertEqual(collector.website_id, website.id)
            self.assertEqual(collector.organization_id, self.org.id)
            self.assertEqual(collector.hostname, "prod-srv-01")
            self.assertEqual(collector.version, "1.0.0")

            # Check audit log
            audit = db.query(AuditLog).filter(
                AuditLog.action == "COLLECTOR_ENROLLED",
                AuditLog.resource_id == str(collector.id),
            ).first()
            self.assertIsNotNone(audit)
            self.assertEqual(audit.organization_id, self.org.id)

        # Step 5: Poll status after enrollment
        status_res_after = self.client.get(
            f"/enrollment-tokens/{token_id}/status",
            headers=self.owner_headers,
        )
        self.assertEqual(status_res_after.status_code, 200)
        after_data = status_res_after.json()
        self.assertEqual(after_data["status"], "exhausted")
        self.assertEqual(after_data["used_count"], 1)
        self.assertIsNotNone(after_data["website"])
        self.assertEqual(after_data["website"]["name"], "My Web Server")
        self.assertEqual(after_data["website"]["exposure"], "internal")
        self.assertIsNotNone(after_data["collector"])
        self.assertEqual(after_data["collector"]["hostname"], "prod-srv-01")

    def test_hostname_fallback_and_url_collision_handling(self):
        """Fallback to host name and safe collision handling on auto-provisioning."""
        # Token 1 with default host
        res1 = self.client.post(
            "/enrollment-tokens",
            json={"expires_in_hours": 24, "max_uses": 1},
            headers=self.owner_headers,
        )
        token1 = res1.json()["token"]

        enroll1 = self.client.post(
            "/collector/enroll",
            headers={"X-Enrollment-Token": token1},
            json={"hostname": "host-alpha"},
        )
        self.assertEqual(enroll1.status_code, 201)
        self.assertEqual(enroll1.json()["asset_name"], "Protected Host (host-alpha)")

        # Token 2 with SAME hostname
        res2 = self.client.post(
            "/enrollment-tokens",
            json={"expires_in_hours": 24, "max_uses": 1},
            headers=self.owner_headers,
        )
        token2 = res2.json()["token"]

        enroll2 = self.client.post(
            "/collector/enroll",
            headers={"X-Enrollment-Token": token2},
            json={"hostname": "host-alpha"},
        )
        self.assertEqual(enroll2.status_code, 201)

        # Verify both websites exist without unique constraint violation
        with self.SessionLocal() as db:
            db.info["system_scope"] = True
            sites = db.query(Website).filter(Website.organization_id == self.org.id).all()
            self.assertEqual(len(sites), 2)
            urls = {s.url for s in sites}
            self.assertIn("http://host-alpha", urls)
            self.assertIn("http://host-alpha-1", urls)
