import { useMemo, useState, useEffect } from "react";
import { ChevronDown, History, RefreshCw, Search, AlertTriangle, Radar } from "lucide-react";
import { ScanRow, COL_WIDTHS } from "./shared";

const VISIBLE_SCAN_COUNT = 5;

const accents = {
    purple: { tile: "from-purple-500/25 to-fuchsia-600/10", text: "text-purple-300", glow: "shadow-[0_0_18px_rgba(168,85,247,0.3)]", focus: "focus:ring-purple-500/20 focus:border-purple-500", hover: "hover:border-purple-500/40 hover:bg-purple-500/[0.06] hover:shadow-[0_0_28px_-6px_rgba(168,85,247,0.45)]", line: "via-purple-500/70" },
    cyan: { tile: "from-cyan-500/25 to-blue-600/10", text: "text-cyan-300", glow: "shadow-[0_0_18px_rgba(34,211,238,0.3)]", focus: "focus:ring-cyan-500/20 focus:border-cyan-500", hover: "hover:border-cyan-500/40 hover:bg-cyan-500/[0.06] hover:shadow-[0_0_28px_-6px_rgba(34,211,238,0.45)]", line: "via-cyan-500/70" },
    blue: { tile: "from-blue-500/25 to-indigo-600/10", text: "text-blue-300", glow: "shadow-[0_0_18px_rgba(59,130,246,0.3)]", focus: "focus:ring-blue-500/20 focus:border-blue-500", hover: "hover:border-blue-500/40 hover:bg-blue-500/[0.06] hover:shadow-[0_0_28px_-6px_rgba(59,130,246,0.45)]", line: "via-blue-500/70" },
    amber: { tile: "from-amber-500/25 to-orange-600/10", text: "text-amber-300", glow: "shadow-[0_0_18px_rgba(245,158,11,0.3)]", focus: "focus:ring-amber-500/20 focus:border-amber-500", hover: "hover:border-amber-500/40 hover:bg-amber-500/[0.06] hover:shadow-[0_0_28px_-6px_rgba(245,158,11,0.45)]", line: "via-amber-500/70" },
    emerald: { tile: "from-emerald-500/25 to-teal-600/10", text: "text-emerald-300", glow: "shadow-[0_0_18px_rgba(16,185,129,0.3)]", focus: "focus:ring-emerald-500/20 focus:border-emerald-500", hover: "hover:border-emerald-500/40 hover:bg-emerald-500/[0.06] hover:shadow-[0_0_28px_-6px_rgba(16,185,129,0.45)]", line: "via-emerald-500/70" },
    rose: { tile: "from-rose-500/25 to-pink-600/10", text: "text-rose-300", glow: "shadow-[0_0_18px_rgba(244,63,94,0.3)]", focus: "focus:ring-rose-500/20 focus:border-rose-500", hover: "hover:border-rose-500/40 hover:bg-rose-500/[0.06] hover:shadow-[0_0_28px_-6px_rgba(244,63,94,0.45)]", line: "via-rose-500/70" },
};

/**
 * Shared scan-history card: search, refresh, loading/error/empty states,
 * expandable table with Risk Score + Findings columns and row actions.
 */
