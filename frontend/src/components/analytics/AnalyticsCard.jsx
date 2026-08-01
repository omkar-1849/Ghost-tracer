/**
 * AnalyticsCard
 * -------------
 * The premium glass frame used by every intelligence widget on the
 * Analytics page. Provides:
 *  - frosted glass panel with thin borders + layered shadows
 *  - accent theming (icon badge, top hairline, hover glow, live dot)
 *  - a light sheen sweep on hover
 *  - header block (icon + title + subtitle) with a toolbar slot
 *  - optional LIVE indicator
 *
 * Widget bodies render inside `children` — their own chrome is kept
 * intentionally minimal so the frame stays consistent page-wide.
 */

const ACCENTS = {
    cyan: {
        iconBg: "bg-gradient-to-br from-cyan-500/25 to-blue-600/10",
        iconText: "text-cyan-300",
        ring: "ring-cyan-400/20 shadow-[0_0_18px_rgba(34,211,238,0.18)]",
        hairline: "from-cyan-400/80 via-blue-500/60 to-transparent",
        glow: "hover:shadow-[0_28px_60px_-20px_rgba(0,0,0,0.75),0_0_44px_-10px_rgba(34,211,238,0.35)]",
        dot: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]",
        hoverBorder: "hover:border-cyan-400/25",
    },
    blue: {
        iconBg: "bg-gradient-to-br from-blue-500/25 to-indigo-600/10",
        iconText: "text-blue-300",
        ring: "ring-blue-400/20 shadow-[0_0_18px_rgba(59,130,246,0.18)]",
        hairline: "from-blue-400/80 via-indigo-500/60 to-transparent",
        glow: "hover:shadow-[0_28px_60px_-20px_rgba(0,0,0,0.75),0_0_44px_-10px_rgba(59,130,246,0.35)]",
        dot: "bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.9)]",
        hoverBorder: "hover:border-blue-400/25",
    },
    purple: {
        iconBg: "bg-gradient-to-br from-violet-500/25 to-purple-600/10",
        iconText: "text-violet-300",
        ring: "ring-violet-400/20 shadow-[0_0_18px_rgba(167,139,250,0.18)]",
        hairline: "from-violet-400/80 via-purple-500/60 to-transparent",
        glow: "hover:shadow-[0_28px_60px_-20px_rgba(0,0,0,0.75),0_0_44px_-10px_rgba(139,92,246,0.35)]",
        dot: "bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.9)]",
        hoverBorder: "hover:border-violet-400/25",
    },
    red: {
        iconBg: "bg-gradient-to-br from-red-500/25 to-rose-600/10",
        iconText: "text-red-300",
        ring: "ring-red-400/20 shadow-[0_0_18px_rgba(248,113,113,0.18)]",
        hairline: "from-red-400/80 via-rose-500/60 to-transparent",
        glow: "hover:shadow-[0_28px_60px_-20px_rgba(0,0,0,0.75),0_0_44px_-10px_rgba(239,68,68,0.35)]",
        dot: "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.9)]",
        hoverBorder: "hover:border-red-400/25",
    },
    amber: {
        iconBg: "bg-gradient-to-br from-amber-500/25 to-orange-600/10",
        iconText: "text-amber-300",
        ring: "ring-amber-400/20 shadow-[0_0_18px_rgba(251,191,36,0.18)]",
        hairline: "from-amber-400/80 via-orange-500/60 to-transparent",
        glow: "hover:shadow-[0_28px_60px_-20px_rgba(0,0,0,0.75),0_0_44px_-10px_rgba(251,191,36,0.32)]",
        dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]",
        hoverBorder: "hover:border-amber-400/25",
    },
    emerald: {
        iconBg: "bg-gradient-to-br from-emerald-500/25 to-teal-600/10",
        iconText: "text-emerald-300",
        ring: "ring-emerald-400/20 shadow-[0_0_18px_rgba(52,211,153,0.18)]",
        hairline: "from-emerald-400/80 via-teal-500/60 to-transparent",
        glow: "hover:shadow-[0_28px_60px_-20px_rgba(0,0,0,0.75),0_0_44px_-10px_rgba(52,211,153,0.32)]",
        dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]",
        hoverBorder: "hover:border-emerald-400/25",
    },
};

function AnalyticsCard({
    icon: Icon,
    title,
    subtitle,
    accent = "cyan",
    toolbar = null,
    live = true,
    delay = 0,
    className = "",
    children,
}) {
    const theme = ACCENTS[accent] ?? ACCENTS.cyan;

    return (
        <article
            className={`analytics-enter group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/45 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)] transition-all duration-500 hover:-translate-y-1 hover:bg-slate-900/60 ${theme.glow} ${theme.hoverBorder} ${className}`}
            style={{ animationDelay: `${delay}ms` }}
        >
            {/* Frosted sheen */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] via-white/[0.015] to-transparent" />

            {/* Hover light sweep */}
            <div className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent opacity-0 transition-all duration-700 ease-out group-hover:translate-x-[450%] group-hover:opacity-100" />

            {/* Accent hairline on the top edge */}
            <div
                className={`pointer-events-none absolute left-6 right-6 top-0 h-px bg-gradient-to-r ${theme.hairline}`}
            />

            {/* Ambient corner glow */}
            <div
                className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100 ${theme.iconBg}`}
            />

            {/* Header */}
            <div className="relative z-10 flex items-start justify-between gap-4 p-6 pb-0">
                <div className="flex items-start gap-3.5">
                    <span
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 transition-transform duration-300 group-hover:scale-110 ${theme.iconBg} ${theme.ring}`}
                    >
                        <Icon size={18} className={theme.iconText} />
                    </span>

                    <div>
                        <h3 className="text-[15px] font-bold tracking-tight text-white">
                            {title}
                        </h3>
                        {subtitle && (
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {toolbar}

                    {live && (
                        <span
                            title="Streaming live data"
                            className={`h-1.5 w-1.5 rounded-full ${theme.dot}`}
                        />
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="relative z-10 flex flex-1 flex-col p-6">{children}</div>
        </article>
    );
}

export default AnalyticsCard;
