import { AlertTriangle, CheckCircle2, Clock, Lock, Settings2, Code, XCircle } from "lucide-react";

export function StatusBadge({ status }) {
    switch (status) {
        case "Implemented":
            return (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[var(--color-border-default)] bg-[var(--color-success)]/10 text-[10px] font-semibold text-[var(--color-success)] uppercase tracking-wider">
                    <CheckCircle2 size={10} /> Implemented
                </span>
            );
        case "Configurable":
            return (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[var(--color-border-default)] bg-[var(--color-info)]/10 text-[10px] font-semibold text-[var(--color-info)] uppercase tracking-wider">
                    <Settings2 size={10} /> Configurable
                </span>
            );
        case "Beta":
            return (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[var(--color-border-default)] bg-[var(--color-signal-subtle)] text-[10px] font-semibold text-[var(--color-signal)] uppercase tracking-wider">
                    <Code size={10} /> Beta
                </span>
            );
        case "Coming Soon":
            return (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[var(--color-border-default)] bg-[var(--color-warning)]/10 text-[10px] font-semibold text-[var(--color-warning)] uppercase tracking-wider">
                    <Clock size={10} /> Coming Soon
                </span>
            );
        case "Disabled":
            return (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[var(--color-border-default)] bg-[var(--color-surface-2)] text-[10px] font-semibold text-[var(--color-text-disabled)] uppercase tracking-wider">
                    <XCircle size={10} /> Disabled
                </span>
            );
        case "Available":
            return (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[var(--color-border-default)] bg-[var(--color-success)]/10 text-[10px] font-semibold text-[var(--color-success)] uppercase tracking-wider">
                    <CheckCircle2 size={10} /> Available
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
                <div className="w-14 h-14 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border-default)] flex items-center justify-center shrink-0 mt-1">
                    <Icon size={26} className="text-[var(--color-text-secondary)]" />
                </div>
            )}
            <div>
                <h2 className="text-lg font-bold text-[var(--color-text-primary)] tracking-tight mb-2">
                    {title}
                </h2>
                {description && <p className="text-sm font-medium text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">{description}</p>}
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
        relative p-5 rounded-lg border flex flex-col justify-between gap-3 transition-all duration-300
        ${danger 
            ? "bg-[var(--color-critical)]/10 border-[var(--color-critical)]/30 hover:border-[var(--color-critical)] hover:bg-[var(--color-critical)]/20" 
            : "bg-[var(--color-surface-2)] border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-3)]"
        }
        ${disabled ? "opacity-60 cursor-not-allowed pointer-events-none grayscale-[30%]" : ""}
    `}>
        {children}
    </div>
);

const CardMeta = ({ label, description, status, danger }) => (
    <div className="w-full">
        <div className="flex items-center gap-3 mb-1.5">
            <h3 className={`text-sm font-semibold ${danger ? "text-[var(--color-critical)]" : "text-[var(--color-text-primary)]"} truncate`}>{label}</h3>
            {status && <StatusBadge status={status} />}
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{description}</p>
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
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--color-signal-strong)] ${
                        value ? (danger ? "bg-[var(--color-critical)]" : "bg-[var(--color-accent)]") : "bg-[var(--color-surface-3)]"
                    }`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-text-primary)] transition duration-300 ${value ? "translate-x-6" : "translate-x-1"}`} />
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
                    className={`w-full bg-[var(--color-surface-1)] border rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 transition-all ${masked || validation ? "pr-10" : ""} ${
                        validation === "valid" ? "border-[var(--color-success)] focus:border-[var(--color-success)] focus:ring-[var(--color-success)]/20" :
                        validation === "warning" ? "border-[var(--color-warning)] focus:border-[var(--color-warning)] focus:ring-[var(--color-warning)]/20" :
                        validation === "error" ? "border-[var(--color-critical)] focus:border-[var(--color-critical)] focus:ring-[var(--color-critical)]/20" :
                        "border-[var(--color-border-default)] focus:border-[var(--color-signal)] focus:ring-[var(--color-signal-strong)]"
                    }`}
                    disabled={disabled}
                />
                {validation === "valid" && <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-success)] pointer-events-none" />}
                {validation === "warning" && <AlertTriangle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-warning)] pointer-events-none" />}
                {validation === "error" && <XCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-critical)] pointer-events-none" />}
                {masked && !validation && (
                    <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
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
                    className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-signal)] focus:ring-2 focus:ring-[var(--color-signal-strong)] transition-all appearance-none"
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
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--color-canvas)] ${
                        danger 
                            ? "bg-[var(--color-critical)]/10 text-[var(--color-critical)] border border-[var(--color-critical)]/30 hover:bg-[var(--color-critical)] hover:text-[var(--color-text-primary)] focus:ring-[var(--color-critical)]" 
                            : "bg-[var(--color-surface-3)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] hover:bg-[var(--color-surface-2)] focus:ring-[var(--color-text-secondary)]"
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
        <div className="mt-8 relative p-6 rounded-lg border border-[var(--color-critical)]/50 bg-[var(--color-critical)]/5 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[var(--color-critical)]" />
            <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={20} className="text-[var(--color-critical)]" />
                <h3 className="text-lg font-bold text-[var(--color-critical)]">Danger Zone</h3>
            </div>
            <div className="space-y-3">
                {children}
            </div>
        </div>
    );
}
