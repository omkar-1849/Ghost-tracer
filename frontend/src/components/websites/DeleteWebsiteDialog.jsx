import { useEffect } from "react";
import { Trash2, X, AlertTriangle, Loader2 } from "lucide-react";

export default function DeleteWebsiteDialog({ isOpen, onClose, onConfirm, count = 1, deleting = false }) {
    // Close on Escape (but not mid-delete)
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && !deleting) onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose, deleting]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-[var(--color-canvas)]  animate-backdrop-in" onClick={() => !deleting && onClose()} />

            {/* Panel */}
            <div className="relative bg-[var(--color-surface-1)] border border-[var(--color-critical)] w-full max-w-md rounded-lg shadow-[var(--shadow-3)] overflow-hidden animate-pop-in">
                {/* Top red accent line */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--color-critical)] opacity-70" />

                <div className="p-6 pb-0 flex justify-between items-start">
                    <div className="w-13 h-13 rounded-lg bg-[var(--color-critical)] border border-[var(--color-critical)] flex items-center justify-center">
                        <AlertTriangle size={26} className="text-[var(--color-critical)]" />
                    </div>
                    <button
                        onClick={onClose}
                        disabled={deleting}
                        aria-label="Close dialog"
                        className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] rounded-full border border-[var(--color-border-default)] transition-colors duration-150 active:opacity-70 disabled:opacity-50"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="px-6 py-5">
                    <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
                        {count === 1 ? "Delete Website" : `Delete ${count} Websites`}?
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                        Are you sure you want to permanently delete {count === 1 ? "this website" : `these ${count} websites`}?
                        This action cannot be undone and will remove all associated configurations.
                    </p>
                    <div className="mt-4 p-3 rounded-md bg-[var(--color-critical)]/10 border border-[var(--color-critical)] text-xs text-[var(--color-critical)] leading-relaxed">
                        Monitoring, scan history and security telemetry for the selected target{count > 1 ? "s" : ""} will be purged immediately.
                    </div>
                </div>

                <div className="px-6 py-5 pt-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={deleting}
                        className="px-5 py-2.5 rounded-md text-sm font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] transition-colors duration-150 border border-[var(--color-border-default)] active:opacity-70 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={deleting}
                        className="px-5 py-2.5 rounded-md text-sm font-bold text-white bg-[var(--color-critical)] hover:bg-red-600 transition-colors duration-150 border border-transparent active:scale-[0.98] flex items-center gap-2 disabled:opacity-50 shadow-sm"
                    >
                        {deleting && <Loader2 size={16} className="animate-spin" />}
                        <Trash2 size={16} />
                        {deleting ? "Deleting…" : count > 1 ? `Delete ${count} Websites` : "Delete Website"}
                    </button>
                </div>
            </div>
        </div>
    );
}
