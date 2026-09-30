# Sentinel AI Sidebar Architecture & Implementation Specification

This document provides a comprehensive UI/UX analysis and technical implementation plan for recreating the **Sentinel AI Sidebar**, synthesizing two core visual and structural paradigms:
1. **React Bits "Branched Menu"**: Tree-structured hierarchy, dynamic SVG branch connectors, animated collapsibility, and nested route handling.
2. **React Bits "Fluid Glass"**: Premium glassmorphism with refraction distortion, backdrop blurring, rim highlights, specular reflections, and ambient glows.

---

## 1. Sidebar Structure

### Overall Dimensions & Positioning
* **Width**: Fixed `280px` in expanded desktop mode, `72px` in collapsed icon-only mode.
* **Height**: `100vh` (full viewport height) or fixed height within a viewport shell.
* **Positioning**: Fixed or sticky `left: 0`, `top: 0`, layered above background grid canvas using `z-index: 40`.
* **Margins/Floating Option**: Floating container with `16px` inset margin from top/bottom/left edges, using `height: calc(100vh - 32px)` and rounded container corners (`border-radius: 20px`).

### Navigation Hierarchy & Grouping
The sidebar is partitioned vertically into four main sections:
1. **Brand & Console Header**:
   - Sentinel AI Hex/Shield Logo with pulsating threat status badge (`STATUS: ACTIVE / NORMAL`).
   - Workspace/Tenant Selector dropdown.
2. **Primary Navigation (Core SOC Operations)**:
   - High-frequency daily monitoring items (Dashboard, Real-Time Activity, Threat Center).
3. **Secondary Navigation (Incident & Asset Management - Branched)**:
   - Nested hierarchical branches containing sub-items (Incidents, Response Automation, Asset Inventory, Threat Scanner).
4. **System & Footer Area**:
   - Audit Logs & Security System Settings.
   - SOC Operator Profile & Quick Action Menu (Lock Session, Shift Status).

### Navigation States & Collapsibility
* **Expanded Mode**: Full text labels, category headers, visible SVG branch lines, collapse trigger toggle button (`<ChevronLeft />`).
* **Collapsed Mode**: Collapses smoothly to `72px` width. Hides text labels and branch line SVGs. Parent menu items become hover-triggerable floating popovers (tooltips/flyout menus).
* **Active Item**: Indicated by a high-intensity cyan/blue glass highlight (`#00F0FF` fill at 15% opacity), active border glow, bold typography, and direct line connection highlighting.

---

## 2. Branched Menu Behavior

### Visual Line Connectors & Indentation
* **Branch Geometry**: SVG-based smooth Bezier paths (`M x1 y1 C x1 y2, x2 y1, x2 y2`) connecting child nodes back to parent trunks.
* **Line Styling**: `1.5px` stroke width, `#38BDF8` color at `25%` opacity for inactive branches, transitioning to `80%` opacity with a subtle drop-shadow glow (`drop-shadow(0 0 4px #00F0FF)`) when child node is active.
* **Indentation Level**: `24px` horizontal indent per nesting level. Sub-branch items sit at `padding-left: 48px`.

### Parent/Child Interaction & Animations
* **Accordion Toggle**: Clicking a parent node toggles its expanded state.
* **Smooth Height Expansion**: Expanded children container animates from `grid-template-rows: 0fr` to `1fr` using CSS Grid transitions or Framer Motion `animate={{ height: 'auto', opacity: 1 }}`.
* **Hover Interaction**: Hovering over a branch node highlights the connecting SVG path back to the root node, giving a visual data-tree traversal feel.
* **Icon & Text Alignment**: Icons aligned left at `18px x 18px`. Labels left-aligned with `12px` spacing from icon. Dynamic badge counters (e.g., `Critical: 3`) float right.

---

## 3. Fluid Glass Visual System

The glass system goes beyond flat `backdrop-filter: blur(10px)`. It simulates multi-layered physical glass refractivity and ambient lighting.

```
+-------------------------------------------------------------------+
|  [ Outer Specular Border: 1px linear-gradient(rgba(255,255,255,0.2), transparent) ] |
|  [ Glass Surface Layer: rgba(10, 15, 30, 0.55) ]                   |
|  [ Blur Layer: backdrop-filter: blur(16px) saturate(180%) ]       |
|  [ Refraction Noise: SVG feTurbulence / Chromatic Aberration ]     |
|  [ Internal Reflection Glow: inset 0 1px 0 rgba(255,255,255,0.15) ]|
+-------------------------------------------------------------------+
```

### Optical Specifications
* **Transparency & Opacity**: Base background `rgba(6, 11, 25, 0.65)` layered over deep dark grid background `#030712`.
* **Backdrop Filter**: `backdrop-filter: blur(20px) saturate(190%) contrast(105%)`.
* **Refraction & Distortion**: SVG filter `<filter id="glass-refraction">` applying `feTurbulence` (baseFrequency 0.02) and `feDisplacementMap` (scale 4) to subtly curve content underneath edges.
* **Borders & Edge Highlights**:
  - `border: 1px solid rgba(56, 189, 248, 0.12)`
  - Top & Left highlight via pseudo-element: `linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(0,240,255,0.1) 40%, transparent 100%)`.
