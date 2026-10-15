import { useState } from "react";
import { X, Copy, Check, Shield, KeyRound, Loader2, AlertTriangle, Terminal } from "lucide-react";
import * as api from "../../services/websiteApi";

export default function EnrollmentTokenModal({ website, onClose, onCreated }) {
    const [label, setLabel] = useState("");
    const [expiresInHours, setExpiresInHours] = useState(24);
    const [useType, setUseType] = useState("single");
    const [customUses, setCustomUses] = useState(5);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [createdToken, setCreatedToken] = useState(null);
    const [copied, setCopied] = useState(false);

    const handleCreate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const maxUses = useType === "single" ? 1 : Math.max(1, parseInt(customUses, 10) || 1);
            const res = await api.createEnrollmentToken(website.id, {
                label: label.trim() || undefined,
                expiresInHours: parseInt(expiresInHours, 10),
                maxUses,
            });
            // res contains { id, token, token_prefix, expires_at, max_uses }
            setCreatedToken(res);
            onCreated?.();
        } catch (err) {
            setError(err.message || "Failed to generate enrollment token.");
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!createdToken?.token) return;
        try {
            await navigator.clipboard.writeText(createdToken.token);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard fallback
        }
    };

    const handleClose = () => {
        // Clear token from state immediately
        setCreatedToken(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-[rgba(0,0,0,0.75)] backdrop-blur-md" onClick={handleClose} />
            <div className="relative w-full max-w-lg rounded-[20px] border border-[rgba(255,255,255,0.085)] bg-[rgba(12,15,19,0.92)] backdrop-blur-[28px] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.55)] text-[#F4F6F7]">
                <div className="flex items-center justify-between pb-4 border-b border-[rgba(255,255,255,0.055)]">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-[10px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-[#16D98B]">
                            <Shield size={18} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-[#F4F6F7]">Add Collector</h3>
                            <p className="text-xs text-[#858E97]">Enroll an agent for {website.name}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1.5 rounded-full text-[#858E97] hover:text-[#F4F6F7] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {!createdToken ? (
                    <form onSubmit={handleCreate} className="mt-5 space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-[#B7BEC5] mb-1.5">
                                Token Label (Optional)
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. k8s-cluster-01, web-server-east"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-[10px] bg-[rgba(11,14,18,0.78)] border border-[rgba(255,255,255,0.085)] text-sm text-[#F4F6F7] focus:outline-none focus:border-[rgba(255,255,255,0.25)] transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[#B7BEC5] mb-1.5">
                                Expiration Window
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { label: "1 Hour", value: 1 },
                                    { label: "24 Hours", value: 24 },
                                    { label: "7 Days", value: 168 },
                                ].map((opt) => (
                                    <button
                                        type="button"
                                        key={opt.value}
                                        onClick={() => setExpiresInHours(opt.value)}
                                        className={`py-2 px-3 text-xs font-semibold rounded-[10px] border transition-all ${
                                            expiresInHours === opt.value
                                                ? "bg-[rgba(255,255,255,0.12)] border-[rgba(255,255,255,0.30)] text-[#F4F6F7]"
                                                : "bg-[rgba(11,14,18,0.78)] border-[rgba(255,255,255,0.085)] text-[#858E97] hover:text-[#B7BEC5]"
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[#B7BEC5] mb-1.5">
                                Uses
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setUseType("single")}
                                    className={`py-2 px-3 text-xs font-semibold rounded-[10px] border transition-all ${
                                        useType === "single"
                                            ? "bg-[rgba(255,255,255,0.12)] border-[rgba(255,255,255,0.30)] text-[#F4F6F7]"
                                            : "bg-[rgba(11,14,18,0.78)] border-[rgba(255,255,255,0.085)] text-[#858E97] hover:text-[#B7BEC5]"
                                    }`}
                                >
                                    Single-use (1 machine)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setUseType("multi")}
                                    className={`py-2 px-3 text-xs font-semibold rounded-[10px] border transition-all ${
                                        useType === "multi"
                                            ? "bg-[rgba(255,255,255,0.12)] border-[rgba(255,255,255,0.30)] text-[#F4F6F7]"
                                            : "bg-[rgba(11,14,18,0.78)] border-[rgba(255,255,255,0.085)] text-[#858E97] hover:text-[#B7BEC5]"
                                    }`}
                                >
                                    Multi-use (Fleet / N machines)
                                </button>
                            </div>
                            {useType === "multi" && (
                                <div className="mt-2.5">
                                    <label className="block text-[11px] font-semibold text-[#858E97] mb-1">
                                        Max Allowed Machines
                                    </label>
                                    <input
                                        type="number"
                                        min={2}
                                        max={100}
                                        value={customUses}
                                        onChange={(e) => setCustomUses(e.target.value)}
                                        className="w-full px-3 py-2 rounded-[10px] bg-[rgba(11,14,18,0.78)] border border-[rgba(255,255,255,0.085)] text-sm text-[#F4F6F7] focus:outline-none focus:border-[rgba(255,255,255,0.25)]"
                                    />
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="p-3 rounded-[10px] bg-[rgba(240,90,90,0.1)] border border-[rgba(240,90,90,0.25)] text-[#F05A5A] text-xs font-semibold flex items-center gap-2">
                                <AlertTriangle size={14} className="shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="pt-2 flex justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-4 py-2.5 rounded-[10px] text-xs font-semibold text-[#858E97] hover:text-[#F4F6F7] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-[#F4F6F7] text-[#050607] font-bold text-xs hover:bg-white transition-all disabled:opacity-50"
                            >
                                {loading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                                Generate Token
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="mt-5 space-y-4 animate-fade-in-up">
                        <div className="p-3.5 rounded-[12px] bg-[rgba(230,169,58,0.1)] border border-[rgba(230,169,58,0.25)] text-[#E6A93A] text-xs flex items-start gap-2.5">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold">This enrollment token will only be shown once.</p>
                                <p className="text-[11px] opacity-90 mt-0.5">
                                    Copy and supply it to the Sentinel Collector daemon during setup.
                                </p>
                            </div>
                        </div>

                        <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#858E97] block mb-1">
                                Enrollment Token
                            </span>
                            <div className="flex items-center gap-2 p-2.5 rounded-[10px] bg-[rgba(11,14,18,0.78)] border border-[rgba(255,255,255,0.1)]">
                                <span className="font-mono text-xs text-[#F4F6F7] truncate flex-1 select-all">
                                    {createdToken.token}
                                </span>
                                <button
                                    onClick={handleCopy}
                                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-[8px] text-xs font-bold transition-all ${
                                        copied
                                            ? "bg-[rgba(22,217,139,0.15)] text-[#16D98B] border border-[rgba(22,217,139,0.3)]"
                                            : "bg-[rgba(255,255,255,0.08)] text-[#F4F6F7] hover:bg-[rgba(255,255,255,0.15)]"
                                    }`}
                                >
                                    {copied ? <Check size={12} /> : <Copy size={12} />}
                                    {copied ? "Copied" : "Copy"}
                                </button>
                            </div>
                            <div className="flex justify-between items-center text-[11px] text-[#858E97] mt-1.5 px-0.5">
                                <span>Expires: {new Date(createdToken.expires_at).toLocaleString()}</span>
                                <span>Max uses: {createdToken.max_uses}</span>
                            </div>
                        </div>

                        <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#858E97] block mb-1 flex items-center gap-1.5">
                                <Terminal size={12} /> Collector Installation Instructions
                            </span>
                            <div className="p-3 rounded-[10px] bg-[rgba(11,14,18,0.78)] border border-[rgba(255,255,255,0.06)] font-mono text-[11px] text-[#B7BEC5] space-y-1.5 overflow-x-auto whitespace-pre">
                                <div className="text-[#858E97]"># 1. Install or invoke the Sentinel Collector package:</div>
                                <div className="text-[#F4F6F7]">pip install ./collector</div>
                                <div className="text-[#858E97] pt-1"># 2. Enroll this host with the token (saves key with 0600 permissions):</div>
                                <div className="text-[#F4F6F7]">sentinel-collector enroll --token {createdToken.token}</div>
                                <div className="text-[#858E97] pt-1"># 3. Start tailing Nginx access logs:</div>
                                <div className="text-[#F4F6F7]">sentinel-collector run --log-path /var/log/nginx/access.log</div>
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                onClick={handleClose}
                                className="px-5 py-2.5 rounded-[10px] bg-[#F4F6F7] text-[#050607] font-bold text-xs hover:bg-white transition-all"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
