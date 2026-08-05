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

const navItems = [
    {
        to: "/",
        label: "Dashboard",
        icon: LayoutDashboard,
        iconColor: "text-cyan-400",
    },
    {
        to: "/scanner",
        label: "Scanner",
        icon: Scan,
        iconColor: "text-blue-400",
    },
    {
        to: "/websites",
        label: "Websites",
        icon: Globe,
        iconColor: "text-emerald-400",
    },
    {
        to: "/alerts",
        label: "Alerts",
        icon: TriangleAlert,
        iconColor: "text-orange-400",
    },
    {
        to: "/analytics",
        label: "Analytics",
        icon: ChartColumn,
        iconColor: "text-purple-400",
    },
    {
        to: "/settings",
        label: "Settings",
        icon: Settings,
        iconColor: "text-slate-400",
    },
];

function Sidebar() {
    return (
            <aside className="w-80 h-screen flex-shrink-0 bg-slate-950/85 backdrop-blur-xl border-r border-slate-800/60 shadow-2xl shadow-black/50 flex flex-col">
            <div className="p-8 pb-6 border-b border-slate-800/60">

                <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight">
                    <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.45)] ring-1 ring-cyan-400/20">
                        <Shield size={24} className="text-white" />
                    </span>

                    <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        Sentinel AI
                    </span>
                </h1>

                <div className="flex items-center gap-2 mt-3">
                    <p className="text-slate-400 text-xs font-medium">
                        Threat Monitoring Platform
                    </p>

                    <span className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-bold tracking-widest animate-pulse">
                        LIVE
                    </span>
                </div>

            </div>

            <nav className="flex-1 p-5 space-y-1.5 overflow-y-auto">

                <p className="px-4 pb-2 text-[10px] font-bold tracking-[0.2em] text-slate-500">
                    NAVIGATION
                </p>

                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === "/"}
                        className={({ isActive }) =>
                            `relative w-full flex items-center gap-3 text-left px-4 py-3 rounded-xl transition-all duration-300 ${
                                isActive
                                    ? "bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white shadow-[0_0_25px_rgba(59,130,246,0.45)] scale-[1.03] border border-cyan-400/30"
                                    : "text-slate-400 hover:text-white hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-purple-500/10"
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                {isActive && (
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b from-cyan-400 to-blue-500 shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
                                )}

                                <item.icon
                                    size={20}
                                    className={isActive ? "text-white" : item.iconColor}
                                />

                                <span className="font-medium text-sm tracking-wide">
                                    {item.label}
                                </span>
                            </>
                        )}
                    </NavLink>
                ))}

            </nav>

            <div className="p-5 border-t border-slate-800/60">

                <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4 shadow-inner shadow-black/20">

                    <p className="text-[10px] font-bold tracking-[0.2em] text-slate-500 mb-3">
                        SYSTEM STATUS
                    </p>

                    <div className="space-y-2.5">

                        <div className="flex items-center gap-2.5 text-xs">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(74,222,128,1)]" />
                            <span className="text-slate-300">Backend Online</span>
                        </div>

                        <div className="flex items-center gap-2.5 text-xs">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(74,222,128,1)]" />
                            <span className="text-slate-300">Scanner Ready</span>
                        </div>

                        <div className="flex items-center gap-2.5 text-xs">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(74,222,128,1)]" />
                            <span className="text-slate-300">Database Connected</span>
                        </div>

                    </div>

                </div>

            </div>

        </aside>
    );
}

export default Sidebar;
