import { useEffect } from "react";
import {
    X, ExternalLink, Globe, Calendar, User, Server, HeartPulse,
    ShieldCheck, ActivitySquare, Database, Terminal, Eye, EyeOff, Pencil,
} from "lucide-react";

const HEALTH_STYLES = {
    Healthy: { text: "text-emerald-400", chip: "bg-emerald-500/10 border-emerald-500/30", dot: "bg-emerald-400", glow: "shadow-[0_0_10px_rgba(16,185,129,0.2)]" },
    Warning: { text: "text-amber-400", chip: "bg-amber-500/10 border-amber-500/30", dot: "bg-amber-400", glow: "shadow-[0_0_10px_rgba(251,191,36,0.2)]" },
    Critical: { text: "text-red-400", chip: "bg-red-500/10 border-red-500/30", dot: "bg-red-500", glow: "shadow-[0_0_10px_rgba(248,113,113,0.25)]" },
    Unknown: { text: "text-slate-400", chip: "bg-slate-500/10 border-slate-500/30", dot: "bg-slate-500", glow: "" },
};

const InfoCard = ({ icon: Icon, label, value, accent = "text-slate-400", chipClass = "bg-slate-800/80" }) => (
    <div className="bg-slate-900/70 border border-slate-800/80 p-3.5 rounded-xl flex items-center gap-3 transition-all duration-150 hover:border-slate-700 hover:bg-slate-900">
        <div className={`p-2 rounded-lg border ${chipClass} shrink-0`}>
            <Icon size={16} className={accent} />
        </div>
        <div className="min-w-0">
            <div className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">{label}</div>
            <div className="text-sm font-semibold text-white truncate">{value}</div>
        </div>
    </div>
);

const DetailRow = ({ icon: Icon, label, value, mono = false }) => (
    <div className="flex gap-3.5 py-2.5 transition-colors duration-150">
        <div className="w-8 h-8 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-center shrink-0">
            <Icon size={14} className="text-slate-400" />
        </div>
        <div className="min-w-0">
            <div className="text-xs text-slate-500">{label}</div>
            <div className={`text-sm text-slate-200 ${mono ? "font-mono" : ""}`}>{value}</div>
        </div>
    </div>
);

