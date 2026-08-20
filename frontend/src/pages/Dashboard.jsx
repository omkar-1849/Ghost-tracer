import { useEffect, useState } from "react";

import ThreatChart from "../components/ThreatChart";
import Navbar from "../components/Navbar";
import StatCard from "../components/StatCard";
import RecentAlerts from "../components/RecentAlerts";
import RecentLogs from "../components/RecentLogs";
import SecurityScore from "../components/SecurityScore";
import LiveAttackFeed from "../components/LiveAttackFeed";
import TopAttackingIPs from "../components/TopAttackingIPs";
import TopTargetedURLs from "../components/TopTargetedURLs";
import AttackTypes from "../components/AttackTypes";
import ThreatDistribution from "../components/ThreatDistribution";

import { getDashboardStats } from "../services/api";

import {
    Database,
    TriangleAlert,
    ShieldAlert,
    Shield,
} from "lucide-react";

function Dashboard() {
    const [stats, setStats] = useState({
        total_logs: 0,
        total_alerts: 0,
        critical_alerts: 0,
        high_alerts: 0,
    });

    useEffect(() => {
        async function loadStats() {
            try {
                const data = await getDashboardStats();
                setStats(data);
            } catch (error) {
                console.error(error);
            }
        }

        loadStats();

        const interval = setInterval(loadStats, 5000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="p-6 max-w-[1440px]">
            <Navbar />

            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Logs"
                    value={stats.total_logs}
                    icon={Database}
                />
                <StatCard
                    title="Alerts"
                    value={stats.total_alerts}
                    icon={TriangleAlert}
                />
                <StatCard
                    title="Critical"
                    value={stats.critical_alerts}
                    icon={ShieldAlert}
                />
                <StatCard
                    title="High Threats"
                    value={stats.high_alerts}
                    icon={Shield}
                />
            </div>

            {/* Threat Activity + Recent Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
                <div className="lg:col-span-2">
                    <ThreatChart />
                </div>
                <RecentAlerts />
            </div>

            {/* Security Score + Recent Logs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
                <SecurityScore stats={stats} />
                <div className="lg:col-span-2">
                    <RecentLogs />
                </div>
            </div>

            {/* Live Attack Feed */}
            <div className="mt-6">
                <LiveAttackFeed />
            </div>

            {/* Analytical breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-5 shadow-[var(--shadow-1)]">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Top Attacking IPs</h3>
                    <TopAttackingIPs />
                </div>
                <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-5 shadow-[var(--shadow-1)]">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Top Targeted URLs</h3>
                    <TopTargetedURLs />
                </div>
                <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-5 shadow-[var(--shadow-1)]">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Threat Distribution</h3>
                    <ThreatDistribution />
                </div>
            </div>

            {/* Attack Types */}
            <div className="mt-6">
                <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-5 shadow-[var(--shadow-1)]">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Attack Types</h3>
                    <AttackTypes />
                </div>
            </div>
        </div>
    );
}

export default Dashboard;