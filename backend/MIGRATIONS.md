# Backend schema migration

## Reproducible backend environment

`requirements.txt` pins runtime dependencies (including bundled SDK requests
support); `requirements-dev.txt` includes it plus pytest and HTTPX/TestClient
requirements. These are **observed environment pins**, not a security audit or
hash-verified, cross-platform lock. Reference environment on 2026-09-17:
Windows x64, CPython 3.13.5, pip 26.2.1, FastAPI 0.140.0, Starlette 1.3.1,
SQLAlchemy 2.0.51, PyMySQL 1.2.0, Pydantic 2.13.4, Uvicorn 0.51.0,
Passlib 1.7.4, bcrypt 4.0.1, HTTPX 0.28.1 and pytest 8.4.2.
`sniffio` is not installed or required by the observed dependency metadata.

Validation performed: current-venv `pip check` returned **No broken requirements
found**; dependency imports passed without importing the app; an offline
`pip install --dry-run --no-index -r requirements-dev.txt` found all requirements
already satisfied. No packages were installed. A clean installation, full test
suite, app startup and live MySQL migration were NOT executed for this
deployment-only change. Metadata consistency does not prove runtime behavior,
package authenticity, absence of vulnerabilities, or availability on an index.

The following are **operator commands, not commands executed for this change**.
Use a new environment rather than modifying the existing `backend/venv`.
PowerShell commands quote the repository path, including its two spaces:

```powershell
Set-Location -LiteralPath 'C:\Users\omkar\OneDrive\Desktop\Games\c  program\new\backend'
# Verify your approved Python installation reports 3.13.5 first.
py -3.13 --version
if (Test-Path -LiteralPath '.venv-deploy') { throw 'Choose a NEW environment path' }
py -3.13 -m venv .venv-deploy
$python = (Resolve-Path '.venv-deploy\Scripts\python.exe').Path
# Run only when package installation has been approved.
& $python -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
& $python -m pip check
if ($LASTEXITCODE -ne 0) { throw 'Dependency check failed' }
# For a separate test environment, use requirements-dev.txt instead.
```

Use a trusted package source; review upgrades deliberately. Before another OS
or Python version is approved, rebuild and validate it separately. These pins
exclude external scanner binaries and do not provision or enable those tools.
Do not add `uvicorn[standard]` implicitly: it introduces unpinned optional
packages. Python provides SQLite; PyMySQL is included for `mysql+pymysql` URLs.

## Process environment and isolated startup rehearsal

`backend/.env.example` contains placeholders only. The app reads process
variables and does **not** load `.env` automatically. `python-dotenv` is not
installed, so these instructions do not use Uvicorn `--env-file`. Inject real
values through an access-controlled process/secret manager. Do not execute an
untrusted env file as shell code, print the environment, or put credentials in
command arguments, transcripts, shared logs or version control. Local `.env`
files remain ignored; only `.env.example` is exempted.

Required runtime variables are `DATABASE_URL` and a unique random `JWT_SECRET`
of at least 32 characters. The template's JWT placeholder is explicitly
rejected; its database placeholder is intentionally invalid. `ENVIRONMENT`
defaults to production. `CORS_ORIGINS` accepts exact comma-separated origins
(no path/trailing slash or wildcard); production requires HTTPS origins.
Empty CORS disables browser cross-origin access, not direct API access.
Recovery configuration is validated on use: supply a trusted SMTP host/sender,
TLS settings and an explicit HTTPS `RECOVERY_URL` before enabling recovery.
An unset SMTP port follows TLS mode; an explicitly set port must match the relay.

For a **fresh, disposable local rehearsal only**, use the prepared interpreter
above in a new PowerShell session. This block creates a unique empty database
location outside the repo, never a default or existing database. Use OS-level
outbound-network restrictions as well; test mode skips background worker
startup but is not an authorization or network sandbox. Do not submit scans,
recovery requests or integration traffic during the rehearsal.

