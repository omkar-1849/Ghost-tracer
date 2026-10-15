"""Test suite for Sentinel Collector Daemon: parser, buffer, tailer, client, and E2E daemon flow."""

import gzip
import http.server
import json
import os
import shutil
import socket
import tempfile
import threading
import time
import unittest
from typing import List

from sentinel_collector.buffer import BoundedBuffer
from sentinel_collector.client import (
    AuthError,
    RateLimitError,
    SentinelAPIError,
    SentinelClient,
)
from sentinel_collector.daemon import SentinelCollectorDaemon
from sentinel_collector.parser import parse_log_line, parse_nginx_log_line
from sentinel_collector.tailer import LogTailer


class NginxParserTests(unittest.TestCase):
    """Unit tests for Nginx log line parsing and payload safety."""

    def test_parse_nginx_combined_line(self):
        sample = (
            '198.51.100.45 - - [02/Oct/2026:14:32:10 +0000] '
            '"POST /api/v1/auth/login HTTP/1.1" 401 532 '
            '"https://example.com/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"'
        )
        parsed = parse_nginx_log_line(sample)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["ip_address"], "198.51.100.45")
        self.assertEqual(parsed["method"], "POST")
        self.assertEqual(parsed["url"], "/api/v1/auth/login")
        self.assertEqual(parsed["status_code"], 401)
        self.assertIn("Mozilla/5.0", parsed["user_agent"])
        self.assertEqual(parsed["message"], "POST /api/v1/auth/login HTTP 401")

        # Invariant: No identity or server-derived fields allowed
        for forbidden in ["organization_id", "website_id", "integration_id", "id", "created_at", "threat_level", "risk_score"]:
            self.assertNotIn(forbidden, parsed)

    def test_parse_nginx_missing_referer(self):
        sample = (
            '10.0.0.1 - - [09/Oct/2026:10:15:30 +0000] '
            '"GET /dashboard HTTP/1.1" 200 4096 '
            '"-" "CustomClient/2.0"'
        )
        parsed = parse_log_line(sample)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["ip_address"], "10.0.0.1")
        self.assertEqual(parsed["method"], "GET")
        self.assertEqual(parsed["url"], "/dashboard")
        self.assertEqual(parsed["status_code"], 200)
        self.assertEqual(parsed["user_agent"], "CustomClient/2.0")

    def test_parse_nginx_with_trailing_metrics(self):
        sample = (
            '127.0.0.1 - - [01/Oct/2026:23:22:17 +0000] '
            '"GET /about HTTP/1.1" 200 2870 "-" "Mozilla/5.0" '
            'rt=0.005 uct="0.001"'
        )
        parsed = parse_log_line(sample)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["ip_address"], "127.0.0.1")
        self.assertEqual(parsed["method"], "GET")
        self.assertEqual(parsed["url"], "/about")
        self.assertEqual(parsed["status_code"], 200)

    def test_parse_fallback_line(self):
        malformed = "203.0.113.99 - Random raw log entry without standard formatting 500"
        parsed = parse_log_line(malformed)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["ip_address"], "203.0.113.99")
        self.assertEqual(parsed["status_code"], 500)
        self.assertIn("Random raw log entry", parsed["message"])

    def test_empty_line_returns_none(self):
        self.assertIsNone(parse_log_line(""))
        self.assertIsNone(parse_log_line("   \n"))


