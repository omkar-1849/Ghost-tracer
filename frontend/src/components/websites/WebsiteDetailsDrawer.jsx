import { useEffect, useState } from "react";
import {
    X, ExternalLink, Globe, Calendar, User, Server, HeartPulse,
    ShieldCheck, ShieldAlert, ActivitySquare, Database, Terminal, Eye, EyeOff, Pencil,
    Copy, Check, FileCode2, Tag, Hash, PlugZap, KeyRound, Loader2,
    RotateCcw, Unplug, CheckCircle2, XCircle, Info, Link2,
} from "lucide-react";
import * as api from "../../services/websiteApi";

const HEALTH_STYLES = {
    Healthy: { text: "text-[var(--color-success)]", chip: "bg-[rgba(85,176,123,0.10)] border-[rgba(85,176,123,0.25)]", dot: "bg-[var(--color-success)]" },
    Warning: { text: "text-[var(--color-warning)]", chip: "bg-[rgba(201,146,61,0.10)] border-[rgba(201,146,61,0.25)]", dot: "bg-[var(--color-warning)]" },
    Critical: { text: "text-[var(--color-critical)]", chip: "bg-[rgba(223,91,91,0.10)] border-[rgba(223,91,91,0.25)]", dot: "bg-[var(--color-critical)]" },
    Unknown: { text: "text-[var(--color-text-secondary)]", chip: "bg-[var(--color-surface-2)] border-[var(--color-border-default)]", dot: "bg-[var(--color-text-disabled)]" },
};

const TABS = [
    { id: "overview", label: "Overview", icon: ActivitySquare },
    { id: "integration", label: "Integration", icon: PlugZap },
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

/* Semantic score tone — green means healthy, never "selected". */
const getScoreTone = (score) => {
    if (score === null || score === undefined) return "text-[var(--color-text-muted)]";
    if (score >= 90) return "text-[var(--color-success)]";
    if (score >= 70) return "text-[var(--color-warning)]";
    return "text-[var(--color-critical)]";
};

/* ---------- Small reusable pieces ---------- */

function SectionHeading({ icon: Icon, title, subtitle, accent = "text-[var(--color-text-secondary)]" }) {
    return (
        <div className="mb-4">
            <h4 className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 ${accent}`}>
                <Icon size={13} /> {title}
            </h4>
            {subtitle && <p className="text-xs text-[var(--color-text-muted)] mt-1.5 leading-relaxed">{subtitle}</p>}
        </div>
    );
}

/** Monospace copyable code block used for tokens, files and snippets. */
function MonoBlock({ value, fileName = null, showCopy = true, emptyLabel = "—" }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch { /* clipboard unavailable */ }
    };

    return (
        <div className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas)] overflow-hidden transition-colors duration-150 hover:border-[var(--color-border-strong)]">
            {(fileName || showCopy) && (
                <div className="flex items-center justify-between gap-3 px-3.5 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-1)]">
                    <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] font-mono truncate">{fileName || "Verification Token"}</span>
                    {showCopy && (
                        <button
                            onClick={copy}
                            disabled={!value}
                            className={`inline-flex items-center gap-1 text-[11px] font-bold transition-all duration-150 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${copied ? "text-[var(--color-success)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
                        >
                            {copied ? <Check size={12} className="animate-pop-in" /> : <Copy size={12} />}
                            {copied ? "Copied" : "Copy"}
                        </button>
                    )}
                </div>
            )}
            <div className="px-3.5 py-3 font-mono text-xs text-[var(--color-info)] overflow-x-auto custom-scrollbar whitespace-nowrap">{value || emptyLabel}</div>
        </div>
    );
}

function SpecRow({ label, value, mono = true }) {
    return (
        <div className="flex items-center justify-between gap-4 px-0.5 py-2.5 border-b border-[var(--color-border-subtle)] last:border-b-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] shrink-0">{label}</span>
            <span className={`text-[var(--color-text-primary)] truncate ${mono ? "mono-value" : "text-xs"}`}>{value}</span>
        </div>
    );
}

