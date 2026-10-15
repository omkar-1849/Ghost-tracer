import { useEffect } from "react";
import { Trash2, X, AlertTriangle, Loader2 } from "lucide-react";

export default function DeleteWebsiteDialog({ isOpen, onClose, onConfirm, count = 1, deleting = false }) {
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
            <div className="absolute inset-0 bg-[rgba(0,0,0,0.75)] backdrop-blur-md animate-backdrop-in" onClick={() => !deleting && onClose()} />

            <div className="relative bg-[rgba(8,11,14,0.68)] backdrop-blur-[28px] saturate-[125%] border border-[rgba(240,90,90,0.4)] w-full max-w-md rounded-[24px] shadow-[0_24px_70px_rgba(0,0,0,0.38)] overflow-hidden animate-pop-in">
                <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.065), rgba(255,255,255,0) 38%)" }}></div>
                
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#F05A5A] to-transparent opacity-70" />

                <div className="p-6 pb-0 flex justify-between items-start relative z-10">
                    <div className="w-13 h-13 rounded-[12px] bg-[rgba(240,90,90,0.12)] border border-[rgba(240,90,90,0.25)] flex items-center justify-center">
                        <AlertTriangle size={26} className="text-[#F05A5A]" />
                    </div>
                    <button
                        onClick={onClose}
                        disabled={deleting}
                        aria-label="Close dialog"
                        className="p-2 text-[#858E97] hover:text-[#F4F6F7] bg-[rgba(11,14,18,0.78)] hover:bg-[rgba(255,255,255,0.05)] rounded-full border border-[rgba(255,255,255,0.085)] transition-colors duration-150 active:opacity-70 disabled:opacity-50"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="px-6 py-5 relative z-10">
                    <h3 className="text-xl font-bold text-[#F4F6F7] mb-2">
                        {count === 1 ? "Archive Website" : `Archive ${count} Websites`}?
                    </h3>
                    <p className="text-sm text-[#B7BEC5] leading-relaxed">
                        Are you sure you want to archive {count === 1 ? "this website" : `these ${count} websites`}?
                        Telemetry ingestion will stop, but past alerts, incidents, and security history will remain preserved.
                    </p>
                    <div className="mt-4 p-3 rounded-[12px] bg-[rgba(240,90,90,0.12)] border border-[rgba(240,90,90,0.25)] text-xs text-[#F05A5A] leading-relaxed">
                        Collectors and telemetry keys for the selected target{count > 1 ? "s" : ""} will be revoked.
                    </div>
                </div>

                <div className="px-6 py-5 pt-4 border-t border-[rgba(255,255,255,0.055)] bg-[rgba(11,14,18,0.78)] backdrop-blur-[18px] flex justify-end gap-3 relative z-10">
                    <button
                        onClick={onClose}
                        disabled={deleting}
                        className="px-5 py-2.5 rounded-[10px] text-sm font-semibold text-[#B7BEC5] hover:text-[#F4F6F7] bg-[rgba(12,15,19,0.62)] hover:bg-[rgba(255,255,255,0.05)] transition-colors duration-150 border border-[rgba(255,255,255,0.085)] active:opacity-70 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={deleting}
                        className="px-5 py-2.5 rounded-[10px] text-sm font-bold text-white bg-[#F05A5A] hover:bg-[#d94848] transition-colors duration-150 border border-transparent active:scale-[0.98] flex items-center gap-2 disabled:opacity-50 shadow-sm"
                    >
                        {deleting && <Loader2 size={16} className="animate-spin" />}
                        <Trash2 size={16} />
                        {deleting ? "Archiving…" : count > 1 ? `Archive ${count} Websites` : "Archive Website"}
                    </button>
                </div>
            </div>
        </div>
    );
}
