"""Owned remediation tests: no live database, no network, mocked SQL sessions."""
import os
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
# Run with ENVIRONMENT=test and DATABASE_URL=sqlite:///:memory:.
# Tests mock SQL sessions; the real application modules stay importable and
# process-global state is never replaced.

import importlib
for model in (Path(__file__).resolve().parents[1] / "app" / "models").glob("*.py"):
    importlib.import_module("app.models." + model.stem)
from fastapi import HTTPException
from app.services import response_action_service, settings_service, website_service
from app.schemas.settings_schema import SettingsUpdate
from app.utils.destination import Destination, DestinationError, FetchResponse


def _ctx(role="analyst", organization_id=4, user_id=9):
    return types.SimpleNamespace(
        role=role,
        organization_id=organization_id,
        user=types.SimpleNamespace(id=user_id, email="analyst@example.com"),
    )


def _query_result(db, value):
    db.query.return_value.filter.return_value.filter.return_value.first.return_value = value
    db.query.return_value.filter.return_value.first.return_value = value


class ResponseActionSimulationTests(unittest.TestCase):
    def _incident(self, confidence=85, threat_level="HIGH", source_ip="203.0.113.9"):
        return types.SimpleNamespace(
            id=3, organization_id=4, source_ip=source_ip,
            confidence=confidence, threat_level=threat_level,
        )

    def setUp(self):
        self.ctx = _ctx()
        self.db = MagicMock()
        self.db.info = {"organization_id": 4}
        _query_result(self.db, self._incident())
        for name in ("create_timeline_event", "create_audit_log"):
            mocked = patch.object(response_action_service, name)
            mocked.start()
            self.addCleanup(mocked.stop)

    def test_simulation_only_and_matching_target_is_flush_only(self):
        action = response_action_service.create_response_action(
            self.db, 3, "BLOCK_IP", "203.0.113.9", "stop attacker", ctx=self.ctx)
        self.assertEqual(action.status, "PENDING")
        self.db.add.assert_called_once()
        self.db.flush.assert_called_once()
        self.db.commit.assert_not_called()

    def test_target_must_equal_incident_source_ip(self):
        with self.assertRaises(HTTPException) as raised:
            response_action_service.create_response_action(
                self.db, 3, "BLOCK_IP", "198.51.100.1", None, ctx=self.ctx)
        self.assertEqual(raised.exception.status_code, 400)

    def test_low_confidence_incident_denied_from_stored_value(self):
        _query_result(self.db, self._incident(confidence=60))
        with self.assertRaises(HTTPException) as raised:
            response_action_service.create_response_action(
                self.db, 3, "BLOCK_IP", "203.0.113.9", None, ctx=self.ctx)
        self.assertEqual(raised.exception.status_code, 400)

    def test_request_threat_values_are_never_trusted(self):
        # Policy receives the stored incident threat level, not caller input.
        with patch.object(response_action_service, "validate_response_action", return_value={"allowed": False, "reason": "no"}) as validate:
            with self.assertRaises(HTTPException):
                response_action_service.create_response_action(
                    self.db, 3, "BLOCK_IP", "203.0.113.9", None, ctx=self.ctx)
        self.assertEqual(validate.call_args[0][3], "HIGH")

    def test_viewer_role_cannot_approve(self):
        with self.assertRaises(HTTPException) as raised:
            response_action_service.create_response_action(
                self.db, 3, "BLOCK_IP", "203.0.113.9", None, ctx=_ctx(role="viewer"))
        self.assertEqual(raised.exception.status_code, 403)

    def test_execute_needs_pending_and_reports_simulation(self):
        action = types.SimpleNamespace(id=5, incident_id=3, action_type="BLOCK_IP",
                                       target="203.0.113.9", status="PENDING", organization_id=4)
        with patch.object(response_action_service, "scoped_get", side_effect=[action, self._incident()]):
            result = response_action_service.execute_response_action(self.db, 5, ctx=self.ctx)
        self.assertEqual(result.status, "SIMULATED")
        self.assertIn("Simulation only", result.result)
        self.db.commit.assert_not_called()

    def test_executed_action_cannot_rerun(self):
        action = types.SimpleNamespace(id=5, incident_id=3, action_type="BLOCK_IP",
                                       target="203.0.113.9", status="EXECUTED", organization_id=4)
        with patch.object(response_action_service, "scoped_get", side_effect=[action, self._incident()]):
            with self.assertRaises(HTTPException) as raised:
                response_action_service.execute_response_action(self.db, 5, ctx=self.ctx)
        self.assertEqual(raised.exception.status_code, 409)


