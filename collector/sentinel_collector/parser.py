"""Multi-format log line parser for Sentinel Collector.

Parses web and application log formats into Sentinel LogCreate telemetry records:
1. Nginx Combined Log Format (Standard & Extended)
2. Zerodha Structured JSON Security Log (HTTP_REQUEST, AUTH, SECURITY_EVENT)
3. Zerodha Application Text Log ([asctime] [LEVEL] [logger]: message)
4. Safe Generic Log Line Fallback

Strict Security Invariants:
- Never produces identity or tenant fields (organization_id, website_id, integration_id).
- Never trusts client-asserted threat levels or risk scores (all scoring is server-side).
- Never crashes on malformed lines, unexpected JSON structures, or invalid encodings.
- All output strings are strictly sanitized for safe ASCII/printable characters and bounded length.
"""

import ipaddress
import json
import re
from typing import Any, Dict, Optional

# Supported canonical HTTP methods
HTTP_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "CONNECT", "TRACE"}

# 1. Standard Nginx combined log format:
# $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"
NGINX_COMBINED_REGEX = re.compile(
    r'^(?P<ip>\S+)\s+'                          # $remote_addr
    r'\S+\s+'                                  # ident (usually -)
    r'(?P<user>\S+)\s+'                        # $remote_user
    r'\[(?P<time>[^\]]+)\]\s+'                 # [$time_local]
    r'"(?P<method>[A-Z]+)\s+(?P<url>\S+)\s*(?P<proto>[^"]*)"\s+'  # "$request"
    r'(?P<status>\d{3})\s+'                    # $status
    r'(?P<bytes>\S+)\s+'                       # $body_bytes_sent
    r'"(?P<referer>[^"]*)"\s+'                 # "$http_referer"
    r'"(?P<user_agent>[^"]*)"'                 # "$http_user_agent"
)

# 2. Zerodha Application Log Header Regex:
# [%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s
ZERODHA_APP_LOG_REGEX = re.compile(
    r'^\[(?P<time>\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]\s+'
    r'\[(?P<level>[A-Z]+)\]\s+'
    r'\[(?P<logger>[^\]]+)\]:\s+'
    r'(?P<msg>.*)$'
)

# Zerodha App Sub-patterns:
# a) HTTP Request Summary: GET /about -> 200 (2.9ms) from testclient
ZERODHA_APP_HTTP_REGEX = re.compile(
    r'^(?P<method>[A-Z]+)\s+(?P<url>\S+)\s+->\s+(?P<status>\d{3})\s+'
    r'\((?P<dur>[^\)]+)\)\s+from\s+(?P<src>\S+)'
)

# b) Auth Summary: AUTH LOGIN_SUCCESS | User: rahul_sharma | Status: SUCCESS | IP: testclient | Detail: Session established
ZERODHA_APP_AUTH_REGEX = re.compile(
    r'^AUTH\s+(?P<event>[A-Z_]+)\s*\|\s*'
    r'User:\s*(?P<user>[^|]+)\s*\|\s*'
    r'Status:\s*(?P<status>[^|]+)\s*\|\s*'
    r'IP:\s*(?P<ip>[^|]+)'
    r'(?:\s*\|\s*Detail:\s*(?P<detail>.*))?'
)

# c) Security Summary: SECURITY [HIGH] IDOR_OBJECT_AUTHORIZATION_MISMATCH at /api/profile by testclient: Authenticated user ID 7 accessed profile of user ID 2
ZERODHA_APP_SEC_REGEX = re.compile(
    r'^SECURITY\s+\[(?P<sev>[A-Z]+)\]\s+(?P<event>\S+)\s+at\s+'
    r'(?P<endpoint>\S+)\s+by\s+(?P<ip>[^:]+):\s*(?P<detail>.*)'
)

IP_REGEX = re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b')


