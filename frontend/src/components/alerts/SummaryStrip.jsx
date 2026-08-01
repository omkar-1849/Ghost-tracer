import { CheckCircle2, Flame, ShieldAlert, TriangleAlert } from "lucide-react";

/**
 * SummaryStrip
 * ------------
 * Lightweight queue summary widgets — intentionally small, elegant and
 * quiet. Each tile shows a count, a breathing accent dot and a subtle
 * glowing underline bar. They are NOT oversized KPI cards.
 */
function SummaryStrip({ counts }) {
    const items = [
        {
            key: "critical",
            label: "Critical",
            value: counts.critical,
            icon: ShieldAlert,
            iconClass: "text-red-400",
            wrapClass:
                "alerts-summary--critical bg-gradient-to-br from-red-500/15 to-transparent",
            dotClass: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]",
            barClass: "bg-red-500",
        },
        {
            key: "high",
            label: "High",
            value: counts.high,
            icon: Flame,
            iconClass: "text-orange-400",
            wrapClass:
                "alerts-summary--high bg-gradient-to-br from-orange-500/15 to-transparent",
            dotClass: "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.9)]",
            barClass: "bg-orange-500",
        },
        {
            key: "medium",
            label: "Medium",
            value: counts.medium,
            icon: TriangleAlert,
            iconClass: "text-yellow-400",
            wrapClass:
                "alerts-summary--medium bg-gradient-to-br from-yellow-500/15 to-transparent",
            dotClass: "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.9)]",
            barClass: "bg-yellow-400",
        },
        {
            key: "resolved",
            label: "Resolved",
            value: counts.resolved,
            icon: CheckCircle2,
            iconClass: "text-emerald-400",
            wrapClass:
                "alerts-summary--resolved bg-gradient-to-br from-emerald-500/15 to-transparent",
            dotClass: "bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.9)]",
            barClass: "bg-emerald-500",
        },
    ];

    return (
        <div
            className="alerts-enter grid grid-cols-2 gap-3 sm:grid-cols-4"
            style={{ animationDelay: "140ms" }}
        >
            {items.map((item, index) => {
                const Icon = item.icon;
                return (
                    <div
                        key={item.key}
                        title={`${item.value} ${item.label.toLowerCase()} incidents`}
                        className={`alerts-summary alerts-sheen group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3.5 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.6)] ${item.wrapClass}`}
                        style={{ animationDelay: `${140 + index * 50}ms` }}
                    >
                        {/* Accent underline bar */}
                        <span
                            className={`alerts-summary-bar absolute inset-x-4 bottom-0 h-px ${item.barClass}`}
                        />

                        <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2.5">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-950/40">
                                    <Icon size={15} className={item.iconClass} />
                                </span>

                                <span className="leading-tight">
                                    <span className="block text-lg font-bold tabular-nums text-white">
                                        {item.value}
                                    </span>
                                    <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                        {item.label}
                                    </span>
                                </span>
                            </span>

                            <span
                                className={`alerts-breathe h-1.5 w-1.5 rounded-full ${item.dotClass}`}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default SummaryStrip;
