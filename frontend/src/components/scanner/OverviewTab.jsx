import { useMemo } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock, FileText, History, Layers, Play, Radar, XCircle, ShieldAlert, WifiOff } from "lucide-react";
import { StatTile, StatusPill } from "./shared";
import { formatDuration } from "./scannerUtils";
import { SCANNER_ENGINES, ACTIVE_STATUSES } from "./constants";
import ScanHistoryTable from "./ScanHistoryTable";
import { useNavigate } from "react-router-dom";

const stateThemes = {
    ready: { label: "Ready", classes: "bg-[rgba(63,163,77,0.10)] text-[var(--color-success)] border-[rgba(63,163,77,0.25)]" },
    running: { label: "Running", classes: "bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border-[rgba(61,122,240,0.25)]" },
    offline: { label: "Offline", classes: "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]" },
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

function collectRecentVulnerabilities(scans) {
    const findings = [];
    for (const scan of scans) {
        if ((scan.status || "").toUpperCase() !== "COMPLETED" || !scan.parsed_output) continue;
        const report = scan.parsed_output;
        const list = Array.isArray(report.findings) ? report.findings : [];
        for (const item of list) {
            findings.push({
                scanId: scan.id,
                target: scan.target,
                scanner: scan.scanner,
                title: item.title || item.name || "Vulnerability finding",
                severity: (item.severity || "medium").toLowerCase(),
                description: item.description || item.detail || "",
                completed_at: scan.completed_at,
            });
            if (findings.length >= 10) return findings;
        }
    }
    return findings;
}

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
        <div className="space-y-6">
            {/* Command Center Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                {tiles.map((tile) => (
                    <StatTile key={tile.label} {...tile} />
                ))}
            </div>

            {/* Installed Scanners / Launchpad */}
            <div>
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                    <Radar className="text-[var(--color-text-muted)]" size={16} />
                    Installed Security Engines
                </h2>

                {enginesLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {[0, 1, 2, 3, 4, 5].map((row) => (
                            <div key={row} className="h-36 rounded-lg bg-[var(--color-surface-2)] animate-pulse" />
                        ))}
                    </div>
                ) : enginesError ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg">
                        <WifiOff size={24} className="text-[var(--color-critical)] mb-2" />
                        <p className="text-xs font-semibold text-[var(--color-text-primary)]">Scanner engines unreachable</p>
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 mb-3">Ensure the backend API service is running.</p>
                        <button
                            type="button"
                            onClick={onRefreshEngines}
                            className="bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded px-3 py-1.5 text-xs font-medium transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
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
                                    className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-4 shadow-[var(--shadow-1)] flex flex-col justify-between hover:border-[var(--color-border-strong)] transition-colors cursor-pointer group"
                                >
                                    <div>
                                        <div className="flex items-start justify-between mb-2.5">
                                            <div className="flex items-center gap-2.5">
                                                <span className="w-8 h-8 rounded-md bg-[var(--color-surface-3)] border border-[var(--color-border-default)] flex items-center justify-center">
                                                    <Icon size={16} className="text-[var(--color-accent)]" />
                                                </span>
                                                <div>
                                                    <h3 className="text-xs font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
                                                        {config.name}
                                                    </h3>
                                                    <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                                                        {engineInfo.type || "Scanner"}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${state.classes}`}>
                                                {state.label}
                                            </span>
                                        </div>

                                        <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 mb-3">
                                            {engineInfo.description || config.description}
                                        </p>
                                    </div>

                                    <div className="pt-2.5 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                                        <span className="font-mono">v{engineInfo.version || "1.0"}</span>
                                        <span className="flex items-center gap-1">
                                            <History size={11} /> {engineCount} scans
                                        </span>
                                        <span className="text-[var(--color-accent)] font-medium flex items-center gap-1 group-hover:underline">
                                            <Play size={11} /> Launch
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Dashboards Active Queue & Last Completed */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active Scan Queue */}
                <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-5 shadow-[var(--shadow-1)] flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                            <Activity size={15} className="text-[var(--color-text-muted)]" />
                            Active Scan Queue
                        </h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-accent-subtle)] border border-[rgba(61,122,240,0.25)] text-[var(--color-accent)] tabular-nums">
                            {activeScans.length} Active
                        </span>
                    </div>

                    {activeScans.length > 0 ? (
                        <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[260px] pr-1">
                            {activeScans.map((scan) => (
                                <div key={scan.id} className="bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-md p-3 flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-[var(--color-text-muted)] text-[11px] font-mono">#{scan.id}</span>
                                            <span className="text-[var(--color-text-primary)] font-mono text-xs truncate max-w-[200px]" title={scan.target}>{scan.target}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
                                            <span>{scan.scanner}</span>
                                            <span className="text-[var(--color-accent)] font-medium">{formatDuration(scan.created_at, now)}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <StatusPill status={scan.status} />
                                        <button
                                            type="button"
                                            onClick={() => onCancelScan(scan.id)}
                                            disabled={cancellingId === scan.id}
                                            className="p-1 rounded text-[var(--color-critical)] hover:bg-[rgba(229,72,77,0.12)] transition-colors disabled:opacity-50"
                                            title="Cancel Scan"
                                        >
                                            <XCircle size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-8 text-center bg-[var(--color-surface-1)] rounded-md border border-[var(--color-border-default)] border-dashed">
                            <Clock size={20} className="text-[var(--color-text-disabled)] mb-1.5" />
                            <p className="text-xs font-medium text-[var(--color-text-secondary)]">Queue Idle</p>
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">No scans currently in execution or queued.</p>
                        </div>
                    )}
                </div>

                {/* Last Completed Scan Summary */}
                <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-5 shadow-[var(--shadow-1)] flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                            <CheckCircle2 size={15} className="text-[var(--color-text-muted)]" />
                            Latest Completed Assessment
                        </h3>
                        {lastCompletedScan && (
                            <button
                                type="button"
                                onClick={() => handleViewReport(lastCompletedScan.id)}
                                className="text-xs font-medium text-[var(--color-accent)] hover:underline flex items-center gap-1"
                            >
                                <FileText size={12} /> View Report
                            </button>
                        )}
                    </div>

                    {lastCompletedScan ? (
                        <div className="flex-1 bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-md p-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[11px] font-mono text-[var(--color-text-muted)]">Scan #{lastCompletedScan.id}</span>
                                    <span className="text-[11px] text-[var(--color-text-muted)]">
                                        {formatDuration(lastCompletedScan.created_at, lastCompletedScan.completed_at)}
                                    </span>
                                </div>
                                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] font-mono truncate mb-1" title={lastCompletedScan.target}>
                                    {lastCompletedScan.target}
                                </h4>
                                <p className="text-xs text-[var(--color-text-muted)] mb-3">
                                    {lastCompletedScan.scanner} · {new Date(lastCompletedScan.completed_at || lastCompletedScan.created_at).toLocaleString()}
                                </p>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--color-surface-3)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] tabular-nums">
                                        Risk: {lastCompletedScan.risk_score ?? "—"}/100
                                    </span>
                                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[rgba(61,122,240,0.10)] border border-[rgba(61,122,240,0.25)] text-[var(--color-accent)] tabular-nums">
                                        {lastCompletedScan.findings ?? 0} findings
                                    </span>
                                </div>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs">
                                <span className="text-[var(--color-text-muted)] text-[11px]">Assessment completed</span>
                                <button
                                    type="button"
                                    onClick={() => handleViewReport(lastCompletedScan.id)}
                                    className="text-xs font-medium text-[var(--color-accent)] hover:underline"
                                >
                                    Inspect Findings →
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-8 text-center bg-[var(--color-surface-1)] rounded-md border border-[var(--color-border-default)] border-dashed">
                            <CheckCircle2 size={20} className="text-[var(--color-text-disabled)] mb-1.5" />
                            <p className="text-xs font-medium text-[var(--color-text-secondary)]">No Completed Scans</p>
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Completed assessments will display their summary here.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Vulnerabilities feed */}
            {recentVulnerabilities.length > 0 && (
                <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-5 shadow-[var(--shadow-1)]">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                        <AlertTriangle size={15} className="text-[var(--color-warning)]" />
                        Discovered Vulnerabilities Feed
                    </h3>
                    <div className="space-y-2">
                        {recentVulnerabilities.map((vuln, idx) => {
                            const isCrit = vuln.severity === "critical";
                            const isHigh = vuln.severity === "high";
                            return (
                                <div
                                    key={idx}
                                    onClick={() => handleViewReport(vuln.scanId)}
                                    className="p-2.5 rounded bg-[var(--color-surface-1)] border border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] transition-colors flex items-center justify-between cursor-pointer"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span
                                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                                isCrit
                                                    ? "bg-[rgba(229,72,77,0.10)] text-[var(--color-critical)] border border-[rgba(229,72,77,0.25)]"
                                                    : isHigh
                                                    ? "bg-[rgba(237,125,28,0.10)] text-[var(--color-high)] border border-[rgba(237,125,28,0.25)]"
                                                    : "bg-[rgba(221,179,42,0.10)] text-[var(--color-medium)] border border-[rgba(221,179,42,0.25)]"
                                            }`}
                                        >
                                            {vuln.severity}
                                        </span>
                                        <span className="text-xs font-medium text-[var(--color-text-primary)] truncate">{vuln.title}</span>
                                        <span className="text-[11px] text-[var(--color-text-muted)] font-mono truncate hidden sm:inline">{vuln.target}</span>
                                    </div>
                                    <span className="text-[11px] text-[var(--color-text-muted)] shrink-0 ml-2">Scan #{vuln.scanId}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Unified Scan History Table */}
            <ScanHistoryTable
                title="Unified Scan History"
                subtitle="Cross-engine timeline of all automated and manual security scans."
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
                emptyTitle="No scans executed yet"
                emptySubtitle="Launch a scan from any engine above to start assessing your assets."
                accent="purple"
            />
        </div>
    );
}