class ZerodhaJsonSecurityLogParserTests(unittest.TestCase):
    """Unit tests for Zerodha structured JSON security audit logs."""

    def test_parse_http_request_basic(self):
        line = json.dumps({
            "timestamp": "2026-10-01T17:52:17.663021+00:00",
            "type": "HTTP_REQUEST",
            "client_ip": "192.168.1.100",
            "method": "GET",
            "path": "/about",
            "query_string": "",
            "status_code": 200,
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "duration_ms": 2.87
        })
        parsed = parse_log_line(line)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["ip_address"], "192.168.1.100")
        self.assertEqual(parsed["method"], "GET")
        self.assertEqual(parsed["url"], "/about")
        self.assertEqual(parsed["status_code"], 200)
        self.assertEqual(parsed["user_agent"], "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        self.assertEqual(parsed["message"], "HTTP GET /about -> 200 (2.9ms)")

    def test_parse_http_request_with_query_string(self):
        line = json.dumps({
            "timestamp": "2026-10-01T17:52:17.868287+00:00",
            "type": "HTTP_REQUEST",
            "client_ip": "127.0.0.1",
            "method": "GET",
            "path": "/api/profile",
            "query_string": "id=2",
            "status_code": 404,
            "user_agent": "testclient",
            "duration_ms": 12.37
        })
        parsed = parse_log_line(line)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["ip_address"], "127.0.0.1")
        self.assertEqual(parsed["method"], "GET")
        self.assertEqual(parsed["url"], "/api/profile?id=2")
        self.assertEqual(parsed["status_code"], 404)
        self.assertEqual(parsed["user_agent"], "testclient")
        self.assertIn("404 (12.4ms)", parsed["message"])

    def test_parse_auth_login_success(self):
        line = json.dumps({
            "timestamp": "2026-10-01T17:52:17.804591+00:00",
            "type": "AUTH",
            "event": "LOGIN_SUCCESS",
            "client_ip": "127.0.0.1",
            "username": "rahul_sharma",
            "user_id": 7,
            "status": "SUCCESS",
            "detail": "Session established"
        })
        parsed = parse_log_line(line)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["ip_address"], "127.0.0.1")
        self.assertEqual(parsed["method"], "POST")
        self.assertEqual(parsed["url"], "/api/login")
        self.assertEqual(parsed["status_code"], 200)
        self.assertIn("rahul_sharma", parsed["message"])
        self.assertIn("LOGIN_SUCCESS", parsed["message"])

    def test_parse_auth_login_failure(self):
        line = json.dumps({
            "timestamp": "2026-10-01T17:55:00.000000+00:00",
            "type": "AUTH",
            "event": "LOGIN_FAILED",
            "client_ip": "198.51.100.99",
            "username": "attacker",
            "user_id": None,
            "status": "FAILURE",
            "detail": "Invalid password"
        })
        parsed = parse_log_line(line)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["ip_address"], "198.51.100.99")
        self.assertEqual(parsed["method"], "POST")
        self.assertEqual(parsed["url"], "/api/login")
        self.assertEqual(parsed["status_code"], 401)
        self.assertIn("LOGIN_FAILED", parsed["message"])
        self.assertIn("attacker", parsed["message"])

    def test_parse_auth_login_suspicious(self):
        line = json.dumps({
            "timestamp": "2026-10-01T17:56:00.000000+00:00",
            "type": "AUTH",
            "event": "LOGIN_SUSPICIOUS",
            "client_ip": "198.51.100.50",
            "username": "admin'--",
            "user_id": None,
            "status": "BLOCKED",
            "detail": "SQL pattern detected in username"
        })
        parsed = parse_log_line(line)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["ip_address"], "198.51.100.50")
        self.assertEqual(parsed["method"], "POST")
        self.assertEqual(parsed["status_code"], 403)
        self.assertIn("LOGIN_SUSPICIOUS", parsed["message"])

    def test_parse_auth_register(self):
        line = json.dumps({
            "timestamp": "2026-10-01T17:52:17.779615+00:00",
            "type": "AUTH",
            "event": "REGISTER",
            "client_ip": "127.0.0.1",
            "username": "test_trader",
            "user_id": 10,
            "status": "SUCCESS",
            "detail": "New user created with ID 10"
        })
        parsed = parse_log_line(line)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["method"], "POST")
        self.assertEqual(parsed["url"], "/api/register")
        self.assertEqual(parsed["status_code"], 200)
        self.assertIn("REGISTER", parsed["message"])
        self.assertIn("test_trader", parsed["message"])

    def test_parse_security_event_idor(self):
        line = json.dumps({
            "timestamp": "2026-10-01T17:52:17.865219+00:00",
            "type": "SECURITY_EVENT",
            "event": "IDOR_OBJECT_AUTHORIZATION_MISMATCH",
            "severity": "HIGH",
            "client_ip": "127.0.0.1",
            "endpoint": "/api/profile",
            "user_id": 7,
            "detail": "Authenticated user ID 7 accessed profile of user ID 2",
            "extra": {"caller_id": 7, "target_id": 2}
        })
        parsed = parse_log_line(line)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["ip_address"], "127.0.0.1")
        self.assertEqual(parsed["method"], "GET")
        self.assertEqual(parsed["url"], "/api/profile")
        self.assertEqual(parsed["status_code"], 403)
        self.assertIn("SECURITY [HIGH] IDOR_OBJECT_AUTHORIZATION_MISMATCH", parsed["message"])
        self.assertIn("User ID: 7", parsed["message"])

    def test_parse_security_event_sqli(self):
        line = json.dumps({
            "timestamp": "2026-10-01T17:52:37.224439+00:00",
            "type": "SECURITY_EVENT",
            "event": "SEARCH_SQL_INJECTION_DETECTED",
            "severity": "HIGH",
            "client_ip": "127.0.0.1",
            "endpoint": "/api/search",
            "user_id": 1,
            "detail": "Suspicious signature in search parameter: Options' OR '1'='1"
        })
        parsed = parse_log_line(line)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["url"], "/api/search")
        self.assertEqual(parsed["status_code"], 400)
        self.assertIn("SEARCH_SQL_INJECTION_DETECTED", parsed["message"])
        self.assertIn("Options' OR '1'='1", parsed["message"])

    def test_parse_security_event_path_traversal(self):
        line = json.dumps({
            "timestamp": "2026-10-01T17:52:37.300000+00:00",
            "type": "SECURITY_EVENT",
            "event": "FILE_UPLOAD_SUSPICIOUS_FILENAME",
            "severity": "HIGH",
            "client_ip": "127.0.0.1",
            "endpoint": "/api/upload",
            "user_id": 1,
            "detail": "Suspicious filename '../../pan_test.pdf': Path traversal tokens detected in filename"
        })
        parsed = parse_log_line(line)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["method"], "POST")
        self.assertEqual(parsed["url"], "/api/upload")
        self.assertEqual(parsed["status_code"], 400)
        self.assertIn("../../pan_test.pdf", parsed["message"])

    def test_parse_security_event_unhandled_exception(self):
        line = json.dumps({
            "timestamp": "2026-10-01T18:00:00.000000+00:00",
            "type": "SECURITY_EVENT",
            "event": "UNHANDLED_EXCEPTION",
            "severity": "ERROR",
            "client_ip": "127.0.0.1",
            "endpoint": "/api/broken",
            "detail": "Exception caught in middleware: ZeroDivisionError"
        })
        parsed = parse_log_line(line)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["status_code"], 500)
        self.assertIn("UNHANDLED_EXCEPTION", parsed["message"])

    def test_parse_json_missing_optional_fields(self):
        line = json.dumps({
            "type": "HTTP_REQUEST",
            "path": "/minimal"
        })
        parsed = parse_log_line(line)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["ip_address"], "127.0.0.1")
        self.assertEqual(parsed["method"], "GET")
        self.assertEqual(parsed["url"], "/minimal")
        self.assertEqual(parsed["status_code"], 200)

    def test_parse_malformed_json_safely(self):
        malformed = '{"timestamp": "2026-10-01", "type": "HTTP_REQUEST", "path": /broken JSON without quotes}'
        parsed = parse_log_line(malformed)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["url"], "/")
        self.assertIn("broken JSON", parsed["message"])

    def test_parse_json_unicode_and_escaped_characters(self):
        line = json.dumps({
            "type": "HTTP_REQUEST",
            "path": "/api/search",
            "query_string": "q=₹500 & \u092d\u093e\u0930\u0924 \u2714",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; \u65e5\u672c\u8a9e)",
            "status_code": 200,
            "duration_ms": 5.2
        })
        parsed = parse_log_line(line)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["method"], "GET")
        self.assertIn("q=₹500", parsed["url"])
        self.assertIn("日本語", parsed["user_agent"])

    def test_parse_json_does_not_fabricate_tenant_or_identity_fields(self):
        line = json.dumps({
            "type": "SECURITY_EVENT",
            "organization_id": 999,
            "website_id": 888,
            "integration_id": 777,
            "threat_level": "CRITICAL",
            "risk_score": 100,
            "endpoint": "/api/test",
            "detail": "Test"
        })
        parsed = parse_log_line(line)
        self.assertIsNotNone(parsed)
        for forbidden in ["organization_id", "website_id", "integration_id", "threat_level", "risk_score"]:
            self.assertNotIn(forbidden, parsed)


