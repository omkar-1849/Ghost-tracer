import { useEffect, useState } from "react";
import { getTopTargetedURLs } from "../services/api";

/**
 * TopTargetedURLs — presentational body only.
 * Data fetching / polling logic is unchanged.
 */
function TopTargetedURLs() {
    const [urls, setUrls] = useState([]);

    useEffect(() => {
        async function loadURLs() {
            try {
                const data = await getTopTargetedURLs();
                setUrls(data);
            } catch (error) {
                console.error(error);
            }
        }

        loadURLs();

        const interval = setInterval(loadURLs, 5000);

        return () => clearInterval(interval);
    }, []);

    if (urls.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-700/60 bg-slate-950/30 px-6 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10">
                    <svg
                        className="h-5 w-5 text-indigo-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                </span>
                <p className="text-sm font-medium text-slate-300">
                    No targeted assets yet
                </p>
                <p className="max-w-xs text-xs text-slate-500">
                    Frequently hit endpoints will surface here once the
                    monitoring engine observes repeated attempts.
                </p>
            </div>
        );
    }

    const max = Math.max(1, ...urls.map((item) => Number(item.count) || 0));

    return (
        <div className="flex flex-1 flex-col gap-2.5">
            {urls.map((item, index) => {
                const count = Number(item.count) || 0;
                const pct = Math.round((count / max) * 100);

                return (
                    <div
                        key={index}
                        className="group/row flex items-center gap-3.5 rounded-xl border border-slate-800/50 bg-slate-800/25 px-3.5 py-2.5 transition-all duration-300 hover:border-indigo-400/25 hover:bg-slate-800/45"
                    >
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/70 font-mono text-[11px] font-bold text-slate-400">
                            {String(index + 1).padStart(2, "0")}
                        </span>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                                <span className="truncate font-mono text-[13px] font-medium text-indigo-300">
                                    {item.url}
                                </span>
                                <span className="flex-shrink-0 text-xs font-bold tabular-nums text-slate-300">
                                    {count}
                                    <span className="ml-1 font-medium text-slate-500">
                                        hits
                                    </span>
                                </span>
                            </div>

                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800/80">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-indigo-400/80 to-violet-500/80 transition-all duration-700 ease-out group-hover/row:from-indigo-400 group-hover/row:to-violet-400"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default TopTargetedURLs;
