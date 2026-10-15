import { safeHttpUrl } from "../../services/evidence.js";
import { useEffect, useState } from "react";
import {
    X, ExternalLink, Globe, Server,
    ShieldCheck, ShieldAlert, ActivitySquare, Terminal, Eye, EyeOff, Pencil,
    Copy, Check, FileCode2, Tag, Hash, PlugZap, Loader2,
    CheckCircle2, XCircle,
} from "lucide-react";
import * as api from "../../services/websiteApi";
import CollectorsTab from "./CollectorsTab";

const HEALTH_STYLES = {
    Healthy: { text: "text-[#16D98B]", chip: "bg-[rgba(22,217,139,0.10)] border-[rgba(22,217,139,0.25)]", dot: "bg-[#16D98B]" },
    Warning: { text: "text-[#E6A93A]", chip: "bg-[rgba(230,169,58,0.10)] border-[rgba(230,169,58,0.25)]", dot: "bg-[#E6A93A]" },
    Critical: { text: "text-[#F05A5A]", chip: "bg-[rgba(240,90,90,0.10)] border-[rgba(240,90,90,0.25)]", dot: "bg-[#F05A5A]" },
    Unknown: { text: "text-[#8D9AA7]", chip: "bg-[rgba(11,14,18,0.78)] border-[rgba(255,255,255,0.085)]", dot: "bg-[#626B74]" },
};

const TABS = [
    { id: "overview", label: "Overview", icon: ActivitySquare },
    { id: "collectors", label: "Collectors", icon: PlugZap },
    { id: "verification", label: "Verification", icon: ShieldCheck },
    { id: "history", label: "Scan History", icon: Terminal },
];

const VERIFICATION_METHODS = [
    { id: "html", title: "HTML File", description: "Drop a verification file at your site root", icon: FileCode2 },
    { id: "meta", title: "Meta Tag", description: "Add a meta tag to your page <head>", icon: Tag },
    { id: "dns", title: "DNS TXT", description: "Create a TXT record for your domain", icon: Hash },
];

const METHOD_LABELS = { html: "HTML file", meta: "Meta tag", dns: "DNS TXT record" };

const formatDate = (value) => value ? new Date(value).toLocaleString() : null;

const getScoreTone = (score) => {
    if (score === null || score === undefined) return "text-[#626B74]";
    if (score >= 90) return "text-[#16D98B]";
    if (score >= 70) return "text-[#E6A93A]";
    return "text-[#F05A5A]";
};

