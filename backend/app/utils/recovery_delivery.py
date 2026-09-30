"""Private recovery delivery; never log messages, recipients, or reset tokens."""
import os
import smtplib
import ssl
from dataclasses import dataclass, field
from email.message import EmailMessage
from functools import lru_cache
from typing import Protocol
from urllib.parse import urlsplit, quote

from app.config.runtime import get_runtime_config


class RecoveryDelivery(Protocol):
    def __call__(self, recipient: str, token: str) -> None: ...


@dataclass(frozen=True)
class SMTPConfig:
    host: str
    port: int
    sender: str
    tls: str
    username: str | None = field(default=None, repr=False)
    password: str | None = field(default=None, repr=False)


@lru_cache(maxsize=1)
def get_smtp_config() -> SMTPConfig:
    environment = get_runtime_config().environment
    host = os.environ.get("SMTP_HOST", "").strip()
    sender = os.environ.get("SMTP_FROM", "").strip()
    tls = os.environ.get("SMTP_TLS", "starttls").strip().lower()
    try:
        port = int(os.environ.get("SMTP_PORT", "465" if tls == "ssl" else "587"))
    except ValueError:
        raise ValueError("SMTP_PORT must be a valid port.") from None
    if not host or not sender or "@" not in sender or any(c in host + sender for c in "\r\n"):
        raise ValueError("SMTP_HOST and SMTP_FROM must be configured for recovery delivery.")
    if not 1 <= port <= 65535 or tls not in {"starttls", "ssl", "none"}:
        raise ValueError("Invalid SMTP port or TLS mode.")
    if tls == "none" and not (environment == "development" and host in {"localhost", "127.0.0.1", "::1"}):
        raise ValueError("SMTP TLS is required except for a loopback development inbox.")
    username = os.environ.get("SMTP_USERNAME") or None
    password = os.environ.get("SMTP_PASSWORD") or None
    if bool(username) != bool(password) or (username and tls == "none"):
        raise ValueError("SMTP credentials require both username/password and TLS.")
    return SMTPConfig(host, port, sender, tls, username, password)


def send_recovery_email(recipient: str, token: str) -> None:
    config = get_smtp_config()
    environment = get_runtime_config().environment
    base_url = os.environ.get("RECOVERY_URL", "http://localhost:5173/reset-password" if environment == "development" else "")
    try:
        url = urlsplit(base_url)
        if (url.scheme not in {"http", "https"} or not url.hostname or url.username or url.password
                or url.query or url.fragment or url.path not in {"", "/reset-password"}
                or (environment != "development" and url.scheme != "https")
                or any(c in base_url for c in "\r\n")):
            raise ValueError
    except ValueError:
        raise ValueError("RECOVERY_URL must be an explicit HTTPS reset page URL without credentials or query parameters.") from None
    # Fragments are not sent in HTTP requests or ordinary access logs.
    link = base_url + "#token=" + quote(token, safe="")
    message = EmailMessage()
    message["From"] = config.sender
    message["To"] = recipient
    message["Subject"] = "Sentinel password recovery"
    message.set_content(
        "A password reset was requested for your Sentinel account.\n"
        "Open the link below to choose a new password (valid for 30 minutes):\n\n"
        + link + "\n\nIf you did not request this, ignore this email."
    )
    context = ssl.create_default_context()
    try:
        if config.tls == "ssl":
            client = smtplib.SMTP_SSL(config.host, config.port, timeout=10, context=context)
        else:
            client = smtplib.SMTP(config.host, config.port, timeout=10)
        with client:
            if config.tls == "starttls":
                client.ehlo()
                client.starttls(context=context)
                client.ehlo()
            if config.username:
                client.login(config.username, config.password)
            client.send_message(message)
    except Exception:
        raise RuntimeError("Recovery delivery unavailable.") from None


def get_recovery_delivery() -> RecoveryDelivery:
    """FastAPI dependency; tests override with a private, in-memory sink."""
    return send_recovery_email
