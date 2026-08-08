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
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm animate-backdrop-in" onClick={() => !deleting && onClose()} />

            {/* Panel */}
            <div className="relative bg-slate-900 border border-red-900/40 w-full max-w-md rounded-2xl shadow-2xl shadow-black overflow-hidden animate-pop-in">
                {/* Top red accent line */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-600 opacity-70" />

                <div className="p-6 pb-0 flex justify-between items-start">
                    <div className="w-13 h-13 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center">
                        <AlertTriangle size={26} className="text-red-400" />
                    </div>
                    <button
                        onClick={onClose}
                        disabled={deleting}
                        aria-label="Close dialog"
                        className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-full border border-slate-700/60 transition-colors duration-150 active:opacity-70 disabled:opacity-50"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="px-6 py-5">
                    <h3 className="text-xl font-bold text-white mb-2">
                        {count === 1 ? "Delete Website" : `Delete ${count} Websites`}?
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        Are you sure you want to permanently delete {count === 1 ? "this website" : `these ${count} websites`}?
                        This action cannot be undone and will remove all associated configurations.
                    </p>
                    <div className="mt-4 p-3 rounded-xl bg-red-950/30 border border-red-900/30 text-xs text-red-300/80 leading-relaxed">
                        Monitoring, scan history and security telemetry for the selected target{count > 1 ? "s" : ""} will be purged immediately.
                    </div>
                </div>

                <div className="px-6 py-5 pt-4 border-t border-slate-800/80 bg-slate-900/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={deleting}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors duration-150 border border-slate-700/60 active:opacity-70 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={deleting}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-red-700 to-rose-700 hover:from-red-600 hover:to-rose-600 transition-colors duration-150 border border-red-500/30 active:scale-[0.98] flex items-center gap-2 disabled:opacity-50"
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
