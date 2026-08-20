/* ============================================================
   Card — Surface container primitive
   Variants: base | elevated | interactive
   ============================================================ */

const variants = {
  base: "bg-[var(--color-surface-2)] border border-[var(--color-border-default)] shadow-[var(--shadow-1)]",
  elevated:
    "bg-[var(--color-surface-3)] border border-[var(--color-border-default)] shadow-[var(--shadow-2)]",
  interactive:
    "bg-[var(--color-surface-2)] border border-[var(--color-border-default)] shadow-[var(--shadow-1)] hover:border-[var(--color-border-strong)] hover:-translate-y-px transition-all duration-150",
};

export default function Card({
  variant = "base",
  padding = true,
  className = "",
  children,
  ...props
}) {
  return (
    <div
      className={`
        rounded-lg
        ${variants[variant] || variants.base}
        ${padding ? "p-5" : ""}
        ${className}
      `.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

/** Convenience sub-component for card headers */
Card.Header = function CardHeader({ title, subtitle, actions, className = "" }) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] tracking-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
};
