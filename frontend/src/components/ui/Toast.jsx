/* ============================================================
   Toast — Notification system primitive
   ============================================================ */

import { useEffect } from "react";
import { X, CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";

const icons = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
};

const colors = {
  success: "border-l-[var(--color-success)] text-[var(--color-success)]",
  warning: "border-l-[var(--color-warning)] text-[var(--color-warning)]",
  error: "border-l-[var(--color-critical)] text-[var(--color-critical)]",
  info: "border-l-[var(--color-accent)] text-[var(--color-accent)]",
};

function ToastItem({ toast, onDismiss }) {
  const Icon = icons[toast.type] || icons.info;
  const color = colors[toast.type] || colors.info;

  useEffect(() => {
    if (!toast.duration) return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        flex items-start gap-3 px-4 py-3 rounded-md border-l-[3px]
        bg-[var(--color-surface-3)] border border-[var(--color-border-default)]
        shadow-[var(--shadow-2)]
        animate-[toast-in_0.18s_ease-out_both]
        ${color}
      `.trim()}
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
      <p className="flex-1 text-sm text-[var(--color-text-secondary)]">
        {toast.message}
      </p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function Toast({ toasts = [], onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-80">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
