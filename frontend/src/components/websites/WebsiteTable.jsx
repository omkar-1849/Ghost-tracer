import { memo, useState } from "react";
import {
    Globe, ExternalLink, Copy, ScanLine, Edit2, Trash2,
    ChevronLeft, ChevronRight, Check, Minus, Eye, EyeOff, CheckCheck, SearchX,
} from "lucide-react";
import CustomSelect from "./CustomSelect";

/* ---------- Custom checkbox (native input kept for a11y) ---------- */
function Checkbox({ checked, indeterminate = false, onChange, label }) {
    const isChecked = checked || indeterminate;
    return (
        <label
            className="inline-flex items-center justify-center cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-400/60 rounded-md p-0.5"
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
                className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center transition-all duration-150 active:scale-90 ${
                    isChecked
                        ? "bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                        : "bg-slate-800/80 border-slate-600 hover:border-emerald-400/60"
                }`}
            >
                {indeterminate
                    ? <Minus size={12} className="text-white" />
                    : checked && <Check size={12} className="text-white" strokeWidth={3} />}
            </span>
        </label>
    );
}

/* ---------- Badges ---------- */
const HEALTH_BADGES = {
    Healthy: "from-emerald-500/15 to-emerald-500/5 text-emerald-300 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]",
    Warning: "from-amber-500/15 to-amber-500/5 text-amber-300 border-amber-500/30 shadow-[0_0_8px_rgba(251,191,36,0.15)]",
    Critical: "from-red-500/15 to-red-500/5 text-red-300 border-red-500/30 shadow-[0_0_8px_rgba(248,113,113,0.2)]",
    Unknown: "from-slate-500/15 to-slate-500/5 text-slate-400 border-slate-500/25",
};
const HEALTH_DOTS = { Healthy: "bg-emerald-400", Warning: "bg-amber-400", Critical: "bg-red-500", Unknown: "bg-slate-500" };

const STATUS_DOTS = { Active: "bg-emerald-400", Inactive: "bg-slate-500", Archived: "bg-slate-600" };

function HealthBadge({ health }) {
    const c = HEALTH_BADGES[health] || HEALTH_BADGES.Unknown;
    const dot = HEALTH_DOTS[health] || HEALTH_DOTS.Unknown;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border bg-gradient-to-r ${c}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dot} animate-pulse-dot`} />
            {health}
        </span>
    );
}

const getScoreColor = (score) => {
    if (score === null || score === undefined) return "text-slate-500";
    if (score >= 90) return "text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]";
    if (score >= 70) return "text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]";
    return "text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]";
};