class SettingsSecretTests(unittest.TestCase):
    def _settings(self, organization_id=4):
        from app.schemas.settings_schema import SettingsBase
        from datetime import datetime
        values = SettingsBase().model_dump()
        values.update(id=2, organization_id=organization_id, api_key="legacy-secret",
                      created_at=datetime.now(), updated_at=datetime.now())
        return types.SimpleNamespace(**values)

    def test_update_never_stores_plaintext_api_key(self):
        db = MagicMock()
        db.info = {"organization_id": 4}
        settings = self._settings()
        _query_result(db, settings)
        updates = SettingsUpdate(api_key=None, scan_timeout=200)
        result = settings_service.update_settings(db, updates, 9, 4)
        self.assertEqual(result.api_key, "env:SENTINEL_AI_API_KEY")
        self.assertEqual(result.scan_timeout, 200)
        db.commit.assert_not_called()

    def test_executable_path_change_is_rejected(self):
        db = MagicMock()
        db.info = {"organization_id": 4}
        _query_result(db, self._settings())
        with self.assertRaises(HTTPException) as raised:
            settings_service.update_settings(db, SettingsUpdate(sqlmap_path="C:\\evil.exe"), 9, 4)
        self.assertEqual(raised.exception.status_code, 400)
        db.commit.assert_not_called()

    def test_export_omits_secret_and_marks_configured(self):
        with patch.dict(os.environ, {"SENTINEL_AI_API_KEY": "sk-env"}), patch.object(settings_service, "get_settings", return_value=self._settings()):
            exported = settings_service.export_settings(MagicMock())
        self.assertIsNone(exported["api_key"])
        self.assertNotIn("legacy-secret", str(exported))
        self.assertTrue(exported["api_key_configured"])

    def test_redaction_reports_unconfigured_without_leaking(self):
        with patch.dict(os.environ, {}, clear=True):
            values = settings_service.redact_settings(self._settings())
        self.assertIsNone(values["api_key"])
        self.assertFalse(values["api_key_configured"])


class WebsiteVerificationTests(unittest.TestCase):
    def _website(self, url="https://example.com"):
        return types.SimpleNamespace(
            id=6, organization_id=4, url=url, verified=False, verification_method=None,
            verification_token="SENTINEL_TOKEN", verified_at=None,
            verified_target=None, verified_addresses=None,
        )

    def test_verified_scope_recorded_from_fetched_destination(self):
        db = MagicMock()
        db.info = {"organization_id": 4}
        website = self._website()
        _query_result(db, website)
        destination = Destination("https://example.com/", "https", "example.com", 443, ("93.184.216.34",), "/", "example.com")
        response = types.SimpleNamespace(status_code=200, text="SENTINEL_TOKEN", destination=destination)
        with patch.object(website_service, "validate_destination", return_value=destination), \
             patch.object(website_service, "safe_fetch", return_value=response):
            result = website_service.verify_website(db, 6, "html")
        self.assertTrue(result["success"])
        self.assertEqual(website.verified_target, "https://example.com")
        self.assertEqual(website.verified_addresses, ["93.184.216.34"])
        self.assertTrue(website.verified)
        db.commit.assert_not_called()

    def test_failed_verification_invalidates_previous_scope_without_rollback(self):
        db = MagicMock()
        db.info = {"organization_id": 4}
        website = self._website()
        website.verified = True
        website.verified_target = "https://old.example.com"
        _query_result(db, website)
        with patch.object(website_service, "validate_destination", side_effect=DestinationError("no")):
            result = website_service.verify_website(db, 6, "meta")
        self.assertFalse(result["success"])
        self.assertFalse(website.verified)
        self.assertIsNone(website.verified_target)
        # The invalidation persists through the request transaction; no rollback.
        db.rollback.assert_not_called()
        db.commit.assert_not_called()

    def test_dns_verification_requires_exact_token_match(self):
        db = MagicMock()
        db.info = {"organization_id": 4}
        website = self._website()
        _query_result(db, website)
        record = types.SimpleNamespace(strings=[b"SENTINEL_TOKEN other"])
        resolver = MagicMock()
        resolver.return_value = [record]
        with patch.object(website_service, "validate_destination", return_value=types.SimpleNamespace(hostname="example.com")), \
             patch.object(website_service.dns.resolver, "resolve", resolver):
            result = website_service.verify_website(db, 6, "dns")
        self.assertFalse(result["success"])


if __name__ == "__main__":
    unittest.main()