* **Glow & Ambient Shadow**:
  - Box Shadow: `0 20px 50px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)`.
  - Active Glow: `0 0 20px rgba(0, 240, 255, 0.25), inset 0 0 12px rgba(0, 240, 255, 0.15)`.
* **Hover State Treatment**: Surface shifts from `rgba(15, 23, 42, 0.5)` to `rgba(30, 41, 59, 0.7)`, border opacity increases to `0.3`, with an animated radial mouse-following highlight (`radial-gradient(circle at var(--mouse-x) var(--mouse-y), rgba(0,240,255,0.15), transparent 80px)`).

---

## 4. Dimensional Geometry Reference

| Metric | Target Dimension | CSS / Value |
| :--- | :--- | :--- |
| **Sidebar Width (Expanded)** | 280px | `w-[280px]` |
| **Sidebar Width (Collapsed)** | 72px | `w-[72px]` |
| **Nav Item Height** | 40px | `h-10` |
| **Container Padding** | Top/Bottom 20px, Left/Right 16px | `px-4 py-5` |
| **Branch Indentation** | Level 1: 16px, Level 2: 36px | `pl-4`, `pl-9` |
| **Corner Radius** | Container: 20px, Nav Item: 10px | `rounded-2xl`, `rounded-lg` |
| **Icon Size** | 18px × 18px | `w-[18px] h-[18px]` |
| **Typography Size** | Labels: 13px / 0.8125rem | `text-[13px] font-medium` |
| **Section Gap** | Vertical space between groups: 20px | `space-y-5` |
| **Branch Line Width** | 1.5px | `stroke-[1.5]` |

---

## 5. Color Palette & Token Mapping

| Token Name | Hex / RGBA Value | Usage |
| :--- | :--- | :--- |
| `--bg-base` | `#030712` (Slate 950) | Main application background |
| `--glass-bg` | `rgba(8, 15, 30, 0.65)` | Sidebar base surface |
| `--glass-border` | `rgba(56, 189, 248, 0.15)` | Subtle cyan border |
| `--text-primary` | `#F8FAFC` (Slate 50) | Active & primary labels |
| `--text-muted` | `#94A3B8` (Slate 400) | Secondary / inactive labels |
| `--accent-cyan` | `#00F0FF` | Primary active accent & glows |
| `--accent-blue` | `#3B82F6` | Secondary interactive elements |
| `--branch-line` | `rgba(56, 189, 248, 0.25)` | Tree connector SVGs |
| `--branch-active` | `#00F0FF` | Active route connector line |
| `--status-critical` | `#EF4444` | High severity alert badges |
| `--status-warning` | `#F59E0B` | Medium warning badges |
| `--status-normal` | `#10B981` | System nominal indicator |

---

## 6. Motion & Animation Specification

1. **Sidebar Entrance**:
   - Initial load: Fade in with horizontal slide (`transform: translateX(-20px)` to `translateX(0)`), opacity `0` to `1`, `duration: 400ms`, `easing: cubic-bezier(0.16, 1, 0.3, 1)`.
2. **Branch Expansion**:
   - Sub-menu height collapse/expand using spring physics or CSS ease-out (`duration: 250ms`).
   - SVG Branch path `stroke-dashoffset` animation drawing lines downward as branch opens.
3. **Hover Effects**:
   - Micro-scale transform `translateX(3px)` on nav item labels.
   - Glass gloss sheen scan across nav item background (`transition: background 200ms ease`).
4. **Active Item State Shift**:
   - Smooth layout projection for active selection indicator pill (`layoutId="activeIndicator"` in Framer Motion).
5. **Glow Pulse**:
   - Subtle infinite pulse on critical incident badges: `keyframes { 0%, 100%: opacity 0.6; 50%: opacity 1.0; }`.

---

## 7. Responsive & Adaptive Behavior

* **Desktop (`≥ 1280px`)**: Full sidebar permanently visible (`280px`). Expanded state defaults to open.
* **Laptop (`1024px - 1279px`)**: Sidebar supports auto-collapsing to `72px` mini mode, expanding on button click or hover overlay.
* **Tablet (`768px - 1023px`)**: Auto-collapsed (`72px`). Sub-menus open in floating glass tooltips / flyout menus on click/hover.
* **Mobile (`< 768px`)**: Hidden off-screen (`translateX(-100%)`). Toggled via hamburger header button into a full modal slide-over glass drawer with backdrop blur tint (`rgba(0,0,0,0.8)`).

---

## 8. Frontend Architecture & React Component Tree

### Component Breakdown

