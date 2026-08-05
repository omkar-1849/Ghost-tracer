import { useEffect, useRef, useState } from "react";
import { Globe, Activity, PowerOff, ShieldCheck, HeartPulse, AlertTriangle, AlertCircle, Eye } from "lucide-react";

/** Animated count-up for KPI values (integers only). ~500ms, subtle ease-out. */
function CountUp({ value }) {
    const [display, setDisplay] = useState(0);
    const frameRef = useRef(null);

    useEffect(() => {
        const duration = 500;
        const start = performance.now();
        const tick = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            // ease-out cubic
            setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
            if (progress < 1) frameRef.current = requestAnimationFrame(tick);
        };
        frameRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameRef.current);
    }, [value]);

    return <>{display}</>;
}

export default function WebsiteStats({ websites }) {
    const total = websites.length;
    const active = websites.filter(w => w.status === "Active").length;
    const inactive = websites.filter(w => w.status === "Inactive").length;
    const monitoring = websites.filter(w => w.monitoringEnabled).length;

    const scores = websites.filter(w => w.securityScore !== null).map(w => w.securityScore);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    const healthy = websites.filter(w => w.health === "Healthy").length;
    const warning = websites.filter(w => w.health === "Warning").length;
    const critical = websites.filter(w => w.health === "Critical").length;

    const cards = [
        { label: "Total Websites", value: total, icon: Globe, color: "text-blue-400", chip: "bg-blue-500/10 border-blue-500/20", glow: "hover:shadow-blue-500/10" },
        { label: "Active", value: active, icon: Activity, color: "text-emerald-400", chip: "bg-emerald-500/10 border-emerald-500/20", glow: "hover:shadow-emerald-500/10" },
        { label: "Inactive", value: inactive, icon: PowerOff, color: "text-slate-400", chip: "bg-slate-500/10 border-slate-500/20", glow: "hover:shadow-slate-500/10" },
        { label: "Monitoring", value: monitoring, icon: Eye, color: "text-cyan-400", chip: "bg-cyan-500/10 border-cyan-500/20", glow: "hover:shadow-cyan-500/10" },
        { label: "Avg Score", value: avgScore || "N/A", icon: ShieldCheck, color: "text-purple-400", chip: "bg-purple-500/10 border-purple-500/20", glow: "hover:shadow-purple-500/10" },
        { label: "Healthy", value: healthy, icon: HeartPulse, color: "text-emerald-400", chip: "bg-emerald-500/10 border-emerald-500/20", glow: "hover:shadow-emerald-500/10" },
        { label: "Warning", value: warning, icon: AlertTriangle, color: "text-amber-400", chip: "bg-amber-500/10 border-amber-500/20", glow: "hover:shadow-amber-500/10" },
        { label: "Critical", value: critical, icon: AlertCircle, color: "text-red-400", chip: "bg-red-500/10 border-red-500/20", glow: "hover:shadow-red-500/10" },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4 mb-8">
            {cards.map((card, idx) => (
                <div
                    key={card.label}
                    style={{ animationDelay: `${idx * 40}ms` }}
                    className={`group relative p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-center backdrop-blur-xl overflow-hidden
                        transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800/70 hover:border-slate-600/70 hover:shadow-xl ${card.glow}
                        animate-fade-in-up`}
                >
                    {/* Top accent gradient line */}
                    <span className={`absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-slate-600/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200`} />

                    <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase pt-0.5">{card.label}</span>
                        <div className={`p-1.5 rounded-lg border ${card.chip} transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3`}>
                            <card.icon size={14} className={card.color} />
                        </div>
                    </div>
                    <span className={`text-2xl font-extrabold tracking-tight ${card.color} drop-shadow-md tabular-nums`}>
                        {typeof card.value === "number" ? <CountUp value={card.value} /> : card.value}
                    </span>
                </div>
            ))}
        </div>
    );
}
