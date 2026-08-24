from app.schemas.ai_analyst_schema import (
    AIAnalystInput,
    AIAnalystResponse,
)


def analyze_security_event(
    analyst_input: AIAnalystInput,
) -> AIAnalystResponse:
    """
    Temporary rule-based AI Analyst placeholder.

    This will later be replaced/extended with the actual LLM.
    """

    detection = analyst_input.detection
    risk = analyst_input.risk

    threat_level = risk.get(
        "threat_level",
        "LOW",
    )

    confidence = 0.0
    decision = "MONITOR"
    action_type = None
    target = None

    detections = detection.get(
        "detections",
        [],
    )

    if detections:
        confidence = max(
            detection.get("confidence", 0.0)
            for detection in detections
        )

    event = analyst_input.event

    target = (
        event.get("src_ip")
        or event.get("ip_address")
    )

    if threat_level == "CRITICAL":
        decision = "RESPOND"
        action_type = "BLOCK_IP"

    elif threat_level == "HIGH" and confidence >= 0.80:
        decision = "RESPOND"
        action_type = "BLOCK_IP"

    elif threat_level == "MEDIUM":
        decision = "INVESTIGATE"

    else:
        decision = "MONITOR"

    return AIAnalystResponse(
        decision=decision,
        action_type=action_type,
        target=target,
        confidence=confidence,
        threat_level=threat_level,
        reason=(
            "Security event analyzed using Sentinel "
            "AI Analyst decision logic."
        ),
        recommended_actions=(
            [action_type]
            if action_type
            else []
        ),
    )