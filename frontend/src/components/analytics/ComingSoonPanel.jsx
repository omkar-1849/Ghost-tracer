import { Lock } from "lucide-react";

/**
 * ComingSoonPanel
 * ---------------
 * Tasteful placeholder used for future Analytics modules (World Attack
 * Map, Historical Trends). Each variant ships its own subtle animated
 * illustration so the reserved space already feels alive:
 *
 *  - variant "map": radar sweep with pulsing threat dots
 *  - variant "trends": ghosted detection trendline
 *
 * The panel carries a "COMING SOON" chip and a lock icon; the whole
 * surface gently glows on hover.
 */

/* ------------------------------------------------------------------ */
/* Variant illustrations                                                */
/* ------------------------------------------------------------------ */

function RadarIllustration() {
    return (
        <svg
            viewBox="0 0 560 260"
            className="h-full w-full"
            aria-hidden="true"
        >
            <defs>
                <linearGradient
                    id="mapSweepGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                >
                    <stop offset="0%" stopColor="rgba(34,211,238,0.5)" />
                    <stop offset="100%" stopColor="rgba(34,211,238,0)" />
                </linearGradient>
                <radialGradient id="mapCoreGlow">
                    <stop offset="0%" stopColor="rgba(34,211,238,0.28)" />
                    <stop offset="100%" stopColor="rgba(34,211,238,0)" />
                </radialGradient>
            </defs>

            {/* Radar rings */}
            {[46, 92, 138, 184].map((r) => (
                <circle
                    key={r}
                    cx="280"
                    cy="130"
                    r={r}
                    fill="none"
                    stroke="rgba(148,163,184,0.14)"
                    strokeWidth="1"
                    strokeDasharray={r === 92 ? "3 7" : undefined}
                />
            ))}

            {/* Crosshairs */}
            <line
                x1="280"
                y1="10"
                x2="280"
                y2="250"
                stroke="rgba(148,163,184,0.1)"
                strokeWidth="1"
            />
            <line
                x1="90"
                y1="130"
                x2="470"
                y2="130"
                stroke="rgba(148,163,184,0.1)"
                strokeWidth="1"
            />

            {/* Core glow */}
            <circle cx="280" cy="130" r="60" fill="url(#mapCoreGlow)" />

            {/* Rotating sweep */}
            <g className="analytics-radar-sweep">
                <path
                    d="M280 130 L430 130 A150 150 0 0 0 342 6 Z"
                    fill="url(#mapSweepGradient)"
                    opacity="0.55"
                />
            </g>

            {/* Threat blips */}
            <g>
                <circle cx="196" cy="66" r="10" fill="none" stroke="rgba(244,63,94,0.35)" strokeWidth="1">
                    <animate
                        attributeName="r"
                        values="4;12;4"
                        dur="2.6s"
                        repeatCount="indefinite"
                    />
                    <animate
                        attributeName="opacity"
                        values="0.7;0;0.7"
                        dur="2.6s"
                        repeatCount="indefinite"
                    />
                </circle>
                <circle cx="196" cy="66" r="3.5" fill="#fb7185" />
            </g>

            <g>
                <circle cx="382" cy="92" r="10" fill="none" stroke="rgba(251,191,36,0.35)" strokeWidth="1">
                    <animate
                        attributeName="r"
                        values="4;12;4"
                        dur="3.1s"
                        repeatCount="indefinite"
                    />
                    <animate
                        attributeName="opacity"
                        values="0.7;0;0.7"
                        dur="3.1s"
                        repeatCount="indefinite"
                    />
                </circle>
                <circle cx="382" cy="92" r="3.5" fill="#fbbf24" />
            </g>

            <g>
                <circle cx="330" cy="196" r="10" fill="none" stroke="rgba(34,211,238,0.35)" strokeWidth="1">
                    <animate
                        attributeName="r"
                        values="4;12;4"
                        dur="2.2s"
                        repeatCount="indefinite"
                    />
                    <animate
                        attributeName="opacity"
                        values="0.7;0;0.7"
                        dur="2.2s"
                        repeatCount="indefinite"
                    />
                </circle>
                <circle cx="330" cy="196" r="3.5" fill="#22d3ee" />
            </g>

            {/* Connection arcs */}
            <path
                d="M196 66 Q 280 40 382 92"
                fill="none"
                stroke="rgba(34,211,238,0.25)"
                strokeWidth="1"
                strokeDasharray="3 6"
            >
                <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to="-18"
                    dur="2.4s"
                    repeatCount="indefinite"
                />
            </path>
            <path
                d="M382 92 Q 420 160 330 196"
                fill="none"
                stroke="rgba(139,92,246,0.25)"
                strokeWidth="1"
                strokeDasharray="3 6"
            >
                <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to="-18"
                    dur="2.8s"
                    repeatCount="indefinite"
                />
            </path>
        </svg>
    );
}

