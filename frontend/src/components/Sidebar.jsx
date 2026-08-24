import {
    LayoutDashboard,
    ChartColumn,
    Settings,
    ShieldAlert,
    Radar,
    Globe,
} from "lucide-react";

import { NavLink } from "react-router-dom";
import LiveDot from "./ui/LiveDot";

/* Brand mark — echoes the favicon: jade shield, brass sentinel eye */
function BrandMark({ size = 30 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect width="48" height="48" rx="10" fill="#1b2120" />
            <path
                d="M24 7.5l12.5 4.7v10.5c0 8.2-5.3 15.1-12.5 17.9-7.2-2.8-12.5-9.7-12.5-17.9V12.2L24 7.5z"
                fill="#45a583"
            />
            <path
                d="M24 14.5l7.4 2.8v6.3c0 4.9-3.1 9-7.4 10.6-4.3-1.6-7.4-5.7-7.4-10.6v-6.3l7.4-2.8z"
                fill="#0b0e0d"
            />
            <circle cx="24" cy="22.4" r="2.7" fill="#c9a961" />
            <path d="M23 24.5h2l1 5.2h-4l1-5.2z" fill="#c9a961" />
        </svg>
    );
}

const navGroups = [
    {
        label: "Monitor",
        items: [
            { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
            { to: "/alerts", label: "Incident Center", icon: ShieldAlert },
        ],
    },
    {
        label: "Operations",
        items: [
            { to: "/scanner", label: "Scanner", icon: Radar },
            { to: "/websites", label: "Assets", icon: Globe },
            { to: "/analytics", label: "Analytics", icon: ChartColumn },
        ],
    },
    {
        label: "System",
        items: [{ to: "/settings", label: "Settings", icon: Settings }],
    },
];

function Sidebar() {
    return (
        <aside className="w-60 h-screen flex-shrink-0 bg-[var(--color-surface-1)] border-r border-[var(--color-border-subtle)] flex flex-col">
            {/* Brand */}
            <div className="px-4 py-4 border-b border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-3">
                    <BrandMark />
                    <div className="min-w-0">
                        <h1 className="text-[15px] font-bold tracking-tight text-[var(--color-text-primary)] leading-none">
                            Sentinel <span className="text-[var(--color-signal)]">AI</span>
                        </h1>
                        <p className="text-[10px] font-medium tracking-[0.08em] uppercase text-[var(--color-text-muted)] mt-1">
                            Security Operations
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto custom-scrollbar">
                {navGroups.map((group) => (
                    <div key={group.label}>
                        <p className="section-label px-3 pb-2">{group.label}</p>
                        <div className="space-y-0.5">
                            {group.items.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.end}
                                    className={({ isActive }) =>
                                        `relative w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-md text-[13px] transition-colors duration-150 ${
                                            isActive
                                                ? "bg-[var(--color-signal-subtle)] text-[var(--color-text-primary)] font-semibold"
                                                : "font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
                                        }`
                                    }
                                >
                                    {({ isActive }) => (
                                        <>
                                            {isActive && (
                                                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[var(--color-signal)]" />
                                            )}

                                            <item.icon
                                                size={17}
                                                strokeWidth={isActive ? 2.2 : 1.8}
                                                className={
                                                    isActive
                                                        ? "text-[var(--color-signal)]"
                                                        : "text-[var(--color-text-muted)]"
                                                }
                                            />

                                            <span>{item.label}</span>
                                        </>
                                    )}
                                </NavLink>
                            ))}
                        </div>
                    </div>
                ))}
            </nav>

            {/* System status */}
            <div className="px-3 pb-3">
                <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)] px-3 py-3">
                    <div className="flex items-center justify-between mb-2.5">
                        <p className="section-label">System</p>
                        <span className="inline-flex items-center gap-1.5 text-[9px] font-bold tracking-[0.1em] text-[var(--color-success)]">
                            <LiveDot color="var(--color-success)" size={5} />
                            LIVE
                        </span>
                    </div>

                    <div className="space-y-1.5">
                        {[
                            ["Backend", "Online"],
                            ["Scanner", "Ready"],
                            ["Database", "Connected"],
                        ].map(([label, state]) => (
                            <div
                                key={label}
                                className="flex items-center justify-between text-[11px]"
                            >
                                <span className="text-[var(--color-text-muted)]">{label}</span>
                                <span className="inline-flex items-center gap-1.5 text-[var(--color-text-secondary)] font-medium">
                                    <LiveDot color="var(--color-success)" size={5} />
                                    {state}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="mono-value text-[10px] text-[var(--color-text-disabled)] px-1 pt-2.5 text-center">
                    v2.4.0 · #8942a1b
                </p>
            </div>
        </aside>
    );
}

export default Sidebar;
