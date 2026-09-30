# Sentinel AI — Architecture-Driven Worker Discovery & Orchestration Analysis

> **Executive Note:** This analysis is reverse-engineered strictly from the Sentinel AI codebase as implemented today. No theoretical abstractions or generic agent templates have been presupposed. All worker boundaries, lifecycles, and interactions documented below derive directly from existing code paths, data models, concurrency constraints, and operational realities in the repository.

---

## 1. System Reconstruction: Sentinel AI as It Exists Today

### 1.1 Architecture & Component Map

Sentinel AI is a multi-tenant security monitoring and vulnerability assessment backend written in Python (FastAPI + SQLAlchemy) with a React frontend.

```text
                                  CLIENTS & EXTERNAL AGENTS
                    ┌─────────────────────────┴────────────────────────┐
                    │                                                  │
            Web Frontend / REST API                           SDK / Target Telemetry
        [Bearer JWT / Session Cookie]                          [X-API-Key Ingestion]
                    │                                                  │
                    ▼                                                  ▼
          SecurityMiddleware                                 SecurityMiddleware
         (Body bounds, headers)                             (Body bounds, headers)
                    │                                                  │
                    ▼                                                  ▼
       TenantContext & RBAC Checks                          verify_api_key Middleware
    (Owner, Admin, Analyst, Viewer)                    (Integration Lookup & org_id bind)
                    │                                                  │
                    ├────────────────────────┬─────────────────────────┤
                    ▼                        ▼                         ▼
            [Management Routers]       [Scanner API]          [Ingestion Routers]
            - website_router          - scan_router           - event_router
            - incident_router         - scanner_router        - log_router
            - response_action_router
                    │                        │                         │
                    ▼                        ▼                         ▼
            [Business Services]        [Scan Service]        [Detection Pipeline]
            - website_service          - create_scan()        - normalize_event()
            - incident_service         - enqueue_scan()       - deduplication_service
            - response_action_service                         - behavior_service
            - response_policy_service                         - detection_service
                                                              - risk_service
                                                              - ai_analyst_service (stub)
                                                              - alert_service
                    │                        │                         │
                    └────────────────────────┼─────────────────────────┘
                                             │
                                             ▼
                                 SQLAlchemy ORM + SQLite/MySQL
                         (Tenant-Scoped Session with db.info['organization_id'])
                                             │
                        ┌────────────────────┴───────────────────┐
                        │                                        │
                        ▼                                        ▼
             Durable Job Rows (scans)                Domain Tables (events, logs,
              status='Pending'/'Running'              alerts, incidents, evidence,
                        │                             timeline, websites, audit_logs)
                        ▼
             Bounded Scan Worker Pool
            (scanner_worker.py: 2-16 threads)
                        │
                        ├──────────────────┬──────────────────┐
                        ▼                  ▼                  ▼
                   Native Python      Subprocess CLI     Subprocess CLI
                   SSL Inspection      Nmap, Nuclei       Nikto, SQLMap, ZAP
```

---

### 1.2 Entry Points & Authentication Flow

1. **HTTP Management API (`/websites`, `/incidents`, `/scans`, `/response-actions`)**:
   - **Auth**: Authenticated via JWT bearer tokens and session cookies via `get_tenant_context` and `require_roles`.
   - **Tenant Binding**: Tenant boundary is established by reading `X-Organization-ID` or querying active memberships, populating `db.info["organization_id"]`.
2. **Telemetry Ingestion API (`/events`, `/logs`)**:
   - **Auth**: Authenticated via HTTP header `X-API-Key`.
   - **Tenant Binding**: Resolved via `integration_service.py` (`Integration.api_key_hash`). The middleware binds `db.info["organization_id"] = integration.organization_id` strictly from the verified integration row.
3. **Internal Daemon Startup (`main.py`)**:
   - `start_background_services()` invokes `check_schema(engine)` and `start_scan_workers()` to launch an in-process worker thread pool.

---

### 1.3 External Systems & Integrations

