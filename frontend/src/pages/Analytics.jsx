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
            className={`sentinel-glass rounded-2xl ${className}`}
        >
            {children}
        </div>
    );
}

function SurfaceTitle({ title, hint }) {
    return (
        <div className="flex items-baseline justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-[#F5F1EC]">{title}</h3>
            {hint && <p className="text-[11px] text-[#9E948A]">{hint}</p>}
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
        <div className="sentinel-page space-y-6 animate-fade-in select-none">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                    <p className="text-[11px] font-semibold tracking-wider uppercase text-[#D3A06A] mb-1.5">Intelligence</p>
                    <h1 className="text-2xl font-bold tracking-tight text-[#F5F1EC]">
                        Threat Analytics
                    </h1>
                    <p className="text-xs text-[#9E948A] mt-1">
                        Attack surface analysis and threat intelligence
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-semibold text-[#77C79A] bg-[rgba(119,199,154,0.10)] border border-[rgba(119,199,154,0.22)] shadow-[0_2px_8px_rgba(0,0,0,0.25)]">
                        <LiveDot color="#77C79A" size={5} />
                        AUTO-REFRESH
                    </span>

                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[#D6CFC7] hover:bg-white/10 hover:text-[#F5F1EC] transition-all disabled:opacity-50"
                        aria-label="Refresh"
                    >
                        <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* Volume readout — glass container with tabular mono numerals */}
            <div className="sentinel-glass p-6 rounded-2xl flex flex-wrap items-center gap-x-10 gap-y-4">
                <div>
                    <p className="text-[10px] font-semibold tracking-wider uppercase text-[#9E948A] mb-1">Detections</p>
                    <p className="font-mono text-3xl font-bold tracking-tight leading-none text-[#F5F1EC]">
                        {stats ? (stats.total_logs ?? 0).toLocaleString() : "—"}
                    </p>
                </div>
                <div className="hidden sm:block w-px self-stretch bg-white/10" aria-hidden="true" />
                <div>
                    <p className="text-[10px] font-semibold tracking-wider uppercase text-[#FF8585] mb-1">Critical alerts</p>
                    <p className="font-mono text-3xl font-bold tracking-tight leading-none text-[#FF8585]">
                        {stats ? (stats.critical_alerts ?? 0).toLocaleString() : "—"}
                    </p>
                </div>
                <div className="hidden sm:block w-px self-stretch bg-white/10" aria-hidden="true" />
                <div>
                    <p className="text-[10px] font-semibold tracking-wider uppercase text-[#E5B374] mb-1">High alerts</p>
                    <p className="font-mono text-3xl font-bold tracking-tight leading-none text-[#E5B374]">
                        {stats ? (stats.high_alerts ?? 0).toLocaleString() : "—"}
                    </p>
                </div>
                <p className="text-[11px] text-[#9E948A] leading-relaxed max-w-[240px] sm:ml-auto sm:text-right">
                    Live counts from the monitoring engine — refreshed every 5 seconds.
                </p>
            </div>

            {/* Threat sources — one surface: ranked origins + classification mix */}
            <SectionHeading label="Threat Sources" title="Origin IPs & classification mix" className="mb-2" />
            <WorkSurface className="p-6 mb-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_1px_minmax(0,2fr)]">
                    <div className="min-w-0">
                        <SurfaceTitle title="Top Attacking IPs" hint="by attack volume" />
                        <TopAttackingIPs />
                    </div>
                    <div className="hidden lg:block bg-white/10" aria-hidden="true" />
                    <div className="min-w-0">
                        <SurfaceTitle title="Threat Distribution" hint="event mix" />
                        <ThreatDistribution />
                    </div>
                </div>
            </WorkSurface>

            {/* Vectors & targets — one surface: what hits us, and where */}
            <SectionHeading label="Vectors & Targets" title="Attack patterns & exposed endpoints" className="mb-2" />
            <WorkSurface className="p-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_1px_minmax(0,2fr)]">
                    <div className="min-w-0">
                        <SurfaceTitle title="Attack Types" hint="severity-graded" />
                        <AttackTypes />
                    </div>
                    <div className="hidden lg:block bg-white/10" aria-hidden="true" />
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
