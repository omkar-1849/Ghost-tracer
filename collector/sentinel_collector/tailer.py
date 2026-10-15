"""Log tailer with persistent checkpointing, rotation, and truncation handling.

Maintains an atomic checkpoint file (Checkpoint v2) surviving service restarts,
in-place truncations, and log rotations. Uses exact binary-safe byte accounting.
"""

import hashlib
import json
import logging
import os
import tempfile
import time
import uuid
from typing import Iterator, Optional, Tuple

logger = logging.getLogger("sentinel_collector.tailer")


class LogLine(str):
    """String subclass carrying binary-accurate line offset metadata."""

    start_offset: int
    end_offset: int
    stream_id: str

    def __new__(cls, content: str, start_offset: int, end_offset: int, stream_id: str):
        obj = super().__new__(cls, content)
        obj.start_offset = start_offset
        obj.end_offset = end_offset
        obj.stream_id = stream_id
        return obj


class LogTailer:
    """Tails a target log file with persistent checkpointing."""

    def __init__(self, log_path: str, checkpoint_path: Optional[str] = None):
        self.log_path = os.path.abspath(log_path)
        self.checkpoint_path = os.path.abspath(checkpoint_path) if checkpoint_path else None
        self._file = None
        self._file_inode: Optional[int] = None
        self._offset: int = 0
        self._stream_id: str = ""
        self._head_fp: Optional[str] = None
        self._load_checkpoint()

    @property
    def stream_id(self) -> str:
        return self._stream_id

    @property
    def offset(self) -> int:
        return self._offset

    def _get_file_identity(self, path: str) -> Tuple[Optional[int], int]:
        """Return (inode_or_id, size) for file, or (None, 0) if missing."""
        try:
            st = os.stat(path)
            return getattr(st, "st_ino", None), st.st_size
        except (FileNotFoundError, PermissionError):
            return None, 0

    def _calculate_head_fingerprint(self, path: str) -> Optional[str]:
        """Return SHA-256 hex digest of first 256 bytes once file reaches 256 bytes."""
        try:
            if not os.path.isfile(path) or os.path.getsize(path) < 256:
                return None
            with open(path, "rb") as f:
                head = f.read(256)
                if len(head) >= 256:
                    return hashlib.sha256(head).hexdigest()
        except Exception:
            pass
        return None

    def _load_checkpoint(self):
        """Load offset and inode from checkpoint file if present."""
        if not self.checkpoint_path or not os.path.isfile(self.checkpoint_path):
            self._offset = 0
            self._file_inode = None
            self._stream_id = uuid.uuid4().hex
            self._head_fp = None
            return

        try:
            with open(self.checkpoint_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("log_path") == self.log_path:
                    self._offset = int(data.get("offset", 0))
                    self._file_inode = data.get("inode")
                    self._head_fp = data.get("head_fp")
                    self._stream_id = data.get("stream_id") or uuid.uuid4().hex
                    logger.info(
                        "Loaded checkpoint v%s at offset %d (stream %s, inode %s)",
                        data.get("version", 1),
                        self._offset,
                        self._stream_id,
                        self._file_inode,
                    )
                else:
                    self._offset = 0
                    self._file_inode = None
                    self._stream_id = uuid.uuid4().hex
                    self._head_fp = None
        except Exception as exc:
            logger.warning("Failed to load checkpoint file (%s), starting from 0: %s", self.checkpoint_path, exc)
            self._offset = 0
            self._file_inode = None
            self._stream_id = uuid.uuid4().hex
            self._head_fp = None

    def save_checkpoint(self, offset: Optional[int] = None):
        """Atomically persist current acknowledged offset to checkpoint file with fsync."""
        if not self.checkpoint_path:
            return

        if offset is not None:
            self._offset = offset

        data = {
            "version": 2,
            "stream_id": self._stream_id,
            "log_path": self.log_path,
            "inode": self._file_inode,
            "head_fp": self._head_fp,
            "offset": self._offset,
            "updated_at": time.time(),
        }

        ckpt_dir = os.path.dirname(self.checkpoint_path) or "."
        os.makedirs(ckpt_dir, exist_ok=True)

        try:
            fd, tmp_path = tempfile.mkstemp(dir=ckpt_dir, prefix="ckpt_", suffix=".tmp")
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, self.checkpoint_path)
        except Exception as exc:
            logger.error("Failed to save checkpoint: %s", exc)

    def _open_file(self) -> list[LogLine]:
        """Open or reopen the log file, handling rotation and truncation.
        
        Returns any drained lines from a rotated previous file generation.
        """
        drained_lines: list[LogLine] = []
        if not os.path.exists(self.log_path):
            return drained_lines

        current_inode, current_size = self._get_file_identity(self.log_path)
        current_head_fp = self._calculate_head_fingerprint(self.log_path)

        if self._file is None:
            self._file = open(self.log_path, "rb")
            self._file_inode = current_inode
            if current_head_fp:
                self._head_fp = current_head_fp

            # Check if file was rotated or truncated since checkpoint
            is_new_generation = False
            if current_size < self._offset:
                logger.info("Log file truncated since checkpoint; resetting offset to 0")
                is_new_generation = True
            elif self._file_inode is not None and current_inode != self._file_inode:
                logger.info("Log file rotated since checkpoint; resetting offset to 0")
                is_new_generation = True
            elif self._head_fp and current_head_fp and self._head_fp != current_head_fp:
                logger.info("Log file head fingerprint changed; resetting offset to 0")
                is_new_generation = True

            if is_new_generation:
                self._offset = 0
                self._stream_id = uuid.uuid4().hex
                self._head_fp = current_head_fp
                self.save_checkpoint(0)

            self._file.seek(self._offset)
        else:
            # File already open: check if rotated (inode changed) or truncated
            rotated = (current_inode is not None and self._file_inode is not None and current_inode != self._file_inode)
            truncated = (current_size < self._offset)
            head_changed = (self._head_fp and current_head_fp and self._head_fp != current_head_fp)

            if rotated or head_changed:
                logger.info("Log file rotated (new generation detected); draining and reopening")
                # Drain remaining unread lines from old file handle before closing
                try:
                    while True:
                        pos = self._file.tell()
                        raw = self._file.readline()
                        if not raw:
                            break
                        if not raw.endswith(b"\n") and not raw.endswith(b"\r"):
                            break
                        end_pos = self._file.tell()
                        decoded = raw.decode("utf-8", errors="replace")
                        if decoded.endswith("\r\n"):
                            decoded = decoded[:-2] + "\n"
                        drained_lines.append(
                            LogLine(decoded, pos, end_pos, self._stream_id)
                        )
                except Exception:
                    pass

                self._file.close()
                self._file = open(self.log_path, "rb")
                self._file_inode = current_inode
                self._offset = 0
                self._stream_id = uuid.uuid4().hex
                self._head_fp = current_head_fp
                self.save_checkpoint(0)
                self._file.seek(0)

            elif truncated:
                logger.info("Log file truncated in place; resetting offset to 0")
                self._file.seek(0)
                self._offset = 0
                self._stream_id = uuid.uuid4().hex
                self._head_fp = current_head_fp
                self.save_checkpoint(0)

        return drained_lines

    def read_available_lines(self) -> Iterator[LogLine]:
        """Read all currently available lines with binary-safe offset tracking.
        
        Yields LogLine objects with start_offset, end_offset, and stream_id.
        Incomplete trailing lines without a newline are preserved for next read.
        """
        drained = self._open_file()
        for item in drained:
            yield item

        if self._file is None:
            return

        while True:
            start_pos = self._file.tell()
            raw_line = self._file.readline()
            if not raw_line:
                break

            # If trailing partial line does not end with newline, do not consume yet
            if not raw_line.endswith(b"\n") and not raw_line.endswith(b"\r"):
                self._file.seek(start_pos)
                break

            end_pos = self._file.tell()
            self._offset = end_pos
            line_str = raw_line.decode("utf-8", errors="replace")
            if line_str.endswith("\r\n"):
                line_str = line_str[:-2] + "\n"

            # Update head fingerprint if file just grew past 256 bytes
            if not self._head_fp and end_pos >= 256:
                self._head_fp = self._calculate_head_fingerprint(self.log_path)

            yield LogLine(line_str, start_pos, end_pos, self._stream_id)

    def close(self, save: bool = True):
        """Close log file and persist checkpoint if save is True."""
        if self._file:
            try:
                self._file.close()
            except Exception:
                pass
            self._file = None
        if save:
            self.save_checkpoint()
