"""Sentinel SDK: sends events to a Sentinel deployment over HTTP."""
import requests


class Sentinel:
    def __init__(self, api_key, base_url="http://127.0.0.1:8000", timeout=10):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json",
        }

    def send_event(
        self,
        title,
        source,
        event_type,
        severity="Info",
        description=None,
        ip_address=None,
        user_agent=None,
        event_metadata=None,
    ):
        """event_metadata is the single canonical alias for metadata.

        A conflicting metadata/event_metadata pair is rejected by the API
        (backwards compatibility: metadata is still accepted alone).
        """
        payload = {
            "title": title,
            "source": source,
            "event_type": event_type,
            "severity": severity,
            "description": description,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "event_metadata": event_metadata if event_metadata is not None else {},
        }

        return requests.post(
            f"{self.base_url}/events",
            json=payload,
            headers=self.headers,
            timeout=self.timeout,
        )

    # Compatibility name for existing integrations.
    log = send_event
