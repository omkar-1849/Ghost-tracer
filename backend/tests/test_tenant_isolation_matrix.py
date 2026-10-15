"""Tenant isolation matrix and principal separation test suite (T-ISO).

Locks down cross-tenant isolation, telemetry spoof rejection, principal separation,
scanner authorization, and system_scope call-site inventory.
Must remain green across all phases.
"""
import glob
import importlib
import os
import pkgutil
import re
import unittest
from datetime import datetime, timezone

import app.models as model_package
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
from app.models.log import Log
from app.models.event import Event
from app.models.alert import Alert
from app.models.incident import Incident
from app.models.scan import Scan
from app.models.response_action import ResponseAction
from app.services.session_service import create_session
from app.utils.security import hash_password, create_access_token
from app.middleware.api_key_auth import hash_api_key

for module in pkgutil.iter_modules(model_package.__path__, "app.models."):
    importlib.import_module(module.name)


class TenantIsolationMatrixTests(unittest.TestCase):
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
            cls.user1 = User(id=1, email="user1@org1.test", password_hash=pw_hash, full_name="User 1")
            cls.user2 = User(id=2, email="user2@org2.test", password_hash=pw_hash, full_name="User 2")
            db.add_all([cls.user1, cls.user2])
            db.flush()

            # Orgs
            cls.org1 = Organization(id=1, name="Org One", slug="org-one")
            cls.org2 = Organization(id=2, name="Org Two", slug="org-two")
            db.add_all([cls.org1, cls.org2])
            db.flush()

            # Members
            m1 = OrganizationMember(id=1, user_id=1, organization_id=1, role="owner")
            m2 = OrganizationMember(id=2, user_id=2, organization_id=2, role="owner")
            db.add_all([m1, m2])
            db.flush()

            # Sessions
            sess1 = create_session(db, 1)
            sess2 = create_session(db, 2)
            db.flush()

            # Assets (Websites)
            w1 = Website(
                id=1,
                organization_id=1,
                name="Asset Org1",
                url="https://site1.test",
                domain="site1.test",
                verified=True,
                verified_target="https://site1.test",
                verified_addresses=["192.0.2.1"],
            )
            w2 = Website(
                id=2,
                organization_id=2,
                name="Asset Org2",
                url="https://site2.test",
                domain="site2.test",
                verified=True,
                verified_target="https://site2.test",
                verified_addresses=["192.0.2.2"],
            )
            w_unverified = Website(
                id=3,
                organization_id=1,
                name="Unverified Site",
                url="https://unverified.test",
                domain="unverified.test",
                verified=False,
            )
            db.add_all([w1, w2, w_unverified])
            db.flush()

            # Integrations
            cls.key1 = "sk_org1_test_key_0123456789"
            cls.key2 = "sk_org2_test_key_0123456789"
            i1 = Integration(
                id=1,
                organization_id=1,
                website_id=1,
                status="Connected",
                api_key_hash=hash_api_key(cls.key1),
                api_secret_hash="unused",
            )
            i2 = Integration(
                id=2,
                organization_id=2,
                website_id=2,
                status="Connected",
                api_key_hash=hash_api_key(cls.key2),
                api_secret_hash="unused",
            )
            db.add_all([i1, i2])
            db.flush()

            # Logs
            l1 = Log(
                id=1, organization_id=1, website_id=1, ip_address="198.51.100.1",
                method="GET", url="/", status_code=200, risk_score=0, threat_level="LOW"
            )
            l2 = Log(
                id=2, organization_id=2, website_id=2, ip_address="198.51.100.2",
                method="GET", url="/", status_code=200, risk_score=0, threat_level="LOW"
            )
            db.add_all([l1, l2])
            db.flush()

            # Events
            e1 = Event(
                id=1, organization_id=1, website_id=1, integration_id=1,
                event_type="test", source="test", title="Test 1", severity="Low",
                created_at=datetime.now(timezone.utc).replace(tzinfo=None)
            )
            e2 = Event(
                id=2, organization_id=2, website_id=2, integration_id=2,
                event_type="test", source="test", title="Test 2", severity="Low",
                created_at=datetime.now(timezone.utc).replace(tzinfo=None)
            )
            db.add_all([e1, e2])
            db.flush()

            # Alerts
            a1 = Alert(id=1, organization_id=1, website_id=1, ip_address="198.51.100.1", threat_level="HIGH", message="Alert 1")
            a2 = Alert(id=2, organization_id=2, website_id=2, ip_address="198.51.100.2", threat_level="HIGH", message="Alert 2")
            db.add_all([a1, a2])
            db.flush()

            # Incidents
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            inc1 = Incident(
                id=1, organization_id=1, website_id=1, alert_id=1, incident_code="INC-001",
                title="Inc 1", description="Description 1", threat_level="HIGH", priority="P1",
                status="OPEN", source_ip="198.51.100.1", target="https://site1.test",
                confidence=90, created_at=now, updated_at=now,
            )
            inc2 = Incident(
                id=2, organization_id=2, website_id=2, alert_id=2, incident_code="INC-002",
                title="Inc 2", description="Description 2", threat_level="HIGH", priority="P1",
                status="OPEN", source_ip="198.51.100.2", target="https://site2.test",
                confidence=90, created_at=now, updated_at=now,
            )
            db.add_all([inc1, inc2])
            db.flush()

            # Scans
            s1 = Scan(id=1, organization_id=1, website_id=1, engine="nmap", status="Completed", target="https://site1.test")
            s2 = Scan(id=2, organization_id=2, website_id=2, engine="nmap", status="Completed", target="https://site2.test")
            db.add_all([s1, s2])
            db.flush()

            # Response Actions
            ra1 = ResponseAction(id=1, organization_id=1, incident_id=1, action_type="BLOCK_IP", target="198.51.100.1", status="SIMULATED")
            ra2 = ResponseAction(id=2, organization_id=2, incident_id=2, action_type="BLOCK_IP", target="198.51.100.2", status="SIMULATED")
            db.add_all([ra1, ra2])
            db.commit()

            cls.headers_user1 = {
                "Authorization": f"Bearer {create_access_token('1', sess1.session_id)}",
                "X-Organization-ID": "1",
            }
            cls.headers_user2 = {
                "Authorization": f"Bearer {create_access_token('2', sess2.session_id)}",
                "X-Organization-ID": "2",
            }

    @classmethod
    def tearDownClass(cls):
        Base.metadata.drop_all(cls.engine)

    def setUp(self):
        def override_db():
            with self.factory() as db:
                try:
                    yield db
                    db.commit()
                except Exception:
                    db.rollback()
                    raise

        app.dependency_overrides[get_db] = override_db
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()

    def test_tenant_isolation_reads_and_writes(self):
        """User in Org 1 receives 404 when querying or mutating Org 2's resources."""
        endpoints = [
            ("GET", "/websites/2", None),
            ("PUT", "/websites/2", {"name": "Hacked", "url": "https://site2.test", "monitoring_enabled": True}),
            ("DELETE", "/websites/2", None),
            ("GET", "/websites/2/integration", None),
            ("POST", "/websites/2/regenerate-key", None),
            ("DELETE", "/websites/2/disconnect", None),
            ("GET", "/alerts/2", None),
            ("GET", "/incidents/2", None),
            ("GET", "/scans/2", None),
            ("GET", "/response-actions/2", None),
        ]
        for method, path, payload in endpoints:
            with self.subTest(method=method, path=path):
                if method == "GET":
                    res = self.client.get(path, headers=self.headers_user1)
                elif method == "POST":
                    res = self.client.post(path, json=payload, headers=self.headers_user1)
                elif method == "PUT":
                    res = self.client.put(path, json=payload, headers=self.headers_user1)
                elif method == "DELETE":
                    res = self.client.delete(path, headers=self.headers_user1)
                self.assertEqual(res.status_code, 404, f"{method} {path} returned {res.status_code}: {res.text}")

    def test_tenant_isolation_list_scoping(self):
        """User in Org 1 sees only Org 1 rows in list responses."""
        # Websites
        res = self.client.get("/websites", headers=self.headers_user1)
        self.assertEqual(res.status_code, 200)
        site_ids = [w["id"] for w in res.json()]
        self.assertIn(1, site_ids)
        self.assertNotIn(2, site_ids)

        # Alerts
        res = self.client.get("/alerts", headers=self.headers_user1)
        self.assertEqual(res.status_code, 200)
        alert_ids = [a["id"] for a in res.json()]
        self.assertIn(1, alert_ids)
        self.assertNotIn(2, alert_ids)

        # Incidents
        res = self.client.get("/incidents", headers=self.headers_user1)
        self.assertEqual(res.status_code, 200)
        items = res.json()
        inc_ids = [i["id"] for i in (items.get("items", items) if isinstance(items, dict) else items)]
        self.assertIn(1, inc_ids)
        self.assertNotIn(2, inc_ids)

        # Scans
        res = self.client.get("/scans", headers=self.headers_user1)
        self.assertEqual(res.status_code, 200)
        scan_ids = [s["id"] for s in res.json()]
        self.assertIn(1, scan_ids)
        self.assertNotIn(2, scan_ids)

    def test_telemetry_spoof_rejected(self):
        """Telemetry endpoints reject extra fields naming tenant, asset, or collector."""
        spoofed_fields = [
            "organization_id",
            "website_id",
            "integration_id",
            "asset_id",
            "collector_id",
        ]

        # /logs
        for field in spoofed_fields:
            with self.subTest(endpoint="/logs", field=field):
                body = {
                    "ip_address": "198.51.100.10",
                    "method": "GET",
                    "url": "/",
                    "status_code": 200,
                    "user_agent": "TestAgent",
                    "message": "test",
                    field: 999,
                }
                res = self.client.post("/logs", json=body, headers={"X-API-Key": self.key1})
                self.assertEqual(res.status_code, 422)

        # /events
        for field in spoofed_fields:
            with self.subTest(endpoint="/events", field=field):
                body = {
                    "event_type": "suspicious_request",
                    "source": "waf",
                    "title": "Test Spoof",
                    field: 999,
                }
                res = self.client.post("/events", json=body, headers={"X-API-Key": self.key1})
                self.assertEqual(res.status_code, 422)

    def test_principal_separation(self):
        """User JWT rejected on machine plane; machine API key rejected on human plane."""
        # JWT on /logs -> 401
        res = self.client.post(
            "/logs",
            json={"ip_address": "198.51.100.1", "method": "GET", "url": "/", "status_code": 200, "user_agent": "Agent", "message": "msg"},
            headers=self.headers_user1,
        )
        self.assertEqual(res.status_code, 401)

        # JWT on /events -> 401
        res = self.client.post(
            "/events",
            json={"event_type": "test", "source": "test", "title": "test"},
            headers=self.headers_user1,
        )
        self.assertEqual(res.status_code, 401)

        # API key on /websites -> 401
        res = self.client.get("/websites", headers={"X-API-Key": self.key1})
        self.assertEqual(res.status_code, 401)

        # API key on /alerts -> 401
        res = self.client.get("/alerts", headers={"X-API-Key": self.key1})
        self.assertEqual(res.status_code, 401)

    def test_scanner_authorization_characterization(self):
        """Scanning unverified asset -> 403; cross-tenant asset -> 404."""
        # Unverified asset -> 403
        res = self.client.post("/scans/", json={"website_id": 3, "engine": "nmap"}, headers=self.headers_user1)
        self.assertEqual(res.status_code, 403)

        # Cross-tenant asset -> 404
        res = self.client.post("/scans/", json={"website_id": 2, "engine": "nmap"}, headers=self.headers_user1)
        self.assertEqual(res.status_code, 404)

    def test_tenant_isolation_enrollment_tokens_and_collectors(self):
        """Cross-tenant token creation/listing and collector management operations return 404."""
        # 1. User 1 cannot create or list tokens on Org 2 asset (website_id=2)
        res = self.client.post(
            "/websites/2/enrollment-tokens",
            json={"label": "Cross-tenant Token"},
            headers=self.headers_user1,
        )
        self.assertEqual(res.status_code, 404)

        res = self.client.get(
            "/websites/2/enrollment-tokens",
            headers=self.headers_user1,
        )
        self.assertEqual(res.status_code, 404)

        # 2. User 1 cannot list collectors on Org 2 asset
        res = self.client.get(
            "/websites/2/collectors",
            headers=self.headers_user1,
        )
        self.assertEqual(res.status_code, 404)

        # 3. Create a token and enroll a collector in Org 2
        tok_res = self.client.post(
            "/websites/2/enrollment-tokens",
            json={"label": "Org 2 Token", "max_uses": 1},
            headers=self.headers_user2,
        )
        self.assertEqual(tok_res.status_code, 201)
        raw_token_org2 = tok_res.json()["token"]
        token_id_org2 = tok_res.json()["id"]

        enroll_res = self.client.post(
            "/collector/enroll",
            headers={"X-Enrollment-Token": raw_token_org2},
            json={"name": "Org 2 Collector", "kind": "daemon"},
        )
        self.assertEqual(enroll_res.status_code, 201)
        col_id_org2 = enroll_res.json()["collector_id"]

        # 4. User 1 cannot delete Org 2's token
        del_tok_res = self.client.delete(
            f"/websites/2/enrollment-tokens/{token_id_org2}",
            headers=self.headers_user1,
        )
        self.assertEqual(del_tok_res.status_code, 404)

        # 5. User 1 cannot rotate, disable, enable, or revoke Org 2's collector
        self.assertEqual(
            self.client.post(f"/websites/2/collectors/{col_id_org2}/rotate-key", headers=self.headers_user1, json={}).status_code,
            404,
        )
        self.assertEqual(
            self.client.post(f"/websites/2/collectors/{col_id_org2}/disable", headers=self.headers_user1).status_code,
            404,
        )
        self.assertEqual(
            self.client.post(f"/websites/2/collectors/{col_id_org2}/enable", headers=self.headers_user1).status_code,
            404,
        )
        self.assertEqual(
            self.client.post(f"/websites/2/collectors/{col_id_org2}/revoke", headers=self.headers_user1).status_code,
            404,
        )

        # 6. User 1 also cannot manipulate Org 2 collector even by targeting Org 1 asset path
        self.assertEqual(
            self.client.post(f"/websites/1/collectors/{col_id_org2}/disable", headers=self.headers_user1).status_code,
            404,
        )

    def test_system_scope_call_site_inventory(self):
        """Fails if unexpected system_scope=True calls are added to backend codebase."""
        approved_files = {
            "app/database/database.py",
            "app/middleware/api_key_auth.py",
            "app/services/scanner_worker.py",
            "app/services/scan_service.py",
            "app/services/scanners/scanner_mixin.py",
            "app/services/collector_service.py",
            "app/services/enrollment_service.py",
        }

        detected = []
        pattern = re.compile(r'system_scope["\']?\s*[:=]\s*True')

        for root_dir in ["app"]:
            for path in glob.glob(f"{root_dir}/**/*.py", recursive=True):
                norm_path = path.replace("\\", "/")
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    for line_num, line in enumerate(f, 1):
                        if pattern.search(line):
                            if norm_path not in approved_files:
                                detected.append(f"{norm_path}:{line_num}: {line.strip()}")

        self.assertEqual(
            detected,
            [],
            f"Unauthorized system_scope=True call sites found: {detected}",
        )


if __name__ == "__main__":
    unittest.main()
