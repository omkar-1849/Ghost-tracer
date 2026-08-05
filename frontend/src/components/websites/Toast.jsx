import { X, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

const TOAST_STYLES = {
    success: { icon: CheckCircle2, iconClass: "text-emerald-400", bar: "bg-emerald-400", wrapper: "bg-emerald-950/95 border-emerald-500/30 shadow-emerald-900/40" },
    warning: { icon: AlertTriangle, iconClass: "text-amber-400", bar: "bg-amber-400", wrapper: "bg-amber-950/95 border-amber-500/30 shadow-amber-900/40" },
    error: { icon: XCircle, iconClass: "text-red-400", bar: "bg-red-500", wrapper: "bg-red-950/95 border-red-500/30 shadow-red-900/40" },
    info: { icon: Info, iconClass: "text-cyan-400", bar: "bg-cyan-400", wrapper: "bg-cyan-950/95 border-cyan-500/30 shadow-cyan-900/40" },
};

export const TOAST_DURATION = 4000;

export default function ToastStack({ toasts, onDismiss }) {
    if (!toasts.length) return null;

    return (
        <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 w-[min(92vw,380px)]" aria-live="polite">
            {toasts.map(toast => {
                const s = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
                const Icon = s.icon;
                return (
                    <div
                        key={toast.id}
                        role="status"
                        className={`relative overflow-hidden flex items-start gap-3 px-4 py-3.5 rounded-xl border shadow-2xl backdrop-blur-xl animate-toast-in ${s.wrapper}`}
                    >
                        <Icon size={18} className={`shrink-0 mt-0.5 ${s.iconClass}`} />
                        <p className="flex-1 text-sm font-semibold text-white leading-snug">{toast.message}</p>
                        <button
                            onClick={() => onDismiss(toast.id)}
                            aria-label="Dismiss notification"
                            className="p-0.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors duration-150"
                        >
                            <X size={14} />
                        </button>
                        {/* Auto-dismiss progress bar */}
                        <span
                            className={`absolute bottom-0 left-0 h-[2px] ${s.bar}`}
                            style={{ animation: `toast-progress ${TOAST_DURATION}ms linear forwards` }}
                        />
                    </div>
                );
            })}
        </div>
    );
}
