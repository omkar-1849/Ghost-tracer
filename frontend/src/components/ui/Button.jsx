import { Loader2 } from "lucide-react";

/* ============================================================
   Button — Primary interaction primitive
   Variants: primary | secondary | ghost | danger
   Sizes:    sm | md | lg
   ============================================================ */

const variants = {
  primary:
    "bg-gradient-to-r from-[#d3a06a] to-[#e3b985] text-[#0d0c0a] font-semibold shadow-[0_2px_12px_rgba(211,160,106,0.25)] hover:from-[#e3b985] hover:to-[#f5deb3] active:from-[#b98248] active:to-[#d3a06a]",
  secondary:
    "bg-[rgba(255,255,255,0.03)] text-[#f5f1ec] border border-[rgba(211,160,106,0.18)] hover:bg-[rgba(211,160,106,0.08)] hover:border-[rgba(211,160,106,0.32)] hover:text-white",
  ghost:
    "bg-transparent text-[#d6cfc7] hover:bg-[rgba(211,160,106,0.06)] hover:text-[#f5f1ec]",
  danger:
    "bg-[rgba(230,120,104,0.12)] text-[#e67868] border border-[rgba(230,120,104,0.25)] hover:bg-[rgba(230,120,104,0.20)]",
};

const sizes = {
  sm: "px-2.5 py-1 text-xs gap-1.5",
  md: "px-3.5 py-2 text-sm gap-2",
  lg: "px-5 py-2.5 text-sm gap-2",
};

export default function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  children,
  className = "",
  ...props
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center font-medium rounded-xl
        transition-all duration-150
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e3b985]
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${isDisabled ? "opacity-50 pointer-events-none" : "cursor-pointer"}
        ${className}
      `.trim()}
      {...props}
    >
      {loading && <Loader2 size={size === "sm" ? 14 : 16} className="animate-spin" />}
      {children}
    </button>
  );
}
