import { Ban, CheckCircle2, Clock, FileText, Loader2, Scan, Trash2, XCircle } from "lucide-react";
import { ACTIVE_STATUSES } from "./constants";
import { formatDate, formatDuration, COL_WIDTHS } from "./scannerUtils";

export function StatusPill({ status }) {
    const normalized = (status || "").toUpperCase();

    let style = "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]";
    if (normalized === "COMPLETED") {
        style = "bg-[rgba(63,163,77,0.10)] text-[var(--color-success)] border-[rgba(63,163,77,0.25)]";
    } else if (normalized === "RUNNING") {
        style = "bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border-[rgba(61,122,240,0.25)]";
    } else if (normalized === "PENDING" || normalized === "QUEUED") {
        style = "bg-[rgba(221,179,42,0.10)] text-[var(--color-medium)] border-[rgba(221,179,42,0.25)]";
    } else if (normalized === "FAILED") {
        style = "bg-[rgba(229,72,77,0.10)] text-[var(--color-critical)] border-[rgba(229,72,77,0.25)]";
    } else if (normalized === "CANCELLED") {
        style = "bg-[var(--color-surface-3)] text-[var(--color-text-disabled)] border-[var(--color-border-default)]";
    }

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold border whitespace-nowrap ${style}`}
        >
            {normalized === "PENDING" || normalized === "QUEUED" ? <Clock size={11} /> : null}
            {normalized === "RUNNING" && <Loader2 size={11} className="animate-spin" />}
            {normalized === "COMPLETED" && <CheckCircle2 size={11} />}
            {normalized === "FAILED" && <XCircle size={11} />}
            {normalized === "CANCELLED" && <Ban size={11} />}
            {normalized === "PENDING" ? "Queued" : normalized || "UNKNOWN"}
        </span>
    );
}

export function EngineStatusBadge({ status }) {
    const isReady = status === "Ready";
    return (
        <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wider ${
                isReady
                    ? "bg-[rgba(63,163,77,0.10)] text-[var(--color-success)] border-[rgba(63,163,77,0.25)]"
                    : "bg-[var(--color-surface-3)] text-[var(--color-text-disabled)] border-[var(--color-border-default)]"
            }`}
        >
            {status}
        </span>
    );
}

export function StatTile({ label, value, icon: Icon, themeKey }) {
    let iconColor = "text-[var(--color-text-muted)]";
    if (themeKey === "purple") iconColor = "text-[var(--color-accent)]";
    if (themeKey === "yellow") iconColor = "text-[var(--color-medium)]";
    if (themeKey === "cyan") iconColor = "text-[var(--color-accent)]";
    if (themeKey === "green") iconColor = "text-[var(--color-success)]";
    if (themeKey === "red") iconColor = "text-[var(--color-critical)]";

    return (
        <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-3.5 shadow-[var(--shadow-1)] flex flex-col justify-between">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider truncate">
                    {label}
                </span>
                <Icon size={15} className={iconColor} />
            </div>

            <div className="mt-2">
                <span className="text-xl font-bold tracking-tight text-[var(--color-text-primary)] tabular-nums">
                    {value}
                </span>
            </div>
        </div>
    );
}

function riskClasses(score) {
    if (score >= 70) return "bg-[rgba(229,72,77,0.10)] text-[var(--color-critical)] border-[rgba(229,72,77,0.25)]";
    if (score >= 40) return "bg-[rgba(237,125,28,0.10)] text-[var(--color-high)] border-[rgba(237,125,28,0.25)]";
    if (score > 0) return "bg-[rgba(63,163,77,0.10)] text-[var(--color-success)] border-[rgba(63,163,77,0.25)]";
    return "bg-[var(--color-surface-3)] text-[var(--color-text-muted)] border-[var(--color-border-default)]";
}

export function ScanRow({ scan, now, cancellingId, deletingId, onCancel, onDelete, onViewReport }) {
    const normalized = (scan.status || "").toUpperCase();
    const isActive = ACTIVE_STATUSES.has(normalized);

    const durationLabel =
        normalized === "PENDING" || normalized === "QUEUED"
            ? "waiting…"
            : normalized === "RUNNING"
              ? formatDuration(scan.created_at, now)
              : formatDuration(scan.created_at, scan.completed_at);

    return (
        <tr className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-2)] transition-colors">
            <td className={`py-3 pl-3 text-xs font-mono text-[var(--color-text-muted)] ${COL_WIDTHS.id}`}>
                #{scan.id}
            </td>
            <td className={`py-3 text-xs font-mono font-medium text-[var(--color-text-primary)] max-w-xs truncate ${COL_WIDTHS.target}`} title={scan.target}>
                {scan.target}
            </td>
            <td className={`py-3 text-xs text-[var(--color-text-secondary)] whitespace-nowrap ${COL_WIDTHS.scanner}`}>
                <span className="flex items-center gap-1.5">
                    <Scan size={13} className="text-[var(--color-text-muted)]" />
                    {scan.scanner}
                </span>
            </td>
            <td className={`py-3 ${COL_WIDTHS.status}`}>
                <StatusPill status={scan.status} />
            </td>
            <td className={`py-3 text-xs text-[var(--color-text-muted)] whitespace-nowrap ${COL_WIDTHS.created}`}>
                {formatDate(scan.created_at)}
            </td>
            <td className={`py-3 text-xs text-[var(--color-text-muted)] whitespace-nowrap ${COL_WIDTHS.duration}`}>
                <span className="flex items-center gap-1">
                    <Clock size={12} className="text-[var(--color-text-disabled)]" />
                    {durationLabel}
                </span>
            </td>
            <td className={`py-3 ${COL_WIDTHS.risk}`}>
                <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border tabular-nums ${riskClasses(scan.risk_score)}`}>
                    {scan.risk_score != null ? scan.risk_score : "—"}
                </span>
            </td>
            <td className={`py-3 text-xs font-medium text-[var(--color-text-secondary)] tabular-nums ${COL_WIDTHS.findings}`}>
                {scan.findings != null ? scan.findings : "—"}
            </td>
            <td className={`py-3 pr-3 ${COL_WIDTHS.action}`}>
                {isActive ? (
                    <button
                        type="button"
                        onClick={() => onCancel(scan.id)}
                        disabled={cancellingId === scan.id}
                        className="px-2 py-1 rounded text-xs font-medium text-[var(--color-critical)] bg-[rgba(229,72,77,0.08)] border border-[rgba(229,72,77,0.20)] hover:bg-[rgba(229,72,77,0.18)] transition-colors disabled:opacity-50 flex items-center gap-1"
                        title="Cancel scan"
                    >
                        {cancellingId === scan.id ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                        <span>Cancel</span>
                    </button>
                ) : (
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => onViewReport(scan.id)}
                            className="px-2 py-1 rounded text-xs font-medium text-[var(--color-accent)] bg-[var(--color-surface-3)] border border-[var(--color-border-default)] hover:border-[var(--color-accent)] transition-colors flex items-center gap-1"
                            title="View report"
                        >
                            <FileText size={11} />
                            <span>Report</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onDelete(scan)}
                            disabled={deletingId === scan.id}
                            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-critical)] hover:bg-[rgba(229,72,77,0.08)] transition-colors disabled:opacity-50"
                            title="Delete scan"
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                )}
            </td>
        </tr>
    );
}
