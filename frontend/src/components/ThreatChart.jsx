import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RotateCw, ShieldAlert, TriangleAlert } from "lucide-react";

import { getThreatActivity } from "../services/api";

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

const RANGES = [
  {
    key: "24h",
    label: "24H",
    buckets: 24,
    view: "Hourly",
    subtitle: "Hourly detection volume over the last 24 hours",
  },
  {
    key: "7d",
    label: "7D",
    buckets: 7,
    view: "Daily",
    subtitle: "Daily detection volume over the last 7 days",
  },
  {
    key: "30d",
    label: "30D",
    buckets: 30,
    view: "Daily",
    subtitle: "Daily detection volume over the last 30 days",
  },
];

const fmtNumber = (value) =>
  Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });

const tickFormatter = (value) =>
  value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);

/** Pure fetcher (no setState) shared by the polling effect and the retry handler. */
async function fetchThreatActivity() {
  const result = await getThreatActivity();
  return Array.isArray(result) ? result : [];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function buildSeries(hours, buckets) {
  const points = [];
  const window = 24 / buckets;

  let srcIndex = 0;
  let srcUsed = 0;

  for (let b = 0; b < buckets; b += 1) {
    let need = window;
    let sum = 0;

    while (need > 1e-9 && srcIndex < 24) {
      const available = 1 - srcUsed;
      const take = Math.min(need, available);

      sum += hours[srcIndex] * take;

      srcUsed += take;
      need -= take;

      if (srcUsed >= 1 - 1e-9) {
        srcUsed = 0;
        srcIndex += 1;
      }
    }

    points.push({
      label: buildLabel(b, buckets),
      threats: Math.round(sum * 10) / 10,
    });
  }

  return points;
}

function buildLabel(index, buckets) {
  if (buckets === 24) {
    return `${String(index).padStart(2, "0")}:00`;
  }
  return `D${index + 1}`;
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function ChartSkeleton() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center gap-6 mb-6">
        <div className="h-4 w-24 rounded bg-[var(--color-surface-3)] animate-pulse" />
        <div className="h-4 w-16 rounded bg-[var(--color-surface-3)] animate-pulse" />
        <div className="h-4 w-16 rounded bg-[var(--color-surface-3)] animate-pulse" />
      </div>
      <div className="flex items-end gap-1.5 h-64 w-full overflow-hidden rounded-md border border-[var(--color-border-subtle)] p-4">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-[var(--color-surface-3)] animate-pulse"
            style={{ height: `${28 + ((i * 37) % 60)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-64 gap-3 rounded-md border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-1)]">
      <span className="w-10 h-10 rounded-lg bg-[var(--color-accent-subtle)] border border-[rgba(61,122,240,0.25)] flex items-center justify-center">
        <ShieldAlert size={20} className="text-[var(--color-accent)]" />
      </span>
      <p className="text-[var(--color-text-secondary)] text-sm font-medium">No threat activity yet</p>
      <p className="text-[var(--color-text-muted)] text-xs text-center max-w-xs">
        Detections will appear here in real time as they are captured by the monitoring engine.
      </p>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-64 gap-3 rounded-md border border-dashed border-[rgba(229,72,77,0.20)] bg-[var(--color-surface-1)]">
      <span className="w-10 h-10 rounded-lg bg-[rgba(229,72,77,0.10)] border border-[rgba(229,72,77,0.25)] flex items-center justify-center">
        <TriangleAlert size={20} className="text-[var(--color-critical)]" />
      </span>
      <p className="text-[var(--color-text-secondary)] text-sm font-medium">Unable to load threat activity</p>
      <p className="text-[var(--color-text-muted)] text-xs">The monitoring feed could not be reached.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
      >
        <RotateCw size={13} />
        Retry
      </button>
    </div>
  );
}

function ThreatTooltip({ active, payload, label, rangeLabel }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-3)] px-3 py-2.5 shadow-[var(--shadow-2)]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-disabled)]">
        {rangeLabel}
      </p>
      <p className="text-xs font-medium text-[var(--color-text-secondary)] mt-0.5">{label}</p>
      <div className="flex items-baseline gap-2 mt-1.5">
        <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
        <span className="text-base font-bold text-[var(--color-text-primary)] leading-none tabular-nums">
          {fmtNumber(payload[0].value)}
        </span>
        <span className="text-[10px] text-[var(--color-text-muted)]">threats</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

function ThreatChart() {
  const [range, setRange] = useState("24h");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const activeRange = RANGES.find((r) => r.key === range) ?? RANGES[0];

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const result = await fetchThreatActivity();
        if (!cancelled) {
          setData(result);
          setError(false);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    poll();

    const interval = setInterval(poll, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const hours = useMemo(() => {
    const buckets = new Array(24).fill(0);

    for (const point of data) {
      const hour = parseInt(String(point?.time), 10);
      const threats = Number(point?.threats);

      if (!Number.isNaN(hour) && hour >= 0 && hour < 24) {
        buckets[hour] += Number.isFinite(threats) ? threats : 0;
      }
    }

    return buckets;
  }, [data]);

  const series = useMemo(() => {
    return buildSeries(hours, activeRange.buckets);
  }, [hours, activeRange.buckets]);

  const hasData = series.some((point) => point.threats > 0);

  const total = useMemo(
    () => series.reduce((sum, point) => sum + point.threats, 0),
    [series]
  );
  const peak = useMemo(
    () => Math.max(0, ...series.map((point) => point.threats)),
    [series]
  );
  const avg = series.length ? total / series.length : 0;

  async function handleRetry() {
    setLoading(true);
    setError(false);

    try {
      const result = await fetchThreatActivity();
      setData(result);
      setError(false);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-5 min-h-[400px] flex flex-col shadow-[var(--shadow-1)]">
      {/* Header + range selector */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
            Threat Activity
          </h2>
          <p className="text-[var(--color-text-muted)] text-xs mt-0.5">{activeRange.subtitle}</p>
        </div>

        <div
          role="group"
          aria-label="Threat activity time range"
          className="flex items-center gap-0.5 bg-[var(--color-surface-1)] border border-[var(--color-border-subtle)] rounded-md p-0.5"
        >
          {RANGES.map((r) => {
            const isActive = r.key === range;

            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                aria-pressed={isActive}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                  isActive
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <ChartSkeleton />
      ) : error && !hasData ? (
        <ErrorState onRetry={handleRetry} />
      ) : !hasData ? (
        <EmptyState />
      ) : (
        <>
          {/* Summary chips */}
          <div className="flex items-center gap-6 text-xs text-[var(--color-text-muted)] mb-4">
            <span>
              Total{" "}
              <span className="text-[var(--color-text-primary)] font-semibold tabular-nums">
                {fmtNumber(total)}
              </span>
            </span>
            <span>
              Peak{" "}
              <span className="text-[var(--color-accent)] font-semibold tabular-nums">
                {fmtNumber(peak)}
              </span>
            </span>
            <span>
              Avg{" "}
              <span className="text-[var(--color-text-secondary)] font-semibold tabular-nums">
                {fmtNumber(avg)}
              </span>
            </span>
          </div>

          {/* Chart */}
          <div className="w-full flex-1">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={series}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="threatFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3d7af0" stopOpacity={0.20} />
                    <stop offset="100%" stopColor="#3d7af0" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border-subtle)"
                  vertical={false}
                />

                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={32}
                  dy={4}
                />

                <YAxis
                  tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tickFormatter={tickFormatter}
                  domain={[0, "auto"]}
                  allowDecimals={false}
                />

                <Tooltip
                  content={
                    <ThreatTooltip rangeLabel={`${activeRange.label} · ${activeRange.view}`} />
                  }
                  cursor={{
                    stroke: "var(--color-border-strong)",
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="threats"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  fill="url(#threatFill)"
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: "var(--color-accent)",
                    stroke: "var(--color-surface-2)",
                    strokeWidth: 2,
                  }}
                  animationDuration={600}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

export default ThreatChart;
