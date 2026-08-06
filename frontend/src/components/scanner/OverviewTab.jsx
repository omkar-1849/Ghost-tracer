import { useMemo } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock, FileText, History, Layers, Play, Radar, XCircle, ShieldAlert, WifiOff } from "lucide-react";
import { StatTile, formatDuration, StatusPill } from "./shared";
import { SCANNER_ENGINES, ACTIVE_STATUSES } from "./constants";
import ScanHistoryTable from "./ScanHistoryTable";
import { useNavigate } from "react-router-dom";

const stateThemes = {
    ready: { label: "Ready", classes: "bg-green-500/10 text-green-400 border-green-500/30" },
    running: { label: "Running", classes: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30" },
    offline: { label: "Offline", classes: "bg-slate-500/10 text-slate-400 border-slate-500/30" },
};

// Count critical + high severity findings across a scan's parsed output.
function countSeverityFindings(scan, severities) {
    const report = scan.parsed_output;
    if (!report) return 0;
    const list = report.findings;
    if (Array.isArray(list)) {
        return list.filter((f) => severities.includes((f.severity || "").toLowerCase())).length;
    }
    if (list && typeof list === "object") {
        let count = 0;
        if (severities.includes("critical")) count += Array.isArray(list.critical) ? list.critical.length : 0;
        if (severities.includes("high")) count += Array.isArray(list.warnings) ? list.warnings.length : 0;
        return count;
    }
    return 0;
}

// Collect recent vulnerability items across completed scans (newest first).
function collectRecentVulnerabilities(scans, limit = 8) {
    const out = [];
    for (const scan of scans) {
        const report = scan.parsed_output;
        if (!report) continue;
        const list = report.findings;
        let items = [];
        if (Array.isArray(list)) {
            items = list;
        } else if (list && typeof list === "object") {
            items = [
                ...(list.critical || []).map((item) => ({ name: item, severity: "critical" })),
                ...(list.warnings || []).map((item) => ({ name: item, severity: "high" })),
            ];
        }
        for (const item of items) {
            out.push({
                id: `${scan.id}-${out.length}`,
                scanId: scan.id,
                title: item.name || item.title || item.template_id || item.type || "Finding",
                severity: item.severity || "info",
                scanner: scan.scanner,
                target: scan.target,
            });
            if (out.length >= limit) return out;
        }
    }
    return out;
}

const severityText = {
    critical: "text-red-400 border-red-500/30 bg-red-500/10",
    high: "text-orange-400 border-orange-500/30 bg-orange-500/10",
    medium: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    low: "text-yellow-300 border-yellow-500/30 bg-yellow-500/10",
    info: "text-sky-300 border-sky-500/30 bg-sky-500/10",
};

export default function OverviewTab({
    stats,
    recentScans,
    engines,
    enginesLoading,
    enginesError,
    onRefreshEngines,
    now,
    historyLoading,
    historyError,
    onRefresh,
    cancellingId,
    deletingId,
    onCancelScan,
    onDeleteScan,
    onTabChange,
}) {
    const navigate = useNavigate();

    function handleViewReport(id) {
        navigate(`/scanner/report/${id}`);
    }

    const { activeScans, lastCompletedScan, criticalCount } = useMemo(() => {
        const active = [];
        let lastScan = null;
        let critical = 0;

        for (const scan of recentScans) {
            const status = (scan.status || "").toUpperCase();
            if (ACTIVE_STATUSES.has(status)) {
                active.push(scan);
            }
            if (status === "COMPLETED") {
                if (!lastScan || new Date(scan.completed_at) > new Date(lastScan.completed_at)) {
                    lastScan = scan;
                }
                critical += countSeverityFindings(scan, ["critical", "high"]);
            }
        }

        return { activeScans: active, lastCompletedScan: lastScan, criticalCount: critical };
    }, [recentScans]);

    const recentVulnerabilities = useMemo(() => collectRecentVulnerabilities(recentScans), [recentScans]);

    const tiles = [
        { label: "Total Scans", value: stats.total, icon: Layers, themeKey: "purple" },
        { label: "Queued", value: stats.queued, icon: Clock, themeKey: "yellow" },
        { label: "Running", value: stats.running, icon: Activity, themeKey: "cyan" },
        { label: "Completed", value: stats.completed, icon: CheckCircle2, themeKey: "green" },
        { label: "Failed", value: stats.failed, icon: XCircle, themeKey: "red" },
        { label: "Critical Findings", value: criticalCount, icon: ShieldAlert, themeKey: "red" },
    ];

    return (
        <div style={{ animation: "section-in 0.45s ease-out both" }} className="space-y-8">
            {/* Command Center Tiles */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                {tiles.map((tile) => (
                    <StatTile key={tile.label} {...tile} />
                ))}
            </div>

            {/* Installed Scanners / Launchpad */}
            <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Radar className="text-purple-400" size={20} />
                    Installed Scanners
                </h2>

                {enginesLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {[0, 1, 2, 3, 4, 5].map((row) => (
                            <div key={row} className="h-44 rounded-2xl bg-slate-800/20 animate-pulse" />
                        ))}
                    </div>
                ) : enginesError ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl">
                        <WifiOff size={28} className="text-red-400 mb-3" />
                        <p className="text-white font-semibold">Scanner engines unreachable</p>
                        <p className="text-slate-500 text-sm mt-1 mb-4">Make sure the backend is running.</p>
                        <button
                            onClick={onRefreshEngines}
                            className="bg-purple-600/10 text-purple-300 hover:bg-purple-600 hover:text-white rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-200"
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {engines.map((engineInfo) => {
                            const config = SCANNER_ENGINES.find((e) => e.engine === engineInfo.name);
                            if (!config) return null;
                            const Icon = config.icon;
                            const active = recentScans.some(
                                (scan) =>
                                    (scan.engine || "").toLowerCase() === engineInfo.name &&
                                    ACTIVE_STATUSES.has((scan.status || "").toUpperCase())
                            );
                            const state = active ? stateThemes.running : stateThemes.ready;
                            const engineCount = recentScans.filter(
                                (scan) => (scan.engine || "").toLowerCase() === engineInfo.name
                            ).length;

                            return (
                                <div
                                    key={engineInfo.name}
                                    onClick={() => onTabChange(config.id)}
                                    className="group relative bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-5 shadow-lg shadow-black/40 overflow-hidden flex flex-col transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:border-purple-500/50 hover:shadow-[0_15px_30px_-10px_rgba(0,0,0,0.6)]"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                    <div className="flex items-start justify-between mb-3 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/25 to-fuchsia-600/10 flex items-center justify-center border border-purple-500/20">
                                                <Icon size={18} className="text-purple-300" />
                                            </span>
                                            <div>
                                                <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                                                    {config.name}
                                                </h3>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                    Type: {engineInfo.type || "unknown"}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${state.classes}`}>
                                            {state.label}
                                        </span>
                                    </div>

                                    <p className="text-sm text-slate-400 line-clamp-2 mb-4 flex-1 relative z-10">
                                        {engineInfo.description || config.description}
                                    </p>

                                    <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-800/60 relative z-10">
                                        <span className="font-mono">Version: {engineInfo.version || "N/A"}</span>
                                        <span className="flex items-center gap-1.5">
                                            <History size={12} /> {engineCount} scans
                                        </span>
                                    </div>

                                    <div className="flex items-center text-sm font-medium relative z-10 mt-3">
                                        <span className="flex items-center gap-1.5 text-purple-400 group-hover:text-purple-300 transition-colors">
                                            <Play size={14} /> Launch Scanner →
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
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
                            {activeScans.map((scan) => (
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
                                    <StatusPill status={scan.status} />
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
                            <FileText className="text-purple-400" size={18} />
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

                                <p className="text-sm text-slate-400 mb-4">
                                    Scanned by <strong className="text-slate-300">{lastCompletedScan.scanner}</strong> in {formatDuration(lastCompletedScan.created_at, lastCompletedScan.completed_at)}.
                                </p>

                                <div className="flex items-center gap-3 mb-5">
                                    <span className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-sm font-bold tabular-nums">
                                        Risk {lastCompletedScan.risk_score ?? "—"}
                                    </span>
                                    <span className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-sm font-bold tabular-nums">
                                        {lastCompletedScan.findings ?? 0} Findings
                                    </span>
                                </div>

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

            {/* Recent Vulnerabilities */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 shadow-lg shadow-black/40">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <ShieldAlert className="text-red-400" size={18} />
                        Recent Vulnerabilities
                    </h3>
                    <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
                        {recentVulnerabilities.length}
                    </span>
                </div>

                {recentVulnerabilities.length > 0 ? (
                    <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                        {recentVulnerabilities.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => handleViewReport(item.scanId)}
                                className="w-full flex items-center gap-3 bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3 text-left hover:bg-slate-800/70 transition-colors"
                            >
                                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border shrink-0 ${severityText[item.severity] || severityText.info}`}>
                                    {item.severity}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold text-white truncate">{item.title}</span>
                                    <span className="block text-xs text-slate-500 truncate">
                                        {item.scanner} · {item.target}
                                    </span>
                                </span>
                                <AlertTriangle size={14} className="text-slate-600 shrink-0" />
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center bg-slate-950/30 rounded-xl border border-slate-800/40 border-dashed">
                        <ShieldAlert size={32} className="text-slate-600 mb-3" />
                        <p className="text-slate-300 font-medium">No Vulnerabilities Recorded</p>
                        <p className="text-slate-500 text-sm mt-1">Completed scans with findings will appear here.</p>
                    </div>
                )}
            </div>

            {/* Unified Recent Scans */}
            <ScanHistoryTable
                title="Recent Scans"
                subtitle="Complete log of all vulnerability assessments."
                scans={recentScans}
                storageKey="scanner_overview_search"
                historyLoading={historyLoading}
                historyError={historyError}
                onRefresh={onRefresh}
                now={now}
                cancellingId={cancellingId}
                deletingId={deletingId}
                onCancelScan={onCancelScan}
                onDeleteScan={onDeleteScan}
                onViewReport={handleViewReport}
                emptyTitle="No scans yet"
                emptySubtitle="Select an engine above to run your first assessment."
            />
        </div>
    );
}
