from typing import Any

from app.schemas.event_schema import CanonicalSecurityEvent
from app.services.normalization_service import normalize_event

NORMALIZATION_VERSION = 1


def normalize_security_event(
    event: dict[str, Any],
) -> CanonicalSecurityEvent:
    return normalize_event(event)
