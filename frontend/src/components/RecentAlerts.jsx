import { useEffect, useState } from "react";
import { getRecentAlerts } from "../services/api";

function badgeColor(level) {
    switch (level) {
        case "CRITICAL":
            return "bg-red-500/20 text-red-400";

        case "HIGH":
            return "bg-orange-500/20 text-orange-400";

        case "MEDIUM":
            return "bg-yellow-500/20 text-yellow-400";

        default:
            return "bg-green-500/20 text-green-400";
    }
}

function RecentAlerts() {

    const [alerts, setAlerts] = useState([]);

    useEffect(() => {

        async function loadAlerts() {
            try {
                const data = await getRecentAlerts();
                setAlerts(data);
            } catch (error) {
                console.error(error);
            }
        }

        loadAlerts();

        const interval = setInterval(loadAlerts, 5000);

        return () => clearInterval(interval);

    }, []);

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[420px]">

            <h2 className="text-xl font-semibold mb-6">
                Recent Alerts
            </h2>

            {alerts.length === 0 ? (

                <div className="flex items-center justify-center h-72">

                    <p className="text-slate-500">
                        No recent alerts.
                    </p>

                </div>

            ) : (

                <div className="space-y-4">

                    {alerts.map((alert) => (

                        <div
                            key={alert.id}
                            className="border border-slate-800 rounded-xl p-4 hover:border-blue-500 hover:bg-slate-800/40 transition-all duration-300"
                        >

                            <div className="flex justify-between items-center">

                                <span
                                    className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeColor(alert.threat_level)}`}
                                >
                                    {alert.threat_level}
                                </span>

                                <span className="text-slate-500 text-xs">
                                    <span className="text-slate-500 text-xs">
                                        {new Date(alert.created_at).toLocaleString()}
                                    </span>
                                </span>

                            </div>

                            <p className="mt-3 text-white font-medium">
                                {alert.message}
                            </p>

                            <p className="text-slate-400 text-sm mt-2">
                                IP: {alert.ip_address}
                            </p>

                        </div>

                    ))}

                </div>

            )}

        </div>
    );
}

export default RecentAlerts;