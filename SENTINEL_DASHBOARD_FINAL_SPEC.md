# Sentinel AI Dashboard — Final Design and Implementation Specification

**Status:** Final design specification for a later implementation phase  
**Scope:** Dashboard page and directly related dashboard presentation only  
**Authority:** `SENTINEL_DASHBOARD_CURRENT_STATE.md` is authoritative for current structure, data, behavior, APIs, polling, and preserved functionality. This document defines the target presentation and implementation constraints. The accompanying `SENTINEL_DASHBOARD_DESIGN_TOKENS.json` is the exact token source for the visual values below.

## 1. Product intent

Build a premium, warm graphite security operations instrument that reads as one continuous environment. It should feel precise, calm, and operational: a deliberate hierarchy of posture, aggregate signals, telemetry, and recent events, instead of a grid of interchangeable cards. The redesigned Dashboard must harmonize with the existing warm graphite and bronze Sidebar while retaining all current data and user flows.

Use translucent graphite material with genuine ambient transmission, restrained bronze/amber emphasis, legible Apple/macOS/iOS-inspired sans typography, fine structural rules, and carefully composed telemetry. Use monospace only where fixed-width data improves scanning: numeric counters, IP/host values, and timestamps. A technical background may be introduced in a later implementation, but this spec does not prescribe an image or artwork.

### Explicit exclusions

- Do not copy the reference image's personal-name greeting, organization branding, fabricated operational status, or zero-valued content as product data.
- Do not infer or add backend services, metrics, capabilities, routes, filters, or API fields.
- Do not change the Sidebar, Navbar behavior, app shell, routes, endpoint contracts, calculations, polling intervals, or error tolerance.
- Do not use cyan, electric blue, purple, rainbow gradients, neon cyberpunk lighting, excessive glow, opaque fake glass, generic SaaS card grids, weather/finance visual tropes, or stark white hover outlines.

## 2. Source-of-truth behavior to preserve

The following is a preservation checklist for implementation, not permission to alter behavior.

| Existing view/data | Source and exact meaning | Refresh |
|---|---|---:|
| Total websites | `GET /websites`; count `websites.length` via `getWebsites()` | 10 s |
| Total alerts | `GET /dashboard/stats`; display `stats.total_alerts` | 10 s |
| Completed scans | `GET /scans`; count records whose status uppercases to `COMPLETED` | 10 s |
| Critical alerts | `GET /dashboard/stats`; display `stats.critical_alerts` | 10 s |
| Security score and tier | `GET /dashboard/security-score`; integer 0–100, clamped. `<60` Elevated Risk, `60–84` Guarded, `>=85` Low Log Risk, null Unavailable | 10 s |
| Threat volume by hour | `GET /dashboard/threat-activity`; `{time, threats}` values grouped by hour; preserve current volume summation/display | 15 s |
| Recent high/critical events | `GET /dashboard/live-feed`; latest 10 records ordered newest-first, with `ip_address`, `threat_level`, `reason`, `timestamp` | 5 s |

Preserve `Promise.allSettled` orchestration for the three Dashboard aggregate fetches and its partial-failure behavior. Keep each existing component's independent polling and unmount cleanup. Do not synchronize, accelerate, or slow the API polls. Preserve `resolveThreatType`, `formatTimestamp`, and all existing parsing/calculation semantics. Keep loading placeholders, empty-state meaning, and errors listed below. Unknown values must never be presented as zero; retain the current em dash/unknown conventions.

Preserve navigation exactly:

- “View all activity” links to `/activity`.
- Each inspect action links to `/activity?ip=${encodeURIComponent(ip)}`.
- Navbar search continues routing to `/activity?q=${encodeURIComponent(query)}`.
- Do not change route definitions or introduce a dashboard-specific filter flow.

## 3. Information architecture and composition

Keep the existing shell: fixed Sidebar, sticky Navbar, and the existing scrollable `<main>`. The Dashboard is the only scope. Do not insert a second global header or duplicate controls already owned by Navbar.