```powershell
Set-Location -LiteralPath 'C:\Users\omkar\OneDrive\Desktop\Games\c  program\new\backend'
$python = (Resolve-Path '.venv-deploy\Scripts\python.exe').Path
$isolated = Join-Path ([IO.Path]::GetTempPath()) ('sentinel-rehearsal-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $isolated -ErrorAction Stop | Out-Null
$dbFile = Join-Path $isolated 'rehearsal.sqlite3'
if (Test-Path -LiteralPath $dbFile) { throw 'Refusing an existing database' }
$env:DATABASE_URL = 'sqlite:///' + $dbFile.Replace('\', '/')
$env:ENVIRONMENT = 'test'
$env:JWT_SECRET = (& $python -c 'import secrets; print(secrets.token_urlsafe(48))')
if ($LASTEXITCODE -ne 0) { throw 'Ephemeral secret generation failed' }
$env:CORS_ORIGINS = ''
$env:SENTINEL_SCANNER_EGRESS_ISOLATED = '0'
$env:SENTINEL_ZAP_API_URL = ''
$env:SENTINEL_ZAP_API_KEY = ''
$env:SENTINEL_AI_API_KEY = ''
$env:SMTP_HOST = ''
$env:SMTP_FROM = ''
$env:SMTP_USERNAME = ''
$env:SMTP_PASSWORD = ''
$env:RECOVERY_URL = ''
# Fresh empty rehearsal only: no pre-existing data requires a backup.
# For ANY restored/existing database, fulfill the backup prerequisites below.
& $python -m app.database.migrations --backup-confirmed
if ($LASTEXITCODE -ne 0) { throw 'Migration failed; do not start' }
# Read-only schema readiness; no app import, schema repair or workers.
& $python -c 'import os; from sqlalchemy import create_engine; from app.database.migrations import check_schema; e=create_engine(os.environ["DATABASE_URL"]); check_schema(e); e.dispose(); print("Schema ready")'
if ($LASTEXITCODE -ne 0) { throw 'Schema readiness failed; do not start' }
& $python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
# Ctrl+C stops the foreground rehearsal. Close this shell to discard its env.
```

From a second shell, `Invoke-RestMethod -Uri 'http://127.0.0.1:8000/'` should
report `status=running`. This is only a startup/liveness check, not a tenant
isolation or functional test. The app's startup checks schema but never migrates.
For the migration-specific existing tests, from `backend` in an isolated test
environment run `python -B -m unittest discover -s tests -p test_migrations.py -v`.
Do not point test processes at production credentials or existing repo databases.

## Production handoff, secret rotation and responsibility

Production is a separate deployment, not a change of the rehearsal's database
URL. Follow the backup/maintenance steps below on an isolated restored copy
first. Inject a reviewed database URL from the secret manager, then explicitly
run `python -m app.database.migrations --backup-confirmed` (and the reviewed
`--ownership-map` file when needed). Use the read-only `check_schema` command
above against that same operator-selected database before starting traffic.
No CLI `--check` option exists. Use separate temporary migration credentials
with required DDL rights and a least-privilege application database account.
Never supply credential-bearing URLs through `--database-url` on a shared host.

After approval, inject `ENVIRONMENT=production`, fresh secrets and exact HTTPS
CORS origins; run `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
--workers 1` behind the approved HTTPS reverse proxy (as one shell command).
Do not use `--reload`. Production/development startup starts workers and can
mark interrupted pending/running jobs failed; coordinate one API process and
all other writers. The isolation flag set to `0` is not a universal scan-disable
switch. Keep external scanner integrations unconfigured; their enablement and
network isolation are outside this deployment-only procedure.

Assign named people and approval records for these roles before deployment;
no real organization or person is inferred from this repository:

| Responsibility | Accountable role | Required evidence |
| --- | --- | --- |
| Backup, restore drill, DB credential rotation and migration | DBA / database owner | Verified restore, maintenance approval, migration report |
| Process environment, TLS, service restart and egress policy | Deployment / platform owner | Reviewed configuration and startup/readiness result |
| JWT, SMTP and provider credential rotation | Security owner with credential owner | Secret-manager version IDs, revocation confirmation (never secret values) |
| Each legacy root row's tenant mapping | Tenant data steward plus independent reviewer | Authoritative ownership record and reviewed mapping |
| Quarantine and tenant access acceptance | Application owner / security reviewer | Deny-NULL and cross-tenant checks on restored copy |

Treat previously committed/shared credentials as compromised: removing a file
or ignoring `.env` does not revoke them. Inventory names and owners without
exporting secret values; revoke/replace credentials at the issuing service,
update secret-manager references and restart affected processes. Runtime and
SMTP configuration are cached. Do not roll back to a compromised credential.

* **JWT:** generate a unique random production secret in a private secret
  manager, replace it across all instances in a coordinated maintenance window
  and restart every process. There is no dual-key rotation scheme here. Old
  access JWTs cease validating; users must log in again. JWT rotation alone
  does not delete sessions, revoke separate reset tokens, or rotate SDK keys.
