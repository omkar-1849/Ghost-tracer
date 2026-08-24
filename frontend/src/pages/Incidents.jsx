import { useEffect, useState, useMemo } from "react";
import {
    TriangleAlert,
    Search,
    Clock,
    User,
    CheckCircle2,
    Flame,
    X,
    FileText,
    Activity,
    Zap,
    Send,
    Plus,
    AlertCircle,
} from "lucide-react";
import {
    getIncidents,
    getIncidentById,
    updateIncidentStatus,
    assignIncident,
    addIncidentNote,
    createResponseAction,
    executeResponseAction,
} from "../services/api";
import { isAuthenticated } from "../services/authClient";

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

function Incidents() {
    const [incidents, setIncidents] = useState([]);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [severityFilter, setSeverityFilter] = useState("ALL");
    const [search, setSearch] = useState("");
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [incidentDetail, setIncidentDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [statusUpdating, setStatusUpdating] = useState(false);

    // Toast state
    const [toast, setToast] = useState(null);

    // Note form state
    const [newNote, setNewNote] = useState("");
    const [submittingNote, setSubmittingNote] = useState(false);

    // Active tab in investigation drawer (AI tab completely removed)
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
            }
        } catch (err) {
            console.error("Failed to load incidents", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchIncidentList();
        const interval = setInterval(fetchIncidentList, 10000);
        return () => clearInterval(interval);
    }, []);

    // Load full detail when an incident is selected
    const handleSelectIncident = async (inc) => {
        setSelectedIncident(inc);
        setDetailLoading(true);
        try {
            const full = await getIncidentById(inc.id);
            setIncidentDetail(full);
        } catch (err) {
            console.error("Failed to load incident detail", err);
            setIncidentDetail({ incident: inc, timeline: [], evidence: [], notes: [] });
        } finally {
            setDetailLoading(false);
        }
    };

    // Update incident status with proper auth handling
    const handleStatusChange = async (newStatus) => {
        if (!selectedIncident) return;
        setStatusUpdating(true);
        try {
            const updated = await updateIncidentStatus(selectedIncident.id, newStatus);
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
            await addIncidentNote(selectedIncident.id, "Admin Analyst", newNote.trim());
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
                target: selectedIncident.source_ip || "192.168.1.101",
                reason: `Mitigation action for incident ${selectedIncident.title}`,
            });
            if (res && res.id) {
                const execRes = await executeResponseAction(res.id);
                showToast(`Action ${actionType} dispatched (Status: ${execRes.status || "EXECUTED"}).`);
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

    return (
        <div className="p-8 space-y-6 max-w-[1600px] mx-auto animate-fade-in select-none">
            {/* Native Toast */}
            {toast && (
                <div
                    className={`fixed top-5 right-8 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium shadow-[var(--shadow-modal)] animate-fade-in ${
                        toast.type === "error"
                            ? "bg-[var(--color-surface-3)] border-[var(--color-critical)] text-[var(--color-critical)]"
                            : "bg-[var(--color-surface-3)] border-white/40 text-white"
                    }`}
                >
                    {toast.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                    <span>{toast.message}</span>
                </div>
            )}

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                    <TriangleAlert size={24} className="text-white" />
                    <span>Incident Management</span>
                </h1>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                    SOC incident triage, evidence correlation, timeline analysis, and countermeasure dispatch
                </p>
            </div>

            {/* Filter Bar */}
            <div className="frosted-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-96">
                    <Search
                        size={16}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search incidents by code, title, IP..."
                        className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg pl-10 pr-3 py-2 text-sm text-white placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[rgba(255,255,255,0.4)]"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                    {/* Status Tabs */}
                    <div className="flex items-center gap-1 bg-[var(--color-surface-1)] p-1 rounded-lg border border-[var(--color-border-default)]">
                        {["ALL", "OPEN", "INVESTIGATING", "RESOLVED"].map((st) => (
                            <button
                                key={st}
                                type="button"
                                onClick={() => setStatusFilter(st)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                                    statusFilter === st
                                        ? "bg-white text-black font-semibold shadow-sm"
                                        : "text-[var(--color-text-secondary)] hover:text-white"
                                }`}
                            >
                                {st}
                            </button>
                        ))}
                    </div>

                    {/* Severity Select */}
                    <select
                        value={severityFilter}
                        onChange={(e) => setSeverityFilter(e.target.value)}
                        className="bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg px-3.5 py-2 text-xs font-mono text-white focus:outline-none"
                    >
                        <option value="ALL">Severity: All</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                    </select>
                </div>
            </div>

            {/* Incidents Table */}
            <div className="frosted-card p-5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13.5px]">
                        <thead>
                            <tr className="border-b border-[var(--color-border-default)] text-[11px] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                                <th className="pb-3.5 font-medium">Incident Code</th>
                                <th className="pb-3.5 font-medium">Severity</th>
                                <th className="pb-3.5 font-medium">Incident Title</th>
                                <th className="pb-3.5 font-medium">Source IP</th>
                                <th className="pb-3.5 font-medium">Status</th>
                                <th className="pb-3.5 font-medium">Created At</th>
                                <th className="pb-3.5 font-medium text-right">Workspace</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border-subtle)]">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="py-12 text-center text-sm text-[var(--color-text-muted)]">
                                        Loading incident queue…
                                    </td>
                                </tr>
                            ) : filteredIncidents.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="py-12 text-center text-sm text-[var(--color-text-muted)]">
                                        No active incidents found matching criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredIncidents.map((inc) => {
                                    const sev = (inc.threat_level || inc.threatLevel || "MEDIUM").toUpperCase();
                                    const code = inc.incident_code || `INC-0${inc.id || 100}`;
                                    const status = (inc.status || "OPEN").toUpperCase();

                                    return (
                                        <tr
                                            key={inc.id}
                                            onClick={() => handleSelectIncident(inc)}
                                            className="group hover:bg-[rgba(255,255,255,0.03)] cursor-pointer transition-colors duration-100"
                                        >
                                            <td className="py-3.5 font-mono text-xs text-white font-medium whitespace-nowrap">
                                                {code}
                                            </td>
                                            <td className="py-3.5 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10.5px] font-mono font-semibold ${
                                                        sev === "CRITICAL"
                                                            ? "bg-[rgba(230,57,70,0.15)] text-[var(--color-critical)] border border-[rgba(230,57,70,0.3)]"
                                                            : sev === "HIGH"
                                                            ? "bg-[rgba(245,158,11,0.15)] text-[var(--color-high)] border border-[rgba(245,158,11,0.3)]"
                                                            : "bg-[rgba(255,255,255,0.06)] text-white border border-[rgba(255,255,255,0.12)]"
                                                    }`}
                                                >
                                                    {sev}
                                                </span>
                                            </td>
                                            <td className="py-3.5 font-medium text-white max-w-sm truncate text-sm">
                                                {inc.title || "Unauthorized attack vector"}
                                            </td>
                                            <td className="py-3.5 font-mono text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                                                {inc.source_ip || "127.0.0.1"}
                                            </td>
                                            <td className="py-3.5 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono ${
                                                        status === "RESOLVED"
                                                            ? "bg-[rgba(16,185,129,0.1)] text-[var(--color-success)] border border-[rgba(16,185,129,0.25)]"
                                                            : status === "INVESTIGATING"
                                                            ? "bg-[rgba(245,158,11,0.1)] text-[var(--color-high)] border border-[rgba(245,158,11,0.25)]"
                                                            : "bg-[rgba(255,255,255,0.06)] text-white border border-[rgba(255,255,255,0.15)]"
                                                    }`}
                                                >
                                                    {status}
                                                </span>
                                            </td>
                                            <td className="py-3.5 font-mono text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                                                {formatTimestamp(inc.created_at)}
                                            </td>
                                            <td className="py-3.5 text-right whitespace-nowrap">
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] group-hover:text-white transition-colors">
                                                    <span>Open Workspace</span>
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SOC Investigation Workspace Slide-over Drawer */}
            {selectedIncident && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-2xl h-full bg-[var(--color-surface-2)] border-l border-[var(--color-border-default)] shadow-[var(--shadow-modal)] flex flex-col justify-between overflow-y-auto custom-scrollbar p-6">
                        {/* Header */}
                        <div>
                            <div className="flex items-start justify-between pb-4 border-b border-[var(--color-border-subtle)]">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-bold text-white">
                                            {selectedIncident.incident_code || `INC-${selectedIncident.id}`}
                                        </span>
                                        <span className="text-[10.5px] font-mono px-2 py-0.5 rounded bg-[rgba(230,57,70,0.15)] text-[var(--color-critical)] border border-[rgba(230,57,70,0.3)]">
                                            {selectedIncident.threat_level || "CRITICAL"}
                                        </span>
                                    </div>
                                    <h2 className="text-base font-semibold text-white mt-1">
                                        {selectedIncident.title || "Security Threat Incident"}
                                    </h2>
                                    <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">
                                        Source: {selectedIncident.source_ip || "127.0.0.1"} · Created {formatTimestamp(selectedIncident.created_at)}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setSelectedIncident(null)}
                                    className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.08)]"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Status Control Strip */}
                            <div className="flex items-center justify-between py-3 px-4 my-4 rounded-lg bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)]">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-[var(--color-text-muted)]">Current Status:</span>
                                    <span className="text-xs font-mono font-semibold text-white">{selectedIncident.status || "OPEN"}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {["OPEN", "INVESTIGATING", "RESOLVED"].map((st) => (
                                        <button
                                            key={st}
                                            type="button"
                                            disabled={statusUpdating}
                                            onClick={() => handleStatusChange(st)}
                                            className={`px-3 py-1 rounded text-xs font-mono transition-all disabled:opacity-50 ${
                                                selectedIncident.status === st
                                                    ? "bg-white text-black font-semibold"
                                                    : "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:text-white border border-[var(--color-border-subtle)]"
                                            }`}
                                        >
                                            Set {st}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Response Actions Strip (Real Backend Dispatches) */}
                            <div className="mb-4 p-3.5 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)]">
                                <span className="text-xs font-mono text-[var(--color-text-muted)] uppercase">Defensive Action Trigger</span>
                                <div className="flex flex-wrap gap-2 mt-2.5">
                                    <button
                                        type="button"
                                        onClick={() => handleTriggerAction("BLOCK_IP")}
                                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[rgba(230,57,70,0.15)] text-[var(--color-critical)] border border-[rgba(230,57,70,0.3)] hover:bg-[rgba(230,57,70,0.25)] text-xs font-mono font-medium transition-colors"
                                    >
                                        <Zap size={13} />
                                        <span>Dispatch BLOCK_IP ({selectedIncident.source_ip || "Target"})</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleTriggerAction("BLOCK_SESSION")}
                                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[rgba(255,255,255,0.06)] text-white border border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.1)] text-xs font-mono font-medium transition-colors"
                                    >
                                        <Zap size={13} />
                                        <span>Dispatch BLOCK_SESSION</span>
                                    </button>
                                </div>
                            </div>

                            {/* Navigation Tabs in Workspace */}
                            <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] pb-2 mb-4 text-xs font-medium">
                                {[
                                    { key: "timeline", label: "Timeline", icon: Clock },
                                    { key: "evidence", label: "Evidence", icon: FileText },
                                    { key: "notes", label: "Analyst Notes", icon: Activity },
                                ].map((tab) => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-colors ${
                                            activeTab === tab.key
                                                ? "bg-white text-black font-semibold shadow-sm"
                                                : "text-[var(--color-text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.04)]"
                                        }`}
                                    >
                                        <tab.icon size={14} />
                                        <span>{tab.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Workspace Tab Content */}
                            {detailLoading ? (
                                <div className="py-12 text-center text-xs text-[var(--color-text-muted)]">
                                    Loading forensic evidence & timeline…
                                </div>
                            ) : (
                                <div>
                                    {/* 1. Timeline */}
                                    {activeTab === "timeline" && (
                                        <div className="space-y-4">
                                            {(incidentDetail?.timeline || []).length > 0 ? (
                                                incidentDetail.timeline.map((item, idx) => (
                                                    <div key={idx} className="flex gap-3 text-xs">
                                                        <div className="w-2 h-2 rounded-full bg-white mt-1.5 shrink-0" />
                                                        <div>
                                                            <p className="text-white font-medium text-sm">{item.event_description || item.action}</p>
                                                            <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">{formatTimestamp(item.created_at)}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-xs text-[var(--color-text-muted)] py-4">
                                                    Initial detection registered. Threat lifecycle active.
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 2. Evidence */}
                                    {activeTab === "evidence" && (
                                        <div className="space-y-3">
                                            {(incidentDetail?.evidence || []).length > 0 ? (
                                                incidentDetail.evidence.map((ev, idx) => (
                                                    <div key={idx} className="p-3.5 rounded-lg bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)]">
                                                        <div className="flex items-center justify-between text-xs font-mono text-[var(--color-text-muted)]">
                                                            <span>Evidence Item #{idx + 1}</span>
                                                            <span className="text-white">{ev.evidence_type}</span>
                                                        </div>
                                                        <pre className="text-xs font-mono text-white mt-2 whitespace-pre-wrap break-all">{ev.data || JSON.stringify(ev, null, 2)}</pre>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-4 rounded-lg bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] font-mono text-xs text-[var(--color-text-secondary)] space-y-1">
                                                    <p className="text-white font-semibold">Incident Packet Context:</p>
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
                                                    className="flex-1 bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg px-3.5 py-2 text-xs text-white placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[rgba(255,255,255,0.4)]"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={submittingNote || !newNote.trim()}
                                                    className="px-4 py-2 rounded-lg bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors disabled:opacity-50"
                                                >
                                                    {submittingNote ? "Saving…" : "Post"}
                                                </button>
                                            </form>

                                            <div className="space-y-2.5">
                                                {(incidentDetail?.notes || []).map((n, idx) => (
                                                    <div key={idx} className="p-3.5 rounded-lg bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)]">
                                                        <div className="flex items-center justify-between text-xs font-mono text-[var(--color-text-muted)]">
                                                            <span className="text-white font-medium">{n.analyst || "SOC Analyst"}</span>
                                                            <span>{formatTimestamp(n.created_at)}</span>
                                                        </div>
                                                        <p className="text-xs text-white mt-1.5 leading-relaxed">{n.note}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="pt-4 mt-6 border-t border-[var(--color-border-subtle)] flex items-center justify-end">
                            <button
                                type="button"
                                onClick={() => setSelectedIncident(null)}
                                className="px-5 py-2 rounded-lg bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors"
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
