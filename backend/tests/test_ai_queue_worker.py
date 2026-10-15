"""Tests for durable database-backed AI Analysis job queue and worker.

Covers:
- Job persistence during event ingestion
- CAS claiming and lease expiration/recovery
- Stale-writer fencing (lease token mismatch)
- Retry backoff, circuit breaker tripping, and terminal failure
- Non-retryable 4xx errors
- Tenant isolation during worker execution
"""
import importlib
import pkgutil
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

import app.models as model_package
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

for module in pkgutil.iter_modules(model_package.__path__, "app.models."):
    importlib.import_module(module.name)

from app.config.runtime import RuntimeConfig
from app.database.base import Base
from app.database.database import TenantSession
from app.models.organization import Organization
from app.models.website import Website
from app.models.integration import Integration
from app.models.event import Event
from app.models.ai_analysis_job import AiAnalysisJob
from app.schemas.event_schema import EventCreate
from app.services.event_service import create_event
from app.services import ai_worker


def get_test_config(**overrides):
    params = {
        "database_url": "sqlite:///:memory:",
        "jwt_secret": "test_secret_key_at_least_32_bytes_long_here",
        "environment": "test",
        "cors_origins": ("http://localhost:3000",),
        "ai_analyst_enabled": True,
        "ai_analyst_url": "http://gt-beta.test/analyze",
        "ai_analyst_timeout": 5,
        "ai_analyst_min_risk_score": 0,
        "ai_queue_max_pending": 5000,
        "ai_job_max_attempts": 3,
        "ai_job_lease_seconds": 30,
        "ai_job_backoff_seconds": "30,120,600",
        "ai_breaker_failures": 5,
        "ai_breaker_cooldown_seconds": 60,
    }
    params.update(overrides)
    return RuntimeConfig(**params)


class AiQueueWorkerTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.SessionFactory = sessionmaker(bind=self.engine, class_=TenantSession, expire_on_commit=False, autoflush=False)
        self.db = self.SessionFactory()
        self.db.info["system_scope"] = True

        # Reset worker globals
        ai_worker._circuit_breaker_failures = 0
        ai_worker._breaker_cooldown_until = None
        ai_worker._stop_event.clear()

        # Seed organizations, websites, integrations
        self.db.add_all([
            Organization(id=1, name="Acme", slug="acme"),
            Organization(id=2, name="Beta", slug="beta"),
        ])
        self.db.flush()

        self.db.add_all([
            Website(id=1, organization_id=1, name="Web", url="https://acme.test", domain="acme.test"),
            Website(id=2, organization_id=2, name="Web2", url="https://beta.test", domain="beta.test"),
        ])
        self.db.flush()

        self.integration1 = Integration(
            id=1,
            organization_id=1,
            website_id=1,
            name="Int1",
            status="Connected",
            api_key_hash="dummy_hash_1",
        )
        self.integration2 = Integration(
            id=2,
            organization_id=2,
            website_id=2,
            name="Int2",
            status="Connected",
            api_key_hash="dummy_hash_2",
        )
        self.db.add_all([self.integration1, self.integration2])
        self.db.commit()

        self.db.info.update(system_scope=False, organization_id=1)
        self.integration1 = self.db.query(Integration).filter(Integration.id == 1).one()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_job_created_atomically_with_event_when_ai_enabled(self):
        cfg = get_test_config(ai_analyst_enabled=True)
        with patch("app.services.event_service.get_runtime_config", return_value=cfg):
            payload = EventCreate(
                title="SQL injection probe",
                event_id="v1.stream1.100",
                event_type="sql_injection",
                severity="Critical",
                source="waf",
                ip_address="198.51.100.4",
            )
            created = create_event(self.db, self.integration1, payload)

            # Check event
            self.assertEqual(created.ai_status, "PENDING")
            self.assertIsNone(created.ai_completed_at)

            # Check job created
            job = self.db.query(AiAnalysisJob).filter(AiAnalysisJob.event_id == created.id).first()
            self.assertIsNotNone(job)
            self.assertEqual(job.status, "PENDING")
            self.assertEqual(job.organization_id, 1)
            self.assertGreaterEqual(job.priority, 0)
            self.assertIsNone(job.lease_token)

    def test_worker_cas_claim_and_successful_completion(self):
        cfg = get_test_config(ai_analyst_enabled=True)
        with patch("app.services.event_service.get_runtime_config", return_value=cfg):
            payload = EventCreate(
                title="Credential stuffing attempt",
                event_id="v1.stream1.101",
                event_type="credential_stuffing",
                severity="High",
                source="auth",
                ip_address="198.51.100.5",
            )
            created = create_event(self.db, self.integration1, payload)

        job = self.db.query(AiAnalysisJob).filter(AiAnalysisJob.event_id == created.id).first()
        self.assertEqual(job.status, "PENDING")

        mock_inference = {
            "decision": "BLOCK",
            "action_type": "ip_block",
            "target": "198.51.100.5",
            "confidence": 0.95,
            "threat_level": "CRITICAL",
            "reason": "Automated brute-force pattern matched",
            "recommended_actions": ["Block IP on firewall"],
        }

        with patch("app.services.ai_worker.get_runtime_config", return_value=cfg), \
             patch("app.services.ai_worker.SessionLocal", side_effect=self.SessionFactory), \
             patch("app.services.ai_worker._call_gt_beta_inference", return_value=(True, mock_inference, "OK")), \
             patch("app.services.ai_worker._stop_event.is_set", side_effect=[False, True]):
            ai_worker._ai_worker_loop()

        self.db.expire_all()
        job = self.db.query(AiAnalysisJob).filter(AiAnalysisJob.id == job.id).first()
        self.assertEqual(job.status, "SUCCEEDED")
        self.assertEqual(job.attempts, 1)
        self.assertIsNotNone(job.completed_at)

        event = self.db.query(Event).filter(Event.id == created.id).first()
        self.assertEqual(event.ai_status, "COMPLETED")
        self.assertIsNotNone(event.ai_completed_at)
        self.assertIsNotNone(event.analyst_result)
        self.assertEqual(event.analyst_result.get("decision"), "BLOCK")

    def test_stale_lease_recovery_by_another_worker(self):
        now = datetime.utcnow()
        cfg = get_test_config(ai_analyst_enabled=True)
        with patch("app.services.event_service.get_runtime_config", return_value=cfg):
            payload = EventCreate(
                title="Port scan detected",
                event_id="v1.stream1.102",
                event_type="scan",
                severity="Medium",
                source="nginx",
                ip_address="198.51.100.6",
            )
            created = create_event(self.db, self.integration1, payload)

        job = self.db.query(AiAnalysisJob).filter(AiAnalysisJob.event_id == created.id).first()
        job.status = "RUNNING"
        job.lease_token = "stale_token_abc"
        job.locked_until = now - timedelta(seconds=10)
        job.attempts = 1
        self.db.commit()

        mock_inference = {
            "decision": "MONITOR",
            "confidence": 0.5,
            "threat_level": "MEDIUM",
            "reason": "Harmless scan",
        }

        with patch("app.services.ai_worker.get_runtime_config", return_value=cfg), \
             patch("app.services.ai_worker.SessionLocal", side_effect=self.SessionFactory), \
             patch("app.services.ai_worker._call_gt_beta_inference", return_value=(True, mock_inference, "OK")), \
             patch("app.services.ai_worker._stop_event.is_set", side_effect=[False, True]):
            ai_worker._ai_worker_loop()

        self.db.expire_all()
        job = self.db.query(AiAnalysisJob).filter(AiAnalysisJob.id == job.id).first()
        self.assertEqual(job.status, "SUCCEEDED")
        self.assertEqual(job.attempts, 2)

    def test_stale_writer_fencing_prevents_lost_lease_overwrite(self):
        cfg = get_test_config(ai_analyst_enabled=True)
        with patch("app.services.event_service.get_runtime_config", return_value=cfg):
            payload = EventCreate(
                title="Vulnerability scan",
                event_id="v1.stream1.103",
                event_type="scan",
                severity="Low",
                source="nginx",
                ip_address="198.51.100.7",
            )
            created = create_event(self.db, self.integration1, payload)

        job = self.db.query(AiAnalysisJob).filter(AiAnalysisJob.event_id == created.id).first()
        job.status = "RUNNING"
        job.lease_token = "new_worker_token"
        self.db.commit()

        stale_claim_token = "old_worker_token"
        db = self.SessionFactory()
        db.info["system_scope"] = True
        updated = (
            db.query(AiAnalysisJob)
            .filter(
                AiAnalysisJob.id == job.id,
                AiAnalysisJob.lease_token == stale_claim_token,
                AiAnalysisJob.status == "RUNNING",
            )
            .update({"status": "SUCCEEDED"}, synchronize_session=False)
        )
        db.commit()
        db.close()

        self.assertEqual(updated, 0)
        self.db.expire_all()
        job = self.db.query(AiAnalysisJob).filter(AiAnalysisJob.id == job.id).first()
        self.assertEqual(job.status, "RUNNING")

    def test_retry_backoff_and_terminal_failure(self):
        cfg = get_test_config(ai_analyst_enabled=True, ai_job_max_attempts=3)
        with patch("app.services.event_service.get_runtime_config", return_value=cfg):
            payload = EventCreate(
                title="Volumetric DDoS",
                event_id="v1.stream1.104",
                event_type="ddos",
                severity="High",
                source="cloudflare",
                ip_address="198.51.100.8",
            )
            created = create_event(self.db, self.integration1, payload)

        job = self.db.query(AiAnalysisJob).filter(AiAnalysisJob.event_id == created.id).first()
        job.attempts = 2  # Already failed twice, next claim is 3rd (max)
        self.db.commit()

        with patch("app.services.ai_worker.get_runtime_config", return_value=cfg), \
             patch("app.services.ai_worker.SessionLocal", side_effect=self.SessionFactory), \
             patch("app.services.ai_worker._call_gt_beta_inference", return_value=(False, None, "TIMEOUT")), \
             patch("app.services.ai_worker._stop_event.is_set", side_effect=[False, True]):
            ai_worker._ai_worker_loop()

        self.db.expire_all()
        job = self.db.query(AiAnalysisJob).filter(AiAnalysisJob.id == job.id).first()
        self.assertEqual(job.status, "FAILED")
        self.assertEqual(job.last_error_code, "TIMEOUT")

        event = self.db.query(Event).filter(Event.id == created.id).first()
        self.assertEqual(event.ai_status, "FAILED")
        self.assertIsNotNone(event.ai_completed_at)

    def test_circuit_breaker_trips_after_consecutive_failures(self):
        cfg = get_test_config(
            ai_analyst_enabled=True,
            ai_job_max_attempts=3,
            ai_breaker_failures=5,
            ai_breaker_cooldown_seconds=60,
        )
        with patch("app.services.event_service.get_runtime_config", return_value=cfg):
            for i in range(5):
                payload = EventCreate(
                    title=f"Exploit attempt {i}",
                    event_id=f"v1.stream1.cb_{i}",
                    event_type="exploit",
                    severity="High",
                    source="waf",
                    ip_address=f"198.51.100.{10+i}",
                )
                create_event(self.db, self.integration1, payload)

        with patch("app.services.ai_worker.get_runtime_config", return_value=cfg), \
             patch("app.services.ai_worker.SessionLocal", side_effect=self.SessionFactory), \
             patch("app.services.ai_worker._call_gt_beta_inference", return_value=(False, None, "UNAVAILABLE")), \
             patch("app.services.ai_worker._stop_event.is_set", side_effect=[False, False, False, False, False, True]):
            ai_worker._ai_worker_loop()

        self.assertGreaterEqual(ai_worker._circuit_breaker_failures, 5)
        self.assertIsNotNone(ai_worker._breaker_cooldown_until)
        self.assertGreater(ai_worker._breaker_cooldown_until, datetime.utcnow())

    def test_non_retryable_http_4xx_marks_failed_immediately(self):
        cfg = get_test_config(ai_analyst_enabled=True)
        with patch("app.services.event_service.get_runtime_config", return_value=cfg):
            payload = EventCreate(
                title="Malformed request",
                event_id="v1.stream1.bad_req",
                event_type="bad_format",
                severity="Low",
                source="custom",
                ip_address="198.51.100.99",
            )
            created = create_event(self.db, self.integration1, payload)

        with patch("app.services.ai_worker.get_runtime_config", return_value=cfg), \
             patch("app.services.ai_worker.SessionLocal", side_effect=self.SessionFactory), \
             patch("app.services.ai_worker._call_gt_beta_inference", return_value=(False, None, "HTTP_400")), \
             patch("app.services.ai_worker._stop_event.is_set", side_effect=[False, True]):
            ai_worker._ai_worker_loop()

        self.db.expire_all()
        job = self.db.query(AiAnalysisJob).filter(AiAnalysisJob.event_id == created.id).first()
        self.assertEqual(job.status, "FAILED")
        self.assertEqual(job.last_error_code, "HTTP_400")

        event = self.db.query(Event).filter(Event.id == created.id).first()
        self.assertEqual(event.ai_status, "FAILED")

    def test_tenant_isolation_in_worker(self):
        cfg = get_test_config(ai_analyst_enabled=True)
        with patch("app.services.event_service.get_runtime_config", return_value=cfg):
            payload = EventCreate(
                title="Tenant isolation check",
                event_id="v1.stream1.tenant_iso",
                event_type="sqli",
                severity="High",
                source="waf",
                ip_address="198.51.100.20",
            )
            created = create_event(self.db, self.integration1, payload)

        job = self.db.query(AiAnalysisJob).filter(AiAnalysisJob.event_id == created.id).first()
        # Mutate job to org 2 with system_scope
        self.db.info["system_scope"] = True
        job.organization_id = 2
        self.db.commit()
        self.db.info["system_scope"] = False

        mock_inference = {"decision": "BLOCK", "confidence": 0.9}

        with patch("app.services.ai_worker.get_runtime_config", return_value=cfg), \
             patch("app.services.ai_worker.SessionLocal", side_effect=self.SessionFactory), \
             patch("app.services.ai_worker._call_gt_beta_inference", return_value=(True, mock_inference, "OK")), \
             patch("app.services.ai_worker._stop_event.is_set", side_effect=[False, True]):
            ai_worker._ai_worker_loop()

        self.db.expire_all()
        # The worker tries to update Event where organization_id == claimed_job_org (2).
        # Since the event is in Org 1, it will not be updated!
        event = self.db.query(Event).filter(Event.id == created.id).first()
        self.assertEqual(event.analyst_result.get("engine"), "deterministic_rules_v1")
        self.assertNotEqual(event.analyst_result.get("decision"), "BLOCK")

    def test_recovering_skipped_jobs_when_ai_reenabled(self):
        """When AI is disabled, pending jobs are marked SKIPPED. When re-enabled, they recover."""
        cfg_on = get_test_config(ai_analyst_enabled=True)
        with patch("app.services.event_service.get_runtime_config", return_value=cfg_on):
            payload = EventCreate(
                title="AI toggling check",
                event_id="v1.stream1.reenable_check",
                event_type="sqli",
                severity="High",
                source="waf",
                ip_address="198.51.100.99",
            )
            created = create_event(self.db, self.integration1, payload)

        self.assertEqual(created.ai_status, "PENDING")
        job = self.db.query(AiAnalysisJob).filter(AiAnalysisJob.event_id == created.id).first()
        self.assertEqual(job.status, "PENDING")

        # Step 1: AI is disabled at startup -> swept to SKIPPED
        cfg_off = get_test_config(ai_analyst_enabled=False)
        with patch("app.services.ai_worker.get_runtime_config", return_value=cfg_off), \
             patch("app.services.ai_worker.SessionLocal", side_effect=self.SessionFactory):
            ai_worker.start_ai_workers()

        self.db.expire_all()
        job = self.db.query(AiAnalysisJob).filter(AiAnalysisJob.event_id == created.id).first()
        event = self.db.query(Event).filter(Event.id == created.id).first()
        self.assertEqual(job.status, "FAILED")
        self.assertEqual(job.last_error_code, "AI_DISABLED")
        self.assertEqual(event.ai_status, "SKIPPED")

        # Step 2: AI is re-enabled at startup -> recovered to PENDING
        cfg_restarted = get_test_config(ai_analyst_enabled=True, ai_worker_embedded=False)
        with patch("app.services.ai_worker.get_runtime_config", return_value=cfg_restarted), \
             patch("app.services.ai_worker.SessionLocal", side_effect=self.SessionFactory):
            ai_worker.start_ai_workers()

        self.db.expire_all()
        job = self.db.query(AiAnalysisJob).filter(AiAnalysisJob.event_id == created.id).first()
        event = self.db.query(Event).filter(Event.id == created.id).first()
        self.assertEqual(job.status, "PENDING")
        self.assertIsNone(job.last_error_code)
        self.assertEqual(event.ai_status, "PENDING")

        # Step 3: Worker processes the recovered job to completion
        mock_inference = {
            "decision": "RESPOND",
            "action_type": "BLOCK_IP",
            "target": "198.51.100.99",
            "confidence": 0.98,
            "threat_level": "CRITICAL",
            "reason": "Verified malicious SQL injection probe",
            "engine": "gt-beta-http",
        }
        with patch("app.services.ai_worker.get_runtime_config", return_value=cfg_on), \
             patch("app.services.ai_worker.SessionLocal", side_effect=self.SessionFactory), \
             patch("app.services.ai_worker._call_gt_beta_inference", return_value=(True, mock_inference, "OK")), \
             patch("app.services.ai_worker._stop_event.is_set", side_effect=[False, True]):
            ai_worker._ai_worker_loop()

        self.db.expire_all()
        job = self.db.query(AiAnalysisJob).filter(AiAnalysisJob.event_id == created.id).first()
        event = self.db.query(Event).filter(Event.id == created.id).first()
        self.assertEqual(job.status, "SUCCEEDED")
        self.assertEqual(event.ai_status, "COMPLETED")
        self.assertEqual(event.analyst_result.get("engine"), "gt-beta-http")


if __name__ == "__main__":
    unittest.main()
