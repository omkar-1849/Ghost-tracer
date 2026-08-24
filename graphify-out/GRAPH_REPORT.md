# Graph Report - new  (2026-08-21)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1016 nodes · 2171 edges · 73 communities (66 shown, 7 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 168 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f2db0c43`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- User
- Dashboard.jsx
- Scan
- OrganizationMember
- create_audit_log
- ist_now
- Alerts.jsx
- SettingsLayout.jsx
- Log
- settings_router.py
- website_router.py
- dashboard_router.py
- engineResults.jsx
- WebsiteLayout.jsx
- event_router.py
- EngineTab.jsx
- scannerApi.js
- Session
- scan_router.py
- Analytics.jsx
- websiteApi.js
- incident_router.py
- App.jsx
- alertsData.js
- Report.jsx
- InvestigationWorkspace.jsx
- main.py
- ScannerLayout.jsx
- devDependencies
- integration_router.py
- dependencies
- WebsiteDetailsDrawer.jsx
- SQLMapScanner
- authClient.js
- AddWebsiteModal.jsx
- AuditActivity.jsx
- WebsiteTable.jsx
- ssl_scanner.py
- BaseScanner
- .start_scan
- getDashboardStats
- IncidentEvidenceBase
- IncidentTimelineBase
- incident_note_router.py
- settingsApi.js
- report_schema.py
- Sentinel
- EvidencePanel.jsx
- AttackTypes.jsx
- ThreatDistribution.jsx
- get_recent_alerts
- package.json
- scripts
- Websites.jsx
- scanner_router.py
- eslint
- @eslint/js
- eslint-plugin-react-hooks
- globals
- @rolldown/plugin-babel

## God Nodes (most connected - your core abstractions)
1. `Session` - 144 edges
2. `User` - 53 edges
3. `create_audit_log()` - 49 edges
4. `resolve_audit_organization_id()` - 38 edges
5. `Scan` - 31 edges
6. `OrganizationMember` - 26 edges
7. `Log` - 19 edges
8. `ist_now()` - 19 edges
9. `Alerts()` - 19 edges
10. `BaseScanner` - 18 edges

## Surprising Connections (you probably didn't know these)
- `add_note()` --uses--> `User`  [INFERRED]
  backend/app/routers/incident_note_router.py → backend/app/models/user.py
- `update_incident_status()` --uses--> `User`  [INFERRED]
  backend/app/routers/incident_router.py → backend/app/models/user.py
- `change_member_role()` --uses--> `User`  [INFERRED]
  backend/app/routers/organization_router.py → backend/app/models/user.py
- `create()` --uses--> `User`  [INFERRED]
  backend/app/routers/organization_router.py → backend/app/models/user.py
- `create_member()` --uses--> `User`  [INFERRED]
  backend/app/routers/organization_router.py → backend/app/models/user.py

## Import Cycles
- None detected.

## Communities (73 total, 7 thin omitted)

### Community 0 - "User"
Cohesion: 0.06
Nodes (70): get_db(), PasswordResetToken, Base, Base, User, list_audit_logs(), get, forgot_password() (+62 more)

### Community 1 - "Dashboard.jsx"
Cohesion: 0.06
Nodes (38): Dashboard, feedTheme(), LiveAttackFeed(), loadFeed(), timeAgo(), Navbar(), badgeTheme(), RecentAlerts() (+30 more)

### Community 2 - "Scan"
Cohesion: 0.18
Nodes (15): Base, Scan, post, start_scan(), create_scan(), Create a Scan record and dispatch execution in a background thread. Uses the…, Legacy wrapper — preserved for backward compatibility. Prefer run_scan() for…, run_scan() (+7 more)

### Community 3 - "OrganizationMember"
Cohesion: 0.14
Nodes (31): OrganizationMember, Base, Organization, Base, change_member_role(), create(), create_member(), delete_member() (+23 more)

### Community 4 - "create_audit_log"
Cohesion: 0.13
Nodes (27): AuditLog, Base, Integration, Base, Base, Website, add_note(), post (+19 more)

### Community 5 - "ist_now"
Cohesion: 0.13
Nodes (22): cancel_scan(), Cancel a pending or running scan., NmapScanner, NucleiScanner, calculate_risk_score(), check_binary(), clean_output(), extract_host_port() (+14 more)

