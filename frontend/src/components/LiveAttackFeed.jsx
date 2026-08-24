import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Crosshair, Radar, Radio } from "lucide-react";
import { getLiveFeed } from "../services/api";

const PREVIEW_LIMIT = 4;

function feedTheme(level) {
    switch (level) {
        case "CRITICAL":
            return {
                badge: "bg-[var(--color-critical)]/10 border border-[var(--color-critical)]/25 text-[var(--color-critical)]",
                icon: "text-[var(--color-critical)]",
                dot: "bg-[var(--color-critical)]",
            };
        case "HIGH":
            return {
                badge: "bg-[var(--color-high)]/10 border border-[var(--color-high)]/25 text-[var(--color-high)]",
                icon: "text-[var(--color-high)]",
                dot: "bg-[var(--color-high)]",
            };
        case "MEDIUM":
            return {
                badge: "bg-[var(--color-medium)]/10 border border-[var(--color-medium)]/25 text-[var(--color-medium)]",
                icon: "text-[var(--color-medium)]",
                dot: "bg-[var(--color-medium)]",
            };
        default:
            return {
                badge: "bg-[var(--color-success)]/10 border border-[var(--color-success)]/25 text-[var(--color-success)]",
                icon: "text-[var(--color-success)]",
                dot: "bg-[var(--color-success)]",
            };
    }
}

function timeAgo(value) {
    if (!value) return "—";
    const diff = Math.max(0, Date.now() - new Date(value).getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function LiveAttackFeed() {
    const [feed, setFeed] = useState([]);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        async function loadFeed() {
            try {
                const data = await getLiveFeed();
                setFeed(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error(error);
            }
        }
        loadFeed();
        const interval = setInterval(loadFeed, 5000);
        return () => clearInterval(interval);
    }, []);

    const visibleFeed = expanded ? feed : feed.slice(0, PREVIEW_LIMIT);

    return (
        <div className="flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                    <h2 className="card-title">
                        Live Attack Feed
                    </h2>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                        Active detections streaming from the engine
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold tracking-widest text-[var(--color-critical)] bg-[var(--color-critical)]/10 border border-[var(--color-critical)]/25">
                        <span className="relative flex w-1.5 h-1.5">
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--color-critical)] animate-[pulse-soft_2.4s_ease-in-out_infinite]" />
                        </span>
                        LIVE
                    </span>

                    <button
                        type="button"
                        onClick={() => setExpanded((value) => !value)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--color-surface-3)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-signal-strong)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-1)] transition-colors"
                    >
                        {expanded ? (
                            <>
                                <ChevronUp size={13} />
                                Collapse
                            </>
                        ) : (
                            <>
                                <ChevronDown size={13} />
                                View All
                            </>
                        )}
                    </button>
                </div>
            </div>

            {feed.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-1)] py-14">
                    <span className="w-12 h-12 rounded-lg bg-[var(--color-critical)]/10 border border-[var(--color-critical)]/25 flex items-center justify-center">
                        <Radar size={22} className="text-[var(--color-critical)]" />
                    </span>
                    <p className="text-[var(--color-text-primary)] font-medium">
                        No attacks detected
                    </p>
                    <p className="text-[var(--color-text-muted)] text-sm text-center max-w-xs">
                        The feed is quiet — live detections will stream in here
                        as they occur.
                    </p>
                </div>
            ) : (
                <>
                    <div
                        className={`grid gap-3 sm:grid-cols-2 ${
                            expanded ? "max-h-[340px] overflow-y-auto pr-1" : ""
                        }`}
                    >
                        {visibleFeed.map((item, index) => {
                            const theme = feedTheme(item.threat_level);

                            return (
                                <div
                                    key={`${item.timestamp}-${index}`}
                                    className="group relative flex items-start gap-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-4 py-3.5 hover:border-[var(--color-border-default)] hover:bg-[var(--color-surface-3)] transition-all duration-200"
                                >
                                    <span
                                        className={`mt-0.5 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border border-[var(--color-border-default)] bg-[var(--color-surface-2)]`}
                                    >
                                        <Crosshair
                                            size={15}
                                            className={theme.icon}
                                        />
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest ${theme.badge}`}
                                            >
                                                <span
                                                    className={`w-1 h-1 rounded-full ${theme.dot}`}
                                                />
                                                {item.threat_level}
                                            </span>

                                            <span className="text-[11px] text-[var(--color-text-muted)] whitespace-nowrap ml-auto tabular-nums">
                                                {timeAgo(item.timestamp)}
                                            </span>
                                        </div>

                                        <p className="mt-1.5 text-[13px] text-[var(--color-text-primary)] font-medium leading-snug line-clamp-2">
                                            {item.reason}
                                        </p>

                                        <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                                            <Radio size={11} className="shrink-0" />
                                            <span className="mono-value text-[var(--color-text-secondary)]">
                                                {item.ip_address}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--color-border-default)]">
                        <p className="text-xs text-[var(--color-text-muted)]">
                            Showing{" "}
                            <span className="text-[var(--color-text-primary)] font-semibold tabular-nums">
                                {visibleFeed.length}
                            </span>{" "}
                            of{" "}
                            <span className="text-[var(--color-text-primary)] font-semibold tabular-nums">
                                {feed.length}
                            </span>{" "}
                            detections
                        </p>

                        {feed.length > PREVIEW_LIMIT && (
                            <button
                                type="button"
                                onClick={() => setExpanded((value) => !value)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-signal-readable)] hover:text-[var(--color-signal-hover)] transition-colors"
                            >
                                {expanded ? "Collapse" : "View All"}
                                {expanded ? (
                                    <ChevronUp size={13} />
                                ) : (
                                    <ChevronDown size={13} />
                                )}
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default LiveAttackFeed;
