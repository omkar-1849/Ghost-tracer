from app.config.rules import RISK_RULES


def calculate_risk(log):
    """
    Calculates the risk score of an incoming log.

    Input:
        log -> dictionary containing event information

    Output:
        {
            "risk_score": int,
            "threat_level": str,
            "reasons": list
        }
    """

    score = 0
    reasons = []

    # Rule 1: Failed Login
    if "login_failed" in log.get("event", "").lower():
        score += RISK_RULES["FAILED_LOGIN"]
        reasons.append("Failed Login")

    # Rule 2: HTTP 401 Unauthorized
    if log.get("status_code") == 401:
        score += RISK_RULES["HTTP_401"]
        reasons.append("HTTP 401 Unauthorized")

    # Rule 3: HTTP 403 Forbidden
    if log.get("status_code") == 403:
        score += RISK_RULES["HTTP_403"]
        reasons.append("HTTP 403 Forbidden")

    # Rule 4: HTTP 500 Internal Server Error
    if log.get("status_code") == 500:
        score += RISK_RULES["HTTP_500"]
        reasons.append("HTTP 500 Error")

    # Rule 5: Admin Panel Access
    if "/admin" in log.get("url", "").lower():
        score += RISK_RULES["ADMIN_ACCESS"]
        reasons.append("Admin Panel Access")

    # Rule 6: SQL Injection Attempt
    message = log.get("event", "").lower()

    if any(keyword in message for keyword in [
        "'",
        "or 1=1",
        "union select",
        "--",
        "drop table",
        "insert into"
    ]):
        score += RISK_RULES["SQL_INJECTION"]
        reasons.append("Possible SQL Injection")

    # Rule 7: XSS Attempt
    if any(keyword in message for keyword in [
        "<script",
        "alert(",
        "onerror=",
        "onload="
    ]):
        score += RISK_RULES["XSS"]
        reasons.append("Possible XSS Attack")

    # Rule 8: Path Traversal
    if any(keyword in message for keyword in [
        "../",
        "..\\",
        "/etc/passwd",
        "boot.ini"
    ]):
        score += RISK_RULES["PATH_TRAVERSAL"]
        reasons.append("Path Traversal Attempt")

    # Rule 9: Command Injection
    if any(keyword in message for keyword in [
        "&&",
        "||",
        ";",
        "$(",
        "`"
    ]):
        score += RISK_RULES["COMMAND_INJECTION"]
        reasons.append("Command Injection Attempt")

    # Rule 10: Suspicious User-Agent
    ua = log.get("user_agent", "").lower()

    if any(tool in ua for tool in [
        "curl",
        "python",
        "wget",
        "sqlmap",
        "nikto",
        "hydra",
        "nmap"
    ]):
        score += RISK_RULES["SUSPICIOUS_USER_AGENT"]
        reasons.append("Suspicious User-Agent")

    # Decide Threat Level
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
        "reasons": reasons
    }