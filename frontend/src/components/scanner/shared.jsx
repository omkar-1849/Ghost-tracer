import { Ban, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";

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
            return "bg-green-500/15 text-green-400 border-green-500/30 shadow-[0_0_12px_rgba(74,222,128,0.18)]";
        case "RUNNING":
            return "bg-cyan-500/15 text-cyan-300 border-cyan-500/30 shadow-[0_0_12px_rgba(34,211,238,0.25)]";
        case "QUEUED":
            return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30 shadow-[0_0_12px_rgba(251,191,36,0.18)]";
        case "FAILED":
            return "bg-red-500/15 text-red-400 border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.18)]";
        case "CANCELLED":
            return "bg-slate-500/15 text-slate-400 border-slate-500/30";
        default:
            return "bg-slate-500/15 text-slate-400 border-slate-500/30";
    }
}

export function StatusPill({ status }) {
    const normalized = (status || "").toUpperCase();
    return (
        <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap ${statusColor(
                normalized
            )}`}
        >
            {normalized === "QUEUED" && <Clock size={12} />}
            {normalized === "RUNNING" && <Loader2 size={12} className="animate-spin" />}
            {normalized === "COMPLETED" && <CheckCircle2 size={12} />}
            {normalized === "FAILED" && <XCircle size={12} />}
            {normalized === "CANCELLED" && <Ban size={12} />}
            {normalized || "UNKNOWN"}
        </span>
    );
}

export const COL_WIDTHS = {
    id: "w-[64px]",
    target: "",
    scanner: "w-[120px]",
    status: "w-[150px]",
    created: "w-[200px]",
    duration: "w-[130px]",
    action: "w-[140px]",
};

export const ACTIVE_STATUSES = new Set(["QUEUED", "RUNNING"]);

const tileThemes = {
    purple: {
        chip: "from-purple-500/25 to-fuchsia-600/10",
        text: "text-purple-300",
        glow: "shadow-[0_0_20px_rgba(168,85,247,0.35)]",
        glowHover: "group-hover:shadow-[0_0_28px_rgba(168,85,247,0.55)]",
        dot: "bg-purple-400",
        dotGlow: "group-hover:shadow-[0_0_10px_rgba(168,85,247,0.9)]",
    },
    yellow: {
        chip: "from-yellow-500/25 to-amber-600/10",
        text: "text-yellow-300",
        glow: "shadow-[0_0_20px_rgba(251,191,36,0.35)]",
        glowHover: "group-hover:shadow-[0_0_28px_rgba(251,191,36,0.55)]",
        dot: "bg-yellow-400",
        dotGlow: "group-hover:shadow-[0_0_10px_rgba(251,191,36,0.9)]",
    },
    cyan: {
        chip: "from-cyan-500/25 to-blue-600/10",
        text: "text-cyan-300",
        glow: "shadow-[0_0_20px_rgba(34,211,238,0.35)]",
        glowHover: "group-hover:shadow-[0_0_28px_rgba(34,211,238,0.55)]",
        dot: "bg-cyan-400",
        dotGlow: "group-hover:shadow-[0_0_10px_rgba(34,211,238,0.9)]",
    },
    green: {
        chip: "from-green-500/25 to-emerald-600/10",
        text: "text-green-300",
        glow: "shadow-[0_0_20px_rgba(74,222,128,0.35)]",
        glowHover: "group-hover:shadow-[0_0_28px_rgba(74,222,128,0.55)]",
        dot: "bg-green-400",
        dotGlow: "group-hover:shadow-[0_0_10px_rgba(74,222,128,0.9)]",
    },
    red: {
        chip: "from-red-500/25 to-rose-600/10",
        text: "text-red-400",
        glow: "shadow-[0_0_20px_rgba(239,68,68,0.35)]",
        glowHover: "group-hover:shadow-[0_0_28px_rgba(239,68,68,0.55)]",
        dot: "bg-red-500",
        dotGlow: "group-hover:shadow-[0_0_10px_rgba(239,68,68,0.9)]",
    },
};

export function StatTile({ label, value, icon: Icon, themeKey }) {
    const theme = tileThemes[themeKey];
    return (
        <div className="group relative bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 border-t-2 border-t-slate-700/60 rounded-2xl p-5 shadow-lg shadow-black/40 overflow-hidden transition-all duration-250 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_-16px_rgba(0,0,0,0.6)]">
            <div className="absolute top-4 right-4 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${theme.dot} transition-shadow duration-250 ${theme.dotGlow}`} />
                <span className="text-[9px] font-bold tracking-widest text-slate-500">
                    LIVE
                </span>
            </div>

            <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${theme.chip} ${theme.glow} transition-all duration-250 group-hover:scale-110 ${theme.glowHover}`}>
                <Icon size={22} className={theme.text} />
            </div>

            <p className="text-sm font-medium text-slate-400 mt-4">
                {label}
            </p>

            <h1 className="text-3xl font-bold text-white mt-1">
                {value}
            </h1>
        </div>
    );
}

import { Scan, FileText } from "lucide-react";

export function ScanRow({ scan, now, cancellingId, onCancel, onViewReport }) {
    const normalized = (scan.status || "").toUpperCase();
    const isActive = ACTIVE_STATUSES.has(normalized);

    let durationLabel = "—";
    if (normalized === "QUEUED") {
        durationLabel = "waiting…";
    } else if (normalized === "RUNNING") {
        durationLabel = formatDuration(scan.created_at, now);
    } else {
        durationLabel = formatDuration(scan.created_at, scan.completed_at);
    }

    return (
        <tr className="group relative border-b border-slate-800/60 transition-colors duration-200 hover:bg-slate-800/25">
            <td className={`relative py-4 pl-1 ${COL_WIDTHS.id}`}>
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-full bg-gradient-to-b from-cyan-400 to-purple-500 opacity-0 shadow-[0_0_10px_rgba(34,211,238,0.7)] transition-opacity duration-200 group-hover:opacity-100" />
                <span className="text-slate-500 transition-colors duration-200 group-hover:text-cyan-300">
                    #{scan.id}
                </span>
            </td>
            <td className={`py-4 text-slate-100 font-medium max-w-xs truncate transition-colors duration-200 group-hover:text-white ${COL_WIDTHS.target}`} title={scan.target}>
                {scan.target}
            </td>
            <td className={`py-4 ${COL_WIDTHS.scanner}`}>
                <span className="flex items-center gap-2 text-slate-300 whitespace-nowrap">
                    <Scan size={14} className="text-purple-400" />
                    {scan.scanner}
                </span>
            </td>
            <td className={`py-4 ${COL_WIDTHS.status}`}>
                <StatusPill status={scan.status} />
            </td>
            <td className={`py-4 text-slate-400 text-[13px] whitespace-nowrap ${COL_WIDTHS.created}`}>
                {formatDate(scan.created_at)}
            </td>
            <td className={`py-4 text-slate-400 text-[13px] whitespace-nowrap ${COL_WIDTHS.duration}`}>
                <span className="flex items-center gap-1.5">
                    <Clock size={13} className="text-cyan-400/80" />
                    {durationLabel}
                </span>
            </td>
            <td className={`py-4 pr-1 ${COL_WIDTHS.action}`}>
                {isActive ? (
                    <button
                        onClick={() => onCancel(scan.id)}
                        disabled={cancellingId === scan.id}
                        className="bg-red-500/10 text-red-400 hover:bg-red-600 hover:text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all duration-200 disabled:opacity-50"
                    >
                        {cancellingId === scan.id ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                        Cancel
                    </button>
                ) : (
                    <button
                        onClick={() => onViewReport(scan.id)}
                        className="bg-purple-600/10 text-purple-300 hover:bg-purple-600 hover:text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all duration-200"
                    >
                        <FileText size={14} />
                        View Report
                    </button>
                )}
            </td>
            {isActive && (
                <td className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden">
                    <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" style={{ animation: "scanner-bar 1.2s ease-in-out infinite" }} />
                </td>
            )}
        </tr>
    );
}

export function EngineStatusBadge({ status }) {
    let colorClasses = "bg-slate-800 text-slate-400 border-slate-700"; // default / Disabled
    
    if (status === "Ready") {
        colorClasses = "bg-green-500/10 text-green-400 border-green-500/30";
    } else if (status === "Coming Soon") {
        colorClasses = "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
    } else if (status === "Planned") {
        colorClasses = "bg-blue-500/10 text-blue-400 border-blue-500/30";
    }

    return (
        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colorClasses}`}>
            {status}
        </span>
    );
}