function InlineCode({ children }) {
    return <code className="px-1.5 py-0.5 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border-default)] font-mono text-[11px] text-[var(--color-info)]">{children}</code>;
}

/* ---------- Verification tab ---------- */

function MethodInstructions({ method, token, domain }) {
    if (method === "html") {
        return (
            <div className="space-y-3 animate-fade-in-up">
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    Create a file named <InlineCode>sentinel_verify.html</InlineCode> and place it in the root directory of your website — it must be reachable at{" "}
                    <InlineCode>/sentinel_verify.html</InlineCode>.
                </p>
                <MonoBlock fileName="sentinel_verify.html" value={token} />
            </div>
        );
    }

    if (method === "meta") {
        return (
            <div className="space-y-3 animate-fade-in-up">
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    Paste this meta tag between the <InlineCode>&lt;head&gt;</InlineCode> tags of your site's homepage.
                </p>
                <MonoBlock
                    fileName="index.html"
                    value={`<meta name="sentinel-verification" content="${token}">`}
                    emptyLabel="Token unavailable"
                />
            </div>
        );
    }

    // DNS TXT
    return (
        <div className="space-y-3 animate-fade-in-up">
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Create a TXT record at your DNS provider for <InlineCode>{domain || "your domain"}</InlineCode>.
            </p>
            <div className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas)] overflow-hidden">
                <SpecRow label="Type" value="TXT" />
                <SpecRow label="Host / Name" value="@" />
                <SpecRow label="Value" value={token} />
                <SpecRow label="TTL" value="3600" mono={false} />
            </div>
        </div>
    );
}

/* ---------- Integration tab ---------- */

function IntegrationTab({ integration, integrationError, keys, connecting, regenerating, disconnecting, onConnect, onRegenerate, onDisconnect }) {
    const connected = !!integration && integration.status === "Connected";

    if (integration === undefined) {
        return (
            <div className="flex items-center gap-3 p-5 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] text-sm text-[var(--color-text-secondary)] animate-fade-in-up">
                <Loader2 size={16} className="animate-spin text-[var(--color-info)]" />
                Loading integration…
            </div>
        );
    }

    if (!connected) {
        return (
            <div className="rounded-lg border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-1)] p-6 text-center animate-fade-in-up">
                <div className="mx-auto w-12 h-12 rounded-lg bg-[var(--color-info)] border border-[var(--color-info)] flex items-center justify-center mb-3">
                    <PlugZap size={22} className="text-[var(--color-info)]" />
                </div>
                <h4 className="text-sm font-bold text-[var(--color-text-primary)]">No active SDK integration</h4>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1.5 leading-relaxed max-w-[260px] mx-auto">
                    Generate an API key + secret pair to authenticate the Sentinel SDK for this website.
                </p>
                {integrationError && (
                    <p className="mt-3 text-xs font-semibold text-[var(--color-critical)] bg-[rgba(223,91,91,0.10)] border border-[rgba(223,91,91,0.25)] rounded-lg px-3 py-2 inline-flex items-center gap-1.5">
                        <XCircle size={13} /> {integrationError}
                    </p>
                )}
                <button
                    onClick={onConnect}
                    disabled={connecting}
                    className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-foreground)] rounded-md text-sm font-bold transition-colors duration-150 active:scale-[0.98] disabled:opacity-50"
                >
                    {connecting ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                    {connecting ? "Connecting…" : "Connect Website"}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in-up">
            {/* Status */}
            <div className="rounded-lg border border-[var(--color-success)] bg-[var(--color-success)] p-4 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[var(--color-success)] border border-[var(--color-success)] text-[var(--color-success)] shrink-0">
                    <PlugZap size={16} />
                </div>
                <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-success)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" /> Connected
                    </span>
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                        The Sentinel SDK is authorized to push security events for this website.
                    </p>
                </div>
            </div>

            {/* Credentials */}
            {keys && (
                <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] pt-1">
                        <KeyRound size={12} className="text-[var(--color-info)]" /> Credentials
                    </div>
                    <div className="space-y-2.5">
                        <div className="space-y-1">
                            <span className="text-[11px] font-semibold text-[var(--color-text-muted)] px-0.5">API Key</span>
                            <MonoBlock value={keys.api_key} />
                        </div>
                        <div className="space-y-1">
                            <span className="text-[11px] font-semibold text-[var(--color-text-muted)] px-0.5">API Secret</span>
                            <MonoBlock value={keys.api_secret} />
                        </div>
                    </div>
                    <p className="flex items-start gap-1.5 text-[11px] text-[var(--color-warning)] leading-relaxed pt-0.5">
                        <Info size={12} className="shrink-0 mt-0.5" />
                        Store these credentials securely — the secret is only shown once.
                    </p>
                </div>
            )}

            {/* Meta */}
            <div className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-canvas)] overflow-hidden">
                <SpecRow label="Status" value={integration.status} />
                <SpecRow label="Created" value={formatDate(integration.created_at)} mono={false} />
                <SpecRow label="Last used" value={formatDate(integration.last_used) || "Never"} mono={false} />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2.5 pt-1">
                <button
                    onClick={onRegenerate}
                    disabled={regenerating}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-bold text-[var(--color-text-primary)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border-default)] transition-colors duration-150 active:opacity-70 disabled:opacity-50"
                >
                    {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                    {regenerating ? "Regenerating…" : "Regenerate Keys"}
                </button>
                <button
                    onClick={onDisconnect}
                    disabled={disconnecting}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-bold text-[var(--color-critical)] bg-[rgba(223,91,91,0.10)] hover:bg-[rgba(223,91,91,0.20)] border border-[rgba(223,91,91,0.25)] transition-colors duration-150 active:opacity-70 disabled:opacity-50"
                >
                    {disconnecting ? <Loader2 size={14} className="animate-spin" /> : <Unplug size={14} />}
                    {disconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
            </div>
        </div>
    );
}