- **Nmap**: Executed as a subprocess (`-sV -sC --open -oX - <hostname>`). Output parsed as XML via `xml.etree.ElementTree`.
- **SQLMap**: Executed as a subprocess (`-u <target> --batch --flush-session`). Standard output parsed for injection points, DBMS types, and payload signatures.
- **Nuclei**: Executed as a subprocess with YAML vulnerability templates (`-u <target> -json -silent`).
- **Nikto**: Executed as a subprocess for web server misconfiguration checks (`-h <target> -Format json`).
- **OWASP ZAP**: Executed in daemon/CLI mode (`zap-baseline.py` or API proxy).
- **SSL/TLS Scanner**: In-process Python native scanner using `socket` and `ssl` with pinned destination IP resolution (`connect_pinned`), verifying certificate chains, SANs, cipher bit-depth, and protocol versions.
- **AI Model**: Currently represented by `ai_analyst_service.py`, a local deterministic rule heuristic returning structured `AIAnalystResponse` decisions (`MONITOR`, `INVESTIGATE`).

---

## 2. End-to-End Data Flow Traces

### Trace 1: Telemetry & Log Ingestion

```text
HTTP POST /api/v1/events (with X-API-Key)
    ↓
verify_api_key Middleware
    → Verifies SHA-256 hash of API key against integrations table
    → Sets db.info["organization_id"] = integration.organization_id
    ↓
event_service.create_event()
    ↓
normalization_service.normalize_event()
    → Converts input to CanonicalSecurityEvent
    → Strips unsafe control characters, validates IP, bounds string lengths
    ↓
deduplication_service.find_duplicate_event()
    → Computes SHA-256 fingerprint over canonical fields
    → Queries database for matching fingerprint within a 60-second sliding window
    → If duplicate found: returns existing Event immediately (idempotency exit)
    ↓
behavior_service.get_attempt_signal()
    → Queries database for authentication failures (HTTP 401/403 or auth failure keywords)
    → Sliding window: last 60 seconds for the given IP address and website_id
    ↓
detection_service.detect_event()
    → Evaluates deterministic token rules: SQL injection, XSS, command injection, path traversal
    → Appends attempt history signals (e.g. repeated auth failures >= 5)
    ↓
risk_service.calculate_risk()
    → Computes risk_score (0-100) and threat_level (LOW, MEDIUM, HIGH, CRITICAL)
    → Evaluates URL path, status codes, suspicious user agents, and attempt tier weights
    ↓
ai_analyst_service.analyze_security_event()
    → Generates preliminary AIAnalystResponse (e.g., INVESTIGATE, confidence, recommendations)
    ↓
Event Persisted (db.flush)
    ↓
Risk Threshold Evaluation: Is threat_level in {HIGH, CRITICAL}?
    ├── NO  → Logs AuditLog("INGEST_EVENT"), commits transaction, returns Event.
    └── YES → alert_service.create_alert()
```

### Trace 2: Alert & Incident Creation

```text
alert_service.create_alert() (Flush-only transactional graph builder)
    ↓
1. Creates Alert record:
    → Links organization_id, website_id, event_id, ip_address, threat_level, message
    ↓
2. Calculates Incident Confidence:
    → Derived from detection confidence or risk score (min 80, max 100 for HIGH/CRITICAL)
    ↓
3. Creates Incident record:
    → incident_code = "INC-" + zero_padded(alert.id)
    → status = "OPEN", priority = "P1" (CRITICAL) or "P2" (HIGH)
    → source_ip = canonical.src_ip, target = canonical.url
    ↓
4. Creates IncidentTimeline record:
    → event = "Incident Created", description = "Automatically created from policy alert"
    ↓
5. Creates IncidentEvidence records:
    → risk_analysis.log (threat score, detection reasons)
    → incident_summary.json (metadata snapshot)
    → event-<id>.json (canonical HTTP payload, method, URL, headers)
    ↓
6. Logs AuditLog record:
    → action = "CREATE_INCIDENT", resource_type = "INCIDENT", resource_id = incident.id
    ↓
Request-scoped Session Commits: Atomic commit of the entire alert/incident graph.
```

### Trace 3: Scanner Execution & Findings Pipeline

