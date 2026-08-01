import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BellRing, Globe, ShieldAlert } from "lucide-react";
import { getRecentAlerts } from "../services/api";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function badgeTheme(level) {
    switch (level) {
        case "CRITICAL":
            return {
                badge: "bg-red-500/10 border border-red-500/25 text-red-400",
                bar: "bg-red-500",
                text: "text-red-400",
                dot: "bg-red-500",
            };
        case "HIGH":
            return {
                badge: "bg-orange-500/10 border border-orange-500/25 text-orange-400",
                bar: "bg-orange-500",
                text: "text-orange-400",
                dot: "bg-orange-500",
            };
        case "MEDIUM":
            return {
                badge: "bg-yellow-500/10 border border-yellow-500/25 text-yellow-400",
                bar: "bg-yellow-500",
                text: "text-yellow-400",
                dot: "bg-yellow-500",
            };
        default:
            return {
                badge: "bg-green-500/10 border border-green-500/25 text-green-400",
                bar: "bg-green-500",
                text: "text-green-400",
                dot: "bg-green-500",
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

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[420px] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">
                        Recent Alerts
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Latest detections requiring attention
                    </p>
                </div>

                <Link
                    to="/alerts"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-800/60 border border-slate-700 text-slate-300 hover:border-blue-500/40 hover:text-white hover:bg-slate-800 transition-colors"
                >
                    View All
                    <ArrowRight size={13} />
                </Link>
            </div>

            {/* Body */}
            {alerts.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-800 bg-slate-950/40">
                    <span className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
                        <BellRing size={22} className="text-emerald-400" />
                    </span>
                    <p className="text-slate-300 font-medium">
                        No recent alerts
                    </p>
                    <p className="text-slate-500 text-sm text-center max-w-xs">
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
                                className="group relative flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3.5 hover:border-slate-700 hover:bg-slate-800/40 transition-all duration-200"
                            >
                                {/* Severity accent bar */}
                                <span
                                    className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${theme.bar}`}
                                />

                                {/* Icon */}
                                <span
                                    className={`mt-0.5 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${theme.badge}`}
                                >
                                    <ShieldAlert size={15} />
                                </span>

                                {/* Content */}
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

                                        <span className="text-[11px] text-slate-500 whitespace-nowrap ml-auto">
                                            {timeAgo(alert.created_at)}
                                        </span>
                                    </div>

                                    <p className="mt-2 text-sm text-slate-200 font-medium leading-snug">
                                        {alert.message}
                                    </p>

                                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
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

            {/* Footer summary */}
            {alerts.length > 0 && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-800/70">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/60 border border-slate-800 text-[11px] font-semibold text-slate-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        {criticalCount} critical
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/60 border border-slate-800 text-[11px] font-semibold text-slate-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        {alerts.length} total
                    </span>
                </div>
            )}
        </div>
    );
}

export default RecentAlerts;
