import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, FileSearch, ShieldAlert, Trash2 } from "lucide-react";
import { getRecentLogs } from "../services/api";

const PREVIEW_LIMIT = 5;

function timeAgo(value) {
    if (!value) return "—";
    const diff = Math.max(0, Date.now() - new Date(value).getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function threatBadge(level) {
    switch (level) {
        case "CRITICAL":
            return "bg-[var(--color-critical)]/10 border border-[var(--color-critical)]/25 text-[var(--color-critical)]";
        case "HIGH":
            return "bg-[var(--color-high)]/10 border border-[var(--color-high)]/25 text-[var(--color-high)]";
        case "MEDIUM":
            return "bg-[var(--color-medium)]/10 border border-[var(--color-medium)]/25 text-[var(--color-medium)]";
        default:
            return "bg-[var(--color-success)]/10 border border-[var(--color-success)]/25 text-[var(--color-success)]";
    }
}

function riskColor(score) {
    const value = Number(score);
    if (value >= 80) return "text-[var(--color-critical)]";
    if (value >= 50) return "text-[var(--color-high)]";
    if (value >= 25) return "text-[var(--color-medium)]";
    return "text-[var(--color-success)]";
}

function RecentLogs() {
    const [logs, setLogs] = useState([]);
    const [expanded, setExpanded] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);
    const deletedIdsRef = useRef([]);

    useEffect(() => {
        async function loadLogs() {
            try {
                const data = await getRecentLogs();
                const rows = Array.isArray(data) ? data : [];
                setLogs(
                    rows.filter(
                        (log) => !deletedIdsRef.current.includes(log.id)
                    )
                );
            } catch (error) {
                console.error(error);
            }
        }
        loadLogs();
        const interval = setInterval(loadLogs, 5000);
        return () => clearInterval(interval);
    }, []);

    function handleConfirmDelete() {
        if (!pendingDelete) return;
        const id = pendingDelete.id;
        deletedIdsRef.current = [...deletedIdsRef.current, id];
        setLogs((prev) => prev.filter((log) => log.id !== id));
        setPendingDelete(null);
    }

    const visibleLogs = expanded ? logs : logs.slice(0, PREVIEW_LIMIT);

    return (
        <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-5 shadow-[var(--shadow-1)] min-h-[420px] flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">
                        Recent Security Logs
                    </h2>
                    <p className="text-[var(--color-text-muted)] text-sm mt-1">
                        Latest detections captured by the engine
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[var(--color-surface-3)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-1)] transition-colors"
                >
                    {expanded ? (
                        <>
                            <ChevronUp size={13} />
                            Collapse
                        </>
                    ) : (
                        <>
                            <ChevronDown size={13} />
                            View All
                        </>
                    )}
                </button>
            </div>

            {logs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-1)]">
                    <span className="w-12 h-12 rounded-lg bg-[var(--color-info)]/10 border border-[var(--color-info)]/25 flex items-center justify-center">
                        <FileSearch size={22} className="text-[var(--color-info)]" />
                    </span>
                    <p className="text-[var(--color-text-primary)] font-medium">
                        No security logs yet
                    </p>
                    <p className="text-[var(--color-text-muted)] text-sm text-center max-w-xs">
                        Detections will appear here as they are captured by the
                        monitoring engine.
                    </p>
                </div>
            ) : (
                <div
                    className={`flex-1 overflow-x-auto ${
                        expanded ? "max-h-[320px] overflow-y-auto" : ""
                    }`}
                >
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-[var(--color-surface-2)] z-10">
                            <tr className="border-b border-[var(--color-border-default)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                                <th className="pb-2.5 pr-3">IP Address</th>
                                <th className="pb-2.5 pr-3 hidden md:table-cell">URL</th>
                                <th className="pb-2.5 pr-3">Threat</th>
                                <th className="pb-2.5 pr-3 hidden sm:table-cell">Risk</th>
                                <th className="pb-2.5 pr-3 hidden lg:table-cell">Time</th>
                                <th className="pb-2.5" />
                            </tr>
                        </thead>

                        <tbody>
                            {visibleLogs.map((log) => (
                                <tr
                                    key={log.id}
                                    className="group border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-3)] transition-colors"
                                >
                                    <td className="py-2.5 pr-3">
                                        <p className="font-mono text-sm text-[var(--color-text-primary)]">
                                            {log.ip_address}
                                        </p>
                                        <p className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[160px] md:hidden">
                                            {log.url}
                                        </p>
                                    </td>

                                    <td className="py-2.5 pr-3 hidden md:table-cell">
                                        <p className="text-sm text-[var(--color-text-secondary)] truncate max-w-[220px]">
                                            {log.url}
                                        </p>
                                    </td>

                                    <td className="py-2.5 pr-3">
                                        <span
                                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${threatBadge(log.threat_level)}`}
                                        >
                                            <span className="w-1 h-1 rounded-full bg-current" />
                                            {log.threat_level}
                                        </span>
                                    </td>

                                    <td className="py-2.5 pr-3 hidden sm:table-cell">
                                        <span
                                            className={`text-sm font-semibold tabular-nums ${riskColor(log.risk_score)}`}
                                        >
                                            {log.risk_score}
                                        </span>
                                    </td>

                                    <td
                                        className="py-2.5 pr-3 hidden lg:table-cell text-xs text-[var(--color-text-muted)] tabular-nums whitespace-nowrap"
                                        title={new Date(
                                            log.timestamp
                                        ).toLocaleString()}
                                    >
                                        {timeAgo(log.timestamp)}
                                    </td>

                                    <td className="py-2.5 text-right">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setPendingDelete(log)
                                            }
                                            title="Delete log"
                                            aria-label={`Delete log from ${log.ip_address}`}
                                            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-critical)] hover:bg-[var(--color-critical)]/10 transition-colors"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {logs.length > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--color-border-default)]">
                    <p className="text-xs text-[var(--color-text-muted)]">
                        Showing{" "}
                        <span className="text-[var(--color-text-primary)] font-semibold tabular-nums">
                            {visibleLogs.length}
                        </span>{" "}
                        of{" "}
                        <span className="text-[var(--color-text-primary)] font-semibold tabular-nums">
                            {logs.length}
                        </span>{" "}
                        logs
                    </p>

                    {logs.length > PREVIEW_LIMIT && (
                        <button
                            type="button"
                            onClick={() => setExpanded((value) => !value)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
                        >
                            {expanded ? "Collapse" : "View All"}
                            {expanded ? (
                                <ChevronUp size={13} />
                            ) : (
                                <ChevronDown size={13} />
                            )}
                        </button>
                    )}
                </div>
            )}

            {pendingDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60"
                        onClick={() => setPendingDelete(null)}
                    />

                    <div className="animate-[modal-in_0.18s_cubic-bezier(0.16,1,0.3,1)_both] relative bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] rounded-lg p-6 w-full max-w-sm shadow-[var(--shadow-2)]">
                        <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-lg bg-[var(--color-critical)]/10 border border-[var(--color-critical)]/30 flex items-center justify-center shrink-0">
                                <ShieldAlert size={20} className="text-[var(--color-critical)]" />
                            </span>

                            <div>
                                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                                    Delete this log?
                                </h3>
                                <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                                    This removes the log entry from the recent
                                    list.
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 rounded-lg bg-[var(--color-surface-3)] border border-[var(--color-border-subtle)] px-4 py-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-mono text-sm text-[var(--color-text-primary)] truncate">
                                    {pendingDelete.ip_address}
                                </p>
                                <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
                                    {pendingDelete.url}
                                </p>
                            </div>
                            <span
                                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold ${threatBadge(pendingDelete.threat_level)}`}
                            >
                                {pendingDelete.threat_level}
                            </span>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                type="button"
                                onClick={() => setPendingDelete(null)}
                                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[var(--color-surface-3)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-1)] hover:text-[var(--color-text-primary)] transition-colors"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[var(--color-critical)]/15 border border-[var(--color-critical)]/40 text-[var(--color-critical)] hover:bg-[var(--color-critical)]/25 transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default RecentLogs;
