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

/**
 * AttackDetails
 * -------------
 * Elegant fact grid for the selected incident: source, target, attack
 * family, MITRE reference, protocol, ports, rule and confidence.
 */
function AttackDetails({ incident }) {
    const theme = incident.severityTheme;

    const fields = [
        { icon: Globe, label: "Source", value: incident.source, mono: true },
        { icon: Target, label: "Target", value: incident.target, mono: true },
        { icon: Waypoints, label: "Attack Type", value: incident.attackType },
        { icon: Fingerprint, label: "MITRE ATT&CK", value: incident.mitre, mono: true },
        { icon: Binary, label: "Protocol", value: incident.protocol, mono: true },
        { icon: Boxes, label: "Vector", value: incident.vector },
        { icon: Radar, label: "Ports", value: `${incident.sourcePort} → ${incident.targetPort}`, mono: true },
        { icon: Shield, label: "Rule", value: incident.ruleId, mono: true },
    ];

    return (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {fields.map((field, index) => {
                const Icon = field.icon;
                return (
                    <div
                        key={field.label}
                        className="alerts-tl-node group relative overflow-hidden rounded-xl border border-white/[0.07] bg-slate-950/30 px-4 py-3 transition-colors duration-300 hover:border-white/[0.14] hover:bg-slate-800/30"
                        style={{ animationDelay: `${index * 40}ms` }}
                    >
                        {/* Soft corner glow on hover */}
                        <span
                            className={`pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100 ${theme.iconWrap}`}
                        />

                        <div className="relative flex items-start gap-3">
                            <span
                                className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-900/60 transition-transform duration-300 group-hover:scale-110 ${theme.text}`}
                            >
                                <Icon size={13} />
                            </span>

                            <div className="min-w-0">
                                <p className="text-[9px] font-bold tracking-[0.2em] text-slate-500">
                                    {field.label.toUpperCase()}
                                </p>
                                <p
                                    className={`mt-0.5 truncate text-[13px] font-semibold text-slate-100 ${
                                        field.mono ? "font-mono text-[12px]" : ""
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
