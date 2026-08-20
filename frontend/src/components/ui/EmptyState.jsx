/* ============================================================
   EmptyState — Professional empty data placeholder
   ============================================================ */

export default function EmptyState({
  icon: Icon,
  title = "No data",
  description,
  action,
  className = "",
}) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center gap-3 py-12 px-6
        rounded-lg border border-dashed border-[var(--color-border-default)]
        bg-[var(--color-surface-1)]
        ${className}
      `.trim()}
    >
      {Icon && (
        <span className="w-10 h-10 rounded-lg bg-[var(--color-surface-3)] border border-[var(--color-border-default)] flex items-center justify-center">
          <Icon size={20} className="text-[var(--color-text-muted)]" />
        </span>
      )}
      <p className="text-sm font-medium text-[var(--color-text-secondary)]">
        {title}
      </p>
      {description && (
        <p className="text-xs text-[var(--color-text-muted)] text-center max-w-xs">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
