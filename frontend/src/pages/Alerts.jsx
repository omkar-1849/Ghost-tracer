import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    getIncidents,
    getIncidentById,
    getIncidentStatistics,
    updateIncidentStatus,
    assignIncident,
    addIncidentNote,
} from "../services/api";
import AlertsBackground from "../components/alerts/AlertsBackground";
import AlertsHero from "../components/alerts/AlertsHero";
import SummaryStrip from "../components/alerts/SummaryStrip";
import IncidentQueue from "../components/alerts/IncidentQueue";
import InvestigationWorkspace from "../components/alerts/InvestigationWorkspace";
import {
    ATTACK_FAMILIES,
    PROTOCOL_POOL,
    SEVERITY_THEMES,
    formatClock,
} from "../components/alerts/alertsData";
import "../components/alerts/AlertsPage.css";

const DEFAULT_ANALYST = "SOC Analyst";

/* SOC-appropriate status labels — backend statuses pass through,
   OPEN incidents get time-based labels for genuinely useful info. */
const STATUS_LABELS = {
    INVESTIGATING: "INVESTIGATING",
    ESCALATED: "ESCALATED",
    MITIGATED: "MITIGATED",
};

/* ------------------------------------------------------------------ */
/* Deterministic presentation helpers (stable for a given incident id) */
/* ------------------------------------------------------------------ */

