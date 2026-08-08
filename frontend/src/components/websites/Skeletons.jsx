/**
 * Skeleton loaders with animated shimmer — replaces the full-screen spinner
 * during initial data fetch. Used by WebsiteLayout.
 */

function ShimmerBar({ className = "" }) {
    return (
        <div className={`relative overflow-hidden bg-slate-800/60 rounded-md ${className}`}>
            <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-slate-700/40 to-transparent" />
        </div>
    );
}

/** Reserved-width text bars for the inline summary strip — no card shapes. */
export function SummarySkeleton() {
    const items = [
        { bar: "w-20", label: "w-16" },
        { bar: "w-12", label: "w-10" },
        { bar: "w-12", label: "w-10" },
        { bar: "w-12", label: "w-12" },
        { bar: "w-16", label: "w-28" },
    ];
    return (
        <div className="flex flex-wrap items-center gap-x-10 gap-y-4 mb-8" aria-hidden="true">
            {items.map((item, idx) => (
                <div key={idx} className="flex items-center">
                    {idx > 0 && <span className="hidden md:block w-px self-stretch min-h-7 bg-slate-800/70 mr-10" />}
                    <div className="flex items-baseline gap-3">
                        <ShimmerBar className={`h-8 ${item.bar}`} />
                        <ShimmerBar className={`h-3 ${item.label}`} />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function TableSkeleton() {
    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden" aria-hidden="true">
            <div className="bg-slate-800/50 border-b border-slate-700/50 px-4 py-3.5 flex items-center gap-4">
                <ShimmerBar className="h-3 w-3 rounded-sm" />
                <ShimmerBar className="h-3 w-24" />
                <ShimmerBar className="h-3 w-28" />
                <ShimmerBar className="h-3 w-32" />
                <ShimmerBar className="h-3 w-16" />
            </div>
            <div className="divide-y divide-slate-800/50">
                {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="px-4 py-5 flex items-center gap-6">
                        <ShimmerBar className="h-3 w-3 rounded-sm shrink-0" />
                        <ShimmerBar className="h-4 w-40 shrink-0" />
                        <ShimmerBar className="h-3 w-20 shrink-0" />
                        <ShimmerBar className="h-3 w-24 shrink-0" />
                        <ShimmerBar className="h-4 w-8 shrink-0" />
                        <ShimmerBar className="h-3 w-16 ml-auto shrink-0" />
                    </div>
                ))}
            </div>
        </div>
    );
}
