## P0 — Design-System Foundation (implementation)

**Rewrite one file only: `frontend/src/index.css`** — the single source of truth for the new design system. Non-breaking and additive; no components, pages, services, routes, or packages are touched.

### Changes to `index.css`

1. **`@import "tailwindcss";`** (unchanged).

2. **`@theme` design tokens** (Tailwind v4 generates utilities from these):
   - Surfaces: `--color-canvas #0a0b0d`, `--color-surface-1 #101214`, `--color-surface-2 #15181c`, `--color-surface-3 #1a1e23`, `--color-overlay rgba(5,6,8,0.62)`.
   - Borders: `--color-border-subtle #1d2126`, `--color-border-default #262c33`, `--color-border-strong #39414c`.
   - Text: `--color-text-primary #f2f4f6`, `--color-text-secondary #b8c0ca`, `--color-text-muted #7b8591`, `--color-text-disabled #4c545e`.
   - Accent: `--color-accent #3d7af0`, `--color-accent-hover #5b90f5`, `--color-accent-active #2f63c4`, `--color-accent-subtle rgba(61,122,240,0.10)`.
   - Semantic: `--color-critical #e5484d`, `--color-high #ed7d1c`, `--color-medium #ddb32a`, `--color-low #4a9de0`, `--color-info #6b7683`, `--color-success #3fa34d`, `--color-warning #d9a11a`.
   - Typography: `--font-sans` (`-apple-system, "Segoe UI", system-ui, sans-serif`), `--font-mono` (`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`).
   - Shadows: `--shadow-1/2/3` (subtle neutral 3-level, no glow).
   - Animations: restrained `--animate-*` set (below).

3. **Base layer**:
   - `html/body/#root` → `bg-canvas text-text-primary font-sans antialiased`.
   - Unified `:focus-visible` → `2px solid accent` (resolves existing emerald-vs-cyan/violet conflict).
   - One consolidated scrollbar block (removes the current duplicated definitions).
   - Global `prefers-reduced-motion` handling.

4. **Animation system** — retuned, non-breaking:
   - Keep (reduced translate/opacity deltas) utilities components currently use: `fade-in`, `fade-in-up`, `fade-in-down`, `scale-in`, `pop-in`, `backdrop-in`, `drawer-in`, `shimmer`, `toast-in`, `shake`.
   - Add `modal-in`, `spin`, `pulse-soft`.
   - Remove ambience tokens `float-slow`, `glow-pulse`, `scan`, `pulse-dot` — only after `grep` confirms zero usage.
   - Preserve `toast-progress` keyframe (still referenced by `Toast.jsx`).

### Preserved
- All existing components keep working: default Tailwind palette (`slate-*`, `cyan-*`, etc.) stays available; every `animate-*` utility actually referenced stays defined.
- No behavior, routes, API, or backend touched.

### Validation
- `grep` removed animation utilities across `src/` before deleting.
- `npm run build` must succeed; `npm run lint` if available.

### P0 deliverable list
- Files changed: `frontend/src/index.css`
- What changed: single-source design tokens + base styles + focus system + restrained animation system.
- Next phase after validation: P1 (shared primitives).