### Community 6 - "Alerts.jsx"
Cohesion: 0.12
Nodes (20): AlertsBackground(), AlertsHero(), SEVERITY_FILTERS, STATUS_FILTERS, SummaryStrip(), Alerts(), handleAddNote(), handleAssign() (+12 more)

### Community 7 - "SettingsLayout.jsx"
Cohesion: 0.12
Nodes (20): CONTEXT_DATA, DEFAULT_SETTINGS, SECTIONS, AboutSection(), AISection(), matchesSearch(), NotificationsSection(), PlatformSection() (+12 more)

### Community 8 - "Log"
Cohesion: 0.12
Nodes (19): Alert, Base, Log, Base, add_log(), get, post, recent_logs() (+11 more)

### Community 9 - "settings_router.py"
Cohesion: 0.13
Nodes (22): Base, Settings, export_settings(), _get_organization_id(), get_settings(), import_settings(), get, post (+14 more)

### Community 10 - "website_router.py"
Cohesion: 0.13
Nodes (19): create_website(), delete_website(), get_all_websites(), get_verification_token(), get_website(), delete, get, post (+11 more)

### Community 11 - "dashboard_router.py"
Cohesion: 0.20
Nodes (18): attack_types(), dashboard_stats(), live_feed(), get, security_score(), threat_activity(), threat_distribution(), top_attacking_ips() (+10 more)

### Community 12 - "engineResults.jsx"
Cohesion: 0.10
Nodes (6): ENGINE_RENDERERS, EngineResults(), getEngineRenderer(), metricTones, SeverityBadge(), severityClasses()

### Community 13 - "WebsiteLayout.jsx"
Cohesion: 0.14
Nodes (12): DeleteWebsiteDialog(), EmptyState(), HealthSegments(), SEGMENTS, SummarySkeleton(), TableSkeleton(), TOAST_DURATION, TOAST_STYLES (+4 more)

### Community 14 - "event_router.py"
Cohesion: 0.16
Nodes (14): verify_api_key(), Event, Base, event_details(), ingest_event(), list_events(), get, post (+6 more)

### Community 15 - "EngineTab.jsx"
Cohesion: 0.16
Nodes (15): RecommendationsList(), accents, EngineTab(), handleStartScan(), accents, ScanHistoryTable(), COL_WIDTHS, EngineStatusBadge() (+7 more)

### Community 16 - "scannerApi.js"
Cohesion: 0.22
Nodes (19): ScannerLayout(), bootstrap(), handleCancelScan(), handleDeleteScan(), showToast(), Report(), fetchReport(), cancelScan() (+11 more)

### Community 17 - "Session"
Cohesion: 0.20
Nodes (14): Incident, Base, IncidentTimeline, Base, Base, Session, assign_incident(), create_incident() (+6 more)

### Community 18 - "scan_router.py"
Cohesion: 0.19
Nodes (17): all_scans(), change_scan_status(), delete, get, put, Delete a scan record by ID., List every scan across all websites, newest first., remove_scan() (+9 more)

### Community 19 - "Analytics.jsx"
Cohesion: 0.13
Nodes (13): Analytics, AnalyticsBackground(), ACCENTS, AnalyticsCard(), AnalyticsSection(), ComingSoonPanel(), VARIANTS, TopAttackingIPs() (+5 more)

### Community 20 - "websiteApi.js"
Cohesion: 0.19
Nodes (15): healthDot(), TargetSelect(), connectWebsite(), createWebsite(), disconnectWebsite(), errorMessage(), getIntegration(), getVerificationToken() (+7 more)

### Community 21 - "incident_router.py"
Cohesion: 0.20
Nodes (16): assign_incident(), get_all_incidents(), get_incident(), get_statistics(), get, update_incident_status(), Config, IncidentAssign (+8 more)

### Community 22 - "App.jsx"
Cohesion: 0.14
Nodes (9): Alerts, App(), Login, Report, Scanner, Settings, SettingsLayout(), navItems (+1 more)

