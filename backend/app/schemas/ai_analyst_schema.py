from typing import Any, Literal

from pydantic import BaseModel, Field


class AIAnalystInput(BaseModel):
    event: dict[str, Any]
    detection: dict[str, Any]
    risk: dict[str, Any]
    context: dict[str, Any] = {}


class AIAnalystResponse(BaseModel):
    decision: Literal[
        "MONITOR",
        "INVESTIGATE",
        "RESPOND",
    ]

    action_type: str | None = None
    target: str | None = None

    confidence: float = Field(
        ge=0.0,
        le=1.0,
    )

    threat_level: Literal[
        "LOW",
        "MEDIUM",
        "HIGH",
        "CRITICAL",
    ]

    reason: str
    recommended_actions: list[str] = []