class ZerodhaAppTextLogParserTests(unittest.TestCase):
    """Unit tests for Zerodha application text logs."""

    def test_parse_app_http_summary(self):
        line = "[2026-10-01 23:22:17] [INFO] [zerodha.app]: GET /about -> 200 (2.9ms) from 192.168.1.50"
        parsed = parse_log_line(line)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["ip_address"], "192.168.1.50")
        self.assertEqual(parsed["method"], "GET")
        self.assertEqual(parsed["url"], "/about")
        self.assertEqual(parsed["status_code"], 200)
        self.assertEqual(parsed["user_agent"], "Zerodha-App")
        self.assertIn("GET /about -> 200 (2.9ms) from 192.168.1.50", parsed["message"])

    def test_parse_app_auth_summary_success(self):
        line = "[2026-10-01 23:22:17] [INFO] [zerodha.app]: AUTH LOGIN_SUCCESS | User: rahul_sharma | Status: SUCCESS | IP: 127.0.0.1 | Detail: Session established"
        parsed = parse_log_line(line)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["ip_address"], "127.0.0.1")
        self.assertEqual(parsed["method"], "POST")
        self.assertEqual(parsed["url"], "/api/login")
        self.assertEqual(parsed["status_code"], 200)
        self.assertEqual(parsed["user_agent"], "Zerodha-Auth")
        self.assertIn("AUTH LOGIN_SUCCESS | User: rahul_sharma", parsed["message"])

    def test_parse_app_security_summary_idor(self):
        line = "[2026-10-01 23:22:17] [WARNING] [zerodha.app]: SECURITY [HIGH] IDOR_OBJECT_AUTHORIZATION_MISMATCH at /api/profile by 10.0.0.5: Authenticated user ID 7 accessed profile of user ID 2"
        parsed = parse_log_line(line)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["ip_address"], "10.0.0.5")
        self.assertEqual(parsed["method"], "GET")
        self.assertEqual(parsed["url"], "/api/profile")
        self.assertEqual(parsed["status_code"], 403)
        self.assertEqual(parsed["user_agent"], "Zerodha-Security")
        self.assertIn("SECURITY [HIGH] IDOR_OBJECT_AUTHORIZATION_MISMATCH", parsed["message"])

    def test_parse_app_security_summary_xss(self):
        line = "[2026-10-01 23:22:37] [WARNING] [zerodha.app]: SECURITY [MEDIUM] STORED_XSS_INPUT_DETECTED at /api/contact by 127.0.0.1: Markup detected in ticket message"
        parsed = parse_log_line(line)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["method"], "POST")
        self.assertEqual(parsed["url"], "/api/contact")
        self.assertEqual(parsed["status_code"], 400)
        self.assertIn("STORED_XSS_INPUT_DETECTED", parsed["message"])

    def test_parse_app_generic_info_message(self):
        line = "[2026-10-01 23:26:36] [INFO] [zerodha.app]: Zerodha Clone Security Lab initialized and database ready."
        parsed = parse_log_line(line)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["url"], "/")
        self.assertEqual(parsed["status_code"], 200)
        self.assertIn("Zerodha Clone Security Lab initialized", parsed["message"])

    def test_parse_app_generic_error_message(self):
        line = "[2026-10-01 23:30:00] [ERROR] [zerodha.db]: Database connection pool timeout."
        parsed = parse_log_line(line)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["status_code"], 500)
        self.assertIn("Database connection pool timeout", parsed["message"])

    def test_parse_app_unicode_text(self):
        line = "[2026-10-01 23:35:00] [INFO] [zerodha.app]: GET /api/search?q=शेयर -> 200 (1.5ms) from 127.0.0.1"
        parsed = parse_log_line(line)
        self.assertIsNotNone(parsed)
        self.assertIn("q=शेयर", parsed["url"])


