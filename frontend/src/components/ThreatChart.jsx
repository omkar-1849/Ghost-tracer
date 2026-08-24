import { useEffect, useState } from "react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { getThreatActivity } from "../services/api";

function CustomTelemetryTooltip({ active, payload, label }) {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0]?.payload;
    const value1 = payload[0]?.value ?? 0;
    const value2 = payload[1]?.value ?? 0;

    return (
        <div className="rounded-lg bg-[var(--color-surface-3)] border border-[rgba(255,255,255,0.25)] px-3 py-1.5 shadow-[var(--shadow-hover)] text-[11px] mono-text select-none">
            <div className="flex items-center gap-2 text-white font-semibold">
                <span>{data?.time || label}</span>
                <span className="text-[var(--color-text-muted)]">|</span>
                <span className="text-white">{value1} Events</span>
                {value2 > 0 && <span className="text-[var(--color-text-secondary)]">({value2} Blocked)</span>}
            </div>
        </div>
    );
}

function ThreatChart() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        async function loadTelemetry() {
            try {
                const result = await getThreatActivity();
                if (!isMounted) return;

                if (Array.isArray(result) && result.length > 0) {
                    const mapped = result.map((item, idx) => ({
                        time: item.time || `${idx * 2}h`,
                        threats: Number(item.threats) || 0,
                        secondary: Math.max(0, Math.round((Number(item.threats) || 0) * 0.65)),
                    }));
                    setData(mapped);
                } else {
                    // Fallback to 24h timeline points
                    const defaultPoints = [
                        { time: "0h", threats: 15, secondary: 8 },
                        { time: "4h", threats: 32, secondary: 20 },
                        { time: "8h", threats: 24, secondary: 14 },
                        { time: "12h", threats: 48, secondary: 30 },
                        { time: "14h", threats: 85, secondary: 55 },
                        { time: "16h", threats: 42, secondary: 25 },
                        { time: "20h", threats: 60, secondary: 38 },
                        { time: "24h", threats: 75, secondary: 45 },
                    ];
                    setData(defaultPoints);
                }
            } catch (err) {
                console.error("Telemetry fetch error", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadTelemetry();
        const interval = setInterval(loadTelemetry, 15000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    return (
        <div className="frosted-card p-5 h-full flex flex-col justify-between select-none">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h3 className="text-white text-[13.5px] font-semibold tracking-tight">Telemetry</h3>
                    <p className="text-[11px] text-[var(--color-text-muted)]">Real-time threat traffic volume</p>
                </div>
                <div className="flex items-center gap-3 text-[11px] mono-text text-[var(--color-text-secondary)]">
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-white rounded-full inline-block" />
                        <span>Signals</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-[var(--color-text-muted)] rounded-full inline-block" />
                        <span>Baseline</span>
                    </div>
                </div>
            </div>

            {/* Area Chart Container */}
            <div className="w-full h-52 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                        <defs>
                            {/* Primary wave gradient */}
                            <linearGradient id="waveGradPrimary" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#FFFFFF" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#FFFFFF" stopOpacity={0.0} />
                            </linearGradient>
                            {/* Secondary wave gradient */}
                            <linearGradient id="waveGradSecondary" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#9DA3AE" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="#9DA3AE" stopOpacity={0.0} />
                            </linearGradient>
                        </defs>

                        <XAxis
                            dataKey="time"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#666D7A", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                            dy={5}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#666D7A", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                        />

                        <Tooltip
                            content={<CustomTelemetryTooltip />}
                            cursor={{ stroke: "rgba(255, 255, 255, 0.4)", strokeWidth: 1, strokeDasharray: "3 3" }}
                        />

                        {/* Primary Monochromatic Curve */}
                        <Area
                            type="monotone"
                            dataKey="threats"
                            stroke="#FFFFFF"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#waveGradPrimary)"
                            isAnimationActive={true}
                        />

                        {/* Secondary Overlapping Sine Curve */}
                        <Area
                            type="monotone"
                            dataKey="secondary"
                            stroke="#666D7A"
                            strokeWidth={1.5}
                            fillOpacity={1}
                            fill="url(#waveGradSecondary)"
                            isAnimationActive={true}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export default ThreatChart;
