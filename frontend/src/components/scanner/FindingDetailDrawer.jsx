import { useState } from "react";
import {
    AlertCircle,
    Calendar,
    Check,
    Clock,
    Code,
    FileText,
    History,
    Shield,
    X,
} from "lucide-react";
import { updateFindingStatus } from "../../services/scannerApi";

const STATUS_OPTIONS = [
    { value: "open", label: "Open", color: "text-red-400 bg-red-500/10 border-red-500/20" },
    { value: "acknowledged", label: "Acknowledged", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    { value: "resolved", label: "Resolved", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    { value: "false_positive", label: "False Positive", color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" },
    { value: "accepted_risk", label: "Accepted Risk", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
];

export default function FindingDetailDrawer({ finding, onClose, onStatusUpdated }) {
    const [currentStatus, setCurrentStatus] = useState(finding?.status || "open");
    const [saving, setSaving] = useState(false);
    const [statusError, setStatusError] = useState(null);

    if (!finding) return null;

    const handleStatusChange = async (newStatus) => {
        try {
            setSaving(true);
            setStatusError(null);
            await updateFindingStatus(finding.id, newStatus);
            setCurrentStatus(newStatus);
            if (onStatusUpdated) onStatusUpdated(finding.id, newStatus);
        } catch (err) {
            setStatusError(err.message || "Failed to update status");
        } finally {
            setSaving(false);
        }
    };

    const observations = finding.observations || [];

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-2xl bg-[var(--color-surface-2)] border-l border-[var(--color-border-default)] h-full overflow-y-auto p-6 flex flex-col justify-between space-y-6 shadow-2xl">
                {/* Header */}
                <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                                    finding.severity === "critical" || finding.severity === "high"
                                        ? "bg-red-500/15 text-red-400 border-red-500/20"
                                        : "bg-amber-500/15 text-amber-400 border-amber-500/20"
                                }`}>
                                    {finding.severity}
                                </span>
                                <span className="text-xs text-[var(--color-text-muted)] font-mono">{finding.engine?.toUpperCase()}</span>
                                <span className="text-xs text-[var(--color-text-muted)] font-mono">· {finding.category}</span>
                            </div>
                            <h2 className="text-base font-bold text-[var(--color-text-primary)]">{finding.title}</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Status Lifecycle Selector */}
                    <div className="p-4 rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border-default)] space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[var(--color-text-primary)]">Triage Status</span>
                            {saving && <span className="text-[10px] text-[var(--color-text-muted)]">Updating...</span>}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {STATUS_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => handleStatusChange(opt.value)}
                                    disabled={saving}
                                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                                        currentStatus === opt.value
                                            ? `${opt.color} font-semibold shadow-sm`
                                            : "border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        {statusError && (
                            <p className="text-[11px] text-red-400 mt-1">{statusError}</p>
                        )}
                    </div>

                    {/* Description */}
                    {finding.description && (
                        <div className="space-y-1">
                            <h4 className="text-[11px] font-semibold text-[var(--color-signal)] uppercase tracking-wider">Description</h4>
                            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed bg-[var(--color-surface-1)] p-4 rounded-xl border border-[var(--color-border-default)]">
                                {finding.description}
                            </p>
                        </div>
                    )}

                    {/* Metadata & Chronology */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border-default)] space-y-1">
                            <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1 font-mono uppercase">
                                <History size={12} /> First Seen
                            </span>
                            <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                                {finding.first_seen_at ? new Date(finding.first_seen_at).toLocaleString() : "N/A"}
                            </p>
                        </div>
                        <div className="p-3 rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border-default)] space-y-1">
                            <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1 font-mono uppercase">
                                <Calendar size={12} /> Last Seen (Count: {finding.seen_count || 1})
                            </span>
                            <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                                {finding.last_seen_at ? new Date(finding.last_seen_at).toLocaleString() : "N/A"}
                            </p>
                        </div>
                    </div>

                    {/* Fingerprint */}
                    <div className="p-3 rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border-default)] space-y-1">
                        <span className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase">Deterministic Fingerprint (SHA-256)</span>
                        <p className="text-[11px] font-mono text-[var(--color-text-secondary)] break-all select-all">
                            {finding.fingerprint}
                        </p>
                    </div>

                    {/* Observations & Evidence */}
                    <div className="space-y-3">
                        <h4 className="text-[11px] font-semibold text-[var(--color-signal)] uppercase tracking-wider flex items-center gap-1.5">
                            <FileText size={13} /> Observations & Evidence ({observations.length})
                        </h4>
                        {observations.length === 0 ? (
                            <p className="text-xs text-[var(--color-text-muted)]">No historical observations attached.</p>
                        ) : (
                            <div className="space-y-3">
                                {observations.map((obs) => (
                                    <div key={obs.id} className="p-4 rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border-default)] space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-semibold text-[var(--color-text-primary)] font-mono">
                                                Rule: {obs.scanner_rule_id || "default"}
                                            </span>
                                            <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                                                {new Date(obs.observed_at).toLocaleString()}
                                            </span>
                                        </div>
                                        {obs.evidence_data && (
                                            <div className="mt-2 p-2.5 rounded-lg bg-[var(--color-surface-3)] font-mono text-[11px] text-[var(--color-text-secondary)] overflow-x-auto">
                                                <pre className="whitespace-pre-wrap">{JSON.stringify(obs.evidence_data, null, 2)}</pre>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-[var(--color-border-default)] flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--color-surface-3)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-1)] transition-colors"
                    >
                        Close Details
                    </button>
                </div>
            </div>
        </div>
    );
}
