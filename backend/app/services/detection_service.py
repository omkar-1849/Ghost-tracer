from typing import Any

from app.schemas.event_schema import CanonicalSecurityEvent


def detect_event(
    event: CanonicalSecurityEvent,
) -> dict[str, Any]:

    detections = []

    event_type = event.event_type.lower()
    severity = event.severity

    # Authentication / Brute-Force Detection
    if event_type in {
        "authentication_failure",
        "brute_force",
        "brute_force_test",
        "brute_force_attack",
    }:
        detections.append(
            {
                "rule": "AUTH_FAILURE_ACTIVITY",
                "category": "Authentication Attack",
                "severity": severity,
                "confidence": 0.85,
                "reason": "Authentication failure or brute-force activity detected.",
            }
        )

    # HTTP Authorization Failure
    if event.status_code in {401, 403}:
        detections.append(
            {
                "rule": "AUTHORIZATION_FAILURE",
                "category": "Suspicious Request",
                "severity": severity,
                "confidence": 0.80,
                "reason": "HTTP authorization failure detected.",
            }
        )

    # Suspicious Web Request
    if event_type in {
        "suspicious_request",
        "malicious_request",
        "attack",
    }:
        detections.append(
            {
                "rule": "SUSPICIOUS_REQUEST",
                "category": "Web Attack",
                "severity": severity,
                "confidence": 0.80,
                "reason": "Suspicious web request detected.",
            }
        )

    return {
        "detected": bool(detections),
        "detection_count": len(detections),
        "detections": detections,
    }