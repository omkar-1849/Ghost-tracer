import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, FileSearch, ShieldAlert, Trash2 } from "lucide-react";
import { getRecentLogs } from "../services/api";

/* ------------------------------------------------------------------ */
/* Config / helpers                                                    */
/* ------------------------------------------------------------------ */

const PREVIEW_LIMIT = 5;

const modalStyles = `
@keyframes logs-modal-in {
  from { opacity: 0; transform: translateY(12px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.logs-modal-in { animation: logs-modal-in 180ms ease-out both; }
`;

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
            return "bg-red-500/10 border border-red-500/25 text-red-400";
        case "HIGH":
            return "bg-orange-500/10 border border-orange-500/25 text-orange-400";
        case "MEDIUM":
            return "bg-yellow-500/10 border border-yellow-500/25 text-yellow-400";
        default:
            return "bg-green-500/10 border border-green-500/25 text-green-400";
    }
}

function riskColor(score) {
    const value = Number(score);

    if (value >= 80) return "text-red-400";
    if (value >= 50) return "text-orange-400";
    if (value >= 25) return "text-yellow-400";
    return "text-green-400";
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[420px] flex flex-col">
            <style>{modalStyles}</style>

            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">
                        Recent Security Logs
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Latest detections captured by the engine
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-800/60 border border-slate-700 text-slate-300 hover:border-blue-500/40 hover:text-white hover:bg-slate-800 transition-colors"
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

            {/* Body */}
            {logs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-800 bg-slate-950/40">
                    <span className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center">
                        <FileSearch size={22} className="text-blue-400" />
                    </span>
                    <p className="text-slate-300 font-medium">
                        No security logs yet
                    </p>
                    <p className="text-slate-500 text-sm text-center max-w-xs">
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
                        <thead className="sticky top-0 bg-slate-900 z-10">
                            <tr className="border-b border-slate-800 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                <th className="pb-2.5 pr-3">IP Address</th>
                                <th className="pb-2.5 pr-3 hidden md:table-cell">
                                    URL
                                </th>
                                <th className="pb-2.5 pr-3">Threat</th>
                                <th className="pb-2.5 pr-3 hidden sm:table-cell">
                                    Risk
                                </th>
                                <th className="pb-2.5 pr-3 hidden lg:table-cell">
                                    Time
                                </th>
                                <th className="pb-2.5" />
                            </tr>
                        </thead>

                        <tbody>
                            {visibleLogs.map((log) => (
                                <tr
                                    key={log.id}
                                    className="group border-b border-slate-800/70 hover:bg-slate-800/30 transition-colors"
                                >
                                    <td className="py-2.5 pr-3">
                                        <p className="font-mono text-sm text-slate-200">
                                            {log.ip_address}
                                        </p>
                                        <p className="text-[11px] text-slate-500 truncate max-w-[160px] md:hidden">
                                            {log.url}
                                        </p>
                                    </td>

                                    <td className="py-2.5 pr-3 hidden md:table-cell">
                                        <p className="text-sm text-slate-400 truncate max-w-[220px]">
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
                                            className={`text-sm font-semibold ${riskColor(log.risk_score)}`}
                                        >
                                            {log.risk_score}
                                        </span>
                                    </td>

                                    <td
                                        className="py-2.5 pr-3 hidden lg:table-cell text-xs text-slate-500 whitespace-nowrap"
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
                                            className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
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

            {/* Footer count */}
            {logs.length > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800/70">
                    <p className="text-xs text-slate-500">
                        Showing{" "}
                        <span className="text-slate-300 font-semibold">
                            {visibleLogs.length}
                        </span>{" "}
                        of{" "}
                        <span className="text-slate-300 font-semibold">
                            {logs.length}
                        </span>{" "}
                        logs
                    </p>

                    {logs.length > PREVIEW_LIMIT && (
                        <button
                            type="button"
                            onClick={() => setExpanded((value) => !value)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
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

            {/* Delete confirmation */}
            {pendingDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setPendingDelete(null)}
                    />

                    <div className="logs-modal-in relative bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-[0_32px_80px_-24px_rgba(0,0,0,0.9)]">
                        <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
                                <ShieldAlert size={20} className="text-red-400" />
                            </span>

                            <div>
                                <h3 className="text-base font-semibold text-white">
                                    Delete this log?
                                </h3>
                                <p className="text-sm text-slate-400 mt-0.5">
                                    This removes the log entry from the recent
                                    list.
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 rounded-xl bg-slate-800/50 border border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-mono text-sm text-slate-200 truncate">
                                    {pendingDelete.ip_address}
                                </p>
                                <p className="text-xs text-slate-500 truncate mt-0.5">
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
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700/70 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25 transition-colors"
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
