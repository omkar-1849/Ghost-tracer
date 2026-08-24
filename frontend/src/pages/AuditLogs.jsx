import { useEffect, useState, useMemo } from "react";
import {
    FileText,
    Search,
    Shield,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Terminal,
    User,
    Calendar,
    Globe,
    Layers,
} from "lucide-react";
import { getAuditLogs } from "../services/auditLogApi";
import { isAuthenticated } from "../services/authClient";
import { Link } from "react-router-dom";

function formatTimestamp(ts) {
    if (!ts) return "—";
    try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return String(ts);
        return `${d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} · ${d.toLocaleTimeString([], { hour12: false })}`;
    } catch {
        return String(ts);
    }
}

function ActionBadge({ action }) {
    const act = String(action || "").toUpperCase();
    if (act.includes("LOGIN") || act.includes("REGISTER") || act.includes("CREATE")) {
        return (
            <span className="px-2.5 py-1 rounded text-[11px] font-mono bg-[rgba(255,255,255,0.08)] text-white border border-[rgba(255,255,255,0.2)] font-medium">
                {act}
            </span>
        );
    }
    if (act.includes("DELETE") || act.includes("REVOKE") || act.includes("DROP")) {
        return (
            <span className="px-2.5 py-1 rounded text-[11px] font-mono bg-[rgba(230,57,70,0.15)] text-[var(--color-critical)] border border-[rgba(230,57,70,0.3)] font-medium">
                {act}
            </span>
        );
    }
    return (
        <span className="px-2.5 py-1 rounded text-[11px] font-mono bg-[rgba(255,255,255,0.05)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)] font-medium">
            {act}
        </span>
    );
}

