import { memo, useEffect, useRef, useState } from "react";
import {
    Globe, ExternalLink, Copy, ScanLine, Edit2, Trash2, MoreHorizontal,
    ChevronLeft, ChevronRight, Check, Minus, Eye, CheckCheck, SearchX,
    ShieldCheck, ShieldAlert, RefreshCw,
} from "lucide-react";
import CustomSelect from "./CustomSelect";
import { ENVIRONMENT_FILTER_OPTIONS, STATUS_FILTER_OPTIONS, HEALTH_FILTER_OPTIONS } from "./constants";

/* ---------- Custom checkbox (native input kept for a11y) ---------- */
function Checkbox({ checked, indeterminate = false, onChange, label }) {
    const isChecked = checked || indeterminate;
    return (
        <label
            className="inline-flex items-center justify-center cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-400/50 rounded-md p-0.5"
            onClick={(e) => e.stopPropagation()}
        >
            <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={onChange}
                aria-label={label}
            />
            <span
                className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center transition-colors duration-150 active:opacity-70 ${
                    isChecked
                        ? "bg-emerald-500 border-emerald-400"
                        : "bg-slate-800/80 border-slate-600 hover:border-emerald-400/60"
                }`}
            >
                {indeterminate
                    ? <Minus size={12} className="text-white" />
                    : checked && <Check size={12} className="text-white animate-pop-in" strokeWidth={3} />}
            </span>
        </label>
    );
}

/* ---------- Quiet status/health reads — dot + text, no pill chrome ---------- */
const HEALTH_DOTS = { Healthy: "bg-emerald-400", Warning: "bg-amber-400", Critical: "bg-red-500", Unknown: "bg-slate-500" };
const STATUS_DOTS = { Active: "bg-emerald-400", Inactive: "bg-slate-500", Archived: "bg-slate-600" };

function StatusRead({ status }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[status] || "bg-slate-500"}`} />
            {status}
        </span>
    );
}

function HealthRead({ health }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <span className={`w-1.5 h-1.5 rounded-full ${HEALTH_DOTS[health] || HEALTH_DOTS.Unknown}`} />
            {health}
        </span>
    );
}

/* ---------- Ownership badge — smaller, quieter, lighter ---------- */
function OwnershipBadge({ verified }) {
    return verified ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/[0.08] text-emerald-300/90">
            <ShieldCheck size={10} className="shrink-0" /> Verified
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-700/30 text-slate-400">
            <ShieldAlert size={10} className="shrink-0" /> Unverified
        </span>
    );
}

/* ---------- Monitoring — icon-only, tooltip-driven, minimal weight ---------- */
function MonitoringRead({ enabled }) {
    return enabled ? (
        <span
            className="inline-flex items-center text-cyan-400/90"
            title="Monitoring enabled"
            aria-label="Monitoring enabled"
        >
            <Eye size={14} />
        </span>
    ) : (
        <span
            className="inline-flex items-center text-slate-600"
            title="Monitoring paused"
            aria-label="Monitoring paused"
        >
            <Eye size={14} />
        </span>
    );
}

const getScoreColor = (score) => {
    if (score === null || score === undefined) return "text-slate-500";
    if (score >= 90) return "text-emerald-400";
    if (score >= 70) return "text-amber-400";
    return "text-red-400";
};