```text
HTTP POST /api/v1/scans (website_id, engine)
    ↓
scan_service.create_scan()
    → Validates tenant ownership and permissions
    → Enforces destination validation & ownership verification check (website.verified == True)
    → Re-verifies DNS / IP pinning (website.verified_addresses == current resolved addresses)
    → Enforces queue limit (SENTINEL_SCAN_QUEUE_LIMIT)
    → Creates durable Scan row with status = "Pending", version = 0
    → Commits durable row to DB; returns Scan model to client
    ↓
enqueue_scan(scan.id) → Triggers threading.Event (_wake_event)
    ↓
Bounded Worker Loop (_worker_loop in scanner_worker.py)
    ↓
_claim_next_job(worker_id)
    → Atomic Compare-and-Set:
      UPDATE scans SET status='Running', worker_id=:worker_id, heartbeat_at=NOW(), version=version+1
      WHERE id=:candidate_id AND status='Pending' AND worker_id IS NULL AND version=:version
    ↓
ScannerFactory.get_scanner(scan.engine)
    ↓
Scanner Adapter (Nmap, Nuclei, Nikto, SQLMap, ZAP, SSL)
    → ScannerJobMixin.begin_job():
      Verifies claim, ownership, and operator isolation acknowledgement (SENTINEL_SCANNER_EGRESS_ISOLATED=1)
    → Spawns external binary via run_subprocess() or in-process TLS inspection
    → Periodically verifies is_cancelled() via heartbeat updates
    ↓
Execution Finish
    ├── FAILURE / TIMEOUT / CORRUPTED OUTPUT:
    │   → fail_job(): Updates status='Failed', redacts error, completes heartbeat, version=version+1
    │
    └── SUCCESS:
        → parse_output(): Adapter-specific parser transforms raw text/XML/JSON into structured findings
        → generate_report(): Synthesizes summary statistics and recommendations
        → complete_job(): Updates status='Completed', findings=count, risk_score=score,
          parsed_output=report, raw_output=redacted_output, version=version+1
    ↓
Audit Log: AuditLog("SCAN_COMPLETED") written.
[GAP IDENTIFIED]: Today, scan findings terminate in the scans table. They do NOT feed into detection, alerts, or the Main AI Analyst automatically.
```

### Trace 4: Asset Lifecycle & Ownership Verification

```text
HTTP POST /api/v1/websites
    ↓
website_service.create_website()
    → validate_destination(url): Blocks private IPs (SSRF protection), resolves DNS, normalizes URL
    → Generates verification_token: "SENTINEL_" + crypto_random_token
    → Creates Website record: verified=False, monitoring_enabled=True, health_status="Unknown"
    ↓
HTTP POST /api/v1/websites/{id}/verify (method: dns | html | meta)
    ↓
website_service.verify_website()
    → DNS: Resolves TXT record for destination hostname; checks for token match
    → HTML: Fetches /.well-known or /sentinel_verify.html; checks for token in body
    → META: Parses HTML head using BeautifulSoup; verifies <meta name="sentinel-verification" content="...">
    ↓
If verified:
    → website.verified = True
    → website.verified_at = datetime.utcnow()
    → website.verified_target = website.url
    → website.verified_addresses = [resolved_ip_list] (Pins authorized scanning scope)
    ↓
[GAP IDENTIFIED]: The database contains monitoring_enabled, health_status, last_scan, and security_score,
but NO background scheduler or polling loop exists to perform recurring health checks, TLS expiry checks, or automated scans.
```

### Trace 5: Response Action Execution

```text
HTTP POST /api/v1/response-actions (incident_id, action_type="BLOCK_IP", target)
    ↓
response_action_service.create_response_action()
    → _validate():
      - Enforces role in {owner, admin, analyst}
      - Validates target IP matches incident.source_ip
      - Calls response_policy_service.validate_response_action():
        - Validates action in ALLOWED_ACTIONS (currently only BLOCK_IP)
        - Validates confidence >= 0.80 and threat_level in {HIGH, CRITICAL}
    → Persists ResponseAction with status = "PENDING"
    → Records IncidentTimeline and AuditLog
    ↓
HTTP POST /api/v1/response-actions/{id}/execute
    ↓
response_action_service.execute_response_action()
    → Re-validates incident binding and policy
    → Sets status = "SIMULATED", executed_at = NOW()
    → Sets result = "Simulation only: BLOCK_IP for <ip>. No external enforcement occurred."
    → Records IncidentTimeline and AuditLog
    ↓
[CURRENT REALITY]: All response actions in Sentinel AI are strictly simulated. No external firewall/WAF driver exists.
```

---

## 3. Natural Work Boundaries & Autonomous Worker Discovery

By evaluating long-running tasks, periodic operations, external subprocess isolation, event-driven streaming, and retry/failure semantics, five distinct worker candidates emerge from the codebase:

### 3.1 Discovered Workers vs Rejected Services