export default function ScanHistoryTable({
    title,
    subtitle,
    scans,
    storageKey,
    historyLoading,
    historyError,
    onRefresh,
    now,
    cancellingId,
    deletingId,
    onCancelScan,
    onDeleteScan,
    onViewReport,
    emptyTitle = "No scans yet",
    emptySubtitle = "Run a scan to see results here.",
    accent = "purple",
}) {
    const theme = accents[accent] || accents.purple;
    const [search, setSearch] = useState(() => sessionStorage.getItem(storageKey) || "");
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        sessionStorage.setItem(storageKey, search);
    }, [storageKey, search]);

    const filteredScans = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return scans;
        return scans.filter(
            (scan) =>
                (scan.target || "").toLowerCase().includes(query) ||
                (scan.scanner || "").toLowerCase().includes(query) ||
                (scan.status || "").toLowerCase().includes(query)
        );
    }, [scans, search]);

    const visibleScans = filteredScans.slice(0, VISIBLE_SCAN_COUNT);
    const extraScans = filteredScans.slice(VISIBLE_SCAN_COUNT);
    const canExpand = extraScans.length > 0;

    return (
        <div className="relative bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 shadow-lg shadow-black/40 overflow-hidden">
            <div className="relative z-10">
                <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <span className={`w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center ${theme.tile} ${theme.glow}`}>
                            <History size={20} className={theme.text} />
                        </span>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-bold">{title}</h2>
                                <span className={`px-2.5 py-1 rounded-full border text-xs font-semibold ${theme.text} bg-white/5 border-white/10`}>
                                    {scans.length}
                                </span>
                            </div>
                            <p className="text-slate-400 text-sm mt-1">{subtitle}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Filter scans..."
                                className="w-56 bg-slate-800/50 border border-slate-800 rounded-full pl-10 pr-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none hover:border-slate-700 transition-all duration-300 focus:ring-2"
                            />
                        </div>
                        <button
                            onClick={onRefresh}
                            disabled={historyLoading}
                            title="Refresh history"
                            className="bg-slate-800/50 border border-slate-800 rounded-xl p-2.5 hover:bg-slate-800 hover:border-slate-700 hover:scale-105 transition-all duration-200 disabled:opacity-50"
                        >
                            <RefreshCw size={16} className={historyLoading ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>

                {historyError && scans.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <span className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                            <AlertTriangle size={26} className="text-red-400" />
                        </span>
                        <p className="text-white font-semibold mt-4">Failed to load scan history</p>
                        <p className="text-slate-500 text-sm mt-1">Make sure the backend is running.</p>
                        <button
                            onClick={onRefresh}
                            disabled={historyLoading}
                            className="mt-5 bg-purple-600/10 text-purple-300 hover:bg-purple-600 hover:text-white rounded-xl px-5 py-2.5 text-sm font-medium flex items-center gap-2 transition-all duration-200"
                        >
                            <RefreshCw size={15} className={historyLoading ? "animate-spin" : ""} />
                            Retry
                        </button>
                    </div>
                ) : historyLoading && scans.length === 0 ? (
                    <div className="space-y-3">
                        {[0, 1, 2, 3].map((row) => (
                            <div key={row} className="flex items-center gap-6 py-4 px-4 rounded-xl bg-slate-800/20 animate-pulse">
                                <div className="w-10 h-4 rounded bg-slate-700/60" />
                                <div className="flex-1 h-4 rounded bg-slate-700/60" />
                                <div className="w-24 h-4 rounded bg-slate-700/60" />
                                <div className="w-24 h-5 rounded-full bg-slate-700/60" />
                                <div className="w-36 h-4 rounded bg-slate-700/60" />
                                <div className="w-12 h-4 rounded bg-slate-700/60" />
                                <div className="w-12 h-4 rounded bg-slate-700/60" />
                            </div>
                        ))}
                    </div>
                ) : filteredScans.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/15 to-cyan-500/10 border border-purple-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                            <Radar size={26} className="text-purple-300" />
                        </span>
                        <p className="text-white font-semibold mt-4">
                            {search.trim() ? "No scans match your filter" : emptyTitle}
                        </p>
                        <p className="text-slate-500 text-sm mt-1">
                            {search.trim() ? "Try a different target or status." : emptySubtitle}
                        </p>
                    </div>
                ) : (
                    <div className="relative overflow-x-auto">
                        {!expanded && canExpand && (
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-900/80 to-transparent z-10" />
                        )}
                        <div className="min-w-[1080px]">
                            <table className="w-full text-left table-fixed">
                                <thead>
                                    <tr className="border-b border-slate-700/60">
                                        <th className={`${COL_WIDTHS.id} pb-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500`}>ID</th>
                                        <th className={`${COL_WIDTHS.target} pb-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500`}>Target</th>
                                        <th className={`${COL_WIDTHS.scanner} pb-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500`}>Scanner</th>
                                        <th className={`${COL_WIDTHS.status} pb-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500`}>Status</th>
                                        <th className={`${COL_WIDTHS.created} pb-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500`}>Created</th>
                                        <th className={`${COL_WIDTHS.duration} pb-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500`}>Duration</th>
                                        <th className={`${COL_WIDTHS.risk} pb-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500`}>Risk</th>
                                        <th className={`${COL_WIDTHS.findings} pb-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500`}>Findings</th>
                                        <th className={`${COL_WIDTHS.action} pb-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500`}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleScans.map((scan) => (
                                        <ScanRow
                                            key={scan.id}
                                            scan={scan}
                                            now={now}
                                            cancellingId={cancellingId}
                                            deletingId={deletingId}
                                            onCancel={onCancelScan}
                                            onDelete={onDeleteScan}
                                            onViewReport={onViewReport}
                                        />
                                    ))}
                                </tbody>
                            </table>
                            <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                                <div className="overflow-hidden min-h-0">
                                    <table className="w-full text-left table-fixed">
                                        <tbody>
                                            {extraScans.map((scan) => (
                                                <ScanRow
                                                    key={scan.id}
                                                    scan={scan}
                                                    now={now}
                                                    cancellingId={cancellingId}
                                                    deletingId={deletingId}
                                                    onCancel={onCancelScan}
                                                    onDelete={onDeleteScan}
                                                    onViewReport={onViewReport}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {filteredScans.length > 0 && canExpand && (
                    <button
                        onClick={() => setExpanded((value) => !value)}
                        className={`group relative w-full mt-5 flex items-center justify-center gap-2.5 py-3.5 rounded-xl border border-slate-700/50 bg-slate-950/40 transition-all duration-300 ${theme.hover}`}
                    >
                        <span className={`absolute top-0 left-1/2 -translate-x-1/2 h-px w-1/3 bg-gradient-to-r from-transparent to-transparent ${theme.line}`} />
                        <span className="text-sm font-semibold bg-gradient-to-r from-cyan-300 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                            {expanded ? "Show Less" : "View Complete Scan History"}
                        </span>
                        <span className="text-xs text-slate-500">
                            {expanded ? `${visibleScans.length + extraScans.length} scans` : `${filteredScans.length} total`}
                        </span>
                        <ChevronDown size={18} className={`text-purple-400 transition-all duration-300 ${expanded ? "rotate-180" : "group-hover:translate-y-0.5"}`} />
                    </button>
                )}
            </div>
        </div>
    );
}
