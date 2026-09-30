import { useEffect, useState } from "react";
import SecurityScore from "../components/SecurityScore";
import ThreatChart from "../components/ThreatChart";
import LiveAttackFeed from "../components/LiveAttackFeed";
import { getDashboardStats } from "../services/api";
import { getWebsites } from "../services/websiteApi";
import { getAllScans } from "../services/scannerApi";
import "./Dashboard.css";

function PageClock() {
    const [date, setDate] = useState(new Date());

    useEffect(() => {
        // Calculate milliseconds until next minute
        const now = new Date();
        const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

        let timeout;
        let interval;

        timeout = setTimeout(() => {
            setDate(new Date());
            interval = setInterval(() => {
                setDate(new Date());
            }, 60000);
        }, msUntilNextMinute);

        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
        };
    }, []);

    const dateFormatter = new Intl.DateTimeFormat(navigator.language, {
        weekday: 'long',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

    const timeFormatter = new Intl.DateTimeFormat(navigator.language, {
        hour: 'numeric',
        minute: '2-digit'
    });

    return (
        <div className="page-clock">
            <span className="date">{dateFormatter.format(date)}</span>
            <span className="time">{timeFormatter.format(date)}</span>
        </div>
    );
}

function Dashboard() {
    const [stats, setStats] = useState(null);
    const [websiteCount, setWebsiteCount] = useState(null);
    const [scanCount, setScanCount] = useState(null);
    const [loadError, setLoadError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        async function fetchDashboardData() {
            try {
                const [statsData, websites, scans] = await Promise.allSettled([
                    getDashboardStats(),
                    getWebsites(),
                    getAllScans(),
                ]);

                if (isMounted) {
                    setStats(statsData.status === "fulfilled" ? statsData.value : null);
                    setWebsiteCount(websites.status === "fulfilled" && Array.isArray(websites.value) ? websites.value.length : null);
                    setScanCount(scans.status === "fulfilled" && Array.isArray(scans.value) ? scans.value.filter((scan) => String(scan.status).toUpperCase() === "COMPLETED").length : null);
                    setLoadError([statsData, websites, scans].some((result) => result.status === "rejected") ? "Some dashboard data is unavailable. Counts shown as — are unknown." : "");
                }
            } catch (err) {
                console.error("Dashboard data load error", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 10000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const formatMetric = (val) => {
        if (loading) return "--";
        if (val === null || val === undefined) return "—";
        return val;
    };

    return (
        <div className="dashboard-viewport">
            <div className="dashboard-page">
                {/* Band 1: Command/Header */}
                <header className="dashboard-header">
                    <div className="header-left">
                        <h1>Dashboard</h1>
                        <p className="subtitle">Recorded activity from the configured organization.</p>
                    </div>
                    <div className="header-right">
                        <PageClock />
                    </div>
                </header>

                {loadError && (
                    <div className="aggregate-error" role="alert">
                        {loadError}
                    </div>
                )}

                {/* Band 2: Posture and Metrics - One Single Continuous Glass Surface */}
                <section className="posture-band sentinel-glass">
                    <div className="posture-score-cell">
                        <SecurityScore />
                    </div>
                    <div className="metric-cell">
                        <span className="metric-label">Total Websites</span>
                        <span className="metric-value">{formatMetric(websiteCount)}</span>
                        <span className="metric-description">Registered Domains</span>
                    </div>
                    <div className="metric-cell">
                        <span className="metric-label">Total Alerts</span>
                        <span className="metric-value">{formatMetric(stats?.total_alerts)}</span>
                        <span className="metric-description">Recorded Detections</span>
                    </div>
                    <div className="metric-cell">
                        <span className="metric-label">Completed Scans</span>
                        <span className="metric-value">{formatMetric(scanCount)}</span>
                        <span className="metric-description">Completed status records</span>
                    </div>
                    <div className="metric-cell">
                        <span className="metric-label">Critical Alerts</span>
                        <span className="metric-value critical">{formatMetric(stats?.critical_alerts)}</span>
                        <span className="metric-description">Recorded Critical Detections</span>
                    </div>
                </section>

                {/* Band 3: Monitoring */}
                <section className="monitoring-band">
                    <div className="monitoring-section sentinel-glass threat-chart-container">
                        <ThreatChart />
                    </div>
                    <div className="monitoring-section sentinel-glass live-feed-container">
                        <LiveAttackFeed />
                    </div>
                </section>
            </div>
        </div>
    );
}

export default Dashboard;
