import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, ArrowUpRight } from "lucide-react";
import { getLiveFeed } from "../services/api";

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

function resolveThreatType(reason) {
    if (!reason) {
        return "Not reported";
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

function StatusCapsule({ threatLevel }) {
    const label = threatLevel === "CRITICAL" ? "CRITICAL" : threatLevel === "HIGH" ? "HIGH" : "RECORDED";
    const tone = threatLevel === "CRITICAL"
        ? "text-[#E67868] bg-[rgba(230,120,104,0.12)] border border-[rgba(230,120,104,0.22)]"
        : threatLevel === "HIGH"
            ? "text-[#D3A06A] bg-[rgba(211,160,106,0.12)] border border-[rgba(211,160,106,0.20)]"
            : "text-[#A9A199] bg-[rgba(169,161,153,0.08)] border border-[rgba(169,161,153,0.14)]";
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-sans font-medium tracking-wide ${tone}`}>
            {label}
        </span>
    );
}

function LiveAttackFeed() {
    const [events, setEvents] = useState([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        async function fetchThreats() {
            try {
                const feedData = await getLiveFeed();
                if (!Array.isArray(feedData)) throw new Error("Invalid feed response");
                if (isMounted) { setEvents(feedData); setError(""); }
            } catch (err) {
                if (isMounted) { setError(err.message); setEvents([]); }
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
        <div className="w-full flex flex-col h-full font-sans">
            {/* Header Layout */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[rgba(245,241,236,0.06)]">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h3 className="text-[#F5F1EC] text-[18px] font-semibold tracking-tight">
                            Live Threat Activity
                        </h3>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[rgba(230,120,104,0.12)] border border-[rgba(230,120,104,0.22)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#E67868]"></span>
                            <span className="text-[10px] uppercase font-semibold text-[#E67868] tracking-widest">Live</span>
                        </div>
                    </div>
                    <p className="text-[14px] text-[#A9A199] mt-0.5">Recorded threat events</p>
                </div>
                <Link
                    to="/activity"
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#D3A06A] hover:text-[#E3B985] transition-colors"
                >
                    <span>View all activity</span>
                    <ArrowUpRight size={14} />
                </Link>
            </div>

            {error && <p role="alert" className="text-[#E67868] mb-4 text-sm">Activity unavailable: {error}</p>}
            
            {/* Desktop Table with generous column spacing */}
            <div className="hidden min-[700px]:block overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-[rgba(245,241,236,0.06)] text-[12.5px] font-medium text-[#8B837B]">
                            <th className="pb-3.5 pr-4 font-medium whitespace-nowrap w-[22%]">Timestamp</th>
                            <th className="pb-3.5 px-4 font-medium w-[28%]">Threat Type</th>
                            <th className="pb-3.5 px-4 font-medium whitespace-nowrap w-[24%]">Origin IP / Host</th>
                            <th className="pb-3.5 px-4 font-medium w-[16%]">Severity</th>
                            <th className="pb-3.5 pl-4 font-medium text-right w-[10%]">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(245,241,236,0.04)]">
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="py-16 text-center text-[14px] text-[#A9A199]">
                                    Loading live security stream…
                                </td>
                            </tr>
                        ) : events.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="py-16 text-center text-[14px] text-[#A9A199]">
                                    No recorded events in this monitoring window.
                                </td>
                            </tr>
                        ) : (
                            events.map((item, idx) => {
                                const threatLevel = item.threat_level || (item.threatLevel ?? "LOW");
                                const ip = item.ip_address || item.ipAddress || item.source_ip || "Unknown";
                                const threatName = resolveThreatType(item.reason || item.detection_reason || item.message);
                                const ts = item.timestamp || item.created_at;

                                return (
                                    <tr
                                        key={idx}
                                        className="h-[52px]"
                                    >
                                        <td className="py-3 pr-4 font-mono text-[12px] text-[#A9A199] whitespace-nowrap">
                                            {formatTimestamp(ts)}
                                        </td>
                                        <td className="py-3 px-4 font-sans font-medium text-[13.5px] text-[#F5F1EC]">
                                            {threatName}
                                        </td>
                                        <td className="py-3 px-4 font-mono text-[12.5px] text-[#D6CFC7] whitespace-nowrap">
                                            {ip}
                                        </td>
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            <StatusCapsule threatLevel={threatLevel} />
                                        </td>
                                        <td className="py-3 pl-4 text-right whitespace-nowrap">
                                            <Link
                                                to={`/activity?ip=${encodeURIComponent(ip)}`}
                                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#8B837B] hover:text-[#D3A06A] hover:bg-[rgba(211,160,106,0.08)] focus:outline-none focus:ring-1 focus:ring-[#D3A06A] transition-colors"
                                                aria-label={`Inspect event from ${ip}`}
                                                title="Inspect Event"
                                            >
                                                <ExternalLink size={14} />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Compact Stacked Cards (<700px) */}
            <div className="block min-[700px]:hidden space-y-3 flex-1">
                {loading ? (
                    <div className="py-12 text-center text-[14px] text-[#A9A199]">
                        Loading live security stream…
                    </div>
                ) : events.length === 0 ? (
                    <div className="py-12 text-center text-[14px] text-[#A9A199]">
                        No recorded events in this monitoring window.
                    </div>
                ) : (
                    events.map((item, idx) => {
                        const threatLevel = item.threat_level || (item.threatLevel ?? "LOW");
                        const ip = item.ip_address || item.ipAddress || item.source_ip || "Unknown";
                        const threatName = resolveThreatType(item.reason || item.detection_reason || item.message);
                        const ts = item.timestamp || item.created_at;

                        return (
                            <div 
                                key={idx}
                                className="flex flex-col p-4 rounded-xl border border-[rgba(245,241,236,0.06)] bg-[rgba(14,13,11,0.40)] gap-3 min-h-[72px]"
                            >
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex flex-col gap-1">
                                        <span className="font-sans font-medium text-[14px] text-[#F5F1EC]">
                                            {threatName}
                                        </span>
                                        <span className="font-mono text-[12px] text-[#D6CFC7]">
                                            {ip}
                                        </span>
                                    </div>
                                    <StatusCapsule threatLevel={threatLevel} />
                                </div>
                                
                                <div className="flex justify-between items-center mt-1 border-t border-[rgba(245,241,236,0.06)] pt-3">
                                    <span className="font-mono text-[12px] text-[#A9A199]">
                                        {formatTimestamp(ts)}
                                    </span>
                                    <Link
                                        to={`/activity?ip=${encodeURIComponent(ip)}`}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] text-[#D3A06A] hover:text-[#E3B985] hover:bg-[rgba(211,160,106,0.08)] focus:outline-none focus:ring-1 focus:ring-[#D3A06A] transition-colors font-sans font-medium"
                                        aria-label={`Inspect event from ${ip}`}
                                    >
                                        <span>Inspect</span>
                                        <ExternalLink size={13} />
                                    </Link>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export default LiveAttackFeed;
