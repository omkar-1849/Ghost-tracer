import { useEffect, useState } from "react";
import { Bug, Globe, Radar, Target, RefreshCw } from "lucide-react";

/* Existing intelligence widgets (logic untouched). */
import TopAttackingIPs from "../components/TopAttackingIPs";
import TopTargetedURLs from "../components/TopTargetedURLs";
import ThreatDistribution from "../components/ThreatDistribution";
import AttackTypes from "../components/AttackTypes";
import LiveDot from "../components/ui/LiveDot";

import { getDashboardStats } from "../services/api";

function Analytics() {
    const [stats, setStats] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const data = await getDashboardStats();
                setStats(data);
            } catch (err) {
                console.error(err);
            }
        }
        load();
        const interval = setInterval(load, 5000);
        return () => clearInterval(interval);
    }, []);

    async function handleRefresh() {
        setRefreshing(true);
        try {
            const data = await getDashboardStats();
            setStats(data);
        } catch (err) {
            console.error(err);
        } finally {
            setRefreshing(false);
        }
    }

    return (
        <div className="p-6 max-w-[1440px]">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
                        Threat Analytics
                    </h1>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        Attack surface analysis and threat intelligence
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Live badge */}
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-semibold text-[var(--color-success)] bg-[rgba(63,163,77,0.08)] border border-[rgba(63,163,77,0.20)]">
                        <LiveDot color="var(--color-success)" size={5} />
                        AUTO-REFRESH
                    </span>

                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="p-2 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
                        aria-label="Refresh"
                    >
                        <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* KPI strip */}
            {stats && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg px-4 py-3">
                        <p className="text-xs text-[var(--color-text-muted)]">Detections</p>
                        <p className="text-xl font-bold tabular-nums text-[var(--color-text-primary)] mt-0.5">
                            {(stats.total_logs ?? 0).toLocaleString()}
                        </p>
                    </div>
                    <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg px-4 py-3">
                        <p className="text-xs text-[var(--color-text-muted)]">Critical Alerts</p>
                        <p className="text-xl font-bold tabular-nums text-[var(--color-critical)] mt-0.5">
                            {stats.critical_alerts ?? 0}
                        </p>
                    </div>
                    <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg px-4 py-3">
                        <p className="text-xs text-[var(--color-text-muted)]">High Alerts</p>
                        <p className="text-xl font-bold tabular-nums text-[var(--color-high)] mt-0.5">
                            {stats.high_alerts ?? 0}
                        </p>
                    </div>
                </div>
            )}

            {/* Intelligence grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Source IPs — wide */}
                <div className="lg:col-span-2 bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-5 shadow-[var(--shadow-1)]">
                    <div className="flex items-center gap-2 mb-4">
                        <Globe size={15} className="text-[var(--color-text-muted)]" />
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Top Attacking IPs</h3>
                    </div>
                    <TopAttackingIPs />
                </div>

                {/* Threat Distribution — narrow */}
                <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-5 shadow-[var(--shadow-1)]">
                    <div className="flex items-center gap-2 mb-4">
                        <Radar size={15} className="text-[var(--color-text-muted)]" />
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Threat Distribution</h3>
                    </div>
                    <ThreatDistribution />
                </div>

                {/* Attack Types — wide */}
                <div className="lg:col-span-2 bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-5 shadow-[var(--shadow-1)]">
                    <div className="flex items-center gap-2 mb-4">
                        <Bug size={15} className="text-[var(--color-text-muted)]" />
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Attack Types</h3>
                    </div>
                    <AttackTypes />
                </div>

                {/* Targeted URLs — narrow */}
                <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-5 shadow-[var(--shadow-1)]">
                    <div className="flex items-center gap-2 mb-4">
                        <Target size={15} className="text-[var(--color-text-muted)]" />
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Top Targeted URLs</h3>
                    </div>
                    <TopTargetedURLs />
                </div>
            </div>
        </div>
    );
}

export default Analytics;
