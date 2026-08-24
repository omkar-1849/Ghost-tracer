# Sentinel AI — Current Architecture & Implementation Audit

**Audit Date:** August 20, 2026  
**Audit Scope:** Full codebase audit (Backend, Frontend, Database Models, Scanners, Data Flow, Security, AI & 2665 Readiness)  
**Audit Mode:** Strict Read-Only Ground-Truth Analysis

---

## 1. PROJECT STRUCTURE

The project is structured as a decoupled full-stack web application consisting of a **FastAPI backend**, a **Vite + React frontend**, and an empty root `database/` directory (with SQLite/MySQL managed dynamically via SQLAlchemy).

```text
sentinel-ai/
├── SENTINEL_AI_OVERVIEW.md         # Existing high-level documentation
├── SENTINEL_CURRENT_ARCHITECTURE.md# Ground-truth architecture audit report (This File)
├── backend/                        # FastAPI Application Root
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI Application Entry Point & CORS Setup
│   │   ├── config/
│   │   │   └── rules.py            # Static heuristic risk rules dictionary
│   │   ├── database/
│   │   │   ├── base.py             # SQLAlchemy Declarative Base
│   │   │   └── database.py         # MySQL connection setup & SessionLocal generator
│   │   ├── middleware/
│   │   │   └── api_key_auth.py     # API Key header verification middleware
│   │   ├── models/                 # SQLAlchemy ORM Models (18 models)
│   │   │   ├── alert.py
│   │   │   ├── audit_log.py
│   │   │   ├── event.py
│   │   │   ├── incident.py
│   │   │   ├── incident_evidence.py
│   │   │   ├── incident_note.py
│   │   │   ├── incident_timeline.py
│   │   │   ├── integration.py
│   │   │   ├── log.py
│   │   │   ├── organization.py
│   │   │   ├── organization_member.py
│   │   │   ├── password_reset_token.py
│   │   │   ├── scan.py
│   │   │   ├── scan_result.py
│   │   │   ├── session.py
│   │   │   ├── settings.py
│   │   │   ├── user.py
│   │   │   └── website.py
│   │   ├── routers/                # FastAPI Routers (18 router files)
│   │   │   ├── alert_router.py
│   │   │   ├── audit_log_router.py
│   │   │   ├── auth_router.py
│   │   │   ├── dashboard_router.py
│   │   │   ├── event_router.py
│   │   │   ├── incident_evidence_router.py
│   │   │   ├── incident_note_router.py
│   │   │   ├── incident_router.py
│   │   │   ├── incident_timeline_router.py
│   │   │   ├── integration_router.py
│   │   │   ├── log_router.py
│   │   │   ├── organization_router.py
│   │   │   ├── profile_router.py
│   │   │   ├── scan_router.py
│   │   │   ├── scanner_router.py
│   │   │   ├── session_router.py
│   │   │   ├── settings_router.py
│   │   │   └── website_router.py
│   │   ├── schemas/                # Pydantic Request/Response Schemas (16 schema files)
│   │   │   ├── audit_log_schema.py
│   │   │   ├── auth_schema.py
│   │   │   ├── event_schema.py
│   │   │   ├── incident_evidence_schema.py
│   │   │   ├── incident_note_schema.py
│   │   │   ├── incident_schema.py
│   │   │   ├── incident_timeline_schema.py
│   │   │   ├── integration_schema.py
│   │   │   ├── log_schema.py
│   │   │   ├── organization_schema.py
│   │   │   ├── profile_schema.py
│   │   │   ├── report_schema.py
│   │   │   ├── scan_schema.py
│   │   │   ├── session_schema.py
│   │   │   ├── settings_schema.py
│   │   │   └── website_schema.py
│   │   ├── services/               # Core Business Logic & External Integrations
│   │   │   ├── alert_service.py
│   │   │   ├── audit_log_service.py
│   │   │   ├── auth_service.py
│   │   │   ├── behavior_service.py
│   │   │   ├── dashboard_service.py
│   │   │   ├── event_service.py
│   │   │   ├── incident_evidence_service.py
│   │   │   ├── incident_note_service.py
│   │   │   ├── incident_service.py
│   │   │   ├── incident_timeline_service.py
│   │   │   ├── integration_service.py
│   │   │   ├── log_service.py
│   │   │   ├── organization_service.py
│   │   │   ├── profile_service.py
│   │   │   ├── risk_service.py
│   │   │   ├── scan_service.py
│   │   │   ├── scanner_service.py
│   │   │   ├── scanner_worker.py   # FastAPI BackgroundTasks worker entry point
│   │   │   ├── session_service.py
│   │   │   ├── settings_service.py
│   │   │   ├── website_service.py
│   │   │   └── scanners/           # Scanner Engine Adapters & Parsers
│   │   │       ├── base_scanner.py # Abstract base scanner interface
│   │   │       ├── nikto_scanner.py
│   │   │       ├── nmap_scanner.py
│   │   │       ├── nuclei_scanner.py
│   │   │       ├── scanner_factory.py # Registry for scanner engines
│   │   │       ├── ssl_scanner.py
│   │   │       ├── zap_scanner.py
│   │   │       └── sqlmap/          # Multi-file SQLMap Integration Suite
│   │   │           ├── adapter.py
│   │   │           ├── parser.py
│   │   │           ├── recommendations.py
│   │   │           └── report.py
│   │   └── utils/                  # Helper Utilities
│   │       ├── reset_token.py
│   │       ├── scanner_utils.py    # Subprocess execution, binary checks, IST timestamps
│   │       └── security.py         # Passlib bcrypt & PyJWT token handling
├── database/                       # Empty directory (No Alembic migrations found)
├── docs/                           # Documentation artifacts
│   ├── old_dashboard.html
│   └── sdk.md
└── frontend/                       # Vite + React Frontend Application
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── App.jsx                 # Client-side React Router setup & lazy imports
        ├── main.jsx                # React DOM entry point
        ├── pages/                  # Page Views
        │   ├── Alerts.jsx
        │   ├── Analytics.jsx
        │   ├── Dashboard.jsx
        │   ├── Login.jsx
        │   ├── Report.jsx
        │   ├── Scanner.jsx
        │   ├── Settings.jsx
        │   └── Websites.jsx
        ├── services/               # Axios/Fetch API Clients
        │   ├── api.js              # Primary Dashboard & Incidents API client
        │   ├── auditLogApi.js
        │   ├── authClient.js       # LocalStorage JWT token management
        │   ├── scannerApi.js
        │   ├── settingsApi.js
        │   └── websiteApi.js
        └── components/             # React UI components organized by domain
            ├── alerts/
            ├── analytics/
            ├── report/
            ├── scanner/
            ├── settings/
            └── websites/
```

