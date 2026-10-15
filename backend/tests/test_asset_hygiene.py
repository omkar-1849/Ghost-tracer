"""Phase 1 Asset Hygiene Test Suite.

Covers all security checks and requirements from SENTINEL_IMPLEMENTATION_PLAN.md §5.6:
- Cross-tenant same URL allowed, intra-tenant duplicate blocked, archive-then-reregister allowed
- Quota boundary (MAX_ASSETS_PER_ORGANIZATION = 10), archived excluded from quota
- exposure default is 'public'
- internal -> public resets verification and pins
- Scan gate order: 404 -> 403 unverified -> 403 internal -> destination -> pin
- Worker re-check: asset flipped to internal after enqueue fails job safely without spawning subprocess
- Archive effects: list excludes, detail 404, history readable, telemetry key 401, scan 404
- Migration upgrade & downgrade guard
- Production guard: loopback auto-verify disabled in production
"""
import os
import unittest
from datetime import datetime
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.database import TenantSession, get_db
from app.database.migrations import migrate, downgrade_phase1, SCHEMA_VERSION, SchemaMismatchError
from app.main import app
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.user import User
from app.models.website import Website
from app.models.integration import Integration
from app.models.alert import Alert
from app.models.incident import Incident
from app.models.scan import Scan
from app.services.session_service import create_session
from app.services.scanners.scanner_mixin import ScannerJobMixin
from app.utils.security import hash_password, create_access_token
from app.middleware.api_key_auth import hash_api_key


