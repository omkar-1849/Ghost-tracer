# SENTINEL SIDEBAR — CURRENT-STATE AUDIT & TECHNICAL SPECIFICATION

**Audit Date:** October 1, 2026  
**Status:** Frozen Current-State Code Audit  
**Scope:** `frontend/src/components/Sidebar.jsx` and its associated components, styles, and integrations within the existing codebase.

---

## 1. FILES

The current sidebar implementation consists of 5 primary source files, 1 shell integration file, 1 core style sheet, and 1 brand asset:

- **Main Component & Shell Integration:**
  - `frontend/src/components/Sidebar.jsx` (Primary sidebar shell, state manager, layout wrapper)
  - `frontend/src/App.jsx` (Parent layout shell `AppLayout` instantiating `<Sidebar />`)
- **Sub-Components:**
  - `frontend/src/components/sidebar/NavComponents.jsx` (`NavLeaf` and `NavGroup` disclosure sub-components)
  - `frontend/src/components/sidebar/BranchConnector.jsx` (Deterministic SVG branch connector)
  - `frontend/src/components/sidebar/CollapsedFlyout.jsx` (React Portal flyout menu for collapsed rail state)
- **Style Sheets:**
  - `frontend/src/components/sidebar/sidebar.css` (Scoped `--sb-*` design tokens, glass surface rules, branch styles)
- **Shared UI & Auth Services:**
  - `frontend/src/components/ui/LiveDot.jsx` (Pulsating green status indicator in defense grid banner)
  - `frontend/src/services/authClient.js` (Provider for `getOrganization()`, `logout()`, `switchOrganization()`)
- **Icons & Brand Assets:**
  - Inlined Inline SVG `<BrandMark />` (Hexagonal shield brand mark inside `Sidebar.jsx`)
  - Icons imported from `lucide-react`: `LayoutDashboard`, `ShieldAlert`, `Radar`, `Settings`, `ChevronLeft`, `ChevronRight`, `ChevronDown`, `User`, `LogOut`, `Sliders`.

---

## 2. STRUCTURE

The sidebar is structured vertically as a floating flex container containing 4 distinct operational zones:

1. **Brand & Header Section (`.sb-header`):**
   - Inlined geometric SVG `<BrandMark size={28} />`.
   - Title: `"Sentinel"` with an `AI` badge (`.font-mono.text-[10px]`).
   - Tagline: `"SOC Intelligence"` (`.text-[9.5px].uppercase`).
   - Structural Collapse Toggle Button (`<button>` rendering `<ChevronLeft />` or `<ChevronRight />`).
2. **Top-Level Navigation Leaf:**
   - Single top-level item: `Dashboard` (`/`) rendered via `<NavLeaf />`.
3. **Hierarchical Grouped Tree Branches (`.sb-nav-scroll`):**
   - **Operations** (`ShieldAlert` icon):
     - `Threats` (`/alerts`)
     - `Incidents` (`/incidents`)
     - `Response` (`/response-actions`)
     - `Activity` (`/activity`)
   - **Security** (`Radar` icon):
     - `Assets` (`/websites`)
     - `Scanner` (`/scanner`)
   - **Management** (`Sliders` icon):
     - `Audit Logs` (`/audit-logs`)
     - `Settings` (`/settings`)
4. **Footer & User Profile Area (`.sb-footer`):**
   - **System Status Banner:** `"Defense Grid"` with an `ARMED` status pill rendering `<LiveDot color="var(--color-success)" size={5} />` (hidden when collapsed).
   - **User Account Card:** Account button displaying user avatar (`<User size={14} />`), organization name (`org?.name` or `"Sentinel SOC"`), and role (`org?.current_user_role` or `"Analyst"`).
   - **User Action Menu:** Popover rendering `"Settings & Profile"`, `"Switch organization"`, and `"Sign out"`.

---

## 3. DIMENSIONS

