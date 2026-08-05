import { Check, CircleDot, RadioTower, ShieldCheck, Workflow } from "lucide-react";
import { formatClock } from "./alertsData";

const STEP_ICONS = {
    incident_created: RadioTower,
    incident_assigned: Workflow,
    note_added: CircleDot,
    incident_resolved: ShieldCheck,
};

function IncidentTimeline({ incident }) {
    const steps = incident.timeline ?? [];
    const lastIndex = steps.length - 1;

    return (
        <div className="alerts-timeline relative" key={`timeline-${incident.id}`}>
            <span className="alerts-timeline-rail" />
            <span className="alerts-timeline-pulse" />

            <div className="relative flex flex-col">
                {steps.map((step, index) => {
                    const eventKey = (step.event ?? "")
                        .toLowerCase()
                        .replace(/\s+/g, "_");

                    const Icon = STEP_ICONS[eventKey] ?? CircleDot;

                    const isLast = index === lastIndex;

                    const isFinal =
                        eventKey === "incident_resolved";

                    const accent =
                        isFinal || incident.resolved
                            ? "from-emerald-400 to-teal-500"
                            : "from-cyan-400 to-indigo-500";

                    return (
                        <div
                            key={`${incident.id}-${eventKey}-${index}`}
                            className="relative flex gap-3.5 pb-1.5 last:pb-0"
                        >
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

                            <div
                                className="alerts-tl-node relative z-10 mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center"
                                style={{
                                    animationDelay: `${240 + index * 180}ms`,
                                }}
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

                                {!isFinal && (
                                    <span
                                        className={`absolute inset-0 rounded-full opacity-30 blur-[6px] bg-gradient-to-br ${accent}`}
                                    />
                                )}

                                {isFinal && (
                                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/90 shadow-[0_0_10px_rgba(52,211,153,0.8)]">
                                        <Check
                                            size={9}
                                            className="text-emerald-950"
                                            strokeWidth={3.5}
                                        />
                                    </span>
                                )}
                            </div>

                            <div
                                className="alerts-tl-node alerts-tl-body min-w-0 flex-1 rounded-xl border border-white/[0.06] bg-slate-950/25 px-3.5 py-2 transition-colors duration-300 hover:border-white/[0.13] hover:bg-slate-800/30"
                                style={{
                                    animationDelay: `${320 + index * 180}ms`,
                                }}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-[15px] font-semibold tracking-tight text-slate-100">
                                        {step.event}
                                    </p>

                                    <span className="font-mono text-[11px] tabular-nums text-slate-500">
                                        {formatClock(
                                            new Date(step.created_at).getTime()
                                        )}
                                    </span>
                                </div>

                                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
                                    {step.description}
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