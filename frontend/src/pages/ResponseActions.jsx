import { useEffect, useState, useCallback } from "react";
import {
    Zap,
    Search,
    Play,
    CheckCircle2,
    Clock,
    XCircle,
    Plus,
    X,
    AlertCircle,
    RefreshCw,
} from "lucide-react";
import { getResponseActions, executeResponseAction, createResponseAction } from "../services/responseActionApi";
import { getIncidents } from "../services/api";

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

function StatusBadge({ status }) {
    const s = String(status || "PENDING").toUpperCase();
    if (s === "SIMULATED" || s === "EXECUTED" || s === "COMPLETED") {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono bg-[rgba(119,199,154,0.12)] border border-[rgba(119,199,154,0.3)] text-[#77C79A] font-semibold">
                <CheckCircle2 size={12} />
                <span>SIMULATED</span>
            </span>
        );
    }
    if (s === "FAILED" || s === "BLOCKED") {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono bg-[rgba(223,91,91,0.12)] border border-[rgba(223,91,91,0.3)] text-[#FF8585] font-semibold">
                <XCircle size={12} />
                <span>{s}</span>
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono bg-[rgba(211,160,106,0.12)] border border-[rgba(211,160,106,0.3)] text-[#D3A06A] font-semibold">
            <Clock size={12} />
            <span>PENDING</span>
        </span>
    );
}

function ResponseActions() {
    const [actions, setActions] = useState([]);
    const [incidents, setIncidents] = useState([]);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [executingId, setExecutingId] = useState(null);

    // Toast state
    const [toast, setToast] = useState(null);

    // New action state
    const [newIncidentId, setNewIncidentId] = useState("");
    const [newActionType, setNewActionType] = useState("BLOCK_IP");
    const [newTarget, setNewTarget] = useState("");
    const [newReason, setNewReason] = useState("");
    const [loadError, setLoadError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const showToast = (msg, type = "success") => {
        setToast({ message: msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    const loadActions = useCallback(async () => {
        try {
            const [actionsData, incData] = await Promise.allSettled([
                getResponseActions(),
                getIncidents(),
            ]);
            setLoadError([actionsData, incData].some((item) => item.status === "rejected") ? "Response action data unavailable. Retry loading; the queue may be incomplete." : "");
            if (actionsData.status === "fulfilled" && Array.isArray(actionsData.value)) {
                setActions(actionsData.value);
            }
            if (incData.status === "fulfilled" && Array.isArray(incData.value)) {
                setIncidents(incData.value);
                if (incData.value.length > 0) {
                    setNewIncidentId((current) => current || incData.value[0].id);
                    setNewTarget((current) => current || incData.value[0].source_ip || "");
                }
            }
        } catch (err) {
            console.error("Failed to load actions", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const initial = setTimeout(loadActions, 0);
        const interval = setInterval(loadActions, 8000);
        return () => { clearTimeout(initial); clearInterval(interval); };
    }, [loadActions]);

    const handleExecute = async (actionId) => {
        setExecutingId(actionId);
        try {
            const res = await executeResponseAction(actionId);
            showToast(`Action recorded as ${res.status || "SIMULATED"} (simulation only; no external enforcement yet).`);
            await loadActions();
        } catch (err) {
            showToast(`Simulation failed: ${err.message}`, "error");
        } finally {
            setExecutingId(null);
        }
    };

    const handleCreateAction = async (e) => {
        e.preventDefault();
        if (!newIncidentId || !newTarget.trim()) return;
        setSubmitting(true);
        try {
            await createResponseAction(newIncidentId, {
                action_type: newActionType,
                target: newTarget.trim(),
                reason: newReason.trim() || "Manual defensive intervention",
            });
            setModalOpen(false);
            setNewTarget("");
            setNewReason("");
            showToast("Response action created in PENDING status.");
            await loadActions();
        } catch (err) {
            showToast(`Failed to create action: ${err.message}`, "error");
        } finally {
            setSubmitting(false);
        }
    };

    const filtered = actions.filter((a) => {
        const matchesStatus =
            statusFilter === "ALL" || (a.status || "PENDING").toUpperCase() === statusFilter;
        const q = search.toLowerCase().trim();
        const matchesQuery =
            !q ||
            (a.action_type || "").toLowerCase().includes(q) ||
            (a.target || "").toLowerCase().includes(q) ||
            (a.reason || "").toLowerCase().includes(q);
        return matchesStatus && matchesQuery;
    });

    return (
        <div className="sentinel-page space-y-6 animate-fade-in select-none">
            {loadError && <p role="alert" className="text-xs text-[#FF8585]">{loadError}</p>}
            {/* Native Toast Feedback */}
            {toast && (
                <div
                    className={`fixed top-5 right-8 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-[0_12px_32px_rgba(0,0,0,0.6)] animate-fade-in ${
                        toast.type === "error"
                            ? "bg-[#12100E]/95 border-[#FF8585]/40 text-[#FF8585]"
                            : "bg-[#12100E]/95 border-[#D3A06A]/40 text-[#F5F1EC]"
                    }`}
                >
                    {toast.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} className="text-[#77C79A]" />}
                    <span>{toast.message}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                <div>
                    <p className="text-[11px] font-semibold tracking-wider uppercase text-[#D3A06A] mb-1.5">Defensive Orchestration</p>
                    <h1 className="text-2xl font-bold tracking-tight text-[#F5F1EC] flex items-center gap-2.5">
                        <Zap size={22} className="text-[#D3A06A]" />
                        <span>Defensive Response Actions</span>
                    </h1>
                    <p className="text-xs text-[#9E948A] mt-1">
                        Simulation queue only — actions do not enforce blocking or isolation
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={loadActions}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-[#D6CFC7] hover:text-[#F5F1EC] transition-all shadow-sm"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                        <span>Sync Queue</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#D3A06A] to-[#E3B985] text-[#0D0C0A] font-semibold text-xs hover:brightness-105 active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(211,160,106,0.25)]"
                    >
                        <Plus size={14} />
                        <span>Create Action</span>
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="sentinel-glass p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-96">
                    <Search
                        size={15}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9E948A] pointer-events-none"
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by action type, target IP, reason..."
                        className="w-full bg-[rgba(18,16,14,0.45)] border border-[rgba(255,248,238,0.08)] rounded-xl pl-10 pr-4 py-2 text-xs text-[#F5F1EC] placeholder:text-[#6E675F] focus:outline-none focus:border-[#D3A06A]/50 focus:ring-1 focus:ring-[#D3A06A]/30 transition-all"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                    {["ALL", "PENDING", "SIMULATED", "FAILED"].map((st) => (
                        <button
                            key={st}
                            type="button"
                            onClick={() => setStatusFilter(st)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                                statusFilter === st
                                    ? "bg-gradient-to-r from-[#D3A06A] to-[#E3B985] text-[#0D0C0A] font-semibold shadow-sm"
                                    : "bg-white/5 text-[#D6CFC7] hover:text-[#F5F1EC] hover:bg-white/10 border border-white/10"
                            }`}
                        >
                            {st}
                        </button>
                    ))}
                </div>
            </div>

            {/* Response Actions Table */}
            <div className="sentinel-glass p-5 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px]">
                        <thead>
                            <tr className="border-b border-white/10 text-[10px] font-mono text-[#9E948A] uppercase tracking-wider">
                                <th className="pb-3.5 font-medium">Action ID</th>
                                <th className="pb-3.5 font-medium">Action Type</th>
                                <th className="pb-3.5 font-medium">Target</th>
                                <th className="pb-3.5 font-medium">Status</th>
                                <th className="pb-3.5 font-medium">Reason / Rationale</th>
                                <th className="pb-3.5 font-medium">Created At</th>
                                <th className="pb-3.5 font-medium text-right">Simulate</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="py-12 text-center text-xs text-[#9E948A]">
                                        Loading defensive actions…
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="py-12 text-center text-xs text-[#9E948A]">
                                        No response actions in queue.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((act) => {
                                    const actionId = `ACT-${String(act.id).padStart(4, "0")}`;
                                    const isPending = (act.status || "PENDING").toUpperCase() === "PENDING";
                                    const isExecuting = executingId === act.id;

                                    return (
                                        <tr
                                            key={act.id}
                                            className="group hover:bg-white/[0.03] transition-colors duration-100"
                                        >
                                            <td className="py-3.5 font-mono text-xs text-[#9E948A] whitespace-nowrap">
                                                {actionId}
                                            </td>
                                            <td className="py-3.5 font-mono font-semibold text-[#F5F1EC] whitespace-nowrap">
                                                {act.action_type || "BLOCK_IP"}
                                            </td>
                                            <td className="py-3.5 font-mono text-xs text-[#D3A06A] whitespace-nowrap">
                                                {act.target || "—"}
                                            </td>
                                            <td className="py-3.5 whitespace-nowrap">
                                                <StatusBadge status={act.status} />
                                            </td>
                                            <td className="py-3.5 font-medium text-[#D6CFC7] max-w-sm truncate text-xs">
                                                {act.reason || "Automated anomaly mitigation"}
                                            </td>
                                            <td className="py-3.5 font-mono text-xs text-[#9E948A] whitespace-nowrap">
                                                {formatTimestamp(act.created_at)}
                                            </td>
                                            <td className="py-3.5 text-right whitespace-nowrap">
                                                {isPending ? (
                                                    <button
                                                        type="button"
                                                        disabled={isExecuting}
                                                        onClick={() => handleExecute(act.id)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[rgba(211,160,106,0.15)] border border-[rgba(211,160,106,0.30)] text-[#D3A06A] hover:bg-[rgba(211,160,106,0.25)] hover:text-[#F5F1EC] font-semibold text-xs transition-all shadow-sm disabled:opacity-50"
                                                    >
                                                        <Play size={11} fill="currentColor" />
                                                        <span>{isExecuting ? "Executing…" : "Dispatch"}</span>
                                                    </button>
                                                ) : (
                                                    <span className="text-xs font-mono text-[#6E675F]">
                                                        Confirmed {act.status}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Response Action Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0C0A]/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="w-full max-w-md bg-[#12100E]/95 backdrop-blur-2xl border border-[rgba(255,248,238,0.10)] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.85)] p-6 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-white/10">
                            <h3 className="text-base font-bold text-[#F5F1EC] flex items-center gap-2">
                                <Zap size={16} className="text-[#D3A06A]" />
                                <span>Create Countermeasure Action</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                className="text-[#9E948A] hover:text-[#F5F1EC] transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateAction} className="space-y-4">
                            {incidents.length === 0 ? (
                                <div className="p-3.5 rounded-xl bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.25)] text-xs text-[#E5B374] space-y-1">
                                    <p className="font-semibold flex items-center gap-1.5"><AlertCircle size={14} /> No active incidents available</p>
                                    <p className="text-[11px] text-[#D6CFC7]">Response actions are dispatched against correlated incidents created from High/Critical threats. Ingest high-risk telemetry or wait for threat detection to propose actions.</p>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-[11px] font-mono text-[#9E948A] uppercase tracking-wider mb-1">
                                        Target Incident
                                    </label>
                                    <select
                                        value={newIncidentId}
                                        onChange={(e) => {
                                             setNewIncidentId(e.target.value);
                                             const matched = incidents.find(i => String(i.id) === String(e.target.value));
                                             if (matched?.source_ip) setNewTarget(matched.source_ip);
                                        }}
                                        className="w-full bg-[rgba(18,16,14,0.60)] border border-[rgba(255,248,238,0.08)] rounded-xl px-3 py-2 text-xs text-[#F5F1EC] focus:outline-none focus:border-[#D3A06A]/50 transition-all"
                                    >
                                        {incidents.map((inc) => (
                                            <option key={inc.id} value={inc.id} className="bg-[#12100E] text-[#F5F1EC]">
                                                {inc.incident_code || `INC-${inc.id}`} · {inc.title} ({inc.source_ip || "Unknown IP"})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-[11px] font-mono text-[#9E948A] uppercase tracking-wider mb-1">
                                    Action Type
                                </label>
                                <select
                                    value={newActionType}
                                    onChange={(e) => setNewActionType(e.target.value)}
                                    className="w-full bg-[rgba(18,16,14,0.60)] border border-[rgba(255,248,238,0.08)] rounded-xl px-3 py-2 text-xs text-[#F5F1EC] focus:outline-none focus:border-[#D3A06A]/50 transition-all"
                                >
                                    <option value="BLOCK_IP" className="bg-[#12100E] text-[#F5F1EC]">BLOCK_IP (Simulated Firewall Drop)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-mono text-[#9E948A] uppercase tracking-wider mb-1">
                                    Target IP / Host / Identifier
                                </label>
                                <input
                                    type="text"
                                    value={newTarget}
                                    onChange={(e) => setNewTarget(e.target.value)}
                                    placeholder="e.g. 192.168.1.101"
                                    required
                                    className="w-full bg-[rgba(18,16,14,0.60)] border border-[rgba(255,248,238,0.08)] rounded-xl px-3.5 py-2 text-xs text-[#F5F1EC] placeholder:text-[#6E675F] focus:outline-none focus:border-[#D3A06A]/50 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-mono text-[#9E948A] uppercase tracking-wider mb-1">
                                    Reason / Authorization
                                </label>
                                <input
                                    type="text"
                                    value={newReason}
                                    onChange={(e) => setNewReason(e.target.value)}
                                    placeholder="e.g. Hostile brute-force activity"
                                    className="w-full bg-[rgba(18,16,14,0.60)] border border-[rgba(255,248,238,0.08)] rounded-xl px-3.5 py-2 text-xs text-[#F5F1EC] placeholder:text-[#6E675F] focus:outline-none focus:border-[#D3A06A]/50 transition-all"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[#D6CFC7] hover:bg-white/10 hover:text-[#F5F1EC] text-xs font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || !newTarget.trim() || incidents.length === 0}
                                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D3A06A] to-[#E3B985] text-[#0D0C0A] font-semibold text-xs hover:brightness-105 active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(211,160,106,0.25)] disabled:opacity-50"
                                >
                                    {submitting ? "Creating…" : "Register Action"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ResponseActions;
