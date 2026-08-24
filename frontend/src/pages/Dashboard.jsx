import { useEffect, useState } from "react";

import ThreatChart from "../components/ThreatChart";
import Navbar from "../components/Navbar";
import RecentAlerts from "../components/RecentAlerts";
import RecentLogs from "../components/RecentLogs";
import SecurityScore from "../components/SecurityScore";
import LiveAttackFeed from "../components/LiveAttackFeed";
import TopAttackingIPs from "../components/TopAttackingIPs";
import TopTargetedURLs from "../components/TopTargetedURLs";
import AttackTypes from "../components/AttackTypes";
import ThreatDistribution from "../components/ThreatDistribution";
import LiveDot from "../components/ui/LiveDot";

import { getDashboardStats } from "../services/api";

import {
    Database,
    TriangleAlert,
    ShieldAlert,
    Flame,
    ShieldCheck,
    CircleAlert,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Composition primitives — one shared visual language for the page    */
/* ------------------------------------------------------------------ */

function SectionHeading({ label, title, className = "" }) {
    return (
        <div className={`flex items-baseline gap-3 ${className}`}>
            <p className="section-label shrink-0">{label}</p>
            <div className="h-px flex-1 bg-[var(--color-border-subtle)]" aria-hidden="true" />
            {title && (
                <p className="text-[11px] text-[var(--color-text-muted)] shrink-0">{title}</p>
            )}
        </div>
    );
}

function Surface({ children, className = "" }) {
    return (
        <section
            className={`bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg shadow-[var(--shadow-1)] ${className}`}
        >
            {children}
        </section>
    );
}

function SurfaceTitle({ title, hint }) {
    return (
        <div className="flex items-baseline justify-between gap-3 mb-2">
            <h3 className="card-title">{title}</h3>
            {hint && <p className="text-[11px] text-[var(--color-text-muted)]">{hint}</p>}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Threat level — derived from live stats                              */
/* ------------------------------------------------------------------ */

function resolveThreatLevel(stats) {
    if (Number(stats.critical_alerts) > 0) {
        return {
            label: "Elevated",
            tone: "var(--color-critical)",
            icon: Flame,
            message: "Critical alerts require immediate analyst review.",
        };
    }
    if (Number(stats.high_alerts) > 0) {
        return {
            label: "Guarded",
            tone: "var(--color-high)",
            icon: CircleAlert,
            message: "High-severity threats detected — monitor closely.",
        };
    }
    return {
        label: "Normal",
        tone: "var(--color-success)",
        icon: ShieldCheck,
        message: "No critical or high-severity alerts in the current window.",
    };
}

/* ------------------------------------------------------------------ */
/* Posture band — the score anchors the section; supporting signals   */
/* sit beside it through typography, dividers and alignment (no        */
/* miniature cards).                                                   */
/* ------------------------------------------------------------------ */

function PostureBand({ stats }) {
    const level = resolveThreatLevel(stats);
    const LevelIcon = level.icon;

    const readouts = [
        { label: "Events", value: stats.total_logs, icon: Database },
        { label: "Alerts", value: stats.total_alerts, icon: TriangleAlert },
        { label: "Critical", value: stats.critical_alerts, icon: ShieldAlert, tone: "var(--color-critical)" },
        { label: "High", value: stats.high_alerts, icon: Flame, tone: "var(--color-high)" },
    ];

    return (
        <Surface
            role="status"
            aria-label={`Threat level ${level.label}`}
            className="relative overflow-hidden"
        >
            <span
                className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ backgroundColor: level.tone, opacity: 0.7 }}
                aria-hidden="true"
            />

            <div className="grid grid-cols-1 lg:grid-cols-[auto_1px_1fr] gap-8 px-6 py-6">
                {/* Anchor — the posture score */}
                <SecurityScore stats={stats} />

                <div className="hidden lg:block w-px bg-[var(--color-border-subtle)]" aria-hidden="true" />

                {/* Supporting signals — typographic, divider-separated */}
                <div className="flex flex-col justify-center min-w-0 gap-6">
                    <div className="flex items-center gap-3.5">
                        <span
                            className="w-10 h-10 rounded-md flex items-center justify-center border shrink-0"
                            style={{
                                color: level.tone,
                                borderColor: `color-mix(in srgb, ${level.tone} 28%, transparent)`,
                                backgroundColor: `color-mix(in srgb, ${level.tone} 10%, transparent)`,
                            }}
                        >
                            <LevelIcon size={19} strokeWidth={2} />
                        </span>
                        <div className="min-w-0">
                            <p className="section-label">Current Threat Level</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <LiveDot color={level.tone} size={7} />
                                <span
                                    className="text-lg font-bold tracking-tight leading-none"
                                    style={{ color: level.tone }}
                                >
                                    {level.label.toUpperCase()}
                                </span>
                            </div>
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-1 truncate">
                                {level.message}
                            </p>
                        </div>
                    </div>

                    <div className="h-px bg-[var(--color-border-subtle)]" aria-hidden="true" />

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-5">
                        {readouts.map((item, i) => (
                            <div
                                key={item.label}
                                className={`min-w-0 ${i > 0 ? "sm:border-l sm:border-[var(--color-border-subtle)] sm:pl-8" : ""}`}
                            >
                                <p className="flex items-center gap-1.5 section-label">
                                    <item.icon
                                        size={11}
                                        style={{ color: item.tone || "var(--color-text-muted)" }}
                                    />
                                    {item.label}
                                </p>
                                <p
                                    className="metric-value text-2xl mt-1.5 leading-none"
                                    style={item.tone ? { color: item.tone } : undefined}
                                >
                                    {item.value}
                                </p>
                            </div>
                        ))}
                    </div>

                    <p className="text-[11px] text-[var(--color-text-muted)]">
                        Posture index, alert mix and event volume are polled live every 5 seconds.
                    </p>
                </div>
            </div>
        </Surface>
    );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

function Dashboard() {
    const [stats, setStats] = useState({
        total_logs: 0,
        total_alerts: 0,
        critical_alerts: 0,
        high_alerts: 0,
    });

    useEffect(() => {
        async function loadStats() {
            try {
                const data = await getDashboardStats();
                setStats(data);
            } catch (error) {
                console.error(error);
            }
        }

        loadStats();

        const interval = setInterval(loadStats, 5000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="p-6 max-w-[1440px]">
            <Navbar />

            {/* Security posture — one composed command surface */}
            <PostureBand stats={stats} />

            {/* Threat Activity — the dominant visualization, full width */}
            <SectionHeading label="Threat Activity" title="Detection volume over time" className="mt-8 mb-3" />
            <ThreatChart />

            {/* Security stream — alerts & log telemetry share one surface */}
            <SectionHeading label="Security Stream" title="Alerts & raw telemetry" className="mt-8 mb-3" />
            <Surface className="p-5">
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]">
                    <RecentAlerts />
                    <div className="hidden xl:block bg-[var(--color-border-subtle)]" aria-hidden="true" />
                    <RecentLogs />
                </div>
            </Surface>

            {/* Live Operations */}
            <SectionHeading label="Live Operations" title="Real-time attack telemetry" className="mt-8 mb-3" />
            <Surface className="p-5">
                <LiveAttackFeed />
            </Surface>

            {/* Intelligence — ranked origins & classification mix */}
            <SectionHeading label="Intelligence" title="Source & vector analysis" className="mt-8 mb-3" />
            <Surface className="p-5 mb-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_1px_minmax(0,2fr)]">
                    <div className="min-w-0">
                        <SurfaceTitle title="Top Attacking IPs" hint="by attack volume" />
                        <TopAttackingIPs />
                    </div>
                    <div className="hidden lg:block bg-[var(--color-border-subtle)]" aria-hidden="true" />
                    <div className="min-w-0">
                        <SurfaceTitle title="Threat Distribution" hint="event mix" />
                        <ThreatDistribution />
                    </div>
                </div>
            </Surface>

            {/* Attack vectors */}
            <SectionHeading label="Attack Vectors" title="Detected request patterns" className="mb-3" />
            <Surface className="p-5">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_1px_minmax(0,2fr)]">
                    <div className="min-w-0">
                        <SurfaceTitle title="Attack Types" hint="severity-graded" />
                        <AttackTypes />
                    </div>
                    <div className="hidden lg:block bg-[var(--color-border-subtle)]" aria-hidden="true" />
                    <div className="min-w-0">
                        <SurfaceTitle title="Top Targeted URLs" hint="most-hit endpoints" />
                        <TopTargetedURLs />
                    </div>
                </div>
            </Surface>
        </div>
    );
}

export default Dashboard;