### Key Observations on Project Structure:
1. **Tests:** There are **NO automated test files** (`tests/`, `pytest`, `unittest`, or `vitest`) anywhere in the repository.
2. **Database Migrations:** There are **NO Alembic migration scripts** or database versioning tools. Schema creation relies entirely on `Base.metadata.create_all(bind=engine)` inside `backend/app/main.py`.
3. **Background Jobs:** Scans run asynchronously via FastAPI `BackgroundTasks` calling `run_scan_background` in `scanner_worker.py`. There is no Celery, Redis, RabbitMQ, or cron worker runner.

---

## 2. BACKEND ARCHITECTURE

### Entry Point & Middleware
- **FastAPI Entry Point:** `backend/app/main.py` initializes the FastAPI application (`title="Sentinel AI"`), mounts 18 routers, sets CORS headers (`allow_origins` for localhost:5173 / 5174), and automatically invokes `Base.metadata.create_all(bind=engine)` on startup.
- **Middleware:** `backend/app/middleware/api_key_auth.py` provides `verify_api_key` for header-based (`X-API-Key`) authentication on integration endpoints. Standard HTTP Bearer JWT authentication is enforced via FastAPI dependency `get_current_user` in `backend/app/utils/security.py`.

### Database & ORM
- **SQLAlchemy Configuration:** `backend/app/database/database.py` defines a hardcoded MySQL connection URL (`mysql+pymysql://root:1849@localhost/omkar`) with `pool_pre_ping=True`. Database sessions are managed per request via the `get_db()` yield generator.

### Authentication, Sessions & RBAC
- **Auth Flow:** Standard email/password login using `passlib` bcrypt hashing. JWT tokens (HS256) are generated with a 30-minute expiration containing `sub` (user_id) and `sid` (session_id).
- **Session Verification:** `get_current_user` validates both the JWT signature/expiration AND queries the `sessions` table in MySQL (`validate_session`). If the session is revoked or expired in the database, access is denied.
- **RBAC & Multi-Tenancy:** 
  - `Organization` and `OrganizationMember` models exist with roles: `owner`, `admin`, `analyst`, `viewer`.
  - Service functions (`organization_service.py`) feature `require_role(db, user, org_id, allowed_roles)`.
  - **CRITICAL MULTI-TENANCY GAP:** While the organization/role framework exists, **most resource endpoints (`Website`, `Scan`, `Incident`, `Log`, `Alert`) are NOT scoped by `organization_id`**. Web resources are globally accessible across authenticated users because foreign keys to `Organization` are absent from `websites`, `scans`, `incidents`, `logs`, and `alerts`.

### Configuration & Environment Handling
- Settings are loaded dynamically from a database table (`Settings`) via `settings_service.py`. There is no `pydantic-settings` or `.env` file loader in use for backend configuration.

---

## 3. FRONTEND ARCHITECTURE

### Technology Stack
- **Framework:** React 18 with Vite.
- **Routing:** `react-router-dom` v6 with lazy-loaded route code splitting (`Suspense`).
- **Icons & Styling:** Tailwind CSS, `lucide-react`.