export default function WebsiteDetailsDrawer({ website, onClose, onEdit }) {
    // Close on Escape
    useEffect(() => {
        if (!website) return;
        const handleKeyDown = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [website, onClose]);

    if (!website) return null;

    const tags = website.tags ? website.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    const health = HEALTH_STYLES[website.health] || HEALTH_STYLES.Unknown;
    const isActive = website.status === "Active";

    return (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={`Details for ${website.name}`}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="absolute inset-y-0 right-0 w-full max-w-md bg-slate-950/95 backdrop-blur-2xl border-l border-slate-800/80 shadow-2xl shadow-black/60 animate-drawer-in flex flex-col">
                {/* Header */}
                <div className="shrink-0 p-6 border-b border-slate-800/80 bg-slate-900/40">
                    <div className="flex justify-between items-start gap-3">
                        <div className="flex gap-4 items-center min-w-0">
                            {/* Favicon with gradient ring */}
                            <div className="relative shrink-0">
                                <div className={`w-13 h-13 p-0.5 rounded-2xl bg-gradient-to-br from-emerald-500/60 via-cyan-500/40 to-transparent ${health.glow}`}>
                                    <div className="w-full h-full rounded-[14px] bg-slate-800 border border-slate-700/60 flex items-center justify-center overflow-hidden">
                                        {website.faviconUrl ? (
                                            <img src={website.faviconUrl} alt="" className="w-6 h-6 object-contain" />
                                        ) : (
                                            <Globe size={22} className="text-slate-400" />
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-lg font-bold text-white leading-tight truncate">{website.name}</h2>
                                <a
                                    href={website.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mt-0.5 font-mono transition-colors duration-150"
                                >
                                    <span className="truncate">{website.domain}</span>
                                    <ExternalLink size={12} className="shrink-0" />
                                </a>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            aria-label="Close details"
                            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-full border border-slate-700/60 transition-all duration-150 hover:rotate-90 active:scale-90"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Status ribbon */}
                    <div className="flex flex-wrap items-center gap-2 mt-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${isActive ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-slate-800/60 border-slate-700/50 text-slate-400"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-400 animate-pulse-dot" : "bg-slate-500"}`} />
                            {website.status}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 border border-blue-500/30 text-blue-300">
                            <Server size={11} /> {website.environment}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${health.chip} ${health.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${health.dot} animate-pulse-dot`} />
                            {website.health}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${website.monitoringEnabled ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300" : "bg-slate-800/60 border-slate-700/50 text-slate-500"}`}>
                            {website.monitoringEnabled ? <Eye size={11} /> : <EyeOff size={11} />}
                            {website.monitoringEnabled ? "Monitoring" : "Unmonitored"}
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    {/* Overview */}
                    <section className="space-y-3">
                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <ActivitySquare size={13} className="text-emerald-400" /> Overview
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                            <InfoCard icon={ActivitySquare} label="Status" value={website.status}
                                accent={isActive ? "text-emerald-400" : "text-slate-400"}
                                chipClass={isActive ? "bg-emerald-500/10 border-emerald-500/20" : "bg-slate-800/80 border-slate-700/50"} />
                            <InfoCard icon={HeartPulse} label="Health" value={website.health}
                                accent={health.text} chipClass={`${health.chip} border`} />
                            <InfoCard icon={Server} label="Environment" value={website.environment}
                                accent="text-blue-400" chipClass="bg-blue-500/10 border-blue-500/20" />
                            <InfoCard icon={ShieldCheck} label="Security Score" value={website.securityScore ?? "N/A"}
                                accent="text-purple-400" chipClass="bg-purple-500/10 border-purple-500/20" />
                        </div>
                    </section>

                    {/* General Information */}
                    <section className="space-y-1">
                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800/80 pb-2">
                            <Database size={13} className="text-slate-400" /> General Information
                        </h4>
                        <DetailRow icon={User} label="Owner" value={website.owner || "No owner assigned"} />
                        <DetailRow icon={Database} label="IP Address" value={website.ipAddress || "Unresolved"} mono />
                        <DetailRow icon={Calendar} label="Last Scanned"
                            value={website.lastScan ? new Date(website.lastScan).toLocaleString() : "Never scanned"} />
                        {website.description && (
                            <div className="pt-2">
                                <div className="text-xs text-slate-500 mb-1.5">Description</div>
                                <p className="text-sm text-slate-300 leading-relaxed bg-slate-900/50 border border-slate-800/60 rounded-xl p-3.5">{website.description}</p>
                            </div>
                        )}
                    </section>

                    {/* Tags */}
                    {tags.length > 0 && (
                        <section>
                            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800/80 pb-2 mb-3">
                                <Globe size={13} className="text-slate-400" /> Tags
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {tags.map((tag, idx) => (
                                    <span
                                        key={idx}
                                        style={{ animationDelay: `${idx * 40}ms` }}
                                        className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/70 text-xs font-medium text-slate-300 shadow-sm transition-colors duration-150 hover:border-emerald-500/40 hover:text-white animate-fade-in-up"
                                    >
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Scan History Placeholder */}
                    <section>
                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800/80 pb-2 mb-3">
                            <Terminal size={13} className="text-slate-400" /> Scan History
                        </h4>
                        <div className="relative w-full h-32 rounded-xl bg-slate-900/60 border border-slate-800/80 border-dashed flex flex-col items-center justify-center text-slate-500 overflow-hidden group hover:border-slate-700 transition-colors duration-150">
                            <span className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-emerald-400/[0.04] to-transparent animate-scan" />
                            <Terminal size={24} className="mb-2 opacity-50 transition-transform duration-200 group-hover:scale-110" />
                            <span className="text-xs font-semibold">Future Analytics Module Integration</span>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="shrink-0 p-6 border-t border-slate-800/80 bg-slate-900/40 flex gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white rounded-xl text-sm font-semibold transition-all duration-150 active:scale-95"
                    >
                        Close
                    </button>
                    <button
                        onClick={() => onEdit(website)}
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_22px_rgba(16,185,129,0.5)] transition-all duration-150 hover:scale-[1.01] active:scale-[0.98]"
                    >
                        <Pencil size={14} />
                        Edit Website
                    </button>
                </div>
            </div>
        </div>
    );
}
