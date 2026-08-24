import { useState, useEffect, useRef } from "react";
import { Search, Bell, User, LogOut, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { logout } from "../services/authClient";
import LiveDot from "./ui/LiveDot";

function Navbar({ title = "Dashboard", subtitle = "Security Operations Overview" }) {
    const navigate = useNavigate();
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const menuRef = useRef(null);
    const notifRef = useRef(null);

    // Close menus on outside click
    useEffect(() => {
        function handleClickOutside(e) {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setUserMenuOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setNotificationsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const handleSearchSubmit = (e) => {
        if (e.key === "Enter" && searchQuery.trim()) {
            navigate(`/activity?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    return (
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-8 py-3.5 bg-[var(--color-canvas)]/80 backdrop-blur-md border-b border-[var(--color-border-subtle)] select-none">
            {/* Left / Center: Global Search Bar matching reference image */}
            <div className="flex-1 max-w-xl">
                <div className="relative">
                    <Search
                        size={15}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
                    />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchSubmit}
                        placeholder="Search threats, assets, logs, IP addresses..."
                        className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg pl-10 pr-12 py-2 text-[13px] text-white placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[rgba(255,255,255,0.4)] focus:shadow-[0_0_12px_rgba(255,255,255,0.06)] transition-all duration-150"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[var(--color-text-disabled)] border border-[var(--color-border-subtle)] px-1.5 py-0.5 rounded bg-[var(--color-surface-inset)]">
                        ⌘K
                    </span>
                </div>
            </div>

            {/* Right: Telemetry Badge + Notifications + User Avatar */}
            <div className="flex items-center gap-3">
                {/* System Status Pill matching reference image */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border-default)] text-[12px] font-medium text-white shadow-sm">
                    <LiveDot color="var(--color-success)" size={6} />
                    <span>System: <span className="text-[var(--color-success)]">Secure</span></span>
                </div>

                {/* Notifications Bell */}
                <div className="relative" ref={notifRef}>
                    <button
                        type="button"
                        onClick={() => setNotificationsOpen(!notificationsOpen)}
                        className="relative p-2 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-border-strong)] transition-all duration-150"
                        aria-label="Notifications"
                    >
                        <Bell size={16} />
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--color-critical)] ring-2 ring-[var(--color-canvas)]" />
                    </button>

                    {notificationsOpen && (
                        <div className="absolute right-0 mt-2 w-80 rounded-xl bg-[var(--color-surface-3)] border border-[var(--color-border-default)] shadow-[var(--shadow-modal)] p-3 text-[12.5px] z-50 animate-fade-in">
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--color-border-subtle)]">
                                <span className="font-semibold text-white">Live SOC Alerts</span>
                                <span className="text-[11px] text-[var(--color-text-muted)]">Real-time</span>
                            </div>
                            <div className="space-y-2">
                                <div className="p-2 rounded-lg bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)]">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-white text-[12px]">Firewall Intercept</span>
                                        <span className="text-[10px] text-[var(--color-critical)] font-mono">CRITICAL</span>
                                    </div>
                                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Brute force SSH attempt blocked from 192.168.1.101</p>
                                </div>
                                <div className="p-2 rounded-lg bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)]">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-white text-[12px]">Vulnerability Scan</span>
                                        <span className="text-[10px] text-[var(--color-success)] font-mono">COMPLETE</span>
                                    </div>
                                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1">SSL & Nmap scan finished for monitored endpoints</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* User Profile Avatar with Dropdown */}
                <div className="relative" ref={menuRef}>
                    <button
                        type="button"
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                        className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] transition-all duration-150"
                    >
                        <div className="w-7 h-7 rounded-md bg-[var(--color-surface-3)] border border-[rgba(255,255,255,0.12)] flex items-center justify-center text-white">
                            <User size={14} />
                        </div>
                        <span className="text-[12.5px] font-medium text-white hidden md:inline">Admin</span>
                    </button>

                    {userMenuOpen && (
                        <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[var(--color-surface-3)] border border-[var(--color-border-default)] shadow-[var(--shadow-modal)] py-1 text-[12.5px] z-50 animate-fade-in">
                            <div className="px-3 py-2 border-b border-[var(--color-border-subtle)]">
                                <p className="font-semibold text-white">Admin Analyst</p>
                                <p className="text-[11px] text-[var(--color-text-muted)] truncate">admin@sentinel.local</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setUserMenuOpen(false); navigate("/settings"); }}
                                className="w-full text-left px-3 py-2 text-[var(--color-text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.06)]"
                            >
                                Settings & Profile
                            </button>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="w-full flex items-center gap-2 px-3 py-2 text-[var(--color-critical)] hover:bg-[rgba(230,57,70,0.1)] border-t border-[var(--color-border-subtle)]"
                            >
                                <LogOut size={13} />
                                <span>Sign out</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

export default Navbar;
