import os
import unittest
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database.base import Base
from app.database.database import get_db
from app.main import app
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.user import User
from app.models.website import Website
from app.models.session import Session as UserSession
from app.services.session_service import create_session
from app.utils.security import hash_password, create_access_token
from app.utils.destination import validate_destination, DestinationError, FetchResponse, Destination
from app.services.website_service import (
    generate_verification_token,
    get_or_create_verification_token,
    verify_website,
    get_website,
)


class WebsiteVerificationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.factory = sessionmaker(bind=self.engine)

        def override_get_db():
            db = self.factory()
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

        with self.factory() as db:
            db.info["system_scope"] = True
            self.org = Organization(name="SecLab Org", slug="seclab-org")
            db.add(self.org)
            db.flush()

            self.user = User(
                email="admin@seclab.test",
                full_name="Lab Admin",
                password_hash=hash_password("SuperSecret123!"),
            )
            db.add(self.user)
            db.flush()

            self.member = OrganizationMember(
                organization_id=self.org.id,
                user_id=self.user.id,
                role="owner",
            )
            db.add(self.member)
            db.flush()

            sess = create_session(db, self.user.id)
            self.token = create_access_token(str(self.user.id), sess.session_id)
            self.headers = {
                "Authorization": f"Bearer {self.token}",
                "X-Organization-ID": str(self.org.id),
            }

            self.website = Website(
                organization_id=self.org.id,
                name="Zerodha Security Lab",
                url="http://127.0.0.1:8001",
                domain="127.0.0.1",
                ip_address="127.0.0.1",
                exposure="public",
                verified=False,
                verification_token=None,  # Intentionally null to test recovery
            )
            db.add(self.website)
            db.commit()
            self.website_id = self.website.id

    def tearDown(self):
        app.dependency_overrides.clear()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_missing_token_on_demand_generation_and_persistence(self):
        """Verifies that a website with a null token generates and persists a valid token on demand."""
        with self.factory() as db:
            db.info["system_scope"] = True
            site = db.query(Website).filter(Website.id == self.website_id).first()
            self.assertIsNone(site.verification_token)

        # GET /websites/{id}/verification-token should return a newly generated token
        res = self.client.get(f"/websites/{self.website_id}/verification-token", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        token = data.get("verification_token")
        self.assertIsNotNone(token)
        self.assertTrue(token.startswith("SENTINEL_"))
        self.assertGreater(len(token), 16)
        self.assertFalse(data.get("verified"))

        # Verify token is now permanently persisted in DB
        with self.factory() as db:
            db.info["system_scope"] = True
            site = db.query(Website).filter(Website.id == self.website_id).first()
            self.assertEqual(site.verification_token, token)

    def test_loopback_destination_validation_dev_vs_production(self):
        """Validates loopback target handling: allowed in development, rejected in production."""
        # Development environment
        with patch.dict(os.environ, {"ENVIRONMENT": "development"}):
            dest = validate_destination("http://127.0.0.1:8001")
            self.assertEqual(dest.hostname, "127.0.0.1")
            self.assertEqual(dest.port, 8001)
            self.assertEqual(dest.addresses, ("127.0.0.1",))

        # Production environment
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            with self.assertRaises(DestinationError):
                validate_destination("http://127.0.0.1:8001")

    def test_meta_tag_verification_success(self):
        """Validates successful meta-tag ownership verification when target serves matching tag."""
        with self.factory() as db:
            db.info["system_scope"] = True
            site = db.query(Website).filter(Website.id == self.website_id).first()
            token = get_or_create_verification_token(db, site)
            db.commit()

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Zerodha Security Lab</title>
            <meta name="sentinel-verification" content="{token}">
        </head>
        <body>Security Lab Active</body>
        </html>
        """.encode("utf-8")

        mock_dest = Destination("http://127.0.0.1:8001/", "http", "127.0.0.1", 8001, ("127.0.0.1",), "/", "127.0.0.1:8001")
        mock_response = FetchResponse(
            status_code=200,
            content=html_body,
            headers={"content-type": "text/html"},
            url="http://127.0.0.1:8001/",
            destination=mock_dest,
        )

        with patch("app.services.website_service.safe_fetch", return_value=mock_response):
            res = self.client.post(f"/websites/{self.website_id}/verify/meta", headers=self.headers)
            self.assertEqual(res.status_code, 200)
            self.assertTrue(res.json()["success"])
            self.assertIn("verified successfully", res.json()["message"])

        # Check database record updated
        with self.factory() as db:
            db.info["system_scope"] = True
            site = db.query(Website).filter(Website.id == self.website_id).first()
            self.assertTrue(site.verified)
            self.assertEqual(site.verification_method, "meta")
            self.assertIsNotNone(site.verified_at)
            self.assertEqual(site.verified_target, "http://127.0.0.1:8001")

    def test_meta_tag_verification_failure_on_token_mismatch(self):
        """Validates that verification fails when the served meta-tag content does not match the token."""
        with self.factory() as db:
            db.info["system_scope"] = True
            site = db.query(Website).filter(Website.id == self.website_id).first()
            get_or_create_verification_token(db, site)
            db.commit()

        # HTML with wrong or null token
        html_body = b"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="sentinel-verification" content="SENTINEL_WRONG_TOKEN_VALUE">
        </head>
        </html>
        """

        mock_dest = Destination("http://127.0.0.1:8001/", "http", "127.0.0.1", 8001, ("127.0.0.1",), "/", "127.0.0.1:8001")
        mock_response = FetchResponse(
            status_code=200,
            content=html_body,
            headers={"content-type": "text/html"},
            url="http://127.0.0.1:8001/",
            destination=mock_dest,
        )

        with patch("app.services.website_service.safe_fetch", return_value=mock_response):
            res = self.client.post(f"/websites/{self.website_id}/verify/meta", headers=self.headers)
            self.assertEqual(res.status_code, 200)
            self.assertFalse(res.json()["success"])
            self.assertEqual(res.json()["message"], "Verification failed.")

        with self.factory() as db:
            db.info["system_scope"] = True
            site = db.query(Website).filter(Website.id == self.website_id).first()
            self.assertFalse(site.verified)

    def test_meta_tag_verification_failure_on_unreachable_target(self):
        """Validates that verification fails safely when the target is unreachable (connection refused)."""
        with self.factory() as db:
            db.info["system_scope"] = True
            site = db.query(Website).filter(Website.id == self.website_id).first()
            get_or_create_verification_token(db, site)
            db.commit()

        with patch("app.services.website_service.safe_fetch", side_effect=DestinationError("Connection refused")):
            res = self.client.post(f"/websites/{self.website_id}/verify/meta", headers=self.headers)
            self.assertEqual(res.status_code, 200)
            self.assertFalse(res.json()["success"])
            self.assertEqual(res.json()["message"], "Verification failed.")

        with self.factory() as db:
            db.info["system_scope"] = True
            site = db.query(Website).filter(Website.id == self.website_id).first()
            self.assertFalse(site.verified)

    def test_html_file_verification_success(self):
        """Validates html file verification (/sentinel_verify.html) with matching token."""
        with self.factory() as db:
            db.info["system_scope"] = True
            site = db.query(Website).filter(Website.id == self.website_id).first()
            token = get_or_create_verification_token(db, site)
            db.commit()

        mock_dest = Destination("http://127.0.0.1:8001/sentinel_verify.html", "http", "127.0.0.1", 8001, ("127.0.0.1",), "/sentinel_verify.html", "127.0.0.1:8001")
        mock_response = FetchResponse(
            status_code=200,
            content=token.encode("utf-8"),
            headers={"content-type": "text/plain"},
            url="http://127.0.0.1:8001/sentinel_verify.html",
            destination=mock_dest,
        )

        with patch("app.services.website_service.safe_fetch", return_value=mock_response):
            res = self.client.post(f"/websites/{self.website_id}/verify/html", headers=self.headers)
            self.assertEqual(res.status_code, 200)
            self.assertTrue(res.json()["success"])

        with self.factory() as db:
            db.info["system_scope"] = True
            site = db.query(Website).filter(Website.id == self.website_id).first()
            self.assertTrue(site.verified)
            self.assertEqual(site.verification_method, "html")

    def test_dns_verification_rejects_loopback(self):
        """Validates that loopback targets cannot be verified via public DNS TXT records."""
        with self.factory() as db:
            db.info["system_scope"] = True
            site = db.query(Website).filter(Website.id == self.website_id).first()
            get_or_create_verification_token(db, site)
            db.commit()

        res = self.client.post(f"/websites/{self.website_id}/verify/dns", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.json()["success"])

    def test_local_verification_method_in_dev_vs_production(self):
        """Validates the explicit 'local' verification method in dev vs production."""
        with patch.dict(os.environ, {"ENVIRONMENT": "development"}):
            res = self.client.post(f"/websites/{self.website_id}/verify/local", headers=self.headers)
            self.assertEqual(res.status_code, 200)
            self.assertTrue(res.json()["success"])

            with self.factory() as db:
                db.info["system_scope"] = True
                site = db.query(Website).filter(Website.id == self.website_id).first()
                self.assertTrue(site.verified)
                self.assertEqual(site.verification_method, "local")

        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            res_prod = self.client.post(f"/websites/{self.website_id}/verify/local", headers=self.headers)
            self.assertEqual(res_prod.status_code, 400)


if __name__ == "__main__":
    unittest.main()
