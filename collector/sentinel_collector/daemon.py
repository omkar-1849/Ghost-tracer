"""Sentinel Collector Daemon orchestrator.

Coordinates log tailing, parsing, in-memory buffering, gzip batch delivery,
heartbeat lifecycle, stable event idempotency IDs, bounded backpressure,
and exponential backoff resilience.
"""

import json
import logging
import os
import random
import socket
import sys
import threading
import time
from typing import Any, Dict, List, Optional

from sentinel_collector import __version__
from sentinel_collector.buffer import BoundedBuffer
from sentinel_collector.client import (
    AuthError,
    RateLimitError,
    SentinelAPIError,
    SentinelClient,
)
from sentinel_collector.parser import parse_log_line, parse_nginx_log_line
from sentinel_collector.tailer import LogTailer

logger = logging.getLogger("sentinel_collector.daemon")


class SentinelCollectorDaemon:
    """Production-grade log collector daemon for Sentinel."""

    def __init__(
        self,
        server_url: str,
        log_path: Any,
        credential_path: str,
        checkpoint_path: Optional[str] = None,
        enrollment_token: Optional[str] = None,
        batch_size: int = 100,
        flush_interval_seconds: float = 1.0,
        heartbeat_interval_seconds: float = 30.0,
        max_buffer_items: int = 10000,
        hostname: Optional[str] = None,
        overflow_policy: str = "pause",
        high_watermark: float = 0.8,
        low_watermark: float = 0.5,
        send_event_ids: bool = True,
        allow_insecure_http: bool = False,
        dead_letter_path: Optional[str] = None,
    ):
        self.server_url = server_url.rstrip("/")
        if isinstance(log_path, (list, tuple)):
            raw_paths = list(log_path)
        elif isinstance(log_path, str) and "," in log_path:
            raw_paths = [p.strip() for p in log_path.split(",") if p.strip()]
        else:
            raw_paths = [str(log_path)]

        self.log_paths = [os.path.abspath(p) for p in raw_paths]
        self.log_path = self.log_paths[0] if self.log_paths else ""
        self.credential_path = os.path.abspath(credential_path)

        if len(self.log_paths) <= 1:
            ckpt = os.path.abspath(checkpoint_path) if checkpoint_path else f"{self.credential_path}.checkpoint"
            self.checkpoint_paths = [ckpt]
            self.checkpoint_path = ckpt
            self.tailers = [LogTailer(self.log_paths[0], ckpt)] if self.log_paths else []
        else:
            self.checkpoint_paths = []
            self.tailers = []
            for idx, p in enumerate(self.log_paths):
                clean_name = os.path.splitext(os.path.basename(p))[0]
                ckpt = f"{self.credential_path}.{idx}_{clean_name}.checkpoint"
                self.checkpoint_paths.append(ckpt)
                self.tailers.append(LogTailer(p, ckpt))
            self.checkpoint_path = self.checkpoint_paths[0]

        self.tailer = self.tailers[0] if self.tailers else None
        self.enrollment_token = enrollment_token
        self.batch_size = min(batch_size, 100)
        self.flush_interval_seconds = flush_interval_seconds
        self.heartbeat_interval_seconds = heartbeat_interval_seconds
        self.hostname = hostname or socket.gethostname()
        self.send_event_ids = send_event_ids
        self.dead_letter_path = os.path.abspath(dead_letter_path) if dead_letter_path else f"{self.credential_path}.dead_letter.jsonl"
        self.dead_letter_count = 0

        self.buffer = BoundedBuffer(
            max_items=max_buffer_items,
            overflow_policy=overflow_policy,
            high_watermark=high_watermark,
            low_watermark=low_watermark,
        )
        self.client = SentinelClient(self.server_url, allow_insecure_http=allow_insecure_http)

        self._running = False
        self._stop_event = threading.Event()
        self._heartbeat_thread: Optional[threading.Thread] = None

    def _read_stored_credential(self) -> Optional[str]:
        """Read API key from credential file."""
        if not os.path.isfile(self.credential_path):
            return None
        try:
            with open(self.credential_path, "r", encoding="utf-8") as f:
                key = f.read().strip()
                return key if key else None
        except Exception as exc:
            logger.error("Failed to read credential file %s: %s", self.credential_path, exc)
            return None

    def _save_credential(self, api_key: str):
        """Atomically persist API key with restricted permissions (0600 on POSIX)."""
        cred_dir = os.path.dirname(self.credential_path) or "."
        os.makedirs(cred_dir, exist_ok=True)

        flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
        mode = 0o600
        try:
            fd = os.open(self.credential_path, flags, mode)
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(api_key.strip())
            if hasattr(os, "chmod"):
                try:
                    os.chmod(self.credential_path, 0o600)
                except Exception:
                    pass
            logger.info("Credential successfully written to %s", self.credential_path)
        except Exception as exc:
            logger.error("Failed to securely save credential to %s: %s", self.credential_path, exc)
            raise

    def ensure_authenticated(self):
        """Ensure collector has an API key, enrolling if necessary."""
        key = self._read_stored_credential()
        if key:
            self.client.api_key = key
            logger.info("Loaded existing API key from %s", self.credential_path)
            return

        if not self.enrollment_token:
            logger.critical(
                "No credential file found at %s and no enrollment token provided. "
                "Supply an enrollment token to initialize collector.",
                self.credential_path,
            )
            sys.exit(1)

        logger.info("Enrolling collector with Sentinel API at %s...", self.server_url)
        try:
            enroll_resp = self.client.enroll(
                token=self.enrollment_token,
                hostname=self.hostname,
                version=__version__,
                kind="daemon",
            )
            api_key = enroll_resp.get("api_key")
            if not api_key:
                logger.critical("Enrollment succeeded but no api_key returned by server")
                sys.exit(1)

            self._save_credential(api_key)
            self.client.api_key = api_key
            logger.info("Enrollment successful! Assigned collector ID: %s", enroll_resp.get("collector", {}).get("id"))
            self.enrollment_token = None
        except AuthError:
            logger.critical("Enrollment failed: invalid or expired enrollment token (401). Exiting.")
            sys.exit(1)
        except RateLimitError as exc:
            logger.warning("Enrollment rate limited. Retry after %d seconds.", exc.retry_after)
            time.sleep(exc.retry_after)
            self.ensure_authenticated()
        except SentinelAPIError as exc:
            logger.critical("Enrollment failed due to server error: %s", exc)
            sys.exit(1)

    def _heartbeat_loop(self):
        """Background thread sending heartbeats every interval."""
        logger.info("Heartbeat worker started (interval: %ds)", self.heartbeat_interval_seconds)
        while not self._stop_event.is_set():
            try:
                self.client.heartbeat(hostname=self.hostname, version=__version__)
                logger.debug("Heartbeat delivered successfully")
            except AuthError:
                logger.error("Heartbeat rejected: credential revoked or invalid (401)")
            except RateLimitError as exc:
                logger.warning("Heartbeat rate limited; retry after %ds", exc.retry_after)
            except Exception as exc:
                logger.warning("Failed to send heartbeat: %s", exc)

            self._stop_event.wait(timeout=self.heartbeat_interval_seconds)

    def start(self):
        """Start the collector daemon, heartbeat worker, and log tailer loop."""
        self.ensure_authenticated()
        self._running = True
        self._stop_event.clear()

        self._heartbeat_thread = threading.Thread(
            target=self._heartbeat_loop,
            daemon=True,
            name="sentinel-heartbeat",
        )
        self._heartbeat_thread.start()

        logger.info("Collector daemon running. Tailing log file: %s", self.log_path)
        self._run_tail_loop()

    def stop(self):
        """Gracefully stop collector daemon."""
        logger.info("Stopping collector daemon...")
        self._running = False
        self._stop_event.set()

        if self._heartbeat_thread and self._heartbeat_thread.is_alive():
            self._heartbeat_thread.join(timeout=2.0)

        # Flush any remaining items in buffer before exit
        self._flush_buffer_once()
        for tailer in self.tailers:
            tailer.close(save=False)
        logger.info(
            "Collector daemon stopped. Dropped item total: %d, Dead letter total: %d",
            self.buffer.dropped_count,
            self.dead_letter_count,
        )

    def _write_dead_letters(self, batch: List[Dict[str, Any]], results: List[Dict[str, Any]]):
        """Write rejected items to dead-letter log file."""
        try:
            dl_dir = os.path.dirname(self.dead_letter_path) or "."
            os.makedirs(dl_dir, exist_ok=True)
            with open(self.dead_letter_path, "a", encoding="utf-8") as f:
                for idx, item in enumerate(batch):
                    res = results[idx] if idx < len(results) else {}
                    if res.get("status") == "rejected":
                        self.dead_letter_count += 1
                        clean_payload = {k: v for k, v in item.items() if not k.startswith("_")}
                        record = {
                            "timestamp": time.time(),
                            "event_id": item.get("event_id"),
                            "code": res.get("code", "REJECTED"),
                            "reason": res.get("reason") or res.get("detail"),
                            "payload": clean_payload,
                        }
                        f.write(json.dumps(record) + "\n")
        except Exception as exc:
            logger.error("Failed to write to dead-letter log %s: %s", self.dead_letter_path, exc)

    def _send_batch(self, batch: List[Dict[str, Any]]) -> bool:
        """Send a batch over HTTP, advance checkpoints on ack, dead-letter rejections."""
        clean_batch = []
        for item in batch:
            clean_item = {k: v for k, v in item.items() if not k.startswith("_")}
            if not self.send_event_ids:
                clean_item.pop("event_id", None)
            clean_batch.append(clean_item)

        resp = self.client.send_event_batch(clean_batch)
        accepted = resp.get("accepted", 0)
        rejected = resp.get("rejected", 0)
        duplicates = resp.get("duplicates", 0)
        results = resp.get("results", [])

        if rejected > 0:
            logger.warning(
                "Batch processed with partial rejections: %d accepted, %d duplicates, %d rejected",
                accepted,
                duplicates,
                rejected,
            )
            if len(batch) >= 5 and (rejected / len(batch)) >= 0.9:
                logger.critical(
                    "High rejection rate (%d/%d items rejected). Potential server/collector version mismatch.",
                    rejected,
                    len(batch),
                )
            self._write_dead_letters(batch, results)

        # Exact checkpoint advancement: only advance to end_offset of terminal items
        acked_offsets_by_tailer: dict[int, int] = {}
        for item in batch:
            t_idx = item.get("_tailer_idx", 0)
            end_off = item.get("_end_offset")
            if end_off is not None:
                current_max = acked_offsets_by_tailer.get(t_idx, 0)
                if end_off > current_max:
                    acked_offsets_by_tailer[t_idx] = end_off

        for t_idx, max_offset in acked_offsets_by_tailer.items():
            if t_idx < len(self.tailers):
                self.tailers[t_idx].save_checkpoint(max_offset)

        return True

    def _flush_buffer_once(self) -> bool:
        """Send a single batch if items exist in buffer. Returns True if batch sent."""
        if self.buffer.is_empty():
            return False

        batch = self.buffer.pop_batch(max_batch_size=self.batch_size)
        if not batch:
            return False

        try:
            return self._send_batch(batch)
        except AuthError:
            logger.error("Credential revoked or invalid (401). Pausing ingestion.")
            for item in reversed(batch):
                self.buffer.push(item)
            return False
        except RateLimitError as exc:
            logger.warning("Ingestion rate limited (429). Backing off for %ds.", exc.retry_after)
            for item in reversed(batch):
                self.buffer.push(item)
            return False
        except Exception as exc:
            logger.error("Failed to ship log batch to Sentinel: %s", exc)
            for item in reversed(batch):
                self.buffer.push(item)
            return False

    def _run_tail_loop(self):
        """Main processing loop: reads lines, parses, buffers, and flushes."""
        last_flush_time = time.time()
        backoff_seconds = 1.0

        while self._running and not self._stop_event.is_set():
            # 1. Backpressure check before reading lines
            if not self.buffer.can_accept():
                total_lag = sum(
                    max(0, os.path.getsize(t.log_path) - t.offset)
                    for t in self.tailers
                    if os.path.exists(t.log_path)
                )
                logger.info(
                    "Buffer backpressure active (%d items); total unread lag across files: %d bytes",
                    len(self.buffer),
                    total_lag,
                )
                line_count = 0
            else:
                line_count = 0
                max_lines_to_read = self.buffer.remaining_capacity()

                for idx, tailer in enumerate(self.tailers):
                    if line_count >= max_lines_to_read:
                        break

                    for line in tailer.read_available_lines():
                        parsed = parse_log_line(line)
                        if parsed:
                            start_offset = getattr(line, "start_offset", 0)
                            end_offset = getattr(line, "end_offset", len(line))
                            stream_id = getattr(line, "stream_id", tailer.stream_id)
                            event_id = f"v1.{stream_id}.{start_offset}"

                            event_data = {
                                "event_id": event_id,
                                "event_type": "security_log" if "SECURITY" in parsed["message"] else "http_log",
                                "severity": "Info",
                                "source": "sentinel_collector",
                                "title": parsed["message"][:255],
                                "ip_address": parsed["ip_address"],
                                "user_agent": parsed["user_agent"],
                                "event_metadata": {
                                    "method": parsed.get("method"),
                                    "url": parsed.get("url"),
                                    "status_code": parsed.get("status_code"),
                                },
                                "_tailer_idx": idx,
                                "_start_offset": start_offset,
                                "_end_offset": end_offset,
                                "_stream_id": stream_id,
                            }
                            accepted = self.buffer.push(event_data)
                            if accepted:
                                line_count += 1
                            else:
                                break

                        if line_count >= max_lines_to_read:
                            break

            # 2. Check if flush condition is met
            now = time.time()
            buffer_len = len(self.buffer)
            should_flush = (
                buffer_len >= self.batch_size
                or (buffer_len > 0 and (now - last_flush_time) >= self.flush_interval_seconds)
            )

            if should_flush:
                batch = self.buffer.pop_batch(max_batch_size=self.batch_size)
                if batch:
                    try:
                        self._send_batch(batch)
                        last_flush_time = time.time()
                        backoff_seconds = 1.0  # Reset backoff on success
                    except AuthError:
                        logger.error("Credential revoked or invalid (401). Ingestion paused.")
                        for item in reversed(batch):
                            self.buffer.push(item)
                        self._stop_event.wait(timeout=60.0)
                    except RateLimitError as exc:
                        logger.warning("Rate limited (429). Retrying after %ds.", exc.retry_after)
                        for item in reversed(batch):
                            self.buffer.push(item)
                        self._stop_event.wait(timeout=exc.retry_after)
                    except SentinelAPIError as exc:
                        retry_after = getattr(exc, "retry_after", 1)
                        if exc.status_code == 503:
                            logger.warning("Server unavailable (503). Retrying after %ds.", retry_after)
                        else:
                            logger.error("API error shipping batch (%s). Backing off %ds", exc, retry_after)
                        for item in reversed(batch):
                            self.buffer.push(item)
                        self._stop_event.wait(timeout=retry_after)
                    except Exception as exc:
                        jitter = random.uniform(0.1, 0.5)
                        logger.error(
                            "Network error shipping batch (%s). Backing off %.1fs",
                            exc,
                            backoff_seconds + jitter,
                        )
                        for item in reversed(batch):
                            self.buffer.push(item)
                        self._stop_event.wait(timeout=backoff_seconds + jitter)
                        backoff_seconds = min(60.0, backoff_seconds * 2.0)

            # Sleep briefly if no new log lines arrived
            if line_count == 0 and len(self.buffer) < self.batch_size:
                self._stop_event.wait(timeout=0.25)
