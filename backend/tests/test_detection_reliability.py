"""Test suite for Phase 3.2 detection reliability improvements, IDOR detection, URL query decoding, and alert deduplication."""

import unittest
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import importlib
import pkgutil
import app.models as model_package
for module in pkgutil.iter_modules(model_package.__path__, "app.models."):
    importlib.import_module(module.name)

from app.database.base import Base
from app.database.database import TenantSession
from app.models.organization import Organization
from app.models.website import Website
from app.models.log import Log
from app.models.alert import Alert
from app.models.incident import Incident
from app.models.incident_evidence import IncidentEvidence
from app.models.incident_timeline import IncidentTimeline
from app.schemas.log_schema import LogCreate
from app.services.risk_service import calculate_risk
from app.services.log_service import create_log
from app.services.alert_service import create_alert, find_correlated_incident


class URLQueryDecodingTests(unittest.TestCase):
    """Test URL parsing and query-aware decoding behavior."""

    def test_form_encoded_plus_sql_injection(self):
        """Query containing union+select is query-decoded and recognized as SQL injection."""
        log = {
            "method": "GET",
            "url": "/api/search?q=Options+union+select",
            "status_code": 200,
        }
        risk = calculate_risk(log)
        self.assertEqual(risk["risk_score"], 50)
        self.assertEqual(risk["threat_level"], "HIGH")
        self.assertIn("Possible SQL Injection", risk["reasons"])

    def test_percent_encoded_space_sql_injection(self):
        """Query containing union%20select is recognized as SQL injection."""
        log = {
            "method": "GET",
            "url": "/api/search?q=Options%20union%20select",
            "status_code": 200,
        }
        risk = calculate_risk(log)
        self.assertEqual(risk["risk_score"], 50)
        self.assertEqual(risk["threat_level"], "HIGH")
        self.assertIn("Possible SQL Injection", risk["reasons"])

    def test_encoded_xss_query(self):
        """Percent-encoded XSS payload in query string is correctly decoded and recognized."""
        log = {
            "method": "GET",
            "url": "/api/search?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E",
            "status_code": 200,
        }
        risk = calculate_risk(log)
        self.assertEqual(risk["risk_score"], 40)
        self.assertEqual(risk["threat_level"], "MEDIUM")
        self.assertIn("Possible XSS Attack", risk["reasons"])

    def test_literal_plus_in_path_preserved(self):
        """Plus sign in URL path is treated literally and not corrupted into a space."""
        log = {
            "method": "GET",
            "url": "/tags/c++_programming?q=tutorial+guide",
            "status_code": 200,
        }
        risk = calculate_risk(log)
        self.assertEqual(risk["risk_score"], 0)
        self.assertEqual(risk["threat_level"], "LOW")
        self.assertEqual(len(risk["reasons"]), 0)

    def test_benign_queries_no_false_positives(self):
        """Standard benign queries produce zero risk."""
        for path in (
            "/api/search?q=Options+Trading",
            "/articles?category=finance&sort=date+desc",
            "/api/me",
            "/dashboard?tab=overview",
        ):
            with self.subTest(path=path):
                risk = calculate_risk({"method": "GET", "url": path, "status_code": 200})
                self.assertEqual(risk["risk_score"], 0)
                self.assertEqual(risk["threat_level"], "LOW")


