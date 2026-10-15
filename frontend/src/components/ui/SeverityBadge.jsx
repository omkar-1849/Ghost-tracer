import { getSeverity } from "./severity";

/* ============================================================
   SeverityBadge — Semantic severity indicator
   Uses the centralized severity token system.
   ============================================================ */

export default function SeverityBadge({ level, className = "" }) {
  const sev = getSeverity(level);
  const tw = sev.tailwind;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-0.5
        text-[11px] font-medium font-sans tracking-wide leading-none
        border rounded-full
        ${tw.bg} ${tw.border} ${tw.text}
        ${className}
      `.trim()}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${tw.dot}`} />
      {sev.label}
    </span>
  );
}
