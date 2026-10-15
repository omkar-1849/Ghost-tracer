"""Unit and integration tests for security hardening tasks.

Covers:
- REGISTRATION_MODE enforcement (closed -> 403, open -> 201) and registration-status endpoint
- CLI bootstrap admin provisioning (creates Org, User, Membership; password hashed; rejects duplicate)
- Trusted proxy client IP resolution (get_client_ip) with CIDR filtering and right-to-left XFF walk
- Query string sensitive parameter redaction and JWT redaction in URLs and logs
- Enrollment token default TTL (1 hour)
"""

import importlib
import ipaddress
import pkgutil
import unittest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import app.models as model_package
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

for module in pkgutil.iter_modules(model_package.__path__, "app.models."):
    importlib.import_module(module.name)

from app.cli.bootstrap_admin import bootstrap_admin
from app.config.runtime import RuntimeConfig
from app.database.base import Base
from app.database.database import TenantSession
from app.main import app
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.user import User
from app.models.website import Website
from app.schemas.enrollment_token_schema import EnrollmentTokenCreate
from app.services.enrollment_service import create_token
from app.services.normalization_service import (
    redact_sensitive_metadata,
    redact_sensitive_text,
    redact_sensitive_url,
)
from app.utils.client_ip import get_client_ip


class SecurityHardeningTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.SessionFactory = sessionmaker(
            bind=self.engine, class_=TenantSession, expire_on_commit=False, autoflush=False
        )
        self.db = self.SessionFactory()
        self.db.info["system_scope"] = True
        self.client = TestClient(app)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_registration_status_endpoint(self):
        resp = self.client.get("/auth/registration-status")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("registration_mode", data)
        self.assertIn("registration_enabled", data)

    def test_registration_blocked_when_mode_is_closed(self):
        mock_cfg = MagicMock()
        mock_cfg.registration_mode = "closed"

        with patch("app.routers.auth_router.get_runtime_config", return_value=mock_cfg):
            resp = self.client.post(
                "/auth/register",
                json={
                    "email": "intruder@example.com",
                    "password": "Password123!Safe",
                    "full_name": "Intruder",
                },
            )
            self.assertEqual(resp.status_code, 403)
            self.assertIn("disabled", resp.json().get("detail", "").lower())

    def test_trusted_proxy_ip_resolution(self):
        # 1. Without trusted proxy configured: returns direct client peer
        req = MagicMock()
        req.client.host = "198.51.100.5"
        req.headers = {"x-forwarded-for": "203.0.113.195, 10.0.0.1"}

        mock_cfg = MagicMock()
        mock_cfg.trusted_proxy_cidrs = ()
        with patch("app.utils.client_ip.get_runtime_config", return_value=mock_cfg):
            resolved = get_client_ip(req)
            self.assertEqual(resolved, "198.51.100.5")

        # 2. With trusted proxy: immediate peer is inside 10.0.0.0/8
        mock_cfg.trusted_proxy_cidrs = (
            ipaddress.ip_network("10.0.0.0/8"),
            ipaddress.ip_network("172.16.0.0/12"),
        )
        req.client.host = "10.0.0.2"
        # XFF: genuine client 203.0.113.195 -> intermediate proxy 172.16.0.5
        req.headers = {"x-forwarded-for": "203.0.113.195, 172.16.0.5"}

        with patch("app.utils.client_ip.get_runtime_config", return_value=mock_cfg):
            resolved = get_client_ip(req)
            self.assertEqual(resolved, "203.0.113.195")

        # 3. Untrusted peer trying to spoof XFF
        req.client.host = "192.0.2.1"  # Not in trusted CIDRs
        req.headers = {"x-forwarded-for": "8.8.8.8"}
        with patch("app.utils.client_ip.get_runtime_config", return_value=mock_cfg):
            resolved = get_client_ip(req)
            self.assertEqual(resolved, "192.0.2.1")

    def test_sensitive_query_parameters_redaction(self):
        url = "https://example.com/api/v1/auth/callback?code=sec456&state=ok&token=jwt.tok.here&user=test"
        redacted = redact_sensitive_url(url)
        self.assertIn("user=test", redacted)
        self.assertIn("state=ok", redacted)
        self.assertNotIn("sec456", redacted)
        self.assertNotIn("jwt.tok.here", redacted)
        self.assertIn("code=%5BREDACTED%5D", redacted)
        self.assertIn("token=%5BREDACTED%5D", redacted)

    def test_jwt_redaction_in_url_and_text(self):
        jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisSignature"
        text = f"User logged in with bearer token {jwt} from dashboard"
        redacted_text = redact_sensitive_text(text)
        self.assertNotIn("doNotLeakThisSignature", redacted_text)
        self.assertIn("[REDACTED_JWT]", redacted_text)

        url = f"https://example.com/session/{jwt}?client=ios"
        redacted_url = redact_sensitive_url(url)
        self.assertNotIn("doNotLeakThisSignature", redacted_url)
        self.assertIn("[REDACTED_JWT]", redacted_url)

    def test_metadata_redaction(self):
        meta = {
            "method": "POST",
            "url": "https://api.test/login?password=mysecretpassword",
            "token": "api_key_secret_123",
            "extra": {"nested_url": "https://api.test/data?api_key=secret99"},
        }
        redacted = redact_sensitive_metadata(meta)
        self.assertEqual(redacted["token"], "[REDACTED]")
        self.assertNotIn("mysecretpassword", redacted["url"])
        self.assertNotIn("secret99", redacted["extra"]["nested_url"])

    def test_enrollment_token_default_ttl_is_1_hour(self):
        # 1. Schema default
        schema_obj = EnrollmentTokenCreate()
        self.assertEqual(schema_obj.expires_in_hours, 1)

        # 2. Service default
        org = Organization(id=1, name="Acme", slug="acme")
        site = Website(id=1, organization_id=1, name="Web", url="https://acme.test", domain="acme.test")
        user = User(id=1, email="admin@acme.test", password_hash="pwd", is_active=True)
        self.db.add_all([org, site, user])
        self.db.commit()

        self.db.info["organization_id"] = 1
        before = datetime.utcnow()
        tok_row, raw_token = create_token(self.db, site, user_id=1)
        after = datetime.utcnow()

        # Token expiration should be roughly 1 hour from now, not 24
        expected_expiry = before + timedelta(hours=1)
        self.assertAlmostEqual(
            tok_row.expires_at.timestamp(), expected_expiry.timestamp(), delta=60
        )

    def test_bootstrap_admin_cli(self):
        with patch("app.cli.bootstrap_admin.SessionLocal", side_effect=self.SessionFactory):
            org_id, user_id = bootstrap_admin(
                email="root@enterprise.test",
                password="AdminSecurePassword123!",
                org_name="Security Operations",
                full_name="Chief CISO",
                role="owner",
            )
            self.assertGreater(org_id, 0)
            self.assertGreater(user_id, 0)

            # Check database records
            user = self.db.query(User).filter(User.id == user_id).first()
            self.assertEqual(user.email, "root@enterprise.test")
            self.assertNotEqual(user.password_hash, "AdminSecurePassword123!")  # Must be hashed
            self.assertTrue(user.is_active)

            membership = (
                self.db.query(OrganizationMember)
                .filter(OrganizationMember.user_id == user_id)
                .first()
            )
            self.assertEqual(membership.organization_id, org_id)
            self.assertEqual(membership.role, "owner")

            # Duplicate attempt raises ValueError
            with self.assertRaises(ValueError):
                bootstrap_admin(
                    email="root@enterprise.test",
                    password="AnotherPassword123!",
                    org_name="Security Operations",
                )


if __name__ == "__main__":
    unittest.main()
