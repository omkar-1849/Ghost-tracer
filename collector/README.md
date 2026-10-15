# Sentinel Collector

Standalone, lightweight log tailer and collector daemon for Sentinel SIEM.

## Overview

`sentinel-collector` tails web server access logs (such as Nginx), parses HTTP events, batches and gzip-compresses telemetry records, and ships them to the Sentinel backend over HTTPS.

### Key Features
- **Zero External Dependencies:** Built entirely with Python 3 standard library (`urllib.request`, `ssl`, `gzip`, `threading`).
- **Resilient Tailing:** Tracks persistent checkpoints across restarts and automatically recovers from log rotations and file truncations.
- **Backpressure & Memory Protection:** Thread-safe bounded memory queue with drop-oldest policy protects host server memory.
- **Heartbeat & Health Lifecycle:** Transmits background heartbeats to report collector node health and version status.
- **Secure by Design:** Strictly stores API keys in private, restricted-permission files (`0600`), enforces TLS certificate validation, never logs secrets, and excludes identity fields from telemetry payloads.

---

## Quick Start

### 1. Installation

Install via pip or run directly using Python 3.9+:

```bash
pip install ./collector
# or run directly:
python -m sentinel_collector --help
```

### 2. Enrollment (First-Time Setup)

Acquire an enrollment token from the Sentinel Web UI (**Websites -> Protected Assets -> Collectors -> Generate Enrollment Token**).

Run the enrollment command:

```bash
sentinel-collector enroll \
  --server https://api.sentinel.example.com \
  --token stk_live_abcdef123456... \
  --credential-file /etc/sentinel/collector.key
```

This exchanges the one-time token for an asset-bound collector API key and stores it with mode `0600`.

### 3. Running the Daemon

```bash
sentinel-collector run \
  --server https://api.sentinel.example.com \
  --log-path /var/log/nginx/access.log \
  --credential-file /etc/sentinel/collector.key
```

Or run all-in-one with auto-enrollment:

```bash
sentinel-collector run \
  --server https://api.sentinel.example.com \
  --token stk_live_abcdef123456... \
  --log-path /var/log/nginx/access.log \
  --credential-file /etc/sentinel/collector.key
```

---

## Systemd Service Example

Create `/etc/systemd/system/sentinel-collector.service`:

```ini
[Unit]
Description=Sentinel Collector Daemon
After=network.target nginx.service

[Service]
Type=simple
User=sentinel
Group=adm
ExecStart=/usr/local/bin/sentinel-collector run \
    --server https://api.sentinel.example.com \
    --log-path /var/log/nginx/access.log \
    --credential-file /etc/sentinel/collector.key \
    --checkpoint-file /var/lib/sentinel/checkpoint.json
Restart=always
RestartSec=5s

[Install]
WantedBy=multi-user.target
```