At wide desktop widths, use a single page column within a responsive max-width frame (target max 1,600 px), with consistent page gutters. Arrange content in three visually connected bands, using shared alignment and fine separators rather than enclosing every subsection in its own rounded rectangle:

1. **Command/header band:** compact eyebrow “SECURITY OPERATIONS” and page title “Dashboard” with the existing explanatory subtitle “Recorded activity from the configured organization.” On the far side, show the date and local time concept described in §4. Keep a reserved, inline location for the aggregate load alert so an error is associated with the page without an unstyled paragraph or disruptive layout shift.
2. **Posture and metrics band:** one broad, translucent instrument surface. Place the security score as the anchor at the left, with its arc gauge, score, tier, and existing supporting labels. To its right, place the four existing aggregate metrics—Total Websites, Total Alerts, Completed Scans, Critical Alerts—as a single aligned metric rail. Separate metrics with subtle vertical hairlines, not individual card boundaries. Each metric retains its title, value, and descriptive subtitle. Bronze identifies key signal/score emphasis; severity semantics remain distinct and readable.
3. **Monitoring band:** a broad telemetry region paired with the recent threat feed at desktop. Telemetry is the primary wide area, with the threat event list as a narrower companion column (approximate 2:1 width relationship). Use shared surface continuity, an inset rule, or surface-tone changes to distinguish the regions; avoid two oversized independent cards. The activity region retains its heading, description, signal legend, chart, loading/empty/error presentation. The feed retains “Live Threat Activity”, its description, “View all activity” action, and records with timestamp, threat type, origin IP/host, severity, and inspect action. At widths unable to support readable columns, stack telemetry before the feed.

Do not remove a field or reduce access to existing information to make the layout fit. Maintain table semantics on desktop. At narrow widths, convert each event row into a readable stacked record with the same five data/action roles and accessible names; horizontal page overflow is not acceptable. The existing section order is posture/metrics, telemetry, then live activity. Keep this order when stacking.

### Suggested layout breakpoints

Use responsive CSS breakpoints equivalent to: compact below 700 px; intermediate 700–1,099 px; wide at 1,100 px and above. These are layout breakpoints, not API or behavior changes.

- **Wide (≥1,100):** score plus four-metric rail in one band; telemetry and feed in a 2:1 split; header title/subtitle and date/time sit on one line grouping where space allows.
- **Intermediate (700–1,099):** score anchors the first row; metrics wrap into a two-column rail with shared separators; monitoring stacks if either pane would be narrower than 340 px.
- **Compact (<700):** page gutter 18 px; heading and date/time may wrap; score followed by a two-column metric layout, then full-width telemetry and feed. Preserve comfortable tap targets (minimum 44 px for actions) and avoid clipped metric labels.

The exact responsive CSS may vary to match the shell's available width, but preserve this ordering, grouping, and readable minimums.

## 4. Header date/time concept

Include the reference's date/time concept as a quiet instrument readout in the Dashboard header: a human-readable full local date (for example, “Wednesday, 01 Oct 2026”) above or beside a more prominent local time (for example, “12:46 AM”). The examples illustrate formatting only and must not be hardcoded. Use the browser/device local timezone and locale formatting; do not imply UTC or a server-provided timestamp. Refresh only this display on a lightweight client-side minute boundary, clean up its timer on unmount, and prevent hydration/time-zone mismatch if server rendering is ever used. This is a display clock, not a data refresh: it must not alter or replace any API polling cadence. Do not add an unrequested timezone selector or location.

## 5. Visual system

All literal visual values are defined in the JSON token file. Refer to tokens rather than introducing competing per-component colors, radii, shadows, or typography values.

### 5.1 Canvas and ambient lighting

The background canvas remains an open asset/design decision. Its required material behavior is fixed: dark warm graphite base; very low-contrast, broad amber/bronze ambient light; optional subdued technical texture or abstract operational topography; no detailed scene that competes with labels or chart data. Keep the focal light behind/around the content rather than directly behind small text. The canvas should remain restrained when blurred through surfaces and retain readable contrast in both bright and dark ambient regions. Do not use the supplied reference background as the final asset by default.

