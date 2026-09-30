# Sentinel AI — Security Operations Platform

Sentinel is a multi-tenant security operations, threat telemetry analysis, and vulnerability assessment platform. It provides automated security log correlation, deterministic threat risk evaluation, background vulnerability scanning, and an interactive real-time analyst dashboard.

---

## Architecture Overview

```
+─────────────────────────────────────────────────────────────────────────────+
|                        FRONTEND CLIENT (Vite + React)                       |
|               Port: 5173 | Modern Borderless Translucent Console            |
|                                                                             |
|   Dashboard View         Websites View        Scanner View     Alerts View  |
|   Incident Response      Audit Logging        Threat Analytics Settings     |
+──────────────────────────────────────┬──────────────────────────────────────+
                                       │ HTTP REST / Bearer JWT
+──────────────────────────────────────▼──────────────────────────────────────+
|                     FASTAPI BACKEND SERVICE (:8000)                         |
|                                                                             |
|   - Authentication & Session Management (HMAC Rate Limited)                 |
|   - Multi-Tenant RBAC & Isolation Enforcement (X-Organization-ID)           |
|   - Deterministic Threat Detection & Risk Scoring Engine                    |
|   - Scan Orchestration & Target Validation Engine                          |
|   - Interactive OpenAPI / Swagger Documentation (/docs)                     |
+──────────────────────────────────────┬──────────────────────────────────────+
                                       │
+──────────────────────────────────────▼──────────────────────────────────────+
|                         DATABASE & SCAN WORKERS                             |
|                                                                             |
|   - SQLAlchemy ORM (SQLite / MySQL)                                         |
|   - Background Scan Worker Pool (SSL, Nmap, Nikto, Nuclei, ZAP)             |
+─────────────────────────────────────────────────────────────────────────────+
```

---

## Prerequisites

- **Python**: 3.11+
- **Node.js**: 20+ (with npm)
- **Git**

---

## Backend Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment**:
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   ```bash
   # Copy the example configuration template
   cp .env.example .env
   ```
   *Note: Populate `.env` with a secure random `JWT_SECRET` and appropriate database URL for your environment.*

5. **Run database migrations and start the server**:
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

6. **Interactive API Documentation**:
   - Swagger UI: `http://127.0.0.1:8000/docs`
   - ReDoc: `http://127.0.0.1:8000/redoc`

7. **Run backend tests**:
   ```bash
   python -m unittest discover tests
   ```

---

## Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   # Copy the example configuration template
   cp .env.example .env
   ```
   *In development, `VITE_API_BASE_URL` defaults to `http://127.0.0.1:8000`.*

4. **Start development server**:
   ```bash
   npm run dev
   ```
   *The frontend development server runs at `http://localhost:5173`.*

5. **Build for production**:
   ```bash
   npm run build
   ```

6. **Run frontend tests**:
   ```bash
   npm run test
   ```

---

## Key Security Features

- **Multi-Tenant Scoping**: All queries and mutations are strictly scoped to the verified tenant organization context (`X-Organization-ID`).
- **Honest Evidence Enforcement**: Scan statuses, severity metrics, and response actions strictly reflect backend telemetry without artificial manipulation.
- **SSRF & Target Protection**: All outbound scanning and ownership verification requests undergo strict IP and destination validation.
- **Credential Protection**: No secrets, tokens, or environment-specific credentials are committed to version control.