| Component Candidate | Status | Architectural Justification |
|---|---|---|
| **Scanner Execution Worker** | **PROPOSED WORKER** (Formalize existing `scanner_worker.py`) | Owns subprocess execution of heavy binary tools (Nmap, Nuclei, Nikto, SQLMap, ZAP) and TLS network sockets. Requires concurrency limits, process timeouts, compare-and-set claim leases, and crash recovery. |
| **Asset Health & Drift Worker** | **PROPOSED WORKER** (New, unlocks dormant columns) | The `websites` model has `monitoring_enabled`, `health_status`, `last_scan`, and `verified_addresses`, but zero code exercises them autonomously. Needs periodic execution to detect DNS hijacking/drift, uptime degradation, and TLS certificate expiration without blocking request threads. |
| **Incident Investigation Worker** | **PROPOSED WORKER** (New, autonomous correlation) | Currently, incidents are created as shallow stubs with static log references. Synthesizing timeline events, correlating historical IP attacks across the 60-second window, matching asset scan findings to active attack paths, and generating structured investigation dossiers for the Main AI Analyst requires autonomous, multi-step asynchronous processing. |
| **Telemetry Ingestion Service** | **REJECTED AS WORKER** (Remain Synchronous Service) | Normalization, deduplication, and deterministic rule evaluation execute in <10ms in-process. Offloading every incoming HTTP log/event to an asynchronous worker queue adds unnecessary latency and introduces eventual consistency bugs into brute-force attempt counters. Ingestion must remain a fast, synchronous service. |
| **Alert Service** | **REJECTED AS WORKER** (Remain Synchronous Service) | Alert and initial incident generation are atomic database graph operations in `alert_service.py`. Converting this into an asynchronous worker would risk dropping alerts under crash conditions before transactional commit. |
| **Response Action Engine** | **REJECTED AS AUTONOMOUS WORKER** (Remain Deterministic Policy Engine) | Automated response actions must NEVER execute autonomously without human analyst or strict deterministic policy gatekeeping. The current code enforces a simulated human-approval workflow. It should remain a deterministic service gated by the policy engine. |

---

## 4. Discovered Worker Specifications

### 4.1 Scanner Execution Worker

- **Existing Code Owned**: `scanner_worker.py`, `scanner_mixin.py`, `base_scanner.py`, `scanner_factory.py`, and adapters under `app/services/scanners/*`.
- **Natural Responsibility**: Safely executes bounded network scanners (Nmap, Nuclei, Nikto, SQLMap, ZAP, SSL), validates target address pinning against SSRF/drift, redacts sensitive output, enforces timeouts, and parses raw tool outputs into normalized JSON finding dictionaries.
- **Trigger**: Database-backed job queue notification (`enqueue_scan`) via manual user request, scheduled cadence, or structured order from Main AI Analyst.
- **Lifecycle**: `Pending` → `Running` → `Completed` | `Failed` | `Cancelled`.
- **State & Persistence**: State persisted in `scans` table (`status`, `worker_id`, `heartbeat_at`, `version`, `parsed_output`). Heartbeat updated every loop.
- **Reporting to Main AI Analyst**: Sends a structured **Scan Intelligence Report** containing normalized vulnerability findings, severity distributions, CVE references, open ports, and remediation advisories.

### 4.2 Asset Health & Drift Worker

- **Existing Code Owned**: Extends `website_service.py`, `destination.py`, and the dormant fields of `website.py` (`monitoring_enabled`, `health_status`, `verified_addresses`, `security_score`).
- **Natural Responsibility**: Continuously monitors verified assets for:
  1. DNS resolution changes / IP address drift (detecting domain hijacking or unverified infrastructure changes).
  2. TLS certificate expiration windows (<30 days warning, <0 days critical).
  3. HTTP uptime and health status (`UP`, `DEGRADED`, `DOWN`).
  4. Automatic revocation of verified scan status if destination IP changes unexpectedly.
- **Trigger**: Periodic cron/timer schedule (e.g. every 5 to 15 minutes) or triggered on-demand via Main AI order.
- **Lifecycle**: `Idle` → `Evaluating` → `Reporting` → `Idle`.
- **Reporting to Main AI Analyst**: Sends an **Asset Drift & Health Report** detailing address drift, impending certificate expirations, downtime events, and posture score recalibrations.

### 4.3 Incident Investigation Worker

