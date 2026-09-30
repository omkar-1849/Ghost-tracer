import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
    Activity as ActivityIcon,
    Search,
    ExternalLink,
    X,
    Clock,
    Terminal,
} from "lucide-react";
import { getRecentLogs } from "../services/api";

function formatTime(ts) {
    if (!ts) return "—";
    try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return String(ts);
        return d.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
        return String(ts);
    }
}

function formatDate(ts) {
    if (!ts) return "";
    try {
        const d = new Date(ts);
        return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    } catch {
        return "";
    }
}

function Activity() {
    const [searchParams] = useSearchParams();
    const initialQuery = searchParams.get("q") || searchParams.get("ip") || "";

    const [logs, setLogs] = useState([]);
    const [search, setSearch] = useState(initialQuery);
    const [severityFilter, setSeverityFilter] = useState("ALL");
    const [selectedLog, setSelectedLog] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        async function fetchLogs() {
            try {
                const data = await getRecentLogs();
                if (isMounted && Array.isArray(data)) {
                    setLogs(data);
                }
            } catch (err) {
                console.error("Failed to load activity logs", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchLogs();
        const interval = setInterval(fetchLogs, 5000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const filteredLogs = useMemo(() => {
        return logs.filter((log) => {
            const matchesSev =
                severityFilter === "ALL" ||
                (log.threat_level || "LOW").toUpperCase() === severityFilter;
            const q = search.toLowerCase().trim();
            const matchesSearch =
                !q ||
                (log.ip_address || "").toLowerCase().includes(q) ||
                (log.url || "").toLowerCase().includes(q) ||
                (log.detection_reason || "").toLowerCase().includes(q) ||
                (log.threat_level || "").toLowerCase().includes(q);
            return matchesSev && matchesSearch;
        });
    }, [logs, search, severityFilter]);

    return (
        <div className="p-8 space-y-6 max-w-[1600px] mx-auto animate-fade-in select-none">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                        <ActivityIcon size={24} className="text-white" />
                        <span>Security Event Stream</span>
                    </h1>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Real-time capture of inbound network events, security triggers, and anomalies
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-text-muted)]">
                    <Clock size={14} />
                    <span>Real-time Stream: Active</span>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="frosted-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-96">
                    <Search
                        size={16}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filter by IP, endpoint URL, threat trigger..."
                        className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg pl-10 pr-3 py-2 text-sm text-white placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[rgba(255,255,255,0.4)]"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                    {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
                        <button
                            key={sev}
                            type="button"
                            onClick={() => setSeverityFilter(sev)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                                severityFilter === sev
                                    ? "bg-white text-black font-semibold shadow-sm"
                                    : "bg-[var(--color-surface-1)] text-[var(--color-text-secondary)] hover:text-white border border-[var(--color-border-default)]"
                            }`}
                        >
                            {sev}
                        </button>
                    ))}
                </div>
            </div>

            {/* Event Table */}
            <div className="frosted-card p-5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13.5px]">
                        <thead>
                            <tr className="border-b border-[var(--color-border-default)] text-[11px] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                                <th className="pb-3.5 font-medium">Timestamp</th>
                                <th className="pb-3.5 font-medium">Source IP</th>
                                <th className="pb-3.5 font-medium">Target URL</th>
                                <th className="pb-3.5 font-medium">Detection Trigger</th>
                                <th className="pb-3.5 font-medium">Severity</th>
                                <th className="pb-3.5 font-medium text-right">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border-subtle)]">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-sm text-[var(--color-text-muted)]">
                                        Loading live security events…
                                    </td>
                                </tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-sm text-[var(--color-text-muted)]">
                                        No events matching the current search criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log, idx) => {
                                    const sev = (log.threat_level || "LOW").toUpperCase();
                                    return (
                                        <tr
                                            key={log.id || idx}
                                            onClick={() => setSelectedLog(log)}
                                            className="group hover:bg-[rgba(255,255,255,0.03)] cursor-pointer transition-colors duration-100"
                                        >
                                            <td className="py-3.5 font-mono text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                                                <span>{formatTime(log.timestamp)}</span>
                                                <span className="text-[11px] text-[var(--color-text-muted)] ml-2">
                                                    {formatDate(log.timestamp)}
                                                </span>
                                            </td>
                                            <td className="py-3.5 font-mono text-xs text-white whitespace-nowrap">
                                                {log.ip_address || "—"}
                                            </td>
                                            <td className="py-3.5 font-mono text-xs text-[var(--color-text-secondary)] max-w-xs truncate">
                                                {log.url || "/"}
                                            </td>
                                            <td className="py-3.5 font-medium text-white max-w-sm truncate text-sm">
                                                {log.detection_reason || "Normal request traffic"}
                                            </td>
                                            <td className="py-3.5 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10.5px] font-mono font-semibold ${
                                                        sev === "CRITICAL"
                                                            ? "bg-[rgba(230,57,70,0.15)] text-[var(--color-critical)] border border-[rgba(230,57,70,0.3)]"
                                                            : sev === "HIGH"
                                                            ? "bg-[rgba(245,158,11,0.15)] text-[var(--color-high)] border border-[rgba(245,158,11,0.3)]"
                                                            : "bg-[rgba(255,255,255,0.06)] text-white border border-[rgba(255,255,255,0.12)]"
                                                    }`}
                                                >
                                                    {sev}
                                                </span>
                                            </td>
                                            <td className="py-3.5 text-right whitespace-nowrap">
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] group-hover:text-white transition-colors">
                                                    <span>View Payload</span>
                                                    <ExternalLink size={13} />
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Event Details Inspection Drawer */}
            {selectedLog && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-xl h-full bg-[var(--color-surface-2)] border-l border-[var(--color-border-default)] shadow-[var(--shadow-modal)] flex flex-col justify-between overflow-y-auto custom-scrollbar p-6">
                        {/* Drawer Header */}
                        <div>
                            <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border-subtle)]">
                                <div>
                                    <h3 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                                        <Terminal size={18} />
                                        <span>Security Event Inspection</span>
                                    </h3>
                                    <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">
                                        IP: {selectedLog.ip_address} · Captured at {formatTime(selectedLog.timestamp)}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedLog(null)}
                                    className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.08)]"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Event Metadata Grid */}
                            <div className="my-6 grid grid-cols-2 gap-3 text-xs font-mono">
                                <div className="p-3 rounded-lg bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)]">
                                    <span className="text-[var(--color-text-muted)] block uppercase text-[10px]">Source IP</span>
                                    <span className="text-white font-bold text-sm">{selectedLog.ip_address || "127.0.0.1"}</span>
                                </div>
                                <div className="p-3 rounded-lg bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)]">
                                    <span className="text-[var(--color-text-muted)] block uppercase text-[10px]">Severity Level</span>
                                    <span className="text-white font-bold text-sm">{selectedLog.threat_level || "LOW"}</span>
                                </div>
                                <div className="col-span-2 p-3 rounded-lg bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)]">
                                    <span className="text-[var(--color-text-muted)] block uppercase text-[10px]">Target Path / URL</span>
                                    <span className="text-white font-semibold break-all">{selectedLog.url || "/"}</span>
                                </div>
                                <div className="col-span-2 p-3 rounded-lg bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)]">
                                    <span className="text-[var(--color-text-muted)] block uppercase text-[10px]">Detection Reason</span>
                                    <span className="text-white">{selectedLog.detection_reason || "Normal request"}</span>
                                </div>
                            </div>

                            {/* Raw Event Context Payload */}
                            <div>
                                <h4 className="text-xs font-mono text-[var(--color-text-muted)] uppercase mb-2">Raw Event Payload</h4>
                                <div className="p-4 rounded-xl bg-[var(--color-surface-inset)] border border-[var(--color-border-default)] font-mono text-xs text-[var(--color-text-secondary)] overflow-x-auto">
                                    <pre className="whitespace-pre-wrap break-all leading-relaxed">
                                        {JSON.stringify(
                                            {
                                                id: selectedLog.id,
                                                ip_address: selectedLog.ip_address,
                                                url: selectedLog.url,
                                                threat_level: selectedLog.threat_level,
                                                detection_reason: selectedLog.detection_reason,
                                                user_agent: selectedLog.user_agent,
                                                timestamp: selectedLog.timestamp,
                                            },
                                            null,
                                            2
                                        )}
                                    </pre>
                                </div>
                            </div>
                        </div>

                        {/* Drawer Footer */}
                        <div className="pt-4 mt-6 border-t border-[var(--color-border-subtle)] flex items-center justify-end">
                            <button
                                type="button"
                                onClick={() => setSelectedLog(null)}
                                className="px-5 py-2 rounded-lg bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors"
                            >
                                Close Inspection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Activity;
