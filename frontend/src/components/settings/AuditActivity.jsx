import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Activity, AlertTriangle, CalendarRange, ChevronDown, ChevronLeft, ChevronRight,
    Filter, RefreshCw, Search, ShieldCheck, SlidersHorizontal, X,
} from "lucide-react";
import { getAuditLogs } from "../../services/auditLogApi";

const PAGE_SIZE = 20;
const REQUEST_LIMIT = 100;

const EMPTY_FILTERS = {
    search: "",
    action: "",
    resourceType: "",
    userId: "",
    from: "",
    to: "",
};

function displayAction(action) {
    return (action || "System event").replaceAll("_", " ").toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayResource(log) {
    if (!log.resource_type) return "Platform";
    const type = log.resource_type.replaceAll("_", " ").toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
    return log.resource_id ? `${type} · ${log.resource_id}` : type;
}

function parseTimestamp(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatTimestamp(value) {
    const date = parseTimestamp(value);
    if (!date) return "Unknown time";

    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
}

function formatExactTimestamp(value) {
    const date = parseTimestamp(value);
    if (!date) return "Unavailable";

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "medium",
    }).format(date);
}

function initialFilters(logs, field) {
    return [...new Set(logs.map((log) => log[field]).filter(Boolean))].sort();
}

function DetailItem({ label, value, mono = false, wide = false }) {
    return (
        <div className={wide ? "sm:col-span-2" : ""}>
            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
            <dd className={`mt-1 text-sm leading-relaxed text-slate-200 break-words ${mono ? "font-mono text-xs text-slate-300" : ""}`}>
                {value || "—"}
            </dd>
        </div>
    );
}

function AuditRow({ log, isExpanded, onToggle }) {
    const detailsId = `audit-log-details-${log.id}`;

    return (
        <li className="border-b border-slate-800/80 last:border-b-0">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={isExpanded}
                aria-controls={detailsId}
                className="group w-full px-5 py-4 text-left transition-colors duration-200 hover:bg-slate-900/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-400/70"
            >
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(8rem,0.7fr)_auto] sm:items-center">
                    <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full bg-purple-400/90 shadow-[0_0_10px_rgba(192,132,252,0.55)]" aria-hidden="true" />
                        <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-sm font-semibold text-white">{displayAction(log.action)}</span>
                                <span className="hidden rounded border border-slate-700/70 bg-slate-950/50 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-slate-500 md:inline">
                                    #{log.id}
                                </span>
                            </div>
                            <p className="mt-1 truncate text-xs leading-relaxed text-slate-400">
                                {log.description || "No description recorded."}
                            </p>
                        </div>
                    </div>

                    <div className="flex min-w-0 items-center gap-2 text-xs text-slate-400 sm:block">
                        <span className="truncate text-slate-300">{displayResource(log)}</span>
                        <span className="hidden text-slate-600 sm:inline"> · </span>
                        {log.user_id && <span className="font-mono text-slate-500">User {log.user_id}</span>}
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <time className="whitespace-nowrap text-xs tabular-nums text-slate-500" dateTime={log.created_at} title={formatExactTimestamp(log.created_at)}>
                            {formatTimestamp(log.created_at)}
                        </time>
                        <ChevronDown
                            size={16}
                            className={`shrink-0 text-slate-500 transition-transform duration-200 group-hover:text-purple-300 ${isExpanded ? "rotate-180 text-purple-300" : ""}`}
                            aria-hidden="true"
                        />
                    </div>
                </div>
            </button>

            <div
                id={detailsId}
                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            >
                <div className="min-h-0 overflow-hidden">
                    <dl className="mx-5 mb-4 grid grid-cols-1 gap-x-6 gap-y-4 rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 sm:grid-cols-2">
                        <DetailItem label="Organization" value={log.organization_id ? `Organization ${log.organization_id}` : null} />
                        <DetailItem label="User" value={log.user_id ? `User ${log.user_id}` : null} />
                        <DetailItem label="Resource" value={displayResource(log)} />
                        <DetailItem label="Exact time" value={formatExactTimestamp(log.created_at)} />
                        <DetailItem label="IP address" value={log.ip_address} mono />
                        <DetailItem label="User agent" value={log.user_agent} mono />
                        <DetailItem label="Description" value={log.description} wide />
                    </dl>
                </div>
            </div>
        </li>
    );
}

function LoadingRows() {
    return (
        <div className="space-y-1 p-4" aria-label="Loading audit activity">
            {[0, 1, 2, 3, 4].map((row) => (
                <div key={row} className="flex items-center gap-4 rounded-xl px-4 py-4 animate-pulse">
                    <div className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="h-3 w-40 rounded bg-slate-700/70" />
                        <div className="h-2.5 w-3/4 rounded bg-slate-800" />
                    </div>
                    <div className="h-3 w-20 rounded bg-slate-800" />
                </div>
            ))}
        </div>
    );
}