- **Existing Code Owned**: Builds on `incident_service.py`, `incident_evidence_service.py`, `incident_timeline_service.py`, and `behavior_service.py`.
- **Natural Responsibility**: When an incident is promoted by `alert_service`:
  1. Gathers historical telemetry from `events` and `logs` across the target and source IP beyond the initial 60-second window.
  2. Correlates known open ports and vulnerability findings on the target website from the `scans` table.
  3. Determines if the attack pattern matches known active vulnerabilities on that specific asset (e.g. SQLi payload targeting a service flagged by SQLMap or Nmap).
  4. Compiles an enriched investigation bundle with evidence references and timeline progressions.
- **Trigger**: Event-driven on `Incident` creation (status = `OPEN`) or targeted investigative query dispatched by the Main AI Analyst.
- **Lifecycle**: `Queued` → `Investigating` → `Reported` | `Failed`.
- **Reporting to Main AI Analyst**: Sends an **Incident Dossier Report** containing correlated attacker history, asset exposure overlap, timeline progression, and potential blast radius.

---

## 5. Worker Hierarchy & Data-Flow Architecture

```text
                               ┌─────────────────────────────────────────┐
                               │             MAIN AI ANALYST             │
                               │                                         │
                               │  - Cross-domain Reasoning & Context     │
                               │  - Attack Chain Synthesis               │
                               │  - Strategic Threat Assessment          │
                               │  - Generates Structured Orders          │
                               └───────▲───────────────────────┬─────────┘
                                       │                       │
                         Intelligence Reports           Structured Orders
                                       │                       │
                                       │         ┌─────────────┴─────────────┐
                                       │         ▼                           ▼
                                       │   Deterministic             Deterministic
                                       │   Policy Engine             Job Validator
                                       │   (Response Gating)         (Target/Perms Gating)
                                       │         │                           │
                   ┌───────────────────┼─────────┼───────────────────────────┤
                   │                   │         │                           │
                   ▼                   ▼         │                           ▼
          ┌────────────────┐  ┌────────────────┐ │                  ┌────────────────┐
          │     ASSET      │  │    INCIDENT    │ │                  │    SCANNER     │
          │     HEALTH     │  │ INVESTIGATION  │ │                  │   EXECUTION    │
          │     WORKER     │  │     WORKER     │ │                  │     WORKER     │
          └───────┬────────┘  └───────┬────────┘ │                  └───────┬────────┘
                  │                   │          │                          │
                  ▼                   ▼          ▼                          ▼
          Asset State, DNS,    Correlated Graph, Simulated / Safe    Managed Subprocesses,
          TLS Expiry, Uptime    Timeline, Blast   Response Actions    TLS Sockets, XML/JSON
          (websites table)     Radius (incidents) (response_actions)  Output (scans table)
```

### Hierarchy Rules Derived from Code
1. **Reporting Flow**: Specialized workers report upwards to the Main AI Analyst with structured, normalized summaries. They never dump raw binary output or unsanitized payloads into the LLM context.
2. **Order Flow**: The Main AI Analyst cannot directly mutate database state or invoke system shell commands. It issues **Structured Orders** that pass through deterministic validation gates (ownership validation, address pinning, and role checks) before workers execute them.
3. **Response Action Separation**: The Main AI Analyst can propose remediation actions, but execution must route through `response_policy_service.py` and require authenticated human analyst confirmation.

---

## 6. Worker-to-AI and AI-to-Worker Contracts

### 6.1 Worker → Main AI Analyst (Intelligence Reports)

#### 1. Scan Intelligence Report
```json
{
  "report_type": "SCAN_INTELLIGENCE",
  "report_id": "SIR-008921",
  "timestamp": "2026-09-18T00:50:00Z",
  "tenant_id": 4,
  "website_id": 12,
  "scan_id": 142,
  "engine": "nuclei",
  "target_url": "https://api.example.com",
  "target_ip": "203.0.113.10",
  "summary": {
    "total_findings": 3,
    "risk_score": 85,
    "max_severity": "HIGH"
  },
  "findings": [
    {
      "finding_id": "F-01",
      "type": "VULNERABILITY",
      "name": "SQL Injection in Login Endpoint",
      "severity": "High",
      "cve": "CVE-2023-XXXX",
      "confidence": 0.95,
      "evidence_snippet": "parameter 'user' is vulnerable to boolean-based blind SQL injection"
    }
  ],
  "recommendations": ["Sanitize input parameter 'user'", "Apply parameterized queries"]
}
```