### Community 23 - "alertsData.js"
Cohesion: 0.14
Nodes (15): ATTACK_FAMILIES, enrichAlert(), EVIDENCE_POOL, FALLBACK_INCIDENTS, FALLBACK_RAW, formatClock(), hashStr(), PROTOCOL_POOL (+7 more)

### Community 24 - "Report.jsx"
Cohesion: 0.20
Nodes (13): AssessmentHero(), computeSeverityBreakdown(), MetadataPanel(), ParsedJsonViewer(), riskLabelFromScore(), RiskMetric(), SEVERITY_ORDER, SEVERITY_STYLES (+5 more)

### Community 25 - "InvestigationWorkspace.jsx"
Cohesion: 0.16
Nodes (7): formatDateTime(), timeAgo(), AttackDetails(), IncidentQueue(), IncidentRow(), InvestigationWorkspace(), ResponseActions()

### Community 26 - "main.py"
Cohesion: 0.14
Nodes (10): home(), get, IncidentEvidence, Base, IncidentNote, Base, Base, ScanResult (+2 more)

### Community 27 - "ScannerLayout.jsx"
Cohesion: 0.22
Nodes (9): ACTIVE_STATUSES, SCANNER_ENGINES, SCANNER_STATUS, collectRecentVulnerabilities(), countSeverityFindings(), OverviewTab(), severityText, stateThemes (+1 more)

### Community 28 - "devDependencies"
Cohesion: 0.13
Nodes (15): @babel/core, babel-plugin-react-compiler, eslint-plugin-react-refresh, devDependencies, @babel/core, babel-plugin-react-compiler, eslint-plugin-react-refresh, @types/react (+7 more)

### Community 29 - "integration_router.py"
Cohesion: 0.21
Nodes (13): connect_website(), disconnect_website(), get_website_integration(), delete, get, post, Request, regenerate_website_key() (+5 more)

### Community 30 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, lucide-react, react, react-dom, react-router-dom, recharts, tailwindcss, @tailwindcss/vite (+7 more)

### Community 31 - "WebsiteDetailsDrawer.jsx"
Cohesion: 0.15
Nodes (7): formatDate(), HEALTH_STYLES, IntegrationTab(), METHOD_LABELS, TABS, VERIFICATION_METHODS, WebsiteDetailsDrawer()

### Community 32 - "SQLMapScanner"
Cohesion: 0.24
Nodes (4): SQLMapScanner, SQLMapParser, SQLMapRecommendationEngine, SQLMapReportGenerator

### Community 33 - "authClient.js"
Cohesion: 0.25
Nodes (11): RequireAuth(), Login(), getAuditLogs(), getErrorMessage(), authFetch(), clearToken(), getToken(), isAuthenticated() (+3 more)

### Community 34 - "AddWebsiteModal.jsx"
Cohesion: 0.22
Nodes (9): AddWebsiteForm(), AddWebsiteModal(), createEmptyForm(), ENVIRONMENT_FILTER_OPTIONS, ENVIRONMENTS, HEALTH_FILTER_OPTIONS, STATUS_FILTER_OPTIONS, CustomSelect() (+1 more)

### Community 35 - "AuditActivity.jsx"
Cohesion: 0.30
Nodes (9): AuditActivity(), AuditRow(), displayAction(), displayResource(), EMPTY_FILTERS, formatExactTimestamp(), formatTimestamp(), initialFilters() (+1 more)

### Community 36 - "WebsiteTable.jsx"
Cohesion: 0.18
Nodes (6): getScoreColor(), HEALTH_DOTS, RowActions, STATUS_DOTS, WebsiteRow, WebsiteTable()

### Community 37 - "ssl_scanner.py"
Cohesion: 0.31
Nodes (4): datetime, Parses cert date formats like 'May 16 00:00:00 2024 GMT, Helper to parse Subject/Issuer tuples into a readable string., SSLScanner

