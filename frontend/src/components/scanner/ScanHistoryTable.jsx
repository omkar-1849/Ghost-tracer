import { useMemo, useState, useEffect } from "react";
import { ChevronDown, History, RefreshCw, Search, AlertTriangle, Radar } from "lucide-react";
import { ScanRow } from "./shared";
import { COL_WIDTHS } from "./scannerUtils";

const VISIBLE_SCAN_COUNT = 8;

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
}) {
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

    const visibleScans = expanded ? filteredScans : filteredScans.slice(0, VISIBLE_SCAN_COUNT);
    const extraScans = filteredScans.slice(VISIBLE_SCAN_COUNT);
    const canExpand = extraScans.length > 0;

    return (
        <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-5 shadow-[var(--shadow-1)]">
            <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-md bg-[var(--color-surface-3)] border border-[var(--color-border-default)] flex items-center justify-center">
                        <History size={16} className="text-[var(--color-accent)]" />
                    </span>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold text-[var(--color-text-secondary)] bg-[var(--color-surface-3)] border border-[var(--color-border-default)] tabular-nums">
                                {scans.length}
                            </span>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Filter scans…"
                            className="w-48 bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded pl-8 pr-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[var(--color-accent)]"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={historyLoading}
                        title="Refresh history"
                        className="bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={historyLoading ? "animate-spin text-[var(--color-accent)]" : ""} />
                    </button>
                </div>
            </div>

            {historyError && scans.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-md">
                    <span className="w-10 h-10 rounded bg-[rgba(229,72,77,0.10)] border border-[rgba(229,72,77,0.25)] flex items-center justify-center mb-2">
                        <AlertTriangle size={18} className="text-[var(--color-critical)]" />
                    </span>
                    <p className="text-xs font-semibold text-[var(--color-text-primary)]">Failed to load scan history</p>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 mb-3">Ensure the backend API service is reachable.</p>
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={historyLoading}
                        className="bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded px-3 py-1.5 text-xs font-medium transition-colors"
                    >
                        Retry
                    </button>
                </div>
            ) : historyLoading && scans.length === 0 ? (
                <div className="space-y-2">
                    {[0, 1, 2, 3].map((row) => (
                        <div key={row} className="h-10 rounded bg-[var(--color-surface-1)] animate-pulse" />
                    ))}
                </div>
            ) : filteredScans.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-md">
                    <span className="w-10 h-10 rounded bg-[var(--color-surface-3)] border border-[var(--color-border-default)] flex items-center justify-center mb-2">
                        <Radar size={18} className="text-[var(--color-text-muted)]" />
                    </span>
                    <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                        {search.trim() ? "No scans match your filter" : emptyTitle}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                        {search.trim() ? "Try a different target or scanner query." : emptySubtitle}
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[var(--color-border-default)] text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                <th className={`py-2 pl-3 ${COL_WIDTHS.id}`}>ID</th>
                                <th className={`py-2 ${COL_WIDTHS.target}`}>Target</th>
                                <th className={`py-2 ${COL_WIDTHS.scanner}`}>Engine</th>
                                <th className={`py-2 ${COL_WIDTHS.status}`}>Status</th>
                                <th className={`py-2 ${COL_WIDTHS.created}`}>Executed</th>
                                <th className={`py-2 ${COL_WIDTHS.duration}`}>Duration</th>
                                <th className={`py-2 ${COL_WIDTHS.risk}`}>Risk</th>
                                <th className={`py-2 ${COL_WIDTHS.findings}`}>Findings</th>
                                <th className={`py-2 pr-3 ${COL_WIDTHS.action}`}>Actions</th>
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

                    {canExpand && (
                        <div className="pt-3 text-center border-t border-[var(--color-border-subtle)]">
                            <button
                                type="button"
                                onClick={() => setExpanded((v) => !v)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
                            >
                                <ChevronDown size={14} className={`transition-transform duration-150 ${expanded ? "rotate-180" : ""}`} />
                                {expanded ? "Show Less" : `View All ${filteredScans.length} Scans`}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
