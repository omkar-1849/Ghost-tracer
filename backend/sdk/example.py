from sentinel import Sentinel

client = Sentinel(
    api_key="sk_BK6q0mz5d6jZeBP2bM6cOHCQ2aw-T4CC",
    base_url="http://127.0.0.1:8000",
)

response = client.log(
    title="SQL Injection Attempt",
    source="Flask",
    event_type="Attack",
    severity="Critical",
    description="Blocked SQL injection payload.",
)

print(response.status_code)
print(response.text)