import { useEffect, useState } from "react";

import ThreatChart from "../components/ThreatChart";
import Navbar from "../components/Navbar";
import StatCard from "../components/StatCard";
import RecentAlerts from "../components/RecentAlerts";
import RecentLogs from "../components/RecentLogs";
import SecurityScore from "../components/SecurityScore";
import LiveAttackFeed from "../components/LiveAttackFeed";

import { getDashboardStats } from "../services/api";

import {
    Database,
    TriangleAlert,
    ShieldAlert,
    Shield,
} from "lucide-react";

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
        <div className="flex-1 p-8">

            <Navbar />

            <div className="grid grid-cols-4 gap-6">

                <StatCard
                    title="Total Logs"
                    value={stats.total_logs}
                    color="text-white"
                    icon={Database}
                />

                <StatCard
                    title="Alerts"
                    value={stats.total_alerts}
                    color="text-yellow-400"
                    icon={TriangleAlert}
                />

                <StatCard
                    title="Critical"
                    value={stats.critical_alerts}
                    color="text-red-500"
                    icon={ShieldAlert}
                />

                <StatCard
                    title="High Threats"
                    value={stats.high_alerts}
                    color="text-orange-400"
                    icon={Shield}
                />

            </div>

            <div className="grid grid-cols-3 gap-6 mt-8">

                <div className="col-span-2">
                    <ThreatChart />
                </div>

                <RecentAlerts />

            </div>

            <div className="grid grid-cols-3 gap-6 mt-8">

                <SecurityScore stats={stats} />

                <div className="col-span-2">
                    <RecentLogs />
                </div>

            </div>

            <div className="mt-8">
                <LiveAttackFeed />
            </div>

        </div>
    );
}

export default Dashboard;