#### 2. Asset Drift & Health Report
```json
{
  "report_type": "ASSET_DRIFT_HEALTH",
  "report_id": "ADR-004120",
  "timestamp": "2026-09-18T00:50:00Z",
  "tenant_id": 4,
  "website_id": 12,
  "domain": "api.example.com",
  "health_status": "UP",
  "drift_detected": true,
  "drift_details": {
    "verified_addresses": ["203.0.113.10"],
    "current_addresses": ["198.51.100.24"],
    "risk": "DNS destination changed unexpectedly; scanning revoked until re-verified."
  },
  "tls_status": {
    "valid": true,
    "days_until_expiry": 14,
    "warning": "Certificate expires in less than 30 days."
  }
}
```

#### 3. Incident Dossier Report
```json
{
  "report_type": "INCIDENT_DOSSIER",
  "report_id": "IDR-001045",
  "timestamp": "2026-09-18T00:50:00Z",
  "tenant_id": 4,
  "incident_id": 88,
  "incident_code": "INC-000088",
  "source_ip": "198.51.100.5",
  "threat_level": "CRITICAL",
  "confidence": 92,
  "target_website_id": 12,
  "attack_vector": "SQL_INJECTION",
  "correlated_attack_history": {
    "attempts_last_60s": 24,
    "historical_incidents_count": 2,
    "known_scanner_user_agent": "sqlmap/1.7"
  },
  "asset_vulnerability_overlap": {
    "matching_open_vulnerabilities": ["SQL Injection in Login Endpoint"],
    "potential_compromise_risk": "CRITICAL"
  },
  "evidence_ids": [101, 102, 103]
}
```

---

### 6.2 Main AI Analyst → Worker (Structured Orders)

#### 1. Order: `TRIGGER_TARGETED_SCAN`
- **Target Worker**: Scanner Execution Worker
- **Purpose**: Verify if a reported attack path corresponds to an exploitable vulnerability on the asset.
- **Payload**:
  ```json
  {
    "order": "TRIGGER_TARGETED_SCAN",
    "tenant_id": 4,
    "website_id": 12,
    "engine": "sqlmap",
    "reason": "Correlated SQLi attempts detected in incident INC-000088; verify endpoint resistance."
  }
  ```
- **Validation Gate**: Checks tenant authorization, validates `website.verified == True`, checks pinned addresses against current DNS, and verifies queue limit bounds.

#### 2. Order: `INVESTIGATE_INCIDENT_TIMELINE`
- **Target Worker**: Incident Investigation Worker
- **Purpose**: Conduct deep timeline and blast-radius correlation across all tenant assets.
- **Payload**:
  ```json
  {
    "order": "INVESTIGATE_INCIDENT_TIMELINE",
    "tenant_id": 4,
    "incident_id": 88,
    "scope_window_minutes": 60
  }
  ```
- **Validation Gate**: Tenant isolation check; verifies incident belongs to `tenant_id`.

#### 3. Order: `REVALIDATE_ASSET_DESTINATION`
- **Target Worker**: Asset Health & Drift Worker
- **Purpose**: Force immediate DNS and TLS check when suspicious traffic or anomalies appear.
- **Payload**:
  ```json
  {
    "order": "REVALIDATE_ASSET_DESTINATION",
    "tenant_id": 4,
    "website_id": 12
  }
  ```
- **Validation Gate**: Rate limits per website; confirms tenant ownership.

---

## 7. Autonomous Operational Lifecycles & Persistence

### 7.1 Lifecycle States

Each worker transitions through distinct deterministic states:

```text
       ┌───────────────┐
       │    QUEUED     │
       └───────┬───────┘
               │ (claimed atomically via compare-and-set)
               ▼
       ┌───────────────┐
       │    RUNNING    │◄──────────────┐ (heartbeat refreshed)
       └───────┬───────┘───────────────┘
               │
      ┌────────┴────────┬──────────────────┐
      ▼                 ▼                  ▼
┌───────────┐    ┌─────────────┐    ┌─────────────┐
│ COMPLETED │    │   FAILED    │    │  CANCELLED  │
└───────────┘    └─────────────┘    └─────────────┘
```

### 7.2 Persistence & Crash Recovery

1. **Worker / Server Restart Recovery**:
   - `_recover_interrupted_scans()` in `scanner_worker.py` already handles this correctly: on startup, any scan in `Pending` or `Running` status is marked `Failed` with `"Scan was interrupted by a service restart"`. It is never auto-replayed or retried to prevent infinite crash loops.
   - The same idempotent recovery pattern applies to `Asset Health` and `Incident Investigation` workers.
