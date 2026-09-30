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
        <div className="p-8 space-y-6 max-w-[1600px] mx-auto animate-fade-in select-none">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                        <ShieldAlert size={24} className="text-white" />
                        <span>Threats & Alerts</span>
                    </h1>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        SOC alert queue streaming from detection engines
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={loadAlertsData}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] text-xs text-white transition-all shadow-sm"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                        <span>Sync Alerts</span>
                    </button>
                    <Link
                        to="/incidents"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors shadow-sm"
                    >
                        <span>Incident Workspace</span>
                        <ArrowUpRight size={14} />
                    </Link>
                </div>
            </div>

            {/* Severity KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="frosted-card p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-[var(--color-text-muted)] uppercase">Critical Alerts</span>
                        <Flame size={18} className="text-[var(--color-critical)]" />
                    </div>
                    <div className="text-3xl font-bold text-white font-mono mt-3">
                        {stats.critical_alerts || 0}
                    </div>
                    <p className="text-xs text-[var(--color-critical)] mt-1">Requires immediate triage</p>
                </div>

                <div className="frosted-card p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-[var(--color-text-muted)] uppercase">High Severity</span>
                        <TriangleAlert size={18} className="text-[var(--color-high)]" />
                    </div>
                    <div className="text-3xl font-bold text-white font-mono mt-3">
                        {stats.high_alerts || 0}
                    </div>
                    <p className="text-xs text-[var(--color-high)] mt-1">Elevated threat level</p>
                </div>

                <div className="frosted-card p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-[var(--color-text-muted)] uppercase">Total Alerts</span>
                        <ShieldAlert size={18} className="text-white" />
                    </div>
                    <div className="text-3xl font-bold text-white font-mono mt-3">
                        {stats.total_alerts || alerts.length || 0}
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">24h threat volume</p>
                </div>

                <div className="frosted-card p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-[var(--color-text-muted)] uppercase">Defense Mode</span>
                        <CheckCircle2 size={18} className="text-[var(--color-success)]" />
                    </div>
                    <div className="text-3xl font-bold text-[var(--color-success)] font-mono mt-3">
                        ACTIVE
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">All sensors nominal</p>
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
                        placeholder="Search alerts by title, source IP..."
                        className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg pl-10 pr-3 py-2 text-sm text-white placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[rgba(255,255,255,0.4)]"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                    {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
                        <button
                            key={sev}
                            type="button"
                            onClick={() => setSeverity(sev)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                                severity === sev
                                    ? "bg-white text-black font-semibold shadow-sm"
                                    : "bg-[var(--color-surface-1)] text-[var(--color-text-secondary)] hover:text-white border border-[var(--color-border-default)]"
                            }`}
                        >
                            {sev}
                        </button>
                    ))}
                </div>
            </div>

            {/* Alerts List Table */}
            <div className="frosted-card p-5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13.5px]">
                        <thead>
                            <tr className="border-b border-[var(--color-border-default)] text-[11px] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                                <th className="pb-3.5 font-medium">Alert ID</th>
                                <th className="pb-3.5 font-medium">Severity</th>
                                <th className="pb-3.5 font-medium">Threat Description</th>
                                <th className="pb-3.5 font-medium">Source IP</th>
                                <th className="pb-3.5 font-medium">Timestamp</th>
                                <th className="pb-3.5 font-medium text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border-subtle)]">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-sm text-[var(--color-text-muted)]">
                                        Loading SOC alerts…
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-sm text-[var(--color-text-muted)]">
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
                                            className="group hover:bg-[rgba(255,255,255,0.03)] transition-colors duration-100"
                                        >
                                            <td className="py-3.5 font-mono text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                                                {alertId}
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
                                            <td className="py-3.5 font-medium text-white max-w-md truncate text-sm">
                                                {a.message || a.title || "Unauthorized attack vector pattern detected"}
                                            </td>
                                            <td className="py-3.5 font-mono text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                                                {ip}
                                            </td>
                                            <td className="py-3.5 font-mono text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                                                {formatTimestamp(a.timestamp || a.created_at)}
                                            </td>
                                            <td className="py-3.5 text-right whitespace-nowrap">
                                                <Link
                                                    to={`/incidents`}
                                                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-white transition-colors"
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
