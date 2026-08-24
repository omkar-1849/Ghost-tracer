import {
    LayoutDashboard,
    Activity,
    ShieldAlert,
    TriangleAlert,
    Zap,
    Globe,
    Radar,
    FileText,
    Settings,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import LiveDot from "./ui/LiveDot";

/* Minimalist geometric brand mark */
function BrandMark({ size = 28 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#12141A" stroke="#222530" strokeWidth="1" />
            <path
                d="M16 6L24 10V17C24 22.5 20.6 25.8 16 27C11.4 25.8 8 22.5 8 17V10L16 6Z"
                stroke="#FFFFFF"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx="16" cy="16" r="2.5" fill="#FFFFFF" />
        </svg>
    );
}

const navItems = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/activity", label: "Activity", icon: Activity },
    { to: "/alerts", label: "Threats", icon: ShieldAlert },
    { to: "/incidents", label: "Incidents", icon: TriangleAlert },
    { to: "/response-actions", label: "Response", icon: Zap },
    { to: "/websites", label: "Assets", icon: Globe },
    { to: "/scanner", label: "Scanner", icon: Radar },
    { to: "/audit-logs", label: "Audit Logs", icon: FileText },
    { to: "/settings", label: "Settings", icon: Settings },
];

function Sidebar() {
    return (
        <aside className="w-60 h-screen flex-shrink-0 bg-[var(--color-surface-1)] border-r border-[var(--color-border-subtle)] flex flex-col select-none">
            {/* Brand */}
            <div className="px-5 py-4 border-b border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-3">
                    <BrandMark />
                    <div className="min-w-0">
                        <h1 className="text-[15px] font-bold tracking-tight text-white leading-none">
                            Sentinel <span className="text-[var(--color-text-muted)] font-mono text-[11px] font-normal uppercase">AI</span>
                        </h1>
                        <p className="text-[10px] font-medium tracking-[0.06em] uppercase text-[var(--color-text-muted)] mt-1">
                            SOC Security Hub
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation items */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                            `relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13.5px] transition-all duration-150 ${
                                isActive
                                    ? "bg-[rgba(255,255,255,0.08)] text-white font-medium shadow-[0_0_12px_rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)]"
                                    : "text-[var(--color-text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.04)] border border-transparent"
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon
                                    size={17}
                                    strokeWidth={isActive ? 2.2 : 1.75}
                                    className={isActive ? "text-white" : "text-[var(--color-text-muted)]"}
                                />
                                <span className="truncate font-medium">{item.label}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* System Engine Status */}
            <div className="p-3 border-t border-[var(--color-border-subtle)]">
                <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-inset)] px-3.5 py-2.5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[var(--color-text-secondary)]">Defense Grid</span>
                        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--color-success)] font-mono">
                            <LiveDot color="var(--color-success)" size={6} />
                            ARMED
                        </span>
                    </div>
                </div>
            </div>
        </aside>
    );
}

export default Sidebar;