### Page Components & State Management
- **State Management:** Local React state (`useState`, `useEffect`, `useCallback`, `useMemo`). There is no global state library like Redux, Zustand, or TanStack Query.
- **Routing & Guards:** `App.jsx` wraps authenticated pages (`Settings`) in `RequireAuth`. However, routes like `Dashboard`, `Scanner`, `Alerts`, `Websites`, `Analytics`, and `Report` are currently open in `App.jsx` without the `RequireAuth` wrapper.

### Implemented vs. Placeholder / Mock UI Analysis
- **Dashboard (`Dashboard.jsx`):** **FULLY IMPLEMENTED**. Periodically polls `/dashboard/stats` every 5 seconds. Displays live statistics, threat charts, security score, and log/alert feeds.
- **Websites / Asset Management (`Websites.jsx` / `WebsiteLayout.jsx`):** **FULLY IMPLEMENTED**. Connects directly to backend `/websites` endpoints for CRUD operations, searching, and domain verification.
- **Scanner (`Scanner.jsx` / `ScannerLayout.jsx`):** **FULLY IMPLEMENTED**. Interacts with `/scanner/run`, `/scanner/engines`, `/scans`, and `/scans/{id}` to launch scans, monitor real-time progress, and display results.
- **Settings (`Settings.jsx` / `SettingsLayout.jsx`):** **PARTIALLY IMPLEMENTED**. Contains tabbed UI for General, Scanner, AI, Security, Audit Logs, and Member management. Interacts with `/settings` and `/audit-logs`.
- **Alerts / Incident Center (`Alerts.jsx`):** **PARTIALLY MOCKED / HYBRID**. Queries backend `/incidents` endpoints, but falls back onto client-side mock enrichment (`alertsData.js`) and simulated real-time WebSocket ticker timers to polish the UI presentation.
- **Analytics (`Analytics.jsx`):** **PARTIALLY IMPLEMENTED / PLACEHOLDER**. Displays high-level analytics widgets connected to backend APIs, but contains large "Coming Soon" panels for advanced features.
- **AI Analyst UI:** **NON-EXISTENT**. The UI only contains static input fields in Settings for AI API keys and models (`ai_provider`, `ai_model`). There is no chat interface, automated triage drawer, or AI recommendations view.

---

## 4. DATABASE SCHEMA AUDIT

The backend defines 18 SQLAlchemy models. Below is an audit of the core domain entities:

```mermaid
erDiagram
    ORGANIZATION ||--o{ ORGANIZATION_MEMBER : has
    USER ||--o{ ORGANIZATION_MEMBER : belongs_to
    USER ||--o{ SESSION : maintains
    WEBSITE ||--o{ SCAN : has
    WEBSITE ||--o{ EVENT : triggers
    WEBSITE ||--o| INTEGRATION : configures
    INCIDENT ||--o{ INCIDENT_EVIDENCE : contains
    INCIDENT ||--o{ INCIDENT_NOTE : contains
    INCIDENT ||--o{ INCIDENT_TIMELINE : contains

    WEBSITE {
        int id PK
        string url
        string domain
        string ip_address
        string environment
        string status
        int security_score
        boolean verified
    }
    SCAN {
        int id PK
        int website_id FK
        string engine
        string status
        int findings
        int risk_score
        json parsed_output
    }
    INCIDENT {
        int id PK
        string incident_code
        string title
        string threat_level
        string status
        string source_ip
        string target
    }
    ALERT {
        int id PK
        string ip_address
        string threat_level
        string message
    }
    AUDIT_LOG {
        int id PK
        int organization_id
        int user_id
        string action
        string resource_type
    }
```

### Entity Deep-Dive

#### 1. Asset (`Website` model in `website.py`)
- **Primary Key:** `id` (Integer)
- **Attributes:** `name`, `url` (Unique), `domain`, `ip_address`, `description`, `environment` (default: "Production"), `status` (default: "Active"), `security_score` (Integer), `owner`, `favicon_url`, `monitoring_enabled` (Boolean), `tags` (Text, CSV), `notes`, `health_status`, `last_scan` (DateTime), `verified` (Boolean), `verification_method`, `verification_token`, `verified_at`.
- **Relationships:** Has one `Integration` (`cascade="all, delete-orphan"`).
- **Gaps:** **Missing `organization_id` FK**. Missing criticality rating, exposure assessment (internal vs external facing), cloud provider metadata, subdomains list, and continuous monitoring schedule configuration.

#### 2. Finding (NO Dedicated Model)
- **Current State:** **No standalone `Finding` table exists.** Findings are stored purely as unstructured/semi-structured JSON inside `Scan.parsed_output` or `ScanResult.report`.
- **Gaps:** Absence of a normalized `findings` entity prevents cross-scan deduplication, vulnerability lifecycle tracking (open -> triaged -> remediated -> verified), CVE/CWE query indexing, and SLA tracking.

