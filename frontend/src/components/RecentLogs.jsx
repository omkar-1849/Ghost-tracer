import { useEffect, useState } from "react";
import { getRecentLogs } from "../services/api";

function RecentLogs() {

    const [logs, setLogs] = useState([]);

    useEffect(() => {

        async function loadLogs() {
            try {
                const data = await getRecentLogs();
                setLogs(data);
            } catch (error) {
                console.error(error);
            }
        }

        loadLogs();

        const interval = setInterval(loadLogs, 5000);

        return () => clearInterval(interval);

    }, []);

    return (

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mt-8">

            <h2 className="text-2xl font-semibold mb-6">
                Recent Security Logs
            </h2>

            <table className="w-full text-left">

                <thead>

                    <tr className="border-b border-slate-700 text-slate-400">

                        <th className="pb-3">IP Address</th>
                        <th className="pb-3">URL</th>
                        <th className="pb-3">Risk Score</th>
                        <th className="pb-3">Threat</th>
                        <th className="pb-3">Time</th>

                    </tr>

                </thead>

                <tbody>

                    {logs.map((log) => (

                        <tr
                            key={log.id}
                            className="border-b border-slate-800 hover:bg-slate-800 transition"
                        >

                            <td className="py-4">
                                {log.ip_address}
                            </td>

                            <td>
                                {log.url}
                            </td>

                            <td>
                                {log.risk_score}
                            </td>

                            <td>

                                <span
                                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                        log.threat_level === "CRITICAL"
                                            ? "bg-red-500/20 text-red-400"
                                            : log.threat_level === "HIGH"
                                            ? "bg-orange-500/20 text-orange-400"
                                            : log.threat_level === "MEDIUM"
                                            ? "bg-yellow-500/20 text-yellow-400"
                                            : "bg-green-500/20 text-green-400"
                                    }`}
                                >
                                    {log.threat_level}
                                </span>

                            </td>

                            <td>
                                {new Date(log.timestamp).toLocaleString()}
                            </td>

                        </tr>

                    ))}

                </tbody>

            </table>

        </div>

    );

}

export default RecentLogs;