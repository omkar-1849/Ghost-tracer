import { useEffect, useState } from "react";
import {
    ChevronDown,
    ChevronUp,
    Crosshair,
    Radar,
    Radio,
} from "lucide-react";
import { getLiveFeed } from "../services/api";

/* ------------------------------------------------------------------ */
/* Config / helpers                                                    */
/* ------------------------------------------------------------------ */

const PREVIEW_LIMIT = 4;

function feedTheme(level) {
    switch (level) {
        case "CRITICAL":
            return {
                badge: "bg-red-500/10 border border-red-500/25 text-red-400",
                icon: "text-red-400",
                dot: "bg-red-500",
                glow: "shadow-[0_0_16px_rgba(239,68,68,0.35)]",
            };
        case "HIGH":
            return {
                badge: "bg-orange-500/10 border border-orange-500/25 text-orange-400",
                icon: "text-orange-400",
                dot: "bg-orange-500",
                glow: "shadow-[0_0_16px_rgba(249,115,22,0.35)]",
            };
        case "MEDIUM":
            return {
                badge: "bg-yellow-500/10 border border-yellow-500/25 text-yellow-400",
                icon: "text-yellow-400",
                dot: "bg-yellow-500",
                glow: "shadow-[0_0_16px_rgba(234,179,8,0.3)]",
            };
        default:
            return {
                badge: "bg-green-500/10 border border-green-500/25 text-green-400",
                icon: "text-green-400",
                dot: "bg-green-500",
                glow: "shadow-[0_0_16px_rgba(34,197,94,0.3)]",
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

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">
                        Live Attack Feed
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Active detections streaming from the engine
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/25 text-[10px] font-bold tracking-widest text-red-400">
                        <span className="relative flex w-1.5 h-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                        </span>
                        LIVE
                    </span>

                    <button
                        type="button"
                        onClick={() => setExpanded((value) => !value)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-800/60 border border-slate-700 text-slate-300 hover:border-blue-500/40 hover:text-white hover:bg-slate-800 transition-colors"
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

            {/* Body */}
            {feed.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-800 bg-slate-950/40 py-14">
                    <span className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center">
                        <Radar size={22} className="text-red-400" />
                    </span>
                    <p className="text-slate-300 font-medium">
                        No attacks detected
                    </p>
                    <p className="text-slate-500 text-sm text-center max-w-xs">
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
                                    className="group relative flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3.5 hover:border-slate-700 hover:bg-slate-800/40 transition-all duration-200"
                                >
                                    <span
                                        className={`mt-0.5 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border border-slate-800 bg-slate-900 ${theme.glow}`}
                                    >
                                        <Crosshair
                                            size={15}
                                            className={theme.icon}
                                        />
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest ${theme.badge}`}
                                            >
                                                <span
                                                    className={`w-1 h-1 rounded-full ${theme.dot}`}
                                                />
                                                {item.threat_level}
                                            </span>

                                            <span className="text-[11px] text-slate-500 whitespace-nowrap ml-auto">
                                                {timeAgo(item.timestamp)}
                                            </span>
                                        </div>

                                        <p className="mt-2 text-sm text-slate-200 font-medium leading-snug line-clamp-2">
                                            {item.reason}
                                        </p>

                                        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-blue-400">
                                            <Radio size={12} className="shrink-0" />
                                            <span className="font-mono">
                                                {item.ip_address}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer count */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800/70">
                        <p className="text-xs text-slate-500">
                            Showing{" "}
                            <span className="text-slate-300 font-semibold">
                                {visibleFeed.length}
                            </span>{" "}
                            of{" "}
                            <span className="text-slate-300 font-semibold">
                                {feed.length}
                            </span>{" "}
                            detections
                        </p>

                        {feed.length > PREVIEW_LIMIT && (
                            <button
                                type="button"
                                onClick={() => setExpanded((value) => !value)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
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