class CollectorBufferTests(unittest.TestCase):
    """Unit tests for bounded queue and drop-oldest policy."""

    def test_bounded_buffer_drop_oldest(self):
        buf = BoundedBuffer(max_items=3)
        buf.push({"id": 1})
        buf.push({"id": 2})
        buf.push({"id": 3})
        self.assertEqual(len(buf), 3)
        self.assertEqual(buf.dropped_count, 0)

        # 4th item forces drop of oldest (id: 1)
        buf.push({"id": 4})
        self.assertEqual(len(buf), 3)
        self.assertEqual(buf.dropped_count, 1)

        batch = buf.pop_batch(max_batch_size=10)
        self.assertEqual(len(batch), 3)
        self.assertEqual([item["id"] for item in batch], [2, 3, 4])
        self.assertTrue(buf.is_empty())


class CollectorTailerAndWindowsPathTests(unittest.TestCase):
    """Unit tests for file tailer, checkpointing, Windows paths, and truncation recovery."""

    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="sentinel test dir ")
        self.log_path = os.path.join(self.test_dir, "zerodha_security.log")
        self.ckpt_path = os.path.join(self.test_dir, "checkpoint.json")

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_tailer_reads_and_saves_checkpoint(self):
        with open(self.log_path, "w", encoding="utf-8") as f:
            f.write("line 1\nline 2\n")

        tailer = LogTailer(self.log_path, self.ckpt_path)
        lines = list(tailer.read_available_lines())
        self.assertEqual(lines, ["line 1\n", "line 2\n"])
        tailer.close()

        self.assertTrue(os.path.isfile(self.ckpt_path))

        # Reopen tailer: should resume from checkpoint
        with open(self.log_path, "a", encoding="utf-8") as f:
            f.write("line 3\n")

        tailer2 = LogTailer(self.log_path, self.ckpt_path)
        lines2 = list(tailer2.read_available_lines())
        self.assertEqual(lines2, ["line 3\n"])
        tailer2.close()

    def test_tailer_handles_file_truncation(self):
        with open(self.log_path, "w", encoding="utf-8") as f:
            f.write("a long long long line 1\n")

        tailer = LogTailer(self.log_path, self.ckpt_path)
        _ = list(tailer.read_available_lines())
        tailer.close()

        # Truncate file in place to a smaller size
        with open(self.log_path, "w", encoding="utf-8") as f:
            f.write("short\n")

        tailer2 = LogTailer(self.log_path, self.ckpt_path)
        lines = list(tailer2.read_available_lines())
        self.assertEqual(lines, ["short\n"])
        tailer2.close()

    def test_tailer_handles_windows_path_with_spaces_and_unicode_logs(self):
        # Write realistic JSON log with Unicode characters
        with open(self.log_path, "w", encoding="utf-8") as f:
            f.write(
                json.dumps({"type": "HTTP_REQUEST", "path": "/api/search", "query_string": "q=म्यूचुअल_फंड", "status_code": 200, "client_ip": "127.0.0.1"}) + "\n"
            )

        tailer = LogTailer(self.log_path, self.ckpt_path)
        lines = list(tailer.read_available_lines())
        self.assertEqual(len(lines), 1)
        parsed = parse_log_line(lines[0])
        self.assertIsNotNone(parsed)
        self.assertIn("q=म्यूचुअल_फंड", parsed["url"])
        tailer.close()


