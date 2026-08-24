import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/* Existing intelligence widgets (logic untouched). */
import TopAttackingIPs from "../components/TopAttackingIPs";
import TopTargetedURLs from "../components/TopTargetedURLs";
import ThreatDistribution from "../components/ThreatDistribution";
import AttackTypes from "../components/AttackTypes";
import LiveDot from "../components/ui/LiveDot";

import { getDashboardStats } from "../services/api";

/* ------------------------------------------------------------------ */
/* Composition helpers — shared with the Dashboard's language          */
/* ------------------------------------------------------------------ */

function SectionHeading({ label, title, className = "" }) {
    return (
        <div className={`flex items-baseline gap-3 ${className}`}>
            <p className="section-label shrink-0">{label}</p>
            <div className="h-px flex-1 bg-[var(--color-border-subtle)]" aria-hidden="true" />
            {title && (
                <p className="text-[11px] text-[var(--color-text-muted)] shrink-0">{title}</p>
            )}
        </div>
    );
}

/* One analytical surface — related analyses share a single panel and
   are separated by a hairline, not by independent card borders. */
function WorkSurface({ children, className = "" }) {
    return (
        <div
            className={`bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg shadow-[var(--shadow-1)] ${className}`}
        >
            {children}
        </div>
    );
}

function SurfaceTitle({ title, hint }) {
    return (
        <div className="flex items-baseline justify-between gap-3 mb-2">
            <h3 className="card-title">{title}</h3>
            {hint && <p className="text-[11px] text-[var(--color-text-muted)]">{hint}</p>}
        </div>
    );
}

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
            <div className="flex items-start justify-between gap-4 mb-8">
                <div>
                    <p className="section-label mb-1.5">Intelligence</p>
                    <h1 className="page-title">
                        Threat Analytics
                    </h1>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        Attack surface analysis and threat intelligence
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-semibold text-[var(--color-success)] bg-[rgba(85,176,123,0.08)] border border-[rgba(85,176,123,0.20)]">
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

            {/* Volume readout — typography on the canvas, not cards */}
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4 pb-7">
                <div>
                    <p className="section-label mb-1">Detections</p>
                    <p className="metric-value text-[34px] leading-none">
                        {stats ? (stats.total_logs ?? 0).toLocaleString() : "—"}
                    </p>
                </div>
                <div className="hidden sm:block w-px self-stretch bg-[var(--color-border-subtle)]" aria-hidden="true" />
                <div>
                    <p className="section-label mb-1 text-[var(--color-critical)]">Critical alerts</p>
                    <p className="metric-value text-[34px] leading-none text-[var(--color-critical)]">
                        {stats ? (stats.critical_alerts ?? 0).toLocaleString() : "—"}
                    </p>
                </div>
                <div className="hidden sm:block w-px self-stretch bg-[var(--color-border-subtle)]" aria-hidden="true" />
                <div>
                    <p className="section-label mb-1 text-[var(--color-high)]">High alerts</p>
                    <p className="metric-value text-[34px] leading-none text-[var(--color-high)]">
                        {stats ? (stats.high_alerts ?? 0).toLocaleString() : "—"}
                    </p>
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed max-w-[240px] sm:ml-auto sm:text-right">
                    Live counts from the monitoring engine — refreshed every 5 seconds.
                </p>
            </div>

            {/* Threat sources — one surface: ranked origins + classification mix */}
            <SectionHeading label="Threat Sources" title="Origin IPs & classification mix" className="mb-3" />
            <WorkSurface className="p-5 mb-8">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_1px_minmax(0,2fr)]">
                    <div className="min-w-0">
                        <SurfaceTitle title="Top Attacking IPs" hint="by attack volume" />
                        <TopAttackingIPs />
                    </div>
                    <div className="hidden lg:block bg-[var(--color-border-subtle)]" aria-hidden="true" />
                    <div className="min-w-0">
                        <SurfaceTitle title="Threat Distribution" hint="event mix" />
                        <ThreatDistribution />
                    </div>
                </div>
            </WorkSurface>

            {/* Vectors & targets — one surface: what hits us, and where */}
            <SectionHeading label="Vectors & Targets" title="Attack patterns & exposed endpoints" className="mb-3" />
            <WorkSurface className="p-5">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_1px_minmax(0,2fr)]">
                    <div className="min-w-0">
                        <SurfaceTitle title="Attack Types" hint="severity-graded" />
                        <AttackTypes />
                    </div>
                    <div className="hidden lg:block bg-[var(--color-border-subtle)]" aria-hidden="true" />
                    <div className="min-w-0">
                        <SurfaceTitle title="Top Targeted URLs" hint="most-hit endpoints" />
                        <TopTargetedURLs />
                    </div>
                </div>
            </WorkSurface>
        </div>
    );
}

export default Analytics;