class IDORDetectionTests(unittest.TestCase):
    """Test recognition of canonical authorization mismatch events and negative controls."""

    def test_canonical_idor_security_event_recognized(self):
        """A canonical allowlisted IDOR event in structured security format triggers IDOR detection."""
        log = {
            "method": "GET",
            "url": "/api/profile",
            "status_code": 403,
            "event": "SECURITY [HIGH] IDOR_OBJECT_AUTHORIZATION_MISMATCH at /api/profile: Authenticated user ID 1 attempted unauthorized access to profile of user ID 2",
        }
        risk = calculate_risk(log)
        # IDOR (50) + HTTP_403 (15) = 65 -> HIGH
        self.assertEqual(risk["risk_score"], 65)
        self.assertEqual(risk["threat_level"], "HIGH")
        self.assertIn("Object-Level Authorization Violation (IDOR/BOLA)", risk["reasons"])
        self.assertIn("HTTP 403 Forbidden", risk["reasons"])

    def test_negative_arbitrary_message_containing_word_idor_rejected(self):
        """An arbitrary message or user discussion containing 'idor' does NOT trigger IDOR rule."""
        log = {
            "method": "GET",
            "url": "/api/contact",
            "status_code": 200,
            "event": "User submitted question about IDOR vulnerability testing in support forum",
        }
        risk = calculate_risk(log)
        self.assertEqual(risk["risk_score"], 0)
        self.assertEqual(risk["threat_level"], "LOW")
        self.assertNotIn("Object-Level Authorization Violation (IDOR/BOLA)", risk["reasons"])

    def test_negative_url_query_containing_idor_rejected(self):
        """A search query or URL path containing the string 'idor' does NOT trigger IDOR rule."""
        log = {
            "method": "GET",
            "url": "/api/search?q=what+is+idor+security+flaw",
            "status_code": 200,
            "event": "GET /api/search?q=what+is+idor+security+flaw -> 200",
        }
        risk = calculate_risk(log)
        self.assertEqual(risk["risk_score"], 0)
        self.assertEqual(risk["threat_level"], "LOW")
        self.assertNotIn("Object-Level Authorization Violation (IDOR/BOLA)", risk["reasons"])

    def test_negative_client_severity_claim_ignored(self):
        """A client payload claiming 'severity': 'CRITICAL' is ignored by server-authoritative scoring."""
        log = {
            "method": "GET",
            "url": "/api/profile",
            "status_code": 200,
            "severity": "CRITICAL",
            "risk_score": 99,
            "confidence": 100,
        }
        risk = calculate_risk(log)
        self.assertEqual(risk["risk_score"], 0)
        self.assertEqual(risk["threat_level"], "LOW")

    def test_ordinary_403_without_security_event_scores_low(self):
        """An ordinary HTTP 403 without a canonical security event scores only 15 and does not alert."""
        log = {
            "method": "GET",
            "url": "/api/private-page",
            "status_code": 403,
            "event": "GET /api/private-page -> 403",
        }
        risk = calculate_risk(log)
        self.assertEqual(risk["risk_score"], 15)
        self.assertEqual(risk["threat_level"], "LOW")
        self.assertIn("HTTP 403 Forbidden", risk["reasons"])
        self.assertNotIn("Object-Level Authorization Violation (IDOR/BOLA)", risk["reasons"])


