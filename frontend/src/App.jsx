import { useEffect, useState } from "react";
import ThreatChart from "./components/ThreatChart";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import StatCard from "./components/StatCard";
import RecentAlerts from "./components/RecentAlerts";
import RecentLogs from "./components/RecentLogs";
import { getDashboardStats } from "./services/api";

import {
    Database,
    TriangleAlert,
    ShieldAlert,
    Shield,
} from "lucide-react";

function App() {
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
    <div className="flex bg-slate-950 text-white min-h-screen">
      <Sidebar />

      <main className="flex-1 p-8">

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
        <RecentLogs />

      </main>
    </div>
  );
}

export default App;