2. **Heartbeats & Staleness Leases**:
   - Every active job maintains `heartbeat_at = datetime.utcnow()` and an integer `version` incremented on every state transition.
   - If a worker crashes silently, jobs with stale heartbeats (>30 minutes) can be reclaimed or failed cleanly without deadlocking queues.
3. **Database Disconnection**:
   - Adapters wrap transactions in try/finally blocks, releasing connections back to `SessionLocal`. Subprocesses verify `is_cancelled()` between execution steps.

---

## 8. Tenant Isolation, Determinism & Security Boundaries

### 8.1 Multi-Tenant Isolation Chain

Every hop through the worker architecture enforces tenant context:

```text
HTTP Request (X-API-Key or JWT)
  │
  ▼ [Middleware]
Resolve tenant: db.info["organization_id"] = integration.organization_id (or token org)
  │
  ▼ [Worker Dispatch]
Job record persists organization_id explicitly in DB row
  │
  ▼ [Worker Execution]
Worker instantiates isolated session: db.info["organization_id"] = job.organization_id
All ORM queries automatically filter by TenantOwned.organization_id
  │
  ▼ [Intelligence Report]
Report envelope stamped with immutable tenant_id and website_id
  │
  ▼ [Main AI Reasoning]
LLM context isolated strictly per tenant; no cross-tenant prompt mixing
  │
  ▼ [AI Orders]
Orders validated against tenant ownership before reaching target workers
```

### 8.2 Security Governance Over AI Authority

As mandated by Sentinel's architectural security invariants:
- **No Unchecked Shell Execution**: The AI Analyst cannot specify CLI flags, shell commands, or arbitrary executable paths. All scanner commands are constructed strictly inside hardened python adapters via `resolve_binary()` with whitelisted parameters.
- **SSRF & Address Pinning**: Scanners cannot target arbitrary URLs requested by AI. Targets must be pre-registered `Website` rows where ownership has been verified via DNS TXT or meta tag, and target IP addresses must match `website.verified_addresses`.
- **Response Action Gatekeeping**: AI-generated remediation orders (e.g. `BLOCK_IP`) cannot be directly executed. They must be submitted as `PENDING` simulations, verified against `response_policy_service.py` (requiring `confidence >= 0.8` and `threat_level in {"HIGH", "CRITICAL"}`), and approved by an authenticated user with `owner`, `admin`, or `analyst` roles.

---

## 9. Comprehensive Comparison Table

| Proposed Worker | Evidence From Existing Code | Natural Responsibility | Trigger | Inputs | Outputs | Reports To | Receives Orders From | Why Worker? |
|---|---|---|---|---|---|---|---|---|
| **Scanner Execution Worker** | `scanner_worker.py`, `scanner_mixin.py`, `app/services/scanners/*` | Bounded execution of external CLI binaries (Nmap, Nuclei, Nikto, SQLMap, ZAP) & TLS sockets | Manual API request, scheduled scan, or AI order | `scan_id`, `website_id`, `engine`, pinned IPs | Normalized finding list, risk score, redacted report | Main AI Analyst | Main AI Analyst (via validation gate) | Long-running subprocesses (up to 30 mins), heavy CPU/network load, requires process isolation and crash recovery |
| **Asset Health & Drift Worker** | `website.py` (`monitoring_enabled`, `verified_addresses`, `health_status`), `destination.py` | Periodic DNS verification, IP address drift detection, TLS certificate expiry tracking, uptime health checks | Scheduled timer (5-15m cron) or AI order | `website_id`, target URL, verified IP allowlist | Health status (`UP`/`DOWN`), drift alerts, TLS expiry warning | Main AI Analyst | Main AI Analyst | Continuous background monitoring, recurring DNS/TLS polling, failure isolation |
| **Incident Investigation Worker** | `incident_service.py`, `incident_evidence_service.py`, `behavior_service.py` | Correlate multi-event attack timelines, evaluate attacker IP history across time windows, map asset vulnerabilities to attack paths | Event-driven (on `Incident` creation) or AI investigation order | `incident_id`, `source_ip`, `website_id`, `event_ids` | Enriched timeline, vulnerability overlap dossier, attack chain confidence | Main AI Analyst | Main AI Analyst | Multi-table correlation queries, asynchronous deep investigation, avoids blocking fast event ingestion |
| **Telemetry Ingestion Service** *(Not a Worker)* | `event_service.py`, `normalization_service.py`, `deduplication_service.py` | Fast normalization, SHA-256 deduplication, deterministic rule detection, and risk scoring | HTTP POST `/events` or `/logs` | Raw JSON event/log, API key | `Event` / `Log` database record, preliminary alert | N/A (Internal pipeline) | N/A | **Rejected as worker:** Must execute synchronously in <10ms to provide immediate API feedback and prevent race conditions in sliding-window brute force counters |
| **Alert & Promotion Service** *(Not a Worker)* | `alert_service.py` | Transactionally build the alert, initial incident, evidence files, and timeline graph | Triggered when risk score >= HIGH threshold | Normalized event, risk analysis, detection dict | Atomic `Alert` + `Incident` database graph | Incident Investigation Worker | N/A | **Rejected as worker:** Must remain an atomic, flush-only transactional service to ensure zero dropped alerts during server crashes |
| **Response Action Engine** *(Not a Worker)* | `response_action_service.py`, `response_policy_service.py` | Enforces deterministic security policies and simulates firewall/WAF response actions | Authenticated analyst action | `incident_id`, `action_type`, target IP, confidence | `ResponseAction` record (status = `SIMULATED`) | Main AI Analyst | Human Analyst (via UI) | **Rejected as worker:** Response execution must never run autonomously without human-in-the-loop and deterministic policy gating |

