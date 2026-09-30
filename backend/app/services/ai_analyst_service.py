from app.schemas.ai_analyst_schema import AIAnalystResponse


def analyze_security_event(analyst_input):
    """Local deterministic recommendations; never creates or executes actions."""
    level = analyst_input.risk.get("threat_level", "LOW")
    confidence = max((d.get("confidence", 0) for d in analyst_input.detection.get("detections", [])), default=0)
    return AIAnalystResponse(
        decision="INVESTIGATE" if level in {"MEDIUM", "HIGH", "CRITICAL"} else "MONITOR",
        confidence=confidence, threat_level=level,
        reason="Rule-based assessment of integration-reported telemetry. Verify source attribution before approving any response.",
        recommended_actions=["Review correlated evidence", "Verify reported source identity"] if level in {"HIGH", "CRITICAL"} else [],
    )