class AlertDeduplicationTests(unittest.TestCase):
    """Test cross-source alert and incident deduplication, evidence retention, and separation."""

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
        self.db = self.SessionLocal()
        self.db.info["system_scope"] = True
        self.db.info["organization_id"] = 1

        self.org = Organization(id=1, name="Primary Tenant", slug="primary-tenant")
        self.org2 = Organization(id=2, name="Secondary Tenant", slug="sec-tenant")
        self.site1 = Website(id=1, organization_id=1, name="Site 1", url="http://127.0.0.1:8001", domain="127.0.0.1:8001")
        self.site2 = Website(id=2, organization_id=2, name="Site 2", url="http://127.0.0.1:8002", domain="127.0.0.1:8002")
        self.db.add_all([self.org, self.org2, self.site1, self.site2])
        self.db.flush()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_duplicate_cross_source_logs_produce_single_incident(self):
        """Two log records from different sources for the same underlying request produce only 1 incident."""
        # Source 1: security.log entry
        log1 = LogCreate(
            ip_address="127.0.0.1",
            method="GET",
            url="/api/search",
            status_code=400,
            user_agent="Zerodha-Security/1.0",
            message="SECURITY [HIGH] SEARCH_SQL_INJECTION_DETECTED at /api/search: Suspicious signature: union select",
        )
        db_log1 = create_log(self.db, log1, website_id=1)

        # Verify initial incident created
        incidents = self.db.query(Incident).filter(Incident.organization_id == 1).all()
        alerts = self.db.query(Alert).filter(Alert.organization_id == 1).all()
        self.assertEqual(len(incidents), 1)
        self.assertEqual(len(alerts), 1)
        first_inc_id = incidents[0].id

        # Source 2: application.log access entry for the same HTTP transaction
        log2 = LogCreate(
            ip_address="127.0.0.1",
            method="GET",
            url="/api/search?q=Options%20union%20select",
            status_code=200,
            user_agent="Zerodha-App",
            message="HTTP GET /api/search?q=Options%20union%20select -> 200",
        )
        db_log2 = create_log(self.db, log2, website_id=1)

        # Verify both logs are preserved in logs table
        all_logs = self.db.query(Log).filter(Log.organization_id == 1).all()
        self.assertEqual(len(all_logs), 2)

        # Verify deduplication: still exactly 1 incident and 1 alert in DB
        incidents_after = self.db.query(Incident).filter(Incident.organization_id == 1).all()
        alerts_after = self.db.query(Alert).filter(Alert.organization_id == 1).all()
        self.assertEqual(len(incidents_after), 1)
        self.assertEqual(len(alerts_after), 1)
        self.assertEqual(incidents_after[0].id, first_inc_id)

        # Verify correlated log evidence was attached to the existing incident
        evidence = self.db.query(IncidentEvidence).filter(IncidentEvidence.incident_id == first_inc_id).all()
        correlated_evidence = [e for e in evidence if f"correlated_log_{db_log2.id}" in e.filename]
        self.assertEqual(len(correlated_evidence), 1)
        self.assertEqual(correlated_evidence[0].url, db_log2.url)

    def test_separate_endpoints_produce_separate_incidents(self):
        """Attacks targeting different endpoints produce distinct incidents."""
        log1 = LogCreate(
            ip_address="127.0.0.1",
            method="GET",
            url="/api/search?q=union%20select",
            status_code=200,
            user_agent="Tester",
            message="Search request",
        )
        create_log(self.db, log1, website_id=1)

        log2 = LogCreate(
            ip_address="127.0.0.1",
            method="POST",
            url="/api/login",
            status_code=401,
            user_agent="Tester",
            message="SECURITY [HIGH] IDOR_OBJECT_AUTHORIZATION_MISMATCH at /api/login: Auth violation",
        )
        create_log(self.db, log2, website_id=1)

        incidents = self.db.query(Incident).filter(Incident.organization_id == 1).all()
        self.assertEqual(len(incidents), 2)

    def test_different_ips_produce_separate_incidents(self):
        """Attacks from different IPs produce distinct incidents."""
        log1 = LogCreate(
            ip_address="10.0.0.1",
            method="GET",
            url="/api/search?q=union%20select",
            status_code=200,
            user_agent="Tester",
            message="Attack from IP 1",
        )
        create_log(self.db, log1, website_id=1)

        log2 = LogCreate(
            ip_address="10.0.0.2",
            method="GET",
            url="/api/search?q=union%20select",
            status_code=200,
            user_agent="Tester",
            message="Attack from IP 2",
        )
        create_log(self.db, log2, website_id=1)

        incidents = self.db.query(Incident).filter(Incident.organization_id == 1).all()
        self.assertEqual(len(incidents), 2)

    def test_tenant_isolation_in_deduplication(self):
        """Identical attacks across different tenants do NOT deduplicate against each other."""
        # Tenant 1
        log1 = LogCreate(
            ip_address="127.0.0.1",
            method="GET",
            url="/api/search?q=union%20select",
            status_code=200,
            user_agent="Tester",
            message="Tenant 1 query",
        )
        create_log(self.db, log1, website_id=1)

        # Tenant 2
        self.db.info["organization_id"] = 2
        log2 = LogCreate(
            ip_address="127.0.0.1",
            method="GET",
            url="/api/search?q=union%20select",
            status_code=200,
            user_agent="Tester",
            message="Tenant 2 query",
        )
        create_log(self.db, log2, website_id=2)

        # Each tenant must have its own incident
        incidents_t1 = self.db.query(Incident).filter(Incident.organization_id == 1).all()
        incidents_t2 = self.db.query(Incident).filter(Incident.organization_id == 2).all()
        self.assertEqual(len(incidents_t1), 1)
        self.assertEqual(len(incidents_t2), 1)

    def test_repeated_attempts_outside_window_produce_new_incidents(self):
        """A repeated attempt after the correlation window expires produces a new incident."""
        log1 = LogCreate(
            ip_address="127.0.0.1",
            method="GET",
            url="/api/search?q=union%20select",
            status_code=200,
            user_agent="Tester",
            message="Attack at t=0",
        )
        create_log(self.db, log1, website_id=1)

        # Artificially age the existing alert outside the 10-second correlation window
        alert = self.db.query(Alert).filter(Alert.organization_id == 1).first()
        alert.created_at = datetime.utcnow() - timedelta(seconds=15)
        self.db.flush()

        # Same attack repeated at t=15s
        log2 = LogCreate(
            ip_address="127.0.0.1",
            method="GET",
            url="/api/search?q=union%20select",
            status_code=200,
            user_agent="Tester",
            message="Attack at t=15s",
        )
        create_log(self.db, log2, website_id=1)

        incidents = self.db.query(Incident).filter(Incident.organization_id == 1).all()
        self.assertEqual(len(incidents), 2)


if __name__ == "__main__":
    unittest.main()
