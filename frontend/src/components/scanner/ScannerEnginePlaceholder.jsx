import { Shield, Sparkles, Box, Lock, Cpu, Globe, Info, Activity } from "lucide-react";
import { EngineStatusBadge } from "./shared";

export default function ScannerEnginePlaceholder({ engine }) {
    if (!engine) return null;

    const renderIcon = (size = 48) => {
        switch(engine.id) {
            case "nmap": return <Globe className="text-blue-400" size={size} />;
            case "nikto": return <Box className="text-amber-400" size={size} />;
            case "nuclei": return <Sparkles className="text-emerald-400" size={size} />;
            case "owasp-zap": return <Cpu className="text-rose-400" size={size} />;
            case "ssl-analyzer": return <Lock className="text-cyan-400" size={size} />;
            default: return <Shield className="text-slate-400" size={size} />;
        }
    };

    return (
        <div style={{ animation: "section-in 0.45s ease-out both" }} className="space-y-8">
            
            {/* Scanner Introduction Header */}
            <div className="flex items-start gap-5 bg-slate-900/40 backdrop-blur-sm border border-slate-800/40 rounded-2xl p-6">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-[0_0_15px_rgba(0,0,0,0.5)] flex items-center justify-center border border-slate-700/50 shrink-0">
                    {renderIcon(28)}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-2xl font-bold text-white">{engine.name}</h2>
                        <EngineStatusBadge status={engine.status} />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-2">{engine.description}</h3>
                    <p className="text-slate-400 text-sm max-w-3xl">
                        This module is currently in development and will be available in a future update to the Sentinel AI platform. Our engineering team is building this scanner to integrate natively with our unified dashboard.
                    </p>
                </div>
            </div>

            {/* Placeholder Body */}
            <div className="relative bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-10 shadow-lg shadow-black/40 overflow-hidden flex flex-col items-center text-center">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-800/20 via-transparent to-transparent" />
                
                <div className="relative z-10 w-20 h-20 mb-6 rounded-3xl bg-slate-950 shadow-xl flex items-center justify-center border border-slate-800/80">
                    {renderIcon(40)}
                </div>
                
                <h3 className="relative z-10 text-xl font-bold text-white mb-2">
                    {engine.status === "Planned" ? "Future Roadmap" : "Coming Soon"}
                </h3>
                
                <p className="relative z-10 text-slate-400 max-w-md mx-auto mb-8">
                    We're preparing the {engine.name} engine. It will unlock the following capabilities when released:
                </p>

                <div className="relative z-10 w-full max-w-lg bg-slate-950/50 border border-slate-800/80 rounded-xl p-6 text-left">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Activity size={14} /> Planned Capabilities
                    </h4>
                    <ul className="space-y-4">
                        {engine.capabilities?.map((cap, i) => (
                            <li key={i} className="flex items-start gap-3">
                                <Sparkles className="text-purple-400 mt-0.5 flex-shrink-0" size={16} />
                                <span className="text-slate-300 text-sm">{cap}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="relative z-10 mt-8">
                    <button className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-600 rounded-xl px-6 py-2.5 text-sm font-medium transition-all duration-200 shadow-lg">
                        View Documentation
                    </button>
                </div>
            </div>
        </div>
    );
}
