import { useEffect, useState } from "react";
import {
    Gauge,
    ShieldCheck,
    ShieldAlert,
    ShieldX,
} from "lucide-react";
import { getSecurityScore } from "../services/api";

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

const SIZE = 160;
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
/* Component                                                           */
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
        <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-5 min-h-[400px] flex flex-col shadow-[var(--shadow-1)]">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
                        Security Score
                    </h2>
                    <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
                        Overall posture
                    </p>
                </div>
            </div>

            {/* Radial gauge */}
            <div className="relative mx-auto mt-6" style={{ width: SIZE, height: SIZE }}>
                <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
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
                        className="text-4xl font-bold tracking-tight tabular-nums"
                        style={{ color: status.color }}
                    >
                        {clamped}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-disabled)] mt-0.5">
                        / 100
                    </span>
                </div>
            </div>

            {/* Status badge */}
            <div className="mt-4 flex items-center justify-center">
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

            <p className="text-[var(--color-text-muted)] text-xs text-center mt-2">
                {status.caption}
            </p>

            {/* Supporting metrics */}
            <div className="grid grid-cols-3 gap-2 mt-auto pt-5">
                {metrics.map((metric) => (
                    <div
                        key={metric.label}
                        className="bg-[var(--color-surface-1)] border border-[var(--color-border-subtle)] rounded-md px-2 py-2.5 text-center"
                    >
                        <p
                            className="text-base font-bold leading-none tabular-nums"
                            style={{ color: metric.color }}
                        >
                            {metric.value}
                        </p>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-disabled)] mt-1">
                            {metric.label}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default SecurityScore;
