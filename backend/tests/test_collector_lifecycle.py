"""Phase 3 Collector Lifecycle and Management Test Suite.

Covers all security checks and requirements from SENTINEL_IMPLEMENTATION_PLAN.md §7.11:
- rotate with grace: old and new both work inside grace, old fails after expiry; grace 0: old fails immediately; revoke clears previous key.
- disable -> 401 on ingest; enable -> works; revoke -> permanent, enable refused.
- legacy /regenerate-key still works (and clears any previous-key fields).
- monitoring_status and collector status derivation across all states (time-controlled).
- management handlers: path asset A with collector from asset B (same org) -> 404; collector from another org -> 404; analyst/viewer -> 403 on mutations; viewer can list collectors; analyst/viewer cannot list tokens.
- archive asset revokes collectors and tokens; enroll with pre-archive token -> 401.
- audit rows exist for each lifecycle action with no secrets.
- query count test verifying GET /websites does NOT N+1 on collectors.
"""
from datetime import datetime, timedelta, timezone
import hashlib
import unittest
import secrets

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
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
from app.services.collector_service import (
    COLLECTOR_OFFLINE_AFTER_SECONDS,
    derive_collector_status,
    derive_asset_monitoring_status,
)
from app.services.session_service import create_session
from app.utils.security import hash_password, create_access_token