def _sanitize_string(val: Any, max_len: int = 255) -> str:
    """Sanitize string for safe printable text within max length."""
    if val is None:
        return ""
    text = str(val).strip()
    # Strip non-printable/control chars < 32 and DEL (127)
    sanitized = "".join(c for c in text if 32 <= ord(c) < 127 or ord(c) > 127)
    return sanitized[:max_len].strip()


def _is_valid_ip(val: Any) -> bool:
    """Check whether value is a syntactically valid IPv4 or IPv6 address."""
    if not val or not isinstance(val, str):
        return False
    clean = val.strip()
    if "%" in clean or " " in clean:
        return False
    try:
        ipaddress.ip_address(clean)
        return True
    except ValueError:
        return False


def _ensure_valid_ip(val: Any, default: str = "127.0.0.1") -> str:
    """Return valid IP address string, falling back to default."""
    if _is_valid_ip(val):
        return str(ipaddress.ip_address(str(val).strip()))
    return default


def _ensure_valid_method(val: Any, default: str = "GET") -> str:
    """Ensure HTTP method is valid and uppercase."""
    if not val:
        return default
    clean = _sanitize_string(val, max_len=10).upper()
    return clean if clean in HTTP_METHODS else default


def _ensure_valid_url(val: Any, default: str = "/") -> str:
    """Ensure URL is well-formed relative path or absolute HTTP(S) URL."""
    if not val:
        return default
    clean = _sanitize_string(val, max_len=255)
    if not clean:
        return default
    if clean.startswith("/") or clean.startswith("http://") or clean.startswith("https://"):
        return clean[:255]
    return f"/{clean}"[:255]


def _ensure_valid_status_code(val: Any, default: int = 200) -> int:
    """Ensure status code is an integer between 100 and 599."""
    try:
        code = int(val)
        return code if 100 <= code <= 599 else default
    except (ValueError, TypeError):
        return default


