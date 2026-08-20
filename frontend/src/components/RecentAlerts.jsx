import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BellRing, Globe, ShieldAlert } from "lucide-react";
import { getRecentAlerts } from "../services/api";

function badgeTheme(level) {
    switch (level) {
        case "CRITICAL":
            return {
                badge: "bg-[var(--color-critical)]/10 border border-[var(--color-critical)]/25 text-[var(--color-critical)]",
                bar: "bg-[var(--color-critical)]",
                text: "text-[var(--color-critical)]",
                dot: "bg-[var(--color-critical)]",
            };
        case "HIGH":
            return {
                badge: "bg-[var(--color-high)]/10 border border-[var(--color-high)]/25 text-[var(--color-high)]",
                bar: "bg-[var(--color-high)]",
                text: "text-[var(--color-high)]",
                dot: "bg-[var(--color-high)]",
            };
        case "MEDIUM":
            return {
                badge: "bg-[var(--color-medium)]/10 border border-[var(--color-medium)]/25 text-[var(--color-medium)]",
                bar: "bg-[var(--color-medium)]",
                text: "text-[var(--color-medium)]",
                dot: "bg-[var(--color-medium)]",
            };
        default:
            return {
                badge: "bg-[var(--color-success)]/10 border border-[var(--color-success)]/25 text-[var(--color-success)]",
                bar: "bg-[var(--color-success)]",
                text: "text-[var(--color-success)]",
                dot: "bg-[var(--color-success)]",
            };
    }
}

function timeAgo(value) {
    if (!value) return "—";
    const diff = Math.max(0, Date.now() - new Date(value).getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(value).toLocaleDateString();
}

function RecentAlerts() {
    const [alerts, setAlerts] = useState([]);

    useEffect(() => {
        async function loadAlerts() {
            try {
                const data = await getRecentAlerts();
                setAlerts(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error(error);
            }
        }
        loadAlerts();
        const interval = setInterval(loadAlerts, 5000);
        return () => clearInterval(interval);
    }, []);

    const criticalCount = alerts.filter(
        (alert) => alert.threat_level === "CRITICAL"
    ).length;

    return (
        <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-lg p-5 shadow-[var(--shadow-1)] min-h-[420px] flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">
                        Recent Alerts
                    </h2>
                    <p className="text-[var(--color-text-muted)] text-sm mt-1">
                        Latest detections requiring attention
                    </p>
                </div>

                <Link
                    to="/alerts"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[var(--color-surface-3)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-1)] transition-colors"
                >
                    View All
                    <ArrowRight size={13} />
                </Link>
            </div>

            {alerts.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-1)]">
                    <span className="w-12 h-12 rounded-lg bg-[var(--color-success)]/10 border border-[var(--color-success)]/25 flex items-center justify-center">
                        <BellRing size={22} className="text-[var(--color-success)]" />
                    </span>
                    <p className="text-[var(--color-text-primary)] font-medium">
                        No recent alerts
                    </p>
                    <p className="text-[var(--color-text-muted)] text-sm text-center max-w-xs">
                        Your network is quiet — new alerts will surface here
                        instantly.
                    </p>
                </div>
            ) : (
                <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[320px] pr-1">
                    {alerts.map((alert) => {
                        const theme = badgeTheme(alert.threat_level);

                        return (
                            <div
                                key={alert.id}
                                className="group relative flex items-start gap-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-4 py-3.5 hover:border-[var(--color-border-default)] hover:bg-[var(--color-surface-3)] transition-all duration-200"
                            >
                                <span
                                    className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${theme.bar}`}
                                />

                                <span
                                    className={`mt-0.5 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${theme.badge}`}
                                >
                                    <ShieldAlert size={15} />
                                </span>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest ${theme.badge}`}
                                        >
                                            <span
                                                className={`w-1 h-1 rounded-full ${theme.dot}`}
                                            />
                                            {alert.threat_level}
                                        </span>

                                        <span className="text-[11px] text-[var(--color-text-muted)] whitespace-nowrap ml-auto tabular-nums">
                                            {timeAgo(alert.created_at)}
                                        </span>
                                    </div>

                                    <p className="mt-2 text-sm text-[var(--color-text-primary)] font-medium leading-snug">
                                        {alert.message}
                                    </p>

                                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                                        <Globe size={12} className="shrink-0" />
                                        <span className="font-mono">
                                            {alert.ip_address}
                                        </span>
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {alerts.length > 0 && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--color-border-default)]">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-surface-3)] border border-[var(--color-border-subtle)] text-[11px] font-semibold text-[var(--color-text-secondary)] tabular-nums">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-critical)]" />
                        {criticalCount} critical
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-surface-3)] border border-[var(--color-border-subtle)] text-[11px] font-semibold text-[var(--color-text-secondary)] tabular-nums">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)]" />
                        {alerts.length} total
                    </span>
                </div>
            )}
        </div>
    );
}

export default RecentAlerts;
