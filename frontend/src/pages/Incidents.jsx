import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
    TriangleAlert,
    Search,
    Clock,
    CheckCircle2,
    X,
    FileText,
    Activity,
    Zap,
    AlertCircle,
    ChevronDown,
    Check,
    ShieldAlert,
    Globe,
    ExternalLink,
} from "lucide-react";
import {
    getIncidents,
    getIncidentById,
    updateIncidentStatus,
    addIncidentNote,
    createResponseAction,
    executeResponseAction,
} from "../services/api";
import Spinner from "../components/ui/Spinner";
import GlassOverlayModal from "../components/ui/GlassOverlayModal";
import "./Incidents.css";

// Semantic color mappings matching the Sentinel Design System
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
};

const STATUS_CONFIG = {
    OPEN: {
        label: "Open",
        className: "status-open",
        color: "#C5C6C3",
    },
    INVESTIGATING: {
        label: "Investigating",
        className: "status-investigating",
        color: "#D5AB70",
    },
    RESOLVED: {
        label: "Resolved",
        className: "status-resolved",
        color: "#91A995",
    },
};

const SEVERITY_OPTIONS = [
    { value: "ALL", label: "Severity: All", color: null },
    { value: "CRITICAL", label: "Critical", color: "#FF8178" },
    { value: "HIGH", label: "High", color: "#F2A06E" },
    { value: "MEDIUM", label: "Medium", color: "#E8C06F" },
    { value: "LOW", label: "Low", color: "#84C9A1" },
];

const STATUS_TABS = [
    { key: "ALL", label: "All" },
    { key: "OPEN", label: "Open" },
    { key: "INVESTIGATING", label: "Investigating" },
    { key: "RESOLVED", label: "Resolved" },
];

// Initial bounded limit for the main page
const INITIAL_INCIDENTS_LIMIT = 8;

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

