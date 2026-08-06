import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, AlertTriangle, CheckCircle2, FileText, Loader2, Play, Radio, Target } from "lucide-react";
import { startScan } from "../../services/scannerApi";
import { StatusPill, EngineStatusBadge, formatDuration, formatDate } from "./shared";
import { ACTIVE_STATUSES } from "./constants";
import { EngineResults, RecommendationsList } from "./engineResults";
import TargetSelect from "./TargetSelect";
import ScanHistoryTable from "./ScanHistoryTable";

const accents = {
    cyan: { tile: "from-cyan-500/20 to-blue-600/10", border: "border-cyan-500/20", glow: "shadow-[0_0_15px_rgba(34,211,238,0.15)]", text: "text-cyan-400", button: "from-indigo-600 via-purple-600 to-fuchsia-600" },
    blue: { tile: "from-blue-500/20 to-indigo-600/10", border: "border-blue-500/20", glow: "shadow-[0_0_15px_rgba(59,130,246,0.15)]", text: "text-blue-400", button: "from-indigo-600 via-purple-600 to-fuchsia-600" },
    amber: { tile: "from-amber-500/20 to-orange-600/10", border: "border-amber-500/20", glow: "shadow-[0_0_15px_rgba(245,158,11,0.15)]", text: "text-amber-400", button: "from-indigo-600 via-purple-600 to-fuchsia-600" },
    emerald: { tile: "from-emerald-500/20 to-teal-600/10", border: "border-emerald-500/20", glow: "shadow-[0_0_15px_rgba(16,185,129,0.15)]", text: "text-emerald-400", button: "from-indigo-600 via-purple-600 to-fuchsia-600" },
    rose: { tile: "from-rose-500/20 to-pink-600/10", border: "border-rose-500/20", glow: "shadow-[0_0_15px_rgba(244,63,94,0.15)]", text: "text-rose-400", button: "from-indigo-600 via-purple-600 to-fuchsia-600" },
};

