import {
    Binary,
    Boxes,
    Fingerprint,
    Globe,
    Radar,
    Shield,
    Target,
    Waypoints,
} from "lucide-react";

function AttackDetails({ incident }) {
    const fields = [
        { icon: Globe, label: "Source", value: incident.source, mono: true },
        { icon: Target, label: "Target", value: incident.target, mono: true },
        { icon: Waypoints, label: "Attack Type", value: incident.attackType },
        { icon: Fingerprint, label: "MITRE ATT&CK", value: incident.mitre, mono: true },
        { icon: Binary, label: "Protocol", value: incident.protocol, mono: true },
        { icon: Boxes, label: "Vector", value: incident.vector },
        { icon: Radar, label: "Ports", value: `${incident.sourcePort} → ${incident.targetPort}`, mono: true },
        { icon: Shield, label: "Rule ID", value: incident.ruleId, mono: true },
    ];

    return (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {fields.map((field) => {
                const Icon = field.icon;
                return (
                    <div
                        key={field.label}
                        className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] px-3 py-2.5 transition-colors"
                    >
                        <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-[var(--color-surface-3)] text-[var(--color-text-muted)]">
                                <Icon size={14} />
                            </span>

                            <div className="min-w-0">
                                <p className="text-[10px] font-semibold tracking-wider text-[var(--color-text-muted)] uppercase">
                                    {field.label}
                                </p>
                                <p
                                    className={`mt-0.5 truncate text-xs font-semibold text-[var(--color-text-primary)] ${
                                        field.mono ? "font-mono" : ""
                                    }`}
                                >
                                    {field.value}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default AttackDetails;
