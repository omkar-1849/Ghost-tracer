/* ============================================================
   Scanner Utility Functions & Constants
   ============================================================ */

export function formatDate(value) {
    if (!value) return "—";
    return new Date(value).toLocaleString();
}

export function formatDuration(from, to) {
    if (!from || !to) return "—";
    const ms = new Date(to) - new Date(from);
    if (Number.isNaN(ms) || ms < 0) return "—";
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
}

export function isValidTargetUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

export function statusColor(status) {
    switch ((status || "").toUpperCase()) {
        case "COMPLETED":
            return "bg-[rgba(63,163,77,0.10)] text-[var(--color-success)] border-[rgba(63,163,77,0.25)]";
        case "RUNNING":
            return "bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border-[rgba(61,122,240,0.25)]";
        case "PENDING":
        case "QUEUED":
            return "bg-[rgba(217,161,26,0.10)] text-[var(--color-warning)] border-[rgba(217,161,26,0.25)]";
        case "FAILED":
            return "bg-[rgba(229,72,77,0.10)] text-[var(--color-critical)] border-[rgba(229,72,77,0.25)]";
        case "CANCELLED":
            return "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]";
        default:
            return "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]";
    }
}

export const COL_WIDTHS = {
    id: "w-[64px]",
    target: "",
    scanner: "w-[110px]",
    status: "w-[140px]",
    created: "w-[170px]",
    duration: "w-[110px]",
    risk: "w-[90px]",
    findings: "w-[90px]",
    action: "w-[190px]",
};