export default function AuditActivity({ onClose }) {
    const [logs, setLogs] = useState([]);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // Keyboard Escape listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    // Prevent background scrolling while modal is open
    useEffect(() => {
        const originalStyle = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = originalStyle;
        };
    }, []);

    const loadLogs = useCallback(async (refresh = false) => {
        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);
        setError(null);

        try {
            const data = await getAuditLogs({ limit: REQUEST_LIMIT });
            setLogs(Array.isArray(data) ? data : []);
            setExpandedId(null);
        } catch (loadError) {
            setError(loadError.message || "Unable to load audit activity.");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();

        getAuditLogs({ limit: REQUEST_LIMIT, signal: controller.signal })
            .then((data) => setLogs(Array.isArray(data) ? data : []))
            .catch((loadError) => {
                if (loadError.name !== "AbortError") {
                    setError(loadError.message || "Unable to load audit activity.");
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false);
            });

        return () => controller.abort();
    }, []);

    const actionOptions = useMemo(() => initialFilters(logs, "action"), [logs]);
    const resourceOptions = useMemo(() => initialFilters(logs, "resource_type"), [logs]);

    const filteredLogs = useMemo(() => {
        const search = filters.search.trim().toLowerCase();
        const fromDate = filters.from ? new Date(filters.from) : null;
        const toDate = filters.to ? new Date(filters.to) : null;

        return logs.filter((log) => {
            const createdAt = parseTimestamp(log.created_at);
            const searchable = [
                log.action,
                log.description,
                log.resource_type,
                log.resource_id,
                log.user_id,
            ].filter((value) => value !== null && value !== undefined).join(" ").toLowerCase();

            return (!filters.action || log.action === filters.action)
                && (!filters.resourceType || log.resource_type === filters.resourceType)
                && (!filters.userId || String(log.user_id || "").includes(filters.userId.trim()))
                && (!search || searchable.includes(search))
                && (!fromDate || (createdAt && createdAt >= fromDate))
                && (!toDate || (createdAt && createdAt <= toDate));
        });
    }, [filters, logs]);

    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pageLogs = useMemo(
        () => filteredLogs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
        [currentPage, filteredLogs],
    );
    const hasFilters = Object.values(filters).some(Boolean);

    const updateFilter = (key, value) => {
        setFilters((current) => ({ ...current, [key]: value }));
        setPage(1);
    };

    const resetFilters = () => {
        setFilters(EMPTY_FILTERS);
        setPage(1);
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 sm:p-6 md:p-8 animate-in fade-in duration-200"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-activity-title"
        >
            <div className="relative w-[94vw] sm:w-[88vw] lg:w-[82vw] max-w-[1150px] max-h-[85vh] flex flex-col rounded-3xl border border-slate-800/80 bg-slate-950/95 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-200">
                {/* Modal Header */}
                <div className="shrink-0 flex flex-col gap-4 border-b border-slate-800/70 bg-slate-900/40 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3.5">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-purple-500/20 bg-purple-500/10 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.15)] mt-0.5">
                            <Activity size={22} />
                        </span>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2.5">
                                <h3 id="audit-activity-title" className="text-lg font-bold text-white tracking-tight">Audit Activity</h3>
                                {!isLoading && !error && (
                                    <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-purple-300">
                                        {logs.length} recent
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-slate-400 max-w-xl">
                                Review recent organization activity and expand individual events for their recorded context.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 self-end sm:self-auto">
                        <button
                            type="button"
                            onClick={() => loadLogs(true)}
                            disabled={isLoading || isRefreshing}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 transition-all duration-200 hover:border-slate-600 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <RefreshCw size={14} className={isRefreshing ? "animate-spin text-purple-400" : ""} />
                            Refresh
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close modal"
                            className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-slate-800 bg-slate-900/80 text-slate-400 transition-colors duration-200 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Search & Filter Controls */}
                <div className="shrink-0 border-b border-slate-800/70 bg-slate-950/60 px-6 py-3.5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <label className="relative block min-w-0 flex-1 sm:max-w-md">
                            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="search"
                                value={filters.search}
                                onChange={(event) => updateFilter("search", event.target.value)}
                                placeholder="Search events, descriptions, resources…"
                                className="w-full rounded-xl border border-slate-800 bg-slate-900/60 py-2.5 pl-10 pr-3.5 text-xs text-white placeholder:text-slate-600 transition-all duration-200 hover:border-slate-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                            />
                        </label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setFiltersOpen((open) => !open)}
                                aria-expanded={filtersOpen}
                                aria-controls="audit-filter-controls"
                                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 ${filtersOpen || hasFilters ? "border-purple-500/30 bg-purple-500/10 text-purple-200" : "border-slate-700/80 bg-slate-900/80 text-slate-300 hover:border-slate-600 hover:bg-slate-800"}`}
                            >
                                <SlidersHorizontal size={14} />
                                Filters{hasFilters ? " active" : ""}
                                <ChevronDown size={14} className={`transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`} />
                            </button>
                            {hasFilters && (
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-400 transition-colors duration-200 hover:bg-slate-800 hover:text-white"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    <div id="audit-filter-controls" className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out ${filtersOpen ? "mt-3 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"}`}>
                        <div className="min-h-0 overflow-hidden">
                            <div className="grid gap-3 border-t border-slate-800/70 pt-3 sm:grid-cols-2 xl:grid-cols-5">
                                <label className="space-y-1">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">Event</span>
                                    <select value={filters.action} onChange={(event) => updateFilter("action", event.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300 transition-colors focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20">
                                        <option value="">All events</option>
                                        {actionOptions.map((action) => <option key={action} value={action}>{displayAction(action)}</option>)}
                                    </select>
                                </label>
                                <label className="space-y-1">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">Resource</span>
                                    <select value={filters.resourceType} onChange={(event) => updateFilter("resourceType", event.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300 transition-colors focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20">
                                        <option value="">All resources</option>
                                        {resourceOptions.map((resource) => <option key={resource} value={resource}>{resource}</option>)}
                                    </select>
                                </label>
                                <label className="space-y-1">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">User ID</span>
                                    <input value={filters.userId} onChange={(event) => updateFilter("userId", event.target.value)} inputMode="numeric" placeholder="Any user" className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 transition-colors focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20" />
                                </label>
                                <label className="space-y-1">
                                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500"><CalendarRange size={11} /> From</span>
                                    <input type="datetime-local" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300 transition-colors focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20" />
                                </label>
                                <label className="space-y-1">
                                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500"><CalendarRange size={11} /> To</span>
                                    <input type="datetime-local" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300 transition-colors focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20" />
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scrollable Audit Content Area */}
                <div className="flex-1 overflow-y-auto scroll-smooth min-h-[300px]">
                    {error && logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10 text-red-300"><AlertTriangle size={22} /></span>
                            <h4 className="mt-4 text-sm font-semibold text-white">Audit activity is unavailable</h4>
                            <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500">{error}</p>
                            <button type="button" onClick={() => loadLogs()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-purple-500/10 px-4 py-2.5 text-xs font-semibold text-purple-200 transition-colors duration-200 hover:bg-purple-500 hover:text-white">
                                <RefreshCw size={14} /> Retry
                            </button>
                        </div>
                    ) : isLoading ? (
                        <LoadingRows />
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-400"><ShieldCheck size={22} /></span>
                            <h4 className="mt-4 text-sm font-semibold text-white">No audit activity yet</h4>
                            <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500">New organization events will appear here as Sentinel records them.</p>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-400"><Filter size={22} /></span>
                            <h4 className="mt-4 text-sm font-semibold text-white">No activity matches these filters</h4>
                            <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500">Adjust the event, resource, user, date, or search filters to broaden the result set.</p>
                            <button type="button" onClick={resetFilters} className="mt-5 rounded-xl px-4 py-2.5 text-xs font-semibold text-purple-300 transition-colors duration-200 hover:bg-purple-500/10 hover:text-purple-100">Clear filters</button>
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-800/80" aria-live="polite">
                            {pageLogs.map((log) => (
                                <AuditRow key={log.id} log={log} isExpanded={expandedId === log.id} onToggle={() => setExpandedId((current) => current === log.id ? null : log.id)} />
                            ))}
                        </ul>
                    )}
                </div>

                {/* Footer Bar with Pagination */}
                {!isLoading && !error && filteredLogs.length > 0 && (
                    <div className="shrink-0 flex flex-col gap-3 border-t border-slate-800/70 bg-slate-950/80 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs tabular-nums text-slate-500">Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length} loaded events</p>
                        {totalPages > 1 && (
                            <nav aria-label="Audit activity pages" className="flex items-center gap-2 self-end sm:self-auto">
                                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1} className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-2 text-slate-300 transition-colors duration-200 hover:border-slate-600 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={15} /></button>
                                <span className="min-w-16 text-center text-xs font-semibold tabular-nums text-slate-400">{currentPage} / {totalPages}</span>
                                <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages} className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-2 text-slate-300 transition-colors duration-200 hover:border-slate-600 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40" aria-label="Next page"><ChevronRight size={15} /></button>
                            </nav>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
