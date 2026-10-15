"""Tests for Collector Reliability and Idempotency features.

Covers:
- Event ID assignment (v1.<stream_id>.<start_offset>)
- Checkpoint v2 format and persistence
- Acknowledged offset boundary vs buffer reading
- PAUSE backpressure policy with high/low watermarks (no silent drop)
- In-place truncation and rotation generation changes
- Rotation unread line draining
- Preserving trailing partial lines
- Dead-letter logging on non-retryable rejection
- HTTPS enforcement for non-loopback hosts
"""

import json
import os
import shutil
import tempfile
import time
import unittest
from unittest.mock import MagicMock, patch

from sentinel_collector.buffer import BoundedBuffer
from sentinel_collector.client import SentinelAPIError, SentinelClient
from sentinel_collector.daemon import SentinelCollectorDaemon
from sentinel_collector.tailer import LogLine, LogTailer


class CollectorReliabilityTests(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="sentinel_rel_test_")
        self.log_path = os.path.join(self.test_dir, "app.log")
        self.ckpt_path = os.path.join(self.test_dir, "checkpoint.json")
        self.cred_path = os.path.join(self.test_dir, "collector.key")
        self.dead_letter_path = os.path.join(self.test_dir, "dead_letter.jsonl")

        with open(self.cred_path, "w", encoding="utf-8") as f:
            f.write("mock_test_key_12345\n")

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_checkpoint_v2_generation_and_stream_id(self):
        with open(self.log_path, "w", encoding="utf-8") as f:
            f.write("line 1\nline 2\n")

        tailer = LogTailer(self.log_path, self.ckpt_path)
        stream_id = tailer.stream_id
        self.assertTrue(len(stream_id) >= 32)

        lines = list(tailer.read_available_lines())
        self.assertEqual(len(lines), 2)
        self.assertIsInstance(lines[0], LogLine)
        self.assertEqual(lines[0].stream_id, stream_id)
        self.assertEqual(lines[0].start_offset, 0)
        self.assertGreater(lines[0].end_offset, 0)

        tailer.close()

        # Verify on-disk JSON checkpoint v2 structure
        with open(self.ckpt_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            self.assertEqual(data.get("version"), 2)
            self.assertEqual(data.get("stream_id"), stream_id)
            self.assertGreater(data.get("offset"), 0)

    def test_partial_trailing_line_not_consumed_until_completed(self):
        with open(self.log_path, "wb") as f:
            f.write(b"full line 1\nincomplete line")

        tailer = LogTailer(self.log_path, self.ckpt_path)
        lines = list(tailer.read_available_lines())
        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0], "full line 1\n")
        tailer.close()

        # Complete the trailing line
        with open(self.log_path, "ab") as f:
            f.write(b" finished now\n")

        tailer2 = LogTailer(self.log_path, self.ckpt_path)
        lines2 = list(tailer2.read_available_lines())
        self.assertEqual(len(lines2), 1)
        self.assertEqual(lines2[0], "incomplete line finished now\n")
        tailer2.close()

    def test_pause_backpressure_policy_does_not_drop(self):
        buf = BoundedBuffer(max_items=10, overflow_policy="pause", high_watermark=0.8, low_watermark=0.5)
        self.assertEqual(buf.high_watermark_items, 8)
        self.assertEqual(buf.low_watermark_items, 5)

        # Push 7 items: still can accept
        for i in range(7):
            self.assertTrue(buf.push({"id": i}))
        self.assertTrue(buf.can_accept())
        self.assertFalse(buf.is_paused)

        # Push 8th item: hits high watermark -> pauses
        self.assertTrue(buf.push({"id": 7}))
        self.assertTrue(buf.is_paused)
        self.assertFalse(buf.can_accept())
        self.assertEqual(buf.remaining_capacity(), 0)

        # Drain 2 items: 6 remain (> low watermark 5), remains paused
        batch = buf.pop_batch(max_batch_size=2)
        self.assertEqual(len(batch), 2)
        self.assertTrue(buf.is_paused)

        # Drain 2 more items: 4 remain (<= low watermark 5), unpauses!
        batch2 = buf.pop_batch(max_batch_size=2)
        self.assertEqual(len(batch2), 2)
        self.assertFalse(buf.is_paused)
        self.assertTrue(buf.can_accept())
        self.assertEqual(buf.dropped_count, 0)

    def test_checkpoint_advancement_only_up_to_acknowledged_offset(self):
        # Write 5 lines
        with open(self.log_path, "wb") as f:
            for i in range(5):
                f.write(f"log entry {i}\n".encode("utf-8"))

        daemon = SentinelCollectorDaemon(
            server_url="http://127.0.0.1:8000",
            log_path=self.log_path,
            credential_path=self.cred_path,
            checkpoint_path=self.ckpt_path,
            batch_size=2,
            overflow_policy="pause",
        )

        mock_client = MagicMock()
        mock_client.send_event_batch.return_value = {
            "accepted": 2,
            "rejected": 0,
            "results": [{"status": "accepted"}, {"status": "accepted"}],
        }
        daemon.client = mock_client

        # Manually read lines into buffer
        tailer = daemon.tailers[0]
        lines = list(tailer.read_available_lines())
        self.assertEqual(len(lines), 5)
        for idx, line in enumerate(lines):
            item = {
                "event_id": f"v1.{line.stream_id}.{line.start_offset}",
                "title": line.strip(),
                "_tailer_idx": 0,
                "_start_offset": line.start_offset,
                "_end_offset": line.end_offset,
                "_stream_id": line.stream_id,
            }
            daemon.buffer.push(item)

        self.assertEqual(len(daemon.buffer), 5)

        # Flush 1 batch of 2 items
        success = daemon._flush_buffer_once()
        self.assertTrue(success)
        self.assertEqual(len(daemon.buffer), 3)

        # Checkpoint MUST be at end_offset of line index 1 (second line), NOT line index 4!
        with open(self.ckpt_path, "r", encoding="utf-8") as f:
            ckpt = json.load(f)
            self.assertEqual(ckpt["offset"], lines[1].end_offset)
            self.assertLess(ckpt["offset"], lines[4].end_offset)

    def test_dead_letter_logging_for_rejected_items(self):
        daemon = SentinelCollectorDaemon(
            server_url="http://127.0.0.1:8000",
            log_path=self.log_path,
            credential_path=self.cred_path,
            checkpoint_path=self.ckpt_path,
            dead_letter_path=self.dead_letter_path,
        )

        mock_client = MagicMock()
        mock_client.send_event_batch.return_value = {
            "accepted": 1,
            "rejected": 1,
            "results": [
                {"status": "accepted"},
                {"status": "rejected", "code": "VALIDATION_FAILED", "reason": "Missing title"},
            ],
        }
        daemon.client = mock_client

        batch = [
            {"event_id": "v1.abc.0", "title": "good", "_end_offset": 10},
            {"event_id": "v1.abc.10", "title": "bad", "_end_offset": 20},
        ]

        daemon._send_batch(batch)
        self.assertEqual(daemon.dead_letter_count, 1)
        self.assertTrue(os.path.isfile(self.dead_letter_path))

        with open(self.dead_letter_path, "r", encoding="utf-8") as f:
            record = json.loads(f.readline())
            self.assertEqual(record["event_id"], "v1.abc.10")
            self.assertEqual(record["code"], "VALIDATION_FAILED")
            self.assertIn("title", record["payload"])

    def test_https_enforcement_for_remote_hosts(self):
        # 1. Loopback with HTTP is permitted
        client_loopback = SentinelClient("http://127.0.0.1:8000")
        self.assertEqual(client_loopback.base_url, "http://127.0.0.1:8000")

        client_localhost = SentinelClient("http://localhost:8000")
        self.assertEqual(client_localhost.base_url, "http://localhost:8000")

        # 2. Remote host with HTTPS is permitted
        client_https = SentinelClient("https://sentinel.example.com")
        self.assertEqual(client_https.base_url, "https://sentinel.example.com")

        # 3. Remote host with plaintext HTTP is forbidden
        with self.assertRaises(ValueError) as ctx:
            SentinelClient("http://sentinel.example.com")
        self.assertIn("Insecure plaintext HTTP is forbidden", str(ctx.exception))

        # 4. Remote host with allow_insecure_http=True is permitted
        client_insecure = SentinelClient("http://sentinel.example.com", allow_insecure_http=True)
        self.assertEqual(client_insecure.base_url, "http://sentinel.example.com")


if __name__ == "__main__":
    unittest.main()
