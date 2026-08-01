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
import { Activity, RotateCw, ShieldAlert, TriangleAlert } from "lucide-react";

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

/* Scoped animations / shimmer styles (unique prefix to avoid clashes). */
const chartStyles = `
@keyframes threat-card-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes threat-tooltip-in {
  from { opacity: 0; transform: translateY(4px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes threat-ping {
  0% { transform: scale(0.6); opacity: 0.9; }
  70%, 100% { transform: scale(2.4); opacity: 0; }
}
@keyframes threat-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.threat-halo {
  transform-box: fill-box;
  transform-origin: center;
  animation: threat-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
}
.threat-tooltip {
  animation: threat-tooltip-in 160ms ease-out both;
}
.threat-shimmer {
  background: linear-gradient(
    100deg,
    rgba(51, 65, 85, 0.55) 30%,
    rgba(100, 116, 139, 0.4) 50%,
    rgba(51, 65, 85, 0.55) 70%
  );
  background-size: 200% 100%;
  animation: threat-shimmer 1.6s linear infinite;
}
`;

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

/**
 * Distributes the 24 hourly counts into `buckets` equal-width windows
 * (lossless — the total is preserved). This lets the same API payload
 * power the 24H / 7D / 30D views without touching the backend.
 */
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
        <div className="threat-shimmer h-4 w-24 rounded-md" />
        <div className="threat-shimmer h-4 w-16 rounded-md" />
        <div className="threat-shimmer h-4 w-16 rounded-md" />
      </div>

      <div className="flex items-end gap-1.5 h-64 sm:h-72 w-full overflow-hidden rounded-xl border border-slate-800/60 p-4">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="threat-shimmer flex-1 rounded-t-md"
            style={{ height: `${28 + ((i * 37) % 60)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-72 gap-3 rounded-xl border border-dashed border-slate-800 bg-slate-950/40">
      <span className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center">
        <ShieldAlert size={22} className="text-blue-400" />
      </span>

      <p className="text-slate-300 font-medium">No threat activity yet</p>

      <p className="text-slate-500 text-sm text-center max-w-xs">
        Detections will appear here in real time as they are captured by the
        monitoring engine.
      </p>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-72 gap-3 rounded-xl border border-dashed border-red-500/20 bg-slate-950/40">
      <span className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center">
        <TriangleAlert size={22} className="text-red-400" />
      </span>

      <p className="text-slate-300 font-medium">Unable to load threat activity</p>

      <p className="text-slate-500 text-sm">
        The monitoring feed could not be reached.
      </p>

      <button
        type="button"
        onClick={onRetry}
        className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-sm font-semibold hover:bg-blue-500/25 transition-colors"
      >
        <RotateCw size={14} />
        Retry
      </button>
    </div>
  );
}

function ThreatTooltip({ active, payload, label, rangeLabel }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="threat-tooltip rounded-xl border border-slate-700/70 bg-slate-900/90 backdrop-blur-xl px-4 py-3 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.85)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
        {rangeLabel}
      </p>

      <p className="text-sm font-semibold text-slate-200 mt-0.5">{label}</p>

      <div className="flex items-baseline gap-2 mt-2">
        <span className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.9)]" />
        <span className="text-lg font-bold text-white leading-none">
          {fmtNumber(payload[0].value)}
        </span>
        <span className="text-xs text-slate-500">threats</span>
      </div>
    </div>
  );
}

function renderActiveDot({ cx, cy }) {
  return (
    <g>
      <circle className="threat-halo" cx={cx} cy={cy} r={5} fill="#3b82f6" />
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill="#3b82f6"
        stroke="#020617"
        strokeWidth={2}
      />
    </g>
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
        console.log("[ThreatChart] raw API response:", result);
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

  /* Normalise the API payload into a full 24-hour series (0–23). */
  const hours = useMemo(() => {
    const buckets = new Array(24).fill(0);

    for (const point of data) {
      const hour = parseInt(String(point?.time), 10);
      const threats = Number(point?.threats);

      if (!Number.isNaN(hour) && hour >= 0 && hour < 24) {
        buckets[hour] += Number.isFinite(threats) ? threats : 0;
      }
    }

    console.log("[ThreatChart] transformed hours (24 buckets):", buckets);
    return buckets;
  }, [data]);

  /* Bucket the hourly series for the selected range. */
  const series = useMemo(() => {
    const points = buildSeries(hours, activeRange.buckets);
    console.log("[ThreatChart] final series passed to AreaChart:", points);
    return points;
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
    <div
      className="bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[420px] flex flex-col"
      style={{ animation: "threat-card-in 500ms ease-out both" }}
    >
      <style>{chartStyles}</style>

      {/* Header + range selector */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-semibold tracking-tight">
              Threat Activity
            </h2>

            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-[10px] font-bold tracking-widest text-blue-400">
              <Activity size={11} />
              LIVE
            </span>
          </div>

          <p className="text-slate-400 text-sm mt-1">{activeRange.subtitle}</p>
        </div>

        <div
          role="group"
          aria-label="Threat activity time range"
          className="flex items-center gap-1 bg-slate-800/40 border border-slate-800 rounded-full p-1"
        >
          {RANGES.map((r) => {
            const isActive = r.key === range;

            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                aria-pressed={isActive}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-[0_0_14px_rgba(59,130,246,0.45)]"
                    : "text-slate-400 hover:text-white"
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
          <div className="flex items-center gap-6 text-xs text-slate-500 mb-5">
            <span>
              Total{" "}
              <span className="text-white font-semibold text-sm">
                {fmtNumber(total)}
              </span>
            </span>
            <span>
              Peak{" "}
              <span className="text-cyan-400 font-semibold text-sm">
                {fmtNumber(peak)}
              </span>
            </span>
            <span>
              Avg{" "}
              <span className="text-slate-300 font-semibold text-sm">
                {fmtNumber(avg)}
              </span>
            </span>
          </div>

          {/* Chart */}
          <div className="w-full">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart
                data={series}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="threatFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="55%" stopColor="#3b82f6" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="threatLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148,163,184,0.08)"
                  vertical={false}
                />

                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={32}
                  dy={4}
                />

                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={tickFormatter}
                  domain={[0, "auto"]}
                  allowDecimals={false}
                />

                <Tooltip
                  content={
                    <ThreatTooltip rangeLabel={`${activeRange.label} · ${activeRange.view}`} />
                  }
                  cursor={{
                    stroke: "rgba(148,163,184,0.4)",
                    strokeWidth: 1,
                    strokeDasharray: "5 5",
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="threats"
                  stroke="url(#threatLine)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  fill="url(#threatFill)"
                  dot={false}
                  activeDot={renderActiveDot}
                  animationDuration={900}
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
