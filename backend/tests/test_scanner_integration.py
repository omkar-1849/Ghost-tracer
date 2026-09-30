"""API authorization and terminal-state tests; scanner/network execution is mocked."""
import os
import unittest
from unittest.mock import patch

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "isolated-test-key-not-for-deployment-0123456789")

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
from app.models.scan import Scan
from app.services.session_service import create_session
from app.services.scan_service import save_scan_result
from app.utils.security import create_access_token, hash_password
from app.utils.destination import Destination


class ScannerIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.password_hash = hash_password("test-only-strong-password")

    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        self.factory = sessionmaker(bind=self.engine, class_=TenantSession, autoflush=False, expire_on_commit=False)
        Base.metadata.create_all(self.engine)

        def database_dependency():
            with self.factory() as db:
                try:
                    yield db
                    db.commit()
                except Exception:
                    db.rollback()
                    raise

        app.dependency_overrides[get_db] = database_dependency
        self.addCleanup(app.dependency_overrides.clear)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        with self.factory() as db:
            db.info["system_scope"] = True
            org = Organization(name="Test organization", slug="test-organization")
            db.add(org)
            db.flush()
            self.organization_id = org.id
            self.headers_by_role = {}
            for role in ("owner", "admin", "viewer"):
                user = User(email=f"{role}@example.com", password_hash=self.password_hash, is_active=True)
                db.add(user)
                db.flush()
                db.add(OrganizationMember(user_id=user.id, organization_id=org.id, role=role))
                session = create_session(db, user.id)
                db.flush()
                self.headers_by_role[role] = {
                    "Authorization": "Bearer " + create_access_token(str(user.id), session.session_id),
                    "X-Organization-ID": str(org.id),
                }
            website = Website(name="Test website", domain="example.com", url="https://example.com", organization_id=org.id,
                              verified=True, verified_target="https://example.com", verified_addresses=["93.184.216.34"])
            db.add(website)
            db.commit()
            self.website_id = website.id
        self.headers = self.headers_by_role["owner"]
        destination = Destination("https://example.com/", "https", "example.com", 443, ("93.184.216.34",), "/", "example.com")
        for target, options in [
            ("app.utils.destination.validate_destination", {"return_value": destination}),
            ("app.services.scanner_worker.enqueue_scan", {}),
        ]:
            mock = patch(target, **options)
            mock.start()
            self.addCleanup(mock.stop)

    def tearDown(self):
        self.engine.dispose()

    def _post_scan(self):
        return self.client.post("/scans/", json={"website_id": self.website_id, "engine": "ssl"}, headers=self.headers)

    def _seed_scan(self, status="Pending"):
        with self.factory() as db:
            db.info["organization_id"] = self.organization_id
            scan = Scan(website_id=self.website_id, engine="ssl", target="https://example.com", status=status, findings=0, risk_score=0)
            db.add(scan)
            db.commit()
            return scan.id

    def test_requires_authentication(self):
        response = self.client.post("/scans/", json={"website_id": self.website_id, "engine": "ssl"})
        self.assertIn(response.status_code, (401, 403))

    def test_launch_role_required(self):
        response = self.client.post("/scans/", json={"website_id": self.website_id, "engine": "ssl"}, headers=self.headers_by_role["viewer"])
        self.assertEqual(response.status_code, 403, response.text)

    def test_public_write_endpoints_are_forbidden(self):
        scan_id = self._seed_scan()
        for suffix in ("status", "result"):
            response = self.client.put(f"/scans/{scan_id}/{suffix}", json={}, headers=self.headers)
            self.assertEqual(response.status_code, 403, response.text)
        with self.factory() as db:
            db.info["organization_id"] = self.organization_id
            self.assertEqual(db.get(Scan, scan_id).status, "Pending")

    def test_cancel_terminal_state_wins(self):
        scan_id = self._seed_scan("Running")
        cancel = self.client.post(f"/scanner/{scan_id}/cancel", headers=self.headers)
        self.assertEqual(cancel.status_code, 200, cancel.text)
        with self.factory() as db:
            db.info["organization_id"] = self.organization_id
            self.assertIsNone(save_scan_result(db, scan_id, 99, 99, "late", {}))
        with self.factory() as db:
            db.info["organization_id"] = self.organization_id
            row = db.get(Scan, scan_id)
            self.assertEqual(row.status, "Cancelled")
            self.assertEqual(row.findings, 0)

    def test_delete_requires_admin_and_terminal(self):
        scan_id = self._seed_scan()
        response = self.client.delete(f"/scans/{scan_id}", headers=self.headers_by_role["viewer"])
        self.assertEqual(response.status_code, 403, response.text)
        response = self.client.delete(f"/scans/{scan_id}", headers=self.headers_by_role["admin"])
        self.assertEqual(response.status_code, 409, response.text)
        response = self.client.post(f"/scanner/{scan_id}/cancel", headers=self.headers)
        self.assertEqual(response.status_code, 200, response.text)
        response = self.client.delete(f"/scans/{scan_id}", headers=self.headers_by_role["admin"])
        self.assertEqual(response.status_code, 200, response.text)

    def test_unverified_website_cannot_queue(self):
        with self.factory() as db:
            db.info["organization_id"] = self.organization_id
            db.get(Website, self.website_id).verified = False
            db.commit()
        response = self._post_scan()
        self.assertEqual(response.status_code, 403, response.text)
        with self.factory() as db:
            db.info["organization_id"] = self.organization_id
            self.assertEqual(db.query(Scan).count(), 0)
