import { useState, useEffect } from "react";
import {
    X, Globe, Link, Tags, User, AlignLeft, ShieldAlert, Loader2, AlertCircle, Server,
} from "lucide-react";
import CustomSelect from "./CustomSelect";
import { ENVIRONMENTS } from "./constants";

const createEmptyForm = () => ({
    name: "", url: "", description: "", environment: "Production",
    owner: "", tags: "", notes: "", monitoringEnabled: true, health: "Unknown",
});

/* Input wrapper: premium focus glow + validation styling + aligned icon */
function Field({ label, icon: Icon, error, children, hint }) {
    return (
        <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Icon size={12} className="text-slate-500" />{label}</span>
                {hint && <span className="text-slate-600 font-medium normal-case tracking-normal">{hint}</span>}
            </label>
            {children}
            {error && (
                <p className="flex items-center gap-1 text-xs font-medium text-red-400 animate-fade-in" role="alert">
                    <AlertCircle size={12} />
                    {error}
                </p>
            )}
        </div>
    );
}

function AddWebsiteForm({ onClose, onSave, initialData, saving }) {
    const isEdit = !!initialData;
    const [formData, setFormData] = useState(() => initialData ? {
        ...initialData,
        tags: initialData.tags || "",
        description: initialData.description || "",
        notes: initialData.notes || "",
        owner: initialData.owner || "",
    } : createEmptyForm());
    const [errors, setErrors] = useState({});
    const [shake, setShake] = useState(false);

    // Close on Escape (form only mounts while open)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && !saving) onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, saving]);

    const validate = () => {
        const newErrors = {};
        if (!formData.name.trim()) newErrors.name = "Website name is required.";
        if (!formData.url.trim()) {
            newErrors.url = "Target URL is required.";
        } else if (!formData.url.startsWith("http://") && !formData.url.startsWith("https://")) {
            newErrors.url = "URL must start with http:// or https://";
        }
        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) {
            setShake(true);
            setTimeout(() => setShake(false), 350);
        }
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (validate()) onSave(formData);
    };

    const inputClass = (hasError) =>
        `w-full bg-slate-950/80 border rounded-xl py-2.5 text-sm text-white placeholder:text-slate-600 transition-all duration-200 focus:outline-none focus:ring-2 ${
            hasError
                ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/20"
                : "border-slate-700/80 focus:border-emerald-400 focus:ring-emerald-500/20 focus:shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_0_14px_rgba(16,185,129,0.12)]"
        }`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm animate-backdrop-in" onClick={() => !saving && onClose()} />

            {/* Panel */}
            <div className="relative bg-slate-900 border border-slate-700/80 w-full max-w-2xl rounded-2xl shadow-2xl shadow-black overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
                {/* Header */}
                <div className="shrink-0 p-6 pb-5 border-b border-slate-700/40 bg-slate-900/60 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                                <Globe size={20} />
                            </div>
                            {isEdit ? "Edit Website" : "Add Website"}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1 ml-12">
                            {isEdit ? "Update the target's configuration and monitoring preferences." : "Register a new target for continuous security monitoring."}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        aria-label="Close dialog"
                        className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-full border border-slate-700/60 transition-all duration-150 hover:rotate-90 active:scale-90 disabled:opacity-50"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className={`flex-1 overflow-y-auto p-6 custom-scrollbar ${shake ? "animate-shake" : ""}`}>
                    <form id="website-form" onSubmit={handleSubmit} className="space-y-6" noValidate>
                        {/* Identity */}
                        <section className="space-y-5">
                            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-1 h-3.5 rounded-full bg-emerald-400/80" /> Target Identity
                            </h4>
                            <div className="grid grid-cols-2 gap-5">
                                <div className="col-span-2 md:col-span-1">
                                    <Field label="Website Name" icon={Globe} error={errors.name} hint="Required">
                                        <div className="relative">
                                            <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                className={`${inputClass(errors.name)} pl-10 pr-4`}
                                                placeholder="e.g. Acme Corp Main"
                                                aria-invalid={!!errors.name}
                                            />
                                        </div>
                                    </Field>
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <Field label="Target URL" icon={Link} error={errors.url} hint="Required">
                                        <div className="relative">
                                            <Link size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                            <input
                                                type="text"
                                                value={formData.url}
                                                onChange={e => setFormData({ ...formData, url: e.target.value })}
                                                className={`${inputClass(errors.url)} pl-10 pr-4 font-mono`}
                                                placeholder="https://www.example.com"
                                                aria-invalid={!!errors.url}
                                            />
                                        </div>
                                    </Field>
                                </div>
                            </div>
                        </section>

                        {/* Context */}
                        <section className="space-y-5">
                            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-1 h-3.5 rounded-full bg-cyan-400/80" /> Deployment Context
                            </h4>
                            <div className="grid grid-cols-2 gap-5">
                                <div className="col-span-2 md:col-span-1">
                                    <Field label="Environment" icon={Server} hint="Deployment tier">
                                        <div className="bg-slate-950/80 border border-slate-700/80 rounded-xl px-3">
                                            <CustomSelect
                                                id="modal-environment"
                                                value={formData.environment}
                                                onChange={v => setFormData({ ...formData, environment: v })}
                                                options={ENVIRONMENTS}
                                                className="w-full"
                                            />
                                        </div>
                                    </Field>
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <Field label="Owner / Contact" icon={User} hint="Optional">
                                        <div className="relative">
                                            <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                            <input
                                                type="text"
                                                value={formData.owner}
                                                onChange={e => setFormData({ ...formData, owner: e.target.value })}
                                                className={`${inputClass()} pl-10 pr-4`}
                                                placeholder="owner@example.com"
                                            />
                                        </div>
                                    </Field>
                                </div>
                            </div>

                            <Field label="Tags" icon={Tags} hint="Comma separated">
                                <div className="relative">
                                    <Tags size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="text"
                                        value={formData.tags}
                                        onChange={e => setFormData({ ...formData, tags: e.target.value })}
                                        className={`${inputClass()} pl-10 pr-4`}
                                        placeholder="b2b, frontend, legacy"
                                    />
                                </div>
                            </Field>
                        </section>

                        {/* Notes */}
                        <section className="space-y-5">
                            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-1 h-3.5 rounded-full bg-purple-400/80" /> Notes
                            </h4>
                            <Field label="Description" icon={AlignLeft} hint="Optional">
                                <div className="relative">
                                    <AlignLeft size={16} className="absolute left-3.5 top-4 text-slate-500" />
                                    <textarea
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className={`${inputClass()} pl-10 pr-4 py-3 h-20 resize-none`}
                                        placeholder="Brief description of the website…"
                                    />
                                </div>
                            </Field>

                            {/* Monitoring toggle */}
                            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800 relative overflow-hidden">
                                <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
                                <div className="flex-1">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                        <ShieldAlert size={16} className="text-emerald-400" />
                                        Active Monitoring
                                    </h4>
                                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">Enable background uptime and basic vulnerability polling for this target.</p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={formData.monitoringEnabled}
                                    onClick={() => setFormData({ ...formData, monitoringEnabled: !formData.monitoringEnabled })}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-emerald-400/50 ${
                                        formData.monitoringEnabled
                                            ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                                            : "bg-slate-700"
                                    }`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${formData.monitoringEnabled ? "translate-x-6" : "translate-x-1"}`} />
                                </button>
                            </div>
                        </section>
                    </form>
                </div>

                {/* Footer */}
                <div className="shrink-0 px-6 py-5 border-t border-slate-700/40 bg-slate-900/60 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-all duration-150 border border-slate-700/60 active:scale-95 disabled:opacity-50"
                    >
                        Discard
                    </button>
                    <button
                        type="submit"
                        form="website-form"
                        disabled={saving}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all duration-150 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_22px_rgba(16,185,129,0.5)] border border-emerald-400/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                    >
                        {saving && <Loader2 size={15} className="animate-spin" />}
                        {isEdit ? (saving ? "Saving…" : "Save Changes") : (saving ? "Creating…" : "Create Website")}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AddWebsiteModal({ isOpen, onClose, onSave, initialData, saving }) {
    if (!isOpen) return null;
    // Keyed remount: fresh form state per open / per edited target.
    return (
        <AddWebsiteForm
            key={initialData?.id ?? "new"}
            onClose={onClose}
            onSave={onSave}
            initialData={initialData}
            saving={saving}
        />
    );
}
