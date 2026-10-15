# Sentinel AI — Autonomous Cybersecurity Operations & Threat Intelligence Platform

[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12%20%7C%203.13-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.1+-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Proprietary%20%2F%20Internal-red.svg)](#license)
[![Tests](https://img.shields.io/badge/Tests-276%20Passing%20(100%25)-success.svg)](#testing-and-quality-assurance)

Sentinel AI is a modern, enterprise-ready cybersecurity operations platform (SOC) that unifies real-time HTTP telemetry collection, deterministic threat detection, GPU-accelerated neural reasoning (GT-Beta), multi-engine vulnerability scanning, and an interactive analyst command console.

Designed from the ground up for strict multi-tenant isolation, Sentinel decouples high-throughput log ingestion from heavy AI inference through a database-backed asynchronous queue, guaranteeing microsecond ingestion latencies while preventing cascade failures via circuit-breaker resilience.

---

## Architecture Overview

```mermaid
flowchart TD
    subgraph Sources[" Monitored Infrastructure "]
        Nginx["Web Server / Nginx"]
        Apps["Web Applications"]
        APIs["API Gateways"]
    end

    subgraph Edge[" Sentinel Collector Daemon "]
        Tailer["Log Tailer & Checkpointer"]
        Buffer["Bounded Memory Buffer"]
        HMAC["HMAC-SHA256 Token Auth"]
        Gzip["Gzip Batch Compression"]
        Tailer --> Buffer --> HMAC --> Gzip
    end

    subgraph Core[" FastAPI Backend Service (:8000) "]
        Ingest["Batch Ingestion (/events/batch)"]
        RateLimiter["HMAC Rate Limiter & Guard"]
        TenantContext["Multi-Tenant Isolation (X-Organization-ID)"]
        DetRules["Deterministic Detection & Risk Engine"]
        DB["SQLite / MySQL (Schema v7)"]
        AIWorker["Asynchronous AI Queue Worker"]
        ScanWorker["Scanner Orchestration Engine"]

        Ingest --> RateLimiter --> TenantContext --> DetRules
        DetRules --> DB
        DB -.->|Poll Claims| AIWorker
        DB -.->|Orchestrate| ScanWorker
    end

    subgraph Intelligence[" Neural Inference Server (:8001) "]
        GTBeta["GT-Beta PyTorch Inference Server"]
        Model["GhostTracer Deep Security Model"]
        GTBeta --> Model
    end

    subgraph Scanners[" Vulnerability Assessment Engines "]
        SSLScan["Built-in SSL/TLS Analyzer"]
        Nmap["Nmap Port & Service Scanner"]
        SQLMap["SQLMap Injection Engine"]
        Nuclei["Nuclei Template Scanner"]
        Nikto["Nikto Web Vulnerability Scanner"]
        ZAP["OWASP ZAP REST Integration"]
    end

    subgraph Frontend[" Analyst Console (:5173) "]
        UI["React 19 + Vite Translucent SOC Console"]
        DashView["Telemetry & Threat Dashboard"]
        ScannerView["Findings & Scan History"]
        IncidentView["Incident Evidence Workbench"]
        AIAnalystView["AI Reasoning & Decision Queue"]
        UI --> DashView
        UI --> ScannerView
        UI --> IncidentView
        UI --> AIAnalystView
    end

    Sources -->|Access & Security Logs| Tailer
    Gzip -->|POST /events/batch| Ingest
    AIWorker -->|HTTP POST /v1/analyze| GTBeta
    ScanWorker --> SSLScan
    ScanWorker --> Nmap
    ScanWorker --> SQLMap
    ScanWorker --> Nuclei
    ScanWorker --> Nikto
    ScanWorker --> ZAP
    Frontend <-->|REST API + Bearer JWT| Core
```

---

## Key Features

### 1. High-Performance Telemetry Ingestion & Deduplication
- **Sliding-Window Deduplication:** Suppresses duplicate security logs within a 60-second window using SHA-256 canonical fingerprints.
- **Client Idempotency:** Respects `client_event_id` keys to ensure network retries and duplicate batch deliveries never produce duplicate alerts or database bloat.
- **Zero-Dependency Edge Collector:** Standalone Python daemon tails logs, maintains persistent byte checkpoints across rotations, enforces memory backpressure, and transmits gzip-compressed batches over HTTPS.

### 2. Dual-Engine Threat Evaluation (Hybrid AI)
- **Fast Deterministic Rules:** Ingestion immediately scores attacks (SQLi, XSS, Path Traversal, Brute-Force, Recon) using verified heuristic regexes, updating IP reputation and attempt histories in real time.
- **Asynchronous GT-Beta Neural Model:** High-threat events are off-loaded to an asynchronous database queue where the GT-Beta deep learning model performs contextual attribution, assesses confidence, and generates detailed reasoning.
- **Fault-Tolerant Circuit Breakers:** If the GT-Beta server goes offline or encounters load spikes, the backend automatically trips into cooldown and falls back to deterministic recommendations without stalling log ingestion.

### 3. Multi-Engine Vulnerability Scanning & Finding Normalization
- **Unified Findings Schema:** Normalizes disparate outputs from Nmap, SQLMap, Nuclei, Nikto, SSL scanner, and OWASP ZAP into standard vulnerability records with CVEs, CWEs, CVSS scores, remediation advice, and reproducible curl commands.
- **Recurring Scan Deduplication:** Matches open findings across repeated scans to prevent alert fatigue, automatically tracking when vulnerabilities are reopened or resolved.
- **Heartbeat & Zombie Reclamation:** Background scan workers record periodic heartbeats; crashed or orphaned subprocesses are automatically detected, finalized, and logged.

### 4. Human-Governed Autonomous Response (Safety First)
- **Zero Blind Remediation:** GT-Beta and deterministic engines can recommend response actions (`BLOCK_IP`, `RATE_LIMIT_IP`, `TERMINATE_SESSION`), but actions remain strictly **advisory** until reviewed and approved by an authorized human operator.
- **Tamper-Evident Audit Trails:** Every administrative action, scan execution, alert review, and configuration change is logged into an immutable audit table with tenant context and actor metadata.

### 5. Multi-Tenant Isolation & Zero-Trust Architecture
- **Strict Tenant Fencing:** Every request is authenticated against an organization boundary (`X-Organization-ID`). All ORM sessions enforce tenant isolation at the query level.
- **Asset Ownership Verification:** Scanning targets must be verified prior to active assessment via DNS TXT records, `<meta>` tags, or hosted `.well-known` validation files with built-in SSRF and private-network protection.

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend API** | Python 3.11+, FastAPI, Uvicorn, Pydantic v2, Starlette, AnyIO |
| **Database & ORM** | SQLAlchemy 2.0 (Scoped Sessions), PyMySQL, SQLite (Dev) / MySQL 8.0+ (Prod) |
| **Security & Auth** | Cryptography, Passlib, Bcrypt, PyJWT (HMAC-SHA256 tokens), Custom Rate Limiter |
| **Frontend Console**| React 19, Vite 8, Tailwind CSS v4, Lucide React, Recharts, React Router DOM 7 |
| **Collector Daemon**| Pure Python 3 standard library (`urllib.request`, `ssl`, `gzip`, `threading`) |
| **AI / Inference** | PyTorch, CUDA (optional acceleration), GhostTracer GT-Beta Architecture |
| **Testing** | Pytest, Pytest-Metadata, Python unittest, Node.js Native Test Runner |

---

## Directory Structure

```
sentinel/
├── backend/                            # FastAPI REST Service & Worker Subsystem
│   ├── app/
│   │   ├── main.py                     # Application entry point & lifespan events
│   │   ├── cli/                        # CLI commands (database migrations, admin setup)
│   │   ├── config/                     # Runtime settings, security rules, environment
│   │   ├── database/                   # SQLAlchemy engine, base models, migrations
│   │   ├── middleware/                 # Rate limiting, API key auth, tenant validation
│   │   ├── models/                     # 16 database entities (Events, Alerts, Scans, etc.)
│   │   ├── routers/                    # REST endpoints (auth, events, scanner, AI, etc.)
│   │   ├── schemas/                    # Pydantic v2 input/output validation models
│   │   ├── services/                   # Core business logic, scanners, AI queue worker
│   │   └── utils/                      # IP resolution, body guards, destination validator
│   ├── tests/                          # 24 test suites (208 unit and integration tests)
│   ├── .env.example                    # Safe environment template with placeholders
│   ├── requirements.txt                # Runtime dependencies
│   ├── requirements-dev.txt            # Development & testing dependencies
│   └── MIGRATIONS.md                   # Database schema evolution documentation
│
├── collector/                          # Standalone Log Tailer & Collector Daemon
│   ├── sentinel_collector/             # Package source (tailer, buffer, client, parsers)
│   ├── tests/                          # 43 collector unit & integration tests
│   ├── pyproject.toml                  # Collector packaging manifest
│   └── README.md                       # Standalone collector manual
│
├── frontend/                           # React 19 + Vite SOC Command Console
│   ├── public/                         # Brand assets, backgrounds, icons
│   ├── src/
│   │   ├── App.jsx                     # Root application & routing
│   │   ├── components/                 # UI components, layouts, drawers, modals, tables
│   │   ├── pages/                      # Dashboard, Incidents, Scanner, AI Analyst, etc.
│   │   └── services/                   # API clients, authentication helpers, unit tests
│   ├── package.json                    # Dependencies & scripts
│   └── vite.config.js                  # Vite configuration & proxy rules
│
├── docs/                               # Master Technical Documentation
│   ├── SENTINEL_COMPLETE_SYSTEM_DOCUMENTATION.md   # Complete 20-section technical manual
│   ├── SENTINEL_COMPLETE_END_TO_END_QA_REPORT.md    # Empirical QA report & test logs
│   ├── SENTINEL_AI_ANALYST_PHASE2_INTEGRATION_MAP.md# AI Analyst integration & telemetry specs
│   └── sentinel_worker_orchestration_architecture.md# Worker queue & lease protocol specs
│
├── .gitignore                          # Comprehensive ignore rules for keys, dbs, caches
├── GIT_READINESS_REPORT.md             # Git readiness & secret sanitization audit report
└── README.md                           # This authoritative project overview
```

---

## Prerequisites

Ensure your host system meets the following requirements:

- **Operating System:** Windows 10/11, Ubuntu 22.04+, or macOS 13+
- **Python:** Version 3.11, 3.12, or 3.13
- **Node.js:** Version 20.x or higher (with `npm` 10+)
- **Git:** Version 2.40+
- **Database (Optional for Dev):** SQLite is supported out of the box for local development. For production deployments, MySQL 8.0+ is recommended.
- **Hardware (Optional for AI):** NVIDIA GPU with CUDA 11.8+ for accelerated GT-Beta inference (CPU fallback is supported).

---

## Quick Start Guide (Windows PowerShell)

Follow these step-by-step instructions to bring up the complete Sentinel platform locally.

### Step 1: Clone and Inspect
```powershell
git clone https://github.com/omkar-1849/Ghost-tracer.git sentinel
cd sentinel
```

### Step 2: Backend Setup
```powershell
cd backend

# 1. Create and activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# 2. Install dependencies
pip install -r requirements-dev.txt

# 3. Configure environment file from safe template
cp .env.example .env

# 4. Generate a strong 32+ character JWT secret (PowerShell)
$Secret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 48 | ForEach-Object {[char]$_})
(Get-Content .env) -replace 'JWT_SECRET=.*', "JWT_SECRET=$Secret" | Set-Content .env
(Get-Content .env) -replace 'ENVIRONMENT=.*', "ENVIRONMENT=development" | Set-Content .env

# 5. Apply database schema migrations
python -m app.cli.db migrate

# 6. Start the FastAPI backend server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
* **API Documentation:** `http://127.0.0.1:8000/docs`  
* **Alternative ReDoc:** `http://127.0.0.1:8000/redoc`

---

### Step 3: Frontend Console Setup
Open a **new terminal window**:
```powershell
cd frontend

# 1. Install frontend dependencies
npm install

# 2. Start the Vite development server
npm run dev -- --host 127.0.0.1 --port 5173
```
* **SOC Console:** Open `http://localhost:5173` in your browser.
* Register your first administrator account through the clean glass authentication portal.

---

### Step 4: Collector Daemon Setup (Optional)
To tail web server access logs and stream telemetry to Sentinel:
```powershell
cd collector

# 1. Install collector in editable mode
pip install -e .

# 2. Enroll collector node with an enrollment token (obtained from Sentinel UI -> Websites -> Collectors)
python -m sentinel_collector.cli enroll `
  --server http://127.0.0.1:8000 `
  --token <ONE_TIME_ENROLLMENT_TOKEN> `
  --credential-file ./collector.key

# 3. Start tailing web server logs
python -m sentinel_collector.cli run `
  --server http://127.0.0.1:8000 `
  --log-path "C:\path\to\access.log" `
  --credential-file ./collector.key
```

---

## Environment Variables Reference

Sentinel loads configuration from environment variables or a local `backend/.env` file. Never commit real credentials to version control.

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `ENVIRONMENT` | Yes | `production` | Operational environment: `development`, `staging`, or `production`. |
| `JWT_SECRET` | Yes | — | Cryptographic secret for signing tokens (minimum 32 characters). |
| `DATABASE_URL` | Yes | — | Database connection string (e.g., `sqlite:///./sentinel_dev.db` or `mysql+pymysql://user:pass@host/db`). |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Comma-separated list of allowed frontend origins (no trailing slashes). |
| `AI_ANALYST_ENABLED` | No | `false` | Enables off-path GT-Beta neural analyst reasoning. |
| `AI_ANALYST_URL` | No | `http://127.0.0.1:8001/v1/analyze` | HTTP endpoint of the GT-Beta inference server. |
| `AI_ANALYST_TIMEOUT`| No | `5` | Timeout in seconds for neural inference requests. |
| `SENTINEL_SCAN_WORKERS` | No | `2` | Number of concurrent background scanner threads. |
| `SENTINEL_SCANNER_EGRESS_ISOLATED` | No | `0` | Confirmation flag (`1` or `0`) verifying scanner traffic is network-isolated. |
| `SENTINEL_SCANNER_BIN_NMAP` | No | Host `PATH` | Custom path to the `nmap` executable. |
| `SENTINEL_SCANNER_BIN_SQLMAP` | No | Host `PATH` | Custom path to `sqlmap.py` or executable. |
| `SENTINEL_SCANNER_BIN_NUCLEI` | No | Host `PATH` | Custom path to the `nuclei` executable. |
| `SENTINEL_SCANNER_BIN_NIKTO` | No | Host `PATH` | Custom path to `nikto.pl` or executable. |
| `SENTINEL_ZAP_API_URL` | No | — | URL to an active OWASP ZAP daemon (e.g. `http://localhost:8080`). |
| `SENTINEL_ZAP_API_KEY` | No | — | API key for authenticating with OWASP ZAP. |
| `AUTH_RATE_IP_LIMIT` | No | `100` | Maximum login attempts per IP within the rate-limit window. |
| `AUTH_RATE_WINDOW_SECONDS` | No | `900` | Rate limiting sliding window in seconds (default: 15 minutes). |

---

## Supported Scanners & Tool Requirements

Sentinel orchestrates both native Python analyzers and industry-standard external tools. The platform gracefully handles missing binaries by logging actionable advisory findings rather than failing:

| Scanner | Type | External Dependency | Configuration Needed | Scope of Assessment |
| :--- | :---: | :--- | :--- | :--- |
| **SSL / TLS Analyzer** | **Built-in** | **None** (Pure Python) | None | Certificate validity, expiry dates, cipher suites, TLS protocol support, trust chain. |
| **Nmap Scanner** | Subprocess | `nmap` binary | Ensure `nmap` is in `PATH` or set `SENTINEL_SCANNER_BIN_NMAP`. | Port discovery, open TCP/UDP services, OS detection, banner grabbing. |
| **SQLMap Scanner** | Subprocess | Python + `sqlmap` | Ensure `sqlmap.py` is in `PATH` or set `SENTINEL_SCANNER_BIN_SQLMAP`. | Injection vulnerability detection on authorized endpoints and query parameters. |
| **Nuclei Scanner** | Subprocess | `nuclei` binary | Ensure `nuclei` is in `PATH` or set `SENTINEL_SCANNER_BIN_NUCLEI`. | Fast YAML template-based scanning for CVEs, exposed panels, and misconfigurations. |
| **Nikto Scanner** | Subprocess | Perl + `nikto` | Ensure `nikto.pl` is in `PATH` or set `SENTINEL_SCANNER_BIN_NIKTO`. | Comprehensive web server scanning for dangerous files, outdated servers, and CGIs. |
| **OWASP ZAP** | REST API | Active ZAP Daemon | Configure `SENTINEL_ZAP_API_URL` and `SENTINEL_ZAP_API_KEY`. | Active & passive application security assessments, Spidering, and AJAX crawls. |

> [!IMPORTANT]
> **Scan Authorization Guard:** Sentinel will strictly refuse to scan any target that has not successfully passed **Asset Ownership Verification**. Scanners are isolated to prevent denial-of-service and unauthorized assessment of third-party domains.

---

## GT-Beta Neural Integration

The **GT-Beta** engine is a proprietary neural security analyst powered by PyTorch. It analyzes contextual telemetry (request URLs, payloads, headers, anomaly scores, and historical failure frequency) to determine malicious intent.

### Telemetry Contract (`POST /v1/analyze`)
```json
{
  "event": {
    "event_type": "SQL_INJECTION",
    "src_ip": "198.51.100.42",
    "url": "/api/v1/users?id=1' UNION SELECT username, password FROM users--",
    "user_agent": "sqlmap/1.8.2#stable"
  },
  "detection": {
    "detected": true,
    "detections": [{ "rule": "SQLI_UNION", "confidence": 0.95 }]
  },
  "risk": {
    "risk_score": 85,
    "threat_level": "CRITICAL"
  }
}
```

### Model Response
```json
{
  "decision": "RESPOND",
  "action_type": "BLOCK_IP",
  "target": "198.51.100.42",
  "confidence": 0.96,
  "threat_level": "CRITICAL",
  "reason": "High-confidence union-based SQL injection attempt targeting database authentication tables.",
  "recommended_actions": [
    "Block source IP address 198.51.100.42 at edge firewall",
    "Audit parameterized query handling on /api/v1/users"
  ],
  "requires_approval": true,
  "source_ip_trusted": false,
  "engine": "gt-beta-http"
}
```

---

## Testing and Quality Assurance

Sentinel features a 100% automated test suite across all subsystems.

```bash
# 1. Run complete backend test suite (208 tests)
cd backend
$env:PYTHONPATH=".;..\collector"
pytest tests/ -k "not live_qa" -v

# 2. Run collector test suite (43 tests)
cd collector
pytest tests/ -v

# 3. Run frontend unit tests (25 tests)
cd frontend
npm run test

# 4. Verify frontend production build
npm run build
```

### Test Coverage Breakdown
- **Backend (208 Tests):** Tenant isolation, multi-tenant ORM filtering, authentication rate-limiting, event sliding-window deduplication, scanner normalization, worker crash recovery, AI queue leasing protocol, database migrations.
- **Collector (43 Tests):** Nginx format parsing, JSON structured log extraction, text error logs, bounded memory buffer overflow policies, checkpoint recovery across file truncation, Windows path handling.
- **Frontend (25 Tests):** Status badge rendering, exponential backoff polling calculations, governance approval guard, metrics aggregation, token formatting, login floating glass design tokens.

---

## Troubleshooting & FAQ

### 1. Port Already in Use (8000, 5173, or 8001)
If a previous service was not cleanly terminated on Windows:
```powershell
# Identify process listening on port 8000
Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object OwningProcess

# Stop process by PID
Stop-Process -Id <PID> -Force
```

### 2. Missing External Scanner Binaries
If you see an advisory like `Tool 'nmap' is not installed or not executable on the host system`:
- Built-in scanners (like **SSL / TLS Analyzer**) work without any external dependencies.
- For external scanners, install the tool on your host OS and add its directory to your system `PATH`, or set the absolute path in `backend/.env` (e.g. `SENTINEL_SCANNER_BIN_NMAP=C:\Program Files (x86)\Nmap\nmap.exe`).

### 3. AI Analyst Displays "Preliminary (Rules Engine)"
- This indicates the event was analyzed immediately via deterministic heuristic rules while awaiting background neural processing.
- Verify that `AI_ANALYST_ENABLED=true` in `backend/.env` and that your GT-Beta server is reachable on `http://127.0.0.1:8001`.

### 4. Collector 401 Unauthorized / Enrollment Expired
- Collector enrollment tokens have a default 1-hour expiration.
- Generate a fresh enrollment token from the Sentinel Console: **Websites** -> Select Website -> **Collectors Tab** -> **Enroll New Collector**.

---

## Security Model & Compliance

- **No Unapproved Execution:** Advisory AI decisions never mutate firewalls, routes, or user accounts without explicit human authorization.
- **SSRF Hardening:** Website verification and scan dispatch validate URLs against private IPv4/IPv6 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`) to prevent server-side request forgery.
- **Sensitive Data Redaction:** Passwords, API tokens, Authorization headers, and credit card patterns are automatically masked during log normalization before database storage.
- **Strict Git Hygiene:** Production keys, collector credentials, local database files, and temporary debug transcripts are strictly excluded by `.gitignore` and verified by automated secret scanners.

---

## Documentation Links

For in-depth architectural specifications and operational guides, consult the master manuals in [`docs/`](docs/):

- **[Master System Documentation](docs/SENTINEL_COMPLETE_SYSTEM_DOCUMENTATION.md)** — Comprehensive 20-section reference manual.
- **[End-to-End QA Report](docs/SENTINEL_COMPLETE_END_TO_END_QA_REPORT.md)** — Empirical validation and test benchmarks.
- **[AI Analyst Integration Map](docs/SENTINEL_AI_ANALYST_PHASE2_INTEGRATION_MAP.md)** — Neural model telemetry and schema reference.
- **[Worker Orchestration Architecture](docs/sentinel_worker_orchestration_architecture.md)** — Asynchronous queue, lease locking, and recovery.
- **[Database Migrations Guide](backend/MIGRATIONS.md)** — Database schema versions and migration execution.
- **[Collector Daemon Manual](collector/README.md)** — Collector architecture, buffer policies, and installation.
- **[Git Push Readiness Audit](GIT_READINESS_REPORT.md)** — Secret sanitization and repository audit log.

---

## License

This project is proprietary software. All rights reserved. Unauthorized reproduction, modification, or distribution is strictly prohibited.
