import { CheckCircle2, Flame, ShieldAlert, TriangleAlert } from "lucide-react";

function SummaryStrip({ counts }) {
    const items = [
        {
            key: "critical",
            label: "Critical",
            value: counts.critical,
            icon: ShieldAlert,
            textColor: "text-[var(--color-critical)]",
            bgColor: "bg-[rgba(229,72,77,0.08)]",
            borderColor: "border-[rgba(229,72,77,0.25)]",
            dotColor: "bg-[var(--color-critical)]",
        },
        {
            key: "high",
            label: "High",
            value: counts.high,
            icon: Flame,
            textColor: "text-[var(--color-high)]",
            bgColor: "bg-[rgba(237,125,28,0.08)]",
            borderColor: "border-[rgba(237,125,28,0.25)]",
            dotColor: "bg-[var(--color-high)]",
        },
        {
            key: "medium",
            label: "Medium",
            value: counts.medium,
            icon: TriangleAlert,
            textColor: "text-[var(--color-medium)]",
            bgColor: "bg-[rgba(221,179,42,0.08)]",
            borderColor: "border-[rgba(221,179,42,0.25)]",
            dotColor: "bg-[var(--color-medium)]",
        },
        {
            key: "resolved",
            label: "Resolved",
            value: counts.resolved,
            icon: CheckCircle2,
            textColor: "text-[var(--color-success)]",
            bgColor: "bg-[rgba(63,163,77,0.08)]",
            borderColor: "border-[rgba(63,163,77,0.25)]",
            dotColor: "bg-[var(--color-success)]",
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {items.map((item) => {
                const Icon = item.icon;
                return (
                    <div
                        key={item.key}
                        title={`${item.value} ${item.label.toLowerCase()} incidents`}
                        className={`rounded-lg border px-4 py-3 bg-[var(--color-surface-2)] ${item.borderColor} shadow-[var(--shadow-1)] transition-colors`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span
                                    className={`w-8 h-8 rounded-md flex items-center justify-center ${item.bgColor}`}
                                >
                                    <Icon size={16} className={item.textColor} />
                                </span>
                                <div>
                                    <span className="block text-xl font-bold tabular-nums text-[var(--color-text-primary)] leading-none">
                                        {item.value}
                                    </span>
                                    <span className="block text-[11px] font-medium text-[var(--color-text-muted)] mt-1 uppercase tracking-wider">
                                        {item.label}
                                    </span>
                                </div>
                            </div>
                            <span className={`w-2 h-2 rounded-full ${item.dotColor}`} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default SummaryStrip;
