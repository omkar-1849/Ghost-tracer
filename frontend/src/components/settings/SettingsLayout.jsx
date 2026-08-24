import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { 
    Search, Server, Terminal, Zap, ShieldCheck, Bell, ActivitySquare, HardDrive, Info, 
    Save, ShieldAlert, FileText, ExternalLink, HelpCircle, CheckCircle2, AlertCircle, Loader2, Database, Clock
} from "lucide-react";
import { 
    PlatformSection, ScanningSection, AISection, SecuritySection, 
    NotificationsSection, SystemSection, StorageSection, AboutSection 
} from "./SettingsSections";
import AuditActivity from "./AuditActivity";
import * as api from "../../services/settingsApi";

const DEFAULT_SETTINGS = {
    orgName: "Acme Corp",
    platformName: "Sentinel AI",
    timezone: "UTC",
    region: "us-east-1",
    theme: "dark",
    profile: "prod",

    defaultScanner: "sqlmap",
    concurrentScans: 5,
    scanTimeout: 120,
    proxy: "",
    sqlmapPath: "/usr/bin/sqlmap",
    sqlmapRisk: "1",
    randomAgent: true,
    followRedirects: true,

    aiEnabled: true,
    aiProvider: "openai",
    aiModel: "gpt-4o",
    aiKey: "sk-••••••••••••••••••••••••",
    aiTemp: 0.2,
    aiContext: 128000,
    aiSummaries: true,
    aiRemediation: false,

    sessionTimeout: 30,
    auditLogging: true,

    emailAlerts: true,
    desktopAlerts: false,
};

const SECTIONS = [
    { id: "platform", label: "Platform", icon: Server },
    { id: "scanning", label: "Scanning", icon: Terminal },
    { id: "ai", label: "Artificial Intelligence", icon: Zap },
    { id: "security", label: "Security", icon: ShieldCheck },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "system", label: "System Health", icon: ActivitySquare },
    { id: "storage", label: "Storage & Data", icon: HardDrive },
    { id: "about", label: "About", icon: Info },
];

const CONTEXT_DATA = {
    platform: {
        title: "Platform Configuration",
        description: "Manage global organization settings, regional data processing, and active configuration profiles.",
        notes: [
            "Configuration profiles allow you to quickly swap between Dev and Prod settings.",
            "Changing the Time Zone will affect all future scan reports and audit logs."
        ],
        docs: "View Platform Documentation",
        status: "Operational",
        configs: 6,
        roadmap: "Q4: Multi-region auto-failover."
    },
    scanning: {
        title: "Scanning Engines",
        description: "Configure how Sentinel AI interacts with its underlying security scanners.",
        notes: [
            "High concurrent scans may consume significant memory.",
            "Nmap and Nuclei integrations are currently in development."
        ],
        docs: "View Scanner Documentation",
        status: "Beta Features",
        configs: 11,
        roadmap: "Q3: Native Nmap and Nuclei templates."
    },
    ai: {
        title: "AI Integration",
        description: "Configure Large Language Models for automated vulnerability analysis and summaries.",
        notes: [
            "We recommend GPT-4o for the most accurate remediation snippets.",
            "API Keys are securely encrypted at rest."
        ],
        docs: "View AI Documentation",
        status: "Operational",
        configs: 8,
        roadmap: "Q4: Local open-source LLM support."
    },
    security: {
        title: "Security & Access",
        description: "Control how analysts access Sentinel AI and review audit logs.",
        notes: [
            "Audit logging tracks every configuration change made in this module."
        ],
        docs: "View Security Documentation",
        status: "Operational",
        configs: 4,
        roadmap: "Q3: RBAC and granular permissions."
    },
    notifications: {
        title: "Alerts & Webhooks",
        description: "Configure external integrations to alert your team when critical vulnerabilities are found.",
        notes: [
            "Slack and MS Teams integrations require admin approval in their respective workspaces."
        ],
        docs: "View Webhooks Documentation",
        status: "Configurable",
        configs: 5,
        roadmap: "Q3: Custom Webhook builder."
    },
    system: {
        title: "System Dashboard",
        description: "Live telemetry of the Sentinel AI infrastructure and underlying services.",
        notes: [
            "If the AI Engine status is 'Degraded', you may be hitting rate limits on your API provider."
        ],
        docs: "View Infrastructure Documentation",
        status: "Operational",
        configs: 0,
        roadmap: "Q4: Historical metric charting."
    },
    storage: {
        title: "Data Management",
        description: "Backup, restore, or securely wipe platform data.",
        notes: [
            "Resetting to defaults will immediately log out all active sessions.",
            "Database backups exclude temporary scan artifacts."
        ],
        docs: "View Backup Documentation",
        status: "Beta Features",
        configs: 3,
        roadmap: "Q4: Automated daily S3 backups."
    },
    about: {
        title: "About Sentinel AI",
        description: "Version, build, and licensing information.",
        notes: [
            "You are running the Enterprise edition."
        ],
        docs: "View Release Notes",
        status: "N/A",
        configs: 0,
        roadmap: "N/A"
    }
};

