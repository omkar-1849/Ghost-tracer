import importlib
import os
import pkgutil
import unittest

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "isolated-test-key-not-for-deployment-0123456789")
os.environ["SENTINEL_PROTECTED_APP_URL"] = "http://localhost:3000"

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
from app.models.integration import Integration
from app.middleware.api_key_auth import hash_api_key
from app.services.session_service import create_session
from app.utils.security import create_access_token, hash_password

for module in pkgutil.iter_modules(model_package.__path__, "app.models."):
    importlib.import_module(module.name)


class OperationsPipelineTests(unittest.TestCase):
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
        self.client = TestClient(app)

        with self.factory() as db:
            db.info["system_scope"] = True
            org1 = Organization(name="Primary Security Org", slug="primary-org")
            org2 = Organization(name="Secondary Org", slug="secondary-org")
            db.add_all([org1, org2])
            db.flush()

            site1 = Website(
                organization_id=org1.id,
                name="Controlled App",
                domain="localhost",
                url="http://localhost:3000",
                verified=True,
                verification_method="local",
            )
            db.add(site1)
            db.flush()

            user1 = User(email="analyst@primary.local", full_name="Analyst 1", password_hash=self.password_hash)
            user2 = User(email="analyst@secondary.local", full_name="Analyst 2", password_hash=self.password_hash)
            db.add_all([user1, user2])
            db.flush()

            db.add_all([
                OrganizationMember(organization_id=org1.id, user_id=user1.id, role="admin"),
                OrganizationMember(organization_id=org2.id, user_id=user2.id, role="admin"),
            ])
            db.flush()

            session1 = create_session(db, user1.id)
            session2 = create_session(db, user2.id)

            raw_api_key = "sentinel_test_api_key_12345"
            integration1 = Integration(
                organization_id=org1.id,
                website_id=site1.id,
                api_key_hash=hash_api_key(raw_api_key),
                api_secret_hash=hash_api_key("dummy_secret"),
                status="Connected",
            )
            db.add(integration1)
            db.flush()

            self.org1_id = org1.id
            self.org2_id = org2.id
            self.site1_id = site1.id
            self.user1_id = user1.id
            self.user2_id = user2.id
            self.token1 = create_access_token(str(user1.id), session1.session_id)
            self.token2 = create_access_token(str(user2.id), session2.session_id)
            self.api_key = raw_api_key
            db.commit()

        self.headers1 = {
            "Authorization": f"Bearer {self.token1}",
            "X-Organization-ID": str(self.org1_id),
        }
        self.headers2 = {
            "Authorization": f"Bearer {self.token2}",
            "X-Organization-ID": str(self.org2_id),
        }
        self.ingest_headers = {
            "X-API-Key": self.api_key,
        }

    def tearDown(self):
        app.dependency_overrides.clear()
        Base.metadata.drop_all(self.engine)

    def test_end_to_end_operations_pipeline(self):
        # 1. Ingest telemetry that triggers high risk
        payload = {
            "ip_address": "198.51.100.42",
            "method": "POST",
            "url": "/api/login",
            "status_code": 401,
            "user_agent": "sqlmap/1.5#stable",
            "message": "admin' UNION SELECT 1,2,password FROM users--",
        }
        res = self.client.post("/logs/", json=payload, headers=self.ingest_headers)
        self.assertEqual(res.status_code, 201)
        log_data = res.json()
        self.assertEqual(log_data["ip_address"], "198.51.100.42")
        self.assertIn(log_data["threat_level"], {"HIGH", "CRITICAL"})

        # 2. Verify Alert was automatically created and includes incident_id
        res_alerts = self.client.get("/alerts/recent", headers=self.headers1)
        self.assertEqual(res_alerts.status_code, 200)
        alerts = res_alerts.json()
        self.assertGreaterEqual(len(alerts), 1)
        alert = alerts[0]
        self.assertEqual(alert["ip_address"], "198.51.100.42")
        self.assertIsNotNone(alert["incident_id"])
        incident_id = alert["incident_id"]

        # 3. Verify Incident was created and is retrievable
        res_incidents = self.client.get("/incidents/", headers=self.headers1)
        self.assertEqual(res_incidents.status_code, 200)
        incidents = res_incidents.json()
        self.assertEqual(len(incidents), 1)
        incident = incidents[0]
        self.assertEqual(incident["id"], incident_id)
        self.assertEqual(incident["status"], "OPEN")
        self.assertEqual(incident["source_ip"], "198.51.100.42")

        # 4. Verify Incident Detail with evidence and timeline
        res_detail = self.client.get(f"/incidents/{incident_id}", headers=self.headers1)
        self.assertEqual(res_detail.status_code, 200)
        detail = res_detail.json()
        self.assertGreaterEqual(len(detail["evidence"]), 1)
        self.assertGreaterEqual(len(detail["timeline"]), 1)

        # 5. Propose Response Action (BLOCK_IP)
        action_payload = {
            "action_type": "BLOCK_IP",
            "target": "198.51.100.42",
            "reason": "Correlated SQL injection attack attempt",
        }
        res_action = self.client.post(
            f"/response-actions/?incident_id={incident_id}",
            json=action_payload,
            headers=self.headers1,
        )
        self.assertEqual(res_action.status_code, 200)
        action = res_action.json()
        self.assertEqual(action["status"], "PENDING")
        self.assertEqual(action["action_type"], "BLOCK_IP")
        action_id = action["id"]

        # 6. Execute Response Action Simulation
        res_exec = self.client.post(
            f"/response-actions/{action_id}/execute",
            headers=self.headers1,
        )
        self.assertEqual(res_exec.status_code, 200)
        exec_data = res_exec.json()
        self.assertEqual(exec_data["status"], "SIMULATED")

        # 7. Verify Activity Logs are scoped to Tenant 1
        res_logs = self.client.get("/logs/recent", headers=self.headers1)
        self.assertEqual(res_logs.status_code, 200)
        logs = res_logs.json()
        self.assertGreaterEqual(len(logs), 1)
        self.assertEqual(logs[0]["ip_address"], "198.51.100.42")

    def test_tenant_isolation_operations(self):
        # Ingest a log for Tenant 1
        payload = {
            "ip_address": "198.51.100.99",
            "method": "GET",
            "url": "/api/admin?query=bypass",
            "status_code": 401,
            "user_agent": "Mozilla/5.0",
            "message": "' OR '1'='1' authentication bypass",
        }
        res_log = self.client.post("/logs/", json=payload, headers=self.ingest_headers)
        self.assertEqual(res_log.status_code, 201)

        # Query all operational endpoints as Tenant 2
        res_logs2 = self.client.get("/logs/recent", headers=self.headers2)
        self.assertEqual(res_logs2.status_code, 200)
        self.assertEqual(len(res_logs2.json()), 0)

        res_alerts2 = self.client.get("/alerts/recent", headers=self.headers2)
        self.assertEqual(res_alerts2.status_code, 200)
        self.assertEqual(len(res_alerts2.json()), 0)

        res_incidents2 = self.client.get("/incidents/", headers=self.headers2)
        self.assertEqual(res_incidents2.status_code, 200)
        self.assertEqual(len(res_incidents2.json()), 0)

        res_actions2 = self.client.get("/response-actions/", headers=self.headers2)
        self.assertEqual(res_actions2.status_code, 200)
        self.assertEqual(len(res_actions2.json()), 0)

    def test_protected_asset_restrictions(self):
        # 1. Configured local protected application succeeds and is auto-verified under Org 2 (Org 1 already has one)
        site_payload = {
            "name": "Controlled Test Application",
            "url": "http://localhost:3000",
            "environment": "Development",
        }
        res_site = self.client.post("/websites", json=site_payload, headers=self.headers2)
        self.assertEqual(res_site.status_code, 201)
        site = res_site.json()
        self.assertEqual(site["domain"], "localhost")
        self.assertTrue(site["verified"])
        self.assertEqual(site["verification_method"], "local")

        # 2. Adding a second website for same tenant is blocked (single asset restriction)
        second_site = {
            "name": "Second App",
            "url": "http://localhost:3000",
            "environment": "Staging",
        }
        res_second = self.client.post("/websites", json=second_site, headers=self.headers2)
        self.assertEqual(res_second.status_code, 400)
        self.assertTrue(any(term in res_second.json()["detail"] for term in ("already configured", "already exists")))

        # 3. Arbitrary public website is blocked
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        # Recreate an org for test
        with self.factory() as db:
            db.info["system_scope"] = True
            org3 = Organization(name="Org 3", slug="org-3")
            db.add(org3)
            db.flush()
            user3 = User(email="u3@test.local", full_name="U3", password_hash=self.password_hash)
            db.add(user3)
            db.flush()
            db.add(OrganizationMember(organization_id=org3.id, user_id=user3.id, role="admin"))
            db.flush()
            s3 = create_session(db, user3.id)
            tok3 = create_access_token(str(user3.id), s3.session_id)
            db.commit()
            headers3 = {"Authorization": f"Bearer {tok3}", "X-Organization-ID": str(org3.id)}

        public_site = {
            "name": "Public Target",
            "url": "https://github.com",
            "environment": "Production",
        }
        res_public = self.client.post("/websites", json=public_site, headers=headers3)
        self.assertEqual(res_public.status_code, 400)
        self.assertIn("Only the configured protected application asset is permitted", res_public.json()["detail"])

        # 4. Arbitrary internal SSRF target is blocked
        ssrf_site = {
            "name": "Cloud Metadata",
            "url": "http://169.254.169.254/latest/meta-data/",
            "environment": "Production",
        }
        res_ssrf = self.client.post("/websites", json=ssrf_site, headers=headers3)
        self.assertEqual(res_ssrf.status_code, 400)