def _parse_zerodha_json_log(data: Dict[str, Any], raw_line: str) -> Optional[Dict[str, Any]]:
    """Parse Zerodha structured JSON security log into Sentinel LogCreate record."""
    event_type = _sanitize_string(data.get("type", "")).upper()

    if event_type == "HTTP_REQUEST":
        raw_ip = data.get("client_ip") or data.get("ip") or data.get("src_ip")
        ip_addr = _ensure_valid_ip(raw_ip)
        method = _ensure_valid_method(data.get("method"))
        path = _ensure_valid_url(data.get("path") or data.get("url") or "/")
        query = _sanitize_string(data.get("query_string") or data.get("query") or "", max_len=200)
        full_url = _ensure_valid_url(f"{path}?{query}" if query else path)
        status_code = _ensure_valid_status_code(data.get("status_code"), 200)
        user_agent = _sanitize_string(data.get("user_agent") or "Mozilla/5.0", max_len=255)
        duration = data.get("duration_ms")

        dur_str = f" ({float(duration):.1f}ms)" if isinstance(duration, (int, float)) else ""
        src_note = f" from {raw_ip}" if raw_ip and not _is_valid_ip(raw_ip) else ""
        message = _sanitize_string(f"HTTP {method} {full_url} -> {status_code}{dur_str}{src_note}", max_len=255)

        return {
            "ip_address": ip_addr,
            "method": method,
            "url": full_url,
            "status_code": status_code,
            "user_agent": user_agent,
            "message": message,
        }

    elif event_type == "AUTH":
        raw_ip = data.get("client_ip") or data.get("ip")
        ip_addr = _ensure_valid_ip(raw_ip)
        event_name = _sanitize_string(data.get("event") or "AUTH_EVENT", max_len=50)
        username = _sanitize_string(data.get("username") or "", max_len=50)
        user_id = data.get("user_id")
        status = _sanitize_string(data.get("status") or "UNKNOWN", max_len=30)
        detail = _sanitize_string(data.get("detail") or "", max_len=120)

        method = "POST"
        if "REGISTER" in event_name.upper():
            url = "/api/register"
        elif "LOGOUT" in event_name.upper():
            url = "/api/logout"
        else:
            url = "/api/login"

        status_upper = status.upper()
        event_upper = event_name.upper()
        if status_upper in ("SUCCESS", "OK"):
            status_code = 200
        elif "SUSPICIOUS" in event_upper or "SUSPICIOUS" in status_upper:
            status_code = 403
        elif status_upper in ("FAILED", "FAILURE", "ERROR") or "FAIL" in event_upper:
            status_code = 401
        else:
            status_code = 200

        user_agent = _sanitize_string(data.get("user_agent") or "Zerodha-Auth/1.0", max_len=255)

        user_str = f"{username} (ID: {user_id})" if user_id is not None and username else (username or (f"ID: {user_id}" if user_id is not None else ""))
        parts = [f"AUTH {event_name}"]
        if user_str:
            parts.append(f"User: {user_str}")
        if status:
            parts.append(f"Status: {status}")
        if raw_ip and not _is_valid_ip(raw_ip):
            parts.append(f"Src: {raw_ip}")
        if detail:
            parts.append(f"Detail: {detail}")
        message = _sanitize_string(" | ".join(parts), max_len=255)

        return {
            "ip_address": ip_addr,
            "method": method,
            "url": url,
            "status_code": status_code,
            "user_agent": user_agent,
            "message": message,
        }

    elif event_type == "SECURITY_EVENT":
        raw_ip = data.get("client_ip") or data.get("ip")
        ip_addr = _ensure_valid_ip(raw_ip)
        event_name = _sanitize_string(data.get("event") or "SECURITY_VIOLATION", max_len=60)
        severity = _sanitize_string(data.get("severity") or "HIGH", max_len=20).upper()
        endpoint = data.get("endpoint") or data.get("path") or "/api/security"
        url = _ensure_valid_url(endpoint)
        user_id = data.get("user_id")
        detail = _sanitize_string(data.get("detail") or "", max_len=140)

        endpoint_lower = url.lower()
        if "/search" in endpoint_lower or "/profile" in endpoint_lower or "/portfolio" in endpoint_lower or "/me" in endpoint_lower:
            method = "GET"
        else:
            method = "POST"

        event_upper = event_name.upper()
        if "IDOR" in event_upper or "AUTHORIZATION" in event_upper or "FORBIDDEN" in event_upper:
            status_code = 403
        elif "EXCEPTION" in event_upper or "ERROR" in event_upper or severity == "ERROR":
            status_code = 500
        elif "NOT_FOUND" in event_upper:
            status_code = 404
        else:
            status_code = 400

        user_agent = _sanitize_string(data.get("user_agent") or "Zerodha-Security/1.0", max_len=255)

        user_str = f" [User ID: {user_id}]" if user_id is not None else ""
        src_str = f" from {raw_ip}" if raw_ip and not _is_valid_ip(raw_ip) else ""
        message = _sanitize_string(f"SECURITY [{severity}] {event_name} at {url}{user_str}{src_str}: {detail}", max_len=255)

        return {
            "ip_address": ip_addr,
            "method": method,
            "url": url,
            "status_code": status_code,
            "user_agent": user_agent,
            "message": message,
        }

    else:
        # Generic JSON log parser
        raw_ip = data.get("client_ip") or data.get("ip") or data.get("src_ip") or data.get("remote_addr")
        ip_addr = _ensure_valid_ip(raw_ip)
        method = _ensure_valid_method(data.get("method") or data.get("http_method"))
        path = data.get("path") or data.get("url") or data.get("uri") or "/"
        query = data.get("query_string") or data.get("query") or data.get("args") or ""
        full_url = _ensure_valid_url(f"{path}?{query}" if query else path)
        status_code = _ensure_valid_status_code(data.get("status_code") or data.get("status"), 200)
        user_agent = _sanitize_string(data.get("user_agent") or data.get("http_user_agent") or "JSON/Logger", max_len=255)
        raw_msg = data.get("message") or data.get("msg") or data.get("detail") or raw_line
        message = _sanitize_string(str(raw_msg), max_len=255)

        return {
            "ip_address": ip_addr,
            "method": method,
            "url": full_url,
            "status_code": status_code,
            "user_agent": user_agent,
            "message": message or f"JSON event: {event_type or 'unspecified'}",
        }


