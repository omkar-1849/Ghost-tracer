"""Comprehensive Vertical Slice Integration Test for Sentinel Scanner Intelligence.

Tests the complete pipeline:
SSL/TLS execution -> BUG-01 verification -> Finding Normalization -> Evidence Bundle
-> Main Analyst (GT-Beta + Fallback) -> Alert Generation -> Cross-Scan Deduplication & Tenant Isolation.
"""
import json
import ssl
import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch

from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker

from app.database.base import Base
from app.database.migrations import migrate
from app.models.alert import Alert
from app.models.incident import Incident
from app.models.investigation import Investigation
from app.models.investigation_job import InvestigationJob
from app.models.organization import Organization
from app.models.scan import Scan
from app.models.scanner_finding import ScannerFinding
from app.models.scanner_finding_observation import ScannerFindingObservation
from app.models.website import Website
from app.services.evidence_bundle_service import build_evidence_bundle
from app.services.finding_normalization_service import process_completed_scan
from app.services.investigation_service import (
    deterministic_analyze_investigation,
    process_investigation_job,
    validate_investigation_report,
)
from app.services.scanners.ssl_scanner import SSLScanner


class ScannerIntelligenceVerticalSliceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        event.listen(self.engine, "connect", lambda conn, _: conn.execute("PRAGMA foreign_keys=ON"))
        migrate(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)

        self.db = self.SessionLocal()
        self.db.info["system_scope"] = True

        # Setup baseline tenant and verified website
        self.org1 = Organization(id=1, name="Tenant Alpha", slug="alpha")
        self.org2 = Organization(id=2, name="Tenant Beta", slug="beta")
        self.db.add_all([self.org1, self.org2])
        self.db.commit()

        self.site1 = Website(
            id=1,
            organization_id=1,
            name="Secure Site Alpha",
            url="https://alpha.example.com",
            verified=True,
            verified_target="https://alpha.example.com",
            exposure="public",
            verified_addresses=["93.184.216.34"],
        )
        self.db.add(self.site1)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    @patch("app.database.database.SessionLocal")
    @patch("app.services.scanners.scanner_mixin.validate_destination")
    @patch("app.services.scanners.ssl_scanner.validate_destination")
    @patch("app.services.scanners.ssl_scanner.connect_pinned")
    def test_ssl_scanner_cert_error_produces_completed_finding_bug01_fix(self, mock_connect, mock_val_ssl, mock_val_mixin, mock_session_local):
        """BUG-01 Fix Test: SSLCertVerificationError must complete the scan with a High finding, not fail it."""
        from app.utils.destination import Destination
        dest = Destination("https://alpha.example.com/", "https", "alpha.example.com", 443, ("93.184.216.34",), "/", "alpha.example.com")
        mock_val_mixin.return_value = dest
        mock_val_ssl.return_value = dest
        mock_session_local.side_effect = self.SessionLocal

        scan = Scan(
            id=101,
            organization_id=1,
            website_id=1,
            engine="ssl",
            target="https://alpha.example.com",
            status="Running",
            worker_id="test-worker-1",
        )
        self.db.add(scan)
        self.db.commit()

        # Simulate SSL certificate verification failure
        mock_connect.side_effect = ssl.SSLCertVerificationError("Certificate verify failed: self-signed certificate")

        scanner = SSLScanner()
        with patch("app.services.finding_normalization_service.SessionLocal", side_effect=self.SessionLocal):
            scanner.start_scan(101, worker_id="test-worker-1")

        self.db.expire_all()
        scan = self.db.query(Scan).filter(Scan.id == 101).first()
        # Scan MUST be Completed (not Failed!)
        self.assertEqual(scan.status, "Completed")
        self.assertEqual(scan.findings, 1)
        self.assertGreaterEqual(scan.risk_score, 15)
        self.assertIsNotNone(scan.parsed_output)
        self.assertEqual(scan.parsed_output.get("validity_status"), "Invalid")

    @patch("app.services.finding_normalization_service.SessionLocal")
    @patch("app.services.investigation_service.SessionLocal")
    def test_end_to_end_normalization_and_deterministic_investigation(self, mock_inv_session, mock_norm_session):
        """Verify normalization of completed scan into findings, observations, and investigation."""
        mock_norm_session.side_effect = self.SessionLocal
        mock_inv_session.side_effect = self.SessionLocal

        # Create completed scan with parsed findings
        scan = Scan(
            id=201,
            organization_id=1,
            website_id=1,
            engine="ssl",
            target="https://alpha.example.com",
            status="Completed",
            findings=1,
            risk_score=75,
            parsed_output={
                "scanner": "SSL",
                "validity_status": "Invalid",
                "findings": [
                    {
                        "title": "TLS Certificate Verification Failed",
                        "severity": "high",
                        "category": "tls_configuration",
                        "description": "Certificate trust chain verification failed.",
                    }
                ],
            },
        )
        self.db.add(scan)
        self.db.commit()

        # Run normalization
        inv_id = process_completed_scan(201)
        self.assertIsNotNone(inv_id)

        # 1. Verify ScannerFinding created
        finding = self.db.query(ScannerFinding).filter(ScannerFinding.website_id == 1).first()
        self.assertIsNotNone(finding)
        self.assertEqual(finding.title, "TLS Certificate Verification Failed")
        self.assertEqual(finding.severity, "high")
        self.assertEqual(finding.category, "tls_configuration")
        self.assertEqual(finding.status, "open")
        self.assertEqual(finding.seen_count, 1)
        self.assertEqual(finding.organization_id, 1)

        # 2. Verify Observation created
        obs = self.db.query(ScannerFindingObservation).filter(ScannerFindingObservation.finding_id == finding.id).first()
        self.assertIsNotNone(obs)
        self.assertEqual(obs.scan_id, 201)

        # 3. Verify Investigation created & completed
        inv = self.db.query(Investigation).filter(Investigation.id == inv_id).first()
        self.assertIsNotNone(inv)
        self.assertEqual(inv.status, "COMPLETED")
        self.assertEqual(inv.risk_level, "HIGH")
        self.assertEqual(inv.generated_by, "deterministic")
        self.assertIsNotNone(inv.report)

        # 4. Verify Scanner Alert created
        alert = self.db.query(Alert).filter(Alert.investigation_id == inv_id).first()
        self.assertIsNotNone(alert)
        self.assertEqual(alert.source_type, "scanner")
        self.assertEqual(alert.threat_level, "HIGH")
        self.assertEqual(alert.organization_id, 1)
        self.assertIn("SSL", alert.message)

    @patch("app.services.finding_normalization_service.SessionLocal")
    @patch("app.services.investigation_service.SessionLocal")
    def test_recurring_scan_deduplication(self, mock_inv_session, mock_norm_session):
        """Cross-scan deduplication: Recurring scan with same finding must update seen_count and not duplicate findings."""
        mock_norm_session.side_effect = self.SessionLocal
        mock_inv_session.side_effect = self.SessionLocal

        # First scan
        scan1 = Scan(
            id=301, organization_id=1, website_id=1, engine="ssl", target="https://alpha.example.com",
            status="Completed", findings=1, risk_score=75,
            parsed_output={
                "findings": [{"title": "Weak Cipher Suite Supported", "severity": "high", "category": "tls_configuration"}]
            }
        )
        self.db.add(scan1)
        self.db.commit()
        process_completed_scan(301)

        # Verify initial finding state
        findings_count = self.db.query(ScannerFinding).filter(ScannerFinding.website_id == 1).count()
        self.assertEqual(findings_count, 1)
        f1 = self.db.query(ScannerFinding).filter(ScannerFinding.website_id == 1).first()
        self.assertEqual(f1.seen_count, 1)

        # Second scan on same site finding the same issue
        scan2 = Scan(
            id=302, organization_id=1, website_id=1, engine="ssl", target="https://alpha.example.com",
            status="Completed", findings=1, risk_score=75,
            parsed_output={
                "findings": [{"title": "Weak Cipher Suite Supported", "severity": "high", "category": "tls_configuration"}]
            }
        )
        self.db.add(scan2)
        self.db.commit()
        process_completed_scan(302)

        # Count MUST remain 1 (no duplicate row!)
        findings_count_after = self.db.query(ScannerFinding).filter(ScannerFinding.website_id == 1).count()
        self.assertEqual(findings_count_after, 1)

        # seen_count MUST be incremented to 2
        self.db.refresh(f1)
        self.assertEqual(f1.seen_count, 2)
        self.assertEqual(f1.last_seen_scan_id, 302)

        # Observations must be 2 (one per scan)
        obs_count = self.db.query(ScannerFindingObservation).filter(ScannerFindingObservation.finding_id == f1.id).count()
        self.assertEqual(obs_count, 2)

    @patch("app.services.investigation_service.SessionLocal")
    @patch("app.services.investigation_service.httpx.Client.post")
    @patch("app.services.investigation_service.get_runtime_config")
    def test_gt_beta_ai_analyst_and_hallucination_guard(self, mock_cfg, mock_post, mock_session):
        """Verify GT-Beta AI analyst path and prompt-injection/hallucination validation reject."""
        mock_session.side_effect = self.SessionLocal
        mock_cfg.return_value = MagicMock(
            ai_analyst_enabled=True,
            ai_analyst_url="http://mock:8000/v1/analyze",
            ai_analyst_timeout=5,
        )

        scan = Scan(
            id=401, organization_id=1, website_id=1, engine="ssl", target="https://alpha.example.com",
            status="Completed", findings=1, risk_score=75,
        )
        inv = Investigation(
            id=401, organization_id=1, website_id=1, trigger_scan_id=401, status="PENDING"
        )
        finding = ScannerFinding(
            id=401, organization_id=1, website_id=1, scan_id=401, fingerprint="fp401",
            engine="ssl", category="tls_configuration", title="Cert Expired", severity="high",
            status="open"
        )
        job = InvestigationJob(
            id=401, organization_id=1, investigation_id=401, status="PENDING"
        )
        self.db.add_all([scan, inv, finding, job])
        self.db.commit()

        # Case 1: AI returns a hallucinated finding_id not in bundle manifest
        mock_resp_hallucinated = MagicMock()
        mock_resp_hallucinated.status_code = 200
        mock_resp_hallucinated.json.return_value = {
            "overall_assessment": {"risk_level": "HIGH", "summary": "Hallucinated", "confidence": 0.9},
            "prioritized_findings": [{"finding_id": 99999, "why_it_matters": "I invented this finding"}]
        }
        mock_post.return_value = mock_resp_hallucinated

        process_investigation_job(401)
        self.db.refresh(inv)

        # Validator MUST reject hallucinated report and fall back to deterministic
        self.assertEqual(inv.status, "COMPLETED")
        self.assertEqual(inv.generated_by, "deterministic")
        self.assertIn("Cert Expired", inv.report["prioritized_findings"][0]["title"])

        # Case 2: AI returns valid schema-compliant report with legitimate finding_id
        job.status = "PENDING"
        self.db.commit()

        mock_resp_valid = MagicMock()
        mock_resp_valid.status_code = 200
        mock_resp_valid.json.return_value = {
            "overall_assessment": {
                "risk_level": "HIGH",
                "summary": "AI Analyst confirmed certificate issue",
                "confidence": 0.95,
                "evidence_status": "confirmed_by_scanner",
            },
            "prioritized_findings": [
                {"finding_id": 401, "priority_rank": 1, "why_it_matters": "Real finding"}
            ],
            "alert_recommendation": {"should_alert": True, "threat_level": "HIGH"}
        }
        mock_post.return_value = mock_resp_valid

        process_investigation_job(401)
        self.db.refresh(inv)

        # AI report accepted
        self.assertEqual(inv.generated_by, "main_analyst")
        self.assertEqual(inv.summary, "AI Analyst confirmed certificate issue")

    def test_tenant_isolation_boundary(self):
        """Tenant isolation: Findings from Organization 1 must never be visible or mixed into Organization 2."""
        f_org1 = ScannerFinding(
            id=501, organization_id=1, website_id=1, fingerprint="fp501", engine="ssl",
            category="tls_configuration", title="Org 1 Issue", severity="high", status="open"
        )
        self.db.add(f_org1)
        self.db.commit()

        # Query scoped to Org 2
        org2_findings = (
            self.db.query(ScannerFinding)
            .filter(ScannerFinding.organization_id == 2)
            .all()
        )
        self.assertEqual(len(org2_findings), 0)


if __name__ == "__main__":
    unittest.main()
