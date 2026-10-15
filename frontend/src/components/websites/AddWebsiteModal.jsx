import { useState, useEffect, useRef } from "react";
import {
    X, Globe, Terminal, Copy, Check, Loader2, AlertCircle, Server,
    Shield, CheckCircle2, ArrowRight, ShieldCheck, Cpu, Clock,
} from "lucide-react";
import CustomSelect from "./CustomSelect";
import { ENVIRONMENTS } from "./constants";
import * as api from "../../services/websiteApi";

/* ------------------------------------------------------------------
 * Legacy / Edit Website Form (used only when editing an existing asset)
 * ------------------------------------------------------------------ */

function EditWebsiteForm({ onClose, onSave, initialData, saving }) {
    const [formData, setFormData] = useState(() => ({
        name: initialData.name || "",
        url: initialData.url || "",
        description: initialData.description || "",
        environment: initialData.environment || "Production",
        exposure: initialData.exposure || "internal",
        owner: initialData.owner || "",
        tags: initialData.tags || "",
        notes: initialData.notes || "",
        monitoringEnabled: initialData.monitoringEnabled ?? true,
        health: initialData.health || "Unknown",
    }));
    const [errors, setErrors] = useState({});

    const validate = () => {
        const newErrors = {};
        if (!formData.name.trim()) newErrors.name = "Asset name is required.";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (validate()) onSave(formData);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[rgba(0,0,0,0.75)] backdrop-blur-md" onClick={() => !saving && onClose()} />
            <div className="relative bg-[rgba(8,11,14,0.85)] backdrop-blur-[28px] border border-[rgba(255,255,255,0.085)] shadow-[0_24px_70px_rgba(0,0,0,0.4)] w-full max-w-xl rounded-[24px] overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-[rgba(255,255,255,0.055)] flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-[#F4F6F7] flex items-center gap-2">
                            <Globe size={18} className="text-[#16D98B]" />
                            Edit Protected Asset
                        </h3>
                        <p className="text-xs text-[#858E97] mt-0.5">Update configuration and telemetry settings.</p>
                    </div>
                    <button onClick={onClose} disabled={saving} className="p-1.5 text-[#858E97] hover:text-[#F4F6F7] rounded-full hover:bg-white/5">
                        <X size={16} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                    <div>
                        <label className="text-xs font-semibold text-[#B7BEC5] mb-1 block">Application / Host Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-[rgba(11,14,18,0.78)] border border-[rgba(255,255,255,0.085)] rounded-[10px] px-3.5 py-2 text-sm text-[#F4F6F7] focus:outline-none focus:border-[#16D98B]"
                        />
                        {errors.name && <p className="text-xs text-[#F05A5A] mt-1">{errors.name}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-[#B7BEC5] mb-1 block">Environment</label>
                            <div className="bg-[rgba(11,14,18,0.78)] border border-[rgba(255,255,255,0.085)] rounded-[10px] px-2">
                                <CustomSelect
                                    id="modal-environment"
                                    value={formData.environment}
                                    onChange={(v) => setFormData({ ...formData, environment: v })}
                                    options={ENVIRONMENTS}
                                    className="w-full"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-[#B7BEC5] mb-1 block">Owner / Lead</label>
                            <input
                                type="text"
                                value={formData.owner}
                                onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                                placeholder="team-sec@example.com"
                                className="w-full bg-[rgba(11,14,18,0.78)] border border-[rgba(255,255,255,0.085)] rounded-[10px] px-3.5 py-2 text-sm text-[#F4F6F7] focus:outline-none focus:border-[#16D98B]"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-[#B7BEC5] mb-1 block">Tags (comma separated)</label>
                        <input
                            type="text"
                            value={formData.tags}
                            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                            placeholder="api, internal, critical"
                            className="w-full bg-[rgba(11,14,18,0.78)] border border-[rgba(255,255,255,0.085)] rounded-[10px] px-3.5 py-2 text-sm text-[#F4F6F7] focus:outline-none focus:border-[#16D98B]"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-[#B7BEC5] mb-1 block">Notes / Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={2}
                            className="w-full bg-[rgba(11,14,18,0.78)] border border-[rgba(255,255,255,0.085)] rounded-[10px] px-3.5 py-2 text-sm text-[#F4F6F7] focus:outline-none focus:border-[#16D98B]"
                        />
                    </div>
                </form>
                <div className="p-4 border-t border-[rgba(255,255,255,0.055)] bg-[rgba(11,14,18,0.78)] flex justify-end gap-3">
                    <button onClick={onClose} disabled={saving} className="px-4 py-2 text-xs font-semibold text-[#B7BEC5] hover:text-[#F4F6F7]">
                        Cancel
                    </button>
                    <button onClick={handleSubmit} disabled={saving} className="px-5 py-2 bg-[#F4F6F7] text-[#050607] hover:bg-white text-xs font-bold rounded-[10px] flex items-center gap-2">
                        {saving && <Loader2 size={13} className="animate-spin" />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------
 * Collector-First Protected Asset Onboarding (Primary Flow)
 * ------------------------------------------------------------------ */

function CollectorOnboardingFlow({ onClose, onAssetCreated }) {
    // Steps: 1 = Initial Info & Generate Token, 2 = Token & CLI Setup, 3 = Connected State
    const [step, setStep] = useState(1);
    const [label, setLabel] = useState("");
    const [expiresInHours, setExpiresInHours] = useState(24);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState(null);

    // Generated token details
    const [tokenData, setTokenData] = useState(null);
    const [copiedToken, setCopiedToken] = useState(false);
    const [copiedCmd, setCopiedCmd] = useState(null);

    // Connected state
    const [connectedWebsite, setConnectedWebsite] = useState(null);
    const [connectedCollector, setConnectedCollector] = useState(null);
    const pollIntervalRef = useRef(null);

    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
    }, []);

    // Step 1 -> Generate Token
    const handleGenerateToken = async (e) => {
        if (e) e.preventDefault();
        setGenerating(true);
        setError(null);
        try {
            const data = await api.createTenantEnrollmentToken({
                label: label.trim() || undefined,
                expiresInHours,
                maxUses: 1,
            });
            setTokenData(data);
            setStep(2);

            // Start polling for collector connection
            startPolling(data.id);
        } catch (err) {
            console.error("Token generation failed:", err);
            setError(err.message || "Failed to generate enrollment token.");
        } finally {
            setGenerating(false);
        }
    };

    // Step 2 -> Polling for registration
    const startPolling = (tokenId) => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

        pollIntervalRef.current = setInterval(async () => {
            try {
                const status = await api.getEnrollmentTokenStatus(tokenId);
                if (status.website && status.collector) {
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                    setConnectedWebsite(status.website);
                    setConnectedCollector(status.collector);
                    setStep(3);
                }
            } catch (err) {
                // Ignore transient polling errors
                console.debug("Polling status check:", err);
            }
        }, 2000);
    };

    const handleCopy = async (text, id) => {
        try {
            await navigator.clipboard.writeText(text);
            if (id === "token") {
                setCopiedToken(true);
                setTimeout(() => setCopiedToken(false), 2000);
            } else {
                setCopiedCmd(id);
                setTimeout(() => setCopiedCmd(null), 2000);
            }
        } catch {
            // fallback
        }
    };

    const handleFinish = () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        onClose();
        if (onAssetCreated && connectedWebsite) {
            onAssetCreated(connectedWebsite);
        }
    };

    // Pre-calculate commands
    const rawToken = tokenData?.token || "<YOUR_ENROLLMENT_TOKEN>";
    const cmdInstall = "pip install ./collector";
    const cmdEnroll = `sentinel-collector enroll --token ${rawToken}`;
    const cmdRun = "sentinel-collector run --log-path /var/log/nginx/access.log";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[rgba(0,0,0,0.80)] backdrop-blur-md animate-backdrop-in" onClick={step === 3 ? handleFinish : onClose} />

            <div className="relative bg-[rgba(8,11,14,0.85)] backdrop-blur-[32px] saturate-[130%] border border-[rgba(255,255,255,0.085)] shadow-[0_32px_80px_rgba(0,0,0,0.55)] w-full max-w-2xl rounded-[24px] overflow-hidden flex flex-col max-h-[92vh] animate-scale-in">
                {/* Header Ambient Reflection */}
                <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(135deg, rgba(22,217,139,0.06) 0%, rgba(255,255,255,0) 40%)" }} />

                {/* Header */}
                <div className="shrink-0 p-6 pb-5 border-b border-[rgba(255,255,255,0.055)] flex justify-between items-center relative z-10">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[rgba(22,217,139,0.12)] border border-[rgba(22,217,139,0.25)] text-[#16D98B]">
                                <Shield size={11} /> Sentinel Collector
                            </span>
                            <span className="text-xs text-[#626B74]">Step {step} of 3</span>
                        </div>
                        <h3 className="text-xl font-bold text-[#F4F6F7]">
                            {step === 1 && "Protect Your Website"}
                            {step === 2 && "Enroll Sentinel Collector"}
                            {step === 3 && "Website Protected!"}
                        </h3>
                    </div>
                    <button
                        onClick={step === 3 ? handleFinish : onClose}
                        aria-label="Close dialog"
                        className="p-2 text-[#858E97] hover:text-[#F4F6F7] bg-[rgba(11,14,18,0.78)] hover:bg-[rgba(255,255,255,0.05)] rounded-full border border-[rgba(255,255,255,0.085)] transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative z-10">
                    {/* Error Notice */}
                    {error && (
                        <div className="mb-5 p-3.5 rounded-xl bg-[rgba(240,90,90,0.10)] border border-[rgba(240,90,90,0.25)] text-[#F05A5A] text-xs flex items-center gap-2.5">
                            <AlertCircle size={16} className="shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* ═══ STEP 1: INITIAL OVERVIEW & TOKEN GENERATION ═══ */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="p-4 rounded-2xl bg-[rgba(22,217,139,0.04)] border border-[rgba(22,217,139,0.15)] flex items-start gap-4">
                                <div className="p-2.5 bg-[rgba(22,217,139,0.12)] rounded-xl border border-[rgba(22,217,139,0.25)] text-[#16D98B] shrink-0 mt-0.5">
                                    <Server size={22} />
                                </div>
                                <div className="space-y-1 text-xs">
                                    <h4 className="text-sm font-bold text-[#F4F6F7]">Connect your website or server via Collector</h4>
                                    <p className="text-[#858E97] leading-relaxed">
                                        Install the lightweight Sentinel Collector on your server. It connects securely, streams HTTP access logs for real-time threat detection, and automatically registers your protected asset.
                                    </p>
                                </div>
                            </div>

                            {/* Workflow Guide */}
                            <div className="space-y-3">
                                <h4 className="text-[11px] font-bold text-[#858E97] uppercase tracking-wider">How Onboarding Works</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {[
                                        { num: "1", title: "Generate Enrollment Token", desc: "Cryptographically bound one-time token for your tenant." },
                                        { num: "2", title: "Install on Your Server", desc: "Run a simple pip install command on the target host." },
                                        { num: "3", title: "Enroll with Token", desc: "The collector authenticates and saves its machine credentials." },
                                        { num: "4", title: "Automatic Asset Protection", desc: "Sentinel discovers hostname and configures live defenses." },
                                    ].map((s) => (
                                        <div key={s.num} className="p-3.5 rounded-xl bg-[rgba(14,15,17,0.55)] border border-[rgba(255,255,255,0.06)] flex items-start gap-3">
                                            <div className="w-6 h-6 rounded-lg bg-[rgba(255,255,255,0.06)] text-[#F4F6F7] text-xs font-bold flex items-center justify-center shrink-0">
                                                {s.num}
                                            </div>
                                            <div>
                                                <div className="text-xs font-semibold text-[#F4F6F7]">{s.title}</div>
                                                <div className="text-[11px] text-[#858E97] mt-0.5 leading-normal">{s.desc}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Optional Fields */}
                            <div className="pt-2 border-t border-[rgba(255,255,255,0.055)] space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-[#B7BEC5] uppercase tracking-wider flex items-center justify-between">
                                        <span>Application / Asset Label</span>
                                        <span className="text-[#626B74] normal-case font-normal">Optional</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={label}
                                        onChange={(e) => setLabel(e.target.value)}
                                        placeholder="e.g. Production Web Ingress (defaults to server hostname)"
                                        className="w-full bg-[rgba(11,14,18,0.78)] border border-[rgba(255,255,255,0.085)] rounded-[10px] px-3.5 py-2.5 text-sm text-[#F4F6F7] placeholder:text-[#626B74] focus:outline-none focus:border-[#16D98B] transition-colors"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-[#B7BEC5] uppercase tracking-wider flex items-center justify-between">
                                        <span>Token Expiration</span>
                                        <span className="text-[#626B74] normal-case font-normal">Single-use</span>
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { h: 24, label: "24 Hours" },
                                            { h: 72, label: "3 Days" },
                                            { h: 168, label: "7 Days" },
                                        ].map((opt) => (
                                            <button
                                                key={opt.h}
                                                type="button"
                                                onClick={() => setExpiresInHours(opt.h)}
                                                className={`py-2 px-3 rounded-[10px] text-xs font-semibold border transition-all text-center ${
                                                    expiresInHours === opt.h
                                                        ? "bg-[rgba(22,217,139,0.12)] border-[#16D98B] text-[#F4F6F7]"
                                                        : "bg-[rgba(11,14,18,0.78)] border-[rgba(255,255,255,0.085)] text-[#858E97] hover:border-white/15"
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══ STEP 2: TOKEN & INSTALLATION COMMANDS ═══ */}
                    {step === 2 && (
                        <div className="space-y-6">
                            {/* Token Box */}
                            <div className="p-4 rounded-2xl bg-[rgba(14,15,17,0.75)] border border-[rgba(22,217,139,0.25)] space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-[#16D98B] font-bold uppercase tracking-wider flex items-center gap-1.5">
                                        <Clock size={13} /> Enrollment Token Generated
                                    </span>
                                    <span className="text-[#858E97]">Valid for {expiresInHours}h · Single-use</span>
                                </div>
                                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[rgba(6,7,8,0.85)] border border-[rgba(255,255,255,0.06)] font-mono text-xs text-[#F4F6F7]">
                                    <span className="flex-1 truncate">{rawToken}</span>
                                    <button
                                        onClick={() => handleCopy(rawToken, "token")}
                                        className="px-3 py-1 bg-[rgba(22,217,139,0.15)] hover:bg-[rgba(22,217,139,0.25)] text-[#16D98B] rounded-lg border border-[rgba(22,217,139,0.3)] transition-colors shrink-0 flex items-center gap-1.5 font-sans font-bold"
                                    >
                                        {copiedToken ? <Check size={13} /> : <Copy size={13} />}
                                        {copiedToken ? "Copied" : "Copy Token"}
                                    </button>
                                </div>
                            </div>

                            {/* Server Commands */}
                            <div className="space-y-3">
                                <h4 className="text-[11px] font-bold text-[#858E97] uppercase tracking-wider flex items-center gap-2">
                                    <Terminal size={13} /> Run on your server / host
                                </h4>

                                {/* Step A: Install */}
                                <div className="p-3.5 rounded-xl bg-[rgba(11,14,18,0.78)] border border-[rgba(255,255,255,0.06)] space-y-1.5">
                                    <div className="flex items-center justify-between text-[11px] text-[#858E97]">
                                        <span>1. Install Sentinel Collector</span>
                                        <button onClick={() => handleCopy(cmdInstall, "cmd1")} className="hover:text-white flex items-center gap-1">
                                            {copiedCmd === "cmd1" ? <Check size={11} className="text-[#16D98B]" /> : <Copy size={11} />}
                                            {copiedCmd === "cmd1" ? "Copied" : "Copy"}
                                        </button>
                                    </div>
                                    <pre className="p-2.5 rounded-lg bg-[rgba(6,7,8,0.85)] text-xs font-mono text-[#F4F6F7] overflow-x-auto">
                                        <code>$ {cmdInstall}</code>
                                    </pre>
                                </div>

                                {/* Step B: Enroll */}
                                <div className="p-3.5 rounded-xl bg-[rgba(11,14,18,0.78)] border border-[rgba(255,255,255,0.06)] space-y-1.5">
                                    <div className="flex items-center justify-between text-[11px] text-[#858E97]">
                                        <span>2. Enroll with token</span>
                                        <button onClick={() => handleCopy(cmdEnroll, "cmd2")} className="hover:text-white flex items-center gap-1">
                                            {copiedCmd === "cmd2" ? <Check size={11} className="text-[#16D98B]" /> : <Copy size={11} />}
                                            {copiedCmd === "cmd2" ? "Copied" : "Copy"}
                                        </button>
                                    </div>
                                    <pre className="p-2.5 rounded-lg bg-[rgba(6,7,8,0.85)] text-xs font-mono text-[#F4F6F7] overflow-x-auto">
                                        <code>$ {cmdEnroll}</code>
                                    </pre>
                                </div>

                                {/* Step C: Run */}
                                <div className="p-3.5 rounded-xl bg-[rgba(11,14,18,0.78)] border border-[rgba(255,255,255,0.06)] space-y-1.5">
                                    <div className="flex items-center justify-between text-[11px] text-[#858E97]">
                                        <span>3. Start daemon (point to your Nginx/HTTP access log)</span>
                                        <button onClick={() => handleCopy(cmdRun, "cmd3")} className="hover:text-white flex items-center gap-1">
                                            {copiedCmd === "cmd3" ? <Check size={11} className="text-[#16D98B]" /> : <Copy size={11} />}
                                            {copiedCmd === "cmd3" ? "Copied" : "Copy"}
                                        </button>
                                    </div>
                                    <pre className="p-2.5 rounded-lg bg-[rgba(6,7,8,0.85)] text-xs font-mono text-[#F4F6F7] overflow-x-auto">
                                        <code>$ {cmdRun}</code>
                                    </pre>
                                </div>
                            </div>

                            {/* Waiting indicator */}
                            <div className="p-4 rounded-xl bg-[rgba(22,217,139,0.05)] border border-[rgba(22,217,139,0.18)] flex items-center gap-3.5">
                                <div className="relative flex items-center justify-center shrink-0">
                                    <span className="w-3 h-3 rounded-full bg-[#16D98B] animate-ping absolute opacity-75" />
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#16D98B]" />
                                </div>
                                <div className="flex-1 text-xs">
                                    <div className="font-bold text-[#F4F6F7]">Waiting for Collector...</div>
                                    <div className="text-[#858E97] mt-0.5">Sentinel is actively listening. Once the command completes on your server, this window will update automatically.</div>
                                </div>
                                <Loader2 size={16} className="text-[#16D98B] animate-spin shrink-0" />
                            </div>
                        </div>
                    )}

                    {/* ═══ STEP 3: CONNECTED & REGISTERED ═══ */}
                    {step === 3 && connectedWebsite && (
                        <div className="space-y-6 text-center py-2 animate-fade-in">
                            <div className="w-16 h-16 rounded-full bg-[rgba(22,217,139,0.12)] border border-[rgba(22,217,139,0.3)] text-[#16D98B] flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(22,217,139,0.25)]">
                                <CheckCircle2 size={36} strokeWidth={2.2} />
                            </div>

                            <div>
                                <h4 className="text-xl font-bold text-[#F4F6F7]">Website Protected!</h4>
                                <p className="text-sm text-[#858E97] mt-1 max-w-md mx-auto">
                                    Collector successfully enrolled. Telemetry pipeline established and defense telemetry is live.
                                </p>
                            </div>

                            {/* Details Summary */}
                            <div className="grid grid-cols-2 gap-4 text-left max-w-lg mx-auto">
                                <div className="p-4 rounded-xl bg-[rgba(14,15,17,0.7)] border border-[rgba(255,255,255,0.06)] space-y-2">
                                    <span className="text-[10px] font-bold text-[#858E97] uppercase tracking-wider block">Connected Collector</span>
                                    <div className="space-y-1">
                                        <div className="text-xs font-semibold text-[#F4F6F7] flex items-center gap-1.5">
                                            <Cpu size={13} className="text-[#16D98B]" />
                                            {connectedCollector?.hostname || "Host Connected"}
                                        </div>
                                        <div className="text-[11px] text-[#858E97]">
                                            Version: {connectedCollector?.version || "1.0.0"}
                                        </div>
                                        <div className="pt-1">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[rgba(22,217,139,0.12)] text-[#16D98B] border border-[rgba(22,217,139,0.25)]">
                                                <span className="w-1.5 h-1.5 rounded-full bg-[#16D98B]" /> Online & Streaming
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-[rgba(14,15,17,0.7)] border border-[rgba(255,255,255,0.06)] space-y-2">
                                    <span className="text-[10px] font-bold text-[#858E97] uppercase tracking-wider block">Protected Asset</span>
                                    <div className="space-y-1">
                                        <div className="text-xs font-semibold text-[#F4F6F7] truncate">
                                            {connectedWebsite.name}
                                        </div>
                                        <div className="text-[11px] text-[#858E97] font-mono truncate">
                                            {connectedWebsite.domain}
                                        </div>
                                        <div className="pt-1">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[rgba(255,255,255,0.05)] text-[#B7BEC5] border border-[rgba(255,255,255,0.08)]">
                                                <ShieldCheck size={11} className="text-[#16D98B]" />
                                                Active Defense
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="shrink-0 px-6 py-4 border-t border-[rgba(255,255,255,0.055)] bg-[rgba(11,14,18,0.78)] flex justify-between items-center relative z-10">
                    {step === 1 && (
                        <>
                            <button
                                onClick={onClose}
                                disabled={generating}
                                className="px-4 py-2 rounded-[10px] text-xs font-semibold text-[#858E97] hover:text-[#F4F6F7] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGenerateToken}
                                disabled={generating}
                                className="px-5 py-2.5 rounded-[12px] text-xs font-bold text-[#050607] bg-[#F4F6F7] hover:bg-white transition-all flex items-center gap-2 shadow-sm"
                            >
                                {generating && <Loader2 size={13} className="animate-spin" />}
                                Generate Enrollment Token
                                <ArrowRight size={13} />
                            </button>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded-[10px] text-xs font-semibold text-[#858E97] hover:text-[#F4F6F7] transition-colors"
                            >
                                Close & Keep Waiting in Background
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleCopy(rawToken, "token")}
                                    className="px-4 py-2 rounded-[10px] text-xs font-bold text-[#16D98B] bg-[rgba(22,217,139,0.1)] hover:bg-[rgba(22,217,139,0.2)] border border-[rgba(22,217,139,0.25)] transition-colors flex items-center gap-1.5"
                                >
                                    <Copy size={13} />
                                    {copiedToken ? "Token Copied!" : "Copy Token"}
                                </button>
                            </div>
                        </>
                    )}

                    {step === 3 && (
                        <div className="w-full flex justify-end gap-3">
                            <button
                                onClick={handleFinish}
                                className="px-6 py-2.5 rounded-[12px] text-xs font-bold text-[#050607] bg-[#16D98B] hover:bg-[#19f09a] transition-all flex items-center gap-2 shadow-sm"
                            >
                                Open Protected Asset
                                <ArrowRight size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function AddWebsiteModal({ isOpen, onClose, onSave, onAssetCreated, initialData, saving }) {
    if (!isOpen) return null;

    if (initialData) {
        return (
            <EditWebsiteForm
                key={initialData.id}
                onClose={onClose}
                onSave={onSave}
                initialData={initialData}
                saving={saving}
            />
        );
    }

    return (
        <CollectorOnboardingFlow
            onClose={onClose}
            onAssetCreated={onAssetCreated}
        />
    );
}
