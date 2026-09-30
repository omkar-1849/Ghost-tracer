"""Run with explicit ENVIRONMENT=test DATABASE_URL=sqlite:///:memory: JWT_SECRET.
No production database, scanners or network are used.
"""
import importlib
import pkgutil
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

import app.models as model_package
from sqlalchemy import create_engine, event as sa_event
from sqlalchemy.orm import sessionmaker
from app.database.base import Base
from app.database.database import TenantSession
from app.models.organization import Organization
from app.models.website import Website
from app.models.integration import Integration
from app.models.event import Event
from app.models.log import Log
from app.models.alert import Alert
from app.models.incident import Incident
from app.models.incident_evidence import IncidentEvidence
from app.models.incident_timeline import IncidentTimeline
from app.models.audit_log import AuditLog
from app.models.response_action import ResponseAction
from app.schemas.event_schema import EventCreate
from app.schemas.log_schema import LogCreate
from app.services.event_service import create_event
from app.services.log_service import create_log
from app.services.behavior_service import count_recent_auth_failures
from app.services.normalization_service import normalize_event
from app.middleware.api_key_auth import verify_api_key, hash_api_key
from fastapi import HTTPException
from pydantic import ValidationError

for module in pkgutil.iter_modules(model_package.__path__, "app.models."):
    importlib.import_module(module.name)


class EventPipelineTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.factory = sessionmaker(bind=self.engine, class_=TenantSession, expire_on_commit=False, autoflush=False)
        self.db = self.factory()
        self.db.info["system_scope"] = True
        self.db.add_all([Organization(id=1, name="One", slug="one"), Organization(id=2, name="Two", slug="two")])
        self.db.flush()
        self.db.add_all([Website(id=i, organization_id=i, name=f"Site {i}", url=f"https://example{i}.test", domain=f"example{i}.test") for i in (1, 2)])
        self.db.flush()
        self.db.add_all([Integration(id=i, organization_id=i, website_id=i, status="Connected",
                                     api_key_hash=hash_api_key(f"test-key-{i}-0123456789"), api_secret_hash="unused") for i in (1, 2)])
        self.db.commit()
        self.db.info.update(system_scope=False, organization_id=1)
        self.integration = self.db.query(Integration).filter(Integration.id == 1).one()
        self.db.commit = lambda: self.fail("Service attempted commit")

    def tearDown(self):
        self.db.rollback()
        self.db.close()
        self.engine.dispose()

    def payload(self, **overrides):
        data = {"event_type": "request", "source": "sdk", "title": "request", "ip_address": "203.0.113.5"}
        data.update(overrides)
        return EventCreate(**data)

    def test_alias_bounds_normalization_and_overrides(self):
        e = self.payload(metadata={"url": "https://EXAMPLE.test/login", "method": "post", "status_code": "401"})
        n = normalize_event(e.model_dump())
        self.assertEqual((n.url, n.method, n.status_code), ("https://example.test/login", "POST", 401))
        for override in ({"metadata": {}, "event_metadata": {"x": 1}}, {"metadata": {"x": "z" * 4097}},
                         {"metadata": {"x": float("nan")}}, {"risk_score": 100}, {"metadata": {"a": [[[[[[[1]]]]]]]}}):
            with self.subTest(override=override), self.assertRaises(ValidationError):
                self.payload(**override)
        result = create_event(self.db, self.integration, self.payload(severity="Critical", metadata={"attempts": 999, "risk_score": 100, "confidence": 1}))
        self.assertEqual(result.risk_score, 0)
        self.assertEqual(self.db.query(Alert).count(), 0)
        self.assertFalse(result.detection_result["provenance"]["source_ip_trusted"])

    def test_dedup_actual_match_metadata_and_expiry(self):
        first = create_event(self.db, self.integration, self.payload(metadata={"url": "/a"}))
        second = create_event(self.db, self.integration, self.payload(metadata={"url": "/b"}))
        self.assertNotEqual(first.id, second.id)
        self.assertEqual(create_event(self.db, self.integration, self.payload(metadata={"url": "/a"})).id, first.id)
        first.created_at = datetime.utcnow() - timedelta(seconds=61)
        self.db.flush()
        self.assertNotEqual(create_event(self.db, self.integration, self.payload(metadata={"url": "/a"})).id, first.id)

    def test_graph_and_rollback_no_actions(self):
        result = create_event(self.db, self.integration, self.payload(title="union select", metadata={"url": "/admin"}))
        self.assertGreaterEqual(result.risk_score, 50)
        for model in (Event, Alert, Incident, IncidentEvidence, IncidentTimeline, AuditLog):
            self.assertGreater(self.db.query(model).count(), 0)
        self.assertEqual(self.db.query(ResponseAction).count(), 0)
        self.db.rollback()
        for model in (Event, Alert, Incident, IncidentEvidence, IncidentTimeline, AuditLog):
            self.assertEqual(self.db.query(model).count(), 0)

    def test_audit_failure_rolls_back_whole_graph(self):
        def fail_audit(db, _context, _instances):
            if any(isinstance(row, AuditLog) for row in db.new):
                raise RuntimeError("audit failure")
        sa_event.listen(self.db, "before_flush", fail_audit)
        try:
            with self.assertRaises(RuntimeError):
                create_event(self.db, self.integration, self.payload(title="union select"))
            self.db.rollback()
        finally:
            sa_event.remove(self.db, "before_flush", fail_audit)
        for model in (Event, Alert, Incident, IncidentEvidence, IncidentTimeline, AuditLog):
            self.assertEqual(self.db.query(model).count(), 0)

    def test_benign_log_not_critical_history_scoped_and_capped(self):
        log = LogCreate(ip_address="203.0.113.5", method="GET", url="/", status_code=200, user_agent="Browser", message="ok")
        benign = create_log(self.db, log, website_id=1)
        self.assertEqual(benign.risk_score, 0)
        create_event(self.db, self.integration, self.payload())
        self.assertEqual(count_recent_auth_failures(self.db, log.ip_address, 1), 0)
        for i in range(5):
            create_event(self.db, self.integration, self.payload(event_type="login_failed", metadata={"sequence": i, "status_code": 401}))
        self.assertEqual(count_recent_auth_failures(self.db, log.ip_address, 1), 5)
        self.assertEqual(count_recent_auth_failures(self.db, log.ip_address, 2), 0)
        high = create_log(self.db, log.model_copy(update={"message": "union select <script ../ $( login_failed", "status_code": 401}), website_id=1)
        self.assertEqual(high.risk_score, 100)

    def test_key_bootstrap_tenant_and_revocation(self):
        self.db.info.pop("organization_id")
        integration = verify_api_key("test-key-2-0123456789", self.db)
        self.assertEqual(integration.organization_id, 2)
        self.assertEqual(self.db.info["organization_id"], 2)
        self.assertFalse(self.db.info["system_scope"])
        self.assertEqual(self.db.query(AuditLog).one().organization_id, 2)
        integration.status = "Revoked"
        self.db.flush()
        with self.assertRaises(HTTPException):
            verify_api_key("test-key-2-0123456789", self.db)
        self.assertFalse(self.db.info["system_scope"])

    def test_unsafe_normalized_fields_and_invalid_policy(self):
        from app.services.response_policy_service import validate_response_action
        n = normalize_event(self.payload(metadata={"url": "javascript:bad", "method": ["GET"], "status_code": True,
                                                   "ip_address": {"bad": "value"}, "user_agent": ["bad"]}).model_dump())
        self.assertIsNone(n.url)
        self.assertIsNone(n.method)
        self.assertIsNone(n.status_code)
        self.assertIsNone(n.user_agent)
        self.assertFalse(validate_response_action("BLOCK_IP", "203.0.113.5", float("nan"), "HIGH")["allowed"])

    def test_tenant_history_excludes_other_organization(self):
        create_event(self.db, self.integration, self.payload(event_type="login_failed"))
        self.db.info["organization_id"] = 2
        self.assertEqual(count_recent_auth_failures(self.db, "203.0.113.5", 1), 0)
        self.assertEqual(self.db.query(Event).count(), 0)
        with self.assertRaises(HTTPException):
            create_event(self.db, self.integration, self.payload())

    def test_sdk_emits_canonical_alias(self):
        from sdk.sentinel import Sentinel
        with patch("sdk.sentinel.requests.post") as post:
            Sentinel("test-key").log("title", "sdk", "request", event_metadata={"x": 1})
        self.assertEqual(post.call_args.kwargs["json"]["event_metadata"], {"x": 1})
        self.assertNotIn("metadata", post.call_args.kwargs["json"])


if __name__ == "__main__":
    unittest.main()
