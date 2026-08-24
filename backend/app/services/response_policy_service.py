from typing import Any


ALLOWED_ACTIONS = {
    "BLOCK_IP",
    "DISABLE_USER",
    "BLOCK_SESSION",
    "ISOLATE_ASSET",
}


def validate_response_action(
    action_type: str,
    target: str,
    confidence: float,
    threat_level: str,
) -> dict[str, Any]:

    if action_type not in ALLOWED_ACTIONS:
        return {
            "allowed": False,
            "reason": f"Unsupported response action: {action_type}",
        }

    if not target:
        return {
            "allowed": False,
            "reason": "Response target is required.",
        }

    if confidence < 0.80:
        return {
            "allowed": False,
            "reason": "AI confidence is below the response threshold.",
        }

    if threat_level not in {"HIGH", "CRITICAL"}:
        return {
            "allowed": False,
            "reason": "Threat level is insufficient for automated response.",
        }

    return {
        "allowed": True,
        "reason": "Response action passed Sentinel safety policy.",
    }