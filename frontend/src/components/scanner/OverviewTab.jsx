import { useState, useMemo } from "react";
import { Activity, CheckCircle2, Clock, Layers, XCircle, ChevronDown, History, Radar, Search, AlertTriangle, RefreshCw, Play, Shield, Timer, FileText, Zap } from "lucide-react";
import { StatTile, ScanRow, COL_WIDTHS, EngineStatusBadge, ACTIVE_STATUSES, formatDuration, StatusPill } from "./shared";
import { SCANNER_ENGINES } from "./constants";
import { getScanReport } from "../../services/api";
import ReportViewerModal from "./ReportViewerModal";

const VISIBLE_SCAN_COUNT = 5;

export default function OverviewTab({ 
    stats, 
    recentScans, 
    now, 
    historyLoading, 
    historyError, 
    onRefresh, 
    cancellingId, 
    onCancelScan,
    onTabChange,
    showToast
}) {
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState(false);
    
    const [selectedReport, setSelectedReport] = useState(null);
    const [showReport, setShowReport] = useState(false);
    
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

    const { activeScans, lastCompletedScan, avgDurationStr } = useMemo(() => {
        let totalDuration = 0;
        let completedCount = 0;
        let lastScan = null;
        const active = [];

        for (const scan of recentScans) {
            const status = (scan.status || "").toUpperCase();
            if (ACTIVE_STATUSES.has(status)) {
                active.push(scan);
            }
            
            if (status === "COMPLETED") {
                completedCount++;
                const duration = new Date(scan.completed_at) - new Date(scan.created_at);
                if (duration > 0 && !isNaN(duration)) {
                    totalDuration += duration;
                }
                
                if (!lastScan || new Date(scan.completed_at) > new Date(lastScan.completed_at)) {
                    lastScan = scan;
                }
            }
        }

        const avgDurationMs = completedCount > 0 ? totalDuration / completedCount : 0;
        // Mock a duration by passing 0 and ms
        const avgDurationStr = avgDurationMs > 0 ? formatDuration(0, avgDurationMs) : "—";

        return { activeScans: active, lastCompletedScan: lastScan, avgDurationStr };
    }, [recentScans]);

    const filteredScans = recentScans.filter((scan) => {
        const query = search.trim().toLowerCase();
        if (!query) return true;
        return (
            (scan.target || "").toLowerCase().includes(query) ||
            (scan.scanner || "").toLowerCase().includes(query) ||
            (scan.status || "").toLowerCase().includes(query)
        );
    });

    const visibleScans = filteredScans.slice(0, VISIBLE_SCAN_COUNT);
    const extraScans = filteredScans.slice(VISIBLE_SCAN_COUNT);
    const canExpand = extraScans.length > 0;

    const tiles = [
        { label: "Total Scans", value: stats.total, icon: Layers, themeKey: "purple" },
        { label: "Queued", value: stats.queued, icon: Clock, themeKey: "yellow" },
        { label: "Running", value: stats.running, icon: Activity, themeKey: "cyan" },
        { label: "Completed", value: stats.completed, icon: CheckCircle2, themeKey: "green" },
        { label: "Avg Duration", value: avgDurationStr, icon: Timer, themeKey: "cyan" },
    ];

    const engineCards = SCANNER_ENGINES.filter(e => e.isEngine);

    return (
        <div style={{ animation: "section-in 0.45s ease-out both" }} className="space-y-8">
            
            {/* Command Center Tiles */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                {tiles.map((tile) => (
                    <StatTile key={tile.label} {...tile} />
                ))}
            </div>

            {/* Dashboards Top Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Active Scan Queue */}
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 shadow-lg shadow-black/40 flex flex-col">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Activity className="text-cyan-400" size={18} />
                            Active Scan Queue
                        </h3>
                        <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
                            {activeScans.length} Active
                        </span>
                    </div>
                    
                    {activeScans.length > 0 ? (
                        <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                            {activeScans.map(scan => (
                                <div key={scan.id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between group hover:bg-slate-800/60 transition-colors">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-slate-400 text-xs font-mono">#{scan.id}</span>
                                            <span className="text-white font-medium text-sm truncate max-w-[200px]" title={scan.target}>{scan.target}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs">
                                            <span className="text-slate-500">{scan.scanner}</span>
                                            <span className="flex items-center gap-1 text-cyan-400">
                                                <Clock size={12} /> {formatDuration(scan.created_at, now)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <StatusPill status={scan.status} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-10 text-center bg-slate-950/30 rounded-xl border border-slate-800/40 border-dashed">
                            <CheckCircle2 size={32} className="text-slate-600 mb-3" />
                            <p className="text-slate-300 font-medium">Queue is Empty</p>
                            <p className="text-slate-500 text-sm mt-1">No scans are currently running.</p>
                        </div>
                    )}
                </div>

                {/* Last Scan Summary */}
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 shadow-lg shadow-black/40 flex flex-col">
                    <div className="flex items-center mb-5">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Zap className="text-purple-400" size={18} />
                            Last Scan Summary
                        </h3>
                    </div>

                    {lastCompletedScan ? (
                        <div className="flex-1 bg-slate-950/30 rounded-xl border border-slate-800/40 p-5 flex flex-col justify-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <FileText size={100} />
                            </div>
                            
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-4">
                                    <StatusPill status={lastCompletedScan.status} />
                                    <span className="text-xs text-slate-500 font-mono">#{lastCompletedScan.id}</span>
                                </div>
                                
                                <h4 className="text-xl font-bold text-white mb-1 truncate" title={lastCompletedScan.target}>
                                    {lastCompletedScan.target}
                                </h4>
                                
                                <p className="text-sm text-slate-400 mb-5">
                                    Scanned by <strong className="text-slate-300">{lastCompletedScan.scanner}</strong> in {formatDuration(lastCompletedScan.created_at, lastCompletedScan.completed_at)}.
                                </p>
                                
                                <button 
                                    onClick={() => handleViewReport(lastCompletedScan.id)}
                                    className="bg-purple-600/10 text-purple-300 hover:bg-purple-600 hover:text-white border border-purple-500/30 rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 transition-all duration-200 w-max"
                                >
                                    <FileText size={14} /> View Full Report
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-10 text-center bg-slate-950/30 rounded-xl border border-slate-800/40 border-dashed">
                            <History size={32} className="text-slate-600 mb-3" />
                            <p className="text-slate-300 font-medium">No Recent Scans</p>
                            <p className="text-slate-500 text-sm mt-1">Complete a scan to see the summary.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Engine Launchpad */}
            <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Radar className="text-purple-400" size={20} />
                    Available Engines
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {engineCards.map(engine => {
                        const isReady = engine.status === "Ready";
                        
                        return (
                            <div 
                                key={engine.id}
                                onClick={() => onTabChange(engine.id)}
                                className={`group relative bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-5 shadow-lg shadow-black/40 overflow-hidden flex flex-col transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-[0_15px_30px_-10px_rgba(0,0,0,0.6)] ${
                                    isReady ? "hover:border-purple-500/50" : "hover:border-slate-700"
                                }`}
                            >
                                {isReady && (
                                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                )}
                                
                                <div className="flex items-start justify-between mb-3 relative z-10">
                                    <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                                        {engine.name}
                                    </h3>
                                    <EngineStatusBadge status={engine.status} />
                                </div>
                                
                                <p className="text-sm text-slate-400 line-clamp-2 mb-5 flex-1 relative z-10">
                                    {engine.description}
                                </p>
                                
                                {!isReady && engine.capabilities && (
                                    <div className="mb-5 relative z-10">
                                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Planned Capabilities</p>
                                        <ul className="text-xs text-slate-400 space-y-1">
                                            {engine.capabilities.slice(0, 2).map((cap, i) => (
                                                <li key={i} className="flex items-start gap-1.5 truncate">
                                                    <span className="text-purple-500/50">•</span> {cap}
                                                </li>
                                            ))}
                                            {engine.capabilities.length > 2 && (
                                                <li className="text-slate-500 italic pl-2.5">+{engine.capabilities.length - 2} more</li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                                
                                <div className="flex items-center text-sm font-medium relative z-10 pt-3 border-t border-slate-800/60 mt-auto">
                                    {isReady ? (
                                        <span className="flex items-center gap-1.5 text-purple-400 group-hover:text-purple-300 transition-colors">
                                            <Play size={14} /> Launch Scanner →
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5 text-slate-500 group-hover:text-slate-400 transition-colors">
                                            View Details →
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Unified Recent Scans */}
            <div className="relative bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 shadow-lg shadow-black/40 overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/25 to-fuchsia-600/10 flex items-center justify-center shadow-[0_0_18px_rgba(168,85,247,0.3)]">
                                <History size={20} className="text-purple-300" />
                            </span>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h2 className="text-2xl font-bold">Recent Scans</h2>
                                    <span className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold">
                                        {recentScans.length}
                                    </span>
                                </div>
                                <p className="text-slate-400 text-sm mt-1">
                                    Complete log of all vulnerability assessments.
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

                    {historyError && recentScans.length === 0 ? (
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
                    ) : historyLoading && recentScans.length === 0 ? (
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
                                {search.trim() ? "No scans match your filter" : "No scans yet"}
                            </p>
                            <p className="text-slate-500 text-sm mt-1">
                                {search.trim() ? "Try a different target, scanner or status." : "Select an engine above to run your first assessment."}
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
