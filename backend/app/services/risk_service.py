from app.config.rules import RISK_RULES

MAX_RISK_SCORE = 100
ATTEMPT_TIERS = ((50, 50, "High-volume brute-force activity ({n} attempts)"),
                 (20, 35, "Repeated authentication attempts ({n} attempts)"),
                 (5, 20, "Multiple authentication attempts ({n} attempts)"))
AUTH_FAILURE_KEYWORDS = ("login_failed", "authentication_failure", "brute_force", "credential_attack")
CANONICAL_AUTHORIZATION_EVENTS = (
    "idor_object_authorization_mismatch",
    "object_authorization_mismatch",
    "bola_authorization_mismatch",
    "unauthorized_object_access",
)


def calculate_risk(log, *, observed_attempts=0):
    """Deterministic risk engine over server-derived canonical signals only.

    observed_attempts is a separate server-only argument from behavior_service.
    The payload's attempts, severity, risk_score and confidence are ignored.
    """
    score = 0
    reasons = []

    from urllib.parse import unquote, unquote_plus, urlsplit
    event = (log.get("event") or "").lower()
    raw_url = log.get("url") or ""
    try:
        parsed_url = urlsplit(raw_url)
        decoded_path = unquote(parsed_url.path)
        decoded_query = unquote_plus(parsed_url.query) if parsed_url.query else ""
        url = (decoded_path + ("?" + decoded_query if decoded_query else "")).lower()
    except Exception:
        url = unquote(raw_url).lower()
    content = event + " " + url
    user_agent = (log.get("user_agent") or "").lower()
    status_code = log.get("status_code")

    if any(keyword in event for keyword in
           ("login_failed", "authentication_failure", "brute_force", "credential_attack")):
        score += RISK_RULES["FAILED_LOGIN"]
        reasons.append("Authentication failure / brute-force activity")

    # Attempt counts come exclusively from the server-side DB window.
    attempts = observed_attempts
    if isinstance(attempts, int) and not isinstance(attempts, bool):
        for threshold, weight, reason in ATTEMPT_TIERS:
            if attempts >= threshold:
                score += weight
                reasons.append(reason.format(n=attempts))
                break

    if status_code == 401:
        score += RISK_RULES["HTTP_401"]
        reasons.append("HTTP 401 Unauthorized")
    if status_code == 403:
        score += RISK_RULES["HTTP_403"]
        reasons.append("HTTP 403 Forbidden")
    if status_code == 500:
        score += RISK_RULES["HTTP_500"]
        reasons.append("HTTP 500 Error")
    if "/admin" in url:
        score += RISK_RULES["ADMIN_ACCESS"]
        reasons.append("Admin Panel Access")
    if (event.startswith("security [") or "event: " in event) and any(
        canon in event for canon in CANONICAL_AUTHORIZATION_EVENTS
    ):
        score += RISK_RULES["IDOR"]
        reasons.append("Object-Level Authorization Violation (IDOR/BOLA)")
    if any(keyword in content for keyword in ("'", "or 1=1", "union select", "--", "drop table", "insert into")):
        score += RISK_RULES["SQL_INJECTION"]
        reasons.append("Possible SQL Injection")
    if any(keyword in content for keyword in ("<script", "alert(", "onerror=", "onload=")):
        score += RISK_RULES["XSS"]
        reasons.append("Possible XSS Attack")
    if any(keyword in content for keyword in ("../", "..\\", "/etc/passwd", "boot.ini")):
        score += RISK_RULES["PATH_TRAVERSAL"]
        reasons.append("Path Traversal Attempt")
    if any(keyword in content for keyword in ("&&", "||", ";", "$(", "`")):
        score += RISK_RULES["COMMAND_INJECTION"]
        reasons.append("Command Injection Attempt")
    if any(tool in user_agent for tool in ("curl", "python", "wget", "sqlmap", "nikto", "hydra", "nmap")):
        score += RISK_RULES["SUSPICIOUS_USER_AGENT"]
        reasons.append("Suspicious User-Agent")

    score = min(score, MAX_RISK_SCORE)

    if score < 20:
        threat = "LOW"
    elif score < 50:
        threat = "MEDIUM"
    elif score < 80:
        threat = "HIGH"
    else:
        threat = "CRITICAL"

    return {
        "risk_score": score,
        "threat_level": threat,
        "reasons": reasons,
    }
