import { useState } from "react";
import {
    BellOff,
    Check,
    Crosshair,
    Download,
    ShieldCheck,
    UserPlus,
    Loader2,
} from "lucide-react";

function ResponseActions({
    incident,
    onResolved,
    onAssign,
}) {
    const [assigning, setAssigning] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [analystName, setAnalystName] = useState("");
    const [resolving, setResolving] = useState(false);
    const [muted, setMuted] = useState(false);

    const resolved = incident?.resolved;

    function handleAssign() {
        setShowAssignModal(true);
    }

    async function confirmAssign() {
        if (!analystName.trim()) return;
        setAssigning(true);
        try {
            await onAssign?.(incident.id, analystName.trim());
            setShowAssignModal(false);
            setAnalystName("");
        } finally {
            setAssigning(false);
        }
    }

    async function handleResolve() {
        if (resolving || resolved) return;
        setResolving(true);
        try {
            await onResolved?.(incident.id);
        } finally {
            setResolving(false);
        }
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            {/* Investigate action */}
            <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-hover)] transition-colors shadow-sm"
            >
                <Crosshair size={14} />
                <span>Investigate</span>
            </button>

            {/* Assign */}
            <button
                type="button"
                onClick={handleAssign}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[var(--color-surface-1)] border border-[var(--color-border-default)] text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors"
            >
                {assigning ? (
                    <>
                        <Loader2 size={13} className="animate-spin text-[var(--color-accent)]" />
                        <span>Assigning…</span>
                    </>
                ) : (
                    <>
                        <UserPlus size={13} className="text-[var(--color-text-muted)]" />
                        <span>Assign Analyst</span>
                    </>
                )}
            </button>

            {/* Resolve */}
            <button
                type="button"
                onClick={handleResolve}
                disabled={resolved || resolving}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                    resolved
                        ? "bg-[rgba(63,163,77,0.10)] border-[rgba(63,163,77,0.25)] text-[var(--color-success)] cursor-default"
                        : "bg-[var(--color-surface-1)] border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)]"
                }`}
            >
                {resolved ? (
                    <>
                        <ShieldCheck size={13} className="text-[var(--color-success)]" />
                        <span>Resolved</span>
                    </>
                ) : resolving ? (
                    <>
                        <Loader2 size={13} className="animate-spin text-[var(--color-success)]" />
                        <span>Resolving…</span>
                    </>
                ) : (
                    <>
                        <Check size={13} className="text-[var(--color-success)]" />
                        <span>Mark Resolved</span>
                    </>
                )}
            </button>

            {/* Export */}
            <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[var(--color-surface-1)] border border-[var(--color-border-default)] text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors"
            >
                <Download size={13} className="text-[var(--color-text-muted)]" />
                <span>Export Details</span>
            </button>

            {/* Mute */}
            <button
                type="button"
                onClick={() => setMuted((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                    muted
                        ? "bg-[var(--color-surface-3)] border-[var(--color-border-default)] text-[var(--color-text-disabled)]"
                        : "bg-[var(--color-surface-1)] border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
            >
                <BellOff size={13} />
                <span>{muted ? "Muted" : "Mute"}</span>
            </button>

            {/* Assign Modal */}
            {showAssignModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={() => {
                        setShowAssignModal(false);
                        setAnalystName("");
                    }}
                >
                    <div className="absolute inset-0 bg-[var(--color-overlay)] animate-[fade-in_0.15s_ease-out_both]" aria-hidden="true" />
                    <div
                        className="relative w-full max-w-sm rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-3)] p-5 shadow-[var(--shadow-3)] animate-[modal-in_0.18s_cubic-bezier(0.16,1,0.3,1)_both]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                            Assign Case Analyst
                        </h3>

                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                            Specify the SOC analyst taking ownership of case <span className="font-mono text-[var(--color-text-primary)]">{incident?.caseId}</span>.
                        </p>

                        <input
                            type="text"
                            value={analystName}
                            onChange={(e) => setAnalystName(e.target.value)}
                            placeholder="Analyst Name (e.g. Omkar)"
                            className="mt-3.5 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                            autoFocus
                        />

                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAssignModal(false);
                                    setAnalystName("");
                                }}
                                className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={confirmAssign}
                                disabled={assigning || !analystName.trim()}
                                className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {assigning ? "Assigning…" : "Assign Case"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ResponseActions;