function TrendsIllustration() {
    return (
        <svg
            viewBox="0 0 560 260"
            className="h-full w-full"
            aria-hidden="true"
        >
            <defs>
                <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(129,140,248,0.22)" />
                    <stop offset="100%" stopColor="rgba(129,140,248,0)" />
                </linearGradient>
                <linearGradient id="trendLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="60%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
            </defs>

            {/* Gridlines */}
            {[50, 100, 150, 200].map((y) => (
                <line
                    key={y}
                    x1="30"
                    y1={y}
                    x2="530"
                    y2={y}
                    stroke="rgba(148,163,184,0.09)"
                    strokeWidth="1"
                    strokeDasharray="2 6"
                />
            ))}

            {/* Ghosted area */}
            <path
                d="M30 200 C 90 190 130 120 190 140 S 300 70 360 96 S 470 40 530 60 L 530 230 L 30 230 Z"
                fill="url(#trendArea)"
            />

            {/* Dashed baseline */}
            <path
                d="M30 216 C 90 206 130 200 190 204 S 300 196 360 200 S 470 190 530 194"
                fill="none"
                stroke="rgba(148,163,184,0.18)"
                strokeWidth="1.5"
                strokeDasharray="3 8"
            />

            {/* Animated trendline */}
            <path
                className="analytics-dash-move"
                d="M30 200 C 90 190 130 120 190 140 S 300 70 360 96 S 470 40 530 60"
                fill="none"
                stroke="url(#trendLine)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="8 8"
            />

            {/* Endpoint markers */}
            <circle cx="30" cy="200" r="3" fill="#818cf8" />
            <circle cx="190" cy="140" r="3" fill="#22d3ee" />
            <circle cx="360" cy="96" r="3" fill="#34d399" />
            <circle cx="530" cy="60" r="4" fill="#34d399">
                <animate
                    attributeName="r"
                    values="3;6;3"
                    dur="2s"
                    repeatCount="indefinite"
                />
            </circle>
        </svg>
    );
}

const VARIANTS = {
    map: {
        illustration: RadarIllustration,
        iconText: "text-cyan-300",
        ring: "ring-cyan-400/20",
        chip: "border-cyan-400/25 bg-cyan-500/10 text-cyan-300",
        hoverGlow:
            "hover:shadow-[0_28px_70px_-22px_rgba(0,0,0,0.8),0_0_50px_-12px_rgba(34,211,238,0.3)]",
    },
    trends: {
        illustration: TrendsIllustration,
        iconText: "text-indigo-300",
        ring: "ring-indigo-400/20",
        chip: "border-indigo-400/25 bg-indigo-500/10 text-indigo-300",
        hoverGlow:
            "hover:shadow-[0_28px_70px_-22px_rgba(0,0,0,0.8),0_0_50px_-12px_rgba(129,140,248,0.3)]",
    },
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

function ComingSoonPanel({
    variant = "map",
    title,
    subtitle,
    footnote = "Module under development",
    delay = 0,
    className = "",
}) {
    const theme = VARIANTS[variant] ?? VARIANTS.map;
    const Illustration = theme.illustration;

    return (
        <article
            className={`analytics-enter group relative flex flex-col overflow-hidden rounded-2xl border border-dashed border-white/15 bg-slate-900/30 p-6 backdrop-blur-xl backdrop-saturate-150 transition-all duration-500 hover:-translate-y-1 hover:border-white/25 hover:bg-slate-900/45 ${theme.hoverGlow} ${className}`}
            style={{ animationDelay: `${delay}ms` }}
        >
            {/* Subtle vertical scanline over the illustration */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div
                    className="analytics-scanline absolute inset-x-0 top-0 h-1/5 bg-gradient-to-b from-transparent via-cyan-400/[0.06] to-transparent"
                    style={{ animationDelay: "1.2s" }}
                />
            </div>

            {/* Header */}
            <div className="relative z-10 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-800/60 ring-1 transition-transform duration-300 group-hover:scale-110 ${theme.ring}`}
                    >
                        <Lock size={15} className={theme.iconText} />
                    </span>

                    <div>
                        <h3 className="text-[15px] font-bold tracking-tight text-white">
                            {title}
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                            {subtitle}
                        </p>
                    </div>
                </div>

                <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold tracking-[0.2em] ${theme.chip}`}
                >
                    <span className="h-1 w-1 rounded-full bg-current" />
                    COMING SOON
                </span>
            </div>

            {/* Illustration */}
            <div className="relative z-10 mt-4 min-h-[13rem] flex-1">
                <Illustration />
            </div>

            {/* Footnote */}
            <div className="relative z-10 mt-4 flex items-center justify-between gap-3 border-t border-white/5 pt-4">
                <p className="text-[11px] font-medium tracking-wide text-slate-500">
                    {footnote}
                </p>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                    Q3 2026
                </span>
            </div>
        </article>
    );
}

export default ComingSoonPanel;
