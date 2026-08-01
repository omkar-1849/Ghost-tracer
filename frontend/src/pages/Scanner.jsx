import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Activity,
    AlertTriangle,
    Ban,
    Check,
    CheckCircle2,
    ChevronDown,
    Clock,
    Copy,
    FileText,
    Globe,
    History,
    Layers,
    Loader2,
    Play,
    Radar,
    RefreshCw,
    Scan,
    Search,
    Shield,
    Target,
    X,
    XCircle,
} from "lucide-react";

import {
    startSQLMapScan,
    getScanHistory,
    getScanReport,
    cancelScan,
} from "../services/api";

const ACTIVE_STATUSES = new Set(["QUEUED", "RUNNING"]);

const VISIBLE_SCAN_COUNT = 5;

/*
 * Scanner selection architecture.
 * Enabling a new scanner later is a config change only:
 * set enabled: true and point handler at its API function.
 */
const scanners = [
    {
        name: "SQLMap",
        enabled: true,
        handler: startSQLMapScan,
        tagline: "SQL injection testing",
    },
    {
        name: "Nmap",
        enabled: false,
        handler: null,
        tagline: "Port & network discovery",
    },
    {
        name: "Nikto",
        enabled: false,
        handler: null,
        tagline: "Web server scanning",
    },
    {
        name: "OpenVAS",
        enabled: false,
        handler: null,
        tagline: "Vulnerability assessment",
    },
];

/* Shared fixed column widths so the two stacked tables align perfectly. */
const COL_WIDTHS = {
    id: "w-[64px]",
    target: "",
    scanner: "w-[120px]",
    status: "w-[150px]",
    created: "w-[200px]",
    duration: "w-[130px]",
    action: "w-[140px]",
};