/* ---------- Single row (memoized for performance) ---------- */
const WebsiteRow = memo(function WebsiteRow({ website, selected, onToggleSelect, onView, onEdit, onDelete, onScan, index }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(website.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard unavailable */ }
    };

    return (
        <tr
            key={website.id}
            onClick={() => onView(website)}
            style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
            className={`group relative cursor-pointer transition-colors duration-150 animate-fade-in-up ${
                selected ? "bg-emerald-500/[0.07]" : index % 2 === 1 ? "bg-slate-800/20 hover:bg-slate-800/40" : "hover:bg-slate-800/40"
            }`}
        >
            {/* Left selection accent */}
            <span className={`absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-400 to-cyan-400 transition-opacity duration-150 ${selected ? "opacity-100 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "opacity-0"}`} />

            <td className="p-4 w-12 text-center">
                <Checkbox
                    checked={selected}
                    onChange={() => onToggleSelect(website.id)}
                    label={`Select ${website.name}`}
                />
            </td>

            <td className="p-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-center shrink-0 overflow-hidden shadow-inner transition-colors duration-150 group-hover:border-emerald-500/40">
                        {website.faviconUrl ? (
                            <img src={website.faviconUrl} alt="" className="w-4 h-4 object-contain" />
                        ) : (
                            <Globe size={15} className="text-slate-500" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className="font-bold text-white text-sm truncate max-w-[220px] group-hover:text-emerald-300 transition-colors duration-150">
                            {website.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-[220px] font-mono">{website.domain}</div>
                    </div>
                </div>
            </td>

            <td className="p-4">
                <span className="text-xs font-semibold text-slate-300">{website.environment}</span>
            </td>

            <td className="p-4">
                <div className="flex flex-col gap-1.5 items-start">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[website.status] || "bg-slate-500"} ${website.status === 'Active' ? 'animate-pulse-dot' : ''}`} />
                        {website.status}
                    </span>
                    <HealthBadge health={website.health} />
                </div>
            </td>

            <td className="p-4">
                <span className={`text-lg font-black tabular-nums ${getScoreColor(website.securityScore)}`}>
                    {website.securityScore ?? "—"}
                </span>
            </td>

            <td className="p-4">
                {website.monitoringEnabled ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-md px-2 py-1">
                        <Eye size={12} /> ON
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-800/60 border border-slate-700/50 rounded-md px-2 py-1">
                        <EyeOff size={12} /> OFF
                    </span>
                )}
            </td>

            <td className="p-4 text-right">
                <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity duration-150">
                    <button
                        onClick={(e) => { e.stopPropagation(); window.open(website.url, '_blank', 'noopener'); }}
                        title="Open URL"
                        aria-label={`Open ${website.url}`}
                        className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg border border-slate-700/50 transition-all duration-150 hover:-translate-y-px active:scale-95"
                    >
                        <ExternalLink size={14} />
                    </button>
                    <button
                        onClick={handleCopy}
                        title="Copy URL"
                        aria-label={`Copy ${website.url}`}
                        className={`p-1.5 rounded-lg border transition-all duration-150 hover:-translate-y-px active:scale-95 ${
                            copied
                                ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/40"
                                : "text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border-slate-700/50"
                        }`}
                    >
                        {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onScan(website); }}
                        title="Run Scan"
                        aria-label={`Run scan on ${website.name}`}
                        className="p-1.5 text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/25 rounded-lg border border-blue-500/20 transition-all duration-150 hover:-translate-y-px active:scale-95 mr-1"
                    >
                        <ScanLine size={14} />
                    </button>

                    <div className="w-px h-4 bg-slate-700/70 mx-1" />

                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(website); }}
                        title="Edit"
                        aria-label={`Edit ${website.name}`}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-all duration-150 hover:-translate-y-px active:scale-95"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(website); }}
                        title="Delete"
                        aria-label={`Delete ${website.name}`}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg transition-all duration-150 hover:-translate-y-px active:scale-95"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
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

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col shadow-2xl shadow-black/40 animate-fade-in-up">
            {/* Results strip */}
            <div className="px-5 py-3 bg-slate-900/80 border-b border-slate-800/70 rounded-t-2xl flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>
                    <span className="text-white font-bold">{totalItems}</span> target{totalItems === 1 ? "" : "s"} •{" "}
                    {totalItems === 0 ? "no active filter match" : `${startIndex + 1}–${Math.min(endIndex, totalItems)} shown`}
                </span>
                <span className="hidden sm:flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
                    Live inventory
                </span>
            </div>

            <div className="overflow-auto custom-scrollbar max-h-[calc(100vh-320px)]">
                <table className="w-full text-left border-collapse min-w-[880px]">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-800/95 backdrop-blur-md border-b border-slate-700/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            <th className="px-4 py-3.5 w-12 text-center">
                                <Checkbox
                                    checked={allSelected}
                                    indeterminate={someSelected && !allSelected}
                                    onChange={(e) => onToggleSelectAll(e.target.checked, visibleWebsites.map(w => w.id))}
                                    label="Select all websites on this page"
                                />
                            </th>
                            <th className="px-4 py-3.5">Target</th>
                            <th className="px-4 py-3.5">Environment</th>
                            <th className="px-4 py-3.5">Status / Health</th>
                            <th className="px-4 py-3.5">Score</th>
                            <th className="px-4 py-3.5">Monitoring</th>
                            <th className="px-4 py-3.5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                        {visibleWebsites.map((website, idx) => (
                            <WebsiteRow
                                key={website.id}
                                website={website}
                                index={idx}
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
                                <td colSpan={7} className="px-6 py-16 text-center">
                                    <div className="flex flex-col items-center gap-3 text-slate-500 animate-fade-in-up">
                                        <span className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                                            <SearchX size={26} className="text-slate-500" />
                                        </span>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-300">No targets match the current filters</p>
                                            <p className="text-xs mt-1 text-slate-500">Try adjusting the environment, status, or health filters.</p>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Footer */}
            <div className="bg-slate-900/90 border-t border-slate-800/70 px-5 py-3.5 rounded-b-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-400 font-medium">
                <div className="flex items-center gap-4">
                    <span className="tabular-nums">
                        Showing {totalItems === 0 ? 0 : startIndex + 1}–{Math.min(endIndex, totalItems)} of {totalItems}
                    </span>
                    <div className="flex items-center gap-2">
                        <span>Rows per page:</span>
                        <CustomSelect
                            id="rows-per-page"
                            value={itemsPerPage}
                            onChange={(v) => setPagination(prev => ({ ...prev, itemsPerPage: Number(v), currentPage: 1 }))}
                            options={[
                                { value: "10", label: "10" },
                                { value: "25", label: "25" },
                                { value: "50", label: "50" },
                            ]}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => goToPage(validPage - 1)}
                        disabled={validPage <= 1}
                        aria-label="Previous page"
                        className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700/60 transition-all duration-150 active:scale-95"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 tabular-nums">
                        Page <span className="text-white font-bold">{validPage}</span> of {totalPages}
                    </span>
                    <button
                        onClick={() => goToPage(validPage + 1)}
                        disabled={validPage >= totalPages}
                        aria-label="Next page"
                        className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700/60 transition-all duration-150 active:scale-95"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
