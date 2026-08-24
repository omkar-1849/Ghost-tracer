import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { getThreatDistribution } from "../services/api";

/**
 * ThreatDistribution — presentational body only (donut + legend).
 * Data fetching / polling logic is unchanged.
 */

/* Severity-ordered semantic ramp — restrained, no rainbow, no jade
   (green is reserved for healthy states, not threat mix). */
const COLORS = [
    "#df5b5b",
    "#e08544",
    "#d3a53e",
    "#8aa6bd",
];

/* Solid tooltip that matches the new design language. */
function DistributionTooltip({ active, payload }) {
    if (!active || !payload || payload.length === 0) return null;

    const entry = payload[0];
    const index = entry.payloadIndex ?? 0;
    const color =
        entry.color ||
        (entry.payload && entry.payload.fill) ||
        COLORS[index % COLORS.length];

    return (
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-3)] px-3.5 py-2.5 shadow-[var(--shadow-2)]">
            <p className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-primary)]">
                <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: color }}
                />
                {entry.name}
            </p>
            <p className="mt-1 text-sm font-bold tabular-nums text-[var(--color-text-primary)]">
                {Number(entry.value).toLocaleString()}
                <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                    events
                </span>
            </p>
        </div>
    );
}

function ThreatDistribution() {
    const [data, setData] = useState([]);

    useEffect(() => {
        async function loadDistribution() {
            try {
                const result = await getThreatDistribution();
                setData(result);
            } catch (err) {
                console.error(err);
            }
        }

        loadDistribution();

        const interval = setInterval(loadDistribution, 5000);

        return () => clearInterval(interval);
    }, []);

    if (data.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-6 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-2)]">
                    <svg
                        className="h-5 w-5 text-[var(--color-text-muted)]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                        <path d="M22 12A10 10 0 0 0 12 2v10z" />
                    </svg>
                </span>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    No distribution data yet
                </p>
                <p className="max-w-xs text-xs text-[var(--color-text-muted)]">
                    Classified event mix will be visualized here once detections
                    start streaming in.
                </p>
            </div>
        );
    }

    const total = data.reduce(
        (sum, entry) => sum + (Number(entry.value) || 0),
        0
    );

    return (
        <div className="flex flex-1 flex-col">
            {/* Donut with centered total */}
            <div className="relative mx-auto h-52 w-full max-w-[15rem]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={62}
                            outerRadius={86}
                            paddingAngle={3}
                            cornerRadius={6}
                            stroke="none"
                            animationDuration={700}
                            animationEasing="ease-out"
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={index}
                                    fill={COLORS[index % COLORS.length]}
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            content={<DistributionTooltip />}
                            cursor={false}
                        />
                    </PieChart>
                </ResponsiveContainer>

                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold tabular-nums tracking-tight text-[var(--color-text-primary)]">
                        {total.toLocaleString()}
                    </span>
                    <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                        detections
                    </span>
                </div>
            </div>

            {/* Legend */}
            <ul className="mt-6 flex flex-1 flex-col justify-end gap-2">
                {data.map((entry, index) => {
                    const color = COLORS[index % COLORS.length];

                    return (
                        <li
                            key={index}
                            className="group/legend flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors duration-200 hover:bg-[var(--color-surface-3)]"
                        >
                            <span className="flex min-w-0 items-center gap-2.5">
                                <span
                                    className="h-2 w-2 flex-shrink-0 rounded-full"
                                    style={{ background: color }}
                                />
                                <span className="truncate text-[13px] font-medium text-[var(--color-text-secondary)]">
                                    {entry.name}
                                </span>
                            </span>

                            <span className="flex items-baseline gap-2">
                                <span className="text-xs font-bold tabular-nums text-[var(--color-text-primary)]">
                                    {Number(entry.value).toLocaleString()}
                                </span>
                                <span className="w-10 text-right text-[10px] font-semibold tabular-nums text-[var(--color-text-muted)]">
                                    {total > 0
                                        ? `${Math.round(
                                              (Number(entry.value) / total) *
                                                  100
                                          )}%`
                                        : "0%"}
                                </span>
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default ThreatDistribution;
