import { SCANNER_ENGINES } from "./constants";
import { Radar, Scan, Shield } from "lucide-react";

export default function ScannerTabs({ activeTab, onTabChange }) {
    return (
        <div className="flex items-center gap-1 mb-8 border-b border-slate-800/60 overflow-x-auto scrollbar-none">
            {SCANNER_ENGINES.map((engine) => {
                const isActive = activeTab === engine.id;
                
                return (
                    <button
                        key={engine.id}
                        onClick={() => onTabChange(engine.id)}
                        className={`group relative px-4 py-3 flex items-center gap-2 font-medium text-[13px] transition-all duration-200 whitespace-nowrap focus:outline-none ${
                            isActive
                                ? "text-white"
                                : "text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        {!engine.isEngine ? (
                            <Radar size={15} className={`transition-colors duration-200 ${isActive ? "text-purple-400" : "text-slate-500 group-hover:text-slate-400"}`} />
                        ) : engine.status === "Ready" ? (
                            <Scan size={15} className={`transition-colors duration-200 ${isActive ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-400"}`} />
                        ) : (
                            <Shield size={15} className={`transition-colors duration-200 ${isActive ? "text-slate-300" : "text-slate-600 group-hover:text-slate-500"}`} />
                        )}
                        
                        <span className={isActive ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" : ""}>
                            {engine.name}
                        </span>
                        
                        {engine.status !== "Ready" && !isActive && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-sm bg-slate-800/80 text-slate-500 text-[9px] font-bold tracking-widest uppercase">
                                {engine.status === "Coming Soon" ? "Soon" : "Plan"}
                            </span>
                        )}

                        {/* Active Indicator Line */}
                        {isActive && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-cyan-400 to-purple-500 shadow-[0_-2px_10px_rgba(34,211,238,0.5)]" />
                        )}
                        
                        {/* Subtle hover background (doesn't extend full height) */}
                        <div className={`absolute inset-x-1 inset-y-1 rounded-lg -z-10 transition-colors duration-200 ${isActive ? "bg-slate-800/40" : "group-hover:bg-slate-800/30"}`} />
                    </button>
                );
            })}
        </div>
    );
}