* **Database:** DBA provisions the replacement account/credential, validates
  least privilege and transport policy, updates the managed URL, restarts to
  replace connection pools, then revokes the old credential. Preserve backups
  under restricted access; do not rewrite historical data as part of rotation.
* **SMTP / optional provider / daemon credentials:** rotate at the provider,
  update the managed environment, restart consumers, verify using private test
  recipients or approved checks, and revoke old values. `SENTINEL_AI_API_KEY`
  is currently a settings reference/configured indicator, not an SDK ingestion
  key or proof that an external provider is called.
* **SDK integration credentials:** rotate via the existing authorized
  integration-management workflow and update the owning client's private
  configuration; the environment template does not replace these per-integration
  credentials. Plan for any client interruption and verify old credentials fail.
* **Legacy settings secrets and reset tokens:** additive migration preserves
  historical values. Have the security owner approve separate revocation and
  retention/remediation work; do not assume migration or JWT rotation cleans
  them up. Never dump those values in reports or mapping files.

For ownership mapping, maintain the JSON outside the repo with restricted
access and reviewable provenance (no secrets). A data steward must prove each
row-to-existing-organization relationship using authoritative records; the
independent reviewer approves it before the DBA passes `--ownership-map`.
Follow the exact key format and rejection rules below. Retain the reviewed
mapping, approval and aggregate quarantine report securely. Unknown ownership
must remain NULL/quarantined; never guess or map everything to organization 1.
Rehearse mapping and authorization checks on the restored copy before production.

## Safety and deployment sequence

Migrations are explicit operator actions, never an application-startup repair.
Do not start an old writer alongside this migration or run multiple migrators.

1. Stop API processes, workers, scheduled jobs, and all other writers.
2. Take an **external database backup**, verify that it can be restored, and retain
   the old application/configuration. For MySQL use your DBA-approved snapshot or
   consistent dump workflow; for SQLite stop writers and use the SQLite backup
   API or a verified copy that accounts for WAL files. This command **does not
   create or validate a backup**. `--backup-confirmed` acknowledges your work; it
   is not evidence that a backup exists.
3. Test against a restored, isolated copy with the same database version first.
4. Set `DATABASE_URL` explicitly in the operator environment. From `backend`, run
   `python -m app.database.migrations --backup-confirmed`. Optionally add
   `--ownership-map /absolute/path/to/reviewed-mapping.json`. `--database-url` is
   also supported but may expose credentials in process listings/history.
   There is no default live database URL and no import of the configured app engine.
5. Review the JSON report, especially `quarantined` and `legacy_constraints`.
   Confirm tenant-scoped authorization denies NULL owners before allowing traffic.
6. Run the read-only readiness check, then deploy/start the application. The
   parent-owned startup/database session code must call `check_schema(engine)`
   before allowing request sessions; it raises `SchemaMismatchError` with an
   explicit migration instruction. It must not call `create_all` or `migrate`.

The migration API is `migrate(engine, ownership_mapping=None) -> dict` and
`check_schema(engine) -> None` (or `SchemaMismatchError`). Programmatic callers
must enforce the same external-backup/maintenance prerequisites. The injected
engine API intentionally has no dependency on application credentials.

## What changes

Supported dialects are SQLite and MySQL. SQLite tests use disposable temporary
files with foreign-key enforcement enabled. MySQL SQL is compiled in tests, but
no live MySQL database was used to validate this change; restore-copy testing on
your actual MySQL release is mandatory. MariaDB is not claimed as supported.

The migration loads an explicit model allowlist, creates missing tables through
`Base.metadata.create_all` **only inside the explicit migration**, adds missing
columns and indexes, and records version 1 in `sentinel_schema_versions`.
Repeating the command re-inspects the schema, repairs incomplete additive work,
and applies newly supplied mappings without duplicating the version record.
Newer recorded versions are rejected. Unrelated tables are left alone.
Identifiers come only from allowlisted model metadata and use the dialect's
identifier preparer; ownership values use bound SQLAlchemy statements.

There are no table drops, table rebuilds, destructive type conversions, blanket
row assignments, deletes, or data purges. Existing column types, foreign keys,
uniqueness constraints, defaults, and nullability are not altered. New foreign
keys use model deletion policies (SQLite inline REFERENCES; MySQL ADD CONSTRAINT).
Fresh schemas receive all model constraints. Added numeric/boolean columns with
safe scalar defaults are backfilled; other added columns are nullable for old
unknown data, even if the fresh-model column is required. Existing uniqueness
conflicts can prevent new unique indexes; resolve these explicitly, never by
silently deleting historical rows.