```
<SentinelSidebarContainer>
  ├── <GlassBackgroundCanvas />      /* Blur, gradient & refraction filters */
  ├── <SidebarHeader>
  │     ├── <BrandLogo />
  │     └── <TenantSelector />
  ├── <NavigationScrollArea>
  │     ├── <NavGroup title="CORE OPERATIONS">
  │     │     ├── <NavItem route="/dashboard" icon={LayoutDashboard} />
  │     │     └── <NavItem route="/activity" icon={Activity} />
  │     ├── <NavBranchGroup title="THREAT CENTER" defaultOpen={true}>
  │     │     ├── <NavBranchParent label="Threats" icon={ShieldAlert} />
  │     │     ├── <SVGBranchConnector />
  │     │     └── <NavBranchChildren>
  │     │           ├── <NavItem route="/threats/live" label="Live Feed" />
  │     │           ├── <NavItem route="/threats/intel" label="Intelligence" />
  │     │           └── <NavItem route="/threats/rules" label="Detection Rules" />
  │     └── <NavBranchGroup title="INCIDENT & RESPONSE">
  │           ├── <NavBranchParent label="Incidents" icon={AlertTriangle} badge="3" />
  │           └── ...
  └── <SidebarFooter>
        ├── <SOCStatusIndicator status="ACTIVE_DEFENSE" />
        └── <UserProfileCard user="Op_Alpha" role="Tier 3 Analyst" />
</SentinelSidebarContainer>
```

### Key CSS Techniques for Fluid Glass
- `backdrop-filter: blur(20px) saturate(180%)`.
- Double-border technique using `box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1)`.
- Custom CSS variables `--mouse-x` and `--mouse-y` updated via `onMouseMove` handler on sidebar container to drive real-time glass specular reflections.
- `mask-image` for fading top/bottom scroll gradient masks.

---

## 9. Sentinel SOC Adaptation & Navigation Taxonomy

Organizing the requested Sentinel SOC navigation concepts into logical branches:

1. **Dashboard** (Single Top-level Item)
   - SOC Overview & Command Center
2. **Activity** (Single Top-level Item)
   - Real-time Telemetry & Stream Log Monitor
3. **Threat Center** (Branched Group)
   - **Threats** (Parent)
     - Live Threat Feed
     - Threat Intelligence (IoCs)
     - Malware Sandbox
4. **Incident Operations** (Branched Group)
   - **Incidents** (Parent - High Priority)
     - Active Cases (Badge: 4)
     - Triage Queue
     - Historical Archive
   - **Response** (Parent)
     - SOAR Playbooks
     - Automated Containment
     - Quarantine Assets
5. **Infrastructure & Assets** (Branched Group)
   - **Assets** (Parent)
     - Endpoint Agents (EDR)
     - Cloud Workloads
     - Network Gateways
   - **Scanner** (Parent)
     - Vulnerability Scans
     - Configuration Audit
6. **Governance & System** (Footer / Secondary)
   - **Audit Logs**
   - **Settings**

---

## 10. Concise Developer Implementation Specification

```typescript
// Key TypeScript Interface Definition for Sentinel Sidebar Navigation Items

export interface NavChildItem {
  id: string;
  label: string;
  path: string;
  badge?: { text: string; variant: 'critical' | 'warning' | 'info' };
}

export interface NavParentItem {
  id: string;
  label: string;
  icon: string; // Lucide icon identifier
  path?: string;
  children?: NavChildItem[];
  badge?: { text: string; variant: 'critical' | 'warning' | 'info' };
}

export interface NavSection {
  id: string;
  sectionTitle: string;
  items: NavParentItem[];
}
```

### CSS Utility Classes & Styles Specification
```css
/* Glass Surface Base */
.fluid-glass-sidebar {
  background: rgba(8, 15, 30, 0.65);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-right: 1px solid rgba(56, 189, 248, 0.15);
  box-shadow: 
    10px 0 30px -10px rgba(0, 0, 0, 0.5),
    inset 1px 0 0 0 rgba(255, 255, 255, 0.1);
}

/* Glass Active Item Styling */
.nav-item-active {
  background: rgba(0, 240, 255, 0.12);
  border: 1px solid rgba(0, 240, 255, 0.3);
  box-shadow: 
    0 0 15px rgba(0, 240, 255, 0.2),
    inset 0 0 10px rgba(0, 240, 255, 0.1);
  color: #FFFFFF;
}

/* SVG Branch Line Connector */
.branch-line-path {
  fill: none;
  stroke: rgba(56, 189, 248, 0.25);
  stroke-width: 1.5;
  stroke-linecap: round;
  transition: stroke 0.3s ease, stroke-width 0.3s ease;
}

.branch-line-path.active {
  stroke: #00F0FF;
  stroke-width: 2;
  filter: drop-shadow(0 0 4px #00F0FF);
}
```

---
*Artifact generated for Sentinel AI Sidebar UI/UX Architecture Plan.*