function formatTimestamp(ts) {
    if (!ts) return "—";
    try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return String(ts);
        return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${d.toLocaleTimeString([], { hour12: false })}`;
    } catch {
        return String(ts);
    }
}

/**
 * SeverityDropdown
 *
 * Renders the menu via a React Portal to document.body.
 * This guarantees the dropdown floats above the table, does not get clipped
 * by any parent overflow/containers, and never shifts the page or toolbar layout.
 */
function SeverityDropdown({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0, minWidth: 190 });
    const triggerRef = useRef(null);
    const menuRef = useRef(null);

    const activeOption = SEVERITY_OPTIONS.find((opt) => opt.value === value) || SEVERITY_OPTIONS[0];

    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const menuWidth = Math.max(190, rect.width);
        const preferredLeft = rect.right - menuWidth;
        const left = Math.max(12, Math.min(preferredLeft, window.innerWidth - menuWidth - 12));
        const top = rect.bottom + 8; // 8px menuGap from tokens

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
                id="severity-filter-btn"
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

            {/* Portal-rendered floating overlay dropdown menu */}
            {open && typeof document !== "undefined" && createPortal(
                <ul
                    ref={menuRef}
                    role="listbox"
                    aria-labelledby="severity-filter-btn"
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
 * Seven-Column Table Header for Incidents
 * 1. Incident ID — Code / ref (10%)
 * 2. Severity — Risk level (10%)
 * 3. Incident Title — Summary / trigger (31%)
 * 4. Source IP — Origin host (13%)
 * 5. Status — Workflow state (11%)
 * 6. Created At — Detected time (12%)
 * 7. Action — Workspace (13%)
 */
function IncidentTableHeader({ isSticky = false }) {
    return (
        <thead className={`inc-table-head ${isSticky ? "sticky top-0 bg-[rgba(18,19,20,0.96)] backdrop-blur-md z-10" : ""}`}>
            <tr>
                {/* 1. Incident ID */}
                <th scope="col" className="inc-table-th" style={{ width: "10%" }}>
                    <div className="inc-header-group">
                        <div className="inc-header-icon" aria-hidden="true">
                            <ShieldAlert size={14} />
                        </div>
                        <div className="inc-header-text">
                            <span className="inc-header-primary">INCIDENT ID</span>
                            <span className="inc-header-secondary">Code / ref</span>
                        </div>
                    </div>
                </th>

                {/* 2. Severity */}
                <th scope="col" className="inc-table-th" style={{ width: "10%" }}>
                    <div className="inc-header-group">
                        <div className="inc-header-icon" aria-hidden="true">
                            <AlertCircle size={14} />
                        </div>
                        <div className="inc-header-text">
                            <span className="inc-header-primary">SEVERITY</span>
                            <span className="inc-header-secondary">Risk level</span>
                        </div>
                    </div>
                </th>

                {/* 3. Incident Title */}
                <th scope="col" className="inc-table-th" style={{ width: "31%" }}>
                    <div className="inc-header-group">
                        <div className="inc-header-icon" aria-hidden="true">
                            <FileText size={14} />
                        </div>
                        <div className="inc-header-text">
                            <span className="inc-header-primary">INCIDENT TITLE</span>
                            <span className="inc-header-secondary">Summary / trigger</span>
                        </div>
                    </div>
                </th>

                {/* 4. Source IP */}
                <th scope="col" className="inc-table-th" style={{ width: "13%" }}>
                    <div className="inc-header-group">
                        <div className="inc-header-icon" aria-hidden="true">
                            <Globe size={14} />
                        </div>
                        <div className="inc-header-text">
                            <span className="inc-header-primary">SOURCE IP</span>
                            <span className="inc-header-secondary">Origin host</span>
                        </div>
                    </div>
                </th>

                {/* 5. Status */}
                <th scope="col" className="inc-table-th" style={{ width: "11%" }}>
                    <div className="inc-header-group">
                        <div className="inc-header-icon" aria-hidden="true">
                            <CheckCircle2 size={14} />
                        </div>
                        <div className="inc-header-text">
                            <span className="inc-header-primary">STATUS</span>
                            <span className="inc-header-secondary">Workflow state</span>
                        </div>
                    </div>
                </th>

                {/* 6. Created At */}
                <th scope="col" className="inc-table-th" style={{ width: "12%" }}>
                    <div className="inc-header-group">
                        <div className="inc-header-icon" aria-hidden="true">
                            <Clock size={14} />
                        </div>
                        <div className="inc-header-text">
                            <span className="inc-header-primary">CREATED AT</span>
                            <span className="inc-header-secondary">Detected time</span>
                        </div>
                    </div>
                </th>

                {/* 7. Action */}
                <th scope="col" className="inc-table-th text-right" style={{ width: "13%" }}>
                    <div className="inc-header-group justify-end w-full">
                        <div className="inc-header-icon" aria-hidden="true">
                            <ExternalLink size={14} />
                        </div>
                        <div className="inc-header-text text-right">
                            <span className="inc-header-primary">ACTION</span>
                            <span className="inc-header-secondary">Workspace</span>
                        </div>
                    </div>
                </th>
            </tr>
        </thead>
    );
}

/**
 * Continuous Incident Table Rows
 * Unified surface, dense 52px rows, 1px divider between rows, NO individual cards
 */
function IncidentTableRows({ items, onSelect }) {
    return items.map((inc) => {
        const rawSev = (inc.threat_level || inc.threatLevel || "MEDIUM").toUpperCase();
        const sevConfig = SEVERITY_CONFIG[rawSev] || SEVERITY_CONFIG.MEDIUM;
        const code = inc.incident_code || `INC-0${inc.id || 100}`;
        const rawStatus = (inc.status || "OPEN").toUpperCase();
        const statusConfig = STATUS_CONFIG[rawStatus] || STATUS_CONFIG.OPEN;

        return (
            <tr
                key={inc.id}
                tabIndex={0}
                role="row"
                onClick={() => onSelect(inc)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(inc);
                    }
                }}
                className="inc-table-row group"
                aria-label={`Incident ${code}: ${inc.title || "Untitled"}, ${sevConfig.label} severity, ${statusConfig.label} status`}
            >
                {/* 1. Incident Code */}
                <td className="inc-table-td">
                    <div className="flex flex-col min-w-0 font-mono tabular-nums">
                        <span className="text-[12.5px] font-semibold text-[#E1DFDA] whitespace-nowrap">
                            {code}
                        </span>
                        <span className="text-[10.5px] text-[#777873] mt-0.5 truncate block">
                            {inc.event_count ? `${inc.event_count} events` : "Correlated"}
                        </span>
                    </div>
                </td>

                {/* 2. Severity Chip */}
                <td className="inc-table-td">
                    <div
                        className={`sentinel-severity-chip ${sevConfig.className}`}
                        aria-label={`Severity: ${sevConfig.label}`}
                    >
                        <span className="sev-indicator-dot" aria-hidden="true" />
                        <span>{sevConfig.label}</span>
                    </div>
                </td>

                {/* 3. Incident Title */}
                <td className="inc-table-td">
                    <div className="flex flex-col min-w-0 pr-3">
                        <span
                            className="font-sans text-[13px] font-medium text-[#E1DFDA] truncate block leading-snug"
                            title={inc.title || "Unauthorized attack vector"}
                        >
                            {inc.title || "Unauthorized attack vector"}
                        </span>
                        <span
                            className="text-[10.5px] text-[#777873] mt-0.5 truncate block"
                            title={inc.attack_type || inc.category || "Security Alert"}
                        >
                            {inc.attack_type || inc.category || "Security Alert"}
                        </span>
                    </div>
                </td>

                {/* 4. Source IP */}
                <td className="inc-table-td">
                    <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-mono text-[12.5px] font-semibold text-[#E1DFDA] tabular-nums truncate block">
                            {inc.source_ip || "127.0.0.1"}
                        </span>
                        <span className="text-[10.5px] text-[#777873] mt-0.5 truncate block">
                            {inc.target_host || "Origin host"}
                        </span>
                    </div>
                </td>

                {/* 5. Status Chip */}
                <td className="inc-table-td">
                    <div
                        className={`sentinel-status-chip ${statusConfig.className}`}
                        aria-label={`Status: ${statusConfig.label}`}
                    >
                        <span className="status-indicator-dot" aria-hidden="true" />
                        <span>{statusConfig.label}</span>
                    </div>
                </td>

                {/* 6. Created At */}
                <td className="inc-table-td">
                    <div className="flex flex-col min-w-0 font-mono tabular-nums">
                        <span className="text-[12.5px] font-medium text-[#E1DFDA] whitespace-nowrap">
                            {formatTime(inc.created_at)}
                        </span>
                        <span className="text-[10.5px] text-[#858681] mt-0.5 whitespace-nowrap">
                            {formatDate(inc.created_at) || "Recent"}
                        </span>
                    </div>
                </td>

                {/* 7. Action / Open Workspace */}
                <td className="inc-table-td text-right">
                    <div className="flex items-center justify-end">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect(inc);
                            }}
                            className="inc-workspace-btn"
                            aria-label={`Open workspace for incident ${code}`}
                        >
                            <span>Open Workspace</span>
                        </button>
                    </div>
                </td>
            </tr>
        );
    });
}

/**
 * Skeleton Loading Placeholder Rows for Incidents
 */
function IncidentSkeletonRows() {
    return Array.from({ length: 5 }).map((_, idx) => (
        <tr key={idx} className="inc-table-row" aria-hidden="true">
            <td className="inc-table-td">
                <div className="flex flex-col gap-1.5">
                    <div className="inc-skeleton-pulse h-3.5 w-16" />
                    <div className="inc-skeleton-pulse h-2.5 w-12" />
                </div>
            </td>
            <td className="inc-table-td">
                <div className="inc-skeleton-pulse h-5 w-18 rounded-[6px]" />
            </td>
            <td className="inc-table-td">
                <div className="flex flex-col gap-1.5 pr-3">
                    <div className="inc-skeleton-pulse h-3.5 w-44" />
                    <div className="inc-skeleton-pulse h-2.5 w-24" />
                </div>
            </td>
            <td className="inc-table-td">
                <div className="flex flex-col gap-1.5">
                    <div className="inc-skeleton-pulse h-3.5 w-24" />
                    <div className="inc-skeleton-pulse h-2.5 w-14" />
                </div>
            </td>
            <td className="inc-table-td">
                <div className="inc-skeleton-pulse h-5 w-18 rounded-[6px]" />
            </td>
            <td className="inc-table-td">
                <div className="flex flex-col gap-1.5">
                    <div className="inc-skeleton-pulse h-3.5 w-16" />
                    <div className="inc-skeleton-pulse h-2.5 w-12" />
                </div>
            </td>
            <td className="inc-table-td text-right">
                <div className="flex justify-end">
                    <div className="inc-skeleton-pulse h-7 w-28 rounded-[7px]" />
                </div>
            </td>
        </tr>
    ));
}

function Incidents() {
    const [searchParams] = useSearchParams();
    const [incidents, setIncidents] = useState([]);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [severityFilter, setSeverityFilter] = useState("ALL");
    const [search, setSearch] = useState(() => searchParams.get("search") || "");
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [incidentDetail, setIncidentDetail] = useState(null);
    const [listError, setListError] = useState("");
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [statusUpdating, setStatusUpdating] = useState(false);

    // Bounded "See More" overlay state
    const [seeMoreOpen, setSeeMoreOpen] = useState(false);

    // Toast state
    const [toast, setToast] = useState(null);

    // Note form state
    const [newNote, setNewNote] = useState("");
    const [submittingNote, setSubmittingNote] = useState(false);

    // Active tab in investigation drawer
    const [activeTab, setActiveTab] = useState("timeline");

    const showToast = (msg, type = "success") => {
        setToast({ message: msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    const fetchIncidentList = async () => {
        try {
            const data = await getIncidents();
            if (Array.isArray(data)) {
                setIncidents(data);
                setListError("");
            }
        } catch (err) {
            setListError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const initial = setTimeout(fetchIncidentList, 0);
        const interval = setInterval(fetchIncidentList, 10000);
        return () => { clearTimeout(initial); clearInterval(interval); };
    }, []);

    // Load full detail when an incident is selected
    const handleSelectIncident = useCallback(async (inc) => {
        setSelectedIncident(inc);
        setDetailLoading(true);
        try {
            const full = await getIncidentById(inc.id);
            setIncidentDetail(full);
        } catch (err) {
            console.error("Failed to load incident detail", err);
            setIncidentDetail(null);
            showToast("Incident detail unavailable. Retry loading.", "error");
        } finally {
            setDetailLoading(false);
        }
    }, []);

    // Auto-select incident if ?id= query param is provided
    useEffect(() => {
        const idParam = searchParams.get("id");
        if (idParam && incidents.length > 0 && (!selectedIncident || String(selectedIncident.id) !== String(idParam))) {
            const found = incidents.find((inc) => String(inc.id) === String(idParam));
            if (found) {
                const timer = setTimeout(() => {
                    handleSelectIncident(found);
                }, 0);
                return () => clearTimeout(timer);
            }
        }
    }, [searchParams, incidents, selectedIncident, handleSelectIncident]);

    // Update incident status with proper auth handling
    const handleStatusChange = async (newStatus) => {
        if (!selectedIncident) return;
        setStatusUpdating(true);
        try {
            await updateIncidentStatus(selectedIncident.id, newStatus);
            setSelectedIncident((prev) => ({ ...prev, status: newStatus }));
            showToast(`Incident status updated to ${newStatus}.`);
            fetchIncidentList();
            const full = await getIncidentById(selectedIncident.id);
            setIncidentDetail(full);
        } catch (err) {
            showToast(err.message || "Failed to update incident status. Authentication required.", "error");
        } finally {
            setStatusUpdating(false);
        }
    };

    // Add note
    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!newNote.trim() || !selectedIncident) return;
        setSubmittingNote(true);
        try {
            await addIncidentNote(selectedIncident.id, newNote.trim());
            setNewNote("");
            showToast("Analyst note added.");
            const full = await getIncidentById(selectedIncident.id);
            setIncidentDetail(full);
        } catch (err) {
            showToast(err.message || "Failed to add incident note.", "error");
        } finally {
            setSubmittingNote(false);
        }
    };

    // Trigger Real Response Action
    const handleTriggerAction = async (actionType) => {
        if (!selectedIncident) return;
        try {
            const res = await createResponseAction(selectedIncident.id, {
                action_type: actionType,
                target: selectedIncident.source_ip || "",
                reason: `Mitigation action for incident ${selectedIncident.title}`,
            });
            if (res && res.id) {
                const execRes = await executeResponseAction(res.id);
                showToast(`Action ${actionType} ${execRes.status || "requested"} (simulation only; no external enforcement yet).`);
            } else {
                showToast(`Action ${actionType} registered as PENDING.`);
            }
            const full = await getIncidentById(selectedIncident.id);
            setIncidentDetail(full);
        } catch (err) {
            showToast(`Action execution failed: ${err.message}`, "error");
        }
    };

    const filteredIncidents = useMemo(() => {
        return incidents.filter((inc) => {
            const matchesStatus =
                statusFilter === "ALL" || (inc.status || "OPEN").toUpperCase() === statusFilter;
            const matchesSev =
                severityFilter === "ALL" ||
                (inc.threat_level || inc.threatLevel || "MEDIUM").toUpperCase() === severityFilter;
            const q = search.toLowerCase().trim();
            const matchesQuery =
                !q ||
                (inc.title || "").toLowerCase().includes(q) ||
                (inc.source_ip || "").toLowerCase().includes(q) ||
                (inc.incident_code || "").toLowerCase().includes(q);
            return matchesStatus && matchesSev && matchesQuery;
        });
    }, [incidents, statusFilter, severityFilter, search]);

    // Bounded subset for the main page
    const boundedIncidents = useMemo(() => {
        return filteredIncidents.slice(0, INITIAL_INCIDENTS_LIMIT);
    }, [filteredIncidents]);

    const hasMoreRecords = filteredIncidents.length > INITIAL_INCIDENTS_LIMIT;

    return (
        <div className="incidents-page animate-fade-in select-none">
            {/* Atmospheric overlay */}
            <div className="incidents-overlay" aria-hidden="true" />

            {/* Error banner */}
            {listError && (
                <div role="alert" className="mb-5 p-3.5 rounded-[12px] bg-[rgba(209,120,114,0.12)] border border-[rgba(209,120,114,0.3)] text-xs font-mono text-[#D17872] flex items-center justify-between">
                    <span>Incident list unavailable or incomplete: {listError}</span>
                    <button
                        type="button"
                        onClick={fetchIncidentList}
                        className="underline hover:text-[#F1F1EF] transition-colors ml-3 font-sans"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Native Toast */}
            {toast && (
                <div
                    className={`fixed top-5 right-8 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-mono shadow-[0_12px_40px_rgba(0,0,0,0.65)] backdrop-blur-xl animate-fade-in ${
                        toast.type === "error"
                            ? "bg-[rgba(20,21,22,0.96)] border-[rgba(209,120,114,0.4)] text-[#D17872]"
                            : "bg-[rgba(20,21,22,0.96)] border-[rgba(230,232,234,0.30)] text-[#F1F1EF]"
                    }`}
                >
                    {toast.type === "error" ? (
                        <AlertCircle size={15} className="shrink-0" />
                    ) : (
                        <CheckCircle2 size={15} className="text-[#A9B9AE] shrink-0" />
                    )}
                    <span>{toast.message}</span>
                </div>
            )}

            {/* Header: Compact, typography aligned to spec (34px, warm neutral typography) */}
            <header className="incidents-header">
                <div className="flex items-center gap-3">
                    <TriangleAlert size={22} className="text-[#C6C7C5] shrink-0" aria-hidden="true" />
                    <h1 className="inc-page-title">INCIDENT MANAGEMENT</h1>
                </div>
                <p className="inc-page-subtitle">
                    SOC incident triage, evidence correlation, timeline analysis, and countermeasure dispatch
                </p>
            </header>

            {/* Search and Filter Toolbar: 3 Aligned Glass Controls (Search, Segmented Status, Severity) */}
            <section aria-label="Incident filters" className="inc-toolbar">
                {/* 1. Wide Search Box (48px height, 16px radius, neutral graphite glass) */}
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
                        placeholder="Search incidents by code, title, IP..."
                        className="inc-search-input"
                        aria-label="Search incidents by code, title, IP"
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

                {/* 2. Unified Status Segmented Selector (48px height, 17px outer radius) */}
                <div
                    role="tablist"
                    aria-label="Filter incidents by status"
                    className="inc-glass-control inc-status-track"
                >
                    {STATUS_TABS.map((tab) => {
                        const isActive = statusFilter === tab.key;
                        return (
                            <button
                                key={tab.key}
                                role="tab"
                                aria-selected={isActive}
                                type="button"
                                onClick={() => setStatusFilter(tab.key)}
                                className={`inc-status-tab ${isActive ? "is-active" : ""}`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* 3. Severity Dropdown with Outside-Floating Portal Menu */}
                <SeverityDropdown
                    value={severityFilter}
                    onChange={(newSev) => setSeverityFilter(newSev)}
                />
            </section>

            {/* Main Unified Continuous Incident Table */}
            <main className="inc-table-container" aria-label="Incident queue">
                <div className="inc-table-scroll custom-scrollbar">
                    <table className="inc-table" aria-label="Incident queue table">
                        <IncidentTableHeader />
                        <tbody>
                            {loading ? (
                                <IncidentSkeletonRows />
                            ) : filteredIncidents.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2 text-xs font-mono text-[#969895]">
                                            <ShieldAlert size={28} className="text-[#858681]" aria-hidden="true" />
                                            <span>No incidents found matching criteria.</span>
                                            {(statusFilter !== "ALL" || severityFilter !== "ALL" || search) && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setStatusFilter("ALL");
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
                                <IncidentTableRows
                                    items={boundedIncidents}
                                    onSelect={handleSelectIncident}
                                />
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Outlined Graphite Glass "See more" Bar on Main Page (Rendered ONLY when more records exist) */}
                {!loading && hasMoreRecords && (
                    <div className="inc-see-more-bar">
                        <button
                            type="button"
                            onClick={() => setSeeMoreOpen(true)}
                            className="inc-see-more-btn"
                            aria-label={`See more incidents. ${filteredIncidents.length - INITIAL_INCIDENTS_LIMIT} additional incidents available.`}
                        >
                            <span>See more</span>
                            <span className="inc-see-more-count">
                                ({filteredIncidents.length - INITIAL_INCIDENTS_LIMIT} more · {filteredIncidents.length} total)
                            </span>
                            <ChevronDown size={14} className="text-[#C5C3BF]" aria-hidden="true" />
                        </button>
                    </div>
                )}
            </main>

            {/* Bubbly Glass "See More" Floating Overlay Modal */}
            <GlassOverlayModal
                isOpen={seeMoreOpen}
                onClose={() => setSeeMoreOpen(false)}
                title="Incident Management Queue"
                subtitle="Full correlated threat incident records, investigation tracking, and countermeasure dispatch"
                countBadge={`${filteredIncidents.length} incidents`}
                icon={TriangleAlert}
                footer={
                    <div className="flex items-center justify-between w-full">
                        <span className="font-mono text-xs text-[#969895]">
                            Showing {filteredIncidents.length} of {incidents.length} total recorded incidents
                        </span>
                        <button
                            type="button"
                            onClick={() => setSeeMoreOpen(false)}
                            className="inc-workspace-btn px-5 h-[34px]"
                        >
                            Close Overlay
                        </button>
                    </div>
                }
            >
                <div className="inc-table-scroll custom-scrollbar p-1">
                    <table className="inc-table" aria-label="All filtered incidents table">
                        <IncidentTableHeader isSticky />
                        <tbody>
                            <IncidentTableRows
                                items={filteredIncidents}
                                onSelect={handleSelectIncident}
                            />
                        </tbody>
                    </table>
                </div>
            </GlassOverlayModal>

            {/* SOC Investigation Workspace Slide-over Drawer */}
            {selectedIncident && (
                <div
                    className="inc-drawer-backdrop animate-fade-in"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setSelectedIncident(null);
                    }}
                >
                    <div className="inc-drawer-panel custom-scrollbar">
                        {/* Drawer Header */}
                        <div>
                            <div className="flex items-start justify-between pb-4 border-b border-[rgba(230,232,234,0.10)]">
                                <div>
                                    <div className="flex items-center gap-2.5">
                                        <span className="font-mono text-sm font-bold text-[#F1F1EF]">
                                            {selectedIncident.incident_code || `INC-${selectedIncident.id}`}
                                        </span>
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-[rgba(28,29,30,0.72)] border border-[rgba(230,232,234,0.10)]">
                                            <span
                                                className="w-[2px] h-[11px] rounded-full shrink-0"
                                                style={{
                                                    backgroundColor:
                                                        SEVERITY_CONFIG[
                                                            (selectedIncident.threat_level || "CRITICAL").toUpperCase()
                                                        ]?.color || "#D17872",
                                                }}
                                                aria-hidden="true"
                                            />
                                            <span
                                                className="font-mono text-[11px] font-semibold"
                                                style={{
                                                    color:
                                                        SEVERITY_CONFIG[
                                                            (selectedIncident.threat_level || "CRITICAL").toUpperCase()
                                                        ]?.color || "#D17872",
                                                }}
                                            >
                                                {selectedIncident.threat_level || "CRITICAL"}
                                            </span>
                                        </div>
                                    </div>
                                    <h2 className="text-base font-semibold text-[#F1F1EF] mt-2 leading-snug">
                                        {selectedIncident.title || "Security Threat Incident"}
                                    </h2>
                                    <p className="text-xs font-mono text-[#969895] mt-1">
                                        Source: {selectedIncident.source_ip || "127.0.0.1"} · Created {formatTimestamp(selectedIncident.created_at)}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setSelectedIncident(null)}
                                    className="p-1.5 rounded-lg text-[#969895] hover:text-[#F1F1EF] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
                                    aria-label="Close incident workspace"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Status Control Strip */}
                            <div className="flex flex-wrap items-center justify-between gap-3 py-2.5 px-3.5 my-4 rounded-xl bg-[rgba(28,29,30,0.60)] border border-[rgba(230,232,234,0.10)]">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-[#969895]">Current Status:</span>
                                    <span
                                        className="text-xs font-mono font-semibold"
                                        style={{
                                            color:
                                                STATUS_CONFIG[
                                                    (selectedIncident.status || "OPEN").toUpperCase()
                                                ]?.color || "#F1F1EF",
                                        }}
                                    >
                                        {selectedIncident.status || "OPEN"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {["OPEN", "INVESTIGATING", "RESOLVED"].map((st) => {
                                        const isCurrent = selectedIncident.status === st;
                                        return (
                                            <button
                                                key={st}
                                                type="button"
                                                disabled={statusUpdating}
                                                onClick={() => handleStatusChange(st)}
                                                className={`px-3 py-1 rounded-[6px] text-xs font-mono transition-all disabled:opacity-50 cursor-pointer ${
                                                    isCurrent
                                                        ? "bg-[rgba(230,232,234,0.14)] text-[#F1F1EF] font-bold border border-[rgba(230,232,234,0.30)] shadow-sm"
                                                        : "bg-[rgba(255,255,255,0.04)] text-[#B0B2AF] hover:text-[#F1F1EF] border border-[rgba(230,232,234,0.10)]"
                                                }`}
                                            >
                                                Set {st}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Defensive Action Trigger Strip */}
                            <div className="mb-4 p-3 rounded-xl border border-[rgba(230,232,234,0.12)] bg-[rgba(28,29,30,0.60)]">
                                <span className="text-[11px] font-mono text-[#969895] uppercase tracking-wider block mb-2">
                                    Defensive Action Trigger
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleTriggerAction("BLOCK_IP")}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[rgba(209,120,114,0.12)] text-[#D17872] border border-[rgba(209,120,114,0.28)] hover:bg-[rgba(209,120,114,0.20)] text-xs font-mono font-medium transition-colors cursor-pointer"
                                >
                                    <Zap size={13} />
                                    <span>Dispatch BLOCK_IP ({selectedIncident.source_ip || "Target"})</span>
                                </button>
                            </div>

                            {/* Drawer Navigation Tabs */}
                            <div className="flex items-center gap-1 border-b border-[rgba(230,232,234,0.10)] pb-2 mb-4">
                                {[
                                    { key: "timeline", label: "Timeline", icon: Clock },
                                    { key: "evidence", label: "Evidence", icon: FileText },
                                    { key: "notes", label: "Analyst Notes", icon: Activity },
                                ].map((tab) => {
                                    const isCurrent = activeTab === tab.key;
                                    return (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => setActiveTab(tab.key)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] font-mono text-xs transition-all cursor-pointer ${
                                                isCurrent
                                                    ? "bg-[rgba(230,232,234,0.12)] text-[#F1F1EF] font-semibold border-b-2 border-[rgba(230,232,234,0.40)]"
                                                    : "text-[#B0B2AF] hover:text-[#F1F1EF] hover:bg-[rgba(255,255,255,0.04)]"
                                            }`}
                                        >
                                            <tab.icon size={13} />
                                            <span>{tab.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Tab Content */}
                            {detailLoading ? (
                                <div className="py-12 text-center text-xs font-mono text-[#969895] flex items-center justify-center gap-2">
                                    <Spinner size={16} />
                                    <span>Loading forensic evidence & timeline…</span>
                                </div>
                            ) : (
                                <div>
                                    {/* 1. Timeline */}
                                    {activeTab === "timeline" && (
                                        <div className="space-y-3.5">
                                            {(incidentDetail?.timeline || []).length > 0 ? (
                                                incidentDetail.timeline.map((item, idx) => (
                                                    <div key={idx} className="flex gap-3 text-xs">
                                                        <div className="w-2 h-2 rounded-full bg-[#C6C7C5] mt-1.5 shrink-0 shadow-[0_0_6px_rgba(255,255,255,0.4)]" />
                                                        <div>
                                                            <p className="text-[#F1F1EF] font-medium text-[13px] leading-snug">
                                                                {item.event_description || item.action}
                                                            </p>
                                                            <p className="text-xs font-mono text-[#969895] mt-0.5">
                                                                {formatTimestamp(item.created_at)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-xs font-mono text-[#969895] py-4">
                                                    Initial detection registered. Threat lifecycle active.
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 2. Evidence */}
                                    {activeTab === "evidence" && (
                                        <div className="space-y-2.5">
                                            {(incidentDetail?.evidence || []).length > 0 ? (
                                                incidentDetail.evidence.map((ev, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="p-3 rounded-xl bg-[rgba(28,29,30,0.60)] border border-[rgba(230,232,234,0.08)]"
                                                    >
                                                        <div className="flex items-center justify-between text-xs font-mono text-[#969895]">
                                                            <span>Evidence Item #{idx + 1}</span>
                                                            <span className="text-[#F1F1EF] font-semibold">
                                                                {ev.evidence_type}
                                                            </span>
                                                        </div>
                                                        <pre className="text-xs font-mono text-[#F1F1EF] mt-2 whitespace-pre-wrap break-all bg-[rgba(15,16,17,0.50)] p-2 rounded-lg border border-[rgba(230,232,234,0.06)]">
                                                            {ev.data || JSON.stringify(ev, null, 2)}
                                                        </pre>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-3.5 rounded-xl bg-[rgba(28,29,30,0.60)] border border-[rgba(230,232,234,0.08)] font-mono text-xs text-[#C6C7C5] space-y-1">
                                                    <p className="text-[#F1F1EF] font-semibold">Incident Packet Context:</p>
                                                    <p>Target IP: {selectedIncident.source_ip || "192.168.1.101"}</p>
                                                    <p>Rule Matched: {selectedIncident.title}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 3. Analyst Notes */}
                                    {activeTab === "notes" && (
                                        <div className="space-y-4">
                                            <form onSubmit={handleAddNote} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={newNote}
                                                    onChange={(e) => setNewNote(e.target.value)}
                                                    placeholder="Add analyst investigation note…"
                                                    className="flex-1 bg-[rgba(28,29,30,0.72)] border border-[rgba(230,232,234,0.15)] rounded-lg px-3 py-2 text-xs text-[#F1F1EF] placeholder:text-[#8D908D] focus:outline-none focus:border-[rgba(238,240,242,0.48)] focus:ring-1 focus:ring-[rgba(238,240,242,0.25)] transition-all"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={submittingNote || !newNote.trim()}
                                                    className="inc-workspace-btn disabled:opacity-50"
                                                >
                                                    {submittingNote ? "Saving…" : "Post"}
                                                </button>
                                            </form>

                                            <div className="space-y-2">
                                                {(incidentDetail?.notes || []).map((n, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="p-3 rounded-xl bg-[rgba(28,29,30,0.60)] border border-[rgba(230,232,234,0.08)]"
                                                    >
                                                        <div className="flex items-center justify-between text-xs font-mono text-[#969895]">
                                                            <span className="text-[#F1F1EF] font-medium">
                                                                {n.analyst || "SOC Analyst"}
                                                            </span>
                                                            <span>{formatTimestamp(n.created_at)}</span>
                                                        </div>
                                                        <p className="text-xs text-[#C6C7C5] mt-1.5 leading-relaxed font-sans">
                                                            {n.note}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Drawer Footer */}
                        <div className="pt-4 mt-6 border-t border-[rgba(230,232,234,0.10)] flex items-center justify-end">
                            <button
                                type="button"
                                onClick={() => setSelectedIncident(null)}
                                className="inc-workspace-btn px-5 h-[34px]"
                            >
                                Close Workspace
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Incidents;
