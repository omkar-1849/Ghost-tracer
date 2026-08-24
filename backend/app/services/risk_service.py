from app.config.rules import RISK_RULES


def calculate_risk(log):
    """
    Calculates the risk score of an incoming security event.

    The deterministic risk engine handles raw security signals.
    The LLM will later receive the compact result instead of
    processing the entire raw event.
    """

    score = 0
    reasons = []

    event = log.get("event", "").lower()
    url = log.get("url", "").lower()
    user_agent = log.get("user_agent", "").lower()
    status_code = log.get("status_code")

    # ---------------------------------------------------------
    # Rule 1: Failed Login
    # ---------------------------------------------------------
    if any(keyword in event for keyword in [
        "login_failed",
        "authentication_failure",
        "brute_force",
        "credential_attack",
    ]):
        score += RISK_RULES["FAILED_LOGIN"]
        reasons.append("Authentication failure / brute-force activity")

    # ---------------------------------------------------------
    # Rule 2: Brute-Force Attempt Count
    # ---------------------------------------------------------
    attempts = log.get("attempts", 0)

    if isinstance(attempts, int):
        if attempts >= 50:
            score += 50
            reasons.append(
                f"High-volume brute-force activity ({attempts} attempts)"
            )

        elif attempts >= 20:
            score += 35
            reasons.append(
                f"Repeated authentication attempts ({attempts} attempts)"
            )

        elif attempts >= 5:
            score += 20
            reasons.append(
                f"Multiple authentication attempts ({attempts} attempts)"
            )

    # ---------------------------------------------------------
    # Rule 3: HTTP 401 Unauthorized
    # ---------------------------------------------------------
    if status_code == 401:
        score += RISK_RULES["HTTP_401"]
        reasons.append("HTTP 401 Unauthorized")

    # ---------------------------------------------------------
    # Rule 4: HTTP 403 Forbidden
    # ---------------------------------------------------------
    if status_code == 403:
        score += RISK_RULES["HTTP_403"]
        reasons.append("HTTP 403 Forbidden")

    # ---------------------------------------------------------
    # Rule 5: HTTP 500 Internal Server Error
    # ---------------------------------------------------------
    if status_code == 500:
        score += RISK_RULES["HTTP_500"]
        reasons.append("HTTP 500 Error")

    # ---------------------------------------------------------
    # Rule 6: Admin Panel Access
    # ---------------------------------------------------------
    if "/admin" in url:
        score += RISK_RULES["ADMIN_ACCESS"]
        reasons.append("Admin Panel Access")

    # ---------------------------------------------------------
    # Rule 7: SQL Injection
    # ---------------------------------------------------------
    if any(keyword in event for keyword in [
        "'",
        "or 1=1",
        "union select",
        "--",
        "drop table",
        "insert into",
    ]):
        score += RISK_RULES["SQL_INJECTION"]
        reasons.append("Possible SQL Injection")

    # ---------------------------------------------------------
    # Rule 8: XSS
    # ---------------------------------------------------------
    if any(keyword in event for keyword in [
        "<script",
        "alert(",
        "onerror=",
        "onload=",
    ]):
        score += RISK_RULES["XSS"]
        reasons.append("Possible XSS Attack")

    # ---------------------------------------------------------
    # Rule 9: Path Traversal
    # ---------------------------------------------------------
    if any(keyword in event for keyword in [
        "../",
        "..\\",
        "/etc/passwd",
        "boot.ini",
    ]):
        score += RISK_RULES["PATH_TRAVERSAL"]
        reasons.append("Path Traversal Attempt")

    # ---------------------------------------------------------
    # Rule 10: Command Injection
    # ---------------------------------------------------------
    if any(keyword in event for keyword in [
        "&&",
        "||",
        ";",
        "$(",
        "`",
    ]):
        score += RISK_RULES["COMMAND_INJECTION"]
        reasons.append("Command Injection Attempt")

    # ---------------------------------------------------------
    # Rule 11: Suspicious User-Agent
    # ---------------------------------------------------------
    if any(tool in user_agent for tool in [
        "curl",
        "python",
        "wget",
        "sqlmap",
        "nikto",
        "hydra",
        "nmap",
    ]):
        score += RISK_RULES["SUSPICIOUS_USER_AGENT"]
        reasons.append("Suspicious User-Agent")

    # ---------------------------------------------------------
    # Cap score
    # ---------------------------------------------------------
    score = min(score, 100)

    # ---------------------------------------------------------
    # Threat Level
    # ---------------------------------------------------------
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