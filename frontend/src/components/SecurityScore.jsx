import { useEffect, useState } from "react";
import { Gauge, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { getSecurityScore } from "../services/api";

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

const SIZE = 170;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const STATUS = [
    {
        min: 90,
        label: "Excellent",
        color: "var(--color-success)",
        caption: "Threat surface is minimal and posture is strong.",
    },
    {
        min: 75,
        label: "Good",
        color: "var(--color-accent)",
        caption: "Solid posture with minor exposure worth monitoring.",
    },
    {
        min: 50,
        label: "Fair",
        color: "var(--color-warning)",
        caption: "Notable risk detected — review active threats soon.",
    },
    {
        min: 0,
        label: "Critical",
        color: "var(--color-critical)",
        caption: "Elevated risk — investigate critical alerts immediately.",
    },
];

const STATUS_ICONS = {
    Excellent: ShieldCheck,
    Good: ShieldCheck,
    Fair: Gauge,
    Critical: ShieldX,
};

function resolveStatus(score) {
    return STATUS.find((s) => score >= s.min) ?? STATUS[STATUS.length - 1];
}

/* ------------------------------------------------------------------ */
/* Component — embedded posture gauge. Renders on the parent posture  */
/* surface (no outer card): the score anchors the section.            */
/* ------------------------------------------------------------------ */

function SecurityScore({ stats = {} }) {
    const [score, setScore] = useState(0);

    useEffect(() => {
        async function loadScore() {
            try {
                const data = await getSecurityScore();
                setScore(Number(data?.score) || 0);
            } catch (err) {
                console.error(err);
            }
        }

        loadScore();

        const interval = setInterval(loadScore, 5000);

        return () => clearInterval(interval);
    }, []);

    const clamped = Math.max(0, Math.min(100, Math.round(score)));
    const status = resolveStatus(clamped);
    const StatusIcon = STATUS_ICONS[status.label] ?? ShieldAlert;

    /* Small supporting metrics derived from the same dashboard stats. */
    const metrics = [
        {
            label: "Critical",
            value: stats.critical_alerts ?? "—",
            color: "var(--color-critical)",
        },
        {
            label: "High",
            value: stats.high_alerts ?? "—",
            color: "var(--color-high)",
        },
        {
            label: "Alerts",
            value: stats.total_alerts ?? "—",
            color: "var(--color-warning)",
        },
    ];

    const dashOffset =
        CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;

    return (
        <div className="flex flex-col items-center justify-center min-w-0">
            {/* Radial gauge */}
            <div className="relative" style={{ width: SIZE, height: SIZE }}>
                <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
                    {/* Instrument tick marks */}
                    {Array.from({ length: 20 }).map((_, i) => {
                        const angle = (i / 20) * 2 * Math.PI;
                        const inner = RADIUS - STROKE / 2 - 5;
                        const outer = RADIUS - STROKE / 2 - 1;
                        return (
                            <line
                                key={i}
                                x1={SIZE / 2 + inner * Math.cos(angle)}
                                y1={SIZE / 2 + inner * Math.sin(angle)}
                                x2={SIZE / 2 + outer * Math.cos(angle)}
                                y2={SIZE / 2 + outer * Math.sin(angle)}
                                stroke="var(--color-border-strong)"
                                strokeWidth={i % 5 === 0 ? 2 : 1}
                                opacity={i % 5 === 0 ? 0.9 : 0.45}
                            />
                        );
                    })}

                    {/* Track */}
                    <circle
                        cx={SIZE / 2}
                        cy={SIZE / 2}
                        r={RADIUS}
                        fill="none"
                        stroke="var(--color-border-default)"
                        strokeWidth={STROKE}
                    />

                    {/* Progress */}
                    <circle
                        cx={SIZE / 2}
                        cy={SIZE / 2}
                        r={RADIUS}
                        fill="none"
                        stroke={status.color}
                        strokeWidth={STROKE}
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        strokeDashoffset={dashOffset}
                        style={{
                            transition:
                                "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                    />
                </svg>

                {/* Center readout */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span
                        className="mono-value text-[40px] font-semibold tracking-tight leading-none"
                        style={{ color: status.color }}
                    >
                        {clamped}
                    </span>
                    <span className="section-label mt-2">/ 100 Index</span>
                </div>
            </div>

            {/* Status badge */}
            <div className="mt-5 flex items-center justify-center">
                <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold border"
                    style={{
                        color: status.color,
                        borderColor: `color-mix(in srgb, ${status.color} 25%, transparent)`,
                        backgroundColor: `color-mix(in srgb, ${status.color} 10%, transparent)`,
                    }}
                >
                    <StatusIcon size={13} />
                    {status.label.toUpperCase()} POSTURE
                </span>
            </div>

            <p className="text-[var(--color-text-muted)] text-xs text-center mt-2.5 max-w-[240px] leading-relaxed">
                {status.caption}
            </p>

            {/* Supporting metrics — divider-separated, not boxed */}
            <div className="grid grid-cols-3 mt-6 w-full max-w-[280px]">
                {metrics.map((metric, i) => (
                    <div
                        key={metric.label}
                        className={`text-center ${i > 0 ? "border-l border-[var(--color-border-subtle)]" : ""}`}
                    >
                        <p
                            className="mono-value text-[16px] font-semibold leading-none"
                            style={{ color: metric.color }}
                        >
                            {metric.value}
                        </p>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-disabled)] mt-1.5">
                            {metric.label}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default SecurityScore;
