import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
    Activity as ActivityIcon,
    Search,
    X,
    Clock,
    Terminal,
    ChevronDown,
    Check,
    ShieldAlert,
    Globe,
    Link as LinkIcon,
    Crosshair,
    FileCode,
} from "lucide-react";
import { getRecentLogs } from "../services/api";
import GlassOverlayModal from "../components/ui/GlassOverlayModal";
import "./Incidents.css";
import "./Activity.css";

// Semantic color mappings from sentinel-activity-design-tokens.json
const SEVERITY_CONFIG = {
    CRITICAL: {
        label: "Critical",
        className: "sev-critical",
        color: "#FF8178",
    },
    HIGH: {
        label: "High",
        className: "sev-high",
        color: "#F2A06E",
    },
    MEDIUM: {
        label: "Medium",
        className: "sev-medium",
        color: "#E8C06F",
    },
    LOW: {
        label: "Low",
        className: "sev-low",
        color: "#84C9A1",
    },
    INFO: {
        label: "Info",
        className: "sev-info",
        color: "#9BB8D1",
    },
    INFORMATIONAL: {
        label: "Info",
        className: "sev-info",
        color: "#9BB8D1",
    },
};

const SEVERITY_OPTIONS = [
    { value: "ALL", label: "Severity: All", color: null },
    { value: "CRITICAL", label: "Critical", color: "#FF8178" },
    { value: "HIGH", label: "High", color: "#F2A06E" },
    { value: "MEDIUM", label: "Medium", color: "#E8C06F" },
    { value: "LOW", label: "Low", color: "#84C9A1" },
    { value: "INFO", label: "Info", color: "#9BB8D1" },
];

const INITIAL_LOGS_LIMIT = 10;

function formatTime(ts) {
    if (!ts) return "—";
    try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return String(ts);
        return d.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
        return String(ts);
    }
}

function formatDate(ts) {
    if (!ts) return "";
    try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    } catch {
        return "";
    }
}

/**
 * Honest origin / location parser.
 * NEVER guesses or fetches external geolocation.
 * Uses reliable fields only if already present on the log record.
 */
function getOriginDisplay(log) {
    const countryCode = log.country_code || (log.country && log.country.length === 2 ? log.country : null);
    const countryName = log.country_name || (log.country && log.country.length > 2 ? log.country : null);
    const city = log.city || log.region || null;

    if (countryCode || countryName || log.location) {
        let flagEmoji = "";
        if (countryCode && /^[A-Za-z]{2}$/.test(countryCode)) {
            const cc = countryCode.toUpperCase();
            flagEmoji = String.fromCodePoint(127397 + cc.charCodeAt(0), 127397 + cc.charCodeAt(1));
        }
        const textParts = [];
        if (countryCode || countryName) textParts.push(countryCode ? countryCode.toUpperCase() : countryName);
        if (city) textParts.push(city);
        if (textParts.length === 0 && log.location) textParts.push(log.location);

        return {
            hasLocation: true,
            flag: flagEmoji,
            label: textParts.join(" · "),
            accessibleText: `Location: ${textParts.join(", ")}`,
        };
    }

    return {
        hasLocation: false,
        flag: null,
        label: "Location unavailable",
        accessibleText: "Location unavailable",
    };
}

/**
 * Floating portal dropdown matching Incident Management glass styling.
 */
