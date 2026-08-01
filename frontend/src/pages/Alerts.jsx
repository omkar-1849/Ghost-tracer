import { useEffect, useMemo, useRef, useState } from "react";
import { getRecentAlerts } from "../services/api";
import AlertsBackground from "../components/alerts/AlertsBackground";
import AlertsHero from "../components/alerts/AlertsHero";
import SummaryStrip from "../components/alerts/SummaryStrip";
import IncidentQueue from "../components/alerts/IncidentQueue";
import InvestigationWorkspace from "../components/alerts/InvestigationWorkspace";
import {
    enrichAlert,
    FALLBACK_INCIDENTS,
    formatClock,
} from "../components/alerts/alertsData";
import "../components/alerts/AlertsPage.css";

/**
 * Alerts — Security Incident Center
 * ---------------------------------
 * A premium SOC investigation workspace (UI/UX only):
 *
 *  · Hero            — title, subtitle, search, refresh, filters, export
 *  · Summary strip   — Critical / High / Medium / Resolved (lightweight)
 *  · Incident queue  — left 35%, scrollable, rich hover/selection states
 *  · Investigation   — right 65%, instant crossfade on selection
 *
 * Backend alerts are enriched (presentation-only) and polled every 5s,
 * matching the pattern used across the rest of the app.
 */
function Alerts() {
    const [incidents, setIncidents] = useState(FALLBACK_INCIDENTS);
    const [selectedId, setSelectedId] = useState(FALLBACK_INCIDENTS[0]?.id ?? null);
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

    const searchRef = useRef(null);

    /* ---------------------------------------------------------------- */
    /* Live polling — same cadence as the rest of the app (5s)           */
    /* ---------------------------------------------------------------- */
    useEffect(() => {
        let cancelled = false;

        async function loadAlerts() {
            try {
                const data = await getRecentAlerts();
                if (cancelled) return;
                if (Array.isArray(data) && data.length > 0) {
                    setIncidents(data.map((alert, index) => enrichAlert(alert, index)));
                    setSyncedAt(formatClock(Date.now()));
                }
            } catch (error) {
                /* Backend offline → curated fallback queue stays visible. */
                console.error(error);
            }
        }

        loadAlerts();

        const interval = setInterval(loadAlerts, 5000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    /* Keep the selected incident in sync with the live queue. */
    useEffect(() => {
        if (!incidents.some((incident) => incident.id === selectedId)) {
            setSelectedId(incidents[0]?.id ?? null);
        }
    }, [incidents, selectedId]);

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

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();

        return incidents.filter((incident) => {
            if (filters.severity !== "ALL" && incident.severity !== filters.severity) {
                return false;
            }

            if (filters.status === "OPEN" && incident.resolved) return false;
            if (filters.status === "RESOLVED" && !incident.resolved) return false;

            if (!q) return true;

            const haystack = [
                incident.title,
                incident.description,
                incident.source,
                incident.target,
                incident.attackType,
                incident.status,
                incident.caseId,
            ]
                .join(" ")
                .toLowerCase();

            return haystack.includes(q);
        });
    }, [incidents, query, filters]);

    const counts = useMemo(
        () => ({
            critical: incidents.filter((i) => i.severity === "CRITICAL").length,
            high: incidents.filter((i) => i.severity === "HIGH").length,
            medium: incidents.filter((i) => i.severity === "MEDIUM").length,
            resolved: incidents.filter((i) => i.resolved).length,
        }),
        [incidents]
    );

    const selectedIncident =
        incidents.find((incident) => incident.id === selectedId) ?? filtered[0] ?? null;

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

    function handleResolved(id) {
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
                    total={incidents.length}
                    searchRef={searchRef}
                />

                {/* Summary strip — lightweight queue widgets */}
                <div className="mt-6">
                    <SummaryStrip counts={counts} />
                </div>

                {/* Two investigation workspaces */}
                <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,40fr)_minmax(0,60fr)] xl:grid-cols-[minmax(0,35fr)_minmax(0,65fr)]">
                    <IncidentQueue
                        incidents={filtered}
                        selectedId={selectedId}
                        onSelect={handleSelect}
                        mobileHidden={mobileOpen}
                    />

                    <InvestigationWorkspace
                        incident={selectedIncident}
                        onBack={handleBack}
                        mobileHidden={!mobileOpen}
                        onResolved={handleResolved}
                    />
                </div>
            </div>
        </div>
    );
}

export default Alerts;
