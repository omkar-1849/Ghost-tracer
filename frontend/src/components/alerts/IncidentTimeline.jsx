import { Check, CircleDot, RadioTower, ScanLine, ShieldCheck, Workflow } from "lucide-react";
import { formatClock, timelineSteps } from "./alertsData";

/**
 * IncidentTimeline
 * ----------------
 * Premium vertical investigation timeline:
 *
 *   Detection → Rule Triggered → Alert Created → Analyst Review → Resolved
 *
 * - the rail itself is a flowing light gradient
 * - a light pulse travels down the rail continuously
 * - connector segments draw in top-to-bottom (staggered)
 * - nodes enter staggered with magnetic hover orbs
 * - re-mounting on incident change replays the draw animation
 */
const STEP_ICONS = {
    detection: RadioTower,
    rule: Workflow,
    alert: ScanLine,
    review: CircleDot,
    resolved: ShieldCheck,
};

function IncidentTimeline({ incident }) {
    const steps = timelineSteps(incident.timestamp);
    const lastIndex = steps.length - 1;

    return (
        <div className="alerts-timeline relative" key={`timeline-${incident.id}`}>
            {/* Flowing light rail */}
            <span className="alerts-timeline-rail" />

            {/* Traveling light pulse */}
            <span className="alerts-timeline-pulse" />

            <div className="relative flex flex-col">
                {steps.map((step, index) => {
                    const Icon = STEP_ICONS[step.key] ?? CircleDot;
                    const isLast = index === lastIndex;
                    const isFinal = step.key === "resolved";
                    const accent =
                        isFinal || incident.resolved
                            ? "from-emerald-400 to-teal-500"
                            : "from-cyan-400 to-indigo-500";

                    return (
                        <div key={`${incident.id}-${step.key}`} className="relative flex gap-4 pb-2 last:pb-0">
                            {/* Connector segment (draws in, staggered) */}
                            {!isLast && (
                                <span
                                    className={`alerts-tl-segment bg-gradient-to-b ${accent}`}
                                    style={{
                                        top: "30px",
                                        bottom: "4px",
                                        animationDelay: `${400 + index * 180}ms`,
                                    }}
                                />
                            )}

                            {/* Node orb */}
                            <div
                                className="alerts-tl-node relative z-10 mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center"
                                style={{ animationDelay: `${240 + index * 180}ms` }}
                            >
                                <span
                                    className={`alerts-tl-orb flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-slate-900/80 ${
                                        isFinal || incident.resolved
                                            ? "text-emerald-300"
                                            : "text-cyan-300"
                                    }`}
                                >
                                    <Icon size={13} />
                                </span>
                                {/* Pulsing halo behind active node */}
                                {!isFinal && (
                                    <span
                                        className={`absolute inset-0 rounded-full opacity-30 blur-[6px] bg-gradient-to-br ${accent}`}
                                    />
                                )}
                                {/* Completion check */}
                                {isFinal && (
                                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/90 shadow-[0_0_10px_rgba(52,211,153,0.8)]">
                                        <Check size={9} className="text-emerald-950" strokeWidth={3.5} />
                                    </span>
                                )}
                            </div>

                            {/* Content */}
                            <div
                                className="alerts-tl-node alerts-tl-body min-w-0 flex-1 rounded-xl border border-white/[0.06] bg-slate-950/25 px-4 py-2.5 transition-colors duration-300 hover:border-white/[0.13] hover:bg-slate-800/30"
                                style={{ animationDelay: `${320 + index * 180}ms` }}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-[13px] font-semibold tracking-tight text-slate-100">
                                        {step.label}
                                    </p>
                                    <span className="font-mono text-[10px] tabular-nums text-slate-500">
                                        {formatClock(step.time)}
                                    </span>
                                </div>
                                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                                    {step.caption}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default IncidentTimeline;
