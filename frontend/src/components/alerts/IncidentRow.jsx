import { useRef } from "react";
import { Globe, ShieldAlert } from "lucide-react";
import { timeAgo } from "./alertsData";

/**
 * IncidentRow
 * -----------
 * A single row in the incident queue.
 *
 * Interaction language (deliberately unique to rows):
 *  - cursor spotlight that follows the pointer (radial glass light)
 *  - a single glass sheen sweeping across the row on hover
 *  - the severity accent bar lights up and stretches
 *  - the selected row morphs into an active state: animated gradient
 *    border, soft lift, and an expanding selection halo
 */
function IncidentRow({ incident, selected, onSelect, delay = 0 }) {
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
            className={`alerts-enter alerts-row alerts-spotlight alerts-sheen group w-full rounded-2xl border text-left transition-all duration-500 ${
                selected
                    ? "alerts-row--selected -translate-y-0.5 border-transparent bg-slate-800/50 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.8),0_0_40px_-14px_rgba(34,211,238,0.35)]"
                    : "border-white/[0.07] bg-slate-900/35 hover:border-white/[0.14] hover:bg-slate-800/45"
            }`}
            style={{ animationDelay: `${delay}ms` }}
        >
            {/* Frosted sheen layer */}
            <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.05] via-white/[0.01] to-transparent" />

            {/* Expanding selection halo */}
            {selected && <span className="alerts-halo" key={`halo-${incident.id}`} />}

            {/* Severity accent bar */}
            <span
                className={`alerts-row-accent absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full ${theme.bar}`}
            />

            <span className="relative z-10 flex items-start gap-3.5 py-4 pl-6 pr-4">
                {/* Severity icon */}
                <span
                    className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 transition-transform duration-500 group-hover:scale-110 ${theme.iconWrap} ${
                        selected ? theme.glow : ""
                    }`}
                >
                    <ShieldAlert size={16} />
                </span>

                {/* Content */}
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                        <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-[0.14em] ${theme.chip}`}
                        >
                            <span className={`h-1 w-1 rounded-full ${theme.chipDot}`} />
                            {theme.label.toUpperCase()}
                        </span>

                        <span className="ml-auto whitespace-nowrap text-[11px] font-medium tabular-nums text-slate-500">
                            {timeAgo(incident.created_at)}
                        </span>
                    </span>

                    <span className="mt-1.5 block truncate text-sm font-semibold leading-snug text-slate-100 transition-colors duration-300 group-hover:text-white">
                        {incident.title}
                    </span>

                    <span className="mt-1 block truncate text-xs leading-relaxed text-slate-500">
                        {incident.description}
                    </span>

                    <span className="mt-2.5 flex items-center gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500">
                            <Globe size={11} className="shrink-0 text-slate-600" />
                            <span className="truncate font-mono text-[11px]">
                                {incident.source}
                            </span>
                        </span>

                        <span className="text-slate-700">•</span>

                        {/* Status chip */}
                        <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wider ${
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
                </span>
            </span>
        </button>
    );
}

export default IncidentRow;