### Community 38 - "BaseScanner"
Cohesion: 0.22
Nodes (6): ABC, BaseScanner, Execute a scan end-to-end. Opens its own database session, queries the Scan…, Convert raw scanner output into structured findings data., Generate the standardized report dict stored in parsed_output., Base contract for every scanner engine. Every scanner (SQLMap, Nmap, Nikto,…

### Community 40 - "getDashboardStats"
Cohesion: 0.27
Nodes (7): AnalyticsHero(), loadStats(), KPI_DEFS, TIME_RANGES, Dashboard(), loadStats(), getDashboardStats()

### Community 41 - "IncidentEvidenceBase"
Cohesion: 0.28
Nodes (7): get_evidence(), get, Config, IncidentEvidenceBase, IncidentEvidenceCreate, IncidentEvidenceResponse, BaseModel

### Community 42 - "IncidentTimelineBase"
Cohesion: 0.28
Nodes (7): get_timeline(), get, Config, IncidentTimelineBase, IncidentTimelineCreate, IncidentTimelineResponse, BaseModel

### Community 43 - "incident_note_router.py"
Cohesion: 0.32
Nodes (6): get_notes(), get, Config, IncidentNoteCreate, IncidentNoteResponse, BaseModel

### Community 44 - "settingsApi.js"
Cohesion: 0.43
Nodes (6): getSettings(), importSettings(), mapToBackend(), mapToFrontend(), resetSettings(), updateSettings()

### Community 45 - "report_schema.py"
Cohesion: 0.53
Nodes (5): Findings, Metadata, BaseModel, ScanReport, Summary

### Community 47 - "EvidencePanel.jsx"
Cohesion: 0.53
Nodes (5): detectEvidenceType(), EVIDENCE_TYPES, EvidencePanel(), splitDetectionReasons(), statusColor()

### Community 48 - "AttackTypes.jsx"
Cohesion: 0.53
Nodes (5): AttackTypes(), loadAttackTypes(), SEVERITY_BY_NAME, severityFor(), getAttackTypes()

### Community 49 - "ThreatDistribution.jsx"
Cohesion: 0.47
Nodes (4): COLORS, ThreatDistribution(), loadDistribution(), getThreatDistribution()

### Community 50 - "get_recent_alerts"
Cohesion: 0.50
Nodes (3): get, recent_alerts(), get_recent_alerts()

### Community 51 - "package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 52 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 53 - "Websites.jsx"
Cohesion: 0.40
Nodes (3): Websites, useToasts(), WebsiteLayout()

### Community 54 - "scanner_router.py"
Cohesion: 0.14
Nodes (16): cancel_scan_endpoint(), get_scan(), get_scan_report(), list_engines(), get, post, Get the parsed report for a completed scan., Start a scan using any registered scanner engine. (+8 more)

## Knowledge Gaps
- **80 isolated node(s):** `Config`, `Config`, `Config`, `Config`, `Config` (+75 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Session` connect `Session` to `User`, `Scan`, `OrganizationMember`, `create_audit_log`, `ist_now`, `Log`, `settings_router.py`, `website_router.py`, `dashboard_router.py`, `event_router.py`, `scan_router.py`, `incident_router.py`, `main.py`, `integration_router.py`, `IncidentEvidenceBase`, `IncidentTimelineBase`, `incident_note_router.py`, `get_recent_alerts`, `scanner_router.py`?**
  _High betweenness centrality (0.151) - this node is a cross-community bridge._
- **Why does `create_audit_log()` connect `create_audit_log` to `User`, `SQLMapScanner`, `Scan`, `OrganizationMember`, `ist_now`, `ssl_scanner.py`, `.start_scan`, `Log`, `settings_router.py`, `incident_note_router.py`, `Session`, `scan_router.py`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `User` connect `User` to `OrganizationMember`, `create_audit_log`, `settings_router.py`, `website_router.py`, `incident_note_router.py`, `incident_router.py`, `main.py`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `Session` (e.g. with `get_session()` and `get_user_sessions()`) actually correct?**
  _`Session` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 36 inferred relationships involving `User` (e.g. with `list_audit_logs()` and `forgot_password()`) actually correct?**
  _`User` has 36 INFERRED edges - model-reasoned connections that need verification._
- **Are the 16 inferred relationships involving `Scan` (e.g. with `get_scan()` and `get_scan_report()`) actually correct?**
  _`Scan` has 16 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Config`, `Config`, `Config` to the rest of the system?**
  _80 weakly-connected nodes found - possible documentation gaps or missing edges._