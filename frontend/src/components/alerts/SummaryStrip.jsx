import { CheckCircle2, Flame, ShieldAlert, TriangleAlert } from "lucide-react";

/* Severity readout — one shared surface, divider-separated values.
   Colour carries severity meaning; no per-metric boxes. */
function SummaryStrip({ counts }) {
    const items = [
        {
            key: "critical",
            label: "Critical",
            value: counts.critical,
            icon: ShieldAlert,
            tone: "var(--color-critical)",
        },
        {
            key: "high",
            label: "High",
            value: counts.high,
            icon: Flame,
            tone: "var(--color-high)",
        },
        {
            key: "medium",
            label: "Medium",
            value: counts.medium,
            icon: TriangleAlert,
            tone: "var(--color-medium)",
        },
        {
            key: "resolved",
            label: "Resolved",
            value: counts.resolved,
            icon: CheckCircle2,
            tone: "var(--color-success)",
        },
    ];

    return (
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-2)] shadow-[var(--shadow-1)] px-5 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 sm:divide-x sm:divide-[var(--color-border-subtle)]">
                {items.map((item, i) => {
                    const Icon = item.icon;
                    return (
                        <div
                            key={item.key}
                            title={`${item.value} ${item.label.toLowerCase()} incidents`}
                            className={`min-w-0 ${i > 0 ? "sm:px-5" : "sm:pr-5"}`}
                        >
                            <p className="flex items-center gap-1.5 section-label">
                                <Icon size={11} style={{ color: item.tone }} />
                                <span className="truncate">{item.label}</span>
                            </p>
                            <p
                                className="metric-value text-2xl mt-1.5 leading-none"
                                style={{ color: item.tone }}
                            >
                                {item.value}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default SummaryStrip;