class CollectorLifecycleTests(unittest.TestCase):
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

        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            self.org1 = Organization(id=1, name="Org One", slug="org-one")
            self.org2 = Organization(id=2, name="Org Two", slug="org-two")
            db.add_all([self.org1, self.org2])
            db.flush()

            # Users in Org 1: owner, admin, analyst, viewer
            self.user_owner = User(
                id=1,
                email="owner@orgone.com",
                full_name="Owner One",
                password_hash=hash_password("Password123!"),
                is_active=True,
            )
            self.user_admin = User(
                id=2,
                email="admin@orgone.com",
                full_name="Admin One",
                password_hash=hash_password("Password123!"),
                is_active=True,
            )
            self.user_analyst = User(
                id=3,
                email="analyst@orgone.com",
                full_name="Analyst One",
                password_hash=hash_password("Password123!"),
                is_active=True,
            )
            self.user_viewer = User(
                id=4,
                email="viewer@orgone.com",
                full_name="Viewer One",
                password_hash=hash_password("Password123!"),
                is_active=True,
            )
            # User in Org 2
            self.user_org2 = User(
                id=5,
                email="owner@orgtwo.com",
                full_name="Owner Two",
                password_hash=hash_password("Password123!"),
                is_active=True,
            )
            db.add_all([
                self.user_owner,
                self.user_admin,
                self.user_analyst,
                self.user_viewer,
                self.user_org2,
            ])
            db.flush()

            db.add(OrganizationMember(user_id=1, organization_id=1, role="owner"))
            db.add(OrganizationMember(user_id=2, organization_id=1, role="admin"))
            db.add(OrganizationMember(user_id=3, organization_id=1, role="analyst"))
            db.add(OrganizationMember(user_id=4, organization_id=1, role="viewer"))
            db.add(OrganizationMember(user_id=5, organization_id=2, role="owner"))
            db.flush()

            s_owner = create_session(db, user_id=1, user_agent="test", ip_address="127.0.0.1")
            s_admin = create_session(db, user_id=2, user_agent="test", ip_address="127.0.0.1")
            s_analyst = create_session(db, user_id=3, user_agent="test", ip_address="127.0.0.1")
            s_viewer = create_session(db, user_id=4, user_agent="test", ip_address="127.0.0.1")
            s_org2 = create_session(db, user_id=5, user_agent="test", ip_address="127.0.0.1")
            db.commit()

            t_owner = create_access_token("1", s_owner.session_id)
            t_admin = create_access_token("2", s_admin.session_id)
            t_analyst = create_access_token("3", s_analyst.session_id)
            t_viewer = create_access_token("4", s_viewer.session_id)
            t_org2 = create_access_token("5", s_org2.session_id)

            self.headers_owner = {"Authorization": f"Bearer {t_owner}", "X-Organization-ID": "1"}
            self.headers_admin = {"Authorization": f"Bearer {t_admin}", "X-Organization-ID": "1"}
            self.headers_analyst = {"Authorization": f"Bearer {t_analyst}", "X-Organization-ID": "1"}
            self.headers_viewer = {"Authorization": f"Bearer {t_viewer}", "X-Organization-ID": "1"}
            self.headers_org2 = {"Authorization": f"Bearer {t_org2}", "X-Organization-ID": "2"}

            # Assets
            self.asset_a = Website(
                id=1,
                organization_id=1,
                name="Asset Alpha",
                url="https://alpha.example.com",
                domain="alpha.example.com",
                exposure="public",
                verified=True,
            )
            self.asset_b = Website(
                id=2,
                organization_id=1,
                name="Asset Beta",
                url="https://beta.example.com",
                domain="beta.example.com",
                exposure="public",
                verified=True,
            )
            self.asset_c = Website(
                id=3,
                organization_id=2,
                name="Asset Gamma",
                url="https://gamma.example.com",
                domain="gamma.example.com",
                exposure="public",
                verified=True,
            )
            db.add_all([self.asset_a, self.asset_b, self.asset_c])
            db.commit()
        finally:
            db.close()

    def tearDown(self):
        app.dependency_overrides.clear()
        self.engine.dispose()

    def _create_token(self, website_id: int, headers: dict, max_uses: int = 5):
        resp = self.client.post(
            f"/websites/{website_id}/enrollment-tokens",
            headers=headers,
            json={"label": "Test Token", "expires_in_hours": 24, "max_uses": max_uses},
        )
        return resp

    def _enroll(self, raw_token: str, name: str = "Test Collector", kind: str = "daemon"):
        return self.client.post(
            "/collector/enroll",
            headers={"X-Enrollment-Token": raw_token},
            json={"name": name, "kind": kind, "hostname": "srv-01"},
        )

    def _sample_log(self, url: str = "https://alpha.example.com/health"):
        return {
            "ip_address": "10.0.0.1",
            "method": "GET",
            "url": url,
            "status_code": 200,
            "user_agent": "curl/7.68.0",
            "message": "test request",
        }

    def test_rotate_key_with_grace_period_and_expiry(self):
        """Rotate key: old and new work inside grace; old fails after expiry; grace 0 fails immediately; revoke clears previous key."""
        t_resp = self._create_token(self.asset_a.id, self.headers_owner)
        self.assertEqual(t_resp.status_code, 201)
        raw_token = t_resp.json()["token"]

        e_resp = self._enroll(raw_token)
        self.assertEqual(e_resp.status_code, 201)
        collector_id = e_resp.json()["collector_id"]
        key1 = e_resp.json()["api_key"]

        # 1. key1 works on /logs
        log_payload = self._sample_log()
        r1 = self.client.post("/logs", headers={"X-API-Key": key1}, json=log_payload)
        self.assertEqual(r1.status_code, 201)

        # 2. Rotate key with 300s grace
        rot_resp = self.client.post(
            f"/websites/{self.asset_a.id}/collectors/{collector_id}/rotate-key",
            headers=self.headers_owner,
            json={"grace_seconds": 300},
        )
        self.assertEqual(rot_resp.status_code, 200)
        key2 = rot_resp.json()["api_key"]
        self.assertNotEqual(key1, key2)

        # Inside grace: both key1 and key2 work
        r_old = self.client.post("/logs", headers={"X-API-Key": key1}, json=log_payload)
        self.assertEqual(r_old.status_code, 201)
        r_new = self.client.post("/logs", headers={"X-API-Key": key2}, json=log_payload)
        self.assertEqual(r_new.status_code, 201)

        # 3. Simulate grace expiry by modifying previous_key_expires_at into the past
        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            col_row = db.query(Integration).filter(Integration.id == collector_id).first()
            col_row.previous_key_expires_at = datetime.utcnow() - timedelta(seconds=10)
            db.commit()
        finally:
            db.close()

        # Old key fails with 401; new key still works
        r_old_expired = self.client.post("/logs", headers={"X-API-Key": key1}, json=log_payload)
        self.assertEqual(r_old_expired.status_code, 401)
        self.assertEqual(r_old_expired.json(), {"detail": "Invalid API Key"})

        r_new_still_ok = self.client.post("/logs", headers={"X-API-Key": key2}, json=log_payload)
        self.assertEqual(r_new_still_ok.status_code, 201)

        # 4. Rotate key with grace 0: old fails immediately
        rot_zero = self.client.post(
            f"/websites/{self.asset_a.id}/collectors/{collector_id}/rotate-key",
            headers=self.headers_owner,
            json={"grace_seconds": 0},
        )
        self.assertEqual(rot_zero.status_code, 200)
        key3 = rot_zero.json()["api_key"]

        r_key2_imm_fails = self.client.post("/logs", headers={"X-API-Key": key2}, json=log_payload)
        self.assertEqual(r_key2_imm_fails.status_code, 401)

        r_key3_works = self.client.post("/logs", headers={"X-API-Key": key3}, json=log_payload)
        self.assertEqual(r_key3_works.status_code, 201)

        # 5. Revoking collector clears previous key fields and disables key3
        rev_resp = self.client.post(
            f"/websites/{self.asset_a.id}/collectors/{collector_id}/revoke",
            headers=self.headers_owner,
        )
        self.assertEqual(rev_resp.status_code, 200)

        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            col_row = db.query(Integration).filter(Integration.id == collector_id).first()
            self.assertIsNone(col_row.previous_key_hash)
            self.assertIsNone(col_row.previous_key_expires_at)
        finally:
            db.close()

        r_key3_revoked = self.client.post("/logs", headers={"X-API-Key": key3}, json=log_payload)
        self.assertEqual(r_key3_revoked.status_code, 401)

    def test_disable_enable_revoke_lifecycle(self):
        """Disable -> 401 on ingest; enable -> works; revoke -> permanent, enable refused."""
        t_resp = self._create_token(self.asset_a.id, self.headers_owner)
        raw_token = t_resp.json()["token"]
        e_resp = self._enroll(raw_token)
        collector_id = e_resp.json()["collector_id"]
        api_key = e_resp.json()["api_key"]

        log_payload = self._sample_log()

        # Connected works
        r = self.client.post("/logs", headers={"X-API-Key": api_key}, json=log_payload)
        self.assertEqual(r.status_code, 201)

        # Disable
        dis_resp = self.client.post(
            f"/websites/{self.asset_a.id}/collectors/{collector_id}/disable",
            headers=self.headers_owner,
        )
        self.assertEqual(dis_resp.status_code, 200)

        # Disabled key gives generic 401 (no oracle)
        r_dis = self.client.post("/logs", headers={"X-API-Key": api_key}, json=log_payload)
        self.assertEqual(r_dis.status_code, 401)
        self.assertEqual(r_dis.json(), {"detail": "Invalid API Key"})

        # Enable
        en_resp = self.client.post(
            f"/websites/{self.asset_a.id}/collectors/{collector_id}/enable",
            headers=self.headers_owner,
        )
        self.assertEqual(en_resp.status_code, 200)

        # Connected works again
        r_en = self.client.post("/logs", headers={"X-API-Key": api_key}, json=log_payload)
        self.assertEqual(r_en.status_code, 201)

        # Revoke
        rev_resp = self.client.post(
            f"/websites/{self.asset_a.id}/collectors/{collector_id}/revoke",
            headers=self.headers_owner,
        )
        self.assertEqual(rev_resp.status_code, 200)

        # Ingestion fails
        r_rev = self.client.post("/logs", headers={"X-API-Key": api_key}, json=log_payload)
        self.assertEqual(r_rev.status_code, 401)

        # Enable refused on revoked collector
        en_again = self.client.post(
            f"/websites/{self.asset_a.id}/collectors/{collector_id}/enable",
            headers=self.headers_owner,
        )
        self.assertEqual(en_again.status_code, 400)
        self.assertIn("Revoked", en_again.json()["detail"])

    def test_legacy_regenerate_key_still_works_and_clears_previous_key(self):
        """Legacy /regenerate-key still works and clears any previous-key fields."""
        # Connect legacy integration
        c_resp = self.client.post(
            f"/websites/{self.asset_a.id}/connect",
            headers=self.headers_owner,
        )
        self.assertEqual(c_resp.status_code, 200)
        old_key = c_resp.json()["api_key"]

        # Set fake previous_key on integration
        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            integ = db.query(Integration).filter(Integration.website_id == self.asset_a.id, Integration.kind == "legacy").first()
            integ.previous_key_hash = "fake_old_hash"
            integ.previous_key_expires_at = datetime.utcnow() + timedelta(hours=1)
            db.commit()
        finally:
            db.close()

        # Regenerate keys
        regen_resp = self.client.post(
            f"/websites/{self.asset_a.id}/regenerate-key",
            headers=self.headers_owner,
        )
        self.assertEqual(regen_resp.status_code, 200)
        new_key = regen_resp.json()["api_key"]
        self.assertNotEqual(old_key, new_key)

        # Verify previous_key_hash is cleared
        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            integ = db.query(Integration).filter(Integration.website_id == self.asset_a.id, Integration.kind == "legacy").first()
            self.assertIsNone(integ.previous_key_hash)
            self.assertIsNone(integ.previous_key_expires_at)
        finally:
            db.close()

        # New key works on /logs
        log_resp = self.client.post(
            "/logs",
            headers={"X-API-Key": new_key},
            json=self._sample_log(),
        )
        self.assertEqual(log_resp.status_code, 201)

    def test_monitoring_status_and_collector_status_derivations(self):
        """Verify status derivations across states: pending, online, offline, disabled, revoked."""
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # 1. No collectors -> not_connected
        st, total, online, last_tel = derive_asset_monitoring_status([])
        self.assertEqual(st, "not_connected")
        self.assertEqual(total, 0)
        self.assertEqual(online, 0)

        # 2. Pending collector (neither last_heartbeat_at nor last_used)
        c_pending = Integration(status="Connected", last_heartbeat_at=None, last_used=None)
        self.assertEqual(derive_collector_status(c_pending, now), "pending")
        st, total, online, last_tel = derive_asset_monitoring_status([c_pending])
        self.assertEqual(st, "waiting")

        # 3. Online collector (recent heartbeat)
        c_online = Integration(status="Connected", last_heartbeat_at=now - timedelta(seconds=10), last_used=None)
        self.assertEqual(derive_collector_status(c_online, now), "online")
        st, total, online, last_tel = derive_asset_monitoring_status([c_online])
        self.assertEqual(st, "active")

        # 4. Offline collector (heartbeat older than COLLECTOR_OFFLINE_AFTER_SECONDS)
        c_offline = Integration(
            status="Connected",
            last_heartbeat_at=now - timedelta(seconds=COLLECTOR_OFFLINE_AFTER_SECONDS + 10),
            last_used=None,
        )
        self.assertEqual(derive_collector_status(c_offline, now), "offline")
        st, total, online, last_tel = derive_asset_monitoring_status([c_offline])
        self.assertEqual(st, "offline")

        # 5. Degraded: one online, one offline
        st, total, online, last_tel = derive_asset_monitoring_status([c_online, c_offline])
        self.assertEqual(st, "degraded")

        # 6. Disabled and Revoked collectors
        c_disabled = Integration(status="Disabled", last_heartbeat_at=now)
        c_revoked = Integration(status="Revoked", last_heartbeat_at=now)
        self.assertEqual(derive_collector_status(c_disabled, now), "disabled")
        self.assertEqual(derive_collector_status(c_revoked, now), "revoked")
        # Excluded from active count
        st, total, online, last_tel = derive_asset_monitoring_status([c_disabled, c_revoked])
        self.assertEqual(st, "not_connected")

    def test_management_handlers_scoping_and_rbac(self):
        """Cross-asset, cross-org -> 404; analyst/viewer -> 403 on mutations; viewer can list collectors; cannot list tokens."""
        # Enroll collector on asset_a
        t_a = self._create_token(self.asset_a.id, self.headers_owner)
        e_a = self._enroll(t_a.json()["token"])
        col_a_id = e_a.json()["collector_id"]

        # Enroll collector on asset_b (same org)
        t_b = self._create_token(self.asset_b.id, self.headers_owner)
        e_b = self._enroll(t_b.json()["token"])
        col_b_id = e_b.json()["collector_id"]

        # Enroll collector on asset_c (Org 2)
        t_c = self._create_token(self.asset_c.id, self.headers_org2)
        e_c = self._enroll(t_c.json()["token"])
        col_c_id = e_c.json()["collector_id"]

        # Path asset A with collector from asset B (same org) -> 404
        r_cross_asset = self.client.post(
            f"/websites/{self.asset_a.id}/collectors/{col_b_id}/disable",
            headers=self.headers_owner,
        )
        self.assertEqual(r_cross_asset.status_code, 404)

        # Path asset A with collector from asset C (different org) -> 404
        r_cross_org = self.client.post(
            f"/websites/{self.asset_a.id}/collectors/{col_c_id}/disable",
            headers=self.headers_owner,
        )
        self.assertEqual(r_cross_org.status_code, 404)

        # Analyst role:
        # Can list collectors
        r_col_list = self.client.get(
            f"/websites/{self.asset_a.id}/collectors",
            headers=self.headers_analyst,
        )
        self.assertEqual(r_col_list.status_code, 200)

        # Cannot list tokens -> 403
        r_tok_list = self.client.get(
            f"/websites/{self.asset_a.id}/enrollment-tokens",
            headers=self.headers_analyst,
        )
        self.assertEqual(r_tok_list.status_code, 403)

        # Cannot create tokens -> 403
        r_tok_create = self.client.post(
            f"/websites/{self.asset_a.id}/enrollment-tokens",
            headers=self.headers_analyst,
            json={"label": "Analyst Token"},
        )
        self.assertEqual(r_tok_create.status_code, 403)

        # Cannot rotate key -> 403
        r_rot = self.client.post(
            f"/websites/{self.asset_a.id}/collectors/{col_a_id}/rotate-key",
            headers=self.headers_analyst,
            json={},
        )
        self.assertEqual(r_rot.status_code, 403)

        # Cannot disable/enable/revoke -> 403
        self.assertEqual(
            self.client.post(f"/websites/{self.asset_a.id}/collectors/{col_a_id}/disable", headers=self.headers_analyst).status_code,
            403,
        )
        self.assertEqual(
            self.client.post(f"/websites/{self.asset_a.id}/collectors/{col_a_id}/enable", headers=self.headers_analyst).status_code,
            403,
        )
        self.assertEqual(
            self.client.post(f"/websites/{self.asset_a.id}/collectors/{col_a_id}/revoke", headers=self.headers_analyst).status_code,
            403,
        )

        # Viewer role:
        # Can list collectors
        self.assertEqual(
            self.client.get(f"/websites/{self.asset_a.id}/collectors", headers=self.headers_viewer).status_code,
            200,
        )
        # Cannot list tokens -> 403
        self.assertEqual(
            self.client.get(f"/websites/{self.asset_a.id}/enrollment-tokens", headers=self.headers_viewer).status_code,
            403,
        )
        # Cannot mutate -> 403
        self.assertEqual(
            self.client.post(f"/websites/{self.asset_a.id}/collectors/{col_a_id}/disable", headers=self.headers_viewer).status_code,
            403,
        )

    def test_archive_asset_revokes_collectors_and_tokens_enroll_fails(self):
        """Archive asset revokes collectors and tokens; enroll with pre-archive token -> 401."""
        t_resp = self._create_token(self.asset_a.id, self.headers_owner)
        raw_token = t_resp.json()["token"]

        e_resp = self._enroll(raw_token)
        col_id = e_resp.json()["collector_id"]
        api_key = e_resp.json()["api_key"]

        # Archive asset
        del_resp = self.client.delete(
            f"/websites/{self.asset_a.id}",
            headers=self.headers_owner,
        )
        self.assertEqual(del_resp.status_code, 200)

        # Check DB rows
        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            col_row = db.query(Integration).filter(Integration.id == col_id).first()
            self.assertEqual(col_row.status, "Revoked")
            self.assertIsNotNone(col_row.revoked_at)

            tok_rows = db.query(EnrollmentToken).filter(EnrollmentToken.website_id == self.asset_a.id).all()
            for tok in tok_rows:
                self.assertIsNotNone(tok.revoked_at)
        finally:
            db.close()

        # Enroll with pre-archive token fails with generic 401
        en_after_archive = self._enroll(raw_token)
        self.assertEqual(en_after_archive.status_code, 401)
        self.assertEqual(en_after_archive.json(), {"detail": "Invalid or expired enrollment token"})

        # Ingestion with key fails with generic 401
        r_ingest = self.client.post(
            "/logs",
            headers={"X-API-Key": api_key},
            json=self._sample_log(),
        )
        self.assertEqual(r_ingest.status_code, 401)

    def test_audit_logs_for_all_lifecycle_actions_contain_no_secrets(self):
        """Audit rows exist for each lifecycle action with no secrets."""
        t_resp = self._create_token(self.asset_a.id, self.headers_owner)
        raw_token = t_resp.json()["token"]
        token_id = t_resp.json()["id"]

        e_resp = self._enroll(raw_token)
        col_id = e_resp.json()["collector_id"]
        key1 = e_resp.json()["api_key"]

        rot_resp = self.client.post(
            f"/websites/{self.asset_a.id}/collectors/{col_id}/rotate-key",
            headers=self.headers_owner,
            json={"grace_seconds": 60},
        )
        key2 = rot_resp.json()["api_key"]

        self.client.post(
            f"/websites/{self.asset_a.id}/collectors/{col_id}/disable",
            headers=self.headers_owner,
        )

        self.client.post(
            f"/websites/{self.asset_a.id}/collectors/{col_id}/enable",
            headers=self.headers_owner,
        )

        self.client.post(
            f"/websites/{self.asset_a.id}/collectors/{col_id}/revoke",
            headers=self.headers_owner,
        )

        self.client.delete(
            f"/websites/{self.asset_a.id}/enrollment-tokens/{token_id}",
            headers=self.headers_owner,
        )

        # Verify audit logs
        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            logs = db.query(AuditLog).filter(AuditLog.organization_id == 1).all()
            actions = [l.action for l in logs]
            self.assertIn("ENROLLMENT_TOKEN_CREATED", actions)
            self.assertIn("COLLECTOR_ENROLLED", actions)
            self.assertIn("COLLECTOR_KEY_ROTATED", actions)
            self.assertIn("COLLECTOR_DISABLED", actions)
            self.assertIn("COLLECTOR_ENABLED", actions)
            self.assertIn("COLLECTOR_REVOKED", actions)
            self.assertIn("ENROLLMENT_TOKEN_REVOKED", actions)

            # Check no plain secrets leaked
            secrets_to_check = [raw_token, key1, key2]
            for log_entry in logs:
                for secret in secrets_to_check:
                    if log_entry.description:
                        self.assertNotIn(secret, log_entry.description)
        finally:
            db.close()

    def test_no_n_plus_one_on_get_websites(self):
        """GET /websites executes a fixed number of queries regardless of asset count (no N+1)."""
        # Create 5 assets with collectors
        db = self.SessionLocal()
        db.info["system_scope"] = True
        try:
            for i in range(10, 15):
                w = Website(
                    id=i,
                    organization_id=1,
                    name=f"Batch Asset {i}",
                    url=f"https://asset{i}.example.com",
                    domain=f"asset{i}.example.com",
                    exposure="public",
                    verified=True,
                )
                db.add(w)
                db.flush()
                for k in range(3):
                    c = Integration(
                        organization_id=1,
                        website_id=i,
                        name=f"Collector {k}",
                        kind="daemon",
                        api_key_hash=hashlib.sha256(f"key_{i}_{k}".encode()).hexdigest(),
                        status="Connected",
                    )
                    db.add(c)
            db.commit()
        finally:
            db.close()

        query_count = 0

        def count_queries(conn, cursor, statement, parameters, context, executemany):
            nonlocal query_count
            query_count += 1

        event.listen(self.engine, "before_cursor_execute", count_queries)
        try:
            resp = self.client.get(
                "/websites",
                headers=self.headers_owner,
            )
            self.assertEqual(resp.status_code, 200)
            items = resp.json()
            self.assertGreaterEqual(len(items), 5)
            # Should be small bounded number of queries (auth + websites select + single collectors select + count)
            # Definitely << 15 (if N+1, it would be at least 15 queries for collectors alone)
            self.assertLess(query_count, 10, f"Expected < 10 queries, got {query_count}")
        finally:
            event.remove(self.engine, "before_cursor_execute", count_queries)


if __name__ == "__main__":
    unittest.main()