- **Sidebar Width (Expanded):** `240px` (`--sb-width-expanded`)
- **Sidebar Width (Collapsed):** `64px` (`--sb-width-collapsed`)
- **Floating Outer Inset:** `14px` (`--sb-floating-inset`) from top, bottom, and left viewport edges.
- **Outer Shell Border Radius:** `20px` (`--sb-radius-outer`)
- **Header Height:** `58px` (`--sb-header-h`)
- **Footer Height:** `56px` (`--sb-footer`)
- **Parent Row Height:** `36px` (`--sb-parent-h`)
- **Child Row Height:** `30px` (`--sb-child-h`)
- **Parent Row Corner Radius:** `8px`
- **Child Row Corner Radius:** `6px`
- **Gaps:**
  - Gap between child rows: `3px` (`--sb-child-gap`)
  - Margin below groups (`.sb-group-wrapper`): `10px`
  - Margin below Dashboard leaf: `16px` (`mb-4`)
- **Padding:**
  - Outer nav scroll area (`.sb-nav-scroll`): `12px` top/bottom, `9px` left/right (expanded); `10px` top/bottom, `8px` left/right (collapsed).
  - Parent row inner padding: `0 10px`
  - Child row left padding: `38px` (indentation), right padding: `10px`
- **Icons & Badges:**
  - Parent & Leaf Icon Size: `16px` (`strokeWidth={1.7}` or `2` when active)
  - Chevron Size: `13px`
  - Badge Height: `16px`, Min-Width: `17px`, Border Radius: `9999px`, Padding: `0 4px`, Font Size: `10px`.

---

## 4. POSITIONING & LAYOUT FLOW

- **Positioning:** Fixed positioning (`position: fixed`) wrapped inside a fixed wrapper `.sb-floating-wrapper`:
  ```css
  .sb-floating-wrapper {
    position: fixed;
    top: 14px;
    bottom: 14px;
    left: 14px;
    z-index: 40;
    display: flex;
    pointer-events: none;
  }
  ```
- **Viewport Edges:** Does **NOT** touch viewport edges on desktop. Floats with a uniform 14px margin on top, bottom, and left.
- **Main Content Interaction:**
  - In `src/App.jsx`, `AppLayout` renders `<Sidebar />` alongside `<div className="flex-1 flex flex-col min-w-0">`.
  - Inside `Sidebar.jsx`, an in-flow layout spacer element (`.sb-layout-spacer`) is rendered:
    ```css
    .sb-layout-spacer {
      display: none;
      flex-shrink: 0;
      width: calc(240px + 28px); /* 268px when expanded */
      transition: width 240ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .sb-layout-spacer.is-collapsed {
      width: calc(64px + 28px); /* 92px when collapsed */
    }
    @media (min-width: 768px) {
      .sb-layout-spacer { display: block; }
    }
    ```
  - This spacer pushes the main content rightwards so the fixed floating sidebar never overlaps dashboard tables or header elements.

---

## 5. VISUAL MATERIAL & GLASS SYSTEM

- **Sidebar Surface Material (`.sb-container`):**
  - **Background:** `rgba(10, 14, 22, 0.65)` (dark translucent graphite)
  - **Backdrop Filter:** `backdrop-filter: blur(16px) saturate(140%)`
  - **Border:** `1px solid rgba(255, 255, 255, 0.07)`
  - **Inner Highlight:** `inset 0 1px 0 0 rgba(255, 255, 255, 0.10)`
  - **Shadow:** `0 12px 36px -4px rgba(0, 0, 0, 0.60), 0 4px 12px -2px rgba(0, 0, 0, 0.40)`
- **Ambient Lighting Layer (`.sb-ambient-light`):**
  - Static background pseudo-elements (`::before` and `::after`):
    - Top-left warmth: `radial-gradient(circle at 35% 35%, rgba(196, 154, 108, 0.08) 0%, rgba(15, 23, 42, 0.03) 60%, transparent 80%)`
    - Bottom-left slate: `radial-gradient(circle at 40% 50%, rgba(30, 41, 59, 0.12) 0%, transparent 75%)`
- **Header Specular Line:** `linear-gradient(90deg, rgba(196, 154, 108, 0.25) 0%, rgba(255, 255, 255, 0.15) 35%, rgba(255, 255, 255, 0.02) 100%)`
- **Navigation Row Materials:**
  - Individual navigation rows are **NOT** standalone glass cards.
  - Idle parent rows use minimal background fill: `rgba(255, 255, 255, 0.02)` with hairline border `rgba(255, 255, 255, 0.04)`.
  - Child rows are transparent at rest with `border: 1px solid transparent`.
  - Active parent & child rows use an embedded tint: `background: rgba(196, 154, 108, 0.11)` and `border: 1px solid rgba(196, 154, 108, 0.28)`.