/* ---------- Drawer ---------- */

export default function WebsiteDetailsDrawer({ website, onClose, onEdit, onRefresh }) {
    const [site, setSite] = useState(website);
    const [activeTab, setActiveTab] = useState("overview");

    // Verification state
    const [verifyMethod, setVerifyMethod] = useState("html");
    const [verifying, setVerifying] = useState(false);
    const [verifyResult, setVerifyResult] = useState(null);

    // Integration state
    // `undefined` = not loaded yet (show loader), `null` = disconnected, object = record.
    const [integration, setIntegration] = useState(undefined);
    const [integrationError, setIntegrationError] = useState(null);
    const [keys, setKeys] = useState(null);
    const [connecting, setConnecting] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);

    // When a different website is opened, reset all per-website state.
    const [previousId, setPreviousId] = useState(website?.id ?? null);
    if (website && website.id !== previousId) {
        setPreviousId(website.id);
        setSite(website);
        setActiveTab("overview");
        setVerifyMethod("html");
        setVerifyResult(null);
        setIntegration(undefined);
        setIntegrationError(null);
        setKeys(null);
    }

    // Close on Escape
    useEffect(() => {
        if (!website) return;
        const handleKeyDown = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [website, onClose]);

    // Fetch a fresh verification token / status (handles legacy records).
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
            .catch(() => { /* backend may be offline — fall back to list payload */ });
        return () => { cancelled = true; };
    }, [website?.id]);

    // Load integration record when the tab is opened.
    useEffect(() => {
        if (activeTab !== "integration" || !website?.id) return;
        let cancelled = false;
        api.getIntegration(website.id)
            .then((data) => { if (!cancelled) setIntegration(data); })
            .catch(() => { if (!cancelled) setIntegration(null); });
        return () => { cancelled = true; };
    }, [activeTab, website?.id]);

    if (!website) return null;

    const tags = website.tags ? website.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    const health = HEALTH_STYLES[website.health] || HEALTH_STYLES.Unknown;
    const isActive = website.status === "Active";
    const token = site?.verificationToken || website.verificationToken;

    const handleTabClick = (tabId) => {
        setActiveTab(tabId);
        if (tabId === "integration") {
            // Show the loader on every open while we re-fetch the record.
            setIntegration(undefined);
            setIntegrationError(null);
        }
    };

    const handleVerify = async () => {
        if (!site || verifying) return;
        setVerifying(true);
        setVerifyResult(null);
        try {
            const result = await api.verifyWebsite(site.id, verifyMethod);
            setVerifyResult({
                success: !!result?.success,
                message: result?.message || (result?.success ? "Website ownership verified successfully." : "Verification failed. Check that the file, tag or record is live, then try again."),
            });
            if (result?.success) {
                // Reflect the new state immediately, then let the parent refresh the list.
                setSite(prev => prev ? { ...prev, verified: true, verificationMethod: verifyMethod, verifiedAt: new Date().toISOString() } : prev);
                onRefresh?.();
            }
        } catch (error) {
            setVerifyResult({ success: false, message: error.message || "Verification request failed. Please try again." });
        } finally {
            setVerifying(false);
        }
    };

    const handleConnect = async () => {
        setConnecting(true);
        setIntegrationError(null);
        try {
            const newKeys = await api.connectWebsite(site.id);
            setKeys(newKeys);
            setIntegration({ status: "Connected" });
        } catch (error) {
            setIntegrationError(error.message || "Failed to connect the website.");
        } finally {
            setConnecting(false);
        }
    };

    const handleRegenerate = async () => {
        setRegenerating(true);
        try {
            const result = await api.regenerateIntegrationKeys(site.id);
            setKeys({ api_key: result.api_key, api_secret: result.api_secret });
        } catch (error) {
            setIntegrationError(error.message || "Failed to regenerate keys.");
        } finally {
            setRegenerating(false);
        }
    };

    const handleDisconnect = async () => {
        setDisconnecting(true);
        try {
            await api.disconnectWebsite(site.id);
            setIntegration(null);
            setKeys(null);
        } catch (error) {
            setIntegrationError(error.message || "Failed to disconnect the website.");
        } finally {
            setDisconnecting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={`Details for ${website.name}`}>
            {/* Backdrop — dims and blurs; the workspace stays visible behind */}
            <div
                className="absolute inset-0 bg-[var(--color-overlay)] backdrop-blur-[2px] animate-backdrop-in"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="absolute inset-y-0 right-0 w-full max-w-lg bg-[var(--color-canvas)] border-l border-[var(--color-border-default)] rounded-l-xl shadow-[var(--shadow-3)] animate-drawer-in flex flex-col">
                {/* Header */}
                <div className="shrink-0 p-6 pb-0">
                    <div className="flex justify-between items-start gap-3">
                        <div className="flex gap-4 items-center min-w-0">
                            {/* Favicon */}
                            <div className="w-12 h-12 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border-subtle)] flex items-center justify-center overflow-hidden shrink-0">
                                {website.faviconUrl ? (
                                    <img src={website.faviconUrl} alt="" className="w-6 h-6 object-contain" />
                                ) : (
                                    <Globe size={22} className="text-[var(--color-text-secondary)]" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-lg font-bold text-[var(--color-text-primary)] leading-tight truncate">{website.name}</h2>
                                <a
                                    href={website.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mono-value text-[var(--color-info)] hover:text-[var(--color-accent-hover)] flex items-center gap-1 mt-1 transition-colors duration-150"
                                >
                                    <span className="truncate">{website.domain}</span>
                                    <ExternalLink size={12} className="shrink-0" />
                                </a>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            aria-label="Close details"
                            className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] rounded-full transition-colors duration-150 active:opacity-70"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Status ribbon */}
                    <div className="flex flex-wrap items-center gap-2 mt-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${isActive ? "bg-[rgba(85,176,123,0.10)] border-[rgba(85,176,123,0.25)] text-[var(--color-success)]" : "bg-[var(--color-surface-2)] border-[var(--color-border-default)] text-[var(--color-text-secondary)]"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-[var(--color-success)]" : "bg-[var(--color-text-disabled)]"}`} />
                            {website.status}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[rgba(138,166,189,0.10)] border border-[rgba(138,166,189,0.25)] text-[var(--color-low)]">
                            <Server size={11} /> {website.environment}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${health.chip} ${health.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${health.dot}`} />
                            {website.health}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${website.monitoringEnabled ? "bg-[rgba(138,148,140,0.10)] border-[rgba(138,148,140,0.25)] text-[var(--color-info)]" : "bg-[var(--color-surface-2)] border-[var(--color-border-default)] text-[var(--color-text-muted)]"}`}>
                            {website.monitoringEnabled ? <Eye size={11} /> : <EyeOff size={11} />}
                            {website.monitoringEnabled ? "Monitoring" : "Unmonitored"}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${site?.verified ? "bg-[rgba(85,176,123,0.10)] border-[rgba(85,176,123,0.25)] text-[var(--color-success)]" : "bg-[var(--color-surface-2)] border-[var(--color-border-default)] text-[var(--color-text-secondary)]"}`}>
                            {site?.verified ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
                            {site?.verified ? "Verified" : "Unverified"}
                        </span>
                    </div>
                </div>

                {/* Tabs */}
                <div role="tablist" aria-label="Website details" className="shrink-0 mt-4 px-6 border-b border-[var(--color-border-subtle)] flex items-stretch gap-1 overflow-x-auto custom-scrollbar">
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
                                className={`relative shrink-0 flex items-center gap-1.5 px-3.5 py-3 text-xs font-bold transition-colors duration-150 outline-none focus-visible:text-[var(--color-text-primary)] ${
                                    active ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                                }`}
                            >
                                <tab.icon size={13} className={active ? "text-[var(--color-signal)]" : ""} />
                                {tab.label}
                                <span className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--color-signal)] transition-opacity duration-200 ${active ? "opacity-100" : "opacity-0"}`} />
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {/* ---------- Overview ---------- */}
                    {activeTab === "overview" && (
                        <div key="overview" className="space-y-7 animate-fade-in-up">
                            {/* Posture readout — typographic cluster, no cards */}
                            <section>
                                <div className="grid grid-cols-4 divide-x divide-[var(--color-border-subtle)]">
                                    <div className="pr-3">
                                        <p className="section-label mb-1.5">Status</p>
                                        <p className={`text-sm font-bold leading-none ${isActive ? "text-[var(--color-success)]" : "text-[var(--color-text-secondary)]"}`}>{website.status}</p>
                                    </div>
                                    <div className="px-3 min-w-0">
                                        <p className="section-label mb-1.5">Health</p>
                                        <p className={`inline-flex items-center gap-1.5 text-sm font-bold leading-none ${health.text}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${health.dot}`} />
                                            {website.health}
                                        </p>
                                    </div>
                                    <div className="px-3 min-w-0">
                                        <p className="section-label mb-1.5">Environment</p>
                                        <p className="text-sm font-bold text-[var(--color-low)] leading-none truncate">{website.environment}</p>
                                    </div>
                                    <div className="pl-3">
                                        <p className="section-label mb-1.5">Score</p>
                                        <p className={`text-xl font-bold tabular-nums leading-none ${getScoreTone(website.securityScore)}`}>
                                            {website.securityScore ?? "—"}
                                        </p>
                                    </div>
                                </div>
                            </section>

                            {/* Technical record — hairline spec rows */}
                            <section>
                                <h4 className="section-label border-b border-[var(--color-border-subtle)] pb-2 mb-1">Technical Record</h4>
                                <SpecRow label="Hostname / URL" value={website.domain} />
                                <SpecRow label="IP Address" value={website.ipAddress || "Unresolved"} />
                                <SpecRow label="Owner" value={website.owner || "No owner assigned"} mono={false} />
                                <SpecRow label="Last Scanned" value={website.lastScan ? new Date(website.lastScan).toLocaleString() : "Never scanned"} mono={false} />
                                <SpecRow label="Ownership" value={site?.verified ? `Verified via ${METHOD_LABELS[site?.verificationMethod] || "unknown method"}` : "Not verified"} mono={false} />
                            </section>

                            {website.description && (
                                <section>
                                    <h4 className="section-label border-b border-[var(--color-border-subtle)] pb-2 mb-3">Description</h4>
                                    <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{website.description}</p>
                                </section>
                            )}

                            {tags.length > 0 && (
                                <section>
                                    <h4 className="section-label border-b border-[var(--color-border-subtle)] pb-2 mb-3">Tags</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {tags.map((tag, idx) => (
                                            <span
                                                key={idx}
                                                style={{ animationDelay: `${idx * 40}ms` }}
                                                className="mono-value px-2.5 py-1 rounded-md bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] animate-fade-in-up transition-colors duration-150 hover:text-[var(--color-text-primary)]"
                                            >
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    )}

                    {/* ---------- Integration ---------- */}
                    {activeTab === "integration" && (
                        <section key="integration" className="animate-fade-in-up">
                            <SectionHeading
                                icon={PlugZap}
                                title="SDK Integration"
                                accent="text-[var(--color-info)]"
                                subtitle="Connect the Sentinel SDK to stream security events and telemetry from this website."
                            />
                            <IntegrationTab
                                integration={integration}
                                integrationError={integrationError}
                                keys={keys}
                                connecting={connecting}
                                regenerating={regenerating}
                                disconnecting={disconnecting}
                                onConnect={handleConnect}
                                onRegenerate={handleRegenerate}
                                onDisconnect={handleDisconnect}
                            />
                        </section>
                    )}

                    {/* ---------- Verification ---------- */}
                    {activeTab === "verification" && (
                        <section key="verification" className="space-y-6 animate-fade-in-up">
                            <SectionHeading
                                icon={ShieldCheck}
                                title="Website Ownership Verification"
                                accent="text-[var(--color-success)]"
                                subtitle="Confirm you control this domain before running security scans against it."
                            />

                            {/* Status card */}
                            <div className={`rounded-lg border p-5 flex items-start gap-4 transition-colors duration-300 ${site?.verified ? "bg-[rgba(85,176,123,0.07)] border-[rgba(85,176,123,0.25)]" : "bg-[rgba(223,91,91,0.06)] border-[rgba(223,91,91,0.25)]"}`}>
                                <div className={`p-2.5 rounded-md shrink-0 border ${site?.verified ? "bg-[rgba(85,176,123,0.12)] text-[var(--color-success)] border-[rgba(85,176,123,0.30)]" : "bg-[rgba(223,91,91,0.12)] text-[var(--color-critical)] border-[rgba(223,91,91,0.30)]"}`}>
                                    {site?.verified ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
                                </div>
                                <div className="min-w-0">
                                    <h4 className={`text-sm font-bold flex items-center gap-2 ${site?.verified ? "text-[var(--color-success)]" : "text-[var(--color-critical)]"}`}>
                                        {site?.verified ? "Verified" : "Ownership not verified"}
                                        {site?.verified && <CheckCircle2 size={14} className="text-[var(--color-success)]" />}
                                    </h4>
                                    <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                                        {site?.verified
                                            ? `Ownership confirmed via ${METHOD_LABELS[site?.verificationMethod] || "an unknown method"}.`
                                            : "Only verified domains can be scanned."}
                                    </p>
                                    {site?.verifiedAt && (
                                        <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5 font-medium">Verified {formatDate(site?.verifiedAt)}</p>
                                    )}
                                </div>
                            </div>

                            {/* Token */}
                            <div>
                                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Verification Token</h4>
                                <MonoBlock value={token} />
                                <p className="text-[11px] text-[var(--color-text-muted)] mt-2 leading-relaxed">
                                    This token is unique to <span className="text-[var(--color-text-primary)] font-semibold">{website.domain}</span> and is checked when you verify ownership.
                                </p>
                            </div>

                            {/* Methods */}
                            <div>
                                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2.5">Verification Method</h4>
                                <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Verification method">
                                    {VERIFICATION_METHODS.map(method => {
                                        const selected = verifyMethod === method.id;
                                        return (
                                            <button
                                                key={method.id}
                                                role="radio"
                                                aria-checked={selected}
                                                onClick={() => setVerifyMethod(method.id)}
                                                className={`group flex flex-col items-start gap-2 p-3.5 rounded-md border text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-signal)] ${
                                                    selected
                                                        ? "bg-[var(--color-signal-subtle)] border-[var(--color-signal-strong)]"
                                                        : "bg-transparent border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-1)]"
                                                }`}
                                            >
                                                <method.icon size={16} className={selected ? "text-[var(--color-signal-readable)]" : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors duration-150"} />
                                                <span className="text-xs font-bold text-[var(--color-text-primary)]">{method.title}</span>
                                                <span className="text-[10px] text-[var(--color-text-muted)] leading-snug">{method.description}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Instructions */}
                                <div className="mt-3">
                                    <MethodInstructions method={verifyMethod} token={token} domain={website.domain} />
                                </div>
                            </div>

                            {/* Verify Now */}
                            <div className="space-y-3">
                                <button
                                    onClick={handleVerify}
                                    disabled={verifying}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-foreground)] rounded-md text-sm font-bold transition-colors duration-150 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {verifying ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                                    {verifying ? "Verifying ownership…" : "Verify Now"}
                                </button>

                                {verifyResult && (
                                    <div
                                        role="status"
                                        className={`flex items-start gap-2.5 px-3.5 py-3 rounded-md border text-xs font-semibold leading-relaxed animate-fade-in-up ${
                                            verifyResult.success
                                                ? "bg-[rgba(85,176,123,0.10)] border-[rgba(85,176,123,0.25)] text-[var(--color-success)]"
                                                : "bg-[rgba(223,91,91,0.10)] border-[rgba(223,91,91,0.25)] text-[var(--color-critical)]"
                                        }`}
                                    >
                                        {verifyResult.success ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> : <XCircle size={15} className="shrink-0 mt-0.5" />}
                                        <span>{verifyResult.message}</span>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* ---------- Scan History ---------- */}
                    {activeTab === "history" && (
                        <section key="history" className="animate-fade-in-up">
                            <SectionHeading
                                icon={Terminal}
                                title="Scan History"
                                accent="text-[var(--color-text-secondary)]"
                                subtitle="Past scans and findings for this target will appear here."
                            />
                            <div className="relative w-full h-36 rounded-md bg-[var(--color-surface-1)] border border-[var(--color-border-subtle)] border-dashed flex flex-col items-center justify-center text-[var(--color-text-muted)] hover:border-[var(--color-border-default)] transition-colors duration-150">
                                <Terminal size={24} className="mb-2 opacity-50" />
                                <span className="text-xs font-semibold">Future Analytics Module Integration</span>
                            </div>
                        </section>
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 p-6 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] flex gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] rounded-md text-sm font-semibold transition-colors duration-150 active:opacity-70"
                    >
                        Close
                    </button>
                    <button
                        onClick={() => onEdit(website)}
                        className="flex-1 px-4 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-foreground)] rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-colors duration-150 active:scale-[0.98]"
                    >
                        <Pencil size={14} />
                        Edit Website
                    </button>
                </div>
            </div>
        </div>
    );
}