`legacy_constraints` reports retained nullability and foreign-key/delete-policy
mismatches (not an exhaustive constraint audit). In particular, pre-existing
AuditLog actor IDs are preserved even when the user is unknown. Fresh audit
organization/user columns are nullable foreign keys, but an existing audit
column is not rewritten or automatically assigned. Review existing audit
NOT NULL columns and orphan IDs with your DBA. The readiness check verifies
model tables, columns, compatible types/lengths, named indexes and version, not
all constraints or business data validity; it intentionally accepts documented
legacy constraint differences. Existing wrong delete policies require an
operator-reviewed, database-specific follow-up before relying on deletion
preservation. Do not delete referenced roots until this review is complete.

MySQL DDL may auto-commit; SQLite DDL transaction behavior also depends on its
DBAPI. An error may leave additive work applied without a version stamp. After
correcting the reported issue, re-run with writers still stopped. This is not a
transactional rollback tool; rollback means restoring the verified external
backup together with compatible application code.

## Operator ownership mapping

A mapping is a JSON object with singular keys `website`, `log`, `alert`,
`incident`, and `settings`. Each value maps an existing row ID to an existing
organization ID, for example (replace these illustrative IDs with reviewed IDs):

```json
{
  "website": {"12": 7, "19": 8},
  "log": {"43": 7},
  "alert": {"25": 7},
  "incident": {"31": 7},
  "settings": {"2": 8}
}
```

IDs must be positive integers, organization IDs must exist, and every mapped
root must exist. Duplicate JSON keys, normalized duplicate IDs, unknown root
names, invalid IDs, overwrites of known owners, and contradictory parent links
are rejected. Validation happens before schema changes. Do not use a blanket
organization-1 mapping or derive ownership from display names, URLs, IPs,
assignee names, API-key text, or the first registered user.

Only declared FK parent relationships with actual existing parent rows can
propagate ownership. Direction is parent to child, never child to parent. All
non-NULL parent links must resolve to the same known organization before an
unowned child can be inferred. Unresolved or dangling links block inference;
contradictory known parents reject the migration. A root may be explicitly
mapped despite an unresolved parent, but later mapping that parent to another
tenant is rejected. The operator remains responsible for proving root ownership.

Websites can establish integration, event and scan ownership. Existing proven
website/event/log links can establish alert ownership; alert/website links can
establish incident ownership; incident links can establish evidence, note,
timeline and response-action ownership. Newly added empty correlation columns
do not magically establish relationships. Independent logs/alerts/incidents/
settings without proof remain NULL unless explicitly mapped. Standalone legacy
ScanResult rows have no proven parent link, so their ownership stays NULL even
if their target URL resembles a known website. Audit/identity records are not
included in automatic ownership inference. No identity is fabricated.

NULL ownership means **quarantined**, not public, not shared, and not accessible
through a default tenant. Authorization must enforce this separately. There is
no deletion of quarantined records. The report counts remaining NULL rows in
the thirteen tenant-owned model tables, not identity or audit tables.

## Timestamp and secret handling

New model timestamp defaults use UTC; naive DateTime values are UTC by contract.
The previous fixed +05:30 model defaults were removed. **Existing timestamps
are untouched**: the migration cannot determine whether a historical value was
UTC, fixed-offset local time, or supplied explicitly. Do not silently subtract
5:30 or label ambiguous historical values as known UTC. If an organization later
proves a timestamp's origin, perform a separately reviewed conversion retaining
its source and audit trail. Ownership updates explicitly suppress ORM/Core
`onupdate` timestamps so mapping does not rewrite historical `updated_at` values.
Missing historical timestamp columns are added NULL rather than filled with the
migration's execution time.

Settings.api_key has an empty default for new rows; it does not seed a dummy
key. Existing values are preserved by the additive migration and must be moved
to environment references/secret management through a separate reviewed process.
The settings service/serializer, not the model, must prevent plaintext returns.

## Isolated tests

From `backend`, with the backend Python environment:

```text
python -m unittest discover -s tests -p test_migrations.py -v
```

The suite injects temporary SQLite engines and never imports the configured
application engine. It covers fresh/legacy migration, repeatability, version
checks, read-only readiness failures, explicit mapping, contradiction rejection
before DDL, unresolved-parent quarantine, timestamp preservation, unknown audit
actor preservation, security-history SET NULL deletion, model runtime mapping,
MySQL DDL compilation, and the CLI backup acknowledgement guard.