---

## 6. COLOR PALETTE & TOKENS

The active tokens in `sidebar.css` are mapped as follows:

| Target Element | Actual Token / CSS Value | Color Description |
|---|---|---|
| **Sidebar Surface** | `rgba(10, 14, 22, 0.65)` | Translucent dark graphite |
| **Sidebar Solid Fallback** | `#0b0f18` | Dark obsidian graphite |
| **Primary Accent** | `#c49a6c` | Muted bronze / amber |
| **Active Accent Bright** | `#d6b486` | Brightened muted bronze |
| **Active Row Fill** | `rgba(196, 154, 108, 0.11)` | 11% bronze tint |
| **Active Row Border** | `rgba(196, 154, 108, 0.28)` | 28% bronze outline |
| **Idle Parent Background** | `rgba(255, 255, 255, 0.02)` | 2% translucent white |
| **Hover Parent Background** | `rgba(255, 255, 255, 0.05)` | 5% translucent white |
| **Idle Child Background** | `transparent` | Transparent |
| **Hover Child Background** | `rgba(255, 255, 255, 0.035)` | 3.5% translucent white |
| **Idle Connector Line** | `rgba(148, 163, 184, 0.12)` | 12% muted slate hairline |
| **Hover Connector Line** | `rgba(148, 163, 184, 0.25)` | 25% muted slate hairline |
| **Active Connector Line** | `rgba(214, 180, 134, 0.85)` | 85% muted bronze |
| **Active Connector Glow** | `drop-shadow(0 0 1.5px rgba(196, 154, 108, 0.3))` | Micro 1.5px warm shadow |
| **Primary Text** | `#f8fafc` | Pure stark silver/white |
| **Secondary Text** | `#cbd5e1` | Slate silver |
| **Muted Text** | `#94a3b8` | Muted slate |
| **Subtle Text / Chevrons** | `#64748b` | Dark slate |
| **Badges (Critical)** | `bg-[var(--color-critical-subtle)]` / `text-[var(--color-critical)]` | Subtle crimson background, tactical red text |
| **Outer Borders** | `rgba(255, 255, 255, 0.07)` | Hairline white border |

---

## 7. BRANCH CONNECTOR SYSTEM

- **Implementation:** `BranchConnector.jsx` renders an inline SVG overlay absolute-positioned inside `.sb-children-inner`.
- **Trunk Line:**
  - `<line x1={18} y1={0} x2={18} y2={lastCenterY} className="sb-path-trunk" />`
  - $x = 18\text{px}$ aligns directly with the center of parent group icons ($10\text{px}$ row padding + $8\text{px}$ half of $16\text{px}$ icon).
- **Elbow Paths:**
  - Quadratic Bezier curves calculated dynamically per child:
    `M 18 curveStartY Q 18 centerY 25 centerY L 28 centerY`
  - Elbow radius: `7px` (`RADIUS = 7`).
- **Node Dots:**
  - Micro circular SVG dot rendered at the terminus of each elbow ($x = 28\text{px}$):
    `<circle cx={28} cy={centerY} r={1.5} className="sb-node-dot" />`
  - Radius: `1.5px`. Fills with `#d6b486` when active, `rgba(148, 163, 184, 0.18)` when idle.
- **Active Path Trace:**
  - Single `<path>` drawn from trunk top down to active child elbow ($x = 28\text{px}$):
    `M 18 0 L 18 curveStartY Q 18 activeCenterY 25 activeCenterY L 28 activeCenterY`
  - Styled with stroke `rgba(214, 180, 134, 0.85)`, width `1.2px`, and `filter: drop-shadow(0 0 1.5px rgba(196, 154, 108, 0.3))`.
- **Indentation Geometry:**
  - Child text rows (`.sb-row-child`) have `padding-left: 38px`.
  - With node dot at $x = 28\text{px}$, exactly $10\text{px}$ of clear space separates the node dot from child text.

---

## 8. INTERACTION & BEHAVIOR

- **Group Expansion / Collapse:**
  - Clicking a parent row toggles disclosure state.
  - Accordion animation driven by CSS Grid: `grid-template-rows: 0fr` $\leftrightarrow$ `1fr` with `200ms ease-out` transition.
