import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, ExternalLink, Ban, ArrowUpRight } from "lucide-react";
import { getLiveFeed, getRecentLogs } from "../services/api";

function formatTimestamp(ts) {
    if (!ts) return "—";
    try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return String(ts);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const time = d.toTimeString().split(" ")[0];
        return `${y}/${m}.${day} ${time}`;
    } catch {
        return String(ts);
    }
}

function resolveThreatType(reason, threatLevel) {
    if (!reason) {
        return threatLevel === "CRITICAL" ? "Brute Force Attack" : "Suspicious Request";
    }
    const r = reason.toLowerCase();
    if (r.includes("sql")) return "SQL Injection";
    if (r.includes("xss")) return "Cross-Site Scripting";
    if (r.includes("brute") || r.includes("auth")) return "Brute Force SSH";
    if (r.includes("path") || r.includes("traversal")) return "Path Traversal";
    if (r.includes("ssrf")) return "SSRF Vector";
    if (r.includes("admin")) return "Privilege Escalation";
    if (r.includes("port") || r.includes("scan")) return "Malicious Port Scan";
    return reason.length > 25 ? `${reason.slice(0, 25)}…` : reason;
}

function StatusCapsule({ status, threatLevel }) {
    if (status === "BLOCKED" || threatLevel === "CRITICAL") {
        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-medium bg-[rgba(230,57,70,0.12)] border border-[rgba(230,57,70,0.3)] text-[var(--color-critical)]">
                BLOCKED
            </span>
        );
    }
    if (status === "INVESTIGATING" || threatLevel === "HIGH") {
        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-medium bg-[rgba(245,158,11,0.12)] border border-[rgba(245,158,11,0.3)] text-[var(--color-high)]">
                INVESTIGATING
            </span>
        );
    }
    return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-medium bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.18)] text-white">
            CLEARED
        </span>
    );
}

function LiveAttackFeed() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        async function fetchThreats() {
            try {
                // Try live feed first, fallback to recent logs
                const feedData = await getLiveFeed().catch(() => []);
                if (isMounted && Array.isArray(feedData) && feedData.length > 0) {
                    setEvents(feedData);
                    return;
                }
                const logs = await getRecentLogs().catch(() => []);
                if (isMounted && Array.isArray(logs)) {
                    setEvents(logs.slice(0, 8));
                }
            } catch (err) {
                console.error("Failed to load live threat stream", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchThreats();
        const interval = setInterval(fetchThreats, 5000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    return (
        <div className="frosted-card p-5 select-none overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-white text-[15px] font-bold tracking-tight">Live Threat Activity</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Real-time threat interception log</p>
                </div>
                <Link
                    to="/activity"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-white transition-colors"
                >
                    <span>View all activity</span>
                    <ArrowUpRight size={14} />
                </Link>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13.5px]">
                    <thead>
                        <tr className="border-b border-[var(--color-border-default)] text-[11px] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                            <th className="pb-3 font-medium">Timestamp</th>
                            <th className="pb-3 font-medium">Threat Type</th>
                            <th className="pb-3 font-medium">Origin IP / Host</th>
                            <th className="pb-3 font-medium">Status</th>
                            <th className="pb-3 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-subtle)]">
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="py-6 text-center text-xs text-[var(--color-text-muted)]">
                                    Loading live security stream…
                                </td>
                            </tr>
                        ) : events.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="py-6 text-center text-xs text-[var(--color-text-muted)]">
                                    No live attacks intercepted in this monitoring window.
                                </td>
                            </tr>
                        ) : (
                            events.map((item, idx) => {
                                const threatLevel = item.threat_level || (item.threatLevel ?? "LOW");
                                const ip = item.ip_address || item.ipAddress || item.source_ip || "127.0.0.1";
                                const threatName = resolveThreatType(item.reason || item.detection_reason || item.message, threatLevel);
                                const ts = item.timestamp || item.created_at || Date.now() - idx * 120000;
                                const status = threatLevel === "CRITICAL" ? "BLOCKED" : threatLevel === "HIGH" ? "INVESTIGATING" : "CLEARED";

                                return (
                                    <tr
                                        key={idx}
                                        className="group hover:bg-[rgba(255,255,255,0.03)] transition-colors duration-100"
                                    >
                                        <td className="py-2.5 font-mono text-[11.5px] text-[var(--color-text-secondary)] whitespace-nowrap">
                                            {formatTimestamp(ts)}
                                        </td>
                                        <td className="py-2.5 font-medium text-white whitespace-nowrap">
                                            {threatName}
                                        </td>
                                        <td className="py-2.5 font-mono text-[12px] text-[var(--color-text-secondary)] whitespace-nowrap">
                                            {ip}
                                        </td>
                                        <td className="py-2.5 whitespace-nowrap">
                                            <StatusCapsule status={status} threatLevel={threatLevel} />
                                        </td>
                                        <td className="py-2.5 text-right whitespace-nowrap">
                                            <div className="inline-flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <Link
                                                    to={`/activity?ip=${encodeURIComponent(ip)}`}
                                                    className="p-1 rounded hover:bg-[rgba(255,255,255,0.1)] text-[var(--color-text-secondary)] hover:text-white"
                                                    title="Inspect Event"
                                                >
                                                    <ExternalLink size={13} />
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default LiveAttackFeed;
