/* ============================================================
   Card — Surface container primitive
   Variants: base | elevated | interactive
   ============================================================ */

const variants = {
  base: "bg-[rgba(18,16,14,0.38)] backdrop-blur-[24px] saturate-[120%] border border-[rgba(211,160,106,0.12)] shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.06),0_16px_40px_-8px_rgba(0,0,0,0.45)]",
  elevated:
    "bg-[rgba(20,18,16,0.50)] backdrop-blur-[28px] saturate-[125%] border border-[rgba(211,160,106,0.18)] shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.08),0_24px_56px_-12px_rgba(0,0,0,0.55)]",
  interactive:
    "bg-[rgba(18,16,14,0.38)] backdrop-blur-[24px] saturate-[120%] border border-[rgba(211,160,106,0.12)] shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.06),0_16px_40px_-8px_rgba(0,0,0,0.45)] hover:border-[rgba(227,185,133,0.35)] hover:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.10),0_20px_48px_-8px_rgba(0,0,0,0.55)] transition-all duration-150 cursor-pointer",
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
        rounded-[20px] text-[#f5f1ec]
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
        <h3 className="text-sm font-semibold text-[#f5f1ec] tracking-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-[#a9a199] mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
};
