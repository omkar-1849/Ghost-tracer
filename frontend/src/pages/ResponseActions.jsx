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
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.3)] text-[var(--color-success)] font-medium">
                <CheckCircle2 size={12} />
                <span>SIMULATED</span>
            </span>
        );
    }
    if (s === "FAILED" || s === "BLOCKED") {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-[rgba(230,57,70,0.12)] border border-[rgba(230,57,70,0.3)] text-[var(--color-critical)] font-medium">
                <XCircle size={12} />
                <span>{s}</span>
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-[rgba(245,158,11,0.12)] border border-[rgba(245,158,11,0.3)] text-[var(--color-high)] font-medium">
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
                if (incData.value.length > 0) setNewIncidentId((current) => current || incData.value[0].id);
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
        <div className="p-8 space-y-6 max-w-[1600px] mx-auto animate-fade-in select-none">
            {loadError && <p role="alert">{loadError}</p>}
            {/* Native Toast Feedback */}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                        <Zap size={24} className="text-white" />
                        <span>Defensive Response Actions</span>
                    </h1>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Simulation queue only — actions do not enforce blocking or isolation
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={loadActions}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] text-xs text-white transition-all shadow-sm"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                        <span>Sync Queue</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors shadow-sm"
                    >
                        <Plus size={14} />
                        <span>Create Action</span>
                    </button>
                </div>
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
                        placeholder="Search by action type, target IP, reason..."
                        className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg pl-10 pr-3 py-2 text-sm text-white placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[rgba(255,255,255,0.4)]"
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
                                    ? "bg-white text-black font-semibold shadow-sm"
                                    : "bg-[var(--color-surface-1)] text-[var(--color-text-secondary)] hover:text-white border border-[var(--color-border-default)]"
                            }`}
                        >
                            {st}
                        </button>
                    ))}
                </div>
            </div>

            {/* Response Actions Table */}
            <div className="frosted-card p-5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13.5px]">
                        <thead>
                            <tr className="border-b border-[var(--color-border-default)] text-[11px] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                                <th className="pb-3.5 font-medium">Action ID</th>
                                <th className="pb-3.5 font-medium">Action Type</th>
                                <th className="pb-3.5 font-medium">Target</th>
                                <th className="pb-3.5 font-medium">Status</th>
                                <th className="pb-3.5 font-medium">Reason / Rationale</th>
                                <th className="pb-3.5 font-medium">Created At</th>
                                <th className="pb-3.5 font-medium text-right">Simulate</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border-subtle)]">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="py-12 text-center text-sm text-[var(--color-text-muted)]">
                                        Loading defensive actions…
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="py-12 text-center text-sm text-[var(--color-text-muted)]">
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
                                            className="group hover:bg-[rgba(255,255,255,0.03)] transition-colors duration-100"
                                        >
                                            <td className="py-3.5 font-mono text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                                                {actionId}
                                            </td>
                                            <td className="py-3.5 font-mono font-semibold text-white whitespace-nowrap">
                                                {act.action_type || "BLOCK_IP"}
                                            </td>
                                            <td className="py-3.5 font-mono text-xs text-white whitespace-nowrap">
                                                {act.target || "—"}
                                            </td>
                                            <td className="py-3.5 whitespace-nowrap">
                                                <StatusBadge status={act.status} />
                                            </td>
                                            <td className="py-3.5 font-medium text-[var(--color-text-secondary)] max-w-sm truncate text-sm">
                                                {act.reason || "Automated anomaly mitigation"}
                                            </td>
                                            <td className="py-3.5 font-mono text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                                                {formatTimestamp(act.created_at)}
                                            </td>
                                            <td className="py-3.5 text-right whitespace-nowrap">
                                                {isPending ? (
                                                    <button
                                                        type="button"
                                                        disabled={isExecuting}
                                                        onClick={() => handleExecute(act.id)}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors shadow-sm disabled:opacity-50"
                                                    >
                                                        <Play size={11} fill="currentColor" />
                                                        <span>{isExecuting ? "Executing…" : "Dispatch"}</span>
                                                    </button>
                                                ) : (
                                                    <span className="text-xs font-mono text-[var(--color-text-muted)]">
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="w-full max-w-md bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-xl shadow-[var(--shadow-modal)] p-6 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-subtle)]">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <Zap size={16} />
                                <span>Create Countermeasure Action</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                className="text-[var(--color-text-secondary)] hover:text-white"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateAction} className="space-y-4">
                            <div>
                                <label className="block text-xs font-mono text-[var(--color-text-muted)] uppercase mb-1">
                                    Target Incident
                                </label>
                                <select
                                    value={newIncidentId}
                                    onChange={(e) => setNewIncidentId(e.target.value)}
                                    className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                                >
                                    {incidents.map((inc) => (
                                        <option key={inc.id} value={inc.id}>
                                            {inc.incident_code || `INC-${inc.id}`} · {inc.title}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-[var(--color-text-muted)] uppercase mb-1">
                                    Action Type
                                </label>
                                <select
                                    value={newActionType}
                                    onChange={(e) => setNewActionType(e.target.value)}
                                    className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                                >
                                    <option value="BLOCK_IP">BLOCK_IP (Firewall drop)</option>
                                    <option value="BLOCK_SESSION">BLOCK_SESSION (Terminate JWT)</option>
                                    <option value="DISABLE_USER">DISABLE_USER (Account Lockout)</option>
                                    <option value="ISOLATE_ASSET">ISOLATE_ASSET (Network Quarantine)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-[var(--color-text-muted)] uppercase mb-1">
                                    Target IP / Host / Identifier
                                </label>
                                <input
                                    type="text"
                                    value={newTarget}
                                    onChange={(e) => setNewTarget(e.target.value)}
                                    placeholder="e.g. 192.168.1.101"
                                    required
                                    className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-[var(--color-text-muted)] uppercase mb-1">
                                    Reason / Authorization
                                </label>
                                <input
                                    type="text"
                                    value={newReason}
                                    onChange={(e) => setNewReason(e.target.value)}
                                    placeholder="e.g. Hostile brute-force activity"
                                    className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border-subtle)]">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="px-3.5 py-2 rounded-lg bg-[var(--color-surface-3)] text-white text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || !newTarget.trim()}
                                    className="px-4 py-2 rounded-lg bg-white text-black font-semibold text-xs hover:bg-neutral-200 disabled:opacity-50"
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
