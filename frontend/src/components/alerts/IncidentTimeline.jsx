import { CircleDot, RadioTower, ShieldCheck, Workflow } from "lucide-react";
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
        <div className="relative">
            <div className="relative flex flex-col space-y-3">
                {steps.map((step, index) => {
                    const eventKey = (step.event ?? "")
                        .toLowerCase()
                        .replace(/\s+/g, "_");

                    const Icon = STEP_ICONS[eventKey] ?? CircleDot;
                    const isLast = index === lastIndex;
                    const isFinal = eventKey === "incident_resolved" || incident.resolved;

                    return (
                        <div
                            key={`${incident.id}-${eventKey}-${index}`}
                            className="relative flex gap-3 pb-1 last:pb-0"
                        >
                            {!isLast && (
                                <span
                                    className="absolute left-[13px] top-[26px] bottom-[-12px] w-px bg-[var(--color-border-default)]"
                                />
                            )}

                            <div className="relative z-10 mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-3)] border border-[var(--color-border-default)]">
                                <Icon
                                    size={13}
                                    className={
                                        isFinal
                                            ? "text-[var(--color-success)]"
                                            : "text-[var(--color-accent)]"
                                    }
                                />
                            </div>

                            <div className="min-w-0 flex-1 rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] px-3.5 py-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                                        {step.event}
                                    </p>

                                    <span className="font-mono text-[11px] text-[var(--color-text-muted)] tabular-nums">
                                        {formatClock(new Date(step.created_at).getTime())}
                                    </span>
                                </div>

                                <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
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