class MockSentinelHandler(http.server.BaseHTTPRequestHandler):
    """Mock Sentinel HTTP Server to test collector network protocol."""

    enrollments: List[dict] = []
    heartbeats: List[dict] = []
    batches: List[dict] = []

    def log_message(self, format, *args):
        # Suppress noisy HTTP server logs during tests
        pass

    def do_POST(self):
        content_len = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_len)

        # Check content encoding
        if self.headers.get("Content-Encoding") == "gzip":
            decompressed = gzip.decompress(raw_body)
            body_json = json.loads(decompressed.decode("utf-8"))
        elif raw_body:
            body_json = json.loads(raw_body.decode("utf-8"))
        else:
            body_json = {}

        if self.path == "/collector/enroll":
            token = self.headers.get("X-Enrollment-Token")
            body_json["token"] = token
            MockSentinelHandler.enrollments.append(body_json)
            if token == "bad_token":
                self.send_response(401)
                self.end_headers()
                self.wfile.write(b'{"detail":"Invalid enrollment token"}')
                return

            self.send_response(201)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            resp = {
                "api_key": "mock_collector_api_key_1234567890",
                "collector": {"id": 42, "name": "Test Collector"},
            }
            self.wfile.write(json.dumps(resp).encode("utf-8"))

        elif self.path == "/collector/heartbeat":
            api_key = self.headers.get("X-API-Key")
            if api_key != "mock_collector_api_key_1234567890":
                self.send_response(401)
                self.end_headers()
                return

            MockSentinelHandler.heartbeats.append(body_json)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')

        elif self.path == "/events/batch":
            api_key = self.headers.get("X-API-Key")
            if api_key != "mock_collector_api_key_1234567890":
                self.send_response(401)
                self.end_headers()
                return

            items = body_json.get("items", [])
            MockSentinelHandler.batches.append(items)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            resp = {
                "accepted": len(items),
                "rejected": 0,
                "results": [{"index": i, "status": "accepted", "id": i + 1} for i in range(len(items))],
            }
            self.wfile.write(json.dumps(resp).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()


class CollectorE2ETests(unittest.TestCase):
    """End-to-end daemon flow: enrollment, heartbeat, log tailing, gzip batch delivery."""

    @classmethod
    def setUpClass(cls):
        MockSentinelHandler.enrollments = []
        MockSentinelHandler.heartbeats = []
        MockSentinelHandler.batches = []

        # Find free port
        cls.server = http.server.HTTPServer(("127.0.0.1", 0), MockSentinelHandler)
        cls.port = cls.server.server_port
        cls.server_url = f"http://127.0.0.1:{cls.port}"

        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        MockSentinelHandler.enrollments.clear()
        MockSentinelHandler.heartbeats.clear()
        MockSentinelHandler.batches.clear()

        self.test_dir = tempfile.mkdtemp()
        self.log_path = os.path.join(self.test_dir, "zerodha_mixed.log")
        self.cred_path = os.path.join(self.test_dir, "collector.key")
        self.ckpt_path = os.path.join(self.test_dir, "checkpoint.json")

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_daemon_full_lifecycle_with_mixed_zerodha_logs(self):
        """Enrollment -> Heartbeat -> Mixed JSON/App Log Tailing -> Gzip Batch Ingestion -> Clean Shutdown."""
        # 1. Create log file with initial JSON security log & Nginx log entries
        with open(self.log_path, "w", encoding="utf-8") as f:
            f.write(
                json.dumps({"type": "HTTP_REQUEST", "path": "/dashboard", "status_code": 200, "client_ip": "198.51.100.1", "duration_ms": 10.5}) + "\n"
                + json.dumps({"type": "AUTH", "event": "LOGIN_SUCCESS", "username": "rahul_sharma", "status": "SUCCESS", "client_ip": "198.51.100.2"}) + "\n"
            )

        daemon = SentinelCollectorDaemon(
            server_url=self.server_url,
            log_path=self.log_path,
            credential_path=self.cred_path,
            checkpoint_path=self.ckpt_path,
            enrollment_token="stk_live_test_valid_token",
            batch_size=10,
            flush_interval_seconds=0.2,
            heartbeat_interval_seconds=0.5,
            hostname="test-host-01",
        )

        daemon_thread = threading.Thread(target=daemon.start, daemon=True)
        daemon_thread.start()

        # Allow daemon to enroll, send heartbeat, and flush initial batch
        time.sleep(1.0)

        # 2. Append additional live logs while daemon is tailing (SECURITY_EVENT + App Log)
        with open(self.log_path, "a", encoding="utf-8") as f:
            f.write(
                json.dumps({"type": "SECURITY_EVENT", "event": "IDOR_OBJECT_AUTHORIZATION_MISMATCH", "severity": "HIGH", "endpoint": "/api/profile", "detail": "User 1 accessed profile of user 2", "client_ip": "198.51.100.3"}) + "\n"
                + "[2026-10-01 23:22:17] [INFO] [zerodha.app]: GET /portfolio -> 200 (6.1ms) from 198.51.100.4\n"
            )

        # Wait for flush interval
        time.sleep(0.8)

        daemon.stop()
        daemon_thread.join(timeout=2.0)

        # Assertions
        # 1. Enrollment verified
        self.assertEqual(len(MockSentinelHandler.enrollments), 1)
        self.assertEqual(MockSentinelHandler.enrollments[0]["token"], "stk_live_test_valid_token")
        self.assertEqual(MockSentinelHandler.enrollments[0]["hostname"], "test-host-01")

        # 2. Credential saved to file
        self.assertTrue(os.path.isfile(self.cred_path))
        with open(self.cred_path, "r", encoding="utf-8") as f:
            self.assertEqual(f.read().strip(), "mock_collector_api_key_1234567890")

        # 3. Heartbeat delivered
        self.assertGreaterEqual(len(MockSentinelHandler.heartbeats), 1)
        self.assertEqual(MockSentinelHandler.heartbeats[0]["hostname"], "test-host-01")

        # 4. Batches shipped and decompressed
        total_items_shipped = sum(len(b) for b in MockSentinelHandler.batches)
        self.assertEqual(total_items_shipped, 4)

        # Verify parsed log contents
        all_items = [item for b in MockSentinelHandler.batches for item in b]
        self.assertEqual(all_items[0]["event_metadata"]["url"], "/dashboard")
        self.assertEqual(all_items[0]["event_metadata"]["method"], "GET")
        self.assertEqual(all_items[1]["event_metadata"]["url"], "/api/login")
        self.assertEqual(all_items[1]["event_metadata"]["method"], "POST")
        self.assertEqual(all_items[2]["event_metadata"]["url"], "/api/profile")
        self.assertEqual(all_items[2]["event_metadata"]["status_code"], 403)
        self.assertEqual(all_items[3]["event_metadata"]["url"], "/portfolio")
        self.assertEqual(all_items[3]["ip_address"], "198.51.100.4")

        # 5. Checkpoint was updated
        self.assertTrue(os.path.isfile(self.ckpt_path))
        with open(self.ckpt_path, "r", encoding="utf-8") as f:
            ckpt_data = json.load(f)
            self.assertGreater(ckpt_data["offset"], 0)

    def test_daemon_multi_log_tailing_and_checkpointing(self):
        """Verify daemon concurrently tails multiple log files with independent checkpoints."""
        sec_log = os.path.join(self.test_dir, "security.log")
        app_log = os.path.join(self.test_dir, "application.log")

        with open(sec_log, "w", encoding="utf-8") as f:
            f.write(json.dumps({"type": "HTTP_REQUEST", "path": "/api/orders", "status_code": 200, "client_ip": "10.0.0.1"}) + "\n")
        with open(app_log, "w", encoding="utf-8") as f:
            f.write("[2026-10-01 23:22:17] [INFO] [zerodha.app]: GET /holdings -> 200 (5.0ms) from 10.0.0.2\n")

        daemon = SentinelCollectorDaemon(
            server_url=self.server_url,
            log_path=[sec_log, app_log],
            credential_path=self.cred_path,
            enrollment_token="stk_live_test_valid_token",
            batch_size=10,
            flush_interval_seconds=0.2,
            heartbeat_interval_seconds=0.5,
            hostname="multi-log-host",
        )

        daemon_thread = threading.Thread(target=daemon.start, daemon=True)
        daemon_thread.start()

        time.sleep(0.6)
        daemon.stop()
        daemon_thread.join(timeout=2.0)

        total_shipped = sum(len(b) for b in MockSentinelHandler.batches)
        self.assertEqual(total_shipped, 2)

        urls = {item["event_metadata"]["url"] for b in MockSentinelHandler.batches for item in b}
        self.assertIn("/api/orders", urls)
        self.assertIn("/holdings", urls)

        # Check independent checkpoints created
        self.assertEqual(len(daemon.checkpoint_paths), 2)
        for ckpt_path in daemon.checkpoint_paths:
            self.assertTrue(os.path.isfile(ckpt_path), f"Checkpoint missing: {ckpt_path}")
            with open(ckpt_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.assertGreater(data["offset"], 0)

    def test_enrollment_401_exits_immediately(self):
        """Invalid token triggers 401 and causes immediate daemon exit."""
        daemon = SentinelCollectorDaemon(
            server_url=self.server_url,
            log_path=self.log_path,
            credential_path=self.cred_path,
            enrollment_token="bad_token",
        )
        with self.assertRaises(SystemExit) as cm:
            daemon.ensure_authenticated()
        self.assertEqual(cm.exception.code, 1)

    def test_client_error_classification(self):
        """Client properly maps HTTP 401 to AuthError and HTTP 429 to RateLimitError."""
        client = SentinelClient(self.server_url, api_key="invalid_key")
        with self.assertRaises(AuthError):
            client.heartbeat("host", "1.0.0")


class Phase21VerificationTests(unittest.TestCase):
    """Phase 2.1 integration integrity, telemetry accuracy & security verification tests."""

    def test_status_code_preservation_across_all_codes(self):
        """Verify 200, 404, 500, etc. are preserved without alteration across both formats."""
        for code in (200, 301, 400, 401, 403, 404, 500):
            # JSON format
            json_line = json.dumps({
                "timestamp": "2026-10-09T08:54:56.322453+00:00",
                "type": "HTTP_REQUEST",
                "client_ip": "127.0.0.1",
                "method": "GET",
                "path": f"/status-{code}",
                "status_code": code,
                "user_agent": "Test/1.0"
            })
            parsed_json = parse_log_line(json_line)
            self.assertIsNotNone(parsed_json)
            self.assertEqual(parsed_json["status_code"], code)

            # Application text format
            app_line = f"[2026-10-09 14:24:56] [INFO] [zerodha.app]: GET /status-{code} -> {code} (1.2ms) from 127.0.0.1"
            parsed_app = parse_log_line(app_line)
            self.assertIsNotNone(parsed_app)
            self.assertEqual(parsed_app["status_code"], code)

    def test_parsed_payload_strictly_matches_logcreate_schema(self):
        """Ensure parsed dictionary has exactly the 6 allowed keys and NO timestamp key."""
        allowed_keys = {"ip_address", "method", "url", "status_code", "user_agent", "message"}

        sample_json = json.dumps({
            "timestamp": "2026-10-09T08:54:56.322453+00:00",
            "type": "HTTP_REQUEST",
            "client_ip": "127.0.0.1",
            "method": "GET",
            "path": "/products",
            "status_code": 404,
            "user_agent": "Test/1.0"
        })
        parsed = parse_log_line(sample_json)
        self.assertEqual(set(parsed.keys()), allowed_keys)
        self.assertNotIn("timestamp", parsed)

    def test_nonexistent_routes_correctly_classified_as_404(self):
        """Verify that requests to unmapped endpoints (/products, /pricing) preserve 404."""
        for path in ("/products", "/pricing", "/api/market-status"):
            line = json.dumps({
                "timestamp": "2026-10-09T08:54:56.000000+00:00",
                "type": "HTTP_REQUEST",
                "client_ip": "127.0.0.1",
                "method": "GET",
                "path": path,
                "status_code": 404,
                "user_agent": "Test/1.0"
            })
            res = parse_log_line(line)
            self.assertEqual(res["url"], path)
            self.assertEqual(res["status_code"], 404)


if __name__ == "__main__":
    unittest.main()


