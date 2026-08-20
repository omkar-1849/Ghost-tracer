/* ============================================================
   Badge — Small label primitive
   ============================================================ */

const variants = {
  default:
    "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]",
  accent:
    "bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border-[rgba(61,122,240,0.25)]",
};

export default function Badge({
  variant = "default",
  children,
  className = "",
  ...props
}) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5
        text-[11px] font-semibold leading-none
        border rounded
        ${variants[variant] || variants.default}
        ${className}
      `.trim()}
      {...props}
    >
      {children}
    </span>
  );
}
