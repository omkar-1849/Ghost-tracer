from typing import Any, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.config.telemetry import TELEMETRY_BATCH_MAX_ITEMS


class LogBatchCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[dict[str, Any]] = Field(
        ..., min_length=1, max_length=TELEMETRY_BATCH_MAX_ITEMS
    )


class EventBatchCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[dict[str, Any]] = Field(
        ..., min_length=1, max_length=TELEMETRY_BATCH_MAX_ITEMS
    )


class BatchItemResult(BaseModel):
    index: int
    status: Literal["accepted", "duplicate", "rejected"]
    id: Optional[int] = None
    error: Optional[str] = None
    duplicate_kind: Optional[Literal["replay", "suppressed"]] = None
    event_id: Optional[str] = None
    code: Optional[str] = None
    retryable: Optional[bool] = None


class BatchResponse(BaseModel):
    accepted: int
    duplicates: int = 0
    rejected: int
    results: list[BatchItemResult]
