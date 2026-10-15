import logging
import httpx
from app.schemas.ai_analyst_schema import AIAnalystResponse, AIAnalystInput
from app.config.runtime import get_runtime_config


logger = logging.getLogger(__name__)


def deterministic_analyze_security_event(analyst_input: AIAnalystInput) -> AIAnalystResponse:
    """Local deterministic recommendations; never creates or executes actions."""
    level = analyst_input.risk.get("threat_level", "LOW")
    confidence = max((d.get("confidence", 0) for d in analyst_input.detection.get("detections", [])), default=0)
    return AIAnalystResponse(
        decision="INVESTIGATE" if level in {"MEDIUM", "HIGH", "CRITICAL"} else "MONITOR",
        confidence=confidence, threat_level=level,
        reason="Rule-based assessment of integration-reported telemetry. Verify source attribution before approving any response.",
        recommended_actions=["Review correlated evidence", "Verify reported source identity"] if level in {"HIGH", "CRITICAL"} else [],
    )


def analyze_security_event(analyst_input: AIAnalystInput) -> AIAnalystResponse:
    """Sends event to AI Analyst if enabled, falling back to deterministic logic on any failure."""
    config = get_runtime_config()
    
    if not config.ai_analyst_enabled:
        return deterministic_analyze_security_event(analyst_input)
        
    try:
        # Pydantic v2: use model_dump(mode="json") to handle datetime etc.
        payload = {"event": analyst_input.model_dump(mode="json")}
        
        with httpx.Client(timeout=config.ai_analyst_timeout) as client:
            response = client.post(config.ai_analyst_url, json=payload)
            response.raise_for_status()
            data = response.json()
            
            # Create AIAnalystResponse, merging fields. The GT-Beta returns 9 fields.
            # We preserve safety defaults (requires_approval=True, source_ip_trusted=False)
            return AIAnalystResponse(
                decision=data.get("decision", "MONITOR"),
                action_type=data.get("action_type"),
                target=data.get("target"),
                confidence=data.get("confidence", 0.0),
                threat_level=data.get("threat_level", "LOW"),
                reason=data.get("reason", "No reason provided by model"),
                recommended_actions=data.get("recommended_actions", []),
                requires_approval=True,
                source_ip_trusted=False,
                engine="gt-beta-http",
                attack_type=data.get("attack_type"),
                evidence=data.get("evidence")
            )
    except Exception as e:
        logger.warning(f"AI Analyst integration failed: {e}. Falling back to deterministic rules.")
        return deterministic_analyze_security_event(analyst_input)
