import { getStatus } from "./severity";

/* ============================================================
   StatusBadge — Semantic status indicator
   Uses the centralized status token system.
   ============================================================ */

export default function StatusBadge({ status, className = "" }) {
  const st = getStatus(status);
  const tw = st.tailwind;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5
        text-[11px] font-semibold leading-none
        border rounded
        ${tw.bg} ${tw.border} ${tw.text}
        ${className}
      `.trim()}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${tw.dot}`} />
      {st.label}
    </span>
  );
}
