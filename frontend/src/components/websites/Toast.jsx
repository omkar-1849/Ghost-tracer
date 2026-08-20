import { X, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

const TOAST_STYLES = {
    success: { icon: CheckCircle2, iconClass: "text-[var(--color-success)]", bar: "bg-[var(--color-success)]", wrapper: "bg-[var(--color-surface-2)] border-[var(--color-success)]" },
    warning: { icon: AlertTriangle, iconClass: "text-[var(--color-warning)]", bar: "bg-[var(--color-warning)]", wrapper: "bg-[var(--color-surface-2)] border-[var(--color-warning)]" },
    error: { icon: XCircle, iconClass: "text-[var(--color-critical)]", bar: "bg-[var(--color-critical)]", wrapper: "bg-[var(--color-surface-2)] border-[var(--color-critical)]" },
    info: { icon: Info, iconClass: "text-[var(--color-info)]", bar: "bg-[var(--color-info)]", wrapper: "bg-[var(--color-surface-2)] border-[var(--color-info)]" },
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
                        className={`relative overflow-hidden flex items-start gap-3 px-4 py-3.5 rounded-md border shadow-[var(--shadow-2)] animate-toast-in ${s.wrapper}`}
                    >
                        <Icon size={18} className={`shrink-0 mt-0.5 ${s.iconClass}`} />
                        <p className="flex-1 text-sm font-semibold text-[var(--color-text-primary)] leading-snug">{toast.message}</p>
                        <button
                            onClick={() => onDismiss(toast.id)}
                            aria-label="Dismiss notification"
                            className="p-0.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors duration-150"
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