- **Active Route Behavior:**
  - Active route determined via `useLocation().pathname`.
  - Prefix matching automatically marks group active if current path starts with child route (`c.to !== "/" && currentPath.startsWith(c.to)`).
  - Navigating to a child route auto-expands its parent group.
  - Active item renders left indicator pill (`.sb-section-indicator`), active border tint, and active branch path.
- **Hover Behavior:**
  - Parent row: background darkens to `rgba(255, 255, 255, 0.05)`, text brightens.
  - Child row: background darkens to `rgba(255, 255, 255, 0.035)`, text brightens.
  - Branch elbow: stroke brightens to `rgba(148, 163, 184, 0.25)`.
- **Collapsed Sidebar & Flyouts:**
  - Toggling collapse collapses container width from `240px` to `64px`.
  - Labels, chevrons, status banner, and text are hidden (`display: none` or conditional render).
  - Hovering a collapsed group icon triggers `<CollapsedFlyout />` after a `120ms` intent delay with a `150ms` close grace timer.
  - Flyout rendered via `createPortal` attached to `document.body` at fixed coordinates relative to trigger button (`getBoundingClientRect()`).
- **Mobile Drawer Behavior:**
  - Controlled by `mobileOpen` prop.
  - Renders a backdrop overlay (`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm`).
  - Sidebar floats at `fixed inset-y-3 left-3 z-50`.
  - Clicking backdrop calls `onMobileClose`.
- **State Persistence:**
  - Saved in `localStorage` under `sentinel_sb_open_groups` (JSON object) and `sentinel_sb_collapsed` (`"true"` / `"false"`). Client-side try/catch guarded.

---

## 9. ANIMATIONS

| Motion / Transition | Target Selector | Duration | Easing Curve | Property Animated |
|---|---|---|---|---|
| **Sidebar Width Collapse** | `.sb-container` | 240ms | `cubic-bezier(0.16, 1, 0.3, 1)` | `width` |
| **Layout Spacer Adjust** | `.sb-layout-spacer` | 240ms | `cubic-bezier(0.16, 1, 0.3, 1)` | `width` |
| **Group Accordion Height**| `.sb-children-grid` | 200ms | `ease-out` | `grid-template-rows`, `opacity` |
| **Chevron Rotation** | `ChevronDown` | 180ms | `ease` | `transform (rotate)` |
| **Parent Row Hover** | `.sb-row-parent` | 130ms | `ease` | `background-color`, `border-color`, `color` |
| **Child Row Hover** | `.sb-row-child` | 120ms | `ease` | `background-color`, `color`, `border-color` |
| **Section Indicator Slide**| `.sb-section-indicator`| 200ms | `cubic-bezier(0.16, 1, 0.3, 1)` | `transform`, `opacity` |
| **Flyout Entrance** | `.sb-flyout` (`sbFadeIn`) | 110ms | `ease-out` | `opacity`, `transform (translateX)` |
| **Live Dot Status Pulse** | `LiveDot.jsx` | 2.4s | `ease-in-out` (infinite) | `opacity` |

---

## 10. RESPONSIVE DESIGN MATRIX

- **Desktop (`≥ 768px`):**
  - In-flow layout spacer `.sb-layout-spacer` active, pushing content right by `268px` (expanded) or `92px` (collapsed).
  - Floating sidebar fixed at `top: 14px`, `bottom: 14px`, `left: 14px`.
- **Mobile / Narrow (`< 768px`):**
  - Layout spacer hidden (`display: none`).
  - Sidebar hidden off-canvas unless `mobileOpen` is `true`.
  - When `mobileOpen` is `true`, opens as a floating drawer with dark backdrop (`bg-black/60 backdrop-blur-sm`).

---

## 11. ACCESSIBILITY

- **Landmark:** Wrapped in `<aside aria-label="Primary">` containing `<nav aria-label="Navigation Tree">`.
- **Disclosure Pattern:** Parent toggle buttons carry `aria-expanded={isOpen}` and `aria-controls={`sb-group-${group.id}`}`.
- **Current Route:** Active links carry `aria-current="page"`.
- **SVGs:** Branch connector SVG carries `aria-hidden="true"`.
- **Focus Rings:** Explicit visible focus ring applied to interactive elements:
  ```css
  .sb-focusable:focus-visible {
    outline: 2px solid #c49a6c;
    outline-offset: 1px;
  }
  ```