class AssetHygieneTests(unittest.TestCase):
    def setUp(self):
        self.env_patcher = patch.dict(os.environ, {
            "SENTINEL_ALLOWED_TARGET_HOSTS": "*",
            "ENVIRONMENT": "development",
        })
        self.env_patcher.start()
        self.addCleanup(self.env_patcher.stop)

        import socket
        def fake_getaddrinfo(host, port, *args, **kwargs):
            if host in ("localhost", "127.0.0.1", "::1"):
                return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", port or 80))]
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", port or 443))]

        self.dns_patcher = patch("socket.getaddrinfo", side_effect=fake_getaddrinfo)
        self.dns_patcher.start()
        self.addCleanup(self.dns_patcher.stop)

        self.engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
        self.factory = sessionmaker(
            bind=self.engine, class_=TenantSession, expire_on_commit=False
        )
        Base.metadata.create_all(self.engine)

        pw_hash = hash_password("Password123!")
        with self.factory() as db:
            db.info["system_scope"] = True
            self.user1 = User(id=1, email="user1@org1.test", password_hash=pw_hash, full_name="User 1")
            self.user2 = User(id=2, email="user2@org2.test", password_hash=pw_hash, full_name="User 2")
            db.add_all([self.user1, self.user2])
            db.flush()

            self.org1 = Organization(id=1, name="Org One", slug="org-one")
            self.org2 = Organization(id=2, name="Org Two", slug="org-two")
            db.add_all([self.org1, self.org2])
            db.flush()

            db.add(OrganizationMember(user_id=1, organization_id=1, role="owner"))
            db.add(OrganizationMember(user_id=2, organization_id=2, role="owner"))

            s1 = create_session(db, user_id=1, user_agent="test", ip_address="127.0.0.1")
            s2 = create_session(db, user_id=2, user_agent="test", ip_address="127.0.0.1")
            db.commit()

        t1 = create_access_token("1", s1.session_id)
        t2 = create_access_token("2", s2.session_id)

        self.headers1 = {"Authorization": f"Bearer {t1}", "X-Organization-ID": "1"}
        self.headers2 = {"Authorization": f"Bearer {t2}", "X-Organization-ID": "2"}

        def override_get_db():
            with self.factory() as db:
                try:
                    yield db
                    db.commit()
                except Exception:
                    db.rollback()
                    raise

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    # 1. Cross-tenant same URL, intra-tenant duplicate, archive-then-reregister
    def test_cross_tenant_same_url_and_intra_tenant_duplicate(self):
        # Org 1 creates an asset
        r1 = self.client.post("/websites", json={
            "name": "App Alpha",
            "url": "https://alpha.example.com",
            "environment": "Production"
        }, headers=self.headers1)
        self.assertEqual(r1.status_code, 201)
        site1 = r1.json()

        # Org 2 creates an asset with the EXACT same URL -> succeeds (cross-tenant allowed)
        r2 = self.client.post("/websites", json={
            "name": "App Alpha Copy",
            "url": "https://alpha.example.com",
            "environment": "Production"
        }, headers=self.headers2)
        self.assertEqual(r2.status_code, 201)

        # Org 1 tries to create duplicate URL -> 400 blocked
        r1_dup = self.client.post("/websites", json={
            "name": "App Alpha Duplicate",
            "url": "https://alpha.example.com",
            "environment": "Staging"
        }, headers=self.headers1)
        self.assertEqual(r1_dup.status_code, 400)
        self.assertIn("already exists", r1_dup.json()["detail"])

        # Org 1 archives the asset
        del_res = self.client.delete(f"/websites/{site1['id']}", headers=self.headers1)
        self.assertEqual(del_res.status_code, 200)

        # Org 1 re-registers the same URL -> succeeds because previous is archived
        r1_re = self.client.post("/websites", json={
            "name": "App Alpha Reborn",
            "url": "https://alpha.example.com",
            "environment": "Production"
        }, headers=self.headers1)
        self.assertEqual(r1_re.status_code, 201)

    # 2. Quota boundary (MAX_ASSETS_PER_ORGANIZATION = 10)
    def test_quota_boundary_and_archived_excluded_from_quota(self):
        created_ids = []
        for i in range(10):
            res = self.client.post("/websites", json={
                "name": f"App {i}",
                "url": f"https://app{i}.example.com",
                "environment": "Production"
            }, headers=self.headers1)
            self.assertEqual(res.status_code, 201)
            created_ids.append(res.json()["id"])

        # 11th asset in Org 1 -> fails with 400 quota exceeded
        res_11 = self.client.post("/websites", json={
            "name": "App 11",
            "url": "https://app11.example.com",
            "environment": "Production"
        }, headers=self.headers1)
        self.assertEqual(res_11.status_code, 400)
        self.assertIn("Asset limit reached", res_11.json()["detail"])

        # Archive one asset in Org 1
        del_res = self.client.delete(f"/websites/{created_ids[0]}", headers=self.headers1)
        self.assertEqual(del_res.status_code, 200)

        # Now creating the 11th asset succeeds because non-archived count is 9
        res_retry = self.client.post("/websites", json={
            "name": "App 11",
            "url": "https://app11.example.com",
            "environment": "Production"
        }, headers=self.headers1)
        self.assertEqual(res_retry.status_code, 201)

    # 3. Exposure default is 'public'
    def test_exposure_default_is_public(self):
        res = self.client.post("/websites", json={
            "name": "Default Exposure App",
            "url": "https://exposure.example.com",
            "environment": "Production"
        }, headers=self.headers1)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data.get("exposure"), "public")

        # Explicitly internal asset
        res_internal = self.client.post("/websites", json={
            "name": "Internal App",
            "url": "https://internal.example.com",
            "environment": "Production",
            "exposure": "internal"
        }, headers=self.headers1)
        self.assertEqual(res_internal.status_code, 201)
        self.assertEqual(res_internal.json().get("exposure"), "internal")

    # 4. internal -> public resets verification and pins
    def test_internal_to_public_transition_resets_verification(self):
        # Create an asset and manually set verified + pinned fields
        with self.factory() as db:
            db.info["system_scope"] = True
            site = Website(
                organization_id=1,
                name="Transition App",
                url="https://transition.example.com",
                domain="transition.example.com",
                environment="Production",
                exposure="internal",
                verified=True,
                verified_target="https://transition.example.com",
                verified_addresses='["93.184.216.34"]',
                verified_at=datetime.utcnow(),
            )
            db.add(site)
            db.commit()
            site_id = site.id

        # Switch exposure internal -> public
        update_res = self.client.put(f"/websites/{site_id}", json={
            "exposure": "public"
        }, headers=self.headers1)
        self.assertEqual(update_res.status_code, 200)

        with self.factory() as db:
            db.info["system_scope"] = True
            updated_site = db.query(Website).filter(Website.id == site_id).first()
            self.assertEqual(updated_site.exposure, "public")
            self.assertFalse(updated_site.verified)
            self.assertIsNone(updated_site.verified_target)
            self.assertIsNone(updated_site.verified_addresses)
            self.assertIsNone(updated_site.verified_at)

    # 5. Scan gate order: 404 -> 403 unverified -> 403 internal -> destination -> pin
    def test_scan_gate_order(self):
        # 5a. Non-existent / archived asset -> 404
        r_404 = self.client.post("/scans", json={"website_id": 99999, "engine": "nmap"}, headers=self.headers1)
        self.assertEqual(r_404.status_code, 404)

        # Create asset 1: unverified public
        with self.factory() as db:
            db.info["system_scope"] = True
            unverified_site = Website(
                organization_id=1,
                name="Unverified Site",
                url="https://unverified.example.com",
                domain="unverified.example.com",
                environment="Production",
                exposure="public",
                verified=False,
            )
            # Asset 2: verified internal
            internal_site = Website(
                organization_id=1,
                name="Internal Site",
                url="https://internal-gate.example.com",
                domain="internal-gate.example.com",
                environment="Production",
                exposure="internal",
                verified=True,
                verified_target="https://internal-gate.example.com",
                verified_addresses='["93.184.216.34"]',
            )
            # Asset 3: verified public with mismatch pin
            pin_mismatch_site = Website(
                organization_id=1,
                name="Pin Mismatch Site",
                url="https://mismatch.example.com",
                domain="mismatch.example.com",
                environment="Production",
                exposure="public",
                verified=True,
                verified_target="https://mismatch.example.com",
                verified_addresses='["1.2.3.4"]',
            )
            db.add_all([unverified_site, internal_site, pin_mismatch_site])
            db.commit()
            unverified_id = unverified_site.id
            internal_id = internal_site.id
            pin_id = pin_mismatch_site.id

        # 5b. Unverified -> 403 "Website ownership has not been verified."
        r_unverified = self.client.post("/scans", json={"website_id": unverified_id, "engine": "nmap"}, headers=self.headers1)
        self.assertEqual(r_unverified.status_code, 403)
        self.assertIn("not been verified", r_unverified.json()["detail"])

        # 5c. Internal (even if verified) -> 403 "Scanning is not available for internal assets."
        r_internal = self.client.post("/scans", json={"website_id": internal_id, "engine": "nmap"}, headers=self.headers1)
        self.assertEqual(r_internal.status_code, 403)
        self.assertIn("Scanning is not available for internal assets", r_internal.json()["detail"])

        # 5d. Pin mismatch -> 403 pin mismatch
        fake_dest = MagicMock()
        fake_dest.canonical_url = "https://mismatch.example.com/"
        fake_dest.addresses = ("9.9.9.9",)  # Different from ["1.2.3.4"]
        with patch("app.utils.destination.validate_destination", return_value=fake_dest):
            r_pin = self.client.post("/scans", json={"website_id": pin_id, "engine": "nmap"}, headers=self.headers1)
            self.assertEqual(r_pin.status_code, 403)
            self.assertIn("Website destination changed", r_pin.json()["detail"])

    # 6. Worker re-check: asset flipped to internal after enqueue
    def test_worker_recheck_asset_flipped_to_internal(self):
        with self.factory() as db:
            db.info["system_scope"] = True
            site = Website(
                organization_id=1,
                name="Flip Site",
                url="https://flip.example.com",
                domain="flip.example.com",
                environment="Production",
                exposure="internal",  # Flipped to internal
                verified=True,
                verified_target="https://flip.example.com",
                verified_addresses='["93.184.216.34"]',
            )
            db.add(site)
            db.flush()

            scan = Scan(
                organization_id=1,
                website_id=site.id,
                engine="nmap",
                status="Running",
                target=site.url,
                worker_id="worker-test-1",
            )
            db.add(scan)
            db.commit()
            scan_id = scan.id

        scanner = ScannerJobMixin()
        with patch("app.database.database.SessionLocal", self.factory):
            res_db, res_scan = scanner.begin_job(scan_id, worker_id="worker-test-1")
            self.assertIsNone(res_db)
            self.assertIsNone(res_scan)

            with self.factory() as db:
                db.info["system_scope"] = True
                scan_after = db.query(Scan).filter(Scan.id == scan_id).first()
                self.assertEqual(scan_after.status, "Failed")
                self.assertIn("Destination authorization or isolation validation failed", scan_after.error)

    # 7. Archive effects: list excludes, detail 404, history readable, telemetry key 401, scan 404
    def test_archive_effects_comprehensive(self):
        # Create an asset with an integration, an alert, and an incident
        with self.factory() as db:
            db.info["system_scope"] = True
            site = Website(
                organization_id=1,
                name="To Archive",
                url="https://toarchive.example.com",
                domain="toarchive.example.com",
                environment="Production",
                exposure="public",
                verified=True,
            )
            db.add(site)
            db.flush()

            integ = Integration(
                organization_id=1,
                website_id=site.id,
                status="Connected",
                api_key_hash=hash_api_key("test_api_key_12345"),
                api_secret_hash="secret_hash",
            )
            db.add(integ)
            db.flush()

            alert = Alert(
                organization_id=1,
                website_id=site.id,
                ip_address="198.51.100.1",
                threat_level="HIGH",
                message="Alert on site",
            )
            db.add(alert)
            db.flush()

            incident = Incident(
                organization_id=1,
                website_id=site.id,
                alert_id=alert.id,
                incident_code="INC-TEST-001",
                title="Test Incident on Site",
                description="Test description",
                threat_level="HIGH",
                priority="High",
                status="Investigating",
                source_ip="198.51.100.1",
                target="https://toarchive.example.com",
                confidence=90,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(incident)
            db.commit()
            site_id = site.id
            alert_id = alert.id
            incident_id = incident.id

        # 7a. Telemetry ingestion before archive works
        r_log_before = self.client.post("/logs", json={
            "ip_address": "1.2.3.4",
            "method": "GET",
            "url": "/login",
            "status_code": 200,
            "user_agent": "Mozilla/5.0",
            "message": "OK"
        }, headers={"X-API-Key": "test_api_key_12345"})
        self.assertEqual(r_log_before.status_code, 201)

        # Archive the site via DELETE /websites/{id}
        del_res = self.client.delete(f"/websites/{site_id}", headers=self.headers1)
        self.assertEqual(del_res.status_code, 200)

        # 7b. GET /websites list excludes it
        list_res = self.client.get("/websites", headers=self.headers1)
        self.assertEqual(list_res.status_code, 200)
        items = list_res.json()["items"] if isinstance(list_res.json(), dict) and "items" in list_res.json() else list_res.json()
        self.assertFalse(any(s["id"] == site_id for s in items))

        # 7c. GET /websites/{id} returns 404
        get_res = self.client.get(f"/websites/{site_id}", headers=self.headers1)
        self.assertEqual(get_res.status_code, 404)

        # 7d. POST /scans on archived asset returns 404
        scan_res = self.client.post("/scans", json={"website_id": site_id, "engine": "nmap"}, headers=self.headers1)
        self.assertEqual(scan_res.status_code, 404)

        # 7e. Ingestion with its key returns 401
        r_log_after = self.client.post("/logs", json={
            "ip_address": "1.2.3.4",
            "method": "GET",
            "url": "/login",
            "status_code": 200,
            "user_agent": "Mozilla/5.0",
            "message": "OK"
        }, headers={"X-API-Key": "test_api_key_12345"})
        self.assertEqual(r_log_after.status_code, 401)

        # 7f. History stays readable: alerts and incidents still exist
        alerts_res = self.client.get("/alerts", headers=self.headers1)
        self.assertEqual(alerts_res.status_code, 200)
        alert_items = alerts_res.json() if isinstance(alerts_res.json(), list) else alerts_res.json().get("items", [])
        self.assertTrue(any(a["id"] == alert_id for a in alert_items))

        incidents_res = self.client.get("/incidents", headers=self.headers1)
        self.assertEqual(incidents_res.status_code, 200)
        incident_items = incidents_res.json() if isinstance(incidents_res.json(), list) else incidents_res.json().get("items", [])
        self.assertTrue(any(i["id"] == incident_id for i in incident_items))

    # 8. Migration upgrade & downgrade guard
    def test_migration_upgrade_and_downgrade_guard(self):
        # On a fresh engine, run migrations
        mig_engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        migrate(mig_engine)

        with mig_engine.connect() as conn:
            # Insert two organizations with required timestamps
            conn.execute(text("INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (1, 'Org1', 'org-1', datetime('now'), datetime('now')), (2, 'Org2', 'org-2', datetime('now'), datetime('now'))"))
            # Insert duplicate URL across orgs
            conn.execute(text("INSERT INTO websites (id, organization_id, name, url, domain, environment, exposure, verified, created_at, updated_at) VALUES (1, 1, 'Site 1', 'https://dup.com', 'dup.com', 'Production', 'public', 0, datetime('now'), datetime('now'))"))
            conn.execute(text("INSERT INTO websites (id, organization_id, name, url, domain, environment, exposure, verified, created_at, updated_at) VALUES (2, 2, 'Site 2', 'https://dup.com', 'dup.com', 'Production', 'public', 0, datetime('now'), datetime('now'))"))
            conn.commit()

        # Attempting downgrade_phase1 must abort because duplicate URLs exist
        with self.assertRaises((SchemaMismatchError, ValueError)) as ctx:
            downgrade_phase1(mig_engine)
        self.assertIn("duplicate URLs exist across organizations", str(ctx.exception))

        # Remove duplicate and try downgrade again -> succeeds
        with mig_engine.connect() as conn:
            conn.execute(text("DELETE FROM websites WHERE id = 2"))
            conn.commit()

        downgrade_phase1(mig_engine)
        mig_engine.dispose()

    # 9. Production guard: loopback auto-verify disabled in production
    def test_production_guard_loopback_auto_verify_disabled(self):
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            # Attempt to register loopback target in production
            res = self.client.post("/websites", json={
                "name": "Prod Local App",
                "url": "http://localhost:3000",
                "environment": "Production"
            }, headers=self.headers1)
            # In production, either validate_destination rejects loopback or local auto-verify is disabled
            if res.status_code == 201:
                self.assertFalse(res.json()["verified"])
            else:
                self.assertIn(res.status_code, (400, 422))