### 5.2 Glass surfaces and structural grouping

Create actual frosted material with translucent layered graphite gradients, `backdrop-filter: blur(...) saturate(...)`, and a subtle inner top/rim highlight. Set a darker fallback color for browsers without backdrop-filter support. Content regions may share a single broad glass substrate; separate subregions with hairline dividers and restrained surface shifts. Reserve distinct rounded enclosures for the main instrument substrate, small semantic badges, and interactive controls where their affordance benefits from a contained shape. Do not apply the same rounded card to every metric, chart, and table.

The material should transmit a softened hint of ambient canvas light without reducing text contrast. Avoid uniformly opaque charcoal fills, strong frosted whiteness, thick borders, heavy drop shadows, and glass blur so strong that it smears underlying light into visual noise.

### 5.3 Palette and semantics

Use warm graphite surfaces and neutral ivory text, aligned with the Sidebar family. Bronze/amber is a restrained signal color for the score arc, active indicator, selected signal points, and small icon accents. Use semantic green only for explicitly healthy/online status, red for critical severity, and amber for high severity; never map “unknown” or “loading” to healthy. Severity color must be paired with a textual label/icon/shape cue and remain legible for color-vision differences. Avoid blue-family colors entirely.

### 5.4 Typography

Use the product's existing clean sans-serif stack (system/Inter-like sans) for headings, labels, descriptions, controls, and prose. Establish clear, generous hierarchy: page title 30 px/650; primary posture value 42 px/650; metric values 30 px/600; section headings 17 px/600; body 14–15 px/400–500; overline labels 11 px/600 with modest tracking. Avoid tiny uppercase labels as the default. Use tabular lining numerals for changing counts and time. Monospace may be applied only to IP/host text, timestamps in event records, and telemetry/counter values where alignment materially helps; do not use it for ordinary headings, subtitles, or all table headers.

### 5.5 Dividers, interaction, and motion

Use low-contrast warm hairline dividers to organize metrics and monitoring zones. Hover and focus feedback should be a slight bronze surface lift, warmer rim/inner highlight, and/or text/icon emphasis. Never use a white outline glow. Keyboard focus must have a clearly visible bronze focus ring that meets contrast expectations against the surface and does not resemble a hover border. Active navigation stays owned by the existing Sidebar.

Use short, calm transitions (roughly 160–220 ms, ease-out) for hover, focus, and surface changes. No animated pulsing, looping glows, parallax, or chart animation that implies extra live data. Respect `prefers-reduced-motion` by disabling nonessential transitions/animation.

## 6. Component-level rendering specification

### Page header and aggregate error

Keep title, subtitle, and semantic page heading. Style aggregate errors as an inline subdued warning strip within the header/content flow with an amber leading marker and readable text. Preserve `role="alert"` and exact existing error content: “Some dashboard data is unavailable. Counts shown as — are unknown.” Do not turn partial API failure into a page-blocking error. Keep the message visible while applicable; do not add automatic dismissal.

### Security posture instrument

Retain the log-derived semi-circular 0–100 score gauge and all labels (“LOG-BASED SCORE”, “Live”/“Unavailable”, score, tier, “Derived from recorded logs”/“Measured”). Use an elegant thin arc with a subdued graphite remainder and a controlled bronze progress arc. Score remains the dominant value, aligned optically rather than by negative-margin hacks. Preserve null and loading behavior. Tier wording and thresholds must remain exactly as documented. Do not suggest the score is an externally verified or predictive risk rating.

### Integrated metric rail

Render the four existing counts as a rail within the shared posture surface. Preserve exact metric names, source meanings, subtitles, and fallback values. Use tabular figures and aligned baselines; distinguish each metric through spacing, typography, and hairline separators instead of icon badges and separate cards. Small restrained line icons may be retained if already present, but are secondary and use bronze-muted tones, not filled circular widgets. Critical Alerts uses the established critical semantic color only as a restrained value/indicator cue; the metric label remains explicit.

### Threat telemetry

