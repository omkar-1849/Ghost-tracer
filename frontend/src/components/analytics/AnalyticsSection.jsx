import { Waypoints } from "lucide-react";

/**
 * AnalyticsSection
 * ----------------
 * Vertical rhythm + title block for each zone of the Analytics page.
 * `actions` renders on the right (toolbar slot) and wraps gracefully on
 * small screens.
 */
function AnalyticsSection({
    eyebrow = "INTELLIGENCE",
    title,
    subtitle,
    actions = null,
    children,
    className = "",
}) {
    return (
        <section className={`mt-12 sm:mt-14 ${className}`}>
            <div className="analytics-enter flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-start gap-3.5">
                    <span className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/15 to-indigo-600/10 shadow-[0_0_18px_rgba(34,211,238,0.18)]">
                        <Waypoints size={16} className="text-cyan-300" />
                    </span>

                    <div>
                        <p className="text-[10px] font-bold tracking-[0.28em] text-slate-500">
                            {eyebrow}
                        </p>
                        <h2 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">
                            {title}
                        </h2>
                        {subtitle && (
                            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-slate-400">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>

                {actions && (
                    <div className="flex flex-wrap items-center gap-2">
                        {actions}
                    </div>
                )}
            </div>

            <div className="mt-6">{children}</div>
        </section>
    );
}

export default AnalyticsSection;
