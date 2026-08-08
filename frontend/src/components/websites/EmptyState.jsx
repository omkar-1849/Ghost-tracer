import { Globe, Plus } from "lucide-react";

export default function EmptyState({ onAdd }) {
    return (
        <div className="flex flex-col items-center justify-center py-14 text-center animate-fade-in">
            <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/60 text-slate-400 mb-4">
                <Globe size={28} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No websites found</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
                Add your first monitored website to the Sentinel AI platform to start tracking
                security scores and scan history.
            </p>
            <button
                onClick={onAdd}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-sm font-bold transition-colors duration-150 border border-emerald-400/20 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            >
                <Plus size={16} />
                Add Your First Website
            </button>
        </div>
    );
}
