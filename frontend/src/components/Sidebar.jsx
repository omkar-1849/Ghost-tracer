import {
    LayoutDashboard,
    TriangleAlert,
    ChartColumn,
    Settings,
    Shield,
    Scan,
    Globe,
} from "lucide-react";

import { NavLink } from "react-router-dom";
import LiveDot from "./ui/LiveDot";

const navItems = [
    {
        to: "/",
        label: "Dashboard",
        icon: LayoutDashboard,
    },
    {
        to: "/scanner",
        label: "Scanner",
        icon: Scan,
    },
    {
        to: "/websites",
        label: "Websites",
        icon: Globe,
    },
    {
        to: "/alerts",
        label: "Alerts",
        icon: TriangleAlert,
    },
    {
        to: "/analytics",
        label: "Analytics",
        icon: ChartColumn,
    },
    {
        to: "/settings",
        label: "Settings",
        icon: Settings,
    },
];

function Sidebar() {
    return (
        <aside className="w-60 h-screen flex-shrink-0 bg-[var(--color-surface-1)] border-r border-[var(--color-border-subtle)] flex flex-col">
            {/* Brand */}
            <div className="px-5 py-5 border-b border-[var(--color-border-subtle)]">
                <h1 className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-[var(--color-text-primary)]">
                    <span className="w-8 h-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center">
                        <Shield size={16} className="text-white" />
                    </span>
                    Sentinel AI
                </h1>
                <div className="flex items-center gap-2 mt-2">
                    <p className="text-[var(--color-text-muted)] text-[11px] font-medium">
                        Security Operations
                    </p>
                    <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider text-[var(--color-success)] bg-[rgba(63,163,77,0.10)] border border-[rgba(63,163,77,0.20)]">
                        <LiveDot color="var(--color-success)" size={5} />
                        LIVE
                    </span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.12em] text-[var(--color-text-disabled)] uppercase">
                    Navigation
                </p>

                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === "/"}
                        className={({ isActive }) =>
                            `relative w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-md text-[13px] font-medium transition-colors duration-150 ${
                                isActive
                                    ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"
                                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                {isActive && (
                                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[var(--color-accent)]" />
                                )}

                                <item.icon size={18} />

                                <span>{item.label}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* System Status */}
            <div className="px-3 pb-4">
                <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-subtle)] rounded-md px-3 py-3">
                    <p className="text-[10px] font-semibold tracking-[0.12em] text-[var(--color-text-disabled)] uppercase mb-2.5">
                        System Status
                    </p>

                    <div className="space-y-2">
                        {["Backend Online", "Scanner Ready", "Database Connected"].map(
                            (label) => (
                                <div key={label} className="flex items-center gap-2 text-xs">
                                    <LiveDot color="var(--color-success)" size={6} />
                                    <span className="text-[var(--color-text-secondary)]">
                                        {label}
                                    </span>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
        </aside>
    );
}

export default Sidebar;
