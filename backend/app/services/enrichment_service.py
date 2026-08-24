from typing import Any

from app.schemas.event_schema import CanonicalSecurityEvent


def enrich_event(
    event: CanonicalSecurityEvent,
    asset_context: dict[str, Any] | None = None,
) -> CanonicalSecurityEvent:
    metadata = dict(event.metadata)

    if asset_context:
        metadata["asset_context"] = asset_context

    metadata["enrichment_status"] = "processed"

    return event.model_copy(
        update={
            "metadata": metadata,
        }
    )