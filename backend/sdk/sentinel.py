import requests


class Sentinel:
    def __init__(self, api_key, base_url="http://127.0.0.1:8000"):
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json",
        }

    def log(
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
        payload = {
            "title": title,
            "source": source,
            "event_type": event_type,
            "severity": severity,
            "description": description,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "metadata": event_metadata or {},
        }

        return requests.post(
            f"{self.base_url}/events/",
            json=payload,
            headers=self.headers,
            timeout=10,
        )