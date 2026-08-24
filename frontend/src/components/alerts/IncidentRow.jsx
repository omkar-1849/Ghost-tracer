import { Globe, ShieldAlert } from "lucide-react";
import { timeAgo } from "./alertsData";

function IncidentRow({ incident, selected, onSelect, collapsed = false }) {
    const theme = incident.severityTheme;

    return (
        <button
            type="button"
            onClick={() => onSelect(incident.id)}
            aria-pressed={selected}
            className={`relative w-full rounded-md border text-left transition-colors duration-150 overflow-hidden ${
                selected
                    ? "border-[var(--color-signal-strong)] bg-[var(--color-signal-subtle)]"
                    : "border-[var(--color-border-default)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]"
            }`}
        >
            {/* Left severity accent rail */}
            <span
                className={`absolute left-0 top-0 bottom-0 w-[3px] ${theme.bar}`}
            />

            {collapsed ? (
                /* Compact rail row */
                <div className="flex flex-col items-center gap-1.5 py-2 px-1">
                    <span
                        className={`w-7 h-7 rounded flex items-center justify-center ${theme.iconWrap}`}
                    >
                        <ShieldAlert size={14} />
                    </span>

                    <span
                        className={`w-1.5 h-1.5 rounded-full ${
                            incident.resolved ? "bg-[var(--color-success)]" : theme.chipDot
                        }`}
                    />

                    <span
                        className="w-full truncate text-center text-[10px] font-medium text-[var(--color-text-secondary)]"
                        title={incident.title}
                    >
                        {incident.title}
                    </span>
                </div>
            ) : (
                /* Expanded full row */
                <div className="py-2.5 pl-4 pr-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                            <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${theme.chip}`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${theme.chipDot}`} />
                                {theme.label}
                            </span>

                            {incident.resolved && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[rgba(85,176,123,0.10)] border border-[rgba(85,176,123,0.25)] text-[var(--color-success)]">
                                    Resolved
                                </span>
                            )}
                        </div>

                        <span className="text-[11px] text-[var(--color-text-muted)] tabular-nums">
                            {timeAgo(incident.created_at || incident.timestamp)}
                        </span>
                    </div>

                    <h4 className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                        {incident.title}
                    </h4>

                    <p className="text-[11px] text-[var(--color-text-muted)] line-clamp-2 mt-0.5 leading-relaxed">
                        {incident.description}
                    </p>

                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[var(--color-text-muted)] pt-1.5 border-t border-[var(--color-border-subtle)]">
                        <span className="flex items-center gap-1 min-w-0">
                            <Globe size={11} className="text-[var(--color-text-disabled)] shrink-0" />
                            <span className="font-mono text-[var(--color-text-secondary)] truncate">
                                {incident.source}
                                {incident.sourcePort ? `:${incident.sourcePort}` : ""}
                            </span>
                        </span>

                        <span className="font-mono text-[10px] text-[var(--color-text-disabled)] shrink-0">
                            {incident.caseId}
                        </span>
                    </div>
                </div>
            )}
        </button>
    );
}

export default IncidentRow;
