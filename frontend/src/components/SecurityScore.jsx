import { useEffect, useState } from "react";
import {
    Activity,
    Gauge,
    ShieldCheck,
    ShieldAlert,
    ShieldX,
} from "lucide-react";
import { getSecurityScore } from "../services/api";

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

const SIZE = 176;
const STROKE = 13;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const STATUS = [
    {
        min: 90,
        label: "Excellent",
        badge: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
        text: "text-emerald-300",
        dot: "bg-emerald-400",
        stroke: "url(#scoreGradientExcellent)",
        glow: "rgba(52, 211, 153, 0.45)",
        caption: "Threat surface is minimal and posture is strong.",
    },
    {
        min: 75,
        label: "Good",
        badge: "bg-cyan-500/10 border-cyan-500/25 text-cyan-400",
        text: "text-cyan-300",
        dot: "bg-cyan-400",
        stroke: "url(#scoreGradientGood)",
        glow: "rgba(34, 211, 238, 0.45)",
        caption: "Solid posture with minor exposure worth monitoring.",
    },
    {
        min: 50,
        label: "Fair",
        badge: "bg-amber-500/10 border-amber-500/25 text-amber-400",
        text: "text-amber-300",
        dot: "bg-amber-400",
        stroke: "url(#scoreGradientFair)",
        glow: "rgba(251, 191, 36, 0.4)",
        caption: "Notable risk detected — review active threats soon.",
    },
    {
        min: 0,
        label: "Critical",
        badge: "bg-red-500/10 border-red-500/25 text-red-400",
        text: "text-red-400",
        dot: "bg-red-500",
        stroke: "url(#scoreGradientCritical)",
        glow: "rgba(239, 68, 68, 0.5)",
        caption: "Elevated risk — investigate critical alerts immediately.",
    },
];

const STATUS_ICONS = {
    Excellent: ShieldCheck,
    Good: ShieldCheck,
    Fair: Gauge,
    Critical: ShieldX,
};

const STATUS_ORDER = ["Excellent", "Good", "Fair", "Critical"];

function resolveStatus(score) {
    return STATUS.find((s) => score >= s.min) ?? STATUS[STATUS.length - 1];
}

function gradientIdFor(label) {
    if (label === "Excellent") return "scoreGradientExcellent";
    if (label === "Good") return "scoreGradientGood";
    if (label === "Fair") return "scoreGradientFair";
    return "scoreGradientCritical";
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
            valueClass: "text-red-400",
        },
        {
            label: "High",
            value: stats.high_alerts ?? "—",
            valueClass: "text-orange-400",
        },
        {
            label: "Alerts",
            value: stats.total_alerts ?? "—",
            valueClass: "text-amber-300",
        },
    ];

    const dashOffset =
        CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[420px] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">
                        Security Score
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Overall posture
                    </p>
                </div>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-bold tracking-widest text-emerald-400">
                    <span className="relative flex w-1.5 h-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    LIVE
                </span>
            </div>

            {/* Radial gauge */}
            <div className="relative mx-auto mt-8" style={{ width: SIZE, height: SIZE }}>
                <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
                    <defs>
                        <linearGradient id="scoreGradientExcellent" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#34d399" />
                            <stop offset="100%" stopColor="#22d3ee" />
                        </linearGradient>
                        <linearGradient id="scoreGradientGood" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#22d3ee" />
                            <stop offset="100%" stopColor="#3b82f6" />
                        </linearGradient>
                        <linearGradient id="scoreGradientFair" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#fbbf24" />
                            <stop offset="100%" stopColor="#f97316" />
                        </linearGradient>
                        <linearGradient id="scoreGradientCritical" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#f87171" />
                            <stop offset="100%" stopColor="#ef4444" />
                        </linearGradient>
                    </defs>

                    {/* Track */}
                    <circle
                        cx={SIZE / 2}
                        cy={SIZE / 2}
                        r={RADIUS}
                        fill="none"
                        stroke="rgba(51, 65, 85, 0.55)"
                        strokeWidth={STROKE}
                    />

                    {/* Progress */}
                    <circle
                        cx={SIZE / 2}
                        cy={SIZE / 2}
                        r={RADIUS}
                        fill="none"
                        stroke={status.stroke}
                        strokeWidth={STROKE}
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        strokeDashoffset={dashOffset}
                        style={{
                            transition:
                                "stroke-dashoffset 1.1s cubic-bezier(0.4, 0, 0.2, 1)",
                            filter: `drop-shadow(0 0 8px ${status.glow})`,
                        }}
                    />
                </svg>

                {/* Center readout */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-5xl font-bold tracking-tight ${status.text}`}>
                        {clamped}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mt-1">
                        / 100
                    </span>
                </div>
            </div>

            {/* Status */}
            <div className="mt-6 flex items-center justify-center gap-2">
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold tracking-wide ${status.badge}`}>
                    <StatusIcon size={13} />
                    {status.label.toUpperCase()} POSTURE
                </span>
            </div>

            <p className="text-slate-500 text-xs text-center mt-2.5">
                {status.caption}
            </p>

            {/* Supporting metrics */}
            <div className="grid grid-cols-3 gap-2.5 mt-auto pt-6">
                {metrics.map((metric) => (
                    <div
                        key={metric.label}
                        className="bg-slate-800/40 border border-slate-800 rounded-xl px-2 py-3 text-center"
                    >
                        <p className={`text-lg font-bold leading-none ${metric.valueClass}`}>
                            {metric.value}
                        </p>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-1.5">
                            {metric.label}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default SecurityScore;