Retain the 24-hour `AreaChart` and `{time, threats}` series from `ThreatChart`. Keep existing volume summation/display and signal legend. Compose a sophisticated telemetry plot: fine neutral axes/ticks, sparse labels, thin bronze/ivory signal stroke, softly fading warm area under the curve, and restrained point/cursor emphasis. No blue, rainbow series, heavy grid, decorative invented series, fabricated samples, or added controls. Keep chart accessible with an adjacent/accessible summary of the displayed data where feasible, without changing the source data. Remove current positioning hacks when implementing by using a deliberate chart container and responsive dimensions.

Preserve states verbatim in meaning: loading “Loading telemetry…”, empty “No threat activity recorded for this period.”, error with `role="alert"` and “Threat activity is unavailable.” Do not draw a healthy flat line when data is empty or unavailable.

### Live threat activity

Retain latest 10 HIGH/CRITICAL records and all current fields/actions. Give the list a strong but quiet section heading, a compact “Live” indicator that does not imply a new feed state, and the existing “View all activity” navigation. Desktop column headings remain understandable, sans-serif, and may use sentence case; record values align into readable columns. Severity badges are compact, text-labeled, and semantically colored. IP/host and timestamp may use monospace; threat reason and headings use sans. Use row separators and subtle hover fill, not boxed rows or bright borders. Ensure inspect controls have an accessible name such as “Inspect event from {ip}”.

Preserve loading row meaning “Loading live security stream…”, empty message “No recorded events in this monitoring window.”, and error `role="alert"` with “Activity unavailable: {error}”. On compact layout, show the same information in stacked rows and retain the inspect deep link.

## 7. Accessibility and resilience

- Use a single page-level `h1`; section headings form a logical hierarchy.
- Maintain readable contrast over variable ambient canvas content; glass opacity must be sufficient to meet text contrast requirements.
- Do not communicate score tier, status, or severity through color alone.
- Preserve alert roles; loading indicators need text alternatives and must not announce every poll repeatedly to assistive technology.
- Give chart and icon-only controls accessible names. Hide decorative icons from assistive technology.
- Preserve visible keyboard focus, logical tab order, and usable touch targets.
- Avoid layout shifts when loading resolves or the aggregate error appears. Respect reduced motion and browser backdrop-filter support.

## 8. Implementation boundaries and acceptance checklist

The later implementation may revise Dashboard JSX and directly related Dashboard presentation styles/components only as needed to realize this specification. The work must not modify APIs, backend code, routes, Navbar, Sidebar, shell behavior, unrelated files, or polling behavior. Do not add dependencies solely for decoration.

An implementation conforms when all are true:

- The page reads as one connected SOC/security instrument with integrated metrics and grouped monitoring zones, not a row of generic cards.
- Glass is demonstrably translucent and backdrop-blurred with ambient light transmission and a readable fallback.
- Warm graphite, neutral text, and restrained bronze dominate; prohibited cool/neon hues are absent.
- Typography has a clear larger sans-led hierarchy; monospace is restricted to data values that benefit from it.
- Hover is refined and warm, with no stark white border/glow; keyboard focus remains obvious.
- Header includes a real local date/time display, independent of API polling.
- Existing APIs, data meanings, calculations, navigation, load/error/empty semantics, independent polling intervals, and interval cleanup remain intact.
- Responsive layouts preserve all data/actions without horizontal page overflow.
- Dashboard-only scope is respected.

## 9. Intentionally open for implementation

These are intentionally left for the implementation phase because they depend on the actual shell, available assets, and runtime measurements; the constraints above remain binding:

1. The final technical background asset or CSS-only ambient treatment, and its exact composition.
2. The precise CSS breakpoints/column measurements after inspecting the Sidebar and Navbar's real rendered width.
3. Browser-specific blur fallback tuning and final alpha adjustments after contrast testing against the selected canvas.
4. Whether existing icons are retained or simplified, provided they remain secondary and do not create metric-card affordances.
5. Fine chart tick density and tooltip placement at actual viewport sizes, without changing chart data or interaction semantics.

No backend/data/API, route, Sidebar, or polling decisions are open: those are fixed by the current-state document and preservation requirements.
