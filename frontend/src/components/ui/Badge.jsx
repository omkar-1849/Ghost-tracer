/* ============================================================
   Badge — Small label primitive
   ============================================================ */

const variants = {
  default:
    "bg-[rgba(169,161,153,0.08)] text-[#d6cfc7] border-[rgba(169,161,153,0.14)]",
  accent:
    "bg-[rgba(211,160,106,0.12)] text-[#d3a06a] border-[rgba(211,160,106,0.20)]",
  signal:
    "bg-[rgba(227,185,133,0.10)] text-[#e3b985] border-[rgba(227,185,133,0.18)]",
  critical:
    "bg-[rgba(230,120,104,0.12)] text-[#e67868] border-[rgba(230,120,104,0.22)]",
  healthy:
    "bg-[rgba(119,199,154,0.12)] text-[#77c79a] border-[rgba(119,199,154,0.22)]",
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
        inline-flex items-center gap-1.5 px-2.5 py-0.5
        text-[11px] font-medium font-sans tracking-wide leading-none
        border rounded-full
        ${variants[variant] || variants.default}
        ${className}
      `.trim()}
      {...props}
    >
      {children}
    </span>
  );
}
