import { useEffect, useState } from "react";
import {
    ShieldAlert,
    Globe,
    Ban,
    ShieldCheck,
    AlertTriangle,
    Flame,
    ArrowUpRight,
} from "lucide-react";
import SecurityScore from "../components/SecurityScore";
import ThreatChart from "../components/ThreatChart";
import LiveAttackFeed from "../components/LiveAttackFeed";
import { getDashboardStats } from "../services/api";
import { getWebsites } from "../services/websiteApi";
import { getAllScans } from "../services/scannerApi";

/* Mini Stat Card with subtle hover frosted glow matching reference image */
function StatCard({ title, value, subtitle, icon: Icon, alert = false, active = false }) {
    return (
        <div
            className={`frosted-card p-5 flex flex-col justify-between select-none relative overflow-hidden group transition-all duration-200 ${
                active ? "frosted-card-active" : ""
            }`}
        >
            <div className="flex items-start justify-between">
                <span className="text-xs font-mono font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                    {title}
                </span>
                <div className="w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-white group-hover:border-[rgba(255,255,255,0.2)] transition-colors">
                    <Icon size={16} />
                </div>
            </div>

            <div className="my-3">
                <div className="text-3xl font-bold tracking-tight text-white font-mono">
                    {value}
                </div>
                {subtitle && (
                    <p className="text-xs text-[var(--color-text-muted)] font-mono mt-1">
                        {subtitle}
                    </p>
                )}
            </div>

            {/* Micro sparkline indicator bar */}
            <div className="w-full bg-[rgba(255,255,255,0.06)] h-1.5 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full ${
                        alert ? "bg-[var(--color-critical)]" : "bg-white"
                    }`}
                    style={{ width: "70%" }}
                />
            </div>
        </div>
    );
}

function Dashboard() {
    const [stats, setStats] = useState({
        total_logs: 0,
        total_alerts: 0,
        critical_alerts: 0,
        high_alerts: 0,
    });
    const [websiteCount, setWebsiteCount] = useState(0);
    const [scanCount, setScanCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        async function fetchDashboardData() {
            try {
                const [statsData, websites, scans] = await Promise.allSettled([
                    getDashboardStats(),
                    getWebsites(),
                    getAllScans(),
                ]);

                if (isMounted) {
                    if (statsData.status === "fulfilled" && statsData.value) {
                        setStats(statsData.value);
                    }
                    if (websites.status === "fulfilled" && Array.isArray(websites.value)) {
                        setWebsiteCount(websites.value.length);
                    }
                    if (scans.status === "fulfilled" && Array.isArray(scans.value)) {
                        setScanCount(scans.value.length);
                    }
                }
            } catch (err) {
                console.error("Dashboard data load error", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 10000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const activeAlerts = (stats.critical_alerts || 0) + (stats.high_alerts || 0);

    return (
        <div className="p-8 space-y-6 max-w-[1600px] mx-auto animate-fade-in select-none">
            {/* Top Title */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                    Real-time Security Operations & Autonomous Threat Defense
                </p>
            </div>

            {/* Row 1: Posture Gauge + 4 Metric Stat Cards matching reference image */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-stretch">
                {/* 1. Security Posture Dial */}
                <div className="sm:col-span-2 lg:col-span-1">
                    <SecurityScore stats={stats} />
                </div>

                {/* 2. Active Alerts Card (Hover glow active state) */}
                <StatCard
                    title="Active Alerts"
                    value={loading ? "--" : String(activeAlerts).padStart(2, "0")}
                    subtitle={`${stats.critical_alerts || 0} Critical · ${stats.high_alerts || 0} High`}
                    icon={AlertTriangle}
                    alert={activeAlerts > 0}
                    active={activeAlerts > 0}
                />

                {/* 3. Assets Monitored */}
                <StatCard
                    title="Assets Monitored"
                    value={loading ? "--" : String(websiteCount || 1).padStart(2, "0")}
                    subtitle="Protected Domains"
                    icon={Globe}
                />

                {/* 4. Threats Blocked 24h */}
                <StatCard
                    title="Threats Blocked 24h"
                    value={loading ? "--" : String(stats.total_alerts || 0)}
                    subtitle="Auto Intercepted"
                    icon={Ban}
                />

                {/* 5. Vulnerabilities / Scans */}
                <StatCard
                    title="Vulnerabilities"
                    value={loading ? "--" : String(stats.critical_alerts || 0)}
                    subtitle={`${scanCount} Completed Scans`}
                    icon={ShieldCheck}
                />
            </div>

            {/* Row 2: Telemetry Wave Area Chart */}
            <div className="w-full">
                <ThreatChart />
            </div>

            {/* Row 3: Live Threat Activity Table */}
            <div className="w-full">
                <LiveAttackFeed />
            </div>
        </div>
    );
}

export default Dashboard;
