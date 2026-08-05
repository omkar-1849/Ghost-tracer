import { Globe, Plus } from "lucide-react";

export default function EmptyState({ onAdd }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in-up">
            {/* Floating illustration */}
            <div className="relative w-36 h-36 mb-8">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-3xl animate-glow-pulse" />
                <div className="absolute -inset-3 rounded-full border border-dashed border-emerald-500/20 animate-float-slow" />
                <div className="relative w-full h-full bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.15)]">
                    {/* Orbiting ring */}
                    <span className="absolute inset-2 rounded-full border border-slate-800/80" />
                    <span className="absolute w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)] top-3 right-6 animate-pulse-dot" />
                    <Globe size={52} className="text-emerald-400 relative" />
                </div>
            </div>

            <h3 className="text-2xl font-bold text-white mb-3">No Websites Found</h3>
            <p className="text-slate-400 max-w-md mx-auto mb-8 leading-relaxed">
                Add your first monitored website to the Sentinel AI platform. Start tracking
                security scores, active environments, and historical scans automatically.
            </p>

            <button
                onClick={onAdd}
                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:shadow-[0_0_30px_rgba(16,185,129,0.55)] transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] border border-emerald-400/20 focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            >
                <Plus size={18} />
                Add Your First Website
            </button>
        </div>
    );
}
