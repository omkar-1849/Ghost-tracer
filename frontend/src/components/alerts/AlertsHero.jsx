import { useRef } from "react";
import {
    CalendarRange,
    Check,
    ChevronDown,
    Download,
    RotateCw,
    Search,
    ShieldCheck,
    SlidersHorizontal,
    Siren,
    X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Filter model shared with the page                                   */
/* ------------------------------------------------------------------ */

export const SEVERITY_FILTERS = [
    { key: "ALL", label: "All severities" },
    { key: "CRITICAL", label: "Critical" },
    { key: "HIGH", label: "High" },
    { key: "MEDIUM", label: "Medium" },
    { key: "LOW", label: "Low" },
];

export const STATUS_FILTERS = [
    { key: "ALL", label: "All states" },
    { key: "OPEN", label: "Open" },
    { key: "RESOLVED", label: "Resolved" },
];

/**
 * AlertsHero
 * ----------
 * Top control band: title + subtitle, live search, refresh, an inline
 * filter drawer (accordion — not a popup), and an export placeholder.
 */
function AlertsHero({
    query,
    onQueryChange,
    filters,
    onFiltersChange,
    refreshing,
    onRefresh,
    exporting,
    onExport,
    syncedAt,
    total,
    searchRef,
}) {
    const localRef = useRef(null);
    const inputRef = searchRef ?? localRef;
    const filterOpen = filters.open;

    const activeFilterCount = [filters.severity, filters.status].filter(
        (value) => value && value !== "ALL"
    ).length;

    return (
        <header
            className="alerts-enter alerts-hero-border relative rounded-[2rem] border border-white/10 bg-slate-900/45 px-6 py-8 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.75),0_0_0_1px_rgba(148,163,184,0.05)] sm:px-10 sm:py-9"
            style={{ animationDelay: "60ms" }}
        >
            {/* Frosted sheen */}
            <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-b from-white/[0.07] via-white/[0.02] to-transparent" />

            {/* Soft glow behind the title cluster */}
            <div
                className="pointer-events-none absolute -top-24 left-8 h-56 w-96 rounded-full opacity-30"
                style={{
                    background:
                        "radial-gradient(closest-side, rgba(244,63,94,0.28), transparent 100%)",
                    filter: "blur(50px)",
                }}
            />

            <div className="relative z-10">
                {/* Top row: eyebrow + LIVE badge + utilities */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-1 text-[10px] font-bold tracking-[0.22em] text-rose-300">
                            <Siren size={12} />
                            INCIDENT RESPONSE
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
                        {/* Refresh */}
                        <button
                            type="button"
                            onClick={onRefresh}
                            title="Refresh incident queue"
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

                        {/* Filters */}
                        <button
                            type="button"
                            onClick={() =>
                                onFiltersChange({ ...filters, open: !filterOpen })
                            }
                            aria-expanded={filterOpen}
                            className={`relative flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold backdrop-blur-xl transition-all duration-300 ${
                                filterOpen
                                    ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.3)]"
                                    : "border-white/10 bg-slate-950/50 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300"
                            }`}
                        >
                            <SlidersHorizontal size={14} />
                            Filters
                            {activeFilterCount > 0 && (
                                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 px-1 text-[9px] font-bold text-white">
                                    {activeFilterCount}
                                </span>
                            )}
                            <ChevronDown
                                size={12}
                                className={`transition-transform duration-300 ${
                                    filterOpen ? "rotate-180" : ""
                                }`}
                            />
                        </button>

                        {/* Export (UI only) */}
                        <button
                            type="button"
                            onClick={onExport}
                            title="Export incident report"
                            className="relative flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/50 px-3.5 py-2 text-xs font-semibold text-slate-300 backdrop-blur-xl transition-all duration-300 hover:border-amber-400/40 hover:text-amber-300 hover:shadow-[0_0_16px_rgba(251,191,36,0.35)]"
                        >
                            {exporting ? (
                                <>
                                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
                                    Preparing…
                                </>
                            ) : (
                                <>
                                    <Download size={14} />
                                    Export
                                    <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-slate-500">
                                        UI
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Title cluster + search */}
                <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                            <span className="bg-gradient-to-r from-rose-400 via-red-400 to-amber-300 bg-clip-text text-transparent">
                                Incident Center
                            </span>
                        </h1>

                        <p className="mt-2.5 text-sm leading-relaxed text-slate-400 sm:text-[15px]">
                            Monitor, investigate and respond to security incidents
                            in real time.
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1.5">
                                <CalendarRange size={13} className="text-slate-600" />
                                Window:{" "}
                                <span className="font-semibold text-slate-300">
                                    Last 24 hours
                                </span>
                            </span>
                            <span className="text-slate-700">•</span>
                            <span>
                                <span className="font-semibold text-slate-300">
                                    {total}
                                </span>{" "}
                                incidents tracked
                            </span>
                            <span className="text-slate-700">•</span>
                            <span>
                                Synced{" "}
                                <span className="font-mono text-slate-400">
                                    {syncedAt}
                                </span>
                            </span>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="alerts-search group relative w-full max-w-md">
                        <Search
                            size={16}
                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors duration-300 group-focus-within:text-cyan-300"
                        />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(event) => onQueryChange(event.target.value)}
                            placeholder="Search incidents, IPs, attack types…"
                            className="w-full rounded-full border border-white/10 bg-slate-950/50 py-2.5 pl-11 pr-14 text-sm text-slate-200 placeholder-slate-500 backdrop-blur-xl outline-none transition-colors duration-300 focus:placeholder-slate-400"
                            onKeyDown={(event) => {
                                if (event.key === "Escape" && query) {
                                    onQueryChange("");
                                }
                            }}
                        />
                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                            {query ? (
                                <button
                                    type="button"
                                    onClick={() => onQueryChange("")}
                                    title="Clear search"
                                    className="pointer-events-auto flex h-5 w-5 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/10 hover:text-white"
                                >
                                    <X size={12} />
                                </button>
                            ) : (
                                <kbd className="hidden rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-slate-500 sm:block">
                                    /
                                </kbd>
                            )}
                        </span>
                    </div>
                </div>

                {/* Inline filter drawer (accordion inside the hero) */}
                <div
                    className={`grid transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        filterOpen ? "mt-5 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                >
                    <div className="overflow-hidden">
                        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 backdrop-blur-xl sm:p-5">
                            <div className="grid gap-5 md:grid-cols-2">
                                {/* Severity */}
                                <div>
                                    <p className="mb-2.5 text-[10px] font-bold tracking-[0.22em] text-slate-500">
                                        SEVERITY
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {SEVERITY_FILTERS.map((option) => {
                                            const active =
                                                (filters.severity ?? "ALL") === option.key;
                                            return (
                                                <button
                                                    key={option.key}
                                                    type="button"
                                                    onClick={() =>
                                                        onFiltersChange({
                                                            ...filters,
                                                            severity: option.key,
                                                        })
                                                    }
                                                    className={`alerts-chip rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all duration-300 ${
                                                        active
                                                            ? "alerts-chip--active border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                                                            : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
                                                    }`}
                                                >
                                                    {active && (
                                                        <Check size={11} className="mr-1 inline -translate-y-px" />
                                                    )}
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Status */}
                                <div>
                                    <p className="mb-2.5 text-[10px] font-bold tracking-[0.22em] text-slate-500">
                                        STATUS
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {STATUS_FILTERS.map((option) => {
                                            const active =
                                                (filters.status ?? "ALL") === option.key;
                                            return (
                                                <button
                                                    key={option.key}
                                                    type="button"
                                                    onClick={() =>
                                                        onFiltersChange({
                                                            ...filters,
                                                            status: option.key,
                                                        })
                                                    }
                                                    className={`alerts-chip rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all duration-300 ${
                                                        active
                                                            ? "alerts-chip--active border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                                                            : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
                                                    }`}
                                                >
                                                    {active && (
                                                        <Check size={11} className="mr-1 inline -translate-y-px" />
                                                    )}
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/5 pt-3.5">
                                <p className="text-[11px] text-slate-500">
                                    Filters apply instantly to the incident queue.
                                </p>
                                <button
                                    type="button"
                                    onClick={() =>
                                        onFiltersChange({
                                            ...filters,
                                            severity: "ALL",
                                            status: "ALL",
                                        })
                                    }
                                    className="text-[11px] font-semibold text-cyan-300 transition-colors hover:text-cyan-200"
                                >
                                    Clear all
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Brand flourish */}
            <div className="absolute bottom-4 right-6 z-10 hidden items-center gap-2 text-[10px] font-semibold tracking-[0.25em] text-slate-600 lg:flex">
                <ShieldCheck size={12} className="text-rose-500/70" />
                SENTINEL AI · SOC INCIDENT CENTER
            </div>
        </header>
    );
}

export default AlertsHero;
