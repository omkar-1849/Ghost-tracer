import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, AlertTriangle, CheckCircle2, FileText, Loader2, Play, Radio, Target } from "lucide-react";
import { startScan } from "../../services/scannerApi";
import { StatusPill, EngineStatusBadge } from "./shared";
import { formatDuration, formatDate } from "./scannerUtils";
import { ACTIVE_STATUSES } from "./constants";
import { EngineResults, RecommendationsList } from "./engineResults";
import TargetSelect from "./TargetSelect";
import ScanHistoryTable from "./ScanHistoryTable";

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
        <div className="space-y-6">
            {/* Scanner Introduction Header — echoes the brass selection
                language of the engine tab that opened this workspace */}
            <div className="flex items-start gap-4 bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-5 shadow-[var(--shadow-1)]">
                <div className="w-11 h-11 rounded-lg bg-[var(--color-signal-subtle)] border border-[var(--color-signal-strong)] flex items-center justify-center shrink-0">
                    <Icon size={20} className="text-[var(--color-signal)]" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{engine.name}</h2>
                        <EngineStatusBadge status={engine.status} />
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mb-2">{engine.description}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-2xl">
                        Select a registered target website below to launch the {engine.name} assessment. Discovered vulnerabilities, risk posture metrics, and remediation guidance will stream directly into the reporting console.
                    </p>
                </div>
            </div>

            {/* Target Configuration */}
            <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-5 shadow-[var(--shadow-1)]">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                        <Target size={16} className="text-[var(--color-text-muted)]" />
                        Target Configuration
                    </h3>
                    {engineBusy && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-accent-subtle)] border border-[rgba(69,165,131,0.25)] text-[var(--color-accent)]">
                            <Loader2 size={11} className="animate-spin" />
                            {engine.name} scan in progress
                        </span>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex-1">
                        <TargetSelect
                            value={selectedWebsiteId}
                            onChange={(website) => setSelectedWebsiteId(website.id)}
                            disabled={loading}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleStartScan}
                        disabled={startDisabled}
                        title={engineBusy ? `Another ${engine.name} scan is already running` : "Start scan"}
                        className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-xs font-medium transition-colors duration-150 whitespace-nowrap ${
                            startDisabled
                                ? "bg-[var(--color-surface-3)] text-[var(--color-text-disabled)] border border-[var(--color-border-default)] cursor-not-allowed opacity-70"
                                : "bg-[var(--color-accent)] text-[var(--color-accent-foreground)] hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-active)] cursor-pointer shadow-sm"
                        }`}
                    >
                        {loading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                        {loading ? "Starting…" : "Run Scan"}
                    </button>
                </div>

                {!selectedWebsiteId && (
                    <p className="flex items-center gap-1.5 text-[var(--color-text-muted)] text-[11px] mt-2.5">
                        <AlertTriangle size={12} className="text-[var(--color-warning)]" /> Select a registered target website to enable scan execution.
                    </p>
                )}
            </div>

            {/* Live Status + Latest Results */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Current Status */}
                <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-5 shadow-[var(--shadow-1)] flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                            <Activity size={15} className="text-[var(--color-text-muted)]" />
                            Current Execution Status
                        </h3>
                        {currentScan && <StatusPill status={currentScan.status} />}
                    </div>

                    {activeScan ? (
                        <div className="flex-1 bg-[var(--color-surface-1)] rounded-md border border-[var(--color-border-default)] p-4 flex flex-col justify-between">
                            <div>
                                <p className="text-[11px] text-[var(--color-text-muted)] font-mono mb-1">Scan #{activeScan.id}</p>
                                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] font-mono truncate" title={activeScan.target}>{activeScan.target}</h4>
                                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                                    {activeScan.scanner} ·{" "}
                                    <span className="font-mono text-[var(--color-text-secondary)] font-medium">{formatDuration(activeScan.created_at, now)} elapsed</span>
                                </p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-[var(--color-border-subtle)]">
                                <button
                                    type="button"
                                    onClick={() => onCancelScan(activeScan.id)}
                                    disabled={cancellingId === activeScan.id}
                                    className="bg-[rgba(223,91,91,0.10)] text-[var(--color-critical)] border border-[rgba(223,91,91,0.25)] hover:bg-[rgba(223,91,91,0.20)] rounded-md px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                >
                                    {cancellingId === activeScan.id ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
                                    Cancel Scan
                                </button>
                            </div>
                        </div>
                    ) : currentScan ? (
                        <div className="flex-1 bg-[var(--color-surface-1)] rounded-md border border-[var(--color-border-default)] p-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    {(currentScan.status || "").toUpperCase() === "COMPLETED" ? (
                                        <CheckCircle2 size={15} className="text-[var(--color-success)]" />
                                    ) : (
                                        <AlertTriangle size={15} className="text-[var(--color-critical)]" />
                                    )}
                                    <span className="text-[11px] text-[var(--color-text-muted)] font-mono">Scan #{currentScan.id}</span>
                                </div>
                                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] font-mono truncate" title={currentScan.target}>{currentScan.target}</h4>
                                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                    {currentScan.scanner} · {formatDate(currentScan.completed_at || currentScan.created_at)}
                                </p>

                                {(currentScan.status || "").toUpperCase() === "COMPLETED" ? (
                                    <div className="flex items-center gap-2 mt-3">
                                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--color-surface-3)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] tabular-nums">
                                            Risk: {currentScan.risk_score ?? "—"}/100
                                        </span>
                                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--color-surface-3)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] tabular-nums">
                                            {currentScan.findings ?? 0} findings
                                        </span>
                                    </div>
                                ) : (
                                    <div className="mt-3 p-2.5 rounded bg-[rgba(223,91,91,0.08)] border border-[rgba(223,91,91,0.20)] text-xs text-[var(--color-critical)] break-words font-mono">
                                        {currentScan.error || "Scan failed unexpectedly."}
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 pt-3 border-t border-[var(--color-border-subtle)]">
                                <button
                                    type="button"
                                    onClick={() => handleViewReport(currentScan.id)}
                                    className="bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] rounded-md px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors"
                                >
                                    <FileText size={13} /> View Full Report
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-8 text-center bg-[var(--color-surface-1)] rounded-md border border-[var(--color-border-default)] border-dashed">
                            <Radio size={24} className="text-[var(--color-text-disabled)] mb-2" />
                            <p className="text-xs font-medium text-[var(--color-text-secondary)]">Engine Idle</p>
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Select a target above to launch an assessment.</p>
                        </div>
                    )}
                </div>

                {/* Latest Results */}
                <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-5 shadow-[var(--shadow-1)] flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                            <Radio size={15} className="text-[var(--color-text-muted)]" />
                            Latest Assessment Output
                        </h3>
                        {lastCompleted && (
                            <button
                                type="button"
                                onClick={() => handleViewReport(lastCompleted.id)}
                                className="text-xs font-medium text-[var(--color-signal-readable)] hover:underline flex items-center gap-1"
                            >
                                <FileText size={12} /> Open Full Report
                            </button>
                        )}
                    </div>

                    {lastCompleted && lastCompleted.parsed_output ? (
                        <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[var(--color-border-strong)] scrollbar-track-transparent flex-1">
                            <EngineResults report={lastCompleted.parsed_output} engineId={engine.id} />
                            {lastCompleted.parsed_output.recommendations?.length > 0 && (
                                <div className="mt-3">
                                    <h4 className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Remediation Guidance</h4>
                                    <RecommendationsList recommendations={lastCompleted.parsed_output.recommendations} />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-8 text-center bg-[var(--color-surface-1)] rounded-md border border-[var(--color-border-default)] border-dashed">
                            <Radio size={24} className="text-[var(--color-text-disabled)] mb-2" />
                            <p className="text-xs font-medium text-[var(--color-text-secondary)]">No Findings Recorded</p>
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Completed assessments will render structured findings here.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* History */}
            <ScanHistoryTable
                title={`${engine.name} Assessment History`}
                subtitle={`Historical assessment timeline for the ${engine.name} scanner engine.`}
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