export default function EngineTab({
    engine,
    recentScans,
    now,
    historyLoading,
    historyError,
    onRefresh,
    cancellingId,
    deletingId,
    onCancelScan,
    onDeleteScan,
    showToast,
}) {
    const theme = accents[engine.accent] || accents.cyan;
    const Icon = engine.icon;
    const navigate = useNavigate();
    const [selectedWebsiteId, setSelectedWebsiteId] = useState(null);
    const [loading, setLoading] = useState(false);

    const engineScans = useMemo(
        () => recentScans.filter((scan) => scan.engineId === engine.id),
        [recentScans, engine.id]
    );

    const engineBusy = useMemo(
        () => engineScans.some((scan) => ACTIVE_STATUSES.has((scan.status || "").toUpperCase())),
        [engineScans]
    );

    const activeScan = engineScans.find((scan) => ACTIVE_STATUSES.has((scan.status || "").toUpperCase()));
    const lastCompleted = engineScans.find((scan) => (scan.status || "").toUpperCase() === "COMPLETED");
    const lastFailed = engineScans.find((scan) => (scan.status || "").toUpperCase() === "FAILED");

    function handleViewReport(id) {
        navigate(`/scanner/report/${id}`);
    }

    async function handleStartScan() {
        if (!selectedWebsiteId) {
            showToast("Select a target website first", "error");
            return;
        }
        if (engineBusy) {
            showToast(`A ${engine.name} scan is already running`, "error");
            return;
        }
        setLoading(true);
        try {
            await startScan(selectedWebsiteId, engine.engine);
            setSelectedWebsiteId(null);
            showToast(`${engine.name} scan queued successfully`, "success");
            await onRefresh();
        } catch (error) {
            console.error(error);
            showToast(error.message || "Failed to start scan", "error");
        } finally {
            setLoading(false);
        }
    }

    const startDisabled = loading || engineBusy || !selectedWebsiteId;
    const currentScan = activeScan || lastCompleted || lastFailed;

    return (
        <div style={{ animation: "section-in 0.45s ease-out both" }} className="space-y-8">
            {/* Scanner Introduction Header */}
            <div className="flex items-start gap-5 bg-slate-900/40 backdrop-blur-sm border border-slate-800/40 rounded-2xl p-6">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${theme.tile} ${theme.glow} flex items-center justify-center border ${theme.border} shrink-0`}>
                    <Icon size={28} className={theme.text} />
                </div>
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-2xl font-bold text-white">{engine.name}</h2>
                        <EngineStatusBadge status={engine.status} />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-2">{engine.description}</h3>
                    <p className="text-slate-400 text-sm max-w-3xl">
                        Configure a registered target website below and launch the {engine.name} assessment. Results, risk scoring and recommendations are streamed live from the scanner engine.
                    </p>
                </div>
            </div>

            {/* Target Configuration */}
            <div className="relative z-20 bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 shadow-lg shadow-black/40">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-500/[0.04] via-transparent to-transparent" />
                <div className="relative z-10">
                    <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Target size={20} className="text-purple-400" />
                            Target Configuration
                        </h2>
                        {engineBusy && (
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
                                <Loader2 size={13} className="animate-spin" />
                                {engine.name} scan in progress
                            </span>
                        )}
                    </div>
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        <TargetSelect value={selectedWebsiteId} onChange={(website) => setSelectedWebsiteId(website.id)} disabled={loading} />
                        <button
                            onClick={handleStartScan}
                            disabled={startDisabled}
                            title={engineBusy ? `Another ${engine.name} scan is already running` : "Start scan"}
                            className={`${
                                startDisabled
                                    ? "bg-slate-700 text-slate-400 shadow-none cursor-not-allowed"
                                    : `bg-gradient-to-r ${theme.button} shadow-[0_0_24px_rgba(168,85,247,0.35)] hover:from-indigo-500 hover:via-purple-500 hover:to-fuchsia-500 hover:shadow-[0_0_32px_rgba(217,70,239,0.55)] hover:scale-[1.02] active:scale-95`
                            } rounded-xl px-7 py-3 font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-300`}
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                            {loading ? "Starting..." : "Run Scan"}
                        </button>
                    </div>
                    {!selectedWebsiteId && (
                        <p className="flex items-center gap-1.5 text-slate-500 text-xs mt-3">
                            <AlertTriangle size={13} /> Select a registered website to enable the scan.
                        </p>
                    )}
                </div>
            </div>

            {/* Live Status + Latest Results */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Current Status */}
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 shadow-lg shadow-black/40 flex flex-col">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Activity className="text-cyan-400" size={18} />
                            Current Status
                        </h3>
                        {currentScan && <StatusPill status={currentScan.status} />}
                    </div>

                    {activeScan ? (
                        <div className="flex-1 bg-slate-950/30 rounded-xl border border-slate-800/40 p-5 flex flex-col justify-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Radio size={96} />
                            </div>
                            <div className="relative z-10">
                                <p className="text-xs text-slate-500 font-mono mb-2">#{activeScan.id}</p>
                                <h4 className="text-lg font-bold text-white mb-1 truncate" title={activeScan.target}>{activeScan.target}</h4>
                                <p className="text-sm text-slate-400 mb-4">
                                    {activeScan.scanner} ·{" "}
                                    <span className="text-cyan-400">{formatDuration(activeScan.created_at, now)} elapsed</span>
                                </p>
                                <button
                                    onClick={() => onCancelScan(activeScan.id)}
                                    disabled={cancellingId === activeScan.id}
                                    className="bg-red-500/10 text-red-400 hover:bg-red-600 hover:text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 transition-all duration-200 disabled:opacity-50 w-max"
                                >
                                    {cancellingId === activeScan.id ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                                    Cancel Scan
                                </button>
                            </div>
                        </div>
                    ) : currentScan ? (
                        <div className="flex-1 bg-slate-950/30 rounded-xl border border-slate-800/40 p-5 flex flex-col justify-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <FileText size={96} />
                            </div>
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-3">
                                    {(currentScan.status || "").toUpperCase() === "COMPLETED" ? (
                                        <CheckCircle2 size={18} className="text-green-400" />
                                    ) : (
                                        <AlertTriangle size={18} className="text-red-400" />
                                    )}
                                    <span className="text-xs text-slate-500 font-mono">#{currentScan.id}</span>
                                </div>
                                <h4 className="text-lg font-bold text-white mb-1 truncate" title={currentScan.target}>{currentScan.target}</h4>
                                <p className="text-sm text-slate-400 mb-4">
                                    {currentScan.scanner} · {formatDate(currentScan.completed_at || currentScan.created_at)}
                                </p>
                                {(currentScan.status || "").toUpperCase() === "COMPLETED" ? (
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-sm font-bold tabular-nums">
                                            Risk {currentScan.risk_score ?? "—"}
                                        </span>
                                        <span className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-sm font-bold tabular-nums">
                                            {currentScan.findings ?? 0} Findings
                                        </span>
                                    </div>
                                ) : (
                                    <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 mb-4 break-words">
                                        {currentScan.error || "Scan failed unexpectedly."}
                                    </p>
                                )}
                                <button
                                    onClick={() => handleViewReport(currentScan.id)}
                                    className="bg-purple-600/10 text-purple-300 hover:bg-purple-600 hover:text-white border border-purple-500/30 rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 transition-all duration-200 w-max"
                                >
                                    <FileText size={14} /> View Full Report
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-10 text-center bg-slate-950/30 rounded-xl border border-slate-800/40 border-dashed">
                            <Radio size={32} className="text-slate-600 mb-3" />
                            <p className="text-slate-300 font-medium">Engine Idle</p>
                            <p className="text-slate-500 text-sm mt-1">Run a scan to see live status here.</p>
                        </div>
                    )}
                </div>

                {/* Latest Results */}
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 shadow-lg shadow-black/40">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Radio className="text-purple-400" size={18} />
                            Latest Results
                        </h3>
                        {lastCompleted && (
                            <button
                                onClick={() => handleViewReport(lastCompleted.id)}
                                className="bg-purple-600/10 text-purple-300 hover:bg-purple-600 hover:text-white border border-purple-500/30 rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-all duration-200"
                            >
                                <FileText size={13} /> Open Report
                            </button>
                        )}
                    </div>

                    {lastCompleted && lastCompleted.parsed_output ? (
                        <div className="space-y-6 max-h-[560px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                            <EngineResults report={lastCompleted.parsed_output} engineId={engine.id} />
                            {lastCompleted.parsed_output.recommendations?.length > 0 && (
                                <div>
                                    <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Recommendations</h4>
                                    <RecommendationsList recommendations={lastCompleted.parsed_output.recommendations} />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-950/30 rounded-xl border border-slate-800/40 border-dashed">
                            <Radio size={32} className="text-slate-600 mb-3" />
                            <p className="text-slate-300 font-medium">No Results Yet</p>
                            <p className="text-slate-500 text-sm mt-1">Completed scans will render their parsed report here.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* History */}
            <ScanHistoryTable
                title={`${engine.name} History`}
                subtitle={`History of ${engine.description.toLowerCase()} assessments.`}
                scans={engineScans}
                storageKey={`scanner_${engine.id}_search`}
                historyLoading={historyLoading}
                historyError={historyError}
                onRefresh={onRefresh}
                now={now}
                cancellingId={cancellingId}
                deletingId={deletingId}
                onCancelScan={onCancelScan}
                onDeleteScan={onDeleteScan}
                onViewReport={handleViewReport}
                emptyTitle={`No ${engine.name} scans yet`}
                emptySubtitle="Configure a target above to run your first assessment."
                accent={engine.accent || "cyan"}
            />
        </div>
    );
}
