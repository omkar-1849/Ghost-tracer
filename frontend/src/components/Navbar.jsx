import { useState, useEffect, useRef } from "react";
import { Search, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getRecentAlerts, getLiveFeed } from "../services/api";
import "../pages/Dashboard.css";

function formatNotificationTime(ts) {
    if (!ts) return "Just now";
    try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return String(ts);
        const now = new Date();
        const diffSec = Math.floor((now - d) / 1000);
        if (diffSec < 60) return "Just now";
        if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
        if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
        return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}`;
    } catch {
        return "Recent";
    }
}

function Navbar() {
    const navigate = useNavigate();
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const notifRef = useRef(null);

    // Fetch live notifications from backend alerts / live feed
    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const alerts = await getRecentAlerts();
            if (Array.isArray(alerts) && alerts.length > 0) {
                setNotifications(alerts);
            } else {
                const live = await getLiveFeed().catch(() => []);
                if (Array.isArray(live) && live.length > 0) {
                    setNotifications(live.map((item, idx) => ({
                        id: `live-${idx}`,
                        threat_level: item.threat_level,
                        message: item.reason || "Security event detected",
                        ip_address: item.ip_address,
                        created_at: item.timestamp,
                    })));
                } else {
                    setNotifications([]);
                }
            }
        } catch (err) {
            console.error("Failed to load notifications", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 15000);
        return () => clearInterval(interval);
    }, []);

    // Close notifications menu on outside click or escape key
    useEffect(() => {
        function handleClickOutside(e) {
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setNotificationsOpen(false);
            }
        }
        function handleKeyDown(e) {
            if (e.key === "Escape") {
                setNotificationsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    const handleSearchSubmit = (e) => {
        if (e.key === "Enter" && searchQuery.trim()) {
            navigate(`/activity?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    return (
        <header className="sticky top-0 z-40 w-full h-0 pointer-events-none select-none">
            {/* Floating Glass Search Control Island */}
            <div className="search-island sentinel-glass pointer-events-auto">
                <Search size={18} color="#D6CFC7" className="shrink-0 mr-3 pointer-events-none" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchSubmit}
                    placeholder="Search threats, assets, logs, IP addresses..."
                    className="flex-1 bg-transparent border-0 outline-none text-[#F5F1EC] text-[14px] placeholder:text-[#A9A199] font-sans shadow-none focus:outline-none focus:ring-0 focus:border-0"
                    style={{
                        outline: 'none',
                        border: 'none',
                        boxShadow: 'none',
                        background: 'transparent'
                    }}
                />
                <span
                    className="ml-2 px-2 py-0.5 text-[11px] font-mono text-[#A9A199] shrink-0"
                    style={{
                        borderRadius: '8px',
                        background: 'rgba(255,248,238,0.045)',
                        border: '1px solid rgba(255,248,238,0.08)'
                    }}
                >
                    ⌘K
                </span>
            </div>

            {/* Standalone Stationary Floating Glass Notification Control */}
            <div
                className="pointer-events-auto"
                ref={notifRef}
                style={{
                    position: 'absolute',
                    top: '14px',
                    right: '24px',
                    width: '46px',
                    height: '46px',
                    zIndex: 41
                }}
            >
                <button
                    type="button"
                    onClick={() => {
                        const next = !notificationsOpen;
                        setNotificationsOpen(next);
                        if (next) fetchNotifications();
                    }}
                    className="sentinel-glass notification-bell-btn relative focus:outline-none"
                    aria-label="Notifications"
                    style={{
                        width: '46px',
                        height: '46px',
                        position: 'relative',
                        transform: 'none',
                        margin: 0,
                        padding: 0
                    }}
                >
                    <Bell size={18} color="#D6CFC7" />
                    {notifications.length > 0 && (
                        <span
                            style={{
                                position: 'absolute',
                                top: '11px',
                                right: '11px',
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: '#E67868'
                            }}
                        />
                    )}
                </button>

                {notificationsOpen && (
                    <div
                        className="sentinel-glass"
                        style={{
                            position: 'absolute',
                            top: '56px',
                            right: 0,
                            width: '340px',
                            borderRadius: '16px',
                            padding: '16px',
                            boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.65), 0 8px 24px -4px rgba(0, 0, 0, 0.45)',
                            zIndex: 50,
                            color: '#A9A199',
                            fontSize: '12.5px',
                            maxHeight: '480px',
                            overflowY: 'auto'
                        }}
                    >
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[rgba(245,241,236,0.075)]">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-[#F5F1EC] text-[13px]">Notifications</span>
                                {notifications.length > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[rgba(230,120,104,0.14)] text-[#E67868]">
                                        {notifications.length}
                                    </span>
                                )}
                            </div>
                            <span className="text-[11px] text-[#8B837B]">
                                {loading ? "Checking…" : notifications.length > 0 ? "Live Stream" : "Up to date"}
                            </span>
                        </div>

                        {loading && notifications.length === 0 ? (
                            <div className="py-6 text-center text-[#A9A199] text-[12px]">
                                Loading security events…
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="py-5 text-center">
                                <p className="text-[13px] text-[#F5F1EC] font-medium mb-1">
                                    No new security notifications.
                                </p>
                                <p className="text-[11.5px] text-[#8B837B]">
                                    All monitored systems reporting nominal status.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-0.5">
                                {notifications.slice(0, 5).map((item, idx) => {
                                    const severity = (item.threat_level || item.threatLevel || "RECORDED").toUpperCase();
                                    const title = item.message || "Security threat detected";
                                    const ip = item.ip_address || item.ipAddress || null;
                                    const ts = item.created_at || item.timestamp;
                                    const badgeClass = severity === "CRITICAL"
                                        ? "text-[#E67868] bg-[rgba(230,120,104,0.12)] border-[rgba(230,120,104,0.22)]"
                                        : severity === "HIGH"
                                            ? "text-[#D3A06A] bg-[rgba(211,160,106,0.12)] border-[rgba(211,160,106,0.20)]"
                                            : "text-[#A9A199] bg-[rgba(169,161,153,0.08)] border-[rgba(169,161,153,0.14)]";

                                    return (
                                        <div
                                            key={item.id || idx}
                                            className="p-2.5 rounded-lg bg-[rgba(255,248,238,0.02)] border border-[rgba(245,241,236,0.06)] hover:bg-[rgba(211,160,106,0.04)] transition-colors"
                                        >
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeClass}`}>
                                                    {severity}
                                                </span>
                                                <span className="text-[10.5px] font-mono text-[#8B837B]">
                                                    {formatNotificationTime(ts)}
                                                </span>
                                            </div>
                                            <p className="text-[12.5px] font-medium text-[#F5F1EC] leading-tight line-clamp-2">
                                                {title}
                                            </p>
                                            {ip && (
                                                <p className="text-[11px] font-mono text-[#D6CFC7] mt-1">
                                                    Origin: {ip}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="pt-3 mt-3 border-t border-[rgba(245,241,236,0.06)] flex justify-between items-center text-[11.5px]">
                            <span className="text-[#8B837B]">Sentinel Security Stream</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setNotificationsOpen(false);
                                    navigate("/alerts");
                                }}
                                className="text-[#D3A06A] hover:text-[#E3B985] font-medium transition-colors"
                            >
                                View all alerts →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
}

export default Navbar;
