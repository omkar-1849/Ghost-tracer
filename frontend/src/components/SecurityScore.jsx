import { useEffect, useState } from "react";
import { getSecurityScore } from "../services/api";

function SecurityScore({ stats = {} }) {
    const [score, setScore] = useState(96);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        async function loadScore() {
            try {
                const data = await getSecurityScore();
                if (isMounted && data && typeof data.score === "number") {
                    setScore(data.score);
                }
            } catch (err) {
                console.error("Failed to load security score", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadScore();
        const interval = setInterval(loadScore, 10000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const clamped = Math.max(0, Math.min(100, Math.round(score)));

    // Status evaluation
    let statusLabel = "SECURE";
    let statusColor = "#FFFFFF";
    if (clamped < 60) {
        statusLabel = "ELEVATED RISK";
        statusColor = "var(--color-critical)";
    } else if (clamped < 85) {
        statusLabel = "GUARDED";
        statusColor = "var(--color-high)";
    }

    // Semi-circle SVG parameters
    const size = 170;
    const strokeWidth = 8;
    const radius = 70;
    const circumference = Math.PI * radius; // Half circle arc length
    const strokeDashoffset = circumference - (clamped / 100) * circumference;

    return (
        <div className="frosted-card p-5 flex flex-col justify-between h-full select-none relative overflow-hidden group">
            <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Security Posture</span>
                <span className="text-[11px] font-mono text-[var(--color-text-muted)]">Live</span>
            </div>

            {/* Gauge Area */}
            <div className="relative flex flex-col items-center justify-center my-1">
                <svg
                    width={size}
                    height={size / 1.75}
                    viewBox={`0 0 ${size} ${size / 1.75}`}
                    className="overflow-visible"
                >
                    {/* Background Track Arc */}
                    <path
                        d={`M 15 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 15} ${size / 2}`}
                        fill="none"
                        stroke="#1E222B"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />

                    {/* Active Progress Arc */}
                    <path
                        d={`M 15 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 15} ${size / 2}`}
                        fill="none"
                        stroke={statusColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        style={{
                            transition: "stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s ease",
                            filter: "drop-shadow(0 0 6px rgba(255,255,255,0.25))"
                        }}
                    />
                </svg>

                {/* Centered Numbers */}
                <div className="text-center mt-[-32px]">
                    <div className="flex items-baseline justify-center gap-1">
                        <span className="text-3xl font-bold tracking-tight text-white font-mono">
                            {loading ? "--" : clamped}
                        </span>
                        <span className="text-sm font-semibold text-[var(--color-text-muted)] font-mono">
                            /100
                        </span>
                    </div>
                    <p
                        className="text-[10px] font-bold tracking-[0.14em] uppercase mt-0.5"
                        style={{ color: statusColor }}
                    >
                        {statusLabel}
                    </p>
                </div>
            </div>

            {/* Sub-label */}
            <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)] pt-2 border-t border-[var(--color-border-subtle)]">
                <span>Threat Defense</span>
                <span className="font-mono text-white text-[10.5px]">Active Policy</span>
            </div>
        </div>
    );
}

export default SecurityScore;