const keyframes = `
@keyframes scanner-sweep {
  0% { transform: translateX(-140%) skewX(-12deg); }
  100% { transform: translateX(440%) skewX(-12deg); }
}
@keyframes scanner-bar {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(420%); }
}
@keyframes toast-in {
  from { opacity: 0; transform: translateY(12px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes section-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

function formatDate(value) {
    if (!value) {
        return "—";
    }

    return new Date(value).toLocaleString();
}

function formatDuration(from, to) {
    if (!from || !to) {
        return "—";
    }

    const ms = new Date(to) - new Date(from);

    if (Number.isNaN(ms) || ms < 0) {
        return "—";
    }

    const seconds = Math.floor(ms / 1000);

    if (seconds < 60) {
        return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
        return `${minutes}m ${seconds % 60}s`;
    }

    const hours = Math.floor(minutes / 60);

    return `${hours}h ${minutes % 60}m`;
}

function isValidTargetUrl(value) {
    try {
        const url = new URL(value);

        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

function statusColor(status) {
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

function StatusPill({ status }) {
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

function StatTile({ label, value, icon: Icon, themeKey }) {
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

function ScanRow({ scan, now, cancellingId, onCancel, onViewReport }) {
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

            <td
                className={`py-4 text-slate-100 font-medium max-w-xs truncate transition-colors duration-200 group-hover:text-white ${COL_WIDTHS.target}`}
                title={scan.target}
            >
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
                        {cancellingId === scan.id ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <Ban size={14} />
                        )}
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
                    <div
                        className="h-full w-1/3 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                        style={{ animation: "scanner-bar 1.2s ease-in-out infinite" }}
                    />
                </td>
            )}

        </tr>
    );
}

function Scanner() {
    const [targetUrl, setTargetUrl] = useState("");
    const [selectedScanner, setSelectedScanner] = useState("SQLMap");
    const [recentScans, setRecentScans] = useState([]);
    const [loading, setLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);
    const [showReport, setShowReport] = useState(false);
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState(false);
    const [cancellingId, setCancellingId] = useState(null);
    const [toast, setToast] = useState(null);
    const [copied, setCopied] = useState(false);
    const [now, setNow] = useState(Date.now());

    const toastTimerRef = useRef(null);

    const loadScanHistory = useCallback(async () => {
        setHistoryError(false);

        try {
            const data = await getScanHistory();
            setRecentScans(data);
        } catch (error) {
            console.error(error);
            setHistoryError(true);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    const hasActive = useMemo(
        () => recentScans.some((scan) => ACTIVE_STATUSES.has((scan.status || "").toUpperCase())),
        [recentScans]
    );

    const sqlmapBusy = useMemo(
        () =>
            recentScans.some(
                (scan) =>
                    (scan.scanner || "").toUpperCase() === "SQLMAP" &&
                    ACTIVE_STATUSES.has((scan.status || "").toUpperCase())
            ),
        [recentScans]
    );

    function showToast(message, type = "success") {
        setToast({ message, type, id: Date.now() });

        clearTimeout(toastTimerRef.current);

        toastTimerRef.current = setTimeout(() => setToast(null), 4000);
    }

    /* Poll scan status every 3 seconds while any scan is active. */
    useEffect(() => {
        loadScanHistory();

        const interval = setInterval(() => {
            if (hasActive) {
                loadScanHistory();
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [loadScanHistory, hasActive]);

    /* Live elapsed timer while scans are running. */
    useEffect(() => {
        if (!hasActive) {
            return undefined;
        }

        const interval = setInterval(() => setNow(Date.now()), 1000);

        return () => clearInterval(interval);
    }, [hasActive]);

    useEffect(() => {
        function handleKeyDown(event) {
            if (event.key === "Escape") {
                setShowReport(false);
                setSelectedReport(null);
            }
        }

        if (showReport) {
            document.addEventListener("keydown", handleKeyDown);
        }

        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [showReport]);

    /* Auto-refresh the open report while its scan is still active. */
    useEffect(() => {
        if (
            !showReport ||
            !selectedReport ||
            !ACTIVE_STATUSES.has((selectedReport.status || "").toUpperCase())
        ) {
            return undefined;
        }

        const interval = setInterval(async () => {
            try {
                const data = await getScanReport(selectedReport.id);
                setSelectedReport(data);

                if (!ACTIVE_STATUSES.has((data.status || "").toUpperCase())) {
                    loadScanHistory();
                }
            } catch (error) {
                console.error(error);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [showReport, selectedReport, loadScanHistory]);

    const stats = useMemo(() => {
        const result = {
            total: recentScans.length,
            queued: 0,
            running: 0,
            completed: 0,
            failed: 0,
        };

        for (const scan of recentScans) {
            switch ((scan.status || "").toUpperCase()) {
                case "QUEUED":
                    result.queued += 1;
                    break;

                case "RUNNING":
                    result.running += 1;
                    break;

                case "COMPLETED":
                    result.completed += 1;
                    break;

                case "FAILED":
                    result.failed += 1;
                    break;

                default:
                    break;
            }
        }

        return result;
    }, [recentScans]);

    const filteredScans = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) {
            return recentScans;
        }

        return recentScans.filter(
            (scan) =>
                (scan.target || "").toLowerCase().includes(query) ||
                (scan.scanner || "").toLowerCase().includes(query) ||
                (scan.status || "").toLowerCase().includes(query)
        );
    }, [recentScans, search]);

    const visibleScans = filteredScans.slice(0, VISIBLE_SCAN_COUNT);
    const extraScans = filteredScans.slice(VISIBLE_SCAN_COUNT);
    const canExpand = extraScans.length > 0;

    const selectedScannerConfig = scanners.find(
        (scanner) => scanner.name === selectedScanner
    );

    const urlInvalid =
        targetUrl.trim() !== "" && !isValidTargetUrl(targetUrl.trim());

    const startDisabled =
        loading ||
        sqlmapBusy ||
        !targetUrl.trim() ||
        urlInvalid ||
        !selectedScannerConfig?.handler;

    async function handleStartScan() {
        if (!selectedScannerConfig?.handler) {
            showToast(`${selectedScanner} is not available yet`, "error");
            return;
        }

        if (!isValidTargetUrl(targetUrl.trim())) {
            showToast("Enter a valid URL starting with http:// or https://", "error");
            return;
        }

        setLoading(true);

        try {
            await selectedScannerConfig.handler(targetUrl.trim());
            setTargetUrl("");
            showToast("Scan queued successfully", "success");
            await loadScanHistory();
        } catch (error) {
            console.error(error);
            showToast(error.message || "Failed to start scan", "error");
        } finally {
            setLoading(false);
        }
    }

    async function handleCancelScan(id) {
        setCancellingId(id);

        try {
            await cancelScan(id);
            showToast("Scan cancelled", "success");
            await loadScanHistory();
        } catch (error) {
            console.error(error);
            showToast(error.message || "Failed to cancel scan", "error");
        } finally {
            setCancellingId(null);
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

    async function handleRefresh() {
        setRefreshing(true);

        try {
            await loadScanHistory();
        } finally {
            setRefreshing(false);
        }
    }

    function closeReport() {
        setShowReport(false);
        setSelectedReport(null);
        setCopied(false);
    }

    async function copyFindings() {
        if (!selectedReport?.findings) {
            return;
        }

        try {
            await navigator.clipboard.writeText(selectedReport.findings);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (error) {
            console.error(error);
        }
    }

    const tiles = [
        { label: "Total Scans", value: stats.total, icon: Layers, themeKey: "purple" },
        { label: "Queued", value: stats.queued, icon: Clock, themeKey: "yellow" },
        { label: "Running", value: stats.running, icon: Activity, themeKey: "cyan" },
        { label: "Completed", value: stats.completed, icon: CheckCircle2, themeKey: "green" },
        { label: "Failed", value: stats.failed, icon: XCircle, themeKey: "red" },
    ];

    return (
        <div className="flex-1 p-8">

            <style>{keyframes}</style>

            {/* Page header */}
            <div className="relative flex items-center justify-between gap-4 mb-8 p-6 bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl shadow-lg shadow-black/40 overflow-hidden">

                <div
                    className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-purple-500/[0.08] to-transparent"
                    style={{ animation: "scanner-sweep 9s linear infinite" }}
                />

                <div className="relative z-10 flex items-center gap-4">

                    <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-fuchsia-600 flex items-center justify-center shadow-[0_0_24px_rgba(168,85,247,0.5)] ring-1 ring-purple-400/30">
                        <Radar size={24} className="text-white" />
                    </span>

                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-cyan-300 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                            Scanner
                        </h1>

                        <p className="text-slate-400 mt-1 text-sm">
                            Run security scans against target websites.
                        </p>
                    </div>

                </div>

                <div className="relative z-10 hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30">
                    <span className="relative flex w-2 h-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>

                    <span className="text-xs font-bold tracking-widest text-green-400">
                        LIVE
                    </span>
                </div>

            </div>

            {/* Lifecycle stat tiles */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">

                {tiles.map((tile) => (
                    <StatTile key={tile.label} {...tile} />
                ))}

            </div>

            {/* Target configuration */}
            <div className="relative bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 mt-8 shadow-lg shadow-black/40 overflow-hidden">

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
                            title={
                                sqlmapBusy
                                    ? "Another SQLMap scan is already running"
                                    : selectedScannerConfig?.handler
                                    ? "Start scan"
                                    : `${selectedScanner} is not available yet`
                            }
                            className={`bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 rounded-xl px-7 py-3 font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-300 shadow-[0_0_24px_rgba(168,85,247,0.35)] ${
                                loading || sqlmapBusy
                                    ? "cursor-wait"
                                    : "disabled:cursor-not-allowed"
                            } ${
                                startDisabled
                                    ? "from-slate-700 via-slate-700 to-slate-700 text-slate-400 shadow-none hover:from-slate-700 hover:via-slate-700 hover:to-slate-700"
                                    : "hover:from-indigo-500 hover:via-purple-500 hover:to-fuchsia-500 hover:shadow-[0_0_32px_rgba(217,70,239,0.55)] hover:scale-[1.02] active:scale-95"
                            }`}
                        >
                            {loading ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Play size={18} />
                            )}
                            {loading ? "Starting..." : "Start Scan"}
                        </button>

                    </div>

                    {urlInvalid && (
                        <p className="flex items-center gap-1.5 text-red-400 text-xs mt-2">
                            <AlertTriangle size={13} />
                            Enter a valid URL starting with http:// or https://
                        </p>
                    )}

                    <div className="flex flex-wrap gap-3 mt-6">

                        {scanners.map((scanner) => {
                            const isSelected = selectedScanner === scanner.name;

                            return (
                                <button
                                    key={scanner.name}
                                    disabled={!scanner.enabled}
                                    onClick={() => setSelectedScanner(scanner.name)}
                                    className={`group relative px-5 py-2.5 rounded-xl border flex items-center gap-2 font-medium text-sm transition-all duration-200 ${
                                        !scanner.enabled
                                            ? "bg-slate-800/40 text-slate-500 border-slate-800 cursor-not-allowed"
                                            : isSelected
                                            ? "bg-purple-600/20 text-purple-300 border-purple-500 shadow-[0_0_18px_rgba(168,85,247,0.35)] scale-[1.02]"
                                            : "bg-purple-600/10 text-purple-400 border-purple-500/40 hover:border-purple-400 hover:bg-purple-600/20 hover:shadow-[0_0_14px_rgba(168,85,247,0.25)]"
                                    }`}
                                    title={`${scanner.tagline}${scanner.enabled ? "" : " — coming soon"}`}
                                >
                                    {scanner.enabled ? (
                                        <Scan size={16} />
                                    ) : (
                                        <Shield size={16} />
                                    )}
                                    {scanner.name}

                                    {!scanner.enabled && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-400 text-[9px] font-bold tracking-widest">
                                            SOON
                                        </span>
                                    )}
                                </button>
                            );
                        })}

                    </div>

                </div>

            </div>

            {/* Recent scans */}
            <div
                className="relative bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 mt-8 shadow-lg shadow-black/40 overflow-hidden"
                style={{ animation: "section-in 0.45s ease-out both" }}
            >

                <div className="relative z-10">

                    {/* Section header */}
                    <div className="flex items-start justify-between flex-wrap gap-4 mb-6">

                        <div className="flex items-center gap-3">

                            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/25 to-fuchsia-600/10 flex items-center justify-center shadow-[0_0_18px_rgba(168,85,247,0.3)]">
                                <History size={20} className="text-purple-300" />
                            </span>

                            <div>

                                <div className="flex items-center gap-3">
                                    <h2 className="text-2xl font-bold">
                                        Recent Scans
                                    </h2>

                                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30">
                                        <span className="relative flex w-2 h-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
                                        </span>
                                        <span className="text-[10px] font-bold tracking-widest text-cyan-300">
                                            LIVE
                                        </span>
                                    </span>

                                    <span className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold">
                                        {recentScans.length}
                                    </span>

                                </div>

                                <p className="text-slate-400 text-sm mt-1">
                                    Monitor the latest vulnerability assessments and scan activity.
                                </p>

                            </div>

                        </div>

                        <div className="flex items-center gap-3">

                            <div className="relative">
                                <Search
                                    size={16}
                                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                                />

                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Filter scans..."
                                    className="w-56 bg-slate-800/50 border border-slate-800 rounded-full pl-10 pr-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none hover:border-slate-700 transition-all duration-300 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                />
                            </div>

                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                title="Refresh history"
                                className="bg-slate-800/50 border border-slate-800 rounded-xl p-2.5 hover:bg-slate-800 hover:border-slate-700 hover:shadow-[0_0_14px_rgba(168,85,247,0.3)] hover:scale-105 transition-all duration-200 disabled:opacity-50"
                            >
                                <RefreshCw
                                    size={16}
                                    className={refreshing ? "animate-spin" : ""}
                                />
                            </button>

                        </div>

                    </div>

                    {historyError && recentScans.length === 0 ? (

                        <div className="flex flex-col items-center justify-center py-14 text-center">

                            <span className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                                <AlertTriangle size={26} className="text-red-400" />
                            </span>

                            <p className="text-white font-semibold mt-4">
                                Failed to load scan history
                            </p>

                            <p className="text-slate-500 text-sm mt-1">
                                Make sure the backend is running.
                            </p>

                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="mt-5 bg-purple-600/10 text-purple-300 hover:bg-purple-600 hover:text-white rounded-xl px-5 py-2.5 text-sm font-medium flex items-center gap-2 transition-all duration-200"
                            >
                                <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
                                Retry
                            </button>

                        </div>

                    ) : historyLoading && recentScans.length === 0 ? (

                        <div className="space-y-3">

                            {[0, 1, 2, 3].map((row) => (
                                <div
                                    key={row}
                                    className="flex items-center gap-6 py-4 px-4 rounded-xl bg-slate-800/20 animate-pulse"
                                >
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
                                {search.trim()
                                    ? "Try a different target, scanner or status."
                                    : "Configure a target above to run your first vulnerability assessment."}
                            </p>

                            {search.trim() && (
                                <button
                                    onClick={() => setSearch("")}
                                    className="mt-5 bg-purple-600/10 text-purple-300 hover:bg-purple-600 hover:text-white rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-200"
                                >
                                    Clear filter
                                </button>
                            )}

                        </div>

                    ) : (

                        <div className="relative overflow-x-auto">

                            {/* Subtle peek fade while more scans are hidden */}
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
                                            <ScanRow
                                                key={scan.id}
                                                scan={scan}
                                                now={now}
                                                cancellingId={cancellingId}
                                                onCancel={handleCancelScan}
                                                onViewReport={handleViewReport}
                                            />
                                        ))}

                                    </tbody>

                                </table>

                                {/* Smoothly expandable remainder of the history */}
                                <div
                                    className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                                        expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                                    }`}
                                >
                                    <div className="overflow-hidden min-h-0">

                                        <table className="w-full text-left table-fixed">

                                            <tbody>

                                                {extraScans.map((scan) => (
                                                    <ScanRow
                                                        key={scan.id}
                                                        scan={scan}
                                                        now={now}
                                                        cancellingId={cancellingId}
                                                        onCancel={handleCancelScan}
                                                        onViewReport={handleViewReport}
                                                    />
                                                ))}

                                            </tbody>

                                        </table>

                                    </div>
                                </div>

                            </div>

                        </div>

                    )}

                    {/* Expand / collapse history CTA */}
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

                            <ChevronDown
                                size={18}
                                className={`text-purple-400 transition-all duration-300 ${
                                    expanded ? "rotate-180" : "group-hover:translate-y-0.5"
                                }`}
                            />
                        </button>
                    )}

                </div>

            </div>

            {/* Report viewer */}
            {showReport && selectedReport && (
                <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={closeReport}
                >
                    <div
                        className="bg-slate-900/95 backdrop-blur-xl border border-slate-800/70 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl shadow-black/60"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/95 backdrop-blur-xl">

                            <div className="flex items-center gap-3">

                                <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/25 to-fuchsia-600/10 flex items-center justify-center shadow-[0_0_16px_rgba(168,85,247,0.3)]">
                                    <FileText size={20} className="text-purple-300" />
                                </span>

                                <div>
                                    <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-300 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                                        Scan Report
                                    </h3>

                                    <p className="text-slate-500 text-xs mt-0.5">
                                        #{selectedReport.id} · {selectedReport.scanner}
                                    </p>
                                </div>

                            </div>

                            <button
                                onClick={closeReport}
                                className="bg-slate-800 hover:bg-slate-700 hover:shadow-[0_0_12px_rgba(168,85,247,0.3)] rounded-lg p-2 transition-all duration-200 hover:scale-105"
                            >
                                <X size={20} />
                            </button>

                        </div>

                        <div className="p-6 space-y-5">

                            <div>
                                <p className="text-slate-500 text-sm mb-1 flex items-center gap-1.5">
                                    <Globe size={13} />
                                    Target
                                </p>

                                <p
                                    className="text-white font-medium break-words"
                                    title={selectedReport.target}
                                >
                                    {selectedReport.target}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                                <div>
                                    <p className="text-slate-500 text-sm mb-1">
                                        Status
                                    </p>

                                    <StatusPill status={selectedReport.status} />
                                </div>

                                <div>
                                    <p className="text-slate-500 text-sm mb-1">
                                        Duration
                                    </p>

                                    <p className="text-white flex items-center gap-1.5">
                                        <Clock size={14} className="text-cyan-400/80" />
                                        {formatDuration(
                                            selectedReport.created_at,
                                            selectedReport.completed_at
                                        )}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-slate-500 text-sm mb-1">
                                        Created At
                                    </p>

                                    <p className="text-white">
                                        {formatDate(selectedReport.created_at)}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-slate-500 text-sm mb-1">
                                        Completed At
                                    </p>

                                    <p className="text-white">
                                        {formatDate(selectedReport.completed_at)}
                                    </p>
                                </div>

                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">

                                    <p className="text-slate-500 text-sm">
                                        Findings
                                    </p>

                                    <div className="flex items-center gap-3">

                                        {ACTIVE_STATUSES.has(
                                            (selectedReport.status || "").toUpperCase()
                                        ) && (
                                            <span className="flex items-center gap-1.5 text-xs text-cyan-300">
                                                <Loader2 size={12} className="animate-spin" />
                                                Auto-refreshing
                                            </span>
                                        )}

                                        <button
                                            onClick={copyFindings}
                                            disabled={!selectedReport.findings}
                                            className="bg-slate-800/60 hover:bg-slate-700 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-all duration-200 disabled:opacity-40"
                                        >
                                            {copied ? (
                                                <Check size={13} className="text-green-400" />
                                            ) : (
                                                <Copy size={13} />
                                            )}
                                            {copied ? "Copied" : "Copy"}
                                        </button>

                                    </div>

                                </div>

                                <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-sm text-slate-300 whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                                    {selectedReport.findings || "No findings recorded."}
                                </pre>
                            </div>

                        </div>

                    </div>
                </div>
            )}

            {/* Toast notifications */}
            {toast && (
                <div
                    key={toast.id}
                    className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-xl border backdrop-blur-xl shadow-2xl shadow-black/50 ${
                        toast.type === "success"
                            ? "bg-green-500/15 border-green-500/40"
                            : "bg-red-500/15 border-red-500/40"
                    }`}
                    style={{ animation: "toast-in 0.25s ease-out" }}
                >
                    {toast.type === "success" ? (
                        <CheckCircle2 size={18} className="text-green-400" />
                    ) : (
                        <AlertTriangle size={18} className="text-red-400" />
                    )}

                    <p className="text-sm font-medium text-white">
                        {toast.message}
                    </p>
                </div>
            )}

        </div>
    );
}

export default Scanner;
