"""Bounded in-memory telemetry buffer with PAUSE backpressure and drop-oldest policies.

Prevents silent log drop under recoverable load while bounding process memory.
"""

import collections
import logging
import threading
from typing import Any, Dict, List

logger = logging.getLogger("sentinel_collector.buffer")


class BoundedBuffer:
    """Thread-safe queue with configurable PAUSE backpressure and drop-oldest policies."""

    def __init__(
        self,
        max_items: int = 10000,
        overflow_policy: str = "drop_oldest",
        high_watermark: float = 0.8,
        low_watermark: float = 0.5,
    ):
        self.max_items = max_items
        self.overflow_policy = overflow_policy.lower()
        self.high_watermark = high_watermark
        self.low_watermark = low_watermark

        self.high_watermark_items = max(1, int(self.max_items * self.high_watermark))
        self.low_watermark_items = max(1, int(self.max_items * self.low_watermark))

        self._deque = collections.deque(maxlen=max_items if self.overflow_policy == "drop_oldest" else None)
        self._lock = threading.Lock()
        self.dropped_count: int = 0
        self._last_logged_drops: int = 0
        self.is_paused: bool = False

    def can_accept(self) -> bool:
        """Return True if reader should read more items before backpressure gates it."""
        with self._lock:
            if self.overflow_policy == "drop_oldest":
                return True
            if self.is_paused:
                return False
            return len(self._deque) < self.high_watermark_items

    def remaining_capacity(self) -> int:
        """Number of items the buffer can accept before hitting high watermark."""
        with self._lock:
            if self.overflow_policy == "drop_oldest":
                return max(0, self.max_items - len(self._deque))
            if self.is_paused:
                return 0
            return max(0, self.high_watermark_items - len(self._deque))

    def push(self, item: Dict[str, Any]) -> bool:
        """Add an item to the buffer.
        
        Under drop_oldest policy: evicts oldest item if full.
        Under pause policy: returns False if at absolute capacity; updates pause state.
        """
        with self._lock:
            current_len = len(self._deque)

            if self.overflow_policy == "drop_oldest":
                if current_len >= self.max_items:
                    self.dropped_count += 1
                    if self.dropped_count - self._last_logged_drops >= 1000:
                        logger.warning(
                            "Collector buffer full (%d items); total dropped items: %d",
                            self.max_items,
                            self.dropped_count,
                        )
                        self._last_logged_drops = self.dropped_count
                self._deque.append(item)
                return True

            # PAUSE policy
            if current_len >= self.max_items:
                # Saturated: cannot accept item without dropping
                self.is_paused = True
                return False

            self._deque.append(item)
            if len(self._deque) >= self.high_watermark_items:
                if not self.is_paused:
                    logger.info(
                        "Collector buffer reached high watermark (%d/%d items). Pausing reader.",
                        len(self._deque),
                        self.max_items,
                    )
                    self.is_paused = True
            return True

    def pop_batch(self, max_batch_size: int = 100) -> List[Dict[str, Any]]:
        """Extract up to max_batch_size items from the front of the queue."""
        batch = []
        with self._lock:
            while self._deque and len(batch) < max_batch_size:
                batch.append(self._deque.popleft())

            # Check if drained below low watermark to unpause reader
            if self.is_paused and len(self._deque) <= self.low_watermark_items:
                logger.info(
                    "Collector buffer drained below low watermark (%d/%d items). Resuming reader.",
                    len(self._deque),
                    self.max_items,
                )
                self.is_paused = False

        return batch

    def __len__(self) -> int:
        with self._lock:
            return len(self._deque)

    def is_empty(self) -> bool:
        with self._lock:
            return len(self._deque) == 0
