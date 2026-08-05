import { useRef } from "react";
import { Globe, ShieldAlert } from "lucide-react";
import { timeAgo } from "./alertsData";

/**
 * IncidentRow
 * -----------
 * A single row in the incident queue.
 *
 * Interaction language (deliberately unique to rows):
 *  - matte card: no glass sheen or cursor spotlight
 *  - hover = border/background lighten (enterprise convention)
 *  - the severity accent bar lights up on hover / selection
 *  - the selected row reveals a secondary strip with contextual triage
 *    data (confidence, assigned analyst, MITRE, incident code) that is NOT
 *    already visible in the collapsed row
 *  - when the queue is collapsed to its 88px rail, rows render a compact
 *    variant: severity accent bar, incident icon, status dot and small
 *    truncated title
 */
function IncidentRow({ incident, selected, onSelect, delay = 0, collapsed = false }) {
    const rowRef = useRef(null);
    const theme = incident.severityTheme;

    function handlePointerMove(event) {
        const node = rowRef.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        node.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        node.style.setProperty("--my", `${event.clientY - rect.top}px`);
    }

    return (
        <button
            ref={rowRef}
            type="button"
            onClick={() => onSelect(incident.id)}
            onPointerMove={handlePointerMove}
            aria-pressed={selected}
            className={`alerts-enter alerts-row group w-full rounded-2xl border text-left transition-all duration-300 ${
                selected
                    ? "alerts-row--selected border-transparent bg-slate-800/60 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.8)]"
                    : "border-white/[0.07] bg-slate-900/35 hover:border-white/[0.14] hover:bg-slate-800/45"
            }`}
            style={{ animationDelay: `${delay}ms` }}
        >
            {/* Severity accent bar */}
            <span
                className={`alerts-row-accent absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full ${theme.bar}`}
            />

            {collapsed ? (
                /* -------------------------------------------------------- */
                /* Compact rail row — severity, icon, status, small title    */
                /* -------------------------------------------------------- */
                <span className="relative z-10 flex flex-col items-center gap-1.5 py-2.5">
                    <span
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 transition-all duration-300 group-hover:brightness-125 ${theme.iconWrap} ${
                            selected ? theme.glow : ""
                        }`}
                    >
                        <ShieldAlert size={16} />
                    </span>

                    {/* Status colour dot */}
                    <span
                        className={`h-1.5 w-1.5 rounded-full ${
                            incident.resolved ? "bg-emerald-500" : theme.chipDot
                        }`}
                    />

                    <span
                        className="w-full truncate px-1 text-center text-[10px] font-semibold leading-tight text-slate-300"
                        title={incident.title}
                    >
                        {incident.title}
                    </span>
                </span>
            ) : (
                /* -------------------------------------------------------- */
                /* Expanded row — severity, age, title, description, source  */
                /* -------------------------------------------------------- */
                <span className="relative z-10 flex items-start gap-3 py-2.5 pl-5 pr-3.5">
                    {/* Severity icon */}
                    <span
                        className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 transition-all duration-300 group-hover:brightness-125 ${theme.iconWrap} ${
                            selected ? theme.glow : ""
                        }`}
                    >
                        <ShieldAlert size={16} />
                    </span>

                    {/* Content */}
                    <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                            <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-[0.14em] ${theme.chip}`}
                            >
                                <span className={`h-1 w-1 rounded-full ${theme.chipDot}`} />
                                {theme.label.toUpperCase()}
                            </span>

                            <span className="ml-auto whitespace-nowrap text-[12px] font-medium tabular-nums text-slate-500">
                                {timeAgo(incident.created_at)}
                            </span>
                        </span>

                        <span className="mt-1 block truncate text-[15px] font-semibold leading-snug text-slate-100 transition-colors duration-300 group-hover:text-white">
                            {incident.title}
                        </span>

                        <span className="mt-1 block line-clamp-2 break-words text-[13px] leading-relaxed text-slate-500">
                            {incident.description}
                        </span>

                        <span className="mt-2 flex items-center gap-2">
                            <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-slate-500">
                                <Globe size={11} className="shrink-0 text-slate-600" />
                                <span className="truncate font-mono text-[12px]">
                                    {incident.source}
                                    {incident.sourcePort ? `:${incident.sourcePort}` : ""}
                                </span>
                            </span>

                            <span className="text-slate-700">•</span>

                            {/* Status chip */}
                            <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-[0.16em] ${
                                    incident.resolved
                                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                                        : theme.statusChip
                                }`}
                            >
                                <span
                                    className={`h-1 w-1 rounded-full ${
                                        incident.resolved
                                            ? "bg-emerald-500"
                                            : theme.chipDot
                                    }`}
                                />
                                {incident.status.toUpperCase()}
                            </span>
                        </span>

                        {/* Selected-only secondary strip — contextual triage data
                            that is NOT already visible above (no duplication) */}
                        {selected && (
                            <span className="alerts-row-expand mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/[0.06] pt-2.5">
                                <span className="flex items-center gap-1.5 text-[12px] text-slate-500">
                                    <span className="font-semibold text-slate-400">
                                        Confidence
                                    </span>
                                    <span
                                        className={`rounded-full border px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums ${
                                            incident.confidence >= 85
                                                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                                                : incident.confidence >= 70
                                                  ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                                                  : "border-white/10 bg-white/[0.03] text-slate-300"
                                        }`}
                                    >
                                        {incident.confidence}%
                                    </span>
                                </span>

                                <span className="flex items-center gap-1.5 text-[12px] text-slate-500">
                                    <span className="font-semibold text-slate-400">
                                        Assigned
                                    </span>
                                    <span className="font-medium text-slate-300">
                                        {incident.assignedTo ?? "Unassigned"}
                                    </span>
                                </span>

                                {incident.mitre && (
                                    <span className="flex items-center gap-1.5 text-[12px] text-slate-500">
                                        <span className="font-semibold text-slate-400">
                                            MITRE
                                        </span>
                                        <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-300">
                                            {incident.mitre}
                                        </span>
                                    </span>
                                )}

                                <span className="flex items-center gap-1.5 text-[12px] text-slate-500">
                                    <span className="font-semibold text-slate-400">
                                        Code
                                    </span>
                                    <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-300">
                                        {incident.caseId}
                                    </span>
                                </span>
                            </span>
                        )}
                    </span>
                </span>
            )}
        </button>
    );
}

export default IncidentRow;
