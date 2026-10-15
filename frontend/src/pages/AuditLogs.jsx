import { useEffect, useState, useMemo } from "react";
import {
    FileText,
    Search,
    Shield,
    RefreshCw,
    ChevronDown,
    ChevronUp,
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
            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-mono bg-[rgba(211,160,106,0.14)] text-[#E3B985] border border-[rgba(211,160,106,0.3)] font-semibold">
                {act}
            </span>
        );
    }
    if (act.includes("DELETE") || act.includes("REVOKE") || act.includes("DROP")) {
        return (
            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-mono bg-[rgba(230,120,104,0.14)] text-[#E67868] border border-[rgba(230,120,104,0.3)] font-semibold">
                {act}
            </span>
        );
    }
    return (
        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-mono bg-[rgba(255,248,238,0.06)] text-[#D6CFC7] border border-[rgba(255,248,238,0.1)] font-medium">
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
        const initial = setTimeout(() => {
            if (isAuthed) fetchLogs();
            else setLoading(false);
        }, 0);
        return () => clearTimeout(initial);
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
        <div className="sentinel-page space-y-6 animate-fade-in select-none">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#F5F1EC] flex items-center gap-2.5">
                        <FileText size={24} className="text-[#D3A06A]" />
                        <span>Enterprise Audit Trail</span>
                    </h1>
                    <p className="text-xs font-mono text-[#A9A199] mt-1">
                        Immutable record of authentication, resource modifications, and security actions
                    </p>
                </div>
                {isAuthed && (
                    <button
                        type="button"
                        onClick={fetchLogs}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[rgba(20,18,16,0.55)] border border-[rgba(255,248,238,0.08)] hover:border-[rgba(211,160,106,0.3)] text-xs font-mono text-[#D6CFC7] hover:text-[#F5F1EC] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                    >
                        <RefreshCw size={13} className={loading ? "animate-spin text-[#D3A06A]" : "text-[#A9A199]"} />
                        <span>Refresh Trail</span>
                    </button>
                )}
            </div>

            {!isAuthed ? (
                <div className="sentinel-glass p-10 text-center space-y-4 max-w-lg mx-auto rounded-2xl">
                    <Shield size={32} className="mx-auto text-[#D3A06A]" />
                    <h3 className="text-lg font-semibold text-[#F5F1EC]">Authentication Required</h3>
                    <p className="text-xs font-mono text-[#A9A199]">
                        Organization audit trails are protected by enterprise RBAC. Please authenticate to view audit logs.
                    </p>
                    <Link
                        to="/login?redirect=/audit-logs"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#d3a06a] to-[#e3b985] text-[#0d0c0a] font-bold text-xs hover:brightness-105 transition-all shadow-[0_2px_12px_rgba(211,160,106,0.25)]"
                    >
                        Sign In to Access
                    </Link>
                </div>
            ) : (
                <>
                    {/* Search Bar */}
                    <div className="sentinel-glass p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="relative w-full sm:w-96">
                            <Search
                                size={15}
                                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B837B] pointer-events-none"
                            />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by action, user, IP, resource..."
                                className="w-full bg-[rgba(14,12,10,0.55)] border border-[rgba(255,248,238,0.08)] rounded-xl pl-10 pr-3 py-2 text-xs text-[#F5F1EC] placeholder:text-[#8B837B] focus:outline-none focus:border-[rgba(211,160,106,0.5)] focus:ring-1 focus:ring-[rgba(211,160,106,0.3)] transition-all"
                            />
                        </div>
                        <span className="text-xs font-mono text-[#A9A199]">
                            Showing {filtered.length} audit entries
                        </span>
                    </div>

                    {/* Controlled Scrollable Table Viewport */}
                    <div className="sentinel-glass rounded-2xl overflow-hidden">
                        <div className="max-h-[620px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse text-[13.5px]">
                                <thead className="sticky top-0 z-10 bg-[#141210]/95 backdrop-blur-xl border-b border-[rgba(255,248,238,0.06)] text-[11px] font-mono text-[#8B837B] uppercase tracking-wider">
                                    <tr>
                                        <th className="py-3.5 px-4 font-medium">Timestamp</th>
                                        <th className="py-3.5 px-4 font-medium">Action</th>
                                        <th className="py-3.5 px-4 font-medium">Resource</th>
                                        <th className="py-3.5 px-4 font-medium">Description</th>
                                        <th className="py-3.5 px-4 font-medium">Actor</th>
                                        <th className="py-3.5 px-4 font-medium text-right">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[rgba(255,248,238,0.04)]">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="6" className="py-12 text-center text-xs font-mono text-[#A9A199]">
                                                Loading audit trail…
                                            </td>
                                        </tr>
                                    ) : error ? (
                                        <tr>
                                            <td colSpan="6" className="py-12 text-center text-xs font-mono text-[#E67868]">
                                                {error}
                                            </td>
                                        </tr>
                                    ) : filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="py-12 text-center text-xs font-mono text-[#A9A199]">
                                                No audit entries found matching the filter.
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map((item, idx) => {
                                            const rowId = item.id || idx;
                                            const isExpanded = expandedRowId === rowId;
                                            return (
                                                <tr key={rowId} className="group hover:bg-[rgba(211,160,106,0.04)] transition-colors duration-150">
                                                    <td colSpan="6" className="p-0">
                                                        <div
                                                            onClick={() => toggleRow(rowId)}
                                                            className="grid grid-cols-12 items-center px-4 py-3.5 cursor-pointer"
                                                        >
                                                            <div className="col-span-3 font-mono text-xs text-[#A9A199]">
                                                                {formatTimestamp(item.created_at)}
                                                            </div>
                                                            <div className="col-span-2">
                                                                <ActionBadge action={item.action} />
                                                            </div>
                                                            <div className="col-span-2 font-mono text-xs text-[#D6CFC7] truncate">
                                                                {item.resource_type || "—"} {item.resource_id ? `#${item.resource_id}` : ""}
                                                            </div>
                                                            <div className="col-span-3 font-medium text-[#F5F1EC] text-sm truncate pr-2">
                                                                {item.description || "Security audit entry"}
                                                            </div>
                                                            <div className="col-span-1 font-mono text-xs text-[#A9A199] truncate">
                                                                User #{item.user_id || "System"}
                                                            </div>
                                                            <div className="col-span-1 text-right">
                                                                <button
                                                                    type="button"
                                                                    className="p-1 rounded-lg text-[#A9A199] hover:text-[#F5F1EC]"
                                                                >
                                                                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Expanded Detail Panel */}
                                                        {isExpanded && (
                                                            <div className="px-6 pb-5 pt-3 bg-[rgba(14,12,10,0.65)] border-t border-[rgba(255,248,238,0.06)] space-y-3 animate-fade-in">
                                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                                                                    <div>
                                                                        <span className="text-[#8B837B] block">Event ID:</span>
                                                                        <span className="text-[#D3A06A] font-semibold">{item.id || "LOG-00"}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-[#8B837B] block">Actor User ID:</span>
                                                                        <span className="text-[#F5F1EC]">{item.user_id || "System Default"}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-[#8B837B] block">Origin IP:</span>
                                                                        <span className="text-[#F5F1EC]">{item.ip_address || "127.0.0.1"}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-[#8B837B] block">Organization:</span>
                                                                        <span className="text-[#F5F1EC]">Org #{item.organization_id || "Unknown"}</span>
                                                                    </div>
                                                                </div>

                                                                {item.user_agent && (
                                                                    <div className="text-xs font-mono">
                                                                        <span className="text-[#8B837B] block">Client User Agent:</span>
                                                                        <span className="text-[#A9A199] break-all">{item.user_agent}</span>
                                                                    </div>
                                                                )}

                                                                <div className="text-xs font-mono p-3.5 rounded-xl bg-[rgba(20,18,16,0.6)] border border-[rgba(255,248,238,0.06)] text-[#D6CFC7]">
                                                                    <span className="text-[#8B837B] block mb-1">Raw Description & Context:</span>
                                                                    <p className="text-[#F5F1EC]">{item.description}</p>
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
