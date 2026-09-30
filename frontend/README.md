# Sentinel AI frontend

React 19 + Vite 8 SPA for the Sentinel security operations console.

## Configuration

The API base URL comes from `VITE_API_BASE_URL` (falls back to `http://127.0.0.1:8000`
in development only). Production builds must supply an HTTPS origin. Credentials are
never attached to requests outside the configured API origin; report/website links are
restricted to credential-free `http(s)` URLs.

## Authentication and tenancy

- `src/services/authClient.js` is the only module allowed to attach the bearer token.
  It also validates and attaches `X-Organization-ID` after server-side membership
  validation (`GET /organization/list`, then `GET /organization` with the selected ID).
- Every application page except `/login`, `/forgot-password`, and `/reset-password` is
  wrapped in `RequireAuth`, which bootstraps memberships, validates the selected
  organization, supports multi-organization selection, and offers organization
  onboarding (`POST /organization`) when the account has none.
- Logout calls `POST /sessions/logout` and clears the local token only on server
  success (local expiry clears immediately). 401 responses clear the session and route
  to login.
- Password recovery uses `POST /auth/forgot-password` / `POST /auth/reset-password`
  and never displays a reset token; delivery happens via the backend's configured
  (development) SMTP.

## Honest evidence rules

`src/services/evidence.js` contains pure helpers plus `src/services/evidence.test.js`
(regression tests; run with `node --test`):

- Scan completeness distinguishes `Completed`, `Failed`, `Partial`, `Cancelled`, and
  `truncated`; incomplete scans never render as successful clean assessments.
- Severity totals match the SQLMap headline (injectable + critical + warnings +
  databases) so summary and distribution counts stay consistent.
- Incident/response-action lists are paged to exhaustion (`collectPages`), including
  exact page-size multiples; failures surface as errors rather than silent partial
  lists.
- Dashboard labels match their data: total alerts (not "blocked 24h"), critical alerts
  (not "vulnerabilities"), completed scans only counted when `status === "Completed"`.
  Charts and scores show explicit empty/unavailable states; no synthetic traffic or
  default security score.
- Response actions are labeled `SIMULATED`; no EXECUTED enforcement claims until the
  backend performs real enforcement.
- Settings shows the redacted `api_key_configured` flag (no fake masked secrets) and
  read-only views for non-admin roles; About values avoid unverified version/build/TLS
  claims.

## Commands

```
npm run dev
npm run build
npm run lint
node --test src/services/evidence.test.js
```

On Windows, if the npm shim cannot resolve Node, invoke the installed binary
directly, e.g. `"/c/Program Files/nodejs/node.exe" node_modules/vite/bin/vite.js build`.
