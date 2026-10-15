import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    ShieldAlert,
    TriangleAlert,
    Flame,
    Search,
    ArrowUpRight,
    CheckCircle2,
    RefreshCw,
} from "lucide-react";
import { getRecentAlerts, getDashboardStats } from "../services/api";

function formatTimestamp(ts) {
    if (!ts) return "—";
    try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return String(ts);
        return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${d.toLocaleTimeString([], { hour12: false })}`;
    } catch {
        return String(ts);
    }
}

function Alerts() {
    const [alerts, setAlerts] = useState([]);
    const [stats, setStats] = useState({});
    const [search, setSearch] = useState("");
    const [severity, setSeverity] = useState("ALL");
    const [loading, setLoading] = useState(true);

    const loadAlertsData = async () => {
        try {
            const [alertsData, statsData] = await Promise.allSettled([
                getRecentAlerts(),
                getDashboardStats(),
            ]);
            if (alertsData.status === "fulfilled" && Array.isArray(alertsData.value)) {
                setAlerts(alertsData.value);
            }
            if (statsData.status === "fulfilled" && statsData.value) {
                setStats(statsData.value);
            }
        } catch (err) {
            console.error("Failed to load alerts", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const initial = setTimeout(loadAlertsData, 0);
        const interval = setInterval(loadAlertsData, 6000);
        return () => { clearTimeout(initial); clearInterval(interval); };
    }, []);

    const filtered = useMemo(() => {
        return alerts.filter((a) => {
            const matchesSev =
                severity === "ALL" || (a.threat_level || a.threatLevel || "MEDIUM").toUpperCase() === severity;
            const q = search.toLowerCase().trim();
            const matchesQuery =
                !q ||
                (a.message || a.title || "").toLowerCase().includes(q) ||
                (a.source_ip || a.ip_address || "").toLowerCase().includes(q) ||
                (a.threat_level || "").toLowerCase().includes(q);
            return matchesSev && matchesQuery;
        });
    }, [alerts, search, severity]);

    return (
        <div className="sentinel-page space-y-6 animate-fade-in select-none">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#F5F1EC] flex items-center gap-2.5">
                        <ShieldAlert size={24} className="text-[#D3A06A]" />
                        <span>Threats & Alerts</span>
                    </h1>
                    <p className="text-xs font-mono text-[#A9A199] mt-1">
                        SOC alert queue streaming from detection engines
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={loadAlertsData}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[rgba(20,18,16,0.55)] border border-[rgba(255,248,238,0.08)] hover:border-[rgba(211,160,106,0.3)] text-xs text-[#D6CFC7] hover:text-[#F5F1EC] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin text-[#D3A06A]" : "text-[#A9A199]"} />
                        <span>Sync Alerts</span>
                    </button>
                    <Link
                        to="/incidents"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#d3a06a] to-[#e3b985] text-[#0d0c0a] font-semibold text-xs hover:brightness-105 transition-all shadow-[0_2px_12px_rgba(211,160,106,0.25)]"
                    >
                        <span>Incident Workspace</span>
                        <ArrowUpRight size={14} />
                    </Link>
                </div>
            </div>

            {/* Severity KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="sentinel-glass p-5 rounded-2xl relative overflow-hidden group">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono uppercase tracking-wider text-[#A9A199]">Critical Alerts</span>
                        <Flame size={18} className="text-[#E67868]" />
                    </div>
                    <div className="text-3xl font-bold text-[#F5F1EC] font-mono mt-3 tabular-nums">
                        {stats.critical_alerts || 0}
                    </div>
                    <p className="text-xs font-mono text-[#E67868] mt-1">Requires immediate triage</p>
                </div>

                <div className="sentinel-glass p-5 rounded-2xl relative overflow-hidden group">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono uppercase tracking-wider text-[#A9A199]">High Severity</span>
                        <TriangleAlert size={18} className="text-[#D3A06A]" />
                    </div>
                    <div className="text-3xl font-bold text-[#F5F1EC] font-mono mt-3 tabular-nums">
                        {stats.high_alerts || 0}
                    </div>
                    <p className="text-xs font-mono text-[#D3A06A] mt-1">Elevated threat level</p>
                </div>

                <div className="sentinel-glass p-5 rounded-2xl relative overflow-hidden group">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono uppercase tracking-wider text-[#A9A199]">Total Alerts</span>
                        <ShieldAlert size={18} className="text-[#D6CFC7]" />
                    </div>
                    <div className="text-3xl font-bold text-[#F5F1EC] font-mono mt-3 tabular-nums">
                        {stats.total_alerts || alerts.length || 0}
                    </div>
                    <p className="text-xs font-mono text-[#A9A199] mt-1">24h threat volume</p>
                </div>

                <div className="sentinel-glass p-5 rounded-2xl relative overflow-hidden group">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono uppercase tracking-wider text-[#A9A199]">Defense Mode</span>
                        <CheckCircle2 size={18} className="text-[#77C79A]" />
                    </div>
                    <div className="text-3xl font-bold text-[#77C79A] font-mono mt-3">
                        ACTIVE
                    </div>
                    <p className="text-xs font-mono text-[#A9A199] mt-1">All sensors nominal</p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="sentinel-glass p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-96">
                    <Search
                        size={15}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B837B] pointer-events-none"
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search alerts by title, source IP..."
                        className="w-full bg-[rgba(14,12,10,0.55)] border border-[rgba(255,248,238,0.08)] rounded-xl pl-10 pr-3 py-2 text-xs text-[#F5F1EC] placeholder:text-[#8B837B] focus:outline-none focus:border-[rgba(211,160,106,0.5)] focus:ring-1 focus:ring-[rgba(211,160,106,0.3)] transition-all"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                    {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
                        <button
                            key={sev}
                            type="button"
                            onClick={() => setSeverity(sev)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium transition-all ${
                                severity === sev
                                    ? "bg-gradient-to-r from-[#d3a06a] to-[#e3b985] text-[#0d0c0a] font-bold shadow-[0_2px_10px_rgba(211,160,106,0.25)]"
                                    : "bg-[rgba(20,18,16,0.45)] text-[#A9A199] hover:text-[#F5F1EC] hover:bg-[rgba(30,26,22,0.6)] border border-[rgba(255,248,238,0.06)]"
                            }`}
                        >
                            {sev}
                        </button>
                    ))}
                </div>
            </div>

            {/* Alerts List Table */}
            <div className="sentinel-glass p-5 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13.5px]">
                        <thead>
                            <tr className="border-b border-[rgba(255,248,238,0.06)] text-[11px] font-mono text-[#8B837B] uppercase tracking-wider">
                                <th className="pb-3.5 font-medium">Alert ID</th>
                                <th className="pb-3.5 font-medium">Severity</th>
                                <th className="pb-3.5 font-medium">Threat Description</th>
                                <th className="pb-3.5 font-medium">Source IP</th>
                                <th className="pb-3.5 font-medium">Timestamp</th>
                                <th className="pb-3.5 font-medium text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[rgba(255,248,238,0.04)]">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-xs font-mono text-[#A9A199]">
                                        Loading SOC alerts…
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-xs font-mono text-[#A9A199]">
                                        No active alerts matching criteria.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((a, idx) => {
                                    const sev = (a.threat_level || a.threatLevel || "MEDIUM").toUpperCase();
                                    const alertId = a.id ? `ALT-${String(a.id).padStart(4, "0")}` : `ALT-0${idx + 101}`;
                                    const ip = a.source_ip || a.ip_address || "192.168.1.101";

                                    return (
                                        <tr
                                            key={a.id || idx}
                                            className="group hover:bg-[rgba(211,160,106,0.04)] transition-colors duration-150"
                                        >
                                            <td className="py-3.5 font-mono text-xs text-[#A9A199] whitespace-nowrap">
                                                {alertId}
                                            </td>
                                            <td className="py-3.5 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-semibold ${
                                                        sev === "CRITICAL"
                                                            ? "bg-[rgba(230,120,104,0.14)] text-[#E67868] border border-[rgba(230,120,104,0.3)]"
                                                            : sev === "HIGH"
                                                            ? "bg-[rgba(211,160,106,0.14)] text-[#E3B985] border border-[rgba(211,160,106,0.3)]"
                                                            : "bg-[rgba(255,248,238,0.06)] text-[#D6CFC7] border border-[rgba(255,248,238,0.1)]"
                                                    }`}
                                                >
                                                    {sev}
                                                </span>
                                            </td>
                                            <td className="py-3.5 font-medium text-[#F5F1EC] max-w-md truncate text-sm">
                                                {a.message || a.title || "Unauthorized attack vector pattern detected"}
                                            </td>
                                            <td className="py-3.5 font-mono text-xs text-[#D6CFC7] whitespace-nowrap">
                                                {ip}
                                            </td>
                                            <td className="py-3.5 font-mono text-xs text-[#A9A199] whitespace-nowrap">
                                                {formatTimestamp(a.timestamp || a.created_at)}
                                            </td>
                                            <td className="py-3.5 text-right whitespace-nowrap">
                                                <Link
                                                    to={
                                                        (a.incident_id || a.incidentId)
                                                            ? `/incidents?id=${a.incident_id || a.incidentId}`
                                                            : (ip ? `/incidents?search=${encodeURIComponent(ip)}` : `/incidents`)
                                                    }
                                                    className="inline-flex items-center gap-1 text-xs font-mono text-[#D3A06A] hover:text-[#E3B985] transition-colors"
                                                >
                                                    <span>Investigate</span>
                                                    <ArrowUpRight size={13} />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default Alerts;