- **Keyboard Handling:** Standard focus sequence with tab order; <kbd>Esc</kbd> key closes `CollapsedFlyout` and restores focus to trigger button (`triggerRef.current?.focus()`).
- **Reduced Motion & Transparency:**
  - `@media (prefers-reduced-motion: reduce)` disables all CSS transitions and keyframes.
  - `@supports not (backdrop-filter: blur(14px))` and `@media (prefers-reduced-transparency: reduce)` fall back to solid dark graphite background `#0b0f18` with no blur.

---

## 12. DEPENDENCIES

- **React Core:** `react` (`useState`, `useRef`, `useEffect`, `useCallback`, `useMemo`, `createPortal`)
- **Routing:** `react-router-dom` (`NavLink`, `useLocation`, `useNavigate`)
- **Icon Set:** `lucide-react`
- **Auth Client:** `src/services/authClient.js`

---

## 13. ROUTE, RBAC & DATA BINDING

- **Routes:** Bound strictly to audited router paths defined in `App.jsx`:
  - Top leaf: `/`
  - Operations group: `/alerts`, `/incidents`, `/response-actions`, `/activity`
  - Security group: `/websites`, `/scanner`
  - Management group: `/audit-logs`, `/settings`
- **Active Route Detection:** Evaluated dynamically per render using `useLocation().pathname`.
- **RBAC & User Context:** Derived from `getOrganization()` in `authClient.js` (`org?.name`, `org?.current_user_role`). Account switching calls `switchOrganization()`.
- **Badges / Counts:** Badge count rendered dynamically if `child.badgeCount > 0`. Aggregate counts calculated on parent group buttons when collapsed.

---

## 14. CURRENT DEVIATIONS FROM ORIGINAL SPECIFICATION

Comparing the current codebase implementation against the initial specification document (`SENTINEL_SIDEBAR_SPECIFICATION.md`):

1. **Dimensions:**
   - Expanded width is **240px** (Spec originally requested 280px, then 264px).
   - Collapsed width is **64px** (Spec requested 72px).
   - Sidebar floats with a **14px** viewport inset on top/bottom/left and a **20px** outer radius (Spec originally called for full height docked edge).
2. **Color Palette:**
   - Primary accent is **Muted Bronze / Amber (`#C49A6C` / `#D6B486`)** instead of cyan (`#00F0FF` / `#38BDF8`).
3. **Branch Geometry:**
   - SVG Branch node dots are positioned at $x = 28\text{px}$ with $r = 1.5\text{px}$ (Spec requested $x = 35\text{px}$ with $r = 2\text{px}$).
   - Child indentation is `padding-left: 38px` (Spec requested `42px` / `48px`).
4. **Nav Taxonomy:**
   - Unimplemented aspirational routes (`Live Logs`, `Events`, `Integrations`, `Threat Intelligence`, `Users`) are omitted per §2 and §20 strict route preservation rules.

---

## 15. CONCISE CURRENT-STATE TECHNICAL SPECIFICATION

```typescript
// Current State TypeScript Definitions & Token Schema

export interface SidebarNavChild {
  to: string;
  label: string;
  badgeCount?: number;
}

export interface SidebarNavGroup {
  id: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  children: SidebarNavChild[];
}

export interface SidebarNavTree {
  leafTop: {
    to: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
    end: boolean;
  };
  groups: SidebarNavGroup[];
}

// Current CSS Variable Design Tokens
export const SENTINEL_SIDEBAR_TOKENS = {
  widthExpanded: "240px",
  widthCollapsed: "64px",
  floatingInset: "14px",
  radiusOuter: "20px",
  surfaceGlass: "rgba(10, 14, 22, 0.65)",
  surfaceSolidFallback: "#0b0f18",
  backdropBlur: "blur(16px) saturate(140%)",
  accentPrimary: "#c49a6c",
  accentBright: "#d6b486",
  accentFill: "rgba(196, 154, 108, 0.11)",
  accentBorder: "rgba(196, 154, 108, 0.28)",
  textPrimary: "#f8fafc",
  textSecondary: "#cbd5e1",
  textMuted: "#94a3b8",
  connectorIdle: "rgba(148, 163, 184, 0.12)",
  connectorActive: "rgba(214, 180, 134, 0.85)",
  branchTrunkX: 18,
  branchNodeX: 28,
  childIndentPadding: "38px",
} as const;
```