/* ---------- Row actions — kebab (⋮) menu ---------- */
const RowActions = memo(function RowActions({ website, copied, onCopy, onEdit, onDelete, onScan }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    // Close on outside click / Escape
    useEffect(() => {
        if (!open) return;
        const handlePointerDown = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
        };
        const handleKeyDown = (e) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    const run = (fn) => (e) => {
        e.stopPropagation();
        setOpen(false);
        fn();
    };

    return (
        <div ref={rootRef} className="relative inline-flex justify-end">
            <button
                onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`Actions for ${website.name}`}
                title="Actions"
                className={`p-1.5 rounded-md transition-colors duration-150 active:opacity-70 ${
                    copied
                        ? "text-emerald-300 bg-emerald-500/10"
                        : open
                            ? "text-white bg-slate-700/60"
                            : "text-slate-400 hover:text-white hover:bg-slate-700/60"
                }`}
            >
                {copied ? <CheckCheck size={15} /> : <MoreHorizontal size={15} />}
            </button>

            {open && (
                <div
                    role="menu"
                    aria-label={`Actions for ${website.name}`}
                    className="absolute right-0 top-full z-30 mt-1 w-44 py-1.5 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/70 shadow-2xl shadow-black/50 animate-scale-in origin-top-right"
                >
                    <button
                        role="menuitem"
                        onClick={run(() => window.open(website.url, '_blank', 'noopener'))}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors duration-100 text-left"
                    >
                        <ExternalLink size={14} className="text-slate-500" /> Open URL
                    </button>
                    <button
                        role="menuitem"
                        onClick={run(onCopy)}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors duration-100 text-left"
                    >
                        <Copy size={14} className="text-slate-500" /> Copy URL
                    </button>
                    <button
                        role="menuitem"
                        onClick={run(() => onScan(website))}
                        disabled={!website.verified}
                        title={website.verified ? "Run scan" : "Verify website ownership before scanning."}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-left transition-colors duration-100 ${
                            website.verified
                                ? "text-slate-300 hover:text-white hover:bg-slate-800/80"
                                : "text-slate-600 cursor-not-allowed"
                        }`}
                    >
                        <ScanLine size={14} className={website.verified ? "text-blue-400" : "text-slate-600"} /> Run Scan
                    </button>

                    <div className="my-1 h-px bg-slate-700/60" />

                    <button
                        role="menuitem"
                        onClick={run(() => onEdit(website))}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors duration-100 text-left"
                    >
                        <Edit2 size={14} className="text-slate-500" /> Edit
                    </button>
                    <button
                        role="menuitem"
                        onClick={run(() => onDelete(website))}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors duration-100 text-left"
                    >
                        <Trash2 size={14} /> Delete
                    </button>
                </div>
            )}
        </div>
    );
});

/* ---------- Single row (memoized for performance) ---------- */
const WebsiteRow = memo(function WebsiteRow({ website, selected, onToggleSelect, onView, onEdit, onDelete, onScan }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(website.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard unavailable */ }
    };

    return (
        <tr
            onClick={() => onView(website)}
            className={`group cursor-pointer transition-colors duration-150 border-l-2 ${
                selected
                    ? "bg-emerald-500/[0.07] border-emerald-400"
                    : "border-transparent hover:border-emerald-500/25 hover:bg-slate-800/40"
            }`}
        >
            <td className="px-4 py-3.5 w-12 text-center">
                <Checkbox
                    checked={selected}
                    onChange={() => onToggleSelect(website.id)}
                    label={`Select ${website.name}`}
                />
            </td>

            <td className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-800/90 border border-slate-700/80 flex items-center justify-center shrink-0 overflow-hidden transition-colors duration-150 group-hover:border-emerald-500/40">
                        {website.faviconUrl ? (
                            <img src={website.faviconUrl} alt="" className="w-4 h-4 object-contain" />
                        ) : (
                            <Globe size={15} className="text-slate-500" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className="font-medium text-white text-sm truncate max-w-[220px]">{website.name}</div>
                        <div className="text-xs text-slate-500 truncate max-w-[220px] font-mono">{website.domain}</div>
                    </div>
                </div>
            </td>

            <td className="px-4 py-3.5">
                <span className="text-xs font-medium text-slate-300">{website.environment}</span>
            </td>

            <td className="px-4 py-3.5">
                <StatusRead status={website.status} />
            </td>

            <td className="px-4 py-3.5">
                <HealthRead health={website.health} />
            </td>

            <td className="px-4 py-3.5">
                <span className={`text-base font-semibold tabular-nums ${getScoreColor(website.securityScore)}`}>
                    {website.securityScore ?? "—"}
                </span>
            </td>

            <td className="px-4 py-3.5">
                <OwnershipBadge verified={website.verified} />
            </td>

            <td className="px-4 py-3.5">
                <MonitoringRead enabled={website.monitoringEnabled} />
            </td>

            <td className="px-4 py-3.5 text-right">
                <RowActions
                    website={website}
                    copied={copied}
                    onCopy={handleCopy}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onScan={onScan}
                />
            </td>
        </tr>
    );
});

/* ---------- Table ---------- */
export default function WebsiteTable({
    websites,
    selectedIds,
    onToggleSelect,
    onToggleSelectAll,
    pagination,
    setPagination,
    onView,
    onEdit,
    onDelete,
    onScan,
    filters,
    lastRefreshed,
    onRefresh,
    onResetFilters,
}) {
    const { currentPage, itemsPerPage } = pagination;

    const totalItems = websites.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const validPage = Math.min(Math.max(1, currentPage), totalPages);

    const startIndex = (validPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const visibleWebsites = websites.slice(startIndex, endIndex);

    const allSelected = visibleWebsites.length > 0 && visibleWebsites.every(w => selectedIds.includes(w.id));
    const someSelected = visibleWebsites.some(w => selectedIds.includes(w.id));

    const goToPage = (page) => setPagination(prev => ({ ...prev, currentPage: Math.min(Math.max(1, page), totalPages) }));

    // Full-label filter summary for the status bar ("All Environments · All Statuses · All Health")
    const filterSummary = [
        (ENVIRONMENT_FILTER_OPTIONS.find(o => o.value === filters.environment) ?? ENVIRONMENT_FILTER_OPTIONS[0]).label,
        (STATUS_FILTER_OPTIONS.find(o => o.value === filters.status) ?? STATUS_FILTER_OPTIONS[0]).label,
        (HEALTH_FILTER_OPTIONS.find(o => o.value === filters.health) ?? HEALTH_FILTER_OPTIONS[0]).label,
    ].join(" · ");

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
            <div className="overflow-auto custom-scrollbar max-h-[calc(100vh-360px)]">
                <table className="w-full text-left border-collapse min-w-[960px]">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-900/95 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            <th className="px-4 py-3 w-12 text-center">
                                <Checkbox
                                    checked={allSelected}
                                    indeterminate={someSelected && !allSelected}
                                    onChange={(e) => onToggleSelectAll(e.target.checked, visibleWebsites.map(w => w.id))}
                                    label="Select all websites on this page"
                                />
                            </th>
                            <th className="px-4 py-3">Target</th>
                            <th className="px-4 py-3">Environment</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Health</th>
                            <th className="px-4 py-3">Score</th>
                            <th className="px-4 py-3">Ownership</th>
                            <th className="px-4 py-3">Monitoring</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {visibleWebsites.map((website) => (
                            <WebsiteRow
                                key={website.id}
                                website={website}
                                selected={selectedIds.includes(website.id)}
                                onToggleSelect={onToggleSelect}
                                onView={onView}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onScan={onScan}
                            />
                        ))}
                        {visibleWebsites.length === 0 && websites.length > 0 && (
                            <tr>
                                <td colSpan={9} className="px-6 py-16 text-center">
                                    <div className="flex flex-col items-center gap-3 text-slate-500">
                                        <span className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/50">
                                            <SearchX size={26} className="text-slate-500" />
                                        </span>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-300">No targets match the current filters</p>
                                            <p className="text-xs mt-1 text-slate-500">Try adjusting the environment, status, or health filters.</p>
                                        </div>
                                        <button
                                            onClick={onResetFilters}
                                            className="mt-1 px-3.5 py-2 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700/60 transition-colors duration-150"
                                        >
                                            Reset filters
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Operational footer / status bar — IDE-terminal feel */}
            <div className="border-t border-slate-800 bg-slate-900/70 px-4 py-2.5 min-h-[46px] flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-slate-400 font-medium">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="tabular-nums whitespace-nowrap">
                        Showing {totalItems === 0 ? 0 : startIndex + 1}–{Math.min(endIndex, totalItems)} of {totalItems} website{totalItems === 1 ? "" : "s"}
                    </span>
                    <span className="hidden sm:flex items-center gap-1.5 min-w-0">
                        <span className="w-px h-3.5 bg-slate-700/70" />
                        <span className="truncate text-slate-500">Filtered: {filterSummary}</span>
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <span className="hidden lg:flex items-center gap-1.5 text-slate-500 tabular-nums whitespace-nowrap">
                        Last synced {lastRefreshed ? new Date(lastRefreshed).toLocaleTimeString() : "—"}
                    </span>
                    <button
                        onClick={onRefresh}
                        title="Refresh data"
                        aria-label="Refresh website data"
                        className="p-1.5 text-slate-400 hover:text-emerald-300 hover:bg-slate-800 rounded-md transition-colors duration-150 active:opacity-70"
                    >
                        <RefreshCw size={14} />
                    </button>

                    <span className="hidden md:flex items-center gap-1.5 text-emerald-400/90 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Backend Online
                    </span>

                    <span className="w-px h-4 bg-slate-700/70" />

                    <div className="flex items-center gap-2">
                        <CustomSelect
                            id="rows-per-page"
                            value={itemsPerPage}
                            onChange={(v) => setPagination(prev => ({ ...prev, itemsPerPage: Number(v), currentPage: 1 }))}
                            options={[
                                { value: "10", label: "10 / page" },
                                { value: "25", label: "25 / page" },
                                { value: "50", label: "50 / page" },
                            ]}
                        />
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => goToPage(validPage - 1)}
                            disabled={validPage <= 1}
                            aria-label="Previous page"
                            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="px-2.5 py-1 rounded-md bg-slate-800/60 border border-slate-700/60 tabular-nums">
                            Page <span className="text-white font-semibold">{validPage}</span> of {totalPages}
                        </span>
                        <button
                            onClick={() => goToPage(validPage + 1)}
                            disabled={validPage >= totalPages}
                            aria-label="Next page"
                            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
