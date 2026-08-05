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

export function StatsSkeleton() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4 mb-8" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <div className="flex justify-between items-start mb-4">
                        <ShimmerBar className="h-3 w-16" />
                        <ShimmerBar className="h-7 w-7 rounded-lg" />
                    </div>
                    <ShimmerBar className="h-6 w-10" />
                </div>
            ))}
        </div>
    );
}

export function TableSkeleton() {
    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl" aria-hidden="true">
            <div className="bg-slate-800/50 border-b border-slate-700/50 px-4 py-4 flex items-center gap-4">
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
