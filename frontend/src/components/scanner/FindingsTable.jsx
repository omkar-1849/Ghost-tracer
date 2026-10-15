import { useState, useEffect } from "react";
import {
    AlertCircle,
    ChevronRight,
    ExternalLink,
    Filter,
    Loader2,
    ShieldAlert,
} from "lucide-react";
import { getScanFindings, getFindingById } from "../../services/scannerApi";
import FindingDetailDrawer from "./FindingDetailDrawer";

export default function FindingsTable({ scanId }) {
    const [findings, setFindings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedFinding, setSelectedFinding] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const fetchFindings = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getScanFindings(scanId);
            setFindings(data || []);
        } catch (err) {
            setError(err.message || "Failed to load scan findings");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (scanId) {
            fetchFindings();
        }
    }, [scanId]);

    const handleRowClick = async (finding) => {
        try {
            setLoadingDetail(true);
            const detailed = await getFindingById(finding.id);
            setSelectedFinding(detailed);
        } catch (err) {
            // Fallback to basic finding object if detail fetch fails
            setSelectedFinding(finding);
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleStatusUpdated = (findingId, newStatus) => {
        setFindings((prev) =>
            prev.map((f) => (f.id === findingId ? { ...f, status: newStatus } : f))
        );
        if (selectedFinding && selectedFinding.id === findingId) {
            setSelectedFinding((prev) => ({ ...prev, status: newStatus }));
        }
    };

    if (loading) {
        return (
            <div className="p-8 text-center text-xs text-[var(--color-text-muted)] flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin text-[var(--color-signal)]" />
                <span>Loading normalized findings...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                {error}
            </div>
        );
    }

    if (findings.length === 0) {
        return (
            <div className="p-8 text-center rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border-default)]">
                <p className="text-xs text-[var(--color-text-muted)]">No security findings recorded for this assessment.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border-default)]">
                <table className="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr className="bg-[var(--color-surface-1)] border-b border-[var(--color-border-default)] text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                            <th className="py-3 px-4">Severity</th>
                            <th className="py-3 px-4">Title & Category</th>
                            <th className="py-3 px-4">Engine</th>
                            <th className="py-3 px-4">Confidence</th>
                            <th className="py-3 px-4">Occurrences</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-default)] bg-[var(--color-surface-2)]">
                        {findings.map((f) => {
                            const sev = (f.severity || "info").toLowerCase();
                            const isCritOrHigh = sev === "critical" || sev === "high";

                            return (
                                <tr
                                    key={f.id}
                                    onClick={() => handleRowClick(f)}
                                    className="hover:bg-[var(--color-surface-3)] cursor-pointer transition-colors"
                                >
                                    <td className="py-3 px-4">
                                        <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                isCritOrHigh
                                                    ? "bg-red-500/15 text-red-400 border border-red-500/20"
                                                    : sev === "medium"
                                                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                                                    : "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                                            }`}
                                        >
                                            {f.severity}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <p className="font-semibold text-[var(--color-text-primary)] truncate max-w-sm">
                                            {f.title}
                                        </p>
                                        <p className="text-[10px] text-[var(--color-text-muted)] font-mono">
                                            {f.category}
                                        </p>
                                    </td>
                                    <td className="py-3 px-4 font-mono text-[11px] text-[var(--color-text-secondary)] uppercase">
                                        {f.engine}
                                    </td>
                                    <td className="py-3 px-4 font-mono text-[11px] text-[var(--color-text-secondary)]">
                                        {f.confidence != null ? `${Math.round(f.confidence * 100)}%` : "100%"}
                                    </td>
                                    <td className="py-3 px-4 font-mono text-[11px] text-[var(--color-text-secondary)]">
                                        {f.seen_count || 1}
                                    </td>
                                    <td className="py-3 px-4">
                                        <span
                                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${
                                                f.status === "open"
                                                    ? "bg-red-500/10 text-red-400"
                                                    : f.status === "resolved"
                                                    ? "bg-emerald-500/10 text-emerald-400"
                                                    : f.status === "acknowledged"
                                                    ? "bg-amber-500/10 text-amber-400"
                                                    : "bg-zinc-500/10 text-zinc-400"
                                            }`}
                                        >
                                            {f.status?.replace("_", " ") || "open"}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <span className="text-[var(--color-signal)] hover:underline inline-flex items-center gap-1">
                                            Details <ChevronRight size={13} />
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Finding Detail Drawer */}
            {selectedFinding && (
                <FindingDetailDrawer
                    finding={selectedFinding}
                    onClose={() => setSelectedFinding(null)}
                    onStatusUpdated={handleStatusUpdated}
                />
            )}
        </div>
    );
}