function SectionHeading({ icon: Icon, title, subtitle, accent = "text-[#B7BEC5]" }) {
    return (
        <div className="mb-4">
            <h4 className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 ${accent}`}>
                <Icon size={13} /> {title}
            </h4>
            {subtitle && <p className="text-xs text-[#626B74] mt-1.5 leading-relaxed">{subtitle}</p>}
        </div>
    );
}

function MonoBlock({ value, fileName = null, showCopy = true, emptyLabel = "—" }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch {
            /* clipboard access denied */
        }
    };

    return (
        <div className="rounded-[12px] border border-[rgba(255,255,255,0.085)] bg-[rgba(11,14,18,0.78)] backdrop-blur-[18px] saturate-[112%] overflow-hidden transition-colors duration-150 hover:border-[rgba(255,255,255,0.14)]">
            {(fileName || showCopy) && (
                <div className="flex items-center justify-between gap-3 px-3.5 py-2 border-b border-[rgba(255,255,255,0.055)] bg-[rgba(255,255,255,0.02)]">
                    <span className="text-[11px] font-semibold text-[#B7BEC5] font-mono truncate">{fileName || "Verification Token"}</span>
                    {showCopy && (
                        <button
                            onClick={copy}
                            disabled={!value}
                            className={`inline-flex items-center gap-1 text-[11px] font-bold transition-all duration-150 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${copied ? "text-[#16D98B]" : "text-[#B7BEC5] hover:text-[#F4F6F7]"}`}
                        >
                            {copied ? <Check size={12} className="animate-pop-in" /> : <Copy size={12} />}
                            {copied ? "Copied" : "Copy"}
                        </button>
                    )}
                </div>
            )}
            <div className="px-3.5 py-3 font-mono text-xs text-[#F4F6F7] overflow-x-auto custom-scrollbar whitespace-nowrap">{value || emptyLabel}</div>
        </div>
    );
}

function SpecRow({ label, value, mono = true }) {
    return (
        <div className="flex items-center justify-between gap-4 px-3 py-2.5 border-b border-[rgba(255,255,255,0.055)] last:border-b-0 bg-[rgba(12,15,19,0.62)] backdrop-blur-[22px] saturate-[118%]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#626B74] shrink-0">{label}</span>
            <span className={`text-[#F4F6F7] truncate ${mono ? "mono-value" : "text-xs"}`}>{value}</span>
        </div>
    );
}

function InlineCode({ children }) {
    return <code className="px-1.5 py-0.5 rounded-[10px] bg-[rgba(11,14,18,0.78)] border border-[rgba(255,255,255,0.085)] font-mono text-[11px] text-[#F4F6F7]">{children}</code>;
}

function MethodInstructions({ method, token, domain }) {
    if (method === "html") {
        return (
            <div className="space-y-3 animate-fade-in-up">
                <p className="text-xs text-[#B7BEC5] leading-relaxed">
                    Create a file named <InlineCode>sentinel_verify.html</InlineCode> and place it in the root directory of your website — it must be reachable at{" "}
                    <InlineCode>/sentinel_verify.html</InlineCode>.
                </p>
                <MonoBlock fileName="sentinel_verify.html" value={token || ""} emptyLabel="Token unavailable" />
            </div>
        );
    }

    if (method === "meta") {
        return (
            <div className="space-y-3 animate-fade-in-up">
                <p className="text-xs text-[#B7BEC5] leading-relaxed">
                    Paste this meta tag between the <InlineCode>&lt;head&gt;</InlineCode> tags of your site's homepage.
                </p>
                <MonoBlock
                    fileName="index.html"
                    value={token ? `<meta name="sentinel-verification" content="${token}">` : ""}
                    emptyLabel="Token unavailable"
                />
            </div>
        );
    }

    return (
        <div className="space-y-3 animate-fade-in-up">
            <p className="text-xs text-[#B7BEC5] leading-relaxed">
                Create a TXT record at your DNS provider for <InlineCode>{domain || "your domain"}</InlineCode>.
            </p>
            <div className="rounded-[12px] border border-[rgba(255,255,255,0.085)] overflow-hidden">
                <SpecRow label="Type" value="TXT" />
                <SpecRow label="Host / Name" value="@" />
                <SpecRow label="Value" value={token || "Token unavailable"} />
                <SpecRow label="TTL" value="3600" mono={false} />
            </div>
        </div>
    );
}



export default function WebsiteDetailsDrawer({ website, onClose, onEdit, onRefresh }) {
    const [site, setSite] = useState(website);
    const [activeTab, setActiveTab] = useState("overview");
    const [verifyMethod, setVerifyMethod] = useState("html");
    const [verifying, setVerifying] = useState(false);
    const [verifyResult, setVerifyResult] = useState(null);
    const [previousId, setPreviousId] = useState(website?.id ?? null);
    if (website && website.id !== previousId) {
        setPreviousId(website.id);
        setSite(website);
        setActiveTab("overview");
        setVerifyMethod("html");
        setVerifyResult(null);
    }

    useEffect(() => {
        if (!website) return;
        const handleKeyDown = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [website, onClose]);

    useEffect(() => {
        if (!website?.id) return;
        let cancelled = false;
        api.getVerificationToken(website.id)
            .then((data) => {
                if (cancelled || !data) return;
                setSite(prev => prev ? {
                    ...prev,
                    verificationToken: data.verification_token || prev.verificationToken,
                    verified: data.verified ?? prev.verified,
                    verificationMethod: data.verification_method || prev.verificationMethod,
                    verifiedAt: data.verified_at || prev.verifiedAt,
                } : prev);
            })
            .catch(() => { });
        return () => { cancelled = true; };
    }, [website?.id]);

    if (!website) return null;

    const tags = website.tags ? website.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    const health = HEALTH_STYLES[website.health] || HEALTH_STYLES.Unknown;
    const isActive = website.status === "Active";
    const token = site?.verificationToken || website.verificationToken;

    const handleTabClick = (tabId) => {
        setActiveTab(tabId);
    };

    const handleVerify = async () => {
        if (!site || verifying) return;
        if (!token) {
            setVerifyResult({
                success: false,
                message: "Verification token unavailable. Please refresh and try again.",
            });
            return;
        }
        setVerifying(true);
        setVerifyResult(null);
        try {
            const result = await api.verifyWebsite(site.id, verifyMethod);
            setVerifyResult({
                success: !!result?.success,
                message: result?.message || (result?.success ? "Website ownership verified successfully." : "Verification failed. Check that the file, tag or record is live, then try again."),
            });
            if (result?.success) {
                setSite(prev => prev ? { ...prev, verified: true, verificationMethod: verifyMethod, verifiedAt: new Date().toISOString() } : prev);
                onRefresh?.();
            }
        } catch (error) {
            setVerifyResult({ success: false, message: error.message || "Verification request failed. Please try again." });
        } finally {
            setVerifying(false);
        }
    };

    return (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={`Details for ${website.name}`}>
            <div
                className="absolute inset-0 bg-[rgba(0,0,0,0.75)] backdrop-blur-md animate-backdrop-in"
                onClick={onClose}
            />

            <div className="absolute inset-y-0 right-0 w-full max-w-lg bg-[rgba(8,11,14,0.68)] backdrop-blur-[28px] saturate-[125%] border-l border-[rgba(255,255,255,0.085)] shadow-[0_24px_70px_rgba(0,0,0,0.38)] animate-drawer-in flex flex-col rounded-l-[24px] overflow-hidden">
                <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.065), rgba(255,255,255,0) 38%)" }}></div>
                
                <div className="shrink-0 p-6 pb-0 relative z-10">
                    <div className="flex justify-between items-start gap-3">
                        <div className="flex gap-4 items-center min-w-0">
                            <div className="w-12 h-12 rounded-[12px] bg-[rgba(12,15,19,0.62)] border border-[rgba(255,255,255,0.085)] flex items-center justify-center overflow-hidden shrink-0">
                                {website.faviconUrl ? (
                                    <img src={website.faviconUrl} alt="" className="w-6 h-6 object-contain" />
                                ) : (
                                    <Globe size={22} className="text-[#858E97]" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-lg font-bold text-[#F4F6F7] leading-tight truncate">{website.name}</h2>
                                <a
                                    href={safeHttpUrl(website.url)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mono-value text-[#B7BEC5] hover:text-[#F4F6F7] flex items-center gap-1 mt-1 transition-colors duration-150"
                                >
                                    <span className="truncate">{website.domain}</span>
                                    <ExternalLink size={12} className="shrink-0" />
                                </a>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            aria-label="Close details"
                            className="p-2 text-[#858E97] hover:text-[#F4F6F7] bg-[rgba(11,14,18,0.78)] rounded-full transition-colors duration-150 active:opacity-70 border border-[rgba(255,255,255,0.055)]"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${isActive ? "bg-[rgba(22,217,139,0.10)] border-[rgba(22,217,139,0.25)] text-[#16D98B]" : "bg-[rgba(11,14,18,0.78)] border-[rgba(255,255,255,0.085)] text-[#B7BEC5]"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-[#16D98B]" : "bg-[#626B74]"}`} />
                            {website.status}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[rgba(11,14,18,0.78)] border border-[rgba(255,255,255,0.085)] text-[#B7BEC5]">
                            <Server size={11} /> {website.environment}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${health.chip} ${health.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${health.dot}`} />
                            {website.health}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${website.monitoringEnabled ? "bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.085)] text-[#F4F6F7]" : "bg-[rgba(11,14,18,0.78)] border-[rgba(255,255,255,0.055)] text-[#626B74]"}`}>
                            {website.monitoringEnabled ? <Eye size={11} /> : <EyeOff size={11} />}
                            {website.monitoringEnabled ? "Monitoring" : "Unmonitored"}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${site?.verified ? "bg-[rgba(22,217,139,0.10)] border-[rgba(22,217,139,0.25)] text-[#16D98B]" : "bg-[rgba(11,14,18,0.78)] border-[rgba(255,255,255,0.085)] text-[#B7BEC5]"}`}>
                            {site?.verified ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
                            {site?.verified ? "Verified" : "Unverified"}
                        </span>
                    </div>
                </div>

                <div role="tablist" aria-label="Website details" className="shrink-0 mt-4 px-6 border-b border-[rgba(255,255,255,0.055)] flex items-stretch gap-1 overflow-x-auto custom-scrollbar relative z-10">
                    {TABS.map(tab => {
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                role="tab"
                                id={`drawer-tab-${tab.id}`}
                                aria-selected={active}
                                aria-controls={`drawer-panel-${tab.id}`}
                                onClick={() => handleTabClick(tab.id)}
                                className={`relative shrink-0 flex items-center gap-1.5 px-3.5 py-3 text-xs font-bold transition-colors duration-150 outline-none focus-visible:text-[#F4F6F7] ${
                                    active ? "text-[#F4F6F7]" : "text-[#858E97] hover:text-[#B7BEC5]"
                                }`}
                            >
                                <tab.icon size={13} className={active ? "text-[#F4F6F7]" : ""} />
                                {tab.label}
                                <span className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#F4F6F7] transition-opacity duration-200 ${active ? "opacity-100" : "opacity-0"}`} />
                            </button>
                        );
                    })}
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative z-10">
                    {activeTab === "overview" && (
                        <div key="overview" className="space-y-7 animate-fade-in-up">
                            <section>
                                <div className="grid grid-cols-4 divide-x divide-[rgba(255,255,255,0.055)]">
                                    <div className="pr-3">
                                        <p className="text-[11px] font-bold text-[#626B74] uppercase tracking-wider mb-1.5">Status</p>
                                        <p className={`text-sm font-bold leading-none ${isActive ? "text-[#16D98B]" : "text-[#B7BEC5]"}`}>{website.status}</p>
                                    </div>
                                    <div className="px-3 min-w-0">
                                        <p className="text-[11px] font-bold text-[#626B74] uppercase tracking-wider mb-1.5">Health</p>
                                        <p className={`inline-flex items-center gap-1.5 text-sm font-bold leading-none ${health.text}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${health.dot}`} />
                                            {website.health}
                                        </p>
                                    </div>
                                    <div className="px-3 min-w-0">
                                        <p className="text-[11px] font-bold text-[#626B74] uppercase tracking-wider mb-1.5">Environment</p>
                                        <p className="text-sm font-bold text-[#B7BEC5] leading-none truncate">{website.environment}</p>
                                    </div>
                                    <div className="pl-3">
                                        <p className="text-[11px] font-bold text-[#626B74] uppercase tracking-wider mb-1.5">Score</p>
                                        <p className={`text-xl font-bold tabular-nums leading-none ${getScoreTone(website.securityScore)}`}>
                                            {website.securityScore ?? "—"}
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h4 className="text-[11px] font-bold text-[#626B74] uppercase tracking-wider border-b border-[rgba(255,255,255,0.055)] pb-2 mb-1">Technical Record</h4>
                                <div className="rounded-[12px] border border-[rgba(255,255,255,0.085)] overflow-hidden">
                                    <SpecRow label="Hostname / URL" value={website.domain} />
                                    <SpecRow label="IP Address" value={website.ipAddress || "Unresolved"} />
                                    <SpecRow label="Owner" value={website.owner || "No owner assigned"} mono={false} />
                                    <SpecRow label="Last Scanned" value={website.lastScan ? new Date(website.lastScan).toLocaleString() : "Never scanned"} mono={false} />
                                    <SpecRow label="Ownership" value={site?.verified ? `Verified via ${METHOD_LABELS[site?.verificationMethod] || "unknown method"}` : "Not verified"} mono={false} />
                                </div>
                            </section>

                            {website.description && (
                                <section>
                                    <h4 className="text-[11px] font-bold text-[#626B74] uppercase tracking-wider border-b border-[rgba(255,255,255,0.055)] pb-2 mb-3">Description</h4>
                                    <p className="text-sm text-[#B7BEC5] leading-relaxed">{website.description}</p>
                                </section>
                            )}

                            {tags.length > 0 && (
                                <section>
                                    <h4 className="text-[11px] font-bold text-[#626B74] uppercase tracking-wider border-b border-[rgba(255,255,255,0.055)] pb-2 mb-3">Tags</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {tags.map((tag, idx) => (
                                            <span
                                                key={idx}
                                                style={{ animationDelay: `${idx * 40}ms` }}
                                                className="mono-value px-2.5 py-1 rounded-[10px] bg-[rgba(11,14,18,0.78)] border border-[rgba(255,255,255,0.085)] text-[#B7BEC5] animate-fade-in-up transition-colors duration-150 hover:text-[#F4F6F7]"
                                            >
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    )}

                    {activeTab === "collectors" && (
                        <section key="collectors" className="animate-fade-in-up">
                            <SectionHeading
                                icon={PlugZap}
                                title="Collectors"
                                accent="text-[#B7BEC5]"
                                subtitle="Telemetry agents and collectors forwarding security signals to this protected asset."
                            />
                            <CollectorsTab
                                website={site || website}
                                onRefreshWebsite={onRefresh}
                            />
                        </section>
                    )}

                    {activeTab === "verification" && (
                        <section key="verification" className="space-y-6 animate-fade-in-up">
                            <SectionHeading
                                icon={ShieldCheck}
                                title="Protected Website Ownership Verification"
                                accent="text-[#16D98B]"
                                subtitle="Confirm you control this domain before running security scans against it."
                            />

                            {website.exposure === "internal" ? (
                                <div className="rounded-[12px] border border-[rgba(255,255,255,0.085)] bg-[rgba(11,14,18,0.78)] p-6 text-center space-y-2">
                                    <ShieldAlert size={28} className="mx-auto text-[#E6A93A]" />
                                    <h4 className="text-sm font-bold text-[#F4F6F7]">Scanning is not available for internal assets</h4>
                                    <p className="text-xs text-[#858E97] leading-relaxed max-w-sm mx-auto">
                                        This protected website is configured with internal network exposure (monitor only). Ownership verification and remote vulnerability scanning are disabled.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className={`rounded-[12px] border p-5 flex items-start gap-4 transition-colors duration-300 ${site?.verified ? "bg-[rgba(22,217,139,0.07)] border-[rgba(22,217,139,0.25)]" : "bg-[rgba(240,90,90,0.06)] border-[rgba(240,90,90,0.25)]"}`}>
                                        <div className={`p-2.5 rounded-[10px] shrink-0 border ${site?.verified ? "bg-[rgba(22,217,139,0.12)] text-[#16D98B] border-[rgba(22,217,139,0.30)]" : "bg-[rgba(240,90,90,0.12)] text-[#F05A5A] border-[rgba(240,90,90,0.30)]"}`}>
                                            {site?.verified ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className={`text-sm font-bold flex items-center gap-2 ${site?.verified ? "text-[#16D98B]" : "text-[#F05A5A]"}`}>
                                                {site?.verified ? "Verified" : "Ownership not verified"}
                                                {site?.verified && <CheckCircle2 size={14} className="text-[#16D98B]" />}
                                            </h4>
                                            <p className="text-xs text-[#B7BEC5] mt-1 leading-relaxed">
                                                {site?.verified
                                                    ? `Ownership confirmed via ${METHOD_LABELS[site?.verificationMethod] || "an unknown method"}.`
                                                    : "Only verified domains can be scanned."}
                                            </p>
                                            {site?.verifiedAt && (
                                                <p className="text-[11px] text-[#858E97] mt-1.5 font-medium">Verified {formatDate(site?.verifiedAt)}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#626B74] mb-2">Verification Token</h4>
                                        <MonoBlock value={token || ""} emptyLabel="Token unavailable" />
                                        <p className="text-[11px] text-[#626B74] mt-2 leading-relaxed">
                                            This token is unique to <span className="text-[#F4F6F7] font-semibold">{website.domain}</span> and is checked when you verify ownership.
                                        </p>
                                    </div>

                                    <div>
                                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#626B74] mb-2.5">Verification Method</h4>
                                        <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Verification method">
                                            {VERIFICATION_METHODS.map(method => {
                                                const selected = verifyMethod === method.id;
                                                return (
                                                    <button
                                                        key={method.id}
                                                        role="radio"
                                                        aria-checked={selected}
                                                        onClick={() => setVerifyMethod(method.id)}
                                                        className={`group flex flex-col items-start gap-2 p-3.5 rounded-[12px] border text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[#F4F6F7] ${
                                                            selected
                                                                ? "bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.24)]"
                                                                : "bg-[rgba(11,14,18,0.78)] border-[rgba(255,255,255,0.085)] hover:border-[rgba(255,255,255,0.14)] hover:bg-[rgba(12,15,19,0.62)]"
                                                        }`}
                                                    >
                                                        <method.icon size={16} className={selected ? "text-[#F4F6F7]" : "text-[#858E97] group-hover:text-[#F4F6F7] transition-colors duration-150"} />
                                                        <span className="text-xs font-bold text-[#F4F6F7]">{method.title}</span>
                                                        <span className="text-[10px] text-[#858E97] leading-snug">{method.description}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="mt-3">
                                            <MethodInstructions method={verifyMethod} token={token} domain={website.domain} />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <button
                                            onClick={handleVerify}
                                            disabled={verifying}
                                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#F4F6F7] hover:bg-white text-[#050607] rounded-[10px] text-sm font-bold transition-colors duration-150 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {verifying ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                                            {verifying ? "Verifying ownership…" : "Verify Now"}
                                        </button>

                                        {verifyResult && (
                                            <div
                                                role="status"
                                                className={`flex items-start gap-2.5 px-3.5 py-3 rounded-[12px] border text-xs font-semibold leading-relaxed animate-fade-in-up ${
                                                    verifyResult.success
                                                        ? "bg-[rgba(22,217,139,0.10)] border-[rgba(22,217,139,0.25)] text-[#16D98B]"
                                                        : "bg-[rgba(240,90,90,0.10)] border-[rgba(240,90,90,0.25)] text-[#F05A5A]"
                                                }`}
                                            >
                                                {verifyResult.success ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> : <XCircle size={15} className="shrink-0 mt-0.5" />}
                                                <span>{verifyResult.message}</span>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </section>
                    )}

                    {activeTab === "history" && (
                        <section key="history" className="animate-fade-in-up">
                            <SectionHeading
                                icon={Terminal}
                                title="Scan History"
                                accent="text-[#B7BEC5]"
                                subtitle="Past scans and findings for this target will appear here."
                            />
                            {website.exposure === "internal" ? (
                                <div className="rounded-[12px] border border-[rgba(255,255,255,0.085)] bg-[rgba(11,14,18,0.78)] p-6 text-center space-y-2">
                                    <Terminal size={28} className="mx-auto text-[#858E97] opacity-60" />
                                    <h4 className="text-sm font-bold text-[#F4F6F7]">Scanning is not available for internal assets</h4>
                                    <p className="text-xs text-[#858E97] leading-relaxed max-w-sm mx-auto">
                                        Internal assets are monitor-only and cannot be targeted by external scanner engines.
                                    </p>
                                </div>
                            ) : (
                                <div className="relative w-full h-36 rounded-[12px] bg-[rgba(12,15,19,0.62)] border border-[rgba(255,255,255,0.055)] border-dashed flex flex-col items-center justify-center text-[#626B74] hover:border-[rgba(255,255,255,0.085)] transition-colors duration-150">
                                    <Terminal size={24} className="mb-2 opacity-50" />
                                    <span className="text-xs font-semibold">Future Analytics Module Integration</span>
                                </div>
                            )}
                        </section>
                    )}
                </div>

                <div className="shrink-0 p-6 border-t border-[rgba(255,255,255,0.055)] bg-[rgba(11,14,18,0.78)] backdrop-blur-[18px] flex gap-3 relative z-10">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-[rgba(12,15,19,0.62)] hover:bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.085)] text-[#F4F6F7] rounded-[10px] text-sm font-semibold transition-colors duration-150 active:opacity-70"
                    >
                        Close
                    </button>
                    <button
                        onClick={() => onEdit(website)}
                        className="flex-1 px-4 py-2.5 bg-[#F4F6F7] hover:bg-white text-[#050607] rounded-[10px] text-sm font-bold flex items-center justify-center gap-2 transition-colors duration-150 active:scale-[0.98]"
                    >
                        <Pencil size={14} />
                        Edit Protected Website
                    </button>
                </div>
            </div>
        </div>
    );
}