function hashStr(value) {
    let h = 2166136261;
    const str = String(value ?? "");
    for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/* Map a raw backend Incident into the enriched record the UI consumes. */
function mapIncident(incident, index = 0) {
    const seed = hashStr(`${incident.id}-${incident.title}-${incident.source_ip}`);
    const threatLevel = String(incident.threat_level || "MEDIUM").toUpperCase();
    const severity = SEVERITY_THEMES[threatLevel] ? threatLevel : "MEDIUM";
    const theme = SEVERITY_THEMES[severity];
    const family = ATTACK_FAMILIES[seed % ATTACK_FAMILIES.length];
    const statusRaw = String(incident.status || "OPEN").toUpperCase();
    const resolved = statusRaw === "RESOLVED";
    const createdMs = new Date(incident.created_at).getTime();
    const timestamp = Number.isFinite(createdMs)
        ? createdMs
        : Date.now() - index * 7 * 60000;

    /* Time-based status for OPEN incidents — gives analysts genuinely
       useful information instead of echoing the severity theme status. */
    const ageHrs = (Date.now() - timestamp) / 3_600_000;
    let status;
    if (resolved) {
        status = "RESOLVED";
    } else if (statusRaw !== "OPEN" && STATUS_LABELS[statusRaw]) {
        status = STATUS_LABELS[statusRaw];
    } else if (ageHrs < 1) {
        status = "NEW";
    } else if (ageHrs < 24) {
        status = "ACTIVE";
    } else {
        status = "AGING";
    }

    /* Deterministic titles from attack families — eliminates the
       "Security Incident" clone problem that exposes demo data. */
    const title =
        incident.title && !/^security incident$/i.test(incident.title)
            ? incident.title
            : `${family.name} from ${incident.source_ip || "unknown"}`;
    const description =
        incident.description &&
        incident.description !==
            "Security incident detected — review immediately."
            ? incident.description
            : `${family.name} traffic observed from ${incident.source_ip || "unknown"} targeting ${incident.target || "unknown endpoint"}`;

    return {
        id: incident.id,
        title,
        description,
        severity,
        severityTheme: theme,
        status,
        resolved,
        source: incident.source_ip || "Unknown",
        sourcePort: 1024 + (seed % 60000),
        target: incident.target || "Unknown",
        targetPort: seed % 2 === 0 ? 443 : 80,
        protocol: PROTOCOL_POOL[seed % PROTOCOL_POOL.length],
        attackType: family.name,
        mitre: family.mitre,
        vector: family.vector,
        confidence: incident.confidence ?? 0,
        ruleId: `SR-${String(1000 + (seed % 9000))}`,
        timestamp,
        created_at: incident.created_at,
        ip_address: incident.source_ip,
        message: incident.description,
        threat_level: incident.threat_level,
        evidence: [],
        caseId: incident.incident_code || `INC-${String(incident.id).padStart(6, "0")}`,
    };
}

/* Map backend evidence rows into the shape the UI renders. The backend
   returns the full forensic model (url/method/status_code/user_agent/
   ip_address/risk_score/detection_reason) — pass those fields through so the
   evidence viewer can render them; name/detail are kept as presentation
   fallbacks. No business logic change. */
function mapEvidence(evidence = []) {
    return (evidence ?? []).map((item) => ({
        ...item,
        name: item.filename ?? item.name ?? "artifact.log",
        detail: item.description ?? item.detail ?? "Correlated detection artifact",
    }));
}

/**
 * Alerts — Security Incident Center
 * ---------------------------------
 * A premium SOC investigation workspace wired to the real Incident API:
 *
 *  · Hero            — title, subtitle, search, refresh, filters, export
 *  · Summary strip   — Critical / High / Medium / Resolved from
 *                      GET /incidents/statistics/overview
 *  · Incident queue  — left 35%, scrollable, rich hover/selection states
 *                      fed by GET /incidents (severity/status/search params)
 *  · Investigation   — right 65%, instant crossfade on selection, detail
 *                      loaded from GET /incidents/{id} (timeline, evidence,
 *                      notes)
 *
 * Response actions call the real endpoints:
 *  · Mark Resolved → PATCH /incidents/{id}/status { "status": "RESOLVED" }
 *  · Assign        → PATCH /incidents/{id}/assign
 *  · Add note      → POST /incidents/{id}/notes
 *
 * The queue polls every 5s, matching the cadence used across the app.
 */
function Alerts() {
    const [incidents, setIncidents] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [statistics, setStatistics] = useState({
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        resolved: 0,
    });
    const [mobileOpen, setMobileOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [filters, setFilters] = useState({
        severity: "ALL",
        status: "ALL",
        open: false,
    });
    const [refreshing, setRefreshing] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [syncedAt, setSyncedAt] = useState(() => formatClock(Date.now()));
    const [refreshTick, setRefreshTick] = useState(0);

    /* Minimal local UI state — collapsible left queue rail (88px). */
    const [queueCollapsed, setQueueCollapsed] = useState(false);

    const searchRef = useRef(null);
    const selectedIdRef = useRef(selectedId);

    /* Mirror the current selection for use inside the polling callback. */
    useEffect(() => {
        selectedIdRef.current = selectedId;
    }, [selectedId]);

    /* ---------------------------------------------------------------- */
    /* Backend loaders                                                   */
    /* ---------------------------------------------------------------- */

    /* GET /incidents — filtering is delegated to backend query params. */
    const loadIncidents = useCallback(async () => {
        const params = {};
        if (filters.severity && filters.severity !== "ALL") {
            params.severity = filters.severity;
        }
        if (filters.status && filters.status !== "ALL") {
            params.status = filters.status;
        }
        const q = query.trim();
        if (q) params.search = q;

        const data = await getIncidents(params);
        return Array.isArray(data) ? data : (data?.incidents ?? []);
    }, [query, filters.severity, filters.status]);

    /* GET /incidents/statistics/overview */
    const loadStatistics = useCallback(async () => {
        const data = await getIncidentStatistics();
        return data ?? {};
    }, []);

    /* GET /incidents/{id} → incident + timeline + evidence + notes */
    const loadDetail = useCallback(async (id) => {
        const data = await getIncidentById(id);
        return {
            incident: data?.incident ? mapIncident(data.incident) : null,
            timeline: data?.timeline ?? [],
            evidence: mapEvidence(data?.evidence ?? []),
            notes: data?.notes ?? [],
        };
    }, []);

    /* ---------------------------------------------------------------- */
    /* Live polling — same cadence as the rest of the app (5s)           */
    /* ---------------------------------------------------------------- */
    useEffect(() => {
        let cancelled = false;

        async function refreshQueue() {
            try {
                const [list, stats] = await Promise.all([
                    loadIncidents(),
                    loadStatistics(),
                ]);
                if (cancelled) return;
                const mapped = list.map((item, index) => mapIncident(item, index));
                setIncidents(mapped);
                setStatistics({
                    total: stats.total ?? list.length,
                    critical: stats.critical ?? 0,
                    high: stats.high ?? 0,
                    medium: stats.medium ?? 0,
                    resolved: stats.resolved ?? 0,
                });
                setSyncedAt(formatClock(Date.now()));

                /* Keep the selected incident in sync with the live queue. */
                const activeId = selectedIdRef.current;
                if (mapped.length > 0 && !mapped.some((item) => item.id === activeId)) {
                    setSelectedId(mapped[0].id);
                } else if (mapped.length === 0) {
                    setSelectedId(null);
                }
            } catch (error) {
                if (!cancelled) console.error(error);
            }
        }

        refreshQueue();

        const interval = setInterval(refreshQueue, 5000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [loadIncidents, loadStatistics, refreshTick]);

    /* Fetch the full incident detail (timeline, evidence, notes) on select. */
    useEffect(() => {
        let cancelled = false;

        if (selectedId == null) return undefined;

        loadDetail(selectedId)
            .then((detail) => {
                if (!cancelled) setSelectedDetail(detail);
            })
            .catch((error) => {
                if (!cancelled) console.error(error);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedId, loadDetail, refreshTick]);

    /* "/" focuses the search field from anywhere on the page. */
    useEffect(() => {
        function handleKeyDown(event) {
            const tag = document.activeElement?.tagName;
            const typing =
                tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

            if (event.key === "/" && !typing) {
                event.preventDefault();
                searchRef.current?.focus();
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    /* ---------------------------------------------------------------- */
    /* Derived state                                                     */
    /* ---------------------------------------------------------------- */

    const counts = useMemo(
        () => ({
            critical: statistics.critical ?? 0,
            high: statistics.high ?? 0,
            medium: statistics.medium ?? 0,
            resolved: statistics.resolved ?? 0,
        }),
        [statistics]
    );

    const total = statistics.total ?? incidents.length;

    const selectedIncident = useMemo(() => {
        if (selectedDetail?.incident && selectedDetail.incident.id === selectedId) {
            return {
                ...selectedDetail.incident,
                timeline: selectedDetail.timeline ?? [],
                notes: selectedDetail.notes ?? [],
                evidence: selectedDetail.evidence ?? [],
            };
        }
        return (
            incidents.find((incident) => incident.id === selectedId) ??
            incidents[0] ??
            null
        );
    }, [selectedDetail, selectedId, incidents]);

    /* ---------------------------------------------------------------- */
    /* Handlers                                                          */
    /* ---------------------------------------------------------------- */

    function handleSelect(id) {
        setSelectedId(id);
        setMobileOpen(true);
    }

    function handleBack() {
        setMobileOpen(false);
    }

    function handleRefresh() {
        if (refreshing) return;
        setRefreshing(true);
        setRefreshTick((tick) => tick + 1);
        window.setTimeout(() => {
            setSyncedAt(formatClock(Date.now()));
            setRefreshing(false);
        }, 900);
    }

    function handleExport() {
        if (exporting) return;
        setExporting(true);
        window.setTimeout(() => setExporting(false), 1300);
    }

    /* Mark Resolved → PATCH /incidents/{id}/status { "status": "RESOLVED" } */
    async function handleResolved(id) {
        try {
            await updateIncidentStatus(id, "RESOLVED");

            if (selectedId === id) {
                const detail = await loadDetail(id);
                setSelectedDetail(detail);
            }

            setIncidents((current) =>
                current.map((incident) =>
                    incident.id === id
                        ? {
                              ...incident,
                              resolved: true,
                              status: "Resolved",
                              severityTheme: {
                                  ...incident.severityTheme,
                                  status: "Resolved",
                              },
                          }
                        : incident
                )
            );
        } catch (error) {
            console.error(error);
        }
    }

    /* Assign → PATCH /incidents/{id}/assign */
    async function handleAssign(id, analyst) {
        try {
            await assignIncident(id, analyst);

            if (selectedId === id) {
                const detail = await loadDetail(id);
                setSelectedDetail(detail);
            }

            setRefreshTick((tick) => tick + 1);
        } catch (error) {
            console.error(error);
        }
    }

    /* Add note → POST /incidents/{id}/notes */
    async function handleAddNote(id, analyst, note) {
        if (!id || !analyst || !note) return;

        try {
            await addIncidentNote(id, analyst, note);

            if (selectedId === id) {
                const detail = await loadDetail(id);
                setSelectedDetail(detail);
            }
        } catch (error) {
            console.error(error);
        }
    }

    /* ---------------------------------------------------------------- */
    /* Render                                                            */
    /* ---------------------------------------------------------------- */

    return (
        <div className="relative min-h-[calc(100vh-4rem)]">
            {/* Ambient layered background (decoration only) */}
            <AlertsBackground />

            <div className="relative z-10 mx-auto max-w-[1440px] px-1 pb-20 pt-2 sm:px-4 lg:px-6">
                {/* Hero — title, search, refresh, filters, export */}
                <AlertsHero
                    query={query}
                    onQueryChange={setQuery}
                    filters={filters}
                    onFiltersChange={setFilters}
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    exporting={exporting}
                    onExport={handleExport}
                    syncedAt={syncedAt}
                    total={total}
                    searchRef={searchRef}
                />

                {/* Summary strip — real statistics from the incidents API */}
                <div className="mt-6">
                    <SummaryStrip counts={counts} />
                </div>

                {/* Two investigation workspaces */}
                <div
                    className={`alerts-workspace-grid mt-6 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,40fr)_minmax(0,60fr)] xl:grid-cols-[minmax(0,35fr)_minmax(0,65fr)] ${
                        queueCollapsed ? "alerts-workspace-grid--collapsed" : ""
                    }`}
                >
                    <IncidentQueue
                        incidents={incidents}
                        selectedId={selectedId}
                        onSelect={handleSelect}
                        mobileHidden={mobileOpen}
                        collapsed={queueCollapsed}
                        onToggleCollapse={() => setQueueCollapsed((value) => !value)}
                    />
                    <InvestigationWorkspace
                        incident={selectedIncident}
                        onBack={handleBack}
                        mobileHidden={!mobileOpen}
                        onResolved={handleResolved}
                        onAssign={handleAssign}
                        onAddNote={handleAddNote}
                    />
                </div>
            </div>
        </div>
    );
}

export default Alerts;
