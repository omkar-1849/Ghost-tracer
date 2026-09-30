"""Auth regression tests: fake database dependency, mocked SQL sessions, no I/O."""
import importlib
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
# Run with ENVIRONMENT=test and DATABASE_URL=sqlite:///:memory:.
# Tests mock sessions, but never replace process-global application modules.

from fastapi import HTTPException
from app.services import auth_service


class PasswordResetTests(unittest.TestCase):
    def test_reset_is_flush_only_and_revokes_all_credentials(self):
        db = MagicMock()
        token = types.SimpleNamespace(user_id=7)
        user = types.SimpleNamespace(id=7, is_active=True, password_hash="old")
        db.query.return_value.filter.return_value.populate_existing.return_value.with_for_update.return_value.first.return_value = user
        db.query.return_value.filter.return_value.update.return_value = 1
        with patch.object(auth_service, "hash_password", return_value="new-hash"), patch.object(
            auth_service, "invalidate_user_credentials", create=True
        ) as invalidate:
            result = auth_service.reset_password(db, "opaque-token", "new-password")
        self.assertEqual(result, user)
        self.assertEqual(user.password_hash, "new-hash")
        invalidate.assert_called_once_with(db, 7)
        db.commit.assert_not_called()
        db.flush.assert_called()

    def test_reset_lost_atomic_claim_does_not_change_password(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = types.SimpleNamespace(user_id=7)
        user = types.SimpleNamespace(id=7, is_active=True, password_hash="old")
        db.query.return_value.filter.return_value.populate_existing.return_value.with_for_update.return_value.first.return_value = user
        db.query.return_value.filter.return_value.update.return_value = 0
        with patch.object(auth_service, "hash_password") as hash_password:
            with self.assertRaises(HTTPException) as raised:
                auth_service.reset_password(db, "spent-token", "new-password")
        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(user.password_hash, "old")
        hash_password.assert_not_called()
        db.commit.assert_not_called()

    def test_audit_does_not_attribute_unaffiliated_user_to_tenant_one(self):
        router = importlib.import_module("app.routers.auth_router")
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        request = MagicMock()
        request.client.host = "127.0.0.1"
        with patch.object(router, "create_audit_log") as audit:
            router._audit(db, request, 7, "PASSWORD_RESET")
        audit.assert_called_once()
        self.assertIsNone(audit.call_args.kwargs["organization_id"])
        self.assertEqual(audit.call_args.kwargs["user_id"], 7)
        db.query.assert_not_called()

    def test_identity_audits_do_not_select_arbitrary_membership(self):
        for module, argument in (("auth_router", "LOGIN"), ("session_router", "Session revoked.")):
            with self.subTest(module=module):
                router = importlib.import_module("app.routers." + module)
                db = MagicMock()
                request = MagicMock()
                with patch.object(router, "create_audit_log") as audit:
                    router._audit(db, request, 7, argument)
                self.assertIsNone(audit.call_args.kwargs["organization_id"])
                self.assertEqual(audit.call_args.kwargs["user_id"], 7)
                db.query.assert_not_called()


class RecoveryBoundaryTests(unittest.TestCase):
    def test_smtp_uses_tls_and_fragment_link_without_network(self):
        import os
        from app.utils import recovery_delivery as delivery
        config = delivery.SMTPConfig("mail.example", 587, "recovery@example.com", "starttls")
        with patch.object(delivery, "get_smtp_config", return_value=config), patch.dict(
            os.environ, {"RECOVERY_URL": "https://sentinel.example/reset-password"}
        ), patch.object(delivery.smtplib, "SMTP") as smtp:
            delivery.send_recovery_email("user@example.com", "private-test-token")
        smtp.return_value.starttls.assert_called_once()
        smtp.return_value.send_message.assert_called_once()
        body = smtp.return_value.send_message.call_args.args[0].get_content()
        self.assertIn("#token=private-test-token", body)
        self.assertNotIn("?token=", body)

    def test_limiter_is_bounded_and_recovers_after_expiry(self):
        from app.utils.rate_limit import RequestLimiter
        clock = MagicMock(return_value=0)
        limiter = RequestLimiter(b"private-key", max_buckets=2, clock=clock)
        self.assertTrue(limiter.allow("recovery", "ip-one", "user@example.com", 2, 1, 10))
        self.assertFalse(limiter.allow("recovery", "ip-one", "user@example.com", 2, 1, 10))
        self.assertFalse(limiter.allow("recovery", "ip-two", "other@example.com", 2, 1, 10))
        self.assertEqual(len(limiter.buckets), 2)
        self.assertNotIn("user@example.com", repr(limiter.buckets))
        clock.return_value = 11
        self.assertTrue(limiter.allow("recovery", "ip-one", "user@example.com", 2, 1, 10))

    def test_delivery_failure_rolls_back_and_returns_generic_response(self):
        from app.routers import auth_router as router
        from app.schemas.auth_schema import ForgotPasswordRequest, ForgotPasswordResponse
        db = MagicMock()
        sink = MagicMock(side_effect=RuntimeError("private-provider-diagnostic"))
        with patch.object(router, "check_rate_limit", return_value=True), patch.object(
            router, "create_password_reset_token", return_value="private-token"
        ):
            response = router.forgot_password(ForgotPasswordRequest(email="user@example.com"), MagicMock(), db, sink)
        self.assertEqual(response, router.RECOVERY_MESSAGE)
        self.assertNotIn("reset_token", ForgotPasswordResponse.model_fields)
        db.rollback.assert_called_once()
        db.commit.assert_not_called()


if __name__ == "__main__":
    unittest.main()