def _parse_zerodha_app_log(match: re.Match, raw_line: str) -> Optional[Dict[str, Any]]:
    """Parse Zerodha application text log format into Sentinel LogCreate record."""
    gd = match.groupdict()
    level = _sanitize_string(gd.get("level", "INFO")).upper()
    logger_name = _sanitize_string(gd.get("logger", "app"))
    msg = gd.get("msg", "").strip()

    # Case A: HTTP Request summary
    http_match = ZERODHA_APP_HTTP_REGEX.match(msg)
    if http_match:
        hgd = http_match.groupdict()
        method = _ensure_valid_method(hgd["method"])
        url = _ensure_valid_url(hgd["url"])
        status_code = _ensure_valid_status_code(hgd["status"])
        src = hgd["src"].strip()
        ip_addr = _ensure_valid_ip(src)
        user_agent = "Zerodha-App"
        message = _sanitize_string(f"{method} {url} -> {status_code} ({hgd['dur']}) from {src}", max_len=255)

        return {
            "ip_address": ip_addr,
            "method": method,
            "url": url,
            "status_code": status_code,
            "user_agent": user_agent,
            "message": message,
        }

    # Case B: Auth event summary
    auth_match = ZERODHA_APP_AUTH_REGEX.match(msg)
    if auth_match:
        agd = auth_match.groupdict()
        event_name = _sanitize_string(agd["event"], max_len=50)
        user = _sanitize_string(agd["user"], max_len=50)
        status = _sanitize_string(agd["status"], max_len=30)
        src_ip = agd["ip"].strip()
        ip_addr = _ensure_valid_ip(src_ip)
        detail = _sanitize_string(agd.get("detail") or "", max_len=120)

        method = "POST"
        url = "/api/register" if "REGISTER" in event_name.upper() else "/api/login"
        status_code = 200 if "SUCCESS" in status.upper() else 401
        user_agent = "Zerodha-Auth"
        message = _sanitize_string(msg, max_len=255)

        return {
            "ip_address": ip_addr,
            "method": method,
            "url": url,
            "status_code": status_code,
            "user_agent": user_agent,
            "message": message,
        }

    # Case C: Security event summary
    sec_match = ZERODHA_APP_SEC_REGEX.match(msg)
    if sec_match:
        sgd = sec_match.groupdict()
        severity = _sanitize_string(sgd["sev"], max_len=20).upper()
        event_name = _sanitize_string(sgd["event"], max_len=60)
        endpoint = sgd["endpoint"].strip()
        url = _ensure_valid_url(endpoint)
        src_ip = sgd["ip"].strip()
        ip_addr = _ensure_valid_ip(src_ip)

        endpoint_lower = url.lower()
        if "/search" in endpoint_lower or "/profile" in endpoint_lower or "/portfolio" in endpoint_lower or "/me" in endpoint_lower:
            method = "GET"
        else:
            method = "POST"

        event_upper = event_name.upper()
        if "IDOR" in event_upper or "AUTHORIZATION" in event_upper:
            status_code = 403
        elif "EXCEPTION" in event_upper or "ERROR" in event_upper or severity == "ERROR":
            status_code = 500
        else:
            status_code = 400

        user_agent = "Zerodha-Security"
        message = _sanitize_string(msg, max_len=255)

        return {
            "ip_address": ip_addr,
            "method": method,
            "url": url,
            "status_code": status_code,
            "user_agent": user_agent,
            "message": message,
        }

    # Case D: Generic application message
    ip_match = IP_REGEX.search(msg)
    ip_addr = ip_match.group(0) if ip_match else "127.0.0.1"
    status_code = 500 if level == "ERROR" else (400 if level == "WARNING" else 200)
    message = _sanitize_string(f"[{level}] [{logger_name}]: {msg}", max_len=255)

    return {
        "ip_address": ip_addr,
        "method": "GET",
        "url": "/",
        "status_code": status_code,
        "user_agent": "Zerodha-App",
        "message": message or "Application log message",
    }