#### 3. Risk (NO Dedicated Model)
- **Current State:** **No dedicated `Risk` table exists.** Risk is evaluated dynamically via `risk_service.py` using static HTTP log pattern matching (`RISK_RULES` in `rules.py`), or stored as a flat `risk_score` integer on `Scan` and `Log`.
- **Calculation Logic:** Checks log status codes (401, 403, 500), URI paths (`/admin`), SQLi/XSS/Command Injection regex keywords, and suspicious User-Agents.
- **Gaps:** Risk scoring is HTTP log-centric and lacks asset criticality weighting, vulnerability severity composition, or contextual threat vector metrics.

#### 4. Incident (`Incident` model in `incident.py`)
- **Primary Key:** `id` (Integer)
- **Attributes:** `incident_code` (Unique), `title`, `description`, `threat_level`, `priority`, `status`, `source_ip`, `target`, `confidence` (Integer), `assigned_to`, `assigned_at`, `created_at`, `updated_at`, `resolved_at`.
- **Relationships:** Parent to `IncidentEvidence`, `IncidentNote`, `IncidentTimeline`.
- **Gaps:** **Unlinked to Assets or Scans**. Has no foreign key to `website_id`, `scan_id`, or `organization_id`. `target` and `source_ip` are plain unindexed string fields.

#### 5. Alert (`Alert` model in `alert.py`)
- **Attributes:** `id`, `ip_address`, `threat_level`, `message`, `created_at`.
- **Gaps:** Completely detached table without foreign keys to `Log`, `Website`, `Scan`, or `Incident`.

#### 6. Audit Log (`AuditLog` model in `audit_log.py`)
- **Attributes:** `id`, `organization_id` (Indexed), `user_id` (Indexed), `action` (Indexed), `resource_type`, `resource_id`, `description`, `ip_address`, `user_agent`, `created_at`.
- **Recorded Events:** `SCAN_COMPLETED`, `SCAN_FAILED`, `ADD_ORGANIZATION_MEMBER`, `CHANGE_MEMBER_ROLE`, `REMOVE_ORGANIZATION_MEMBER`.
- **Gaps:** AI actions and automated security interventions are not currently audited.

---

## 5. API ENDPOINT INVENTORY

Below is the inventory of endpoints implemented across the 18 FastAPI routers:

| Group | Method | Route | Auth / RBAC | Purpose & Backend Action |
|---|---|---|---|---|
| **Auth** | `POST` | `/auth/register` | None | Register new user account |
| **Auth** | `POST` | `/auth/login` | None | Verify credentials, create server DB session & return JWT |
| **Auth** | `POST` | `/auth/logout` | Bearer JWT | Revoke active user session in DB |
| **Auth** | `POST` | `/auth/forgot-password` | None | Generate password reset token |
| **Auth** | `POST` | `/auth/reset-password` | None | Validate token & update user password hash |
| **Profile** | `GET` | `/profile/me` | Bearer JWT | Fetch authenticated user details |
| **Profile** | `PUT` | `/profile/me` | Bearer JWT | Update current user profile info |
| **Sessions**| `GET` | `/sessions` | Bearer JWT | List active sessions for current user |
| **Sessions**| `DELETE` | `/sessions/{id}` | Bearer JWT | Terminate specific user session |
| **Orgs** | `POST` | `/organizations` | Bearer JWT | Create new organization (user assigned as owner) |
| **Orgs** | `GET` | `/organizations/me` | Bearer JWT | Fetch user's active organization |
| **Orgs** | `GET` | `/organizations/{id}/members` | Bearer JWT | List members of organization |
| **Orgs** | `POST` | `/organizations/{id}/members` | Bearer JWT / Owner, Admin | Add new user to organization with role |
| **Orgs** | `PUT` | `/organizations/{id}/members/{u_id}` | Bearer JWT / Owner | Change member role |
| **Orgs** | `DELETE`| `/organizations/{id}/members/{u_id}` | Bearer JWT / Owner | Remove member from organization |
| **Websites**| `POST` | `/websites` | Bearer JWT | Register new website asset |
| **Websites**| `GET` | `/websites` | None | List all websites (pagination supported) |
| **Websites**| `GET` | `/websites/search` | None | Search websites by query string |
| **Websites**| `GET` | `/websites/{id}` | None | Get website details by ID |
| **Websites**| `PUT` | `/websites/{id}` | Bearer JWT | Update website parameters |
| **Websites**| `DELETE`| `/websites/{id}` | Bearer JWT | Soft/hard delete website asset |
| **Websites**| `GET` | `/websites/{id}/verification-token` | None | Retrieve verification DNS/file token |
| **Websites**| `POST` | `/websites/{id}/verify/{method}` | None | Trigger domain ownership verification |
| **Scanners**| `POST` | `/scanner/run` | None | Synchronous scan dispatch via scanner service |
| **Scanners**| `POST` | `/scans/` | None | Asynchronous scan dispatch via `BackgroundTasks` |
| **Scanners**| `GET` | `/scans` | None | List all scans across websites |
| **Scanners**| `GET` | `/scans/{scan_id}` | None | Retrieve scan metadata & status |
| **Scanners**| `GET` | `/scanner/engines` | None | List registered scanner engines |
| **Scanners**| `POST` | `/scanner/{id}/cancel` | None | Mark scan status as Cancelled |
| **Scanners**| `GET` | `/scanner/{id}/report` | None | Fetch parsed JSON scan report |
| **Scanners**| `DELETE`| `/scans/{scan_id}` | None | Delete scan record from database |
| **Incidents**| `GET` | `/incidents/` | None | Query/filter incident queue |
| **Incidents**| `GET` | `/incidents/{id}` | None | Get incident record details |
| **Incidents**| `PATCH`| `/incidents/{id}/status` | None | Update incident status lifecycle |
| **Incidents**| `PATCH`| `/incidents/{id}/assign` | None | Assign incident to analyst |
| **Incidents**| `POST` | `/incidents/{id}/notes` | None | Append analyst note to incident |
| **Incidents**| `GET` | `/incidents/statistics/overview` | None | Summary counts for incident triage dashboard |
| **Alerts** | `GET` | `/alerts/recent` | None | Fetch top 10 recent alerts |
| **Logs** | `POST` | `/logs/ingest` | None / API Key | Ingest incoming raw HTTP log entry & score risk |
| **Logs** | `GET` | `/logs/recent` | None | Fetch recent HTTP logs |
| **Audit** | `GET` | `/audit-logs` | Bearer JWT | Fetch organization audit history |
| **Settings**| `GET` | `/settings` | None | Retrieve system configuration settings |
| **Settings**| `PUT` | `/settings` | None | Update system configuration settings |
| **AI** | **NONE** | **N/A** | **N/A** | **No dedicated AI routes exist** |

