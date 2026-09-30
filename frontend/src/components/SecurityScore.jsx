import { useEffect, useState } from "react";
import { getSecurityScore } from "../services/api";

function SecurityScore() {
    const [score, setScore] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        async function loadScore() {
            try {
                const data = await getSecurityScore();
                if (isMounted) setScore(Number.isFinite(data?.score) ? data.score : null);
            } catch (err) {
                console.error("Failed to load security score", err);
                if (isMounted) setScore(null);
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

    const clamped = score == null ? null : Math.max(0, Math.min(100, Math.round(score)));

    // Status evaluation from SENTINEL_GLASS_MATERIAL_SPEC.json
    let statusLabel = clamped == null ? "UNAVAILABLE" : "LOW LOG RISK";
    let statusColor = "#A9A199";
    if (clamped != null) {
        if (clamped < 60) {
            statusLabel = "ELEVATED RISK";
            statusColor = "#E67868";
        } else if (clamped < 85) {
            statusLabel = "GUARDED";
            statusColor = "#D3A06A";
        } else {
            statusLabel = "LOW LOG RISK";
            statusColor = "#77C79A";
        }
    }

    // Semi-circle SVG parameters from SENTINEL_GLASS_MATERIAL_SPEC.json
    // width: 150px, height: 104px, stroke: 7px, track: rgba(255,248,238,0.10), progress: #D3A06A
    const width = 150;
    const height = 104;
    const strokeWidth = 7;
    const radius = 62;
    const cx = 75;
    const cy = 88;
    const circumference = Math.PI * radius; // Half circle arc length (~194.78px)
    const strokeDashoffset = clamped == null ? circumference : circumference - (clamped / 100) * circumference;

    return (
        <div className="flex flex-col justify-between h-full select-none w-full box-border">
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
                <span 
                    style={{ 
                        fontSize: '11px', 
                        fontWeight: 600, 
                        letterSpacing: '0.08em', 
                        color: '#8B837B', 
                        textTransform: 'uppercase' 
                    }}
                >
                    Log-based Score
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 500, color: '#A9A199' }}>
                    {clamped != null && (
                        <span 
                            style={{ 
                                width: '6px', 
                                height: '6px', 
                                borderRadius: '50%', 
                                backgroundColor: '#77C79A' 
                            }} 
                        />
                    )}
                    <span>{clamped == null ? "Unavailable" : "Live"}</span>
                </div>
            </div>

            {/* Gauge Area */}
            <div className="relative flex flex-col items-center justify-center flex-1 my-1">
                <svg
                    width={width}
                    height={height}
                    viewBox={`0 0 ${width} ${height}`}
                    className="overflow-visible"
                    aria-label={`Security score: ${clamped == null ? 'Unavailable' : clamped}`}
                    role="img"
                >
                    <defs>
                        <linearGradient id="progressGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#D3A06A" />
                            <stop offset="100%" stopColor="#E3B985" />
                        </linearGradient>
                    </defs>
                    
                    {/* Background Track Arc */}
                    <path
                        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
                        fill="none"
                        stroke="rgba(255,248,238,0.10)"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />

                    {/* Active Progress Arc */}
                    {clamped != null && (
                        <path
                            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
                            fill="none"
                            stroke="url(#progressGradient)"
                            strokeWidth={strokeWidth}
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="motion-reduce:transition-none"
                            style={{
                                transition: "stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)",
                                filter: "drop-shadow(0 0 6px rgba(211,160,106,0.25))"
                            }}
                        />
                    )}
                </svg>

                {/* Centered Numbers */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pt-7">
                    <div className="flex items-baseline justify-center">
                        <span 
                            className="font-sans tabular-nums lining-nums"
                            style={{ 
                                fontSize: '34px', 
                                fontWeight: 600, 
                                color: '#F5F1EC', 
                                letterSpacing: '-0.02em',
                                lineHeight: '1'
                            }}
                        >
                            {loading ? "--" : clamped ?? "—"}
                        </span>
                        <span 
                            style={{ 
                                fontSize: '12px', 
                                fontWeight: 500, 
                                color: '#8B837B',
                                marginLeft: '3px'
                            }}
                        >
                            /100
                        </span>
                    </div>
                    <p
                        style={{ 
                            fontSize: '11px', 
                            fontWeight: 600, 
                            letterSpacing: '0.06em', 
                            textTransform: 'uppercase', 
                            color: statusColor,
                            marginTop: '3px'
                        }}
                    >
                        {statusLabel}
                    </p>
                </div>
            </div>

            {/* Footer without strong divider per spec (divider: none) */}
            <div 
                className="flex items-center justify-between mt-1 pt-1"
                style={{ 
                    fontSize: '12px', 
                    color: '#8B837B' 
                }}
            >
                <span>Derived from recorded logs</span>
                <span>
                    {clamped == null ? "—" : "Measured"}
                </span>
            </div>
        </div>
    );
}

export default SecurityScore;
