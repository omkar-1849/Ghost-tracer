from urllib.parse import unquote
from app.schemas.event_schema import CanonicalSecurityEvent
from app.services.behavior_service import is_auth_failure


def detect_event(event: CanonicalSecurityEvent, attempt_signal=None):
    """Deterministic indicators in reported telemetry, not proof of compromise."""
    detections = []

    def add(rule, category, confidence, reason):
        detections.append({"rule": rule, "category": category, "confidence": confidence,
                           "reason": reason, "severity": "Medium"})

    auth = is_auth_failure(event.event_type, event.status_code)
    if auth:
        add("AUTH_FAILURE_ACTIVITY", "Authentication", 0.8, "Reported authentication failure")
    meta_values = " ".join(str(v) for v in (event.metadata or {}).values()) if isinstance(event.metadata, dict) else ""
    text = unquote(" ".join((event.event_type or "", event.url or "", event.title or "", event.description or "", meta_values))).lower()
    patterns = (
        ("SQL_INJECTION_PATTERN", ("or 1=1", "union select", "drop table"), "Possible SQL injection pattern"),
        ("XSS_PATTERN", ("<script", "onerror=", "onload="), "Possible cross-site scripting pattern"),
        ("PATH_TRAVERSAL_PATTERN", ("../", "..\\", "/etc/passwd"), "Possible path traversal pattern"),
        ("COMMAND_INJECTION_PATTERN", ("$(", "`", "&&"), "Possible command injection pattern"),
    )
    for rule, tokens, reason in patterns:
        if any(token in text for token in tokens):
            add(rule, "Request pattern", 0.85, reason)
    if event.event_type in {"suspicious_request", "malicious_request", "attack"}:
        add("REPORTED_SUSPICIOUS_REQUEST", "Reported activity", 0.6, "Integration reported suspicious activity")
    if attempt_signal and attempt_signal.get("attempts", 0) >= 5:
        add("REPEATED_AUTH_FAILURE", "Authentication", 0.8, "Repeated reported failures in tenant database history")
    return {"detected": bool(detections), "detection_count": len(detections),
            "detections": detections, "auth_failure": auth, "engine": "deterministic_rules_v1"}
