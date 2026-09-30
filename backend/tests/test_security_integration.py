import importlib
import os
import pkgutil
import unittest
from unittest.mock import patch

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "isolated-test-key-not-for-deployment-0123456789")

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models as model_package
from app.database.base import Base
from app.database.database import TenantSession, get_db
from app.main import app
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.user import User
from app.models.website import Website
from app.models.incident import Incident
from app.models.scan import Scan
from app.models.alert import Alert
from app.services.session_service import create_session
from app.utils.security import create_access_token, hash_password

for module in pkgutil.iter_modules(model_package.__path__, "app.models."):
    importlib.import_module(module.name)


class SecurityIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        cls.factory = sessionmaker(bind=cls.engine, class_=TenantSession, expire_on_commit=False)
        cls.password_hash = hash_password("test-only-strong-password")

    def setUp(self):
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
        self.client = TestClient(app, raise_server_exceptions=False)
        with self.factory() as db:
            db.info["system_scope"] = True
            users = [User(email=f"user{i}@example.com", password_hash=self.password_hash, full_name=f"User {i}") for i in range(3)]
            orgs = [Organization(name=f"Org {i}", slug=f"org-{i}") for i in range(2)]
            db.add_all(users + orgs)
            db.flush()
            for user, org, role in [(users[0], orgs[0], "owner"), (users[1], orgs[1], "owner"), (users[2], orgs[0], "viewer")]:
                db.add(OrganizationMember(user_id=user.id, organization_id=org.id, role=role))
            sessions = [create_session(db, u.id) for u in users]
            db.flush()
            self.headers = [{"Authorization": "Bearer " + create_access_token(str(u.id), s.session_id), "X-Organization-ID": str(orgs[1 if i == 1 else 0].id)} for i,(u,s) in enumerate(zip(users,sessions))]
            site=Website(name="Other site",url="https://example.org",domain="example.org", organization_id=orgs[1].id,verified=False)
            db.add(site); db.flush()
            incident=Incident(incident_code="INC-TEST",title="Test",description="Test",organization_id=orgs[1].id,website_id=site.id,threat_level="HIGH",status="OPEN",priority="P2",confidence=85,source_ip="8.8.8.8",target=site.url)
            scan=Scan(organization_id=orgs[1].id,website_id=site.id,target=site.url,engine="ssl",status="Completed")
            alert=Alert(organization_id=orgs[1].id,website_id=site.id,ip_address="8.8.8.8",threat_level="HIGH",message="Test")
            db.add_all([incident,scan,alert]); db.commit()
            self.ids={"website":site.id,"incident":incident.id,"scan":scan.id}

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        Base.metadata.drop_all(self.engine)

    def test_sensitive_reads_require_authentication(self):
        for path in ["/websites", "/settings", "/settings/export", "/scans", "/scanner/engines", "/dashboard/stats", "/logs/recent", "/alerts/recent", "/incidents/", "/response-actions/", "/audit-logs", "/events/1"]:
            with self.subTest(path=path):
                self.assertIn(self.client.get(path).status_code, (401,403))

    def test_cross_tenant_read_and_mutation_denied(self):
        for path in [f"/websites/{self.ids['website']}",f"/scans/{self.ids['scan']}",f"/scanner/{self.ids['scan']}/report",f"/incidents/{self.ids['incident']}"]:
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path,headers=self.headers[0]).status_code,404)
        self.assertEqual(self.client.put(f"/websites/{self.ids['website']}",json={"name":"changed"},headers=self.headers[0]).status_code,404)
        with self.factory() as db:
            membership = db.query(OrganizationMember).filter(
                OrganizationMember.organization_id == int(self.headers[0]["X-Organization-ID"]),
                OrganizationMember.role == "owner",
            ).one()
            membership.role = "admin"
            db.commit()
        self.assertEqual(self.client.delete(f"/scans/{self.ids['scan']}",headers=self.headers[0]).status_code,404)
        result=self.client.get("/alerts/recent",headers=self.headers[0])
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json(),[])

    def test_membership_header_is_not_authorization(self):
        forged={**self.headers[0],"X-Organization-ID":self.headers[1]["X-Organization-ID"]}
        self.assertEqual(self.client.get("/websites",headers=forged).status_code,403)

    def test_viewer_cannot_change_settings_or_website(self):
        self.assertEqual(self.client.put("/settings",headers=self.headers[2],json={"platform_name":"changed"}).status_code,403)
        self.assertEqual(self.client.post("/websites",headers=self.headers[2],json={"name":"Test","url":"https://example.org"}).status_code,403)

    def test_settings_export_redacted_and_import_strict(self):
        response=self.client.get("/settings/export",headers=self.headers[0])
        self.assertEqual(response.status_code,200,response.text)
        # api_key stays in the schema for round-trip imports but is always null.
        self.assertIsNone(response.json()["api_key"])
        self.assertNotIn("legacy-secret",response.text)
        self.assertFalse(response.json().get("api_key_configured"))
        bad=self.client.post("/settings/import",headers=self.headers[0],json={"unexpected_admin":True})
        self.assertIn(bad.status_code,(400,422))

    def test_server_logout_revokes_token(self):
        self.assertEqual(self.client.get("/auth/me",headers=self.headers[0]).status_code,200)
        response=self.client.post("/sessions/logout",headers=self.headers[0])
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(self.client.get("/auth/me",headers=self.headers[0]).status_code,401)

    def test_security_headers_and_body_limit(self):
        response=self.client.get("/")
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.headers["x-content-type-options"],"nosniff")
        self.assertEqual(response.headers["x-frame-options"],"DENY")
        response=self.client.post("/auth/login",content=b"x"*262145)
        self.assertEqual(response.status_code,413)

    def test_scanner_result_write_not_authorized_to_clients(self):
        # The arbitrary result-injection endpoints were removed outright;
        # unauthenticated clients get 401, cross-tenant owners get 404.
        response=self.client.put(f"/scans/{self.ids['scan']}/result",json={"risk_score":0,"findings":0,"raw_output":"fake","parsed_output":{}})
        self.assertIn(response.status_code,(401,403,404,405))
        response=self.client.put(f"/scans/{self.ids['scan']}/result",headers=self.headers[1],json={"risk_score":0,"findings":0,"raw_output":"fake","parsed_output":{}})
        self.assertIn(response.status_code,(403,404,405))

    def test_query_scope_denies_unowned_and_cross_tenant(self):
        with self.factory() as db:
            self.assertEqual(db.query(Website).count(),0)
            db.info["organization_id"]=int(self.headers[0]["X-Organization-ID"])
            self.assertEqual(db.query(Website).count(),0)
            db.add(Website(organization_id=int(self.headers[1]["X-Organization-ID"]),name="bad",url="https://example.net",domain="example.net"))
            with self.assertRaises(ValueError): db.flush()
            db.rollback()


if __name__ == "__main__":
    unittest.main()
