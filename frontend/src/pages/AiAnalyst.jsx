import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
    Brain,
    Flame,
    Search,
    RefreshCw,
    CheckCircle2,
    X,
    ExternalLink,
    ChevronRight,
    ChevronDown,
    Check,
    Terminal,
    AlertCircle,
    Cpu,
    ArrowUpRight,
    Filter,
    Shield,
} from "lucide-react";
import { getEvents } from "../services/api";
import { getWebsites } from "../services/websiteApi";
import Spinner from "../components/ui/Spinner";
import "./AiAnalyst.css";

/**
 * Format timestamp cleanly into localized date and 24h time
 */
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
 * Format model confidence percentage safely
 */
function formatConfidence(conf) {
    if (conf === undefined || conf === null || Number.isNaN(Number(conf))) return "—";
    const num = Number(conf);
    const pct = num <= 1 ? Math.round(num * 100) : Math.round(num);
    return `${pct}%`;
}

/**
 * Decision indicator: Pure typography and restrained semantic color.
 * No pill background, no cards, no notification dots.
 */
function DecisionText({ decision }) {
    const d = (decision || "MONITOR").toUpperCase();
    if (d === "RESPOND") {
        return (
            <span className="inline-flex items-center gap-1.5 font-mono font-bold text-[12px] text-[#D77D70] tracking-wider select-none">
                <Flame size={13} className="text-[#D77D70] shrink-0" aria-hidden="true" />
                <span>RESPOND</span>
            </span>
        );
    }
    if (d === "INVESTIGATE") {
        return (
            <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-[12px] text-[#D3A16A] tracking-wider select-none">
                <AlertCircle size={13} className="text-[#D3A16A] shrink-0" aria-hidden="true" />
                <span>INVESTIGATE</span>
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 font-mono font-medium text-[12px] text-[#8BAE98] tracking-wider select-none">
            <CheckCircle2 size={13} className="text-[#8BAE98] shrink-0" aria-hidden="true" />
            <span>MONITOR</span>
        </span>
    );
}

/**
 * Severity indicator: Text-led restrained semantic color.
 * Critical: Coral (#D77D70), High: Amber (#D3A16A), Medium: Warm (#E3B985), Low: Muted (#8C8B86).
 */
function SeverityText({ level }) {
    const sev = (level || "LOW").toUpperCase();
    if (sev === "CRITICAL") {
        return <span className="font-mono font-bold text-[12px] text-[#D77D70] tracking-wider">CRITICAL</span>;
    }
    if (sev === "HIGH") {
        return <span className="font-mono font-semibold text-[12px] text-[#D3A16A] tracking-wider">HIGH</span>;
    }
    if (sev === "MEDIUM") {
        return <span className="font-mono font-medium text-[12px] text-[#E3B985] tracking-wider">MEDIUM</span>;
    }
    return <span className="font-mono font-normal text-[12px] text-[#8C8B86] tracking-wider">LOW</span>;
}

/**
 * Engine indicator: Minimal typographic icon + label.
 */
function EngineText({ engine }) {
    const isAi = engine === "gt-beta-http";
    return (
        <span
            className="inline-flex items-center gap-1.5 font-mono text-[12px] select-none"
            title={isAi ? "Processed by GT-Beta Neural Model" : "Processed by Deterministic Rules"}
        >
            {isAi ? (
                <>
                    <Brain size={12} className="text-[#C8A77E] shrink-0" aria-hidden="true" />
                    <span className="text-[#C8A77E]">GT-Beta (AI)</span>
                </>
            ) : (
                <>
                    <Cpu size={12} className="text-[#8C8B86] shrink-0" aria-hidden="true" />
                    <span className="text-[#8C8B86]">Rules</span>
                </>
            )}
        </span>
    );
}

/**
 * Neutral Graphite Glass Dropdown Control
 * Specification: SENTINEL_AI_ANALYST_FILTER_TOOLBAR_SPEC.md
 * Tokens: SENTINEL_AI_ANALYST_FILTER_TOOLBAR_TOKENS.json
 * - Deep charcoal/graphite translucent fill (rgba(22, 23, 24, 0.72))
 * - Neutral white/gray highlights and borders (NO amber/yellow/gold/orange)
 * - Soft diffuse shadow (0 8px 22px rgba(0, 0, 0, 0.22))
 * - Keyboard navigation (Arrows, Enter, Escape, Space, Tab)
 */
function GlassDropdown({
    label,
    value,
    onChange,
    options,
    id,
    className = "",
    minWidth = "min-w-[150px]",
    heightClass = "h-[44px]",
    radiusClass = "rounded-[12px]",
    align = "left",
}) {
    const [open, setOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const containerRef = useRef(null);

    const activeOption = options.find((o) => o.value === value) || options[0];

    const close = useCallback(() => {
        setOpen(false);
        setHighlightedIndex(-1);
    }, []);

    useEffect(() => {
        if (!open) return;
        const handleMouseDown = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                close();
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === "Escape") close();
        };
        document.addEventListener("mousedown", handleMouseDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleMouseDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, close]);

    const handleKeyDown = (e) => {
        if (!open) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen(true);
                const idx = options.findIndex((o) => o.value === value);
                setHighlightedIndex(idx >= 0 ? idx : 0);
            }
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex((prev) => Math.min(prev + 1, options.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < options.length) {
                onChange(options[highlightedIndex].value);
            }
            close();
        } else if (e.key === "Tab") {
            close();
        }
    };

    return (
        <div ref={containerRef} className={`relative inline-block ${className}`}>
            <button
                type="button"
                id={id}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((prev) => !prev)}
                onKeyDown={handleKeyDown}
                className={`ai-glass-dropdown-btn flex items-center justify-between gap-2.5 px-4 ${heightClass} ${radiusClass} cursor-pointer transition-all select-none w-full ${
                    open ? "is-open" : ""
                }`}
            >
                <div className="flex items-center gap-1.5 truncate">
                    {label && (
                        <span className="text-[#969794] text-[13px] font-normal leading-[1.35] select-none">
                            {label}:
                        </span>
                    )}
                    <span className="text-[#F0F0EE] text-[14px] font-[550] leading-[1.35] truncate">
                        {activeOption?.label || value}
                    </span>
                </div>
                <ChevronDown
                    size={13}
                    className={`transition-transform duration-150 shrink-0 ${
                        open ? "rotate-180 text-[#E5E6E3]" : "text-[#8F918E]"
                    }`}
                    aria-hidden="true"
                />
            </button>

            {open && (
                <ul
                    role="listbox"
                    aria-labelledby={id}
                    className={`absolute ${align === "right" ? "right-0" : "left-0"} top-[calc(100%+6px)] z-50 ${minWidth} ai-glass-dropdown-menu animate-fade-in`}
                >
                    {options.map((opt, idx) => {
                        const isSelected = opt.value === value;
                        const isHighlighted = idx === highlightedIndex;
                        return (
                            <li key={opt.value} role="option" aria-selected={isSelected}>
                                <button
                                    type="button"
                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                    onClick={() => {
                                        onChange(opt.value);
                                        close();
                                    }}
                                    className={`w-full flex items-center justify-between gap-3 text-left ai-dropdown-option cursor-pointer ${
                                        isSelected ? "is-selected" : isHighlighted ? "bg-[rgba(235,236,238,0.04)] text-[#F0F0EE]" : ""
                                    }`}
                                >
                                    <span className="truncate">{opt.label}</span>
                                    {isSelected && (
                                        <Check size={13} className="text-[#E5E6E3] shrink-0" aria-hidden="true" />
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

/**
 * Restrained technical orbit/mesh graphic centered in open workspace for empty state.
 * Uses exact token colors: rgba(190, 184, 172, 0.18) and rgba(211, 161, 106, 0.24).
 * Purely decorative, no glowing nodes, no boxes.
 */
function TechnicalOrbitGraphic() {
    return (
        <svg
            className="w-44 h-44 mx-auto mb-3 pointer-events-none select-none"
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            {/* Concentric orbital rings with 1px fine stroke */}
            <circle
                cx="100"
                cy="100"
                r="88"
                stroke="rgba(190, 184, 172, 0.12)"
                strokeWidth="1"
                strokeDasharray="4 6"
            />
            <circle
                cx="100"
                cy="100"
                r="64"
                stroke="rgba(190, 184, 172, 0.18)"
                strokeWidth="1"
            />
            <circle
                cx="100"
                cy="100"
                r="40"
                stroke="rgba(211, 161, 106, 0.24)"
                strokeWidth="1"
            />
            <circle
                cx="100"
                cy="100"
                r="18"
                stroke="rgba(190, 184, 172, 0.14)"
                strokeWidth="1"
                strokeDasharray="2 3"
            />

            {/* Fine coordinate crosshairs */}
            <line
                x1="100"
                y1="8"
                x2="100"
                y2="192"
                stroke="rgba(190, 184, 172, 0.10)"
                strokeWidth="1"
            />
            <line
                x1="8"
                y1="100"
                x2="192"
                y2="100"
                stroke="rgba(190, 184, 172, 0.10)"
                strokeWidth="1"
            />

            {/* Subtle center reticle */}
            <path
                d="M 96 100 H 104 M 100 96 V 104"
                stroke="rgba(211, 161, 106, 0.40)"
                strokeWidth="1"
            />
            <circle
                cx="100"
                cy="100"
                r="1.5"
                fill="rgba(211, 161, 106, 0.6)"
            />

            {/* Subtle orbital angle tick marks */}
            <line x1="145" y1="55" x2="150" y2="50" stroke="rgba(190, 184, 172, 0.18)" strokeWidth="1" />
            <line x1="55" y1="145" x2="50" y2="150" stroke="rgba(190, 184, 172, 0.18)" strokeWidth="1" />
        </svg>
    );
}

/**
 * Five Telemetry Metrics rendered inside a unified liquid-glass surface.
 * - Prominent typography: 42px primary, 36px supporting.
 * - Clear labels (12.5px) and descriptions (12px).
 * - No five separate cards; one cohesive liquid-glass graphite container.
 */
function TelemetrySequence({ metrics, loading, isRail = true }) {
    const items = [
        {
            id: "analyzed",
            label: "Analyzed Events",
            description: "Total correlated ingestions",
            value: metrics.totalAnalyzed,
            color: "#F2F1EE",
            numberClass: "text-[40px] xl:text-[42px] font-bold",
        },
        {
            id: "respond",
            label: "Respond Required",
            description: "Pending human mitigation triage",
            value: metrics.respondCount,
            color: "#D77D70",
            numberClass: "text-[34px] xl:text-[36px] font-semibold",
        },
        {
            id: "investigate",
            label: "Investigate",
            description: "Correlated suspicious probes",
            value: metrics.investigateCount,
            color: "#D3A16A",
            numberClass: "text-[34px] xl:text-[36px] font-semibold",
        },
        {
            id: "monitor",
            label: "Monitor Only",
            description: "Low-risk routine traffic",
            value: metrics.monitorCount,
            color: "#8BAE98",
            numberClass: "text-[34px] xl:text-[36px] font-semibold",
        },
        {
            id: "neural",
            label: "GT-Beta Neural",
            description: `${metrics.rulesCount} processed via fallback rules`,
            value: metrics.gtBetaCount,
            color: "#C8A77E",
            numberClass: "text-[34px] xl:text-[36px] font-semibold",
        },
    ];

    if (isRail) {
        return (
            <div className="space-y-4">
                <div className="text-[11px] font-mono font-semibold uppercase tracking-[0.08em] text-[#D3A16A] pb-2 border-b border-[rgba(232,232,226,0.11)] select-none">
                    Telemetry Overview
                </div>
                <div className="space-y-4">
                    {items.map((item, idx) => (
                        <div key={item.id}>
                            <div className="flex items-start gap-3.5">
                                <div
                                    style={{ color: item.color }}
                                    className={`${item.numberClass} font-mono leading-none tracking-tight tabular-nums shrink-0 select-none pt-0.5 min-w-[42px]`}
                                >
                                    {loading ? "…" : item.value}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[12.5px] font-semibold uppercase tracking-[0.05em] text-[#C0BFBA] select-none truncate">
                                        {item.label}
                                    </div>
                                    <div className="text-[12px] text-[#8C8B86] leading-[1.45] mt-1">
                                        {item.description}
                                    </div>
                                </div>
                            </div>
                            {idx < items.length - 1 && (
                                <div className="h-[1px] bg-[rgba(232,232,226,0.07)] mt-3.5" aria-hidden="true" />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Tablet & Mobile layout: Compact sequence in a unified liquid-glass surface
    return (
        <div className="ai-telemetry-rail-container">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {items.map((item) => (
                    <div key={item.id} className="space-y-1">
                        <div
                            style={{ color: item.color }}
                            className={`${item.numberClass} font-mono leading-none tracking-tight tabular-nums select-none`}
                        >
                            {loading ? "…" : item.value}
                        </div>
                        <div className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#C0BFBA] select-none">
                            {item.label}
                        </div>
                        <div className="text-[11px] text-[#8C8B86] leading-[1.3] truncate" title={item.description}>
                            {item.description}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function AiAnalyst() {
    const [events, setEvents] = useState([]);
    const [websites, setWebsites] = useState([]);
    const [selectedWebsite, setSelectedWebsite] = useState("ALL");
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [search, setSearch] = useState("");
    const [decisionFilter, setDecisionFilter] = useState("ALL");
    const [severityFilter, setSeverityFilter] = useState("ALL");
    const [engineFilter, setEngineFilter] = useState("ALL");

    // Stream options
    const [autoScroll, setAutoScroll] = useState(false);
    const [groupByAttackType, setGroupByAttackType] = useState(false);

    // Pagination
    const [page, setPage] = useState(1);
    const pageSize = 15;

    const streamTopRef = useRef(null);

    const loadData = useCallback(async () => {
        try {
            setError(null);
            setLoading(true);
            const [eventsRes, websitesRes] = await Promise.allSettled([
                getEvents(selectedWebsite === "ALL" ? null : selectedWebsite, 250),
                getWebsites(),
            ]);

            if (eventsRes.status === "fulfilled" && Array.isArray(eventsRes.value)) {
                setEvents(eventsRes.value);
            } else if (eventsRes.status === "rejected") {
                setError(eventsRes.reason?.message || "Failed to load events");
            }

            if (websitesRes.status === "fulfilled" && Array.isArray(websitesRes.value)) {
                setWebsites(websitesRes.value);
            }
        } catch (err) {
            setError(err.message || "Failed to load security analysis data");
        } finally {
            setLoading(false);
        }
    }, [selectedWebsite]);

    useEffect(() => {
        let isMounted = true;
        const fetchInitialData = async () => {
            try {
                const [eventsRes, websitesRes] = await Promise.allSettled([
                    getEvents(selectedWebsite === "ALL" ? null : selectedWebsite, 250),
                    getWebsites(),
                ]);
                if (!isMounted) return;
                if (eventsRes.status === "fulfilled" && Array.isArray(eventsRes.value)) {
                    setEvents(eventsRes.value);
                } else if (eventsRes.status === "rejected") {
                    setError(eventsRes.reason?.message || "Failed to load events");
                }
                if (websitesRes.status === "fulfilled" && Array.isArray(websitesRes.value)) {
                    setWebsites(websitesRes.value);
                }
            } catch (err) {
                if (isMounted) setError(err.message || "Failed to load security analysis data");
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchInitialData();
        return () => { isMounted = false; };
    }, [selectedWebsite]);

    // Handle Escape key to close inspector drawer
    useEffect(() => {
        if (!selectedEvent) return;
        const handleKeyDown = (e) => {
            if (e.key === "Escape") setSelectedEvent(null);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedEvent]);

    // Handle Auto-scroll
    useEffect(() => {
        if (autoScroll && streamTopRef.current) {
            streamTopRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    }, [autoScroll, events, page]);

    // Overview Metrics calculated strictly from authorized event data (mirrors computeAnalystMetrics)
    const metrics = useMemo(() => {
        let totalAnalyzed = 0;
        let respondCount = 0;
        let investigateCount = 0;
        let monitorCount = 0;
        let gtBetaCount = 0;
        let rulesCount = 0;

        const severityDist = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

        events.forEach((ev) => {
            const ar = ev.analyst_result;
            if (!ar) return;
            totalAnalyzed += 1;

            const dec = (ar.decision || "").toUpperCase();
            if (dec === "RESPOND") respondCount += 1;
            else if (dec === "INVESTIGATE") investigateCount += 1;
            else monitorCount += 1;

            const sev = (ar.threat_level || ev.threat_level || "LOW").toUpperCase();
            if (severityDist[sev] !== undefined) {
                severityDist[sev] += 1;
            }

            if (ar.engine === "gt-beta-http") {
                gtBetaCount += 1;
            } else {
                rulesCount += 1;
            }
        });

        return {
            totalAnalyzed,
            respondCount,
            investigateCount,
            monitorCount,
            gtBetaCount,
            rulesCount,
            severityDist,
        };
    }, [events]);

    // Filtered Feed
    const filteredEvents = useMemo(() => {
        return events.filter((ev) => {
            const ar = ev.analyst_result || {};
            const dec = (ar.decision || "").toUpperCase();
            const sev = (ar.threat_level || ev.threat_level || "LOW").toUpperCase();
            const eng = ar.engine || "deterministic_rules_v1";

            if (decisionFilter !== "ALL" && dec !== decisionFilter) return false;
            if (severityFilter !== "ALL" && sev !== severityFilter) return false;
            if (engineFilter !== "ALL") {
                if (engineFilter === "AI" && eng !== "gt-beta-http") return false;
                if (engineFilter === "RULES" && eng !== "deterministic_rules_v1") return false;
            }

            if (search.trim()) {
                const q = search.toLowerCase();
                const ip = (ev.ip_address || "").toLowerCase();
                const title = (ev.title || "").toLowerCase();
                const atk = (ar.attack_type || "").toLowerCase();
                const reason = (ar.reason || "").toLowerCase();
                const target = (ar.target || "").toLowerCase();
                if (
                    !ip.includes(q) &&
                    !title.includes(q) &&
                    !atk.includes(q) &&
                    !reason.includes(q) &&
                    !target.includes(q)
                ) {
                    return false;
                }
            }

            return true;
        });
    }, [events, decisionFilter, severityFilter, engineFilter, search]);

    // Paginated subset
    const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
    const currentEvents = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredEvents.slice(start, start + pageSize);
    }, [filteredEvents, page, pageSize]);

    // Grouping by Attack Type for the current page
    const groupedEventEntries = useMemo(() => {
        if (!groupByAttackType) return null;
        const map = new Map();
        currentEvents.forEach((ev) => {
            const key = ev.analyst_result?.attack_type || "Uncategorized";
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(ev);
        });
        return Array.from(map.entries());
    }, [groupByAttackType, currentEvents]);

    // Asset dropdown options
    const assetOptions = useMemo(() => {
        const list = [{ value: "ALL", label: "All Monitored Assets" }];
        websites.forEach((w) => {
            list.push({
                value: String(w.id),
                label: `${w.name} (${w.domain || w.url})`,
            });
        });
        return list;
    }, [websites]);

    const isFilterActive =
        decisionFilter !== "ALL" || severityFilter !== "ALL" || engineFilter !== "ALL";

    return (
        <div className="ai-analyst-page relative">
            {/* Atmospheric overlay to guarantee text legibility over dark smoky background */}
            <div className="ai-analyst-overlay" aria-hidden="true" />

            {/* Main content layer */}
            <div className="relative z-10 space-y-[24px]">
                {/* Header Row */}
                <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                        <h1 className="ai-page-title">
                            AI Analyst Intelligence
                        </h1>
                        <p className="ai-page-desc mt-1.5 max-w-3xl">
                            Correlated telemetry triage and automated reasoning powered by GT-Beta & deterministic guardrails
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto pt-1">
                        <button
                            type="button"
                            onClick={loadData}
                            className="ai-action-btn inline-flex items-center gap-1.5"
                            title="Refresh telemetry stream"
                        >
                            <RefreshCw
                                size={14}
                                className={loading ? "animate-spin text-[#D3A16A]" : "text-[#B9BBB8]"}
                                aria-hidden="true"
                            />
                            <span>Refresh Telemetry</span>
                        </button>
                        <Link
                            to="/response-actions"
                            className="ai-action-btn-highlight inline-flex items-center gap-1.5"
                        >
                            <span>Response Queue</span>
                            <ArrowUpRight size={14} className="text-[#D3A16A]" aria-hidden="true" />
                        </Link>
                    </div>
                </header>

                {/* Error Banner */}
                {error && (
                    <div
                        role="alert"
                        className="py-3 px-4 border border-[rgba(215,125,112,0.35)] bg-[rgba(215,125,112,0.08)] text-xs text-[#D77D70] flex items-center justify-between gap-3 rounded-[11px]"
                    >
                        <div className="flex items-center gap-2">
                            <AlertCircle size={16} className="shrink-0" />
                            <span>{error}</span>
                        </div>
                        <button
                            type="button"
                            onClick={loadData}
                            className="px-3 py-1.5 text-[11px] font-mono font-medium text-white bg-[rgba(215,125,112,0.22)] hover:bg-[rgba(215,125,112,0.32)] transition-colors rounded-[8px]"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* Asymmetric 2-Column Desktop Grid / Stacked Tablet & Mobile */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] xl:grid-cols-[1fr_320px] gap-6 xl:gap-8 items-start">
                    {/* Left Column: Main Analysis Workspace (~75%) */}
                    <main className="min-w-0 space-y-[22px]">
                        {/* Zero-Trust Governance Notice: Slim editorial strip */}
                        <section aria-labelledby="governance-heading" className="py-3.5 border-y border-[rgba(232,232,226,0.11)]">
                            <div className="flex items-start gap-3">
                                <Shield size={16} className="text-[#D3A16A] mt-0.5 shrink-0" aria-hidden="true" />
                                <div className="space-y-1">
                                    <h2
                                        id="governance-heading"
                                        className="ai-governance-title"
                                    >
                                        Zero-Trust Response Governance Policy
                                    </h2>
                                    <p className="ai-governance-body">
                                        Defensive recommendations generated by the Sentinel AI Analyst (including{" "}
                                        <span className="font-mono text-[#F2F1EE] font-medium">RESPOND</span> recommendations)
                                        are strictly informational and advisory. In accordance with zero-trust safety principles,
                                        automatic firewall changes or host isolations are completely disabled. Operator
                                        authorization in the Response Action queue is mandatory prior to defensive execution.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Filter Toolbar: Row 1 — Search and Asset Selector */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            {/* Search Input: 46px height, 13px radius, neutral graphite glass */}
                            <div className="relative flex-1 min-w-[260px] max-w-xl">
                                <Search
                                    size={16}
                                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8F918E] pointer-events-none"
                                    aria-hidden="true"
                                />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value);
                                        setPage(1);
                                    }}
                                    placeholder="Search by IP, attack type, or reason..."
                                    className="ai-search-input w-full pl-10 pr-9 font-sans"
                                    aria-label="Search events"
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearch("");
                                            setPage(1);
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8F918E] hover:text-[#F0F0EE] p-1 transition-colors"
                                        aria-label="Clear search query"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Asset Selector: 46px height, 13px radius, neutral graphite glass */}
                            {websites.length > 0 && (
                                <GlassDropdown
                                    id="asset-selector-dropdown"
                                    label="Asset"
                                    value={selectedWebsite}
                                    onChange={(val) => {
                                        setSelectedWebsite(val);
                                        setPage(1);
                                    }}
                                    options={assetOptions}
                                    minWidth="min-w-[210px] max-w-[340px]"
                                    heightClass="h-[46px]"
                                    radiusClass="rounded-[13px]"
                                    className="shrink-0"
                                    align="right"
                                />
                            )}
                        </div>

                        {/* Filter Toolbar: Row 2 — Decision, Severity, and Engine Dropdowns (44px, 12px radius) */}
                        <div className="flex flex-wrap items-center gap-3">
                            <GlassDropdown
                                id="decision-filter-dropdown"
                                label="Decision"
                                value={decisionFilter}
                                onChange={(val) => {
                                    setDecisionFilter(val);
                                    setPage(1);
                                }}
                                options={[
                                    { value: "ALL", label: "All Decisions" },
                                    { value: "RESPOND", label: "Respond" },
                                    { value: "INVESTIGATE", label: "Investigate" },
                                    { value: "MONITOR", label: "Monitor" },
                                ]}
                                minWidth="min-w-[150px]"
                                heightClass="h-[44px]"
                                radiusClass="rounded-[12px]"
                            />

                            <GlassDropdown
                                id="severity-filter-dropdown"
                                label="Severity"
                                value={severityFilter}
                                onChange={(val) => {
                                    setSeverityFilter(val);
                                    setPage(1);
                                }}
                                options={[
                                    { value: "ALL", label: "All Severities" },
                                    { value: "CRITICAL", label: "Critical" },
                                    { value: "HIGH", label: "High" },
                                    { value: "MEDIUM", label: "Medium" },
                                    { value: "LOW", label: "Low" },
                                ]}
                                minWidth="min-w-[150px]"
                                heightClass="h-[44px]"
                                radiusClass="rounded-[12px]"
                            />

                            <GlassDropdown
                                id="engine-filter-dropdown"
                                label="Engine"
                                value={engineFilter}
                                onChange={(val) => {
                                    setEngineFilter(val);
                                    setPage(1);
                                }}
                                options={[
                                    { value: "ALL", label: "All Engines" },
                                    { value: "AI", label: "GT-Beta (AI)" },
                                    { value: "RULES", label: "Rules" },
                                ]}
                                minWidth="min-w-[150px]"
                                heightClass="h-[44px]"
                                radiusClass="rounded-[12px]"
                            />

                            {/* Reset Button (visible when any filter is active) */}
                            {isFilterActive && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDecisionFilter("ALL");
                                        setSeverityFilter("ALL");
                                        setEngineFilter("ALL");
                                        setPage(1);
                                    }}
                                    className="text-[12.5px] font-mono text-[#969794] hover:text-[#F0F0EE] transition-colors px-2.5 py-1 select-none"
                                >
                                    Reset Filters
                                </button>
                            )}
                        </div>

                        {/* Tablet & Mobile Telemetry Sequence: Visible only below lg breakpoint */}
                        <div className="block lg:hidden">
                            <TelemetrySequence metrics={metrics} loading={loading} isRail={false} />
                        </div>

                        {/* Correlated Analysis Stream: Primary Open Workspace */}
                        <section aria-labelledby="stream-heading" className="space-y-3 pt-3">
                            {/* Stream Heading Row */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-[rgba(232,232,226,0.11)]">
                                <div className="flex items-center gap-2.5">
                                    <Filter size={14} className="text-[#D3A16A]" aria-hidden="true" />
                                    <h2
                                        id="stream-heading"
                                        className="text-[13.5px] font-semibold uppercase tracking-[0.02em] text-[#F2F1EE] font-mono"
                                    >
                                        Correlated Analysis Stream
                                    </h2>
                                    <span className="text-[13px] font-mono text-[#8C8B86]">
                                        ({filteredEvents.length} {filteredEvents.length === 1 ? "event" : "events"})
                                    </span>
                                </div>

                                {/* Stream Controls: Auto-scroll & Group by Attack Type */}
                                <div className="flex items-center gap-4 text-[13px] font-sans">
                                    <button
                                        type="button"
                                        onClick={() => setAutoScroll((v) => !v)}
                                        aria-pressed={autoScroll}
                                        className={`inline-flex items-center gap-1.5 transition-colors select-none ${
                                            autoScroll ? "text-[#F2F1EE] font-medium" : "text-[#8C8B86] hover:text-[#C0BFBA]"
                                        }`}
                                    >
                                        <span
                                            className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                                autoScroll ? "bg-[#D3A16A]" : "bg-[rgba(232,232,226,0.25)]"
                                            }`}
                                            aria-hidden="true"
                                        />
                                        <span>Auto-scroll</span>
                                    </button>

                                    <span className="w-[1px] h-3.5 bg-[rgba(232,232,226,0.12)]" aria-hidden="true" />

                                    <button
                                        type="button"
                                        onClick={() => setGroupByAttackType((v) => !v)}
                                        aria-pressed={groupByAttackType}
                                        className={`inline-flex items-center gap-1.5 transition-colors select-none ${
                                            groupByAttackType ? "text-[#F2F1EE] font-medium" : "text-[#8C8B86] hover:text-[#C0BFBA]"
                                        }`}
                                    >
                                        <span
                                            className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                                groupByAttackType ? "bg-[#D3A16A]" : "bg-[rgba(232,232,226,0.25)]"
                                            }`}
                                            aria-hidden="true"
                                        />
                                        <span>Group by Attack Type</span>
                                    </button>
                                </div>
                            </div>

                            {/* Scroll anchor */}
                            <div ref={streamTopRef} />

                            {/* Stream Body */}
                            {loading ? (
                                <div className="py-24 flex flex-col items-center justify-center gap-3">
                                    <Spinner size={24} className="text-[#D3A16A]" />
                                    <p className="text-[13px] font-mono text-[#8C8B86]">Correlating security telemetry…</p>
                                </div>
                            ) : filteredEvents.length === 0 ? (
                                /* Empty State: Restrained technical orbit graphic, understated and card-free */
                                <div className="py-16 text-center space-y-2">
                                    <TechnicalOrbitGraphic />
                                    <h3 className="text-[14px] font-medium text-[#E8E7E2]">No analysis events</h3>
                                    <p className="text-[12.5px] text-[#B0AFA9] max-w-sm mx-auto leading-relaxed">
                                        Correlated telemetry events will appear here as they are processed.
                                    </p>
                                    {(search || isFilterActive) && (
                                        <div className="pt-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSearch("");
                                                    setDecisionFilter("ALL");
                                                    setSeverityFilter("ALL");
                                                    setEngineFilter("ALL");
                                                    setPage(1);
                                                }}
                                                className="text-[12.5px] font-mono text-[#D3A16A] hover:underline"
                                            >
                                                Reset active filters
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Populated State: Open continuous stream with fine dividers */
                                <div className="overflow-x-auto">
                                    <table className="ai-stream-table text-left border-collapse">
                                        <thead>
                                            <tr>
                                                <th>Timestamp</th>
                                                <th>Source IP</th>
                                                <th>Target</th>
                                                <th>Attack Type</th>
                                                <th>Severity</th>
                                                <th>Decision</th>
                                                <th>Confidence</th>
                                                <th>Engine</th>
                                                <th className="text-right"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {groupByAttackType && groupedEventEntries ? (
                                                /* Grouped View */
                                                groupedEventEntries.map(([groupName, groupEvents]) => (
                                                    <GroupedSection
                                                        key={groupName}
                                                        groupName={groupName}
                                                        events={groupEvents}
                                                        selectedEvent={selectedEvent}
                                                        onSelect={setSelectedEvent}
                                                    />
                                                ))
                                            ) : (
                                                /* Continuous Stream */
                                                currentEvents.map((ev) => (
                                                    <EventRow
                                                        key={ev.id}
                                                        ev={ev}
                                                        isSelected={selectedEvent?.id === ev.id}
                                                        onSelect={setSelectedEvent}
                                                    />
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Pagination Footer */}
                            {totalPages > 1 && (
                                <div className="pt-3.5 border-t border-[rgba(232,232,226,0.09)] flex items-center justify-between text-[12.5px] text-[#8C8B86] font-mono">
                                    <span>
                                        Page {page} of {totalPages}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            disabled={page <= 1}
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            className="ai-action-btn py-1 px-3 text-xs font-mono disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            Prev
                                        </button>
                                        <button
                                            type="button"
                                            disabled={page >= totalPages}
                                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                            className="ai-action-btn py-1 px-3 text-xs font-mono disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </section>
                    </main>

                    {/* Right Column: Telemetry Rail (~25%, desktop only) */}
                    <aside
                        aria-label="Telemetry Rail"
                        className="hidden lg:block sticky top-6 self-start w-full"
                    >
                        <div className="ai-telemetry-rail-container">
                            <TelemetrySequence metrics={metrics} loading={loading} isRail={true} />
                        </div>
                    </aside>
                </div>
            </div>

            {/* Analysis Detail Inspector: Slide-over drawer with fine hairlines */}
            {selectedEvent && (
                <div
                    className="fixed inset-0 z-40 flex justify-end"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Event detail inspector"
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-[rgba(4,5,8,0.70)] backdrop-blur-[8px] animate-fade-in"
                        onClick={() => setSelectedEvent(null)}
                        aria-hidden="true"
                    />

                    {/* Inspector Drawer Panel */}
                    <div className="relative w-full max-w-lg h-full bg-gradient-to-b from-[#141210] to-[#0d0c0a] border-l border-[rgba(232,232,226,0.16)] shadow-[-24px_0_64px_rgba(0,0,0,0.75)] flex flex-col z-10 overflow-hidden">
                        {/* Drawer Header */}
                        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-[rgba(232,232,226,0.11)] shrink-0">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs text-[#8C8B86]">
                                        EVENT #{selectedEvent.id}
                                    </span>
                                    <span className="text-[#8C8B86]">·</span>
                                    <EngineText engine={selectedEvent.analyst_result?.engine} />
                                </div>
                                <h2 className="text-[17px] font-bold text-[#F2F1EE] mt-1">
                                    {selectedEvent.title || "Security Telemetry Analysis"}
                                </h2>
                                <p className="text-[12px] font-mono text-[#8C8B86] mt-0.5">
                                    Recorded at {formatTimestamp(selectedEvent.created_at)}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedEvent(null)}
                                className="p-1.5 rounded-lg text-[#8C8B86] hover:text-[#F2F1EE] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                                aria-label="Close inspector"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Drawer Body */}
                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-xs">
                            {/* Decision & Severity */}
                            <div className="pb-4 border-b border-[rgba(232,232,226,0.09)] space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[#8C8B86]">Triage Decision:</span>
                                        <DecisionText decision={selectedEvent.analyst_result?.decision} />
                                    </div>
                                    <SeverityText
                                        level={
                                            selectedEvent.analyst_result?.threat_level ||
                                            selectedEvent.threat_level ||
                                            selectedEvent.severity
                                        }
                                    />
                                </div>

                                {selectedEvent.analyst_result?.decision === "RESPOND" && (
                                    <div className="p-3 border border-[rgba(215,125,112,0.30)] bg-[rgba(215,125,112,0.08)] text-[12px] text-[#D77D70] flex items-center justify-between rounded-[8px]">
                                        <span>Advisory: Response action requires operator approval.</span>
                                        <Link
                                            to="/response-actions"
                                            className="underline hover:text-[#F2F1EE] inline-flex items-center gap-0.5 font-mono ml-2 shrink-0"
                                        >
                                            View Queue <ExternalLink size={10} />
                                        </Link>
                                    </div>
                                )}
                            </div>

                            {/* Categorization & Confidence */}
                            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[rgba(232,232,226,0.09)]">
                                <div>
                                    <div className="text-[11px] font-mono uppercase tracking-wider text-[#8C8B86]">
                                        Attack Categorization
                                    </div>
                                    <div
                                        className="font-semibold text-[#F2F1EE] mt-1 text-[13px] truncate"
                                        title={selectedEvent.analyst_result?.attack_type || "None"}
                                    >
                                        {selectedEvent.analyst_result?.attack_type || "Uncategorized"}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[11px] font-mono uppercase tracking-wider text-[#8C8B86]">
                                        Model Confidence
                                    </div>
                                    <div className="font-semibold text-[#F2F1EE] mt-1 text-[13px] font-mono">
                                        {formatConfidence(selectedEvent.analyst_result?.confidence)}
                                    </div>
                                </div>
                            </div>

                            {/* Assessment & Reasoning */}
                            <div className="space-y-2 pb-4 border-b border-[rgba(232,232,226,0.09)]">
                                <div className="text-[11.5px] font-mono font-semibold uppercase tracking-wider text-[#8C8B86] flex items-center gap-1.5">
                                    <Terminal size={12} className="text-[#D3A16A]" aria-hidden="true" />
                                    <span>Analyst Assessment & Reasoning</span>
                                </div>
                                <div className="p-3.5 bg-[rgba(8,9,10,0.55)] border border-[rgba(232,232,226,0.09)] rounded-[8px] font-mono text-[12px] text-[#C0BFBA] leading-relaxed whitespace-pre-wrap">
                                    {selectedEvent.analyst_result?.reason || "No automated explanation provided by engine."}
                                </div>
                            </div>

                            {/* Ground-Truth Evidence */}
                            {Array.isArray(selectedEvent.analyst_result?.evidence) &&
                                selectedEvent.analyst_result.evidence.length > 0 && (
                                    <div className="space-y-2 pb-4 border-b border-[rgba(232,232,226,0.09)]">
                                        <div className="text-[11.5px] font-mono font-semibold uppercase tracking-wider text-[#8C8B86]">
                                            Correlated Ground-Truth Evidence
                                        </div>
                                        <ul className="space-y-1.5 text-xs">
                                            {selectedEvent.analyst_result.evidence.map((item, idx) => (
                                                <li
                                                    key={idx}
                                                    className="p-2.5 border border-[rgba(232,232,226,0.09)] rounded-[8px] font-mono text-[11.5px] text-[#C0BFBA] flex items-start gap-2"
                                                >
                                                    <span className="text-[#D3A16A] font-bold select-none">›</span>
                                                    <span className="break-all">{String(item)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                            {/* Recommended Actions */}
                            {Array.isArray(selectedEvent.analyst_result?.recommended_actions) &&
                                selectedEvent.analyst_result.recommended_actions.length > 0 && (
                                    <div className="space-y-2 pb-4 border-b border-[rgba(232,232,226,0.09)]">
                                        <div className="text-[11.5px] font-mono font-semibold uppercase tracking-wider text-[#8C8B86]">
                                            Recommended Next Steps
                                        </div>
                                        <ul className="space-y-1.5 text-xs">
                                            {selectedEvent.analyst_result.recommended_actions.map((act, idx) => (
                                                <li
                                                    key={idx}
                                                    className="p-2.5 border border-[rgba(232,232,226,0.09)] rounded-[8px] font-mono text-[12px] text-[#F2F1EE] flex items-center gap-2"
                                                >
                                                    <span className="w-1.5 h-1.5 rounded-full bg-[#D3A16A] shrink-0" />
                                                    <span>{String(act)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                            {/* Raw Telemetry Context */}
                            <div className="space-y-2">
                                <div className="text-[11.5px] font-mono font-semibold uppercase tracking-wider text-[#8C8B86]">
                                    Raw Telemetry Attributes
                                </div>
                                <div className="p-3.5 bg-[rgba(8,9,10,0.55)] border border-[rgba(232,232,226,0.09)] rounded-[8px] font-mono text-[12px] space-y-1.5 text-[#8C8B86]">
                                    <div className="flex justify-between">
                                        <span>Source IP:</span>
                                        <span className="text-[#F2F1EE]">{selectedEvent.ip_address || "—"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Target Entity:</span>
                                        <span className="text-[#F2F1EE]">{selectedEvent.analyst_result?.target || "—"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Event Type:</span>
                                        <span className="text-[#F2F1EE]">{selectedEvent.event_type}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Risk Score:</span>
                                        <span className="text-[#F2F1EE]">{selectedEvent.risk_score ?? "—"}/100</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Requires Approval:</span>
                                        <span className="text-[#8BAE98]">
                                            {String(selectedEvent.analyst_result?.requires_approval ?? true)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Source IP Trusted:</span>
                                        <span className="text-[#D77D70]">
                                            {String(selectedEvent.analyst_result?.source_ip_trusted ?? false)}
                                        </span>
                                    </div>
                                    {selectedEvent.user_agent && (
                                        <div className="pt-1.5 border-t border-[rgba(232,232,226,0.09)]">
                                            <span>User Agent: </span>
                                            <span className="text-[#C0BFBA] break-all">
                                                {selectedEvent.user_agent}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Grouped Section Component when Group by Attack Type is enabled
 */
function GroupedSection({ groupName, events, selectedEvent, onSelect }) {
    return (
        <>
            <tr className="border-b border-[rgba(232,232,226,0.11)] bg-[rgba(255,255,255,0.02)]">
                <td colSpan={9} className="py-2.5 px-3.5 text-[12px] font-mono font-semibold uppercase tracking-wider text-[#D3A16A]">
                    <span className="mr-1.5 select-none font-bold">›</span>
                    <span>{groupName}</span>
                    <span className="text-[#8C8B86] font-normal ml-2">
                        ({events.length} {events.length === 1 ? "event" : "events"})
                    </span>
                </td>
            </tr>
            {events.map((ev) => (
                <EventRow
                    key={ev.id}
                    ev={ev}
                    isSelected={selectedEvent?.id === ev.id}
                    onSelect={onSelect}
                />
            ))}
        </>
    );
}

/**
 * Individual Event Row in the continuous stream
 */
function EventRow({ ev, isSelected, onSelect }) {
    const ar = ev.analyst_result || {};

    return (
        <tr
            onClick={() => onSelect(ev)}
            className={`ai-stream-row ${isSelected ? "is-selected" : ""}`}
        >
            <td className="font-mono text-[12px] text-[#8C8B86] whitespace-nowrap">
                {formatTimestamp(ev.created_at)}
            </td>
            <td className="font-mono text-[#F2F1EE] whitespace-nowrap text-[13px]">
                {ev.ip_address || "—"}
            </td>
            <td
                className="font-mono text-[12px] text-[#C0BFBA] max-w-[160px] truncate"
                title={ar.target || ev.title}
            >
                {ar.target || ev.title || "—"}
            </td>
            <td className="text-[#C0BFBA] whitespace-nowrap text-[13px]">
                {ar.attack_type || (
                    <span className="text-[#696A68] font-mono text-[12px]">
                        Uncategorized
                    </span>
                )}
            </td>
            <td className="whitespace-nowrap">
                <SeverityText level={ar.threat_level || ev.threat_level || ev.severity} />
            </td>
            <td className="whitespace-nowrap">
                <DecisionText decision={ar.decision} />
            </td>
            <td className="font-mono text-[12px] text-[#C0BFBA] whitespace-nowrap">
                {formatConfidence(ar.confidence)}
            </td>
            <td className="whitespace-nowrap">
                <EngineText engine={ar.engine} />
            </td>
            <td className="text-right whitespace-nowrap">
                <ChevronRight
                    size={14}
                    className={`inline text-[#8C8B86] group-hover:text-[#F2F1EE] transition-transform ${
                        isSelected ? "text-[#D3A16A] rotate-90" : ""
                    }`}
                />
            </td>
        </tr>
    );
}
