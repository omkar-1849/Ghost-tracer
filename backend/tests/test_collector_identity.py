"""Phase 2 Collector Identity Test Suite.

Covers all security checks and requirements from SENTINEL_IMPLEMENTATION_PLAN.md §6.5:
1. Multiple collectors on 1 asset ingest logs/events with respective integration_id; both appear under the asset.
2. Legacy keys created before migration still ingest.
3. Disabling/revoking one collector allows the other to keep ingesting.
4. Disabling or revoking a collector blocks ingestion with 401 (identical error to unknown key).
5. Cross-asset and cross-org integration_id on a Log rejected at flush by TenantSession.
6. Legacy connect/regenerate/disconnect preserve identical behavior.
7. Migration upgrade and downgrade guard (downgrade refuses when multiple integrations per asset exist).
"""
import unittest
from datetime import datetime, timezone
import secrets

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.database import TenantSession, get_db
from app.database.migrations import migrate, downgrade_phase2, SCHEMA_VERSION, SchemaMismatchError
from app.main import app
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.user import User
from app.models.website import Website
from app.models.integration import Integration
from app.models.log import Log
from app.models.event import Event
from app.services.session_service import create_session
from app.utils.security import hash_password, create_access_token
from app.middleware.api_key_auth import hash_api_key


class CollectorIdentityTests(unittest.TestCase):
    def setUp(self):
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

        # Seed initial data
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

            self.member1 = OrganizationMember(
                organization_id=1,
                user_id=1,
                role="owner",
            )
            self.member2 = OrganizationMember(
                organization_id=2,
                user_id=2,
                role="owner",
            )
            db.add_all([self.member1, self.member2])
            db.flush()

            session1 = create_session(db, user_id=1, user_agent="test-agent", ip_address="127.0.0.1")
            self.token1 = create_access_token("1", session1.session_id)
            self.headers1 = {"Authorization": f"Bearer {self.token1}", "X-Organization-ID": "1"}

            session2 = create_session(db, user_id=2, user_agent="test-agent", ip_address="127.0.0.1")
            self.token2 = create_access_token("2", session2.session_id)
            self.headers2 = {"Authorization": f"Bearer {self.token2}", "X-Organization-ID": "2"}


            # Create Website 1 in Org 1
            self.website1 = Website(
                id=1,
                organization_id=1,
                name="Asset Alpha",
                url="https://alpha.example.com",
                domain="alpha.example.com",
                exposure="public",
                status="Active",
            )
            # Create Website 2 in Org 1
            self.website2 = Website(
                id=2,
                organization_id=1,
                name="Asset Beta",
                url="https://beta.example.com",
                domain="beta.example.com",
                exposure="public",
                status="Active",
            )
            # Create Website 3 in Org 2
            self.website3 = Website(
                id=3,
                organization_id=2,
                name="Asset Gamma",
                url="https://gamma.example.com",
                domain="gamma.example.com",
                exposure="public",
                status="Active",
            )
            db.add_all([self.website1, self.website2, self.website3])
            db.flush()
            db.commit()
        finally:
            db.close()

    def tearDown(self):
        app.dependency_overrides.clear()
        self.engine.dispose()

    def test_multi_collector_provenance_on_single_asset(self):
        """1. Multiple collectors on 1 asset ingest logs/events with respective integration_id.
        Both appear under the same asset in reads.
        """
        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            key1 = f"snt_col_{secrets.token_urlsafe(32)}"
            key2 = f"snt_col_{secrets.token_urlsafe(32)}"

            c1 = Integration(
                id=10,
                organization_id=1,
                website_id=1,
                name="Daemon collector",
                kind="daemon",
                api_key_hash=hash_api_key(key1),
                api_secret_hash=hash_api_key(secrets.token_urlsafe(32)),
                status="Connected",
            )
            c2 = Integration(
                id=11,
                organization_id=1,
                website_id=1,
                name="Nginx collector",
                kind="nginx",
                api_key_hash=hash_api_key(key2),
                api_secret_hash=hash_api_key(secrets.token_urlsafe(32)),
                status="Connected",
            )
            db.add_all([c1, c2])
            db.commit()
        finally:
            db.close()

        # Ingest Log via C1
        resp_log1 = self.client.post(
            "/logs",
            headers={"X-API-Key": key1},
            json={
                "ip_address": "1.2.3.4",
                "method": "GET",
                "url": "https://alpha.example.com/test1",
                "status_code": 200,
                "user_agent": "TestAgent1",
                "message": "test request 1",
            },
        )
        self.assertEqual(resp_log1.status_code, 201)
        log1_data = resp_log1.json()
        self.assertEqual(log1_data["website_id"], 1)
        self.assertEqual(log1_data["integration_id"], 10)

        # Ingest Log via C2
        resp_log2 = self.client.post(
            "/logs",
            headers={"X-API-Key": key2},
            json={
                "ip_address": "5.6.7.8",
                "method": "POST",
                "url": "https://alpha.example.com/test2",
                "status_code": 201,
                "user_agent": "TestAgent2",
                "message": "test request 2",
            },
        )
        self.assertEqual(resp_log2.status_code, 201)
        log2_data = resp_log2.json()
        self.assertEqual(log2_data["website_id"], 1)
        self.assertEqual(log2_data["integration_id"], 11)

        # Ingest Event via C1
        resp_evt1 = self.client.post(
            "/events",
            headers={"X-API-Key": key1},
            json={
                "event_type": "app_login",
                "severity": "Info",
                "source": "auth_service",
                "title": "User login success",
                "description": "User logged in",
                "ip_address": "1.2.3.4",
                "user_agent": "Mozilla/5.0",
                "event_metadata": {"user": "alice"},
            },
        )
        self.assertEqual(resp_evt1.status_code, 201)
        evt1_data = resp_evt1.json()
        self.assertEqual(evt1_data["website_id"], 1)
        self.assertEqual(evt1_data["integration_id"], 10)

        # Ingest Event via C2
        resp_evt2 = self.client.post(
            "/events",
            headers={"X-API-Key": key2},
            json={
                "event_type": "app_action",
                "severity": "Low",
                "source": "api_gateway",
                "title": "Action triggered",
                "description": "User performed action",
                "ip_address": "5.6.7.8",
                "user_agent": "Mozilla/5.0",
                "event_metadata": {"action": "refresh"},
            },
        )
        self.assertEqual(resp_evt2.status_code, 201)
        evt2_data = resp_evt2.json()
        self.assertEqual(evt2_data["website_id"], 1)
        self.assertEqual(evt2_data["integration_id"], 11)

        # Query recent logs as Org 1
        resp_recent = self.client.get("/logs/recent", headers=self.headers1)
        self.assertEqual(resp_recent.status_code, 200)
        recent = resp_recent.json()
        c_ids = {r["integration_id"] for r in recent}
        self.assertIn(10, c_ids)
        self.assertIn(11, c_ids)

    def test_legacy_key_ingestion_after_migration(self):
        """2. Legacy keys created before migration still ingest."""
        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            legacy_key = f"sk_{secrets.token_urlsafe(24)}"
            legacy_secret = secrets.token_urlsafe(48)
            legacy_int = Integration(
                id=20,
                organization_id=1,
                website_id=1,
                name="Legacy integration",
                kind="legacy",
                api_key_hash=hash_api_key(legacy_key),
                api_secret_hash=hash_api_key(legacy_secret),
                status="Connected",
            )
            db.add(legacy_int)
            db.commit()
        finally:
            db.close()

        resp_log = self.client.post(
            "/logs",
            headers={"X-API-Key": legacy_key},
            json={
                "ip_address": "9.9.9.9",
                "method": "GET",
                "url": "https://alpha.example.com/legacy",
                "status_code": 200,
                "user_agent": "LegacyAgent",
                "message": "legacy log ingest",
            },
        )
        self.assertEqual(resp_log.status_code, 201)
        data = resp_log.json()
        self.assertEqual(data["integration_id"], 20)

        resp_evt = self.client.post(
            "/events",
            headers={"X-API-Key": legacy_key},
            json={
                "event_type": "legacy_event",
                "severity": "Info",
                "source": "legacy_source",
                "title": "Legacy event title",
                "ip_address": "9.9.9.9",
                "event_metadata": {},
            },
        )
        self.assertEqual(resp_evt.status_code, 201)
        self.assertEqual(resp_evt.json()["integration_id"], 20)

    def test_revoke_and_disable_one_collector_other_continues(self):
        """3. Disabling/revoking one collector allows the other to keep ingesting."""
        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            key_active = f"snt_col_{secrets.token_urlsafe(32)}"
            key_target = f"snt_col_{secrets.token_urlsafe(32)}"

            c_active = Integration(
                id=30,
                organization_id=1,
                website_id=1,
                name="Active collector",
                kind="daemon",
                api_key_hash=hash_api_key(key_active),
                api_secret_hash=hash_api_key(secrets.token_urlsafe(32)),
                status="Connected",
            )
            c_target = Integration(
                id=31,
                organization_id=1,
                website_id=1,
                name="Target collector",
                kind="nginx",
                api_key_hash=hash_api_key(key_target),
                api_secret_hash=hash_api_key(secrets.token_urlsafe(32)),
                status="Connected",
            )
            db.add_all([c_active, c_target])
            db.commit()
        finally:
            db.close()

        # Both work initially
        r1 = self.client.post("/logs", headers={"X-API-Key": key_active}, json={
            "ip_address": "1.1.1.1", "method": "GET", "url": "https://alpha.example.com/", "status_code": 200, "user_agent": "A", "message": "m"
        })
        self.assertEqual(r1.status_code, 201)
        r2 = self.client.post("/logs", headers={"X-API-Key": key_target}, json={
            "ip_address": "1.1.1.1", "method": "GET", "url": "https://alpha.example.com/", "status_code": 200, "user_agent": "A", "message": "m"
        })
        self.assertEqual(r2.status_code, 201)

        # Disable c_target
        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            int_row = db.query(Integration).filter(Integration.id == 31).one()
            int_row.status = "Disabled"
            db.commit()
        finally:
            db.close()

        # Target collector gets 401
        r_disabled = self.client.post("/logs", headers={"X-API-Key": key_target}, json={
            "ip_address": "1.1.1.1", "method": "GET", "url": "https://alpha.example.com/", "status_code": 200, "user_agent": "A", "message": "m"
        })
        self.assertEqual(r_disabled.status_code, 401)
        self.assertEqual(r_disabled.json()["detail"], "Invalid API Key")

        # Active collector continues to work
        r_active = self.client.post("/logs", headers={"X-API-Key": key_active}, json={
            "ip_address": "1.1.1.1", "method": "GET", "url": "https://alpha.example.com/", "status_code": 200, "user_agent": "A", "message": "m"
        })
        self.assertEqual(r_active.status_code, 201)

        # Revoke c_target
        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            int_row = db.query(Integration).filter(Integration.id == 31).one()
            int_row.status = "Revoked"
            int_row.revoked_at = datetime.now(timezone.utc).replace(tzinfo=None)
            db.commit()
        finally:
            db.close()

        # Revoked collector gets 401
        r_revoked = self.client.post("/logs", headers={"X-API-Key": key_target}, json={
            "ip_address": "1.1.1.1", "method": "GET", "url": "https://alpha.example.com/", "status_code": 200, "user_agent": "A", "message": "m"
        })
        self.assertEqual(r_revoked.status_code, 401)
        self.assertEqual(r_revoked.json()["detail"], "Invalid API Key")

        # Active collector continues to work
        r_active2 = self.client.post("/logs", headers={"X-API-Key": key_active}, json={
            "ip_address": "1.1.1.1", "method": "GET", "url": "https://alpha.example.com/", "status_code": 200, "user_agent": "A", "message": "m"
        })
        self.assertEqual(r_active2.status_code, 201)

    def test_disabled_and_revoked_error_indistinguishable_from_unknown(self):
        """4. Disabling a collector blocks ingestion with 401 identical to unknown key."""
        payload = {
            "ip_address": "1.1.1.1", "method": "GET", "url": "https://alpha.example.com/",
            "status_code": 200, "user_agent": "A", "message": "m"
        }

        # Unknown key
        r_unknown = self.client.post("/logs", headers={"X-API-Key": "sk_unknown_key_1234567890"}, json=payload)
        self.assertEqual(r_unknown.status_code, 401)
        self.assertEqual(r_unknown.json(), {"detail": "Invalid API Key"})

        # Setup disabled and revoked keys
        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            key_dis = f"snt_col_{secrets.token_urlsafe(32)}"
            key_rev = f"snt_col_{secrets.token_urlsafe(32)}"
            c_dis = Integration(
                id=40, organization_id=1, website_id=1, name="Dis", kind="sdk",
                api_key_hash=hash_api_key(key_dis), api_secret_hash=hash_api_key(secrets.token_urlsafe(32)),
                status="Disabled",
            )
            c_rev = Integration(
                id=41, organization_id=1, website_id=1, name="Rev", kind="sdk",
                api_key_hash=hash_api_key(key_rev), api_secret_hash=hash_api_key(secrets.token_urlsafe(32)),
                status="Revoked", revoked_at=datetime.now(timezone.utc).replace(tzinfo=None),
            )
            db.add_all([c_dis, c_rev])
            db.commit()
        finally:
            db.close()

        r_dis = self.client.post("/logs", headers={"X-API-Key": key_dis}, json=payload)
        self.assertEqual(r_dis.status_code, 401)
        self.assertEqual(r_dis.json(), r_unknown.json())

        r_rev = self.client.post("/logs", headers={"X-API-Key": key_rev}, json=payload)
        self.assertEqual(r_rev.status_code, 401)
        self.assertEqual(r_rev.json(), r_unknown.json())

    def test_cross_asset_and_cross_org_integration_id_rejected_at_flush(self):
        """5. Cross-asset and cross-org integration_id on a Log rejected at flush by TenantSession."""
        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            # Integration on website 1 (org 1)
            int_w1 = Integration(
                id=50, organization_id=1, website_id=1, name="Int W1", kind="daemon",
                api_key_hash=hash_api_key("key-50-abcdef123456"),
                api_secret_hash=hash_api_key("sec-50-abcdef123456"), status="Connected",
            )
            # Integration on website 2 (org 1)
            int_w2 = Integration(
                id=51, organization_id=1, website_id=2, name="Int W2", kind="daemon",
                api_key_hash=hash_api_key("key-51-abcdef123456"),
                api_secret_hash=hash_api_key("sec-51-abcdef123456"), status="Connected",
            )
            # Integration on website 3 (org 2)
            int_w3 = Integration(
                id=52, organization_id=2, website_id=3, name="Int W3", kind="daemon",
                api_key_hash=hash_api_key("key-52-abcdef123456"),
                api_secret_hash=hash_api_key("sec-52-abcdef123456"), status="Connected",
            )
            db.add_all([int_w1, int_w2, int_w3])
            db.commit()
        finally:
            db.close()

        # Case A: Same tenant, but mismatched website: Log on website 1 with integration 51 (which belongs to website 2)
        db_tenant = self.SessionLocal()
        db_tenant.info["organization_id"] = 1
        try:
            log_mismatch = Log(
                organization_id=1,
                website_id=1,
                integration_id=51,  # Belongs to website 2!
                ip_address="1.1.1.1",
                method="GET",
                url="https://alpha.example.com/",
                status_code=200,
                user_agent="agent",
                message="m",
            )
            db_tenant.add(log_mismatch)
            with self.assertRaises(ValueError) as ctx:
                db_tenant.flush()
            self.assertIn("Integration and website do not match", str(ctx.exception))
        finally:
            db_tenant.rollback()
            db_tenant.close()

        # Case B: Cross-tenant: Log in org 1 trying to reference integration 52 (which belongs to org 2)
        db_tenant = self.SessionLocal()
        db_tenant.info["organization_id"] = 1
        try:
            log_cross_org = Log(
                organization_id=1,
                website_id=1,
                integration_id=52,  # Belongs to org 2!
                ip_address="1.1.1.1",
                method="GET",
                url="https://alpha.example.com/",
                status_code=200,
                user_agent="agent",
                message="m",
            )
            db_tenant.add(log_cross_org)
            with self.assertRaises(ValueError) as ctx:
                db_tenant.flush()
            self.assertIn("Resource parent does not belong to this tenant", str(ctx.exception))
        finally:
            db_tenant.rollback()
            db_tenant.close()

    def test_legacy_connect_regenerate_disconnect_behavior(self):
        """6. Legacy connect/regenerate/disconnect behave exactly as before."""
        # 1. Connect website 1
        r_conn = self.client.post("/websites/1/connect", headers=self.headers1)
        self.assertEqual(r_conn.status_code, 200)
        conn_data = r_conn.json()
        self.assertTrue(conn_data["api_key"].startswith("sk_"))
        self.assertIn("api_secret", conn_data)
        api_key_v1 = conn_data["api_key"]

        # Check DB: integration is created with kind="legacy", name="Legacy integration"
        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            leg_row = db.query(Integration).filter(Integration.website_id == 1, Integration.kind == "legacy").first()
            self.assertIsNotNone(leg_row)
            self.assertEqual(leg_row.name, "Legacy integration")
            self.assertEqual(leg_row.kind, "legacy")
            self.assertEqual(leg_row.status, "Connected")
        finally:
            db.close()

        # 2. Re-connecting while Connected returns 400 "Website already connected."
        r_conn_again = self.client.post("/websites/1/connect", headers=self.headers1)
        self.assertEqual(r_conn_again.status_code, 400)
        self.assertIn("already connected", r_conn_again.json()["detail"].lower())

        # 3. GET /websites/1/integration returns the legacy integration
        r_get = self.client.get("/websites/1/integration", headers=self.headers1)
        self.assertEqual(r_get.status_code, 200)
        get_data = r_get.json()
        self.assertEqual(get_data["website_id"], 1)
        self.assertEqual(get_data["status"], "Connected")
        self.assertEqual(get_data["kind"], "legacy")

        # 4. Ingest telemetry using api_key_v1 works
        r_log = self.client.post("/logs", headers={"X-API-Key": api_key_v1}, json={
            "ip_address": "1.2.3.4", "method": "GET", "url": "https://alpha.example.com/", "status_code": 200, "user_agent": "a", "message": "m"
        })
        self.assertEqual(r_log.status_code, 201)

        # 5. Regenerate keys
        r_regen = self.client.post("/websites/1/regenerate-key", headers=self.headers1)
        self.assertEqual(r_regen.status_code, 200)
        regen_data = r_regen.json()
        api_key_v2 = regen_data["api_key"]
        self.assertNotEqual(api_key_v1, api_key_v2)

        # Old key fails
        r_old_fail = self.client.post("/logs", headers={"X-API-Key": api_key_v1}, json={
            "ip_address": "1.2.3.4", "method": "GET", "url": "https://alpha.example.com/", "status_code": 200, "user_agent": "a", "message": "m"
        })
        self.assertEqual(r_old_fail.status_code, 401)

        # New key succeeds
        r_new_ok = self.client.post("/logs", headers={"X-API-Key": api_key_v2}, json={
            "ip_address": "1.2.3.4", "method": "GET", "url": "https://alpha.example.com/", "status_code": 200, "user_agent": "a", "message": "m"
        })
        self.assertEqual(r_new_ok.status_code, 201)

        # 6. Disconnect
        r_disc = self.client.delete("/websites/1/disconnect", headers=self.headers1)
        self.assertEqual(r_disc.status_code, 200)

        # Key no longer authenticates
        r_disc_fail = self.client.post("/logs", headers={"X-API-Key": api_key_v2}, json={
            "ip_address": "1.2.3.4", "method": "GET", "url": "https://alpha.example.com/", "status_code": 200, "user_agent": "a", "message": "m"
        })
        self.assertEqual(r_disc_fail.status_code, 401)

        # 7. Connect again after disconnect -> reconnects!
        r_reconnect = self.client.post("/websites/1/connect", headers=self.headers1)
        self.assertEqual(r_reconnect.status_code, 200)
        api_key_v3 = r_reconnect.json()["api_key"]

        r_reconn_ok = self.client.post("/logs", headers={"X-API-Key": api_key_v3}, json={
            "ip_address": "1.2.3.4", "method": "GET", "url": "https://alpha.example.com/", "status_code": 200, "user_agent": "a", "message": "m"
        })
        self.assertEqual(r_reconn_ok.status_code, 201)

    def test_migration_upgrade_and_downgrade_guard(self):
        """7. Migration upgrade and downgrade guard (downgrade refuses when multiple integrations per asset exist)."""
        engine = create_engine("sqlite:///:memory:")
        try:
            # 1. Run migration up to SCHEMA_VERSION
            report = migrate(engine)
            self.assertEqual(report["version"], SCHEMA_VERSION)


            # Verify schema has new columns
            with engine.connect() as conn:
                from sqlalchemy import inspect
                insp = inspect(conn)
                int_cols = {col["name"] for col in insp.get_columns("integrations")}
                self.assertIn("name", int_cols)
                self.assertIn("kind", int_cols)
                self.assertIn("revoked_at", int_cols)
                log_cols = {col["name"] for col in insp.get_columns("logs")}
                self.assertIn("integration_id", log_cols)

            # 2. Downgrade succeeds when no duplicate integrations per asset exist
            downgrade_phase2(engine)

            # 3. Upgrade back to Phase 2
            migrate(engine)

            # Insert an org, website, and TWO integrations for that website
            with engine.begin() as conn:
                conn.execute(text("INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (1, 'Org1', 'org1', '2026-01-01', '2026-01-01')"))
                conn.execute(text("INSERT INTO websites (id, organization_id, name, url, domain, exposure, verified, created_at, updated_at) VALUES (1, 1, 'Site1', 'https://s1.com', 's1.com', 'public', 0, '2026-01-01', '2026-01-01')"))
                conn.execute(text("INSERT INTO integrations (id, organization_id, website_id, api_key_hash, api_secret_hash, status, name, kind, created_at, updated_at) VALUES (1, 1, 1, 'h1', 's1', 'Connected', 'Col1', 'daemon', '2026-01-01', '2026-01-01')"))
                conn.execute(text("INSERT INTO integrations (id, organization_id, website_id, api_key_hash, api_secret_hash, status, name, kind, created_at, updated_at) VALUES (2, 1, 1, 'h2', 's2', 'Connected', 'Col2', 'nginx', '2026-01-01', '2026-01-01')"))


            # 4. Downgrade should be refused
            with self.assertRaises(SchemaMismatchError) as ctx:
                downgrade_phase2(engine)
            self.assertIn("multiple integrations", str(ctx.exception).lower())

            # 5. Remove the duplicate integration -> downgrade succeeds
            with engine.begin() as conn:
                conn.execute(text("DELETE FROM integrations WHERE id = 2"))
            downgrade_phase2(engine)
        finally:
            engine.dispose()