def _parse_nginx_combined_line(match: re.Match, clean_line: str) -> Optional[Dict[str, Any]]:
    """Parse standard Nginx combined log line."""
    gd = match.groupdict()
    status_code = _ensure_valid_status_code(gd["status"], 200)
    method = _ensure_valid_method(gd["method"])
    url = _ensure_valid_url(gd["url"])
    user_agent = _sanitize_string(gd.get("user_agent") or "", max_len=255)
    ip_addr = _ensure_valid_ip(gd["ip"])

    return {
        "ip_address": ip_addr,
        "method": method,
        "url": url,
        "status_code": status_code,
        "user_agent": user_agent,
        "message": _sanitize_string(f"{method} {url} HTTP {status_code}", max_len=255),
    }


def _parse_fallback_line(clean_line: str) -> Optional[Dict[str, Any]]:
    """Fallback parser for non-standard lines."""
    ip_match = IP_REGEX.search(clean_line)
    ip_addr = ip_match.group(0) if ip_match else "127.0.0.1"
    line_after_ip = clean_line[ip_match.end():] if ip_match else clean_line

    status_match = re.search(r'\b([1-5]\d{2})\b', line_after_ip)
    status_code = int(status_match.group(1)) if status_match else 200

    method_match = re.search(r'\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b', clean_line)
    method = method_match.group(1) if method_match else "GET"

    return {
        "ip_address": ip_addr,
        "method": method,
        "url": "/",
        "status_code": status_code,
        "user_agent": "Nginx/Daemon",
        "message": _sanitize_string(clean_line, max_len=255),
    }


def parse_log_line(line: str) -> Optional[Dict[str, Any]]:
    """Parse a single log line into a Sentinel LogCreate item dictionary.

    Dispatches across:
    1. Line-delimited JSON (Zerodha security.log, structured app events)
    2. Nginx Combined Log format (Standard & Extended)
    3. Zerodha Application Text Log ([asctime] [LEVEL] [logger]: ...)
    4. Fallback generic text parser

    Returns a dict strictly adhering to LogCreate schema:
      - ip_address (str): Valid IPv4 or IPv6 string
      - method (str): Upper-case canonical HTTP method
      - url (str): Relative or absolute URL (max 255 chars)
      - status_code (int): 100 <= status_code <= 599
      - user_agent (str): Sanitized string (max 255 chars)
      - message (str): Sanitized event description (max 255 chars)
    """
    if not line:
        return None
    clean_line = line.strip()
    if not clean_line:
        return None

    # Dispatch 1: Structured JSON format
    if clean_line.startswith("{") and clean_line.endswith("}"):
        try:
            data = json.loads(clean_line)
            if isinstance(data, dict):
                return _parse_zerodha_json_log(data, clean_line)
        except Exception:
            # Fall through to text parsers if JSON decode fails
            pass

    # Dispatch 2: Standard Nginx Combined format
    match_nginx = NGINX_COMBINED_REGEX.match(clean_line)
    if match_nginx:
        return _parse_nginx_combined_line(match_nginx, clean_line)

    # Dispatch 3: Zerodha Application Log format
    match_app = ZERODHA_APP_LOG_REGEX.match(clean_line)
    if match_app:
        return _parse_zerodha_app_log(match_app, clean_line)

    # Dispatch 4: Fallback generic parser
    return _parse_fallback_line(clean_line)


# Backward-compatible alias for existing imports
parse_nginx_log_line = parse_log_line
