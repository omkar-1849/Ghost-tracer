import unittest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.base import Base
from app.database.database import TenantSession
from app.models.organization import Organization
from app.models.website import Website
from app.models.integration import Integration
from app.models.event import Event
from app.models.alert import Alert
from app.schemas.event_schema import EventCreate
from app.services.event_service import create_event
from app.middleware.api_key_auth import hash_api_key
import importlib
import pkgutil
import app.models as model_package

for module in pkgutil.iter_modules(model_package.__path__, "app.models."):
    importlib.import_module(module.name)

class EventIdempotencyTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, class_=TenantSession, expire_on_commit=False, autoflush=False)
        self.db = self.Session()
        self.db.info["system_scope"] = True

        # Seed 2 organizations, websites, and integrations
        self.db.add_all([
            Organization(id=1, name="Org1", slug="org1"),
            Organization(id=2, name="Org2", slug="org2"),
        ])
        self.db.flush()
        self.db.add_all([
            Website(id=1, organization_id=1, name="Site1", url="https://site1.test", domain="site1.test"),
            Website(id=2, organization_id=2, name="Site2", url="https://site2.test", domain="site2.test"),
        ])
        self.db.flush()
        self.db.add_all([
            Integration(id=1, organization_id=1, website_id=1, status="Connected",
                        api_key_hash=hash_api_key("key-1-0123456789"), api_secret_hash="unused"),
            Integration(id=2, organization_id=2, website_id=2, status="Connected",
                        api_key_hash=hash_api_key("key-2-0123456789"), api_secret_hash="unused"),
        ])
        self.db.commit()

        self.db.info.update(system_scope=False, organization_id=1)
        self.integration1 = self.db.query(Integration).filter(Integration.id == 1).one()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_idempotent_replay_does_not_duplicate_event_or_alert(self):
        payload = EventCreate(
            event_type="test_event",
            severity="Critical",
            source="collector",
            title="union select sql injection",
            event_id="v1.stream01.100",
            ip_address="192.168.1.10",
        )
        first = create_event(self.db, self.integration1, payload)
        self.assertFalse(getattr(first, "_is_duplicate", False))
        self.assertEqual(first.client_event_id, "v1.stream01.100")
        self.assertEqual(self.db.query(Event).count(), 1)
        self.assertEqual(self.db.query(Alert).count(), 1)

        # Replay same event with identical event_id
        second = create_event(self.db, self.integration1, payload)
        self.assertTrue(getattr(second, "_is_duplicate", False))
        self.assertEqual(getattr(second, "_duplicate_kind", None), "replay")
        self.assertEqual(second.id, first.id)

        # Ensure no second event or alert was created
        self.assertEqual(self.db.query(Event).count(), 1)
        self.assertEqual(self.db.query(Alert).count(), 1)

    def test_cross_tenant_same_event_id_allowed(self):
        payload1 = EventCreate(
            event_type="test_event",
            severity="Low",
            source="collector",
            title="Access log",
            event_id="v1.shared_stream.500",
        )
        res1 = create_event(self.db, self.integration1, payload1)
        self.assertFalse(getattr(res1, "_is_duplicate", False))

        # Switch to Org 2
        self.db.info.update(organization_id=2)
        integration2 = self.db.query(Integration).filter(Integration.id == 2).one()

        payload2 = EventCreate(
            event_type="test_event",
            severity="Low",
            source="collector",
            title="Access log Org 2",
            event_id="v1.shared_stream.500",
        )
        res2 = create_event(self.db, integration2, payload2)
        self.assertFalse(getattr(res2, "_is_duplicate", False))
        self.assertNotEqual(res1.id, res2.id)

        # Query Org 2 sees only res2
        self.assertEqual(self.db.query(Event).count(), 1)

    def test_legacy_event_without_event_id_works_with_fingerprint_suppression(self):
        p1 = EventCreate(
            event_type="login_failed",
            severity="Medium",
            source="collector",
            title="Failed auth",
            ip_address="10.0.0.1",
        )
        res1 = create_event(self.db, self.integration1, p1)
        self.assertIsNone(res1.client_event_id)
        self.assertFalse(getattr(res1, "_is_duplicate", False))

        # Rapid succession within 60s -> fingerprint suppressed
        p2 = EventCreate(
            event_type="login_failed",
            severity="Medium",
            source="collector",
            title="Failed auth",
            ip_address="10.0.0.1",
        )
        res2 = create_event(self.db, self.integration1, p2)
        self.assertTrue(getattr(res2, "_is_duplicate", False))
        self.assertEqual(getattr(res2, "_duplicate_kind", None), "suppressed")
        self.assertEqual(res2.id, res1.id)


if __name__ == "__main__":
    unittest.main()