function ActivitySeverityDropdown({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0, minWidth: 170 });
    const triggerRef = useRef(null);
    const menuRef = useRef(null);

    const activeOption = SEVERITY_OPTIONS.find((opt) => opt.value === value) || SEVERITY_OPTIONS[0];

    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const menuWidth = Math.max(170, rect.width);
        const preferredLeft = rect.right - menuWidth;
        const left = Math.max(12, Math.min(preferredLeft, window.innerWidth - menuWidth - 12));
        const top = rect.bottom + 8;

        setMenuCoords({
            top,
            left,
            minWidth: menuWidth,
        });
    }, []);

    useEffect(() => {
        if (!open) return;
        updatePosition();

        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [open, updatePosition]);

    useEffect(() => {
        if (!open) return;

        function handleClickOutside(event) {
            if (
                triggerRef.current &&
                !triggerRef.current.contains(event.target) &&
                menuRef.current &&
                !menuRef.current.contains(event.target)
            ) {
                setOpen(false);
            }
        }

        function handleKeyDown(event) {
            if (event.key === "Escape") {
                setOpen(false);
                triggerRef.current?.focus();
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    const handleTriggerKeyDown = (e) => {
        if (!open) {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                const currentIdx = SEVERITY_OPTIONS.findIndex((o) => o.value === value);
                setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);
            }
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex((prev) => Math.min(prev + 1, SEVERITY_OPTIONS.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < SEVERITY_OPTIONS.length) {
                onChange(SEVERITY_OPTIONS[highlightedIndex].value);
            }
            setOpen(false);
            triggerRef.current?.focus();
        } else if (e.key === "Tab") {
            setOpen(false);
        }
    };

    return (
        <div className="relative inline-block flex-shrink-0">
            <button
                ref={triggerRef}
                type="button"
                id="activity-severity-filter-btn"
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((prev) => !prev)}
                onKeyDown={handleTriggerKeyDown}
                className={`inc-glass-control inc-severity-btn ${open ? "is-open" : ""}`}
            >
                <div className="flex items-center gap-2 truncate">
                    {activeOption.color && (
                        <span
                            className="w-[2px] h-[13px] rounded-full shrink-0"
                            style={{ backgroundColor: activeOption.color }}
                            aria-hidden="true"
                        />
                    )}
                    <span className="truncate">{activeOption.label}</span>
                </div>
                <ChevronDown
                    size={14}
                    className={`text-[#8D908D] transition-transform duration-150 shrink-0 ${
                        open ? "rotate-180 text-[#F1F1EF]" : ""
                    }`}
                    aria-hidden="true"
                />
            </button>

            {open && typeof document !== "undefined" && createPortal(
                <ul
                    ref={menuRef}
                    role="listbox"
                    aria-labelledby="activity-severity-filter-btn"
                    className="inc-severity-menu animate-fade-in"
                    style={{
                        position: "fixed",
                        top: `${menuCoords.top}px`,
                        left: `${menuCoords.left}px`,
                        minWidth: `${menuCoords.minWidth}px`,
                        zIndex: 1000,
                    }}
                >
                    {SEVERITY_OPTIONS.map((opt, idx) => {
                        const isSelected = opt.value === value;
                        const isHighlighted = idx === highlightedIndex;
                        return (
                            <li key={opt.value} role="option" aria-selected={isSelected}>
                                <button
                                    type="button"
                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setOpen(false);
                                        triggerRef.current?.focus();
                                    }}
                                    className={`inc-severity-item-btn ${isSelected ? "is-selected" : ""} ${
                                        isHighlighted && !isSelected ? "is-highlighted" : ""
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 truncate">
                                        {opt.color ? (
                                            <span
                                                className="w-[2px] h-[13px] rounded-full shrink-0"
                                                style={{ backgroundColor: opt.color }}
                                                aria-hidden="true"
                                            />
                                        ) : (
                                            <span className="w-[2px] h-[13px] opacity-0 shrink-0" aria-hidden="true" />
                                        )}
                                        <span className="truncate">{opt.label}</span>
                                    </div>
                                    {isSelected && (
                                        <Check size={14} className="text-[#F1F1EF] shrink-0" aria-hidden="true" />
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ul>,
                document.body
            )}
        </div>
    );
}

/**
 * Six-Column Table Header
 * Event Time — Time & Date
 * Source — IP Address
 * Target — Endpoint / URL
 * Detection — Trigger / Rule
 * Severity — Risk Level
 * Details — Action
 */
function ActivityTableHeader({ isSticky = false }) {
    return (
        <thead className={`act-table-head ${isSticky ? "sticky top-0 bg-[rgba(18,19,20,0.96)] backdrop-blur-md z-10" : ""}`}>
            <tr>
                {/* 1. Event Time */}
                <th scope="col" className="act-table-th" style={{ width: "14%" }}>
                    <div className="act-header-group">
                        <div className="act-header-icon" aria-hidden="true">
                            <Clock size={14} />
                        </div>
                        <div className="act-header-text">
                            <span className="act-header-primary">EVENT TIME</span>
                            <span className="act-header-secondary">Time & Date</span>
                        </div>
                    </div>
                </th>

                {/* 2. Source */}
                <th scope="col" className="act-table-th" style={{ width: "14%" }}>
                    <div className="act-header-group">
                        <div className="act-header-icon" aria-hidden="true">
                            <Globe size={14} />
                        </div>
                        <div className="act-header-text">
                            <span className="act-header-primary">SOURCE</span>
                            <span className="act-header-secondary">IP Address</span>
                        </div>
                    </div>
                </th>

                {/* 3. Target */}
                <th scope="col" className="act-table-th" style={{ width: "23%" }}>
                    <div className="act-header-group">
                        <div className="act-header-icon" aria-hidden="true">
                            <LinkIcon size={14} />
                        </div>
                        <div className="act-header-text">
                            <span className="act-header-primary">TARGET</span>
                            <span className="act-header-secondary">Endpoint / URL</span>
                        </div>
                    </div>
                </th>

                {/* 4. Detection */}
                <th scope="col" className="act-table-th" style={{ width: "24%" }}>
                    <div className="act-header-group">
                        <div className="act-header-icon" aria-hidden="true">
                            <Crosshair size={14} />
                        </div>
                        <div className="act-header-text">
                            <span className="act-header-primary">DETECTION</span>
                            <span className="act-header-secondary">Trigger / Rule</span>
                        </div>
                    </div>
                </th>

                {/* 5. Severity */}
                <th scope="col" className="act-table-th" style={{ width: "11%" }}>
                    <div className="act-header-group">
                        <div className="act-header-icon" aria-hidden="true">
                            <ShieldAlert size={14} />
                        </div>
                        <div className="act-header-text">
                            <span className="act-header-primary">SEVERITY</span>
                            <span className="act-header-secondary">Risk Level</span>
                        </div>
                    </div>
                </th>

                {/* 6. Details */}
                <th scope="col" className="act-table-th text-right" style={{ width: "14%" }}>
                    <div className="act-header-group justify-end w-full">
                        <div className="act-header-icon" aria-hidden="true">
                            <FileCode size={14} />
                        </div>
                        <div className="act-header-text text-right">
                            <span className="act-header-primary">DETAILS</span>
                            <span className="act-header-secondary">Action</span>
                        </div>
                    </div>
                </th>
            </tr>
        </thead>
    );
}

/**
 * Continuous Table Rows
 * Unified surface, dense, thin divider between rows, NO individual cards
 */
function ActivityTableRows({ items, onSelect }) {
    return items.map((log, idx) => {
        const rawSev = (log.threat_level || "LOW").toUpperCase();
        const sevConfig = SEVERITY_CONFIG[rawSev] || SEVERITY_CONFIG.LOW;
        const origin = getOriginDisplay(log);

        return (
            <tr
                key={log.id || `${log.timestamp}-${idx}`}
                tabIndex={0}
                role="row"
                onClick={() => onSelect(log)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(log);
                    }
                }}
                className="act-table-row group"
            >
                {/* 1. Event Time */}
                <td className="act-table-td">
                    <div className="flex flex-col min-w-0 font-mono tabular-nums">
                        <span className="text-[12.5px] font-medium text-[#E1DFDA] whitespace-nowrap">
                            {formatTime(log.timestamp)}
                        </span>
                        <span className="text-[10.5px] text-[#858681] mt-0.5 whitespace-nowrap">
                            {formatDate(log.timestamp) || "Recent"}
                        </span>
                    </div>
                </td>

                {/* 2. Source IP & Origin */}
                <td className="act-table-td">
                    <div className="flex flex-col min-w-0 pr-1">
                        <span className="font-mono text-[12.5px] font-semibold text-[#E1DFDA] tabular-nums truncate block">
                            {log.ip_address || "—"}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5 text-[10.5px] text-[#777873] truncate" title={origin.accessibleText}>
                            {origin.flag ? (
                                <span className="text-[12px] leading-none shrink-0" aria-label={origin.accessibleText}>
                                    {origin.flag}
                                </span>
                            ) : (
                                <Globe size={10} className="text-[#858681] shrink-0" aria-hidden="true" />
                            )}
                            <span className="truncate">{origin.label}</span>
                        </div>
                    </div>
                </td>

                {/* 3. Target URL */}
                <td className="act-table-td">
                    <div className="flex flex-col min-w-0 pr-2">
                        <span
                            className="font-mono text-[12.5px] text-[#E1DFDA] truncate block"
                            title={log.url || "/"}
                        >
                            {log.url || "/"}
                        </span>
                        <span className="text-[10.5px] text-[#777873] mt-0.5 truncate block">
                            {log.url ? (log.url.startsWith("http") ? new URL(log.url).hostname : "Inbound request") : "Endpoint"}
                        </span>
                    </div>
                </td>

                {/* 4. Detection Trigger */}
                <td className="act-table-td">
                    <div className="flex flex-col min-w-0 pr-2">
                        <span
                            className="font-sans text-[13px] font-medium text-[#E1DFDA] truncate block leading-snug"
                            title={log.detection_reason || "Normal request traffic"}
                        >
                            {log.detection_reason || "Normal request traffic"}
                        </span>
                        <span
                            className="text-[10.5px] text-[#777873] mt-0.5 truncate block"
                            title={log.user_agent || "Signature detection"}
                        >
                            {log.user_agent ? (log.user_agent.length > 30 ? log.user_agent.slice(0, 30) + "…" : log.user_agent) : "Signature rule"}
                        </span>
                    </div>
                </td>

                {/* 5. Severity */}
                <td className="act-table-td">
                    <div
                        className={`sentinel-severity-chip ${sevConfig.className}`}
                        aria-label={`Severity: ${sevConfig.label}`}
                    >
                        <span className="sev-indicator-dot" aria-hidden="true" />
                        <span>{sevConfig.label}</span>
                    </div>
                </td>

                {/* 6. Details / View Payload */}
                <td className="act-table-td text-right">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect(log);
                        }}
                        className="act-payload-btn"
                        aria-label={`View payload for event ${log.id || log.ip_address || "details"}`}
                    >
                        <span>View Payload</span>
                        <FileCode size={12} className="text-[#A09F9A] shrink-0" aria-hidden="true" />
                    </button>
                </td>
            </tr>
        );
    });
}

/**
 * Skeleton Loading Placeholder Rows
 */
function ActivitySkeletonRows() {
    return Array.from({ length: 6 }).map((_, idx) => (
        <tr key={idx} className="act-table-row pointer-events-none" aria-hidden="true">
            <td className="act-table-td">
                <div className="flex flex-col gap-1">
                    <div className="act-skeleton-pulse h-3.5 w-16" />
                    <div className="act-skeleton-pulse h-2.5 w-12" />
                </div>
            </td>
            <td className="act-table-td">
                <div className="flex flex-col gap-1">
                    <div className="act-skeleton-pulse h-3.5 w-24" />
                    <div className="act-skeleton-pulse h-2.5 w-16" />
                </div>
            </td>
            <td className="act-table-td">
                <div className="flex flex-col gap-1">
                    <div className="act-skeleton-pulse h-3.5 w-32" />
                    <div className="act-skeleton-pulse h-2.5 w-20" />
                </div>
            </td>
            <td className="act-table-td">
                <div className="flex flex-col gap-1">
                    <div className="act-skeleton-pulse h-3.5 w-36" />
                    <div className="act-skeleton-pulse h-2.5 w-24" />
                </div>
            </td>
            <td className="act-table-td">
                <div className="act-skeleton-pulse h-5 w-16 rounded-[6px]" />
            </td>
            <td className="act-table-td text-right">
                <div className="inline-block act-skeleton-pulse h-7 w-24 rounded-md" />
            </td>
        </tr>
    ));
}

function Activity() {
    const [searchParams] = useSearchParams();
    const initialQuery = searchParams.get("q") || searchParams.get("ip") || "";

    const [logs, setLogs] = useState([]);
    const [search, setSearch] = useState(initialQuery);
    const [severityFilter, setSeverityFilter] = useState("ALL");
    const [selectedLog, setSelectedLog] = useState(null);
    const [loading, setLoading] = useState(true);

    // Bounded "See More" overlay state
    const [seeMoreOpen, setSeeMoreOpen] = useState(false);

    useEffect(() => {
        let isMounted = true;
        async function fetchLogs() {
            try {
                const data = await getRecentLogs();
                if (isMounted && Array.isArray(data)) {
                    setLogs(data);
                }
            } catch (err) {
                console.error("Failed to load activity logs", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchLogs();
        const interval = setInterval(fetchLogs, 5000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const filteredLogs = useMemo(() => {
        return logs.filter((log) => {
            const matchesSev =
                severityFilter === "ALL" ||
                (log.threat_level || "LOW").toUpperCase() === severityFilter ||
                (severityFilter === "INFO" && (log.threat_level || "").toUpperCase() === "INFORMATIONAL");
            const q = search.toLowerCase().trim();
            const matchesSearch =
                !q ||
                (log.ip_address || "").toLowerCase().includes(q) ||
                (log.url || "").toLowerCase().includes(q) ||
                (log.detection_reason || "").toLowerCase().includes(q) ||
                (log.threat_level || "").toLowerCase().includes(q);
            return matchesSev && matchesSearch;
        });
    }, [logs, search, severityFilter]);

    // Bounded initial subset for the main page
    const boundedLogs = useMemo(() => {
        return filteredLogs.slice(0, INITIAL_LOGS_LIMIT);
    }, [filteredLogs]);

    const hasMoreRecords = filteredLogs.length > INITIAL_LOGS_LIMIT;

    return (
        <div className="activity-page animate-fade-in select-none">
            {/* Atmospheric overlay */}
            <div className="activity-overlay" aria-hidden="true" />

            {/* Header */}
            <header className="activity-header">
                <div>
                    <div className="flex items-center gap-3">
                        <ActivityIcon size={22} className="text-[#C6C7C5] shrink-0" aria-hidden="true" />
                        <h1 className="act-page-title">SECURITY EVENT STREAM</h1>
                    </div>
                    <p className="act-page-subtitle">
                        Real-time capture of inbound network events, security triggers, and anomalies
                    </p>
                </div>
                <div className="act-stream-badge" role="status" aria-label="Stream status: Active">
                    <span className="w-2 h-2 rounded-full bg-[#91A995] animate-pulse" aria-hidden="true" />
                    <Clock size={13} className="text-[#858681]" aria-hidden="true" />
                    <span>Real-time Stream: Active</span>
                </div>
            </header>

            {/* Filter Toolbar: Wide Glass Search & Outside-Floating Severity Dropdown */}
            <section aria-label="Security event filters" className="activity-toolbar">
                {/* Search Box */}
                <div className="inc-glass-control inc-search-container">
                    <Search
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8D908D] pointer-events-none z-10"
                        aria-hidden="true"
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filter by IP, endpoint URL, threat trigger..."
                        className="inc-search-input"
                        aria-label="Filter events by IP, endpoint URL, or trigger"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#8D908D] hover:text-[#F1F1EF] transition-colors z-10"
                            aria-label="Clear search"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Severity Dropdown */}
                <ActivitySeverityDropdown
                    value={severityFilter}
                    onChange={(newSev) => setSeverityFilter(newSev)}
                />
            </section>

            {/* Main Unified Continuous Event Table */}
            <main className="act-table-container" aria-label="Security event logs">
                <div className="act-table-scroll custom-scrollbar">
                    <table className="act-table" aria-label="Security event stream table">
                        <ActivityTableHeader />
                        <tbody>
                            {loading ? (
                                <ActivitySkeletonRows />
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2 text-xs font-mono text-[#969895]">
                                            <ShieldAlert size={28} className="text-[#858681]" aria-hidden="true" />
                                            <span>No events matching the current criteria.</span>
                                            {(severityFilter !== "ALL" || search) && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSeverityFilter("ALL");
                                                        setSearch("");
                                                    }}
                                                    className="mt-1 text-[#E7E5E1] underline hover:text-white font-sans text-xs transition-colors"
                                                >
                                                    Reset filters
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                <ActivityTableRows
                                    items={boundedLogs}
                                    onSelect={setSelectedLog}
                                />
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Outlined Graphite Glass "See more" Bar (Rendered ONLY when more records exist) */}
                {!loading && hasMoreRecords && (
                    <div className="act-see-more-bar">
                        <button
                            type="button"
                            onClick={() => setSeeMoreOpen(true)}
                            className="act-see-more-btn"
                            aria-label={`See more events. ${filteredLogs.length - INITIAL_LOGS_LIMIT} additional events available.`}
                        >
                            <span>See more events</span>
                            <span className="act-see-more-count">
                                ({filteredLogs.length - INITIAL_LOGS_LIMIT} more · {filteredLogs.length} total)
                            </span>
                            <ChevronDown size={14} className="text-[#C5C3BF]" aria-hidden="true" />
                        </button>
                    </div>
                )}
            </main>

            {/* Floating Glass "See More" Overlay Modal */}
            <GlassOverlayModal
                isOpen={seeMoreOpen}
                onClose={() => setSeeMoreOpen(false)}
                title="Security Event Stream"
                subtitle="Real-time capture of inbound network events, security triggers, and anomalies"
                countBadge={`${filteredLogs.length} events`}
                icon={ActivityIcon}
                footer={
                    <div className="flex items-center justify-between w-full">
                        <span className="font-mono text-xs text-[#969895]">
                            Showing {filteredLogs.length} of {logs.length} total security events
                        </span>
                        <button
                            type="button"
                            onClick={() => setSeeMoreOpen(false)}
                            className="act-payload-btn px-5 h-[32px]"
                        >
                            Close Overlay
                        </button>
                    </div>
                }
            >
                <div className="act-table-scroll custom-scrollbar">
                    <table className="act-table" aria-label="All filtered security event stream logs">
                        <ActivityTableHeader isSticky={true} />
                        <tbody>
                            <ActivityTableRows
                                items={filteredLogs}
                                onSelect={setSelectedLog}
                            />
                        </tbody>
                    </table>
                </div>
            </GlassOverlayModal>

            {/* Event Details Inspection Drawer */}
            {selectedLog && (
                <div
                    className="act-drawer-backdrop animate-fade-in"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setSelectedLog(null);
                    }}
                >
                    <div className="act-drawer-panel custom-scrollbar">
                        {/* Drawer Header */}
                        <div>
                            <div className="flex items-center justify-between pb-4 border-b border-[rgba(230,232,234,0.10)]">
                                <div>
                                    <h3 className="text-lg font-bold tracking-tight text-[#F1F1EF] flex items-center gap-2.5">
                                        <Terminal size={18} className="text-[#C6C7C5]" />
                                        <span>Security Event Inspection</span>
                                    </h3>
                                    <p className="text-xs font-mono text-[#969895] mt-1">
                                        IP: {selectedLog.ip_address || "127.0.0.1"} · Captured at {formatTime(selectedLog.timestamp)}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedLog(null)}
                                    className="p-1.5 rounded-lg text-[#969895] hover:text-[#F1F1EF] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
                                    aria-label="Close event inspection"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Event Metadata Grid */}
                            <div className="my-6 grid grid-cols-2 gap-3 text-xs font-mono">
                                <div className="p-3.5 rounded-xl bg-[rgba(28,29,30,0.60)] border border-[rgba(230,232,234,0.10)]">
                                    <span className="text-[#969895] block uppercase text-[10px] tracking-wider">Source IP</span>
                                    <span className="text-[#F1F1EF] font-bold text-sm mt-0.5 block">{selectedLog.ip_address || "127.0.0.1"}</span>
                                </div>
                                <div className="p-3.5 rounded-xl bg-[rgba(28,29,30,0.60)] border border-[rgba(230,232,234,0.10)]">
                                    <span className="text-[#969895] block uppercase text-[10px] tracking-wider">Severity Level</span>
                                    <span
                                        className="font-bold text-sm mt-0.5 block"
                                        style={{
                                            color:
                                                SEVERITY_CONFIG[(selectedLog.threat_level || "LOW").toUpperCase()]?.color ||
                                                "#91A79A",
                                        }}
                                    >
                                        {selectedLog.threat_level || "LOW"}
                                    </span>
                                </div>
                                <div className="col-span-2 p-3.5 rounded-xl bg-[rgba(28,29,30,0.60)] border border-[rgba(230,232,234,0.10)]">
                                    <span className="text-[#969895] block uppercase text-[10px] tracking-wider">Target Path / URL</span>
                                    <span className="text-[#F1F1EF] font-semibold break-all mt-0.5 block">{selectedLog.url || "/"}</span>
                                </div>
                                <div className="col-span-2 p-3.5 rounded-xl bg-[rgba(28,29,30,0.60)] border border-[rgba(230,232,234,0.10)]">
                                    <span className="text-[#969895] block uppercase text-[10px] tracking-wider">Detection Reason</span>
                                    <span className="text-[#C6C7C5] mt-0.5 block leading-relaxed">{selectedLog.detection_reason || "Normal request"}</span>
                                </div>
                            </div>

                            {/* Raw Event Context Payload */}
                            <div>
                                <h4 className="text-[11px] font-mono text-[#969895] uppercase tracking-wider mb-2">Raw Event Payload</h4>
                                <div className="p-4 rounded-xl bg-[rgba(18,19,20,0.75)] border border-[rgba(230,232,234,0.10)] font-mono text-xs text-[#C6C7C5] overflow-x-auto">
                                    <pre className="whitespace-pre-wrap break-all leading-relaxed">
                                        {JSON.stringify(
                                            {
                                                id: selectedLog.id,
                                                ip_address: selectedLog.ip_address,
                                                url: selectedLog.url,
                                                threat_level: selectedLog.threat_level,
                                                detection_reason: selectedLog.detection_reason,
                                                user_agent: selectedLog.user_agent,
                                                timestamp: selectedLog.timestamp,
                                            },
                                            null,
                                            2
                                        )}
                                    </pre>
                                </div>
                            </div>
                        </div>

                        {/* Drawer Footer */}
                        <div className="pt-4 mt-6 border-t border-[rgba(230,232,234,0.10)] flex items-center justify-end">
                            <button
                                type="button"
                                onClick={() => setSelectedLog(null)}
                                className="act-payload-btn px-5 h-[34px]"
                            >
                                Close Inspection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Activity;
