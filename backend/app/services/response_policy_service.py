import math
from ipaddress import ip_address

ALLOWED_ACTIONS = {"BLOCK_IP"}


def validate_response_action(action_type, target, confidence, threat_level):
    """Eligibility only, never authorization. The response route separately
    requires authenticated tenant analyst approval and incident target binding.
    """
    if action_type not in ALLOWED_ACTIONS:
        return {"allowed": False, "reason": "Unsupported response simulation"}
    try:
        if not isinstance(target, str) or len(target) > 50 or "%" in target:
            raise ValueError
        ip_address(target)
    except ValueError:
        return {"allowed": False, "reason": "A valid incident source IP is required"}
    if type(confidence) not in (int, float) or not math.isfinite(confidence) or not 0.8 <= confidence <= 1:
        return {"allowed": False, "reason": "Confidence is below the eligibility threshold"}
    if threat_level not in {"HIGH", "CRITICAL"}:
        return {"allowed": False, "reason": "Threat level is insufficient"}
    return {"allowed": True, "requires_approval": True,
            "reason": "Eligible for authenticated analyst-approved simulation; source attribution requires verification"}