---

## 6. CURRENT SECURITY DATA FLOW

Tracing the empirical data flow through the codebase reveals two separate, unconnected pipelines:

```mermaid
flowchart TD
    subgraph "Pipeline A: Log Telemetry Ingestion"
        A1[HTTP Log Ingest Request] --> A2[log_router /logs/ingest]
        A2 --> A3[risk_service.calculate_risk]
        A3 --> A4[Save to logs table]
        A3 --> A5[If Risk >= 50: Create alert in alerts table]
    end

    subgraph "Pipeline B: Vulnerability Scanner Execution"
        B1[User Triggers Scan] --> B2[scan_router POST /scans]
        B2 --> B3[Create Scan record status=Pending]
        B3 --> B4[FastAPI BackgroundTasks]
        B4 --> B5[scanner_worker.run_scan_background]
        B5 --> B6[ScannerFactory.get_scanner engine]
        B6 --> B7[Execute CLI Subprocess / Socket]
        B7 --> B8[Parse raw stdout/JSON]
        B8 --> B9[Calculate risk_score & count findings]
        B9 --> B10[Update Scan record status=Completed, parsed_output=JSON]
        B10 --> B11[create_audit_log SCAN_COMPLETED]
    end
```

### Missing Data Flow Links Identified:
1. **Scanner Findings -> Database Finding Entity:** Scanner results stay locked as JSON blobs inside `scans.parsed_output`. They are never extracted into normalized `findings` records.
2. **Scanner Findings -> Incident Creation:** Completing a scan with critical vulnerabilities **does NOT trigger or create an Incident**. Incidents must be manually created or fetched from independent dummy endpoints.
3. **HTTP Alerts -> Incident Creation:** Generating an `Alert` from high-risk log ingestion does NOT convert into an `Incident`.
4. **Scans & Incidents -> Organization:** Neither Pipeline A nor Pipeline B associates records with `organization_id`.

---

## 7. SCANNER INTEGRATIONS AUDIT

Sentinel includes adapters for 6 scanning engines in `backend/app/services/scanners/`:

| Scanner Engine | Execution Method | Command / Entry Point | Input | Output Format | Parser Implemented? | Output Storage | Status |
|---|---|---|---|---|---|---|---|
| **Nmap** | Subprocess CLI | `nmap -sV -sC --open -oX - <host>` | Domain / Hostname | XML | `ET.fromstring()` | `Scan.parsed_output` (JSON) | **FULLY FUNCTIONAL** (Requires local `nmap` binary) |
| **Nuclei** | Subprocess CLI | `nuclei -u <target> -jsonl -silent -nc` | Target URL | JSON Lines | `json.loads()` per line | `Scan.parsed_output` (JSON) | **FULLY FUNCTIONAL** (Requires local `nuclei` binary) |
| **Nikto** | Subprocess CLI | `nikto -h <target> -Format json -output -` | Target Host | JSON / Text | `json.loads()` or regex line parser | `Scan.parsed_output` (JSON) | **FULLY FUNCTIONAL** (Requires local `nikto` binary) |
| **SQLMap** | Subprocess CLI | `python sqlmap.py -u <target> --batch --flush-session` | Target URL | Text / Custom log | `SQLMapParser` regex parser | `Scan.parsed_output` (JSON) | **FULLY FUNCTIONAL** (Requires hardcoded local Python script) |
| **SSL/TLS** | Python Socket / Native `ssl` | Native TCP connection to host:443 | Hostname:Port | Python SSL Cert Dict | Custom cert & cipher evaluator | `Scan.parsed_output` (JSON) | **FULLY FUNCTIONAL** (Built-in standard library) |
| **OWASP ZAP**| HTTP REST API | ZAP Daemon REST endpoints (`/JSON/spider/`, `/JSON/ascan/`) | Target URL | JSON REST Response | `json.loads()` alert extractor | `Scan.parsed_output` (JSON) | **PARTIALLY FUNCTIONAL** (Requires external ZAP daemon on port 8080) |

