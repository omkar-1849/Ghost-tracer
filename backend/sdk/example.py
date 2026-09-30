from sentinel import Sentinel

client = Sentinel(
    api_key="sk_your_api_key",
    base_url="http://127.0.0.1:8000",
)

response = client.send_event(
    title="SQL Injection Attempt",
    source="Flask",
    event_type="Attack",
    severity="Critical",
    description="Blocked SQL injection payload.",
    ip_address="203.0.113.10",
    event_metadata={"path": "/login", "status_code": 403},
)

print(response.status_code)
print(response.text)
