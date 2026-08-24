import { useRef } from "react";
import {
    CalendarRange,
    ChevronDown,
    Download,
    RotateCw,
    Search,
    SlidersHorizontal,
    Siren,
    X,
} from "lucide-react";
import LiveDot from "../ui/LiveDot";

const SEVERITY_FILTERS = [
    { key: "ALL", label: "All severities" },
    { key: "CRITICAL", label: "Critical" },
    { key: "HIGH", label: "High" },
    { key: "MEDIUM", label: "Medium" },
    { key: "LOW", label: "Low" },
];

const STATUS_FILTERS = [
    { key: "ALL", label: "All states" },
    { key: "OPEN", label: "Open" },
    { key: "RESOLVED", label: "Resolved" },
];

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
        <header className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-5 shadow-[var(--shadow-1)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Left: Eyebrow + Live Indicator */}
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-semibold bg-[rgba(223,91,91,0.10)] border border-[rgba(223,91,91,0.25)] text-[var(--color-critical)]">
                        <Siren size={12} />
                        INCIDENT RESPONSE
                    </span>

                    <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-semibold bg-[rgba(85,176,123,0.10)] border border-[rgba(85,176,123,0.25)] text-[var(--color-success)]">
                        <LiveDot color="var(--color-success)" size={5} />
                        LIVE
                    </span>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={refreshing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-surface-1)] border border-[var(--color-border-default)] text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors disabled:opacity-50"
                        aria-label="Refresh alerts queue"
                    >
                        <RotateCw size={13} className={refreshing ? "animate-spin text-[var(--color-accent)]" : ""} />
                        <span>Refresh</span>
                    </button>

                    <button
                        type="button"
                        onClick={onExport}
                        disabled={exporting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-surface-1)] border border-[var(--color-border-default)] text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors disabled:opacity-50"
                        aria-label="Export incident report"
                    >
                        <Download size={13} />
                        <span>{exporting ? "Exporting…" : "Export"}</span>
                    </button>
                </div>
            </div>

            {/* Main title + subtitle */}
            <div className="mt-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="page-title">
                        Incident Center
                    </h1>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        Real-time threat triage, forensic correlation, and incident response workstation.
                    </p>
                </div>

                {/* Metadata counter & sync */}
                <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1.5">
                        <CalendarRange size={13} className="text-[var(--color-text-muted)]" />
                        <span className="mono-value">Synced {syncedAt}</span>
                    </span>
                    <span className="text-[var(--color-text-disabled)]">·</span>
                    <span>
                        <strong className="text-[var(--color-text-primary)] font-semibold tabular-nums">{total}</strong> incidents recorded
                    </span>
                </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="mt-4 pt-4 border-t border-[var(--color-border-subtle)] flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                {/* Search input */}
                <div className="relative flex-1">
                    <Search
                        size={14}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                    />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => onQueryChange(e.target.value)}
                        placeholder="Search incidents by title, IP address, rule, or technique (Press '/' to focus)…"
                        className="w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] py-2 pl-9 pr-8 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] transition-colors focus:border-[var(--color-signal)] focus:outline-none focus:ring-1 focus:ring-[var(--color-signal-strong)]"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => onQueryChange("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                        >
                            <X size={13} />
                        </button>
                    )}
                </div>

                {/* Filter toggle */}
                <button
                    type="button"
                    onClick={() => onFiltersChange({ ...filters, open: !filterOpen })}
                    className={`inline-flex items-center justify-between gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                        activeFilterCount > 0
                            ? "bg-[var(--color-signal-subtle)] border-[var(--color-signal-strong)] text-[var(--color-signal-readable)]"
                            : "bg-[var(--color-surface-1)] border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]"
                    }`}
                >
                    <span className="flex items-center gap-1.5">
                        <SlidersHorizontal size={13} />
                        <span>Filters</span>
                        {activeFilterCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[var(--color-signal)] text-[var(--color-canvas)]">
                                {activeFilterCount}
                            </span>
                        )}
                    </span>
                    <ChevronDown size={13} className={`transition-transform duration-150 ${filterOpen ? "rotate-180" : ""}`} />
                </button>
            </div>

            {/* Filter Drawer */}
            {filterOpen && (
                <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)] grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <span className="block text-[11px] font-medium text-[var(--color-text-muted)] mb-1.5 uppercase tracking-wider">
                            Filter by Severity
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                            {SEVERITY_FILTERS.map((item) => {
                                const active = filters.severity === item.key;
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => onFiltersChange({ ...filters, severity: item.key })}
                                        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                            active
                                                ? "bg-[var(--color-signal-subtle)] text-[var(--color-signal-readable)] font-semibold border border-[var(--color-signal-strong)]"
                                                : "bg-[var(--color-surface-1)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                                        }`}
                                    >
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <span className="block text-[11px] font-medium text-[var(--color-text-muted)] mb-1.5 uppercase tracking-wider">
                            Filter by Status
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                            {STATUS_FILTERS.map((item) => {
                                const active = filters.status === item.key;
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => onFiltersChange({ ...filters, status: item.key })}
                                        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                            active
                                                ? "bg-[var(--color-signal-subtle)] text-[var(--color-signal-readable)] font-semibold border border-[var(--color-signal-strong)]"
                                                : "bg-[var(--color-surface-1)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                                        }`}
                                    >
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}

export default AlertsHero;
