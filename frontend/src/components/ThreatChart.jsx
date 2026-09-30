import { useEffect, useState } from "react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid
} from "recharts";
import { getThreatActivity } from "../services/api";

function CustomTelemetryTooltip({ active, payload, label }) {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0]?.payload;
    const value = payload[0]?.value ?? 0;

    return (
        <div style={{
            background: 'rgba(29,27,24,0.94)',
            border: '1px solid rgba(245,241,236,0.12)',
            borderRadius: '10px',
            boxShadow: '0 18px 48px rgba(0,0,0,0.22)'
        }} className="px-3 py-2 text-[11px] font-mono text-[#F5F1EC]">
            <div className="flex items-center gap-2">
                <span>{data?.time || label}</span>
                <span className="text-[#A9A199]">|</span>
                <span>{value} Events</span>
            </div>
        </div>
    );
}

function ThreatChart() {
    const [state, setState] = useState({ data: null, error: "" });

    useEffect(() => {
        let isMounted = true;
        async function loadTelemetry() {
            try {
                const result = await getThreatActivity();
                if (!isMounted) return;

                if (Array.isArray(result) && result.length > 0) {
                    const mapped = result.map((item) => ({
                        time: item.time,
                        threats: Number(item.threats) || 0,
                    }));
                    setState({ data: mapped, error: "" });
                } else {
                    setState({ data: [], error: "" });
                }
            } catch (err) {
                console.error("Telemetry fetch error", err);
                setState({ data: [], error: "Threat activity is unavailable." });
            }
        }

        loadTelemetry();
        const interval = setInterval(loadTelemetry, 15000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const renderChartArea = () => {
        if (state.error) {
            return (
                <div className="absolute inset-0 flex items-center justify-center text-[#A9A199]">
                    <p role="alert">{state.error}</p>
                </div>
            );
        }
        if (state.data === null) {
            return (
                <div className="absolute inset-0 flex items-center justify-center text-[#A9A199]">
                    <p>Loading telemetry…</p>
                </div>
            );
        }
        if (state.data.length === 0) {
            return (
                <div className="absolute inset-0 flex items-center justify-center text-[#A9A199]">
                    <p>No threat activity recorded for this period.</p>
                </div>
            );
        }

        return (
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={state.data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="waveGradPrimary" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(211,160,106,0.22)" />
                            <stop offset="100%" stopColor="rgba(211,160,106,0.015)" />
                        </linearGradient>
                    </defs>
                    <CartesianGrid 
                        stroke="rgba(245,241,236,0.075)" 
                        strokeDasharray="2 6" 
                        strokeWidth={1}
                        vertical={false}
                    />
                    <XAxis
                        dataKey="time"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#8B837B", fontSize: 11, fontFamily: "'SF Mono', 'Cascadia Code', 'IBM Plex Mono', monospace" }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#8B837B", fontSize: 11, fontFamily: "'SF Mono', 'Cascadia Code', 'IBM Plex Mono', monospace" }}
                    />
                    <Tooltip
                        content={<CustomTelemetryTooltip />}
                        cursor={{ stroke: "rgba(227,185,133,0.48)", strokeWidth: 1, strokeDasharray: "3 3" }}
                    />
                    <Area
                        type="monotone"
                        dataKey="threats"
                        stroke="#E3B985"
                        strokeWidth={2}
                        fill="url(#waveGradPrimary)"
                        activeDot={{ fill: "#F5F1EC", stroke: "none", r: 4 }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        );
    };

    return (
        <div className="flex flex-col w-full h-full select-none">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h3 className="text-[17px] font-semibold text-[#F5F1EC] tracking-[-0.025em] font-sans">
                        Telemetry
                    </h3>
                    <p className="text-[14px] text-[#A9A199] font-sans mt-0.5">
                        Real-time threat traffic volume
                    </p>
                </div>
                <div className="flex items-center gap-2 text-[13px] text-[#A9A199]">
                    <span className="w-4 h-0.5 bg-[#E3B985] rounded-full inline-block" />
                    <span>Signals</span>
                </div>
            </div>

            {/* Chart Container */}
            <div className="w-full min-h-[200px] md:h-[240px] flex-1 relative">
                {renderChartArea()}
            </div>
        </div>
    );
}

export default ThreatChart;