const SectionWrapper = ({ id, children }) => (
    <div id={id} className="settings-section-block scroll-mt-36 p-8 lg:p-10 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border-default)] relative transition-colors duration-700 hover:bg-[var(--color-surface-3)]">
        {children}
    </div>
);

const SectionDivider = () => (
    <div className="w-full flex justify-center py-2" aria-hidden="true">
        <div className="w-3/4 h-px bg-[var(--color-border-subtle)]" />
    </div>
);

// Custom Toast Component
const ToastNotification = ({ toast }) => {
    if (!toast) return null;
    const isError = toast.type === "error";
    return (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-lg border animate-in fade-in slide-in-from-top-4 duration-300 bg-[var(--color-surface-3)] shadow-[var(--shadow-3)] ${
            isError ? 'border-[rgba(223,91,91,0.40)] text-[var(--color-critical)]' : 'border-[rgba(85,176,123,0.40)] text-[var(--color-success)]'
        }`}>
            {isError ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            <span className="text-sm font-semibold">{toast.message}</span>
        </div>
    );
};

export default function SettingsLayout() {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [originalSettings, setOriginalSettings] = useState(DEFAULT_SETTINGS);
    const [activeSection, setActiveSection] = useState("platform");
    const [searchQuery, setSearchQuery] = useState("");
    
    // API State
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [lastSync, setLastSync] = useState(new Date());
    const [isAuditActivityOpen, setIsAuditActivityOpen] = useState(false);

    const searchRef = useRef(null);
    const contentRef = useRef(null);
    const toastTimeoutRef = useRef(null);

    const showToast = useCallback((type, message) => {
        setToast({ type, message });
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
    }, []);

    const fetchSettings = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getSettings();
            setSettings(data);
            setOriginalSettings(data);
            setLastSync(new Date());
        } catch {
            showToast("error", "Failed to load configuration from backend.");
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        let active = true;
        (async () => {
            setIsLoading(true);
            try {
                const data = await api.getSettings();
                if (active) {
                    setSettings(data);
                    setOriginalSettings(data);
                    setLastSync(new Date());
                }
            } catch {
                if (active) showToast("error", "Failed to load configuration from backend.");
            } finally {
                if (active) setIsLoading(false);
            }
        })();
        return () => { active = false; };
    }, [showToast]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "f") {
                if (searchRef.current) {
                    e.preventDefault();
                    searchRef.current.focus();
                }
            } else if (e.key === "Escape") {
                setSearchQuery("");
                if (document.activeElement === searchRef.current) {
                    searchRef.current.blur();
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Scroll spy logic
    useEffect(() => {
        const root = contentRef.current;
        if (!root) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const id = entry.target.getAttribute("id");
                        if (id) setActiveSection(id);
                    }
                });
            },
            { root, rootMargin: "-20% 0px -70% 0px", threshold: 0 }
        );

        const sections = root.querySelectorAll("section[id], .settings-section-block");
        sections.forEach((s) => observer.observe(s));
        return () => observer.disconnect();
    }, []);

    // Calculate dirty settings
    const modifiedCount = useMemo(() => {
        let count = 0;
        Object.keys(settings).forEach((k) => {
            if (settings[k] !== originalSettings[k]) count++;
        });
        return count;
    }, [settings, originalSettings]);

    const updateSetting = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updated = await api.updateSettings(settings);
            setSettings(updated);
            setOriginalSettings(updated);
            setLastSync(new Date());
            showToast("success", "Settings saved successfully.");
        } catch (error) {
            showToast("error", error.message || "Failed to save settings.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDiscard = () => {
        setSettings({ ...originalSettings });
        showToast("success", "Changes discarded. Restored from backend.");
    };

    const handleReset = async () => {
        if (window.confirm("Are you sure you want to restore all settings to factory defaults? This action cannot be undone.")) {
            setIsLoading(true);
            try {
                await api.resetSettings();
                showToast("success", "Settings successfully reset to defaults.");
                await fetchSettings();
            } catch {
                showToast("error", "Failed to reset settings.");
                setIsLoading(false);
            }
        }
    };

    const handleExport = async () => {
        try {
            await api.exportSettings();
            showToast("success", "Configuration exported successfully.");
        } catch {
            showToast("error", "Failed to export configuration.");
        }
    };

    const handleImport = async (file) => {
        setIsLoading(true);
        try {
            await api.importSettings(file);
            showToast("success", "Configuration imported successfully.");
            await fetchSettings();
        } catch (error) {
            showToast("error", error.message || "Failed to import configuration.");
            setIsLoading(false);
        }
    };

    const activeContext = CONTEXT_DATA[activeSection] || CONTEXT_DATA.platform;

    return (
        <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] bg-[var(--color-canvas)] relative overflow-hidden">
            <ToastNotification toast={toast} />

            {/* Audit Banner */}
            <div className="shrink-0 bg-[var(--color-surface-1)] border-b border-[var(--color-border-default)] px-8 py-3.5 flex items-center justify-between z-10">
                <div className="flex items-center gap-6 text-[13px] font-medium">
                    <span className="flex items-center gap-2.5 text-[var(--color-text-primary)] font-bold tracking-tight">
                        <ShieldAlert size={16} className="text-[var(--color-signal)]" />
                        Administration Console
                    </span>
                    <span className="hidden md:inline text-xs text-[var(--color-text-muted)]">Last Sync: <span className="mono-value text-[11px] text-[var(--color-text-secondary)]">{lastSync.toLocaleTimeString()}</span></span>
                    <span className="hidden lg:inline text-xs text-[var(--color-text-muted)]">Saved by: <span className="text-[var(--color-text-secondary)] font-semibold">System Administrator</span></span>
                    <span className="hidden xl:inline text-xs text-[var(--color-text-muted)]">Version: <span className="mono-value text-[11px] text-[var(--color-text-secondary)]">v2.4.0</span></span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-md bg-[var(--color-signal-subtle)] border border-[rgba(201,169,97,0.28)] text-[10px] text-[var(--color-signal)] uppercase tracking-[0.1em] font-bold">
                        Production Profile
                    </span>
                </div>
            </div>

            {/* Executive KPI Header */}
            <div className="shrink-0 bg-[var(--color-canvas)] px-8 py-6 border-b border-[var(--color-border-subtle)] z-10">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 max-w-[1700px] mx-auto w-full">
                    {/* Compact KPI Cards */}
                    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg p-3 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-bold mb-1 tracking-wider flex items-center gap-1.5"><ActivitySquare size={12} className="text-[var(--color-text-secondary)]"/> Platform</span>
                        <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)]"><span className="w-2 h-2 rounded-full bg-[var(--color-success)]"></span> Operational</div>
                    </div>
                    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg p-3 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-bold mb-1 tracking-wider flex items-center gap-1.5"><Server size={12} className="text-[var(--color-text-secondary)]"/> API</span>
                        <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)]"><span className="w-2 h-2 rounded-full bg-[var(--color-success)]"></span> Connected</div>
                    </div>
                    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg p-3 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-bold mb-1 tracking-wider flex items-center gap-1.5"><Database size={12} className="text-[var(--color-text-secondary)]"/> Database</span>
                        <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)]"><span className="w-2 h-2 rounded-full bg-[var(--color-success)]"></span> Connected</div>
                    </div>
                    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg p-3 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-bold mb-1 tracking-wider flex items-center gap-1.5"><ShieldCheck size={12} className="text-[var(--color-text-secondary)]"/> Environment</span>
                        <span className="text-sm font-bold text-[var(--color-signal)]">Production</span>
                    </div>
                    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg p-3 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-bold mb-1 tracking-wider flex items-center gap-1.5"><Clock size={12} className="text-[var(--color-text-secondary)]"/> Last Save</span>
                        <span className="text-sm font-bold text-[var(--color-text-primary)]">Synchronized</span>
                    </div>
                    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg p-3 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-bold mb-1 tracking-wider flex items-center gap-1.5"><AlertCircle size={12} className="text-[var(--color-text-secondary)]"/> Unsaved</span>
                        <span className={`text-sm font-bold tabular-nums ${modifiedCount > 0 ? "text-[var(--color-warning)]" : "text-[var(--color-text-muted)]"}`}>{modifiedCount} Changes</span>
                    </div>
                    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg p-3 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-bold mb-1 tracking-wider flex items-center gap-1.5"><HardDrive size={12} className="text-[var(--color-text-secondary)]"/> Categories</span>
                        <span className="text-sm font-bold text-[var(--color-text-primary)] tabular-nums">8 Groups</span>
                    </div>
                    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg p-3 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-bold mb-1 tracking-wider flex items-center gap-1.5"><Terminal size={12} className="text-[var(--color-text-secondary)]"/> Configured</span>
                        <span className="text-sm font-bold text-[var(--color-text-primary)] tabular-nums">26 Items</span>
                    </div>
                </div>
            </div>

            {isLoading && (
                <div className="absolute inset-0 bg-[var(--color-canvas)]/50 z-50 flex flex-col items-center justify-center">
                    <Loader2 size={48} className="text-[var(--color-accent)] animate-spin mb-4" />
                    <p className="text-[var(--color-text-primary)] font-semibold">Synchronizing with Backend...</p>
                </div>
            )}

            {/* 3-Panel Layout */}
            <div className={`flex-1 overflow-hidden flex max-w-[1700px] mx-auto w-full min-w-0 transition-opacity duration-300 ${isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                
                {/* Left Panel: Sidebar */}
                <div className="w-[20%] xl:w-[18%] shrink-0 border-r border-[var(--color-border-default)] overflow-y-auto py-6 pr-6">
                    <nav className="space-y-2">
                        {SECTIONS.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => {
                                    const el = document.getElementById(section.id);
                                    if (el) el.scrollIntoView({ behavior: "smooth" });
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                                    activeSection === section.id
                                        ? "bg-[var(--color-signal-subtle)] text-[var(--color-signal-readable)] border border-[var(--color-signal-strong)]"
                                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-1)] hover:text-[var(--color-text-primary)] border border-transparent"
                                }`}
                            >
                                <section.icon size={18} className={activeSection === section.id ? "text-[var(--color-signal)]" : "text-[var(--color-text-muted)]"} />
                                {section.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Center Panel: Content */}
                <div className="flex-1 min-w-0 flex flex-col bg-[var(--color-canvas)]">
                    {/* Integrated Search Bar */}
                    <div className="shrink-0 px-8 py-6 border-b border-[var(--color-border-default)] bg-[var(--color-canvas)] z-20 relative">
                        <Search size={18} className="absolute left-12 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                        <input
                            ref={searchRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search settings... (Ctrl+F)"
                            className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg pl-11 pr-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-signal)] focus:ring-2 focus:ring-[var(--color-signal-strong)] transition-all"
                        />
                    </div>
                    
                    <div ref={contentRef} className="flex-1 overflow-y-auto p-8 lg:p-12 pb-32 space-y-12">
                        <SectionWrapper id="platform"><PlatformSection settings={settings} updateSetting={updateSetting} query={searchQuery} /></SectionWrapper>
                        <SectionDivider />
                        <SectionWrapper id="scanning"><ScanningSection settings={settings} updateSetting={updateSetting} query={searchQuery} /></SectionWrapper>
                        <SectionDivider />
                        <SectionWrapper id="ai"><AISection settings={settings} updateSetting={updateSetting} query={searchQuery} /></SectionWrapper>
                        <SectionDivider />
                        <SectionWrapper id="security">
                            <SecuritySection
                                settings={settings}
                                updateSetting={updateSetting}
                                query={searchQuery}
                                onOpenAuditActivity={() => setIsAuditActivityOpen(true)}
                            />
                        </SectionWrapper>
                        <SectionDivider />
                        <SectionWrapper id="notifications"><NotificationsSection settings={settings} updateSetting={updateSetting} query={searchQuery} /></SectionWrapper>
                        <SectionDivider />
                        <SectionWrapper id="system"><SystemSection /></SectionWrapper>
                        <SectionDivider />
                        <SectionWrapper id="storage">
                            <StorageSection 
                                query={searchQuery} 
                                onExport={handleExport}
                                onImport={handleImport}
                                onReset={handleReset}
                            />
                        </SectionWrapper>
                        <SectionDivider />
                        <SectionWrapper id="about"><AboutSection /></SectionWrapper>
                    </div>
                </div>

                {/* Right Panel: Context */}
                <div className="w-[24%] xl:w-[22%] shrink-0 border-l border-[var(--color-border-default)] overflow-y-auto p-6 hidden xl:block bg-[var(--color-surface-1)]">
                    <div className="sticky top-0">
                        <div key={activeContext.title} className="animate-in fade-in slide-in-from-right-4 duration-500 fill-mode-both">
                            <div className="mb-6">
                                <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-2)] flex items-center justify-center border border-[var(--color-border-default)] mb-4">
                                    <HelpCircle size={20} className="text-[var(--color-text-secondary)]" />
                                </div>
                                <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">{activeContext.title}</h3>
                                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                                    {activeContext.description}
                                </p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] p-3 rounded-lg">
                                    <span className="block text-[10px] text-[var(--color-text-muted)] uppercase font-semibold mb-1">Status</span>
                                    <span className="text-xs font-bold text-[var(--color-info)]">{activeContext.status}</span>
                                </div>
                                <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-default)] p-3 rounded-lg">
                                    <span className="block text-[10px] text-[var(--color-text-muted)] uppercase font-semibold mb-1">Settings</span>
                                    <span className="text-xs font-bold text-[var(--color-text-primary)] tabular-nums">{activeContext.configs}</span>
                                </div>
                            </div>
    
                            <div className="space-y-4 mb-6">
                                {activeContext.notes.map((note, idx) => (
                                    <div key={idx} className="flex gap-3 p-4 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border-default)] text-sm text-[var(--color-text-primary)]">
                                        <Info size={16} className="text-[var(--color-info)] shrink-0 mt-0.5" />
                                        <p className="leading-relaxed">{note}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mb-8">
                                <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Roadmap</h4>
                                <p className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-2)] border border-[var(--color-border-default)] p-3 rounded-lg leading-relaxed">
                                    {activeContext.roadmap}
                                </p>
                            </div>
    
                            <button className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-[var(--color-accent-subtle)] hover:bg-[var(--color-accent)] border border-[var(--color-accent)] text-[var(--color-accent)] hover:text-[var(--color-accent-foreground)] transition-colors text-sm font-semibold">
                                <span className="flex items-center gap-2">
                                    <FileText size={16} />
                                    {activeContext.docs}
                                </span>
                                <ExternalLink size={14} className="opacity-50" />
                            </button>
                        </div>
                    </div>
                </div>

            </div>

            {/* Enhanced Save Bar */}
            <div className={`absolute bottom-0 left-0 right-0 p-6 flex justify-center transition-transform duration-500 ease-out z-50 ${modifiedCount > 0 ? "translate-y-0" : "translate-y-32"}`}>
                <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] p-4 rounded-lg flex items-center gap-6 min-w-[500px]">
                    <div className="flex-1">
                        <h4 className="text-[var(--color-text-primary)] font-bold flex items-center gap-2">
                            <Save size={16} className="text-[var(--color-info)]" /> Unsaved Changes
                        </h4>
                        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5 tabular-nums">
                            You have modified {modifiedCount} setting{modifiedCount === 1 ? "" : "s"}.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <button 
                            onClick={handleDiscard}
                            disabled={isSaving}
                            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-[var(--color-text-primary)] bg-[var(--color-surface-3)] hover:bg-[var(--color-border-strong)] transition-colors border border-[var(--color-border-default)] disabled:opacity-50"
                        >
                            Discard
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-[var(--color-accent-foreground)] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] transition-all disabled:opacity-50 flex items-center gap-2 border border-transparent"
                        >
                            {isSaving && <Loader2 size={16} className="animate-spin" />}
                            {isSaving ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Audit Activity Modal */}
            {isAuditActivityOpen && (
                <AuditActivity onClose={() => setIsAuditActivityOpen(false)} />
            )}
        </div>
    );
}
