import { X, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

const TOAST_STYLES = {
    success: { icon: CheckCircle2, iconColor: "#16D98B", bar: "#16D98B", borderColor: "rgba(22,217,139,0.30)" },
    warning: { icon: AlertTriangle, iconColor: "#E6A93A", bar: "#E6A93A", borderColor: "rgba(230,169,58,0.30)" },
    error: { icon: XCircle, iconColor: "#F05A5A", bar: "#F05A5A", borderColor: "rgba(240,90,90,0.30)" },
    info: { icon: Info, iconColor: "#8D9AA7", bar: "#8D9AA7", borderColor: "rgba(141,154,167,0.30)" },
};

export const TOAST_DURATION = 4000;

export default function ToastStack({ toasts, onDismiss }) {
    if (!toasts.length) return null;

    return (
        <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 w-[min(92vw,380px)]" aria-live="polite">
            {toasts.map((toast) => {
                const s = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
                const Icon = s.icon;
                return (
                    <div
                        key={toast.id}
                        role="status"
                        className="relative overflow-hidden flex items-start gap-3 px-4 py-3.5 rounded-xl animate-fade-in"
                        style={{
                            background: "rgba(11,14,18,0.92)",
                            backdropFilter: "blur(22px) saturate(118%)",
                            WebkitBackdropFilter: "blur(22px) saturate(118%)",
                            border: `1px solid ${s.borderColor}`,
                            boxShadow: "0 18px 48px rgba(0,0,0,0.4)",
                        }}
                    >
                        <Icon size={18} className="shrink-0 mt-0.5" style={{ color: s.iconColor }} />
                        <p className="flex-1 text-[13px] font-semibold text-[#F4F6F7] leading-snug">{toast.message}</p>
                        <button
                            onClick={() => onDismiss(toast.id)}
                            aria-label="Dismiss notification"
                            className="p-0.5 rounded-md text-[#626B74] hover:text-[#F4F6F7] transition-colors duration-150"
                        >
                            <X size={14} />
                        </button>
                        <span
                            className="absolute bottom-0 left-0 h-[2px]"
                            style={{ background: s.bar, animation: `toast-progress ${TOAST_DURATION}ms linear forwards` }}
                        />
                    </div>
                );
            })}
        </div>
    );
}