---

## 8. CURRENT DETECTION CAPABILITY

| Capability Area | Status | Implementation Details |
|---|---|---|
| **Finding Detection** | **IMPLEMENTED** | Raw findings extracted via 6 scanner adapters (Nmap, Nuclei, Nikto, SQLMap, SSL, ZAP). |
| **Finding Severity** | **IMPLEMENTED** | Basic severity normalization (`Low`, `Medium`, `High`, `Critical`) via `scanner_utils.py`. |
| **Finding Deduplication** | **NOT IMPLEMENTED** | Scans record duplicate findings on every re-run without fingerprinting. |
| **Vulnerability Fingerprinting** | **NOT IMPLEMENTED** | No hash computation based on asset + vulnerability title/CVE/path. |
| **Finding Correlation** | **NOT IMPLEMENTED** | No engine correlates multi-scanner results (e.g. Nmap open port + Nuclei CVE). |
| **Asset Enrichment** | **NOT IMPLEMENTED** | Assets are not updated with technology stack, open port summary, or CVE list after scans. |
| **Risk Scoring** | **PARTIALLY IMPLEMENTED** | Static HTTP log rule evaluator (`risk_service.py`) and basic scan risk aggregator (`calculate_risk_score`). |
| **Incident Creation** | **PARTIALLY IMPLEMENTED** | `Incident` database model and CRUD endpoints exist, but automated rule-based incident auto-creation is missing. |
| **Continuous Monitoring** | **NOT IMPLEMENTED** | Scans are triggered manually. No background scheduler, periodic cron, or queue runner exists. |

---

## 9. GGSIPU2665 READINESS ASSESSMENT

Evaluation against the goal: *"Agentic AI Platform for Continuous Attack Surface Discovery, Risk Prioritisation and Preemptive Hardening of Institutional Digital Assets."*

| 2665 Capability Requirement | Existing Infrastructure Reusable | Missing Infrastructure to Build | Readiness Score |
|---|---|---|---|
| **Asset Discovery** | Domain verification token logic in `website_service.py`. | Subdomain enumeration, port sweep auto-discovery, IP range expansion. | **20%** |
| **Asset Inventory** | `Website` model (`websites` table) with URL, IP, domain. | Unified `Asset` schema, tag hierarchy, cloud/owner metadata, asset criticality weights. | **40%** |
| **Attack-Surface Mapping** | Nmap & SSL scan output parsers. | Topological attack surface visualizer, dependency graph, asset exposure scoring. | **25%** |
| **Continuous Monitoring** | `Website.monitoring_enabled` flag & scan history. | Background task runner (Celery/APScheduler), cron schedule per asset. | **15%** |
| **Risk Prioritisation** | Heuristic rules in `risk_service.py`. | Contextual Risk Engine factoring Asset Criticality × Finding Severity × Threat Likelihood. | **30%** |
| **Hardening Recommendations** | Recommendation lists generated inside scanner reports. | Structured, actionable remediation playbooks indexed by CWE/CVE. | **20%** |
| **Hardening Execution** | None. | Policy-gated autonomous response engine, SSH/API ansible execution handlers. | **0%** |
| **Verification Engine** | Scanner execution framework (`scanner_worker.py`). | Closed-loop re-scan engine to verify vulnerability remediation automatically. | **30%** |
| **Agent / Task Orchestration**| Background tasks dispatch in `scan_router.py`. | Multi-agent state machine, tool-calling framework, agent safety guardrails. | **10%** |

---

## 10. AI ANALYST READINESS ASSESSMENT

