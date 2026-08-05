# Phase 5 — Enterprise SOC Polish

## Scope

Elevate the Alerts page from "excellent portfolio" to "indistinguishable from shipped commercial SOC software" — without redesigning anything. Every change is a precision refinement of the existing production baseline.

---

## Changes by File

### 1. `frontend/src/pages/Alerts.jsx` — Data Realism + Status Labels

**1a. Vary incident titles (HIGH — single highest-ROI change)**

`mapIncident` (line 66) currently falls back to `"Security Incident"` when `incident.title` is missing/generic. Replace with a deterministic title derived from the attack family:

```js
// line 66 — replace title generation
const title = incident.title && incident.title !== "Security Incident"
    ? incident.title
    : `${family.name} from ${incident.source_ip || "unknown"}`;
```

Also fix description (line 67-68) to use family-aware text:
```js
const description = incident.description && incident.description !== "Security incident detected — review immediately."
    ? incident.description
    : `${family.name} traffic observed from ${incident.source_ip || "unknown"} targeting ${incident.target || "unknown endpoint"}`;
```

**1b. Time-based SOC status labels (HIGH)**

Replace the static `STATUS_LABELS` mapping with time-aware status computation. After computing `timestamp`, derive age-based status for OPEN incidents:

```js
const ageMs = Date.now() - createdMs;
const ageHrs = ageMs / 3_600_000;

let status;
if (resolved) {
    status = "RESOLVED";
} else if (statusRaw === "INVESTIGATING") {
    status = "INVESTIGATING";
} else if (ageHrs < 1) {
    status = "NEW";
} else if (ageHrs < 24) {
    status = "ACTIVE";
} else {
    status = "STALE";
}
```

This replaces echoing the severity theme's status with genuinely useful information.

---

### 2. `frontend/src/components/alerts/InvestigationWorkspace.jsx` — Notes Section + Spacing

**2a. Add "05 Investigation Notes" section (HIGH)**

Insert a new section between Evidence (03) and Response Actions (04→05). Uses existing `incident.notes` array and `onAddNote` prop (already destructured but unused).

- Re-number Response Actions from "04" to "05"
- Notes section uses the same bordered wrapper pattern as Timeline: `mt-4 rounded-2xl border border-white/[0.06] bg-slate-950/20 px-5 py-4`
- Renders existing notes as a list (analyst name, note text, timestamp)
- Includes a compact inline form (textarea + "Add Note" button) at the bottom
- Notes form uses the existing frost button style

**2b. Normalize Response Actions padding (MEDIUM)**

Line 192: `px-4 py-4` → `px-5 py-4` (match Timeline's `px-5`)

**2c. Tighten section spacing (MEDIUM)**

Line 145: `space-y-6 lg:space-y-8` → `space-y-5 lg:space-y-6`

**2d. Import MessageSquare for notes icon**

Add `MessageSquare` from lucide-react to the imports.

---

### 3. `frontend/src/components/alerts/IncidentRow.jsx` — Queue Readability + Typography

**3a. Two-line description clamp (HIGH)**

Line 112: `truncate` → `line-clamp-2` on the description span. Also add `break-words` to prevent mid-word truncation.

**3b. Severity badge text size (MEDIUM)**

Line 97: `text-[10px]` → `text-[11px]` (both severity chip and status chip at line 128)

**3c. Append port to IP (MEDIUM)**

Lines 119-121: Show `{incident.source}:{incident.sourcePort}` instead of bare `{incident.source}`.

**3d. Preserve severity chip color on resolved (VERIFIED ALREADY CORRECT)**

The severity chip already uses `theme.chip` (the original severity theme), not the resolved theme. No change needed — this was addressed in the mapIncident refactor from Phase 3.

---

### 4. `frontend/src/components/alerts/SummaryStrip.jsx` — Typography + Interaction

**4a. Label contrast for WCAG AA (MEDIUM)**

Line 87: `text-slate-500` → `text-slate-400` (bumps contrast from ~3.8:1 to ~5.6:1)

**4b. Label text size (MEDIUM)**

Line 87: `text-[10px]` → `text-[11px]`

---

### 5. `frontend/src/components/alerts/AlertsHero.jsx` — Hero Compression

**5a. Reduce vertical padding (MEDIUM)**

Line 62: `py-8 sm:py-9` → `py-6 sm:py-7` (saves ~16px total vertical space)

**5b. Reduce title cluster margin (MEDIUM)**

Line ~168: `mt-7` → `mt-5` (saves ~8px)

**5c. Fade brand label (LOW)**

Line 348: `text-slate-600` → `text-slate-700` (reduces visual noise)

---

### 6. `frontend/src/components/alerts/AlertsPage.css` — Motion + Consistency

**6a. Remove summary hover lift (MEDIUM)**

Lines 703-705: Remove `transform: translateY(-3px);` from `.alerts-summary:hover`. Keep border-color and box-shadow changes — those are sufficient hover feedback for a non-interactive informational element.

Also remove `transform` from the transition declaration (line 698).

**6b. Fix hero hairline border-radius (LOW)**

Line 145: `border-radius: 31px` → `border-radius: 23px` (parent's 24px rounded-3xl minus 1px inset = correct design token)

**6c. Reduce ambient scan opacity (LOW)**

Lines 87-88: `opacity: 0.5` → `opacity: 0.25` (reduces distraction during sustained use)

---

## Files Modified (7 total)

| File | Changes |
|------|---------|
| `frontend/src/pages/Alerts.jsx` | Title generation, description, time-based status |
| `frontend/src/components/alerts/InvestigationWorkspace.jsx` | Notes section, padding normalize, spacing tighten, icon import |
| `frontend/src/components/alerts/IncidentRow.jsx` | line-clamp-2, badge text size, IP:port |
| `frontend/src/components/alerts/SummaryStrip.jsx` | Label contrast, label text size |
| `frontend/src/components/alerts/AlertsHero.jsx` | Hero padding, title margin, brand label |
| `frontend/src/components/alerts/AlertsPage.css` | Summary lift removal, hero radius, ambient opacity |

## What is NOT Changed

- Layout proportions (35/65 grid) ✅
- Glassmorphism panels ✅
- Animation system (except removing summary lift + reducing ambient opacity) ✅
- Color palette ✅
- Navigation ✅
- Workspace architecture ✅
- Timeline ✅
- Hover effects on rows/panels/buttons ✅
- Severity accent bar ✅
- Conic border on hero ✅
- Cursor spotlight ✅
- Glass sheen sweep ✅
- Selection halo ✅
- prefers-reduced-motion ✅
- Keyboard shortcuts ✅
- Collapse rail ✅

## Verification

1. `npm run build` — clean
2. Headless screenshot at 1280×900 — verify titles vary, notes section visible, hero slightly compressed, summary tiles don't lift on hover
3. Headless screenshot at 1920×1080 — verify spacing tightening, section padding consistency
4. `git diff --stat` — confirm minimal, focused changes
