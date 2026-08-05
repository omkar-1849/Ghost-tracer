import { AlertTriangle, CheckCircle2, Clock, Info, Lock, Shield, Settings2, Code, XCircle } from "lucide-react";

export function StatusBadge({ status }) {
    switch (status) {
        case "Implemented":
            return (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-green-500/30 bg-green-500/10 text-[10px] font-semibold text-green-400 uppercase tracking-wider">
                    <CheckCircle2 size={10} /> Implemented
                </span>
            );
        case "Configurable":
            return (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">
                    <Settings2 size={10} /> Configurable
                </span>
            );
        case "Beta":
            return (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-purple-500/30 bg-purple-500/10 text-[10px] font-semibold text-purple-400 uppercase tracking-wider">
                    <Code size={10} /> Beta
                </span>
            );
        case "Coming Soon":
            return (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                    <Clock size={10} /> Coming Soon
                </span>
            );
        case "Disabled":
            return (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-slate-600/30 bg-slate-800/50 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    <XCircle size={10} /> Disabled
                </span>
            );
        default:
            return null;
    }
}

export function SectionHeader({ title, description, icon: Icon }) {
    return (
        <div className="mb-10 flex items-start gap-5">
            {Icon && (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(168,85,247,0.15)] mt-1">
                    <Icon size={26} className="text-purple-400" />
                </div>
            )}
            <div>
                <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight mb-2">
                    {title}
                </h2>
                {description && <p className="text-sm font-medium text-slate-400 max-w-2xl leading-relaxed">{description}</p>}
            </div>
        </div>
    );
}

export function SettingGroup({ children, className = "" }) {
    return (
        <div className={`space-y-3 ${className}`}>
            {children}
        </div>
    );
}

const CardWrapper = ({ children, disabled = false, danger = false }) => (
    <div className={`
        relative p-5 rounded-xl border flex flex-col justify-between gap-3 transition-all duration-300
        ${danger 
            ? "bg-red-950/10 border-red-900/30 hover:border-red-500/30 hover:bg-red-950/20" 
            : "bg-slate-900/40 border-slate-800/60 hover:border-slate-700/80 hover:bg-slate-900/60"
        }
        hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20
        ${disabled ? "opacity-60 cursor-not-allowed pointer-events-none grayscale-[30%]" : ""}
    `}>
        {children}
    </div>
);

const CardMeta = ({ label, description, status, danger }) => (
    <div className="w-full">
        <div className="flex items-center gap-3 mb-1.5">
            <h3 className={`text-sm font-semibold ${danger ? "text-red-400" : "text-white"} truncate`}>{label}</h3>
            {status && <StatusBadge status={status} />}
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
    </div>
);

export function ToggleCard({ label, description, status, value, onChange, disabled = false, danger = false }) {
    return (
        <CardWrapper disabled={disabled} danger={danger}>
            <CardMeta label={label} description={description} status={status} danger={danger} />
            <div className="w-full flex justify-start mt-1">
                <button 
                    type="button"
                    onClick={() => !disabled && onChange(!value)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500/30 ${
                        value ? (danger ? "bg-red-500" : "bg-purple-500") : "bg-slate-700"
                    }`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-300 ${value ? "translate-x-6" : "translate-x-1"}`} />
                </button>
            </div>
        </CardWrapper>
    );
}

export function InputCard({ label, description, status, value, onChange, placeholder, type = "text", disabled = false, masked = false, validation = null }) {
    return (
        <CardWrapper disabled={disabled}>
            <CardMeta label={label} description={description} status={status} />
            <div className="w-full relative mt-1">
                <input
                    type={masked ? "password" : type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={`w-full bg-slate-950/50 border rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:shadow-[0_0_0_1px_rgba(192,132,252,0.5),0_0_12px_rgba(168,85,247,0.15)] transition-all ${masked || validation ? "pr-10" : ""} ${
                        validation === "valid" ? "border-green-500/50 focus:border-green-500 focus:ring-green-500/20" :
                        validation === "warning" ? "border-amber-500/50 focus:border-amber-500 focus:ring-amber-500/20" :
                        validation === "error" ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20" :
                        "border-slate-700/80 focus:border-purple-500 focus:ring-purple-500/20"
                    }`}
                    disabled={disabled}
                />
                {validation === "valid" && <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 pointer-events-none" />}
                {validation === "warning" && <AlertTriangle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none" />}
                {validation === "error" && <XCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 pointer-events-none" />}
                {masked && !validation && (
                    <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                )}
            </div>
        </CardWrapper>
    );
}

export function SelectCard({ label, description, status, value, onChange, options, disabled = false }) {
    return (
        <CardWrapper disabled={disabled}>
            <CardMeta label={label} description={description} status={status} />
            <div className="w-full mt-1">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:shadow-[0_0_0_1px_rgba(192,132,252,0.5),0_0_12px_rgba(168,85,247,0.15)] transition-all appearance-none"
                    disabled={disabled}
                >
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>
        </CardWrapper>
    );
}

export function ActionCard({ label, description, status, buttonText, onClick, danger = false, disabled = false }) {
    return (
        <CardWrapper disabled={disabled} danger={danger}>
            <CardMeta label={label} description={description} status={status} danger={danger} />
            <div className="w-full flex justify-start mt-1">
                <button
                    onClick={onClick}
                    disabled={disabled}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                        danger 
                            ? "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white focus:ring-red-500" 
                            : "bg-slate-800 text-white border border-slate-700 hover:bg-slate-700 focus:ring-slate-500"
                    }`}
                >
                    {buttonText}
                </button>
            </div>
        </CardWrapper>
    );
}

export function DangerZone({ children }) {
    return (
        <div className="mt-8 relative p-6 rounded-2xl border border-red-900/50 bg-red-950/5 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-rose-500 to-red-600" />
            <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={20} className="text-red-500" />
                <h3 className="text-lg font-bold text-red-500">Danger Zone</h3>
            </div>
            <div className="space-y-3">
                {children}
            </div>
        </div>
    );
}
