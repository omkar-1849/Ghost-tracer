"""
Shared utilities for all scanner engines.

Provides safe subprocess execution, output normalization,
severity mapping, risk scoring, and URL parsing helpers.
"""

import re
import shutil
import subprocess
from datetime import datetime, timedelta
from urllib.parse import urlparse
from typing import List, Dict, Optional


# ---------------------------------------------------------------------------
# Timestamp helper (IST offset matching project convention)
# ---------------------------------------------------------------------------

def ist_now() -> datetime:
    """Return current time in IST (UTC+5:30), matching project convention."""
    return datetime.utcnow() + timedelta(hours=5, minutes=30)


# ---------------------------------------------------------------------------
# Subprocess execution
# ---------------------------------------------------------------------------

def run_subprocess(cmd: list, timeout: int = 300) -> dict:
    """
    Safely execute a subprocess command.

    - Never uses shell=True.
    - Captures stdout and stderr.
    - Handles FileNotFoundError and TimeoutExpired gracefully.
    - Never crashes FastAPI.

    Returns:
        dict with keys: success, stdout, stderr, returncode, error
    """
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout or "",
            "stderr": result.stderr or "",
            "returncode": result.returncode,
            "error": None,
        }
    except FileNotFoundError:
        binary = cmd[0] if cmd else "unknown"
        return {
            "success": False,
            "stdout": "",
            "stderr": "",
            "returncode": -1,
            "error": f"Binary not found: {binary}. Please ensure it is installed and on PATH.",
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "stdout": "",
            "stderr": "",
            "returncode": -1,
            "error": f"Scan timed out after {timeout} seconds.",
        }
    except Exception as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": "",
            "returncode": -1,
            "error": f"Subprocess error: {str(e)}",
        }


# ---------------------------------------------------------------------------
# Binary availability
# ---------------------------------------------------------------------------

def check_binary(name: str) -> bool:
    """Check if a binary/command exists on PATH."""
    return shutil.which(name) is not None


# ---------------------------------------------------------------------------
# URL helpers
# ---------------------------------------------------------------------------

def extract_hostname(url: str) -> str:
    """Extract bare hostname from a URL string."""
    parsed = urlparse(url if "://" in url else f"https://{url}")
    return parsed.hostname or url


def extract_host_port(url: str) -> tuple:
    """
    Extract (hostname, port) from a URL.
    Defaults to 443 for https, 80 for http.
    """
    parsed = urlparse(url if "://" in url else f"https://{url}")
    hostname = parsed.hostname or url
    port = parsed.port
    if port is None:
        port = 443 if parsed.scheme == "https" else 80
    return hostname, port


# ---------------------------------------------------------------------------
# Output cleanup
# ---------------------------------------------------------------------------

_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[a-zA-Z]")


def clean_output(text: str, max_length: int = 50_000) -> str:
    """
    Strip ANSI escape codes and null bytes, then truncate to max_length.
    Returns empty string for None/empty input.
    """
    if not text:
        return ""
    text = _ANSI_RE.sub("", text)
    text = text.replace("\x00", "")
    if len(text) > max_length:
        text = text[:max_length] + "\n\n... [OUTPUT TRUNCATED] ..."
    return text


# ---------------------------------------------------------------------------
# Severity normalization
# ---------------------------------------------------------------------------

SEVERITY_WEIGHTS = {
    "critical": 25,
    "high": 15,
    "medium": 8,
    "low": 3,
    "info": 1,
}

_SEVERITY_MAP = {
    "critical": "critical",
    "high": "high",
    "medium": "medium",
    "moderate": "medium",
    "low": "low",
    "info": "info",
    "informational": "info",
    "information": "info",
    "none": "info",
    "unknown": "info",
}


def normalize_severity(severity: str) -> str:
    """Map varied severity labels to one of: critical, high, medium, low, info."""
    if not severity:
        return "info"
    return _SEVERITY_MAP.get(severity.strip().lower(), "info")


# ---------------------------------------------------------------------------
# Risk scoring
# ---------------------------------------------------------------------------

def calculate_risk_score(findings: List[Dict]) -> int:
    """
    Calculate a weighted risk score from a list of findings.
    Each finding should have a 'severity' key. Score is capped at 100.
    """
    score = 0
    for finding in findings:
        sev = normalize_severity(finding.get("severity", "info"))
        score += SEVERITY_WEIGHTS.get(sev, 1)
    return min(score, 100)
