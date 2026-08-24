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
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-6 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-2)]">
                    <svg
                        className="h-5 w-5 text-[var(--color-text-muted)]"
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
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    No targeted assets yet
                </p>
                <p className="max-w-xs text-xs text-[var(--color-text-muted)]">
                    Frequently hit endpoints will surface here once the
                    monitoring engine observes repeated attempts.
                </p>
            </div>
        );
    }

    const max = Math.max(1, ...urls.map((item) => Number(item.count) || 0));

    return (
        <div className="flex flex-1 flex-col divide-y divide-[var(--color-border-subtle)]">
            {urls.map((item, index) => {
                const count = Number(item.count) || 0;
                const pct = Math.round((count / max) * 100);

                return (
                    <div
                        key={index}
                        className="group/row flex items-center gap-4 py-2.5 transition-colors duration-150"
                    >
                        <span className="w-6 flex-shrink-0 text-right font-mono text-[11px] font-semibold text-[var(--color-text-disabled)] tabular-nums">
                            {String(index + 1).padStart(2, "0")}
                        </span>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                                <span className="truncate mono-value text-[12.5px] font-medium text-[var(--color-text-secondary)] group-hover/row:text-[var(--color-text-primary)] transition-colors">
                                    {item.url}
                                </span>
                                <span className="flex-shrink-0 text-xs font-bold tabular-nums text-[var(--color-text-primary)]">
                                    {count}
                                    <span className="ml-1 font-medium text-[var(--color-text-muted)]">
                                        hits
                                    </span>
                                </span>
                            </div>

                            <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-[var(--color-surface-3)]">
                                <div
                                    className="h-full rounded-full bg-[var(--color-low)] opacity-80 transition-all duration-700 ease-out"
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
