import { Shield, Plus } from "lucide-react";

export default function EmptyState({ onAdd }) {
    return (
        <div className="flex flex-col items-center justify-center py-14 text-center animate-fade-in">
            <div className="p-3 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border-default)] text-[var(--color-text-muted)] mb-4">
                <Shield size={28} className="text-white" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">No Protected Application Configured</h3>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-md mx-auto mb-6 leading-relaxed">
                Configure your controlled target application to enable continuous Sentinel threat detection, vulnerability analysis, and simulated active defense.
            </p>
            <button
                onClick={onAdd}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-neutral-200 text-black rounded-lg text-xs font-semibold transition-all duration-150 shadow-sm shrink-0"
            >
                <Plus size={16} />
                Configure Protected Application
            </button>
        </div>
    );
}