---

## 10. Implementation Map (Design Blueprint)

```text
1. Scanner Execution Worker
   ├── Existing files: app/services/scanner_worker.py, app/services/scanners/*
   ├── Existing services to reuse: ScannerFactory, ScannerJobMixin, validate_destination
   ├── New files required: app/services/workers/scanner_intel_reporter.py
   ├── Database changes: Add intelligence_reported_at (DateTime) column to scans table
   ├── API changes: None (scan_router already exposes /scans POST and GET)
   └── AI Integration: Dispatches Scan Intelligence Report upon complete_job()

2. Asset Health & Drift Worker
   ├── Existing files: app/services/website_service.py, app/utils/destination.py
   ├── Existing services to reuse: validate_destination, safe_fetch, SSLScanner._parse_cert_date
   ├── New files required: app/services/workers/asset_health_worker.py
   ├── Database changes: Add last_health_check_at (DateTime), drift_detected (Boolean) to websites
   ├── Scheduler changes: Register periodic cron task (e.g. every 10 minutes) in main.py startup
   └── AI Integration: Dispatches Asset Drift & Health Report on drift or impending TLS expiry

3. Incident Investigation Worker
   ├── Existing files: app/services/incident_service.py, app/services/behavior_service.py
   ├── Existing services to reuse: get_attempt_signal, create_timeline_event, get_scan_history
   ├── New files required: app/services/workers/incident_investigation_worker.py
   ├── Database changes: Add investigation_status (String), investigation_dossier (JSON) to incidents
   ├── Queue/Trigger changes: Triggered asynchronously by alert_service.create_alert() via background task
   └── AI Integration: Dispatches Incident Dossier Report to Main AI Analyst for reasoning and correlation
```

---

## 11. Concluding Architectural Assessment

> **Synthesis:**
> After analyzing the actual implementation of Sentinel AI:
> 
> 1. **Three specialized autonomous workers naturally emerge**:
>    - **Scanner Execution Worker**: Manages heavy external scanner subprocesses and network TLS inspections with bounded worker threads, heartbeat tracking, and compare-and-set claim leases.
>    - **Asset Health & Drift Worker**: Activates dormant database columns to periodically audit asset uptime, DNS address drift, and certificate expiration.
>    - **Incident Investigation Worker**: Asynchronously enriches shallow incidents with deep multi-event correlations, attacker history, and asset vulnerability overlap.
> 
> 2. **Telemetry Ingestion, Alerting, and Response must NOT be workers**:
>    - Ingestion and alerting are sub-10ms transactional operations that require synchronous consistency to preserve deduplication and brute-force sliding windows.
>    - Response actions require strict human-in-the-loop governance and deterministic policy validation, precluding autonomous execution.
> 
> 3. **The Main AI Analyst acts as the central reasoning hub**:
>    - It sits above the specialized workers, receiving structured, normalized **Intelligence Reports** (never raw dumps).
>    - It issues **Structured Orders** (such as targeted scans or deep timeline investigations) that are strictly validated against tenant isolation and destination authorization gates before worker execution.
