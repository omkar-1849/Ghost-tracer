# Sentinel Python SDK

## Installation

```bash
pip install requests
```

## Usage

```python
from sentinel import Sentinel

client = Sentinel(
    api_key="YOUR_API_KEY",
    base_url="http://127.0.0.1:8000",
)

client.log(
    title="Login Success",
    source="Django",
    event_type="Authentication",
    severity="Info",
)
```

The SDK automatically sends events to Sentinel using your API Key.