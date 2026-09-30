import { Globe, Plus } from "lucide-react";

export default function EmptyState({ onAdd }) {
    return (
        <div className="flex flex-col items-center justify-center py-14 text-center animate-fade-in">
            <div className="p-3 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border-default)] text-[var(--color-text-muted)] mb-4">
                <Globe size={28} />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">No websites found</h3>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-md mx-auto mb-6 leading-relaxed">
                Add your first monitored website to the Sentinel AI platform to start tracking
                security scores and scan history.
            </p>
            <button
                onClick={onAdd}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-foreground)] rounded-md text-sm font-bold transition-colors duration-150 border border-transparent active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--color-signal)]"
            >
                <Plus size={16} />
                Add Your First Website
            </button>
        </div>
    );
}
