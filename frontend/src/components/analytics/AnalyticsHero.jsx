import { useEffect, useState } from "react";
import {
    Activity,
    CalendarRange,
    Clock,
    Download,
    RotateCw,
    ShieldCheck,
    Siren,
    Skull,
    Zap,
} from "lucide-react";

import { getDashboardStats } from "../../services/api";

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

const TIME_RANGES = [
    { key: "24h", label: "24H", caption: "Last 24 hours" },
    { key: "7d", label: "7D", caption: "Last 7 days" },
    { key: "30d", label: "30D", caption: "Last 30 days" },
];

const KPI_DEFS = [
    {
        key: "total_alerts",
        label: "Detections",
        icon: Zap,
        valueClass: "text-amber-300",
        dotClass: "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)]",
        caption: "Total alerts captured",
    },
    {
        key: "critical_alerts",
        label: "Critical",
        icon: Skull,
        valueClass: "text-red-400",
        dotClass: "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)]",
        caption: "Immediate investigation",
    },
    {
        key: "high_alerts",
        label: "High",
        icon: Siren,
        valueClass: "text-orange-300",
        dotClass: "bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.9)]",
        caption: "Elevated risk detected",
    },
];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

function AnalyticsHero() {
    const [range, setRange] = useState("24h");
    const [stats, setStats] = useState({
        total_alerts: 0,
        critical_alerts: 0,
        high_alerts: 0,
    });
    const [syncedAt, setSyncedAt] = useState(() => new Date());
    const [refreshing, setRefreshing] = useState(false);
    const [exporting, setExporting] = useState(false);

    /* Live stats polling (5s) — same pattern as the rest of the app. */
    useEffect(() => {
        async function loadStats() {
            try {
                const data = await getDashboardStats();
                setStats((prev) => ({ ...prev, ...data }));
                setSyncedAt(new Date());
            } catch (error) {
                console.error(error);
            }
        }

        loadStats();

        const interval = setInterval(loadStats, 5000);

        return () => clearInterval(interval);
    }, []);

    const activeRange = TIME_RANGES.find((r) => r.key === range);

    function handleRefresh() {
        if (refreshing) return;
        setRefreshing(true);
        window.setTimeout(() => {
            setSyncedAt(new Date());
            setRefreshing(false);
        }, 900);
    }

    function handleExport() {
        if (exporting) return;
        setExporting(true);
        window.setTimeout(() => setExporting(false), 1300);
    }

    return (
        <header
            className="analytics-enter analytics-hero-border relative rounded-[2rem] border border-white/10 bg-slate-900/45 px-6 py-8 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.75),0_0_0_1px_rgba(148,163,184,0.05)] sm:px-10 sm:py-10"
            style={{ animationDelay: "60ms" }}
        >
            {/* Frosted sheen */}
            <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-b from-white/[0.07] via-white/[0.02] to-transparent" />

            {/* Soft glow behind the title cluster */}
            <div
                className="pointer-events-none absolute -top-24 left-8 h-56 w-96 rounded-full opacity-30"
                style={{
                    background:
                        "radial-gradient(closest-side, rgba(34,211,238,0.35), transparent 100%)",
                    filter: "blur(50px)",
                }}
            />

            <div className="relative z-10">
                {/* Top row: eyebrow + LIVE badge */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold tracking-[0.22em] text-cyan-300">
                            <Activity size={12} />
                            SECURITY INTELLIGENCE
                        </span>

                        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold tracking-[0.22em] text-emerald-400">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            </span>
                            LIVE
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Time range selector */}
                        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/50 p-1 backdrop-blur-xl">
                            <CalendarRange
                                size={14}
                                className="ml-2 text-slate-500"
                            />
                            {TIME_RANGES.map((r) => (
                                <button
                                    key={r.key}
                                    type="button"
                                    title={r.caption}
                                    onClick={() => setRange(r.key)}
                                    className={`rounded-full px-3 py-1.5 text-xs font-bold tracking-wide transition-all duration-300 ${
                                        range === r.key
                                            ? "bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white shadow-[0_0_16px_rgba(59,130,246,0.45)]"
                                            : "text-slate-400 hover:text-white hover:bg-white/5"
                                    }`}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>

                        {/* Refresh */}
                        <button
                            type="button"
                            onClick={handleRefresh}
                            title="Refresh intelligence"
                            className="group relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-slate-950/50 text-slate-300 backdrop-blur-xl transition-all duration-300 hover:scale-105 hover:border-cyan-400/40 hover:text-cyan-300 hover:shadow-[0_0_16px_rgba(34,211,238,0.35)]"
                        >
                            <RotateCw
                                size={16}
                                className={`transition-transform duration-500 ${
                                    refreshing
                                        ? "animate-spin text-cyan-300"
                                        : "group-hover:rotate-180"
                                }`}
                            />
                        </button>

                        {/* Export (placeholder) */}
                        <button
                            type="button"
                            onClick={handleExport}
                            title="Export intelligence report"
                            className="relative flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/50 px-3.5 py-2 text-xs font-semibold text-slate-300 backdrop-blur-xl transition-all duration-300 hover:border-indigo-400/40 hover:text-indigo-300 hover:shadow-[0_0_16px_rgba(129,140,248,0.35)]"
                        >
                            {exporting ? (
                                <>
                                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-300 border-t-transparent" />
                                    Preparing…
                                </>
                            ) : (
                                <>
                                    <Download size={14} />
                                    Export
                                    <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-slate-500">
                                        SOON
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Title cluster */}
                <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                            <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                                Threat Intelligence
                            </span>
                        </h1>

                        <p className="mt-2.5 text-sm leading-relaxed text-slate-400 sm:text-[15px]">
                            Correlated detection analytics across your monitored
                            surface. Review attacker origins, targeted assets and
                            campaign patterns to guide your investigation queue.
                        </p>

                        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                            <Clock size={13} className="text-slate-600" />
                            <span>
                                Window:{" "}
                                <span className="font-semibold text-slate-300">
                                    {activeRange.caption}
                                </span>
                            </span>
                            <span className="text-slate-700">•</span>
                            <span>
                                Synced{" "}
                                <span className="font-mono text-slate-400">
                                    {syncedAt.toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        second: "2-digit",
                                    })}
                                </span>
                            </span>
                        </div>
                    </div>

                    {/* Compact live KPIs */}
                    <div className="flex flex-wrap items-center gap-3">
                        {KPI_DEFS.map((kpi) => {
                            const Icon = kpi.icon;
                            const value = Number(stats[kpi.key]) || 0;

                            return (
                                <div
                                    key={kpi.key}
                                    title={kpi.caption}
                                    className="group/kpi relative flex min-w-[7.5rem] items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20"
                                >
                                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-800/60 transition-transform duration-300 group-hover/kpi:scale-110">
                                        <Icon
                                            size={16}
                                            className={kpi.valueClass}
                                        />
                                    </span>

                                    <span className="leading-tight">
                                        <span
                                            className={`block text-lg font-bold tabular-nums ${kpi.valueClass}`}
                                        >
                                            {value.toLocaleString()}
                                        </span>
                                        <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                            {kpi.label}
                                        </span>
                                    </span>

                                    <span
                                        className={`absolute right-2 top-2 h-1 w-1 rounded-full ${kpi.dotClass}`}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Brand flourish */}
            <div className="absolute bottom-4 right-6 z-10 hidden items-center gap-2 text-[10px] font-semibold tracking-[0.25em] text-slate-600 lg:flex">
                <ShieldCheck size={12} className="text-cyan-500/70" />
                SENTINEL AI · SOC ANALYTICS
            </div>
        </header>
    );
}

export default AnalyticsHero;
