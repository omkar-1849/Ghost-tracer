/* ============================================================
   StatCard — KPI metric card
   Clean, matte, information-first. No glow, no tilt, no sheen.
   ============================================================ */

const semanticMap = {
  log: { accent: "var(--color-accent)", label: "accent" },
  alert: { accent: "var(--color-warning)", label: "warning" },
  critical: { accent: "var(--color-critical)", label: "critical" },
  high: { accent: "var(--color-high)", label: "high" },
};

function resolveAccent(title) {
  const normalized = (title || "").toLowerCase();
  for (const [key, value] of Object.entries(semanticMap)) {
    if (normalized.includes(key)) return value;
  }
  return { accent: "var(--color-accent)", label: "accent" };
}

function StatCard({ title, value, icon: Icon }) {
  const semantic = resolveAccent(title);

  return (
    <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-4 shadow-[var(--shadow-1)] hover:border-[var(--color-border-strong)] transition-colors duration-150">
      <div className="flex items-center justify-between">
        <div
          className="w-9 h-9 rounded-md flex items-center justify-center"
          style={{ backgroundColor: `color-mix(in srgb, ${semantic.accent} 12%, transparent)` }}
        >
          <Icon size={18} style={{ color: semantic.accent }} />
        </div>
      </div>

      <p className="text-xs font-medium text-[var(--color-text-muted)] mt-3">
        {title}
      </p>

      <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-0.5 tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}

export default StatCard;