| AI Component | Status | Empirical Code Evidence |
|---|---|---|
| **LLM Model Integration** | **NOT IMPLEMENTED** | `ai_provider` and `ai_model` strings exist only as columns in `Settings` table. No SDK calls (`openai`, `anthropic`, `google-genai`). |
| **LLM Gateway / Abstraction** | **NOT IMPLEMENTED** | No gateway module, prompt management, rate limiting, or fallback handler. |
| **RAG (Retrieval-Augmented Gen)**| **NOT IMPLEMENTED** | No document chunking, embeddings generator, or knowledge-base search. |
| **Embeddings & Vector Database** | **NOT IMPLEMENTED** | No ChromaDB, Qdrant, pgvector, or Faiss integration. |
| **Tool Calling / Functions** | **NOT IMPLEMENTED** | No function schemas mapping LLM calls to Sentinel database or scanner triggers. |
| **Agent Orchestration** | **NOT IMPLEMENTED** | No LangChain, LlamaIndex, AutoGen, or custom agent loop implementation. |
| **Structured Output Parser** | **NOT IMPLEMENTED** | No Pydantic output validation for LLM responses. |
| **AI Access to Security Data** | **NOT IMPLEMENTED** | No service layer providing context windows of active assets, scans, or incidents to an LLM. |
| **AI Security & Safety Engine** | **NOT IMPLEMENTED** | No prompt injection defense, policy verification, or confirmation human-in-the-loop gating. |

---

## 11. REUSE VS REBUILD ANALYSIS

### REUSE (Keep and build upon as-is)
1. **FastAPI Application & Router Setup (`main.py`, `routers/`):** Clean, modular endpoint routing structure.
2. **Scanner Adapters (`backend/app/services/scanners/`):** The 6 scanner execution modules (Nmap, Nuclei, Nikto, SQLMap, SSL, ZAP) correctly execute tools, process outputs, and compute execution metrics.
3. **Subprocess Utilities (`scanner_utils.py`):** Process isolation, binary existence checks, and string cleaning utilities are solid.
4. **Authentication & Session Validation (`security.py`, `session_service.py`):** Server-side database session revocation combined with JWT validation is secure and well-tested.
5. **Audit Logging Service (`audit_log_service.py`):** Exception-safe non-blocking audit logging mechanism.

### EXTEND (Refactor and enhance existing code)
1. **`Website` Model -> Unified `Asset` Schema:** Add `organization_id` FK, environment classifications, asset criticality score, and exposure metrics.
2. **`Incident` Model:** Add `organization_id` FK, `asset_id` FK, `scan_id` FK, and link evidence directly to database finding IDs.
3. **`Settings` Model:** Extend AI configuration to support dynamic provider credentials, custom prompts, and guardrail policies.
4. **Background Task Runner (`scanner_worker.py`):** Upgrade from FastAPI memory-bound `BackgroundTasks` to a durable task runner with scheduling support.
5. **Multi-Tenancy & RBAC (`organization_service.py`):** Enforce `organization_id` filtering across ALL backend SQL queries.

### BUILD (Construct completely from scratch)
1. **`Finding` Database Entity:** Normalized `findings` table supporting fingerprinting, status tracking, CVE indexing, and deduplication.
2. **Unified Risk Scoring Module:** Shared contextual engine calculating `Asset Criticality × Vulnerability Severity = Dynamic Risk`.
3. **Generic Agent Orchestrator:** Tool-calling state machine enabling AI analysts to query security state, trigger scans, and draft remediation plans.
4. **Policy & Safety Engine:** Rule-based approval gate requiring human verification for high-risk actions.
5. **Closed-Loop Verification Service:** Automatic verification engine that re-runs targeted scanners post-remediation.

---

## 12. ARCHITECTURAL GAPS & PRIORITIZATION

### P0 — Must Resolve Before Major Feature Implementation
1. **Missing Normalized `Finding` Table:** Scanner outputs are trapped in JSON blobs, making cross-scanner analysis and tracking impossible.
2. **Unenforced Multi-Tenancy:** Assets, scans, incidents, and logs lack `organization_id` foreign keys, exposing data across tenant boundaries.
3. **Disconnected Security Data Flow:** Scans do not spawn findings, findings do not trigger incidents, and incidents do not record audit logs.

### P1 — Important Infrastructure Gaps
1. **No Continuous Scheduling Engine:** Scans are exclusively manual; no cron or interval runner exists for automated discovery.
2. **Log-Centric Risk Scoring:** Current risk scoring only checks basic HTTP request keywords rather than asset vulnerabilities.
3. **Missing Automated Testing Suite:** Total absence of unit, integration, or API tests.

### P2 — Advanced / Future Capabilities
1. **Zero AI Integration Layer:** Missing LLM gateway, tool-calling schemas, RAG vector database, and prompt management.
2. **No Policy / Safety Verification Engine:** Lack of dry-run execution safety gates for autonomous actions.

---

## 13. CURRENT VS. TARGET ARCHITECTURE COMPARISON

