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
            <label className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Icon size={12} className="text-[var(--color-text-muted)]" />{label}</span>
                {hint && <span className="text-[var(--color-text-disabled)] font-medium normal-case tracking-normal">{hint}</span>}
            </label>
            {children}
            {error && (
                <p className="flex items-center gap-1 text-xs font-medium text-[var(--color-critical)] animate-fade-in" role="alert">
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
        `w-full bg-[var(--color-canvas)] border rounded-md py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] transition-all duration-200 focus:outline-none focus:ring-2 ${
            hasError
                ? "border-[var(--color-critical)] focus:border-[var(--color-critical)] focus:ring-[var(--color-critical)]"
                : "border-[var(--color-border-default)] focus:border-[var(--color-success)] focus:ring-2 focus:ring-[var(--color-success)]"
        }`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-[var(--color-canvas)]  animate-backdrop-in" onClick={() => !saving && onClose()} />

            {/* Panel */}
            <div className="relative bg-[var(--color-surface-1)] border border-[var(--color-border-default)] w-full max-w-2xl rounded-lg shadow-[var(--shadow-3)] overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
                {/* Header */}
                <div className="shrink-0 p-6 pb-5 border-b border-[var(--color-border-default)] bg-[var(--color-surface-1)] flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-3">
                            <div className="p-2 bg-[rgba(85,176,123,0.10)] text-[var(--color-success)] rounded-lg border border-[rgba(85,176,123,0.25)]">
                                <Globe size={20} />
                            </div>
                            {isEdit ? "Edit Website" : "Add Website"}
                        </h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-1 ml-12">
                            {isEdit ? "Update the target's configuration and monitoring preferences." : "Register a new target for continuous security monitoring."}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        aria-label="Close dialog"
                        className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] rounded-full border border-[var(--color-border-default)] transition-colors duration-150 active:opacity-70 disabled:opacity-50"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className={`flex-1 overflow-y-auto p-6 custom-scrollbar ${shake ? "animate-shake" : ""}`}>
                    <form id="website-form" onSubmit={handleSubmit} className="space-y-6" noValidate>
                        {/* Identity */}
                        <section className="space-y-5">
                            <h4 className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                                <span className="w-1 h-3.5 rounded-full bg-[var(--color-success)]" /> Target Identity
                            </h4>
                            <div className="grid grid-cols-2 gap-5">
                                <div className="col-span-2 md:col-span-1">
                                    <Field label="Website Name" icon={Globe} error={errors.name} hint="Required">
                                        <div className="relative">
                                            <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
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
                                            <Link size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
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
                            <h4 className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                                <span className="w-1 h-3.5 rounded-full bg-[var(--color-info)]" /> Deployment Context
                            </h4>
                            <div className="grid grid-cols-2 gap-5">
                                <div className="col-span-2 md:col-span-1">
                                    <Field label="Environment" icon={Server} hint="Deployment tier">
                                        <div className="bg-[var(--color-canvas)] border border-[var(--color-border-default)] rounded-md px-3">
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
                                            <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
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
                                    <Tags size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
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
                            <h4 className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                                <span className="w-1 h-3.5 rounded-full bg-[var(--color-accent)]" /> Notes
                            </h4>
                            <Field label="Description" icon={AlignLeft} hint="Optional">
                                <div className="relative">
                                    <AlignLeft size={16} className="absolute left-3.5 top-4 text-[var(--color-text-muted)]" />
                                    <textarea
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className={`${inputClass()} pl-10 pr-4 py-3 h-20 resize-none`}
                                        placeholder="Brief description of the website…"
                                    />
                                </div>
                            </Field>

                            {/* Monitoring toggle */}
                            <div className="flex items-center gap-4 p-4 rounded-md bg-[var(--color-surface-1)] border border-[var(--color-border-subtle)] relative overflow-hidden">
                                <div className="absolute top-0 left-4 right-4 h-px bg-[var(--color-border-default)]" />
                                <div className="flex-1">
                                    <h4 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                                        <ShieldAlert size={16} className="text-[var(--color-success)]" />
                                        Active Monitoring
                                    </h4>
                                    <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">Enable background uptime and basic vulnerability polling for this target.</p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={formData.monitoringEnabled}
                                    onClick={() => setFormData({ ...formData, monitoringEnabled: !formData.monitoringEnabled })}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-success)] ${
                                        formData.monitoringEnabled
                                            ? "bg-[var(--color-success)]"
                                            : "bg-[var(--color-surface-3)]"
                                    }`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${formData.monitoringEnabled ? "translate-x-6" : "translate-x-1"}`} />
                                </button>
                            </div>
                        </section>
                    </form>
                </div>

                {/* Footer */}
                <div className="shrink-0 px-6 py-5 border-t border-[var(--color-border-default)] bg-[var(--color-surface-1)] flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-5 py-2.5 rounded-md text-sm font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] transition-colors duration-150 border border-[var(--color-border-default)] active:opacity-70 disabled:opacity-50"
                    >
                        Discard
                    </button>
                    <button
                        type="submit"
                        form="website-form"
                        disabled={saving}
                        className="px-5 py-2.5 rounded-md text-sm font-bold text-[var(--color-text-primary)] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] transition-colors duration-150 border border-[var(--color-success)] active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
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
