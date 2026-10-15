"""Golden characterization test for Sentinel telemetry pipeline.

Pins the exact behavior of normalization -> dedup -> behavior -> detect -> risk -> alert -> incident -> evidence/timeline.
Must pass unchanged at the end of every phase.
"""
import importlib
import os
import pkgutil
import unittest
from datetime import datetime, timezone

import app.models as model_package
from sqlalchemy import create_engine
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
from app.schemas.event_schema import EventCreate
from app.schemas.log_schema import LogCreate
from app.services.event_service import create_event
from app.services.log_service import create_log
from app.middleware.api_key_auth import hash_api_key

# Ensure all models are loaded
for module in pkgutil.iter_modules(model_package.__path__, "app.models."):
    importlib.import_module(module.name)


class GoldenPipelineTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.factory = sessionmaker(
            bind=self.engine, class_=TenantSession, expire_on_commit=False, autoflush=False
        )
        self.db = self.factory()
        self.db.info["system_scope"] = True

        self.org = Organization(id=1, name="Acme Corp", slug="acme")
        self.db.add(self.org)
        self.db.flush()

        self.website = Website(
            id=1,
            organization_id=1,
            name="Acme Portal",
            url="https://portal.acme.test",
            domain="portal.acme.test",
        )
        self.db.add(self.website)
        self.db.flush()

        self.integration = Integration(
            id=1,
            organization_id=1,
            website_id=1,
            status="Connected",
            api_key_hash=hash_api_key("sk_test_api_key_golden_01234567"),
            api_secret_hash="unused",
        )
        self.db.add(self.integration)
        self.db.commit()

        # Switch to tenant context
        self.db.info["system_scope"] = False
        self.db.info["organization_id"] = 1

    def tearDown(self):
        self.db.close()

    def test_golden_pipeline_sequence(self):
        """Execute fixed sequence of logs and events, asserting exact deterministic pipeline behavior."""

        # 1. Clean traffic log
        clean_log_data = LogCreate(
            ip_address="198.51.100.1",
            method="GET",
            url="/",
            status_code=200,
            user_agent="Mozilla/5.0",
            message="GET / HTTP/1.1",
        )
        clean_log = create_log(self.db, clean_log_data, website_id=1)
        self.db.commit()

        self.assertEqual(clean_log.risk_score, 0)
        self.assertEqual(clean_log.threat_level, "LOW")
        self.assertEqual(self.db.query(Alert).count(), 0)
        self.assertEqual(self.db.query(Incident).count(), 0)

        # 2. SQL Injection event (High/Critical risk)
        sqli_event_data = EventCreate(
            event_type="suspicious_request",
            source="waf",
            title="SQL injection attempt",
            description="union select password from users",
            ip_address="198.51.100.2",
            user_agent="Mozilla/5.0",
            event_metadata={"url": "/admin?id=1' union select null"},
        )
        sqli_event = create_event(self.db, self.integration, sqli_event_data)
        self.db.commit()

        self.assertGreaterEqual(sqli_event.risk_score, 50)
        self.assertIn(sqli_event.threat_level, {"HIGH", "CRITICAL"})
        rules = [d["rule"] for d in sqli_event.detection_result["detections"]]
        self.assertIn("SQL_INJECTION_PATTERN", rules)

        # Alerts and incident creation
        alerts = self.db.query(Alert).filter(Alert.event_id == sqli_event.id).all()
        self.assertEqual(len(alerts), 1)
        alert = alerts[0]
        self.assertEqual(alert.threat_level, sqli_event.threat_level)

        incident = self.db.query(Incident).filter(Incident.alert_id == alert.id).first()
        self.assertIsNotNone(incident)

        evidence = self.db.query(IncidentEvidence).filter(IncidentEvidence.incident_id == incident.id).all()
        self.assertGreaterEqual(len(evidence), 1)

        timeline = self.db.query(IncidentTimeline).filter(IncidentTimeline.incident_id == incident.id).all()
        self.assertGreaterEqual(len(timeline), 1)

        # 3. XSS event
        xss_event_data = EventCreate(
            event_type="suspicious_request",
            source="waf",
            title="XSS payload detected",
            description="attempted payload <script>alert(1)</script>",
            ip_address="198.51.100.3",
            user_agent="Mozilla/5.0",
            event_metadata={"url": "/search?q=<script>alert(1)</script>"},
        )
        xss_event = create_event(self.db, self.integration, xss_event_data)
        self.db.commit()
        xss_rules = [d["rule"] for d in xss_event.detection_result["detections"]]
        self.assertIn("XSS_PATTERN", xss_rules)

        # 4. Path traversal event
        pt_event_data = EventCreate(
            event_type="suspicious_request",
            source="waf",
            title="Path traversal attempt",
            description="access to /etc/passwd",
            ip_address="198.51.100.4",
            user_agent="Mozilla/5.0",
            event_metadata={"url": "/download?file=../../../../etc/passwd"},
        )
        pt_event = create_event(self.db, self.integration, pt_event_data)
        self.db.commit()
        pt_rules = [d["rule"] for d in pt_event.detection_result["detections"]]
        self.assertIn("PATH_TRAVERSAL_PATTERN", pt_rules)

        # 5. Command injection event
        cmdi_event_data = EventCreate(
            event_type="suspicious_request",
            source="waf",
            title="Command injection attempt",
            description="executing shell commands",
            ip_address="198.51.100.5",
            user_agent="Mozilla/5.0",
            event_metadata={"url": "/ping?ip=127.0.0.1;`id`"},
        )
        cmdi_event = create_event(self.db, self.integration, cmdi_event_data)
        self.db.commit()
        cmdi_rules = [d["rule"] for d in cmdi_event.detection_result["detections"]]
        self.assertIn("COMMAND_INJECTION_PATTERN", cmdi_rules)

        # 6. Brute force across 60s window (5 sequential failed logins from same IP)
        brute_ip = "198.51.100.6"
        for i in range(5):
            bf_event = create_event(
                self.db,
                self.integration,
                EventCreate(
                    event_type="login_failed",
                    source="auth",
                    title="Failed login",
                    description=f"Invalid credentials attempt {i+1}",
                    ip_address=brute_ip,
                    user_agent="Mozilla/5.0",
                    event_metadata={"attempt": i + 1, "username": f"user_{i}"},
                ),
            )
            self.db.commit()

        # On the 5th failure, attempts count >= 5, so REPEATED_AUTH_FAILURE should trigger
        last_bf_rules = [d["rule"] for d in bf_event.detection_result["detections"]]
        self.assertIn("REPEATED_AUTH_FAILURE", last_bf_rules)
        self.assertIn("AUTH_FAILURE_ACTIVITY", last_bf_rules)

        # 7. Duplicate event inside 60s window
        events_count_before = self.db.query(Event).count()
        alerts_count_before = self.db.query(Alert).count()

        # Re-send identical cmdi event within 60s window
        dup_event = create_event(self.db, self.integration, cmdi_event_data)
        self.db.commit()

        # Dedup suppresses the duplicate
        self.assertEqual(dup_event.id, cmdi_event.id)
        self.assertEqual(self.db.query(Event).count(), events_count_before)
        self.assertEqual(self.db.query(Alert).count(), alerts_count_before)


if __name__ == "__main__":
    unittest.main()