| Architectural Area | Current State | Target State | Gap / Action Required |
|---|---|---|---|
| **Asset Schema** | `Website` table without tenant isolation. | Unified `Asset` model with org ownership, criticality, and tags. | Add `organization_id`, criticality, exposure rating. |
| **Scanner Engine** | 6 adapters saving JSON blobs to `scans`. | Modular scanner engine populating normalized `findings`. | Pipeline scanner output to `Finding` database records. |
| **Finding Lifecycle**| Trapped in JSON strings inside `scans`. | Standalone `Finding` entity with deduplication & state lifecycle. | Create `findings` database table & migration model. |
| **Deduplication** | None (duplicate findings per scan). | Deterministic hash fingerprinting `(asset_id + cve/rule_id + path)`. | Implement `calculate_fingerprint()` in finding service. |
| **Correlation** | None. | Multi-scanner vulnerability correlation engine. | Build correlation engine to map Nmap + Nuclei results. |
| **Risk Scoring** | Static HTTP log rule matcher in `rules.py`. | Contextual Risk Engine `(Asset Criticality × Finding Severity)`. | Create unified `RiskCalculator` service module. |
| **Incidents** | Isolated table without asset/scan FKs. | Incident management linked directly to Assets, Scans, & Findings. | Add `asset_id`, `finding_id`, `organization_id` FKs. |
| **Audit Logging** | Audits scans and member changes. | Immutable audit trail covering all security & AI operations. | Extend `create_audit_log` to cover AI & triage events. |
| **2665 Platform** | Manual website scanning. | Continuous attack surface discovery & proactive hardening platform. | Build asset discovery workflow & verification engine. |
| **AI Analyst** | Database settings fields only. | Autonomous AI Analyst with tool calling, RAG, & triage capabilities. | Implement LLM Gateway, vector store, & agent loop. |
| **Policy & Safety** | None. | Human-in-the-loop safety gate for all active interventions. | Build policy engine to gate execution of actions. |

---

## 14. RECOMMENDED IMPLEMENTATION ORDER

Following core engineering principles:

1. **Milestone 1: Database Normalization & Tenant Isolation (Foundation)**
   - Add `organization_id` foreign keys to `Website`, `Scan`, `Incident`, `Log`, and `Alert`.
   - Create the missing `Finding` database table with fingerprinting support `(asset_id, scanner, title, target, severity, status, fingerprint)`.
   - Update scanner parsers to create/update normalized `Finding` records upon scan completion.

2. **Milestone 2: Unified Risk Scoring & Incident Engine**
   - Create a shared `RiskEngine` module computing contextual asset risk.
   - Connect `Finding` detection threshold rules to automatically spawn or update `Incident` records.
   - Enforce RBAC and tenant isolation across all backend router queries.

3. **Milestone 3: Task Scheduler & Continuous Attack Surface Discovery (2665 Core)**
   - Replace memory-bound `BackgroundTasks` with a durable job runner (e.g., Celery/APScheduler).
   - Implement continuous attack surface discovery (subdomain enumeration + scheduled port & vulnerability scans).

4. **Milestone 4: Closed-Loop Verification & Safety Engine**
   - Build the `VerificationService` to automatically trigger targeted re-scans after incident mitigation.
   - Build the `PolicyEngine` to enforce human-in-the-loop verification before high-risk actions.

5. **Milestone 5: AI Analyst & Tool-Calling Integration**
   - Build the `LLMGateway` supporting model switching (OpenAI / Anthropic / Local LLM).
   - Implement structured tool calling (allowing the AI agent to query assets, search findings, and summarize incidents).
   - Add RAG capabilities for security standards and remediation playbooks.

---

## 15. FINAL EXECUTIVE SUMMARY

### What Sentinel Has Today
- A clean, functional **FastAPI backend** and **Vite/React frontend** architecture.
- **6 functional scanner adapters** (Nmap, Nuclei, Nikto, SQLMap, SSL, OWASP ZAP) capable of executing tool subprocesses and parsing outputs into structured JSON.
- A **JWT authentication** system backed by server-side database session validation and revocation.
- Baseline models for Websites, Scans, Incidents, Logs, Alerts, and Audit Logs.

### What Is Already Solid
- CLI subprocess isolation and error handling in `scanner_utils.py`.
- Non-blocking, best-effort audit logging infrastructure (`audit_log_service.py`).
- Frontend UI dashboard components and layout design.

### What Is Incomplete
- **Multi-Tenancy Enforceability:** Domain resources (`Website`, `Scan`, `Incident`) are unlinked from `Organization`.
- **Alerts & Incidents UI:** Frontend relies heavily on client-side mock enrichment (`alertsData.js`).
- **Scanners:** OWASP ZAP requires a manual local daemon setup; SQLMap relies on a hardcoded Windows user path.

### What Must Be Fixed Before the Detection Engine
1. **Create the `Finding` Database Model:** Transition from storing raw JSON in `scans` to indexed database records.
2. **Link Incidents & Assets:** Add foreign keys connecting Incidents directly to Websites, Scans, and Findings.
3. **Enforce Tenant Isolation:** Ensure every database query filters by `organization_id`.

### What Must Be Built for 2665
- Continuous asset discovery & subdomain enumeration worker.
- Contextual risk scoring engine combining finding severities with asset criticality.
- Automated verification engine for closed-loop remediation checks.

### Recommended Next Milestone
**Milestone 1: Unified Schema Refactoring & Normalized Finding Engine.**  
Refactor the database schema to introduce the `Finding` model, enforce `organization_id` tenant isolation across all tables, and update the scanner worker to populate normalized database findings.
