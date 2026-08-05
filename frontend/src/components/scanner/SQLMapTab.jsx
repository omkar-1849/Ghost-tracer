import { useState, useMemo } from "react";
import { Target, Globe, AlertTriangle, Play, Loader2, Search, RefreshCw, ChevronDown, History, Radar } from "lucide-react";
import { startSQLMapScan, getScanReport } from "../../services/api";
import { ScanRow, COL_WIDTHS, isValidTargetUrl } from "./shared";
import ReportViewerModal from "./ReportViewerModal";

const VISIBLE_SCAN_COUNT = 5;

export default function SQLMapTab({
    recentScans,
    now,
    sqlmapBusy,
    historyLoading,
    historyError,
    onRefresh,
    cancellingId,
    onCancelScan,
    showToast
}) {
    const [targetUrl, setTargetUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);
    const [showReport, setShowReport] = useState(false);

    const urlInvalid = targetUrl.trim() !== "" && !isValidTargetUrl(targetUrl.trim());
    const startDisabled = loading || sqlmapBusy || !targetUrl.trim() || urlInvalid;

    async function handleStartScan() {
        if (!isValidTargetUrl(targetUrl.trim())) {
            showToast("Enter a valid URL starting with http:// or https://", "error");
            return;
        }
        setLoading(true);
        try {
            await startSQLMapScan(targetUrl.trim());
            setTargetUrl("");
            showToast("Scan queued successfully", "success");
            await onRefresh();
        } catch (error) {
            console.error(error);
            showToast(error.message || "Failed to start scan", "error");
        } finally {
            setLoading(false);
        }
    }

    async function handleViewReport(id) {
        try {
            const data = await getScanReport(id);
            setSelectedReport(data);
            setShowReport(true);
        } catch (error) {
            console.error(error);
            showToast(error.message || "Failed to load report", "error");
        }
    }

    const sqlmapScans = useMemo(() => {
        return recentScans.filter((scan) => (scan.scanner || "").toUpperCase() === "SQLMAP");
    }, [recentScans]);

    const filteredScans = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return sqlmapScans;
        return sqlmapScans.filter(
            (scan) =>
                (scan.target || "").toLowerCase().includes(query) ||
                (scan.status || "").toLowerCase().includes(query)
        );
    }, [sqlmapScans, search]);

    const visibleScans = filteredScans.slice(0, VISIBLE_SCAN_COUNT);
    const extraScans = filteredScans.slice(VISIBLE_SCAN_COUNT);
    const canExpand = extraScans.length > 0;

    return (
        <div style={{ animation: "section-in 0.45s ease-out both" }} className="space-y-8">
            
            {/* Scanner Introduction Header */}
            <div className="flex items-start gap-5 bg-slate-900/40 backdrop-blur-sm border border-slate-800/40 rounded-2xl p-6">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-600/10 shadow-[0_0_15px_rgba(34,211,238,0.15)] flex items-center justify-center border border-cyan-500/20 shrink-0">
                    <Target size={28} className="text-cyan-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">SQLMap</h2>
                    <h3 className="text-sm font-semibold text-cyan-300 mb-2">Automated SQL Injection Assessment</h3>
                    <p className="text-slate-400 text-sm max-w-3xl">
                        Enterprise scanner for SQL injection discovery and database enumeration. Configure your target below to detect and exploit SQL injection flaws and take over of database servers.
                    </p>
                </div>
            </div>

            {/* Target configuration */}
            <div className="relative bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 shadow-lg shadow-black/40 overflow-hidden">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-500/[0.04] via-transparent to-transparent" />
                <div className="relative z-10">
                    <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Target size={20} className="text-purple-400" />
                            Target Configuration
                        </h2>
                        {sqlmapBusy && (
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
                                <Loader2 size={13} className="animate-spin" />
                                SQLMap scan in progress
                            </span>
                        )}
                    </div>
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        <div className="relative flex-1">
                            <Globe
                                size={20}
                                className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 ${
                                    urlInvalid ? "text-red-400" : "text-cyan-400/80"
                                }`}
                            />
                            <input
                                type="text"
                                value={targetUrl}
                                onChange={(e) => setTargetUrl(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !startDisabled) {
                                        handleStartScan();
                                    }
                                }}
                                placeholder="https://example.com"
                                disabled={loading}
                                className={`w-full bg-slate-800/50 border rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-slate-500 focus:outline-none transition-all duration-300 focus:ring-2 ${
                                    urlInvalid
                                        ? "border-red-500/60 focus:ring-red-500/20"
                                        : "border-slate-700 focus:border-purple-500 focus:ring-purple-500/20 focus:shadow-[0_0_0_1px_rgba(192,132,252,0.5),0_0_18px_rgba(168,85,247,0.15)]"
                                }`}
                            />
                        </div>
                        <button
                            onClick={handleStartScan}
                            disabled={startDisabled}
                            title={sqlmapBusy ? "Another SQLMap scan is already running" : "Start scan"}
                            className={`bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 rounded-xl px-7 py-3 font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-300 shadow-[0_0_24px_rgba(168,85,247,0.35)] ${
                                loading || sqlmapBusy ? "cursor-wait" : "disabled:cursor-not-allowed"
                            } ${
                                startDisabled
                                    ? "from-slate-700 via-slate-700 to-slate-700 text-slate-400 shadow-none hover:from-slate-700 hover:via-slate-700 hover:to-slate-700"
                                    : "hover:from-indigo-500 hover:via-purple-500 hover:to-fuchsia-500 hover:shadow-[0_0_32px_rgba(217,70,239,0.55)] hover:scale-[1.02] active:scale-95"
                            }`}
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                            {loading ? "Starting..." : "Start Scan"}
                        </button>
                    </div>
                    {urlInvalid && (
                        <p className="flex items-center gap-1.5 text-red-400 text-xs mt-2">
                            <AlertTriangle size={13} /> Enter a valid URL starting with http:// or https://
                        </p>
                    )}
                </div>
            </div>

            {/* SQLMap Scans History */}
            <div className="relative bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 shadow-lg shadow-black/40 overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/25 to-fuchsia-600/10 flex items-center justify-center shadow-[0_0_18px_rgba(168,85,247,0.3)]">
                                <History size={20} className="text-purple-300" />
                            </span>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h2 className="text-2xl font-bold">SQLMap History</h2>
                                    <span className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold">
                                        {sqlmapScans.length}
                                    </span>
                                </div>
                                <p className="text-slate-400 text-sm mt-1">
                                    History of SQL injection tests.
                                </p>
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
                                    className="w-56 bg-slate-800/50 border border-slate-800 rounded-full pl-10 pr-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none hover:border-slate-700 transition-all duration-300 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                />
                            </div>
                            <button
                                onClick={onRefresh}
                                disabled={historyLoading}
                                title="Refresh history"
                                className="bg-slate-800/50 border border-slate-800 rounded-xl p-2.5 hover:bg-slate-800 hover:border-slate-700 hover:shadow-[0_0_14px_rgba(168,85,247,0.3)] hover:scale-105 transition-all duration-200 disabled:opacity-50"
                            >
                                <RefreshCw size={16} className={historyLoading ? "animate-spin" : ""} />
                            </button>
                        </div>
                    </div>

                    {historyError && sqlmapScans.length === 0 ? (
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
                    ) : historyLoading && sqlmapScans.length === 0 ? (
                        <div className="space-y-3">
                            {[0, 1, 2, 3].map((row) => (
                                <div key={row} className="flex items-center gap-6 py-4 px-4 rounded-xl bg-slate-800/20 animate-pulse">
                                    <div className="w-10 h-4 rounded bg-slate-700/60" />
                                    <div className="flex-1 h-4 rounded bg-slate-700/60" />
                                    <div className="w-24 h-4 rounded bg-slate-700/60" />
                                    <div className="w-24 h-5 rounded-full bg-slate-700/60" />
                                    <div className="w-36 h-4 rounded bg-slate-700/60" />
                                </div>
                            ))}
                        </div>
                    ) : filteredScans.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-14 text-center">
                            <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/15 to-cyan-500/10 border border-purple-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                                <Radar size={26} className="text-purple-300" />
                            </span>
                            <p className="text-white font-semibold mt-4">
                                {search.trim() ? "No scans match your filter" : "No SQLMap scans yet"}
                            </p>
                            <p className="text-slate-500 text-sm mt-1">
                                {search.trim() ? "Try a different target or status." : "Configure a target above to run your first SQL injection assessment."}
                            </p>
                        </div>
                    ) : (
                        <div className="relative overflow-x-auto">
                            {!expanded && canExpand && (
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-900/80 to-transparent z-10" />
                            )}
                            <div className="min-w-[880px]">
                                <table className="w-full text-left table-fixed">
                                    <thead>
                                        <tr className="border-b border-slate-700/60">
                                            <th className={`${COL_WIDTHS.id} pb-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500`}>ID</th>
                                            <th className={`${COL_WIDTHS.target} pb-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500`}>Target</th>
                                            <th className={`${COL_WIDTHS.scanner} pb-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500`}>Scanner</th>
                                            <th className={`${COL_WIDTHS.status} pb-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500`}>Status</th>
                                            <th className={`${COL_WIDTHS.created} pb-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500`}>Created</th>
                                            <th className={`${COL_WIDTHS.duration} pb-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500`}>Duration</th>
                                            <th className={`${COL_WIDTHS.action} pb-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500`}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleScans.map((scan) => (
                                            <ScanRow key={scan.id} scan={scan} now={now} cancellingId={cancellingId} onCancel={onCancelScan} onViewReport={handleViewReport} />
                                        ))}
                                    </tbody>
                                </table>
                                <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                                    <div className="overflow-hidden min-h-0">
                                        <table className="w-full text-left table-fixed">
                                            <tbody>
                                                {extraScans.map((scan) => (
                                                    <ScanRow key={scan.id} scan={scan} now={now} cancellingId={cancellingId} onCancel={onCancelScan} onViewReport={handleViewReport} />
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
                            className="group relative w-full mt-5 flex items-center justify-center gap-2.5 py-3.5 rounded-xl border border-slate-700/50 bg-slate-950/40 hover:border-purple-500/40 hover:bg-purple-500/[0.06] hover:shadow-[0_0_28px_-6px_rgba(168,85,247,0.45)] transition-all duration-300"
                        >
                            <span className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-1/3 bg-gradient-to-r from-transparent via-purple-500/70 to-transparent" />
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

            {showReport && (
                <ReportViewerModal 
                    report={selectedReport} 
                    onClose={() => {
                        setShowReport(false);
                        setSelectedReport(null);
                    }} 
                />
            )}
        </div>
    );
}