function AuditLogs() {
    const [logs, setLogs] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedRowId, setExpandedRowId] = useState(null);

    const isAuthed = isAuthenticated();

    const fetchLogs = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getAuditLogs({ limit: 100 });
            setLogs(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message || "Failed to load audit logs");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthed) {
            fetchLogs();
        } else {
            setLoading(false);
        }
    }, [isAuthed]);

    const toggleRow = (id) => {
        setExpandedRowId((prev) => (prev === id ? null : id));
    };

    const filtered = useMemo(() => {
        return logs.filter((item) => {
            const q = search.toLowerCase().trim();
            if (!q) return true;
            return (
                (item.action || "").toLowerCase().includes(q) ||
                (item.description || "").toLowerCase().includes(q) ||
                (item.ip_address || "").toLowerCase().includes(q) ||
                (item.resource_type || "").toLowerCase().includes(q) ||
                String(item.user_id || "").includes(q)
            );
        });
    }, [logs, search]);

    return (
        <div className="p-8 space-y-6 max-w-[1600px] mx-auto animate-fade-in select-none">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                        <FileText size={24} className="text-white" />
                        <span>Enterprise Audit Trail</span>
                    </h1>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Immutable record of authentication, resource modifications, and security actions
                    </p>
                </div>
                {isAuthed && (
                    <button
                        type="button"
                        onClick={fetchLogs}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] text-xs font-medium text-white transition-all shadow-sm"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                        <span>Refresh Trail</span>
                    </button>
                )}
            </div>

            {!isAuthed ? (
                <div className="frosted-card p-10 text-center space-y-4 max-w-lg mx-auto">
                    <Shield size={32} className="mx-auto text-[var(--color-text-muted)]" />
                    <h3 className="text-lg font-semibold text-white">Authentication Required</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                        Organization audit trails are protected by enterprise RBAC. Please authenticate to view audit logs.
                    </p>
                    <Link
                        to="/login?redirect=/audit-logs"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-black font-semibold text-sm hover:bg-neutral-200"
                    >
                        Sign In to Access
                    </Link>
                </div>
            ) : (
                <>
                    {/* Search Bar */}
                    <div className="frosted-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="relative w-full sm:w-96">
                            <Search
                                size={16}
                                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
                            />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by action, user, IP, resource..."
                                className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg pl-10 pr-3 py-2 text-sm text-white placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[rgba(255,255,255,0.4)]"
                            />
                        </div>
                        <span className="text-xs font-mono text-[var(--color-text-muted)]">
                            Showing {filtered.length} audit entries
                        </span>
                    </div>

                    {/* Controlled Scrollable Table Viewport */}
                    <div className="frosted-card overflow-hidden">
                        <div className="max-h-[620px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse text-[13.5px]">
                                <thead className="sticky top-0 z-10 bg-[var(--color-surface-2)] shadow-sm">
                                    <tr className="border-b border-[var(--color-border-default)] text-[11px] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                                        <th className="py-3.5 px-4 font-medium">Timestamp</th>
                                        <th className="py-3.5 px-4 font-medium">Action</th>
                                        <th className="py-3.5 px-4 font-medium">Resource</th>
                                        <th className="py-3.5 px-4 font-medium">Description</th>
                                        <th className="py-3.5 px-4 font-medium">Actor</th>
                                        <th className="py-3.5 px-4 font-medium text-right">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="6" className="py-12 text-center text-sm text-[var(--color-text-muted)]">
                                                Loading audit trail…
                                            </td>
                                        </tr>
                                    ) : error ? (
                                        <tr>
                                            <td colSpan="6" className="py-12 text-center text-sm text-[var(--color-critical)]">
                                                {error}
                                            </td>
                                        </tr>
                                    ) : filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="py-12 text-center text-sm text-[var(--color-text-muted)]">
                                                No audit entries found matching the filter.
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map((item, idx) => {
                                            const rowId = item.id || idx;
                                            const isExpanded = expandedRowId === rowId;
                                            return (
                                                <tr key={rowId} className="group hover:bg-[rgba(255,255,255,0.025)] transition-colors">
                                                    <td colSpan="6" className="p-0">
                                                        <div
                                                            onClick={() => toggleRow(rowId)}
                                                            className="grid grid-cols-12 items-center px-4 py-3.5 cursor-pointer"
                                                        >
                                                            <div className="col-span-3 font-mono text-xs text-[var(--color-text-muted)]">
                                                                {formatTimestamp(item.created_at)}
                                                            </div>
                                                            <div className="col-span-2">
                                                                <ActionBadge action={item.action} />
                                                            </div>
                                                            <div className="col-span-2 font-mono text-xs text-[var(--color-text-secondary)] truncate">
                                                                {item.resource_type || "—"} {item.resource_id ? `#${item.resource_id}` : ""}
                                                            </div>
                                                            <div className="col-span-3 font-medium text-white text-sm truncate pr-2">
                                                                {item.description || "Security audit entry"}
                                                            </div>
                                                            <div className="col-span-1 font-mono text-xs text-[var(--color-text-secondary)] truncate">
                                                                User #{item.user_id || "System"}
                                                            </div>
                                                            <div className="col-span-1 text-right">
                                                                <button
                                                                    type="button"
                                                                    className="p-1 rounded text-[var(--color-text-muted)] hover:text-white"
                                                                >
                                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Expanded Detail Panel */}
                                                        {isExpanded && (
                                                            <div className="px-6 pb-5 pt-2 bg-[var(--color-surface-inset)] border-t border-[var(--color-border-subtle)] space-y-3 animate-fade-in">
                                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                                                                    <div>
                                                                        <span className="text-[var(--color-text-muted)] block">Event ID:</span>
                                                                        <span className="text-white font-semibold">{item.id || "LOG-00"}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-[var(--color-text-muted)] block">Actor User ID:</span>
                                                                        <span className="text-white">{item.user_id || "System Default"}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-[var(--color-text-muted)] block">Origin IP:</span>
                                                                        <span className="text-white">{item.ip_address || "127.0.0.1"}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-[var(--color-text-muted)] block">Organization:</span>
                                                                        <span className="text-white">Org #{item.organization_id || "1"}</span>
                                                                    </div>
                                                                </div>

                                                                {item.user_agent && (
                                                                    <div className="text-xs font-mono">
                                                                        <span className="text-[var(--color-text-muted)] block">Client User Agent:</span>
                                                                        <span className="text-[var(--color-text-secondary)] break-all">{item.user_agent}</span>
                                                                    </div>
                                                                )}

                                                                <div className="text-xs font-mono p-3 rounded bg-[var(--color-surface-1)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                                                                    <span className="text-[var(--color-text-muted)] block mb-1">Raw Description & Context:</span>
                                                                    <p className="text-white">{item.description}</p>
                                                                </div>
                                                            </div>
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
                </>
            )}
        </div>
    );
}

export default AuditLogs;
