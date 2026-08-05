import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { 
    Search, Server, Terminal, Zap, ShieldCheck, Bell, ActivitySquare, HardDrive, Info, 
    Save, X, ShieldAlert, FileText, ExternalLink, HelpCircle, CheckCircle2, AlertCircle, RefreshCw, Loader2, Database, Clock
} from "lucide-react";
import { 
    PlatformSection, ScanningSection, AISection, SecuritySection, 
    NotificationsSection, SystemSection, StorageSection, AboutSection 
} from "./SettingsSections";
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
    <div id={id} className="settings-section-block scroll-mt-36 p-8 lg:p-10 rounded-[2.5rem] bg-slate-900/20 border border-slate-800/40 relative transition-colors duration-700 hover:bg-slate-900/30">
        {children}
    </div>
);

const SectionDivider = () => (
    <div className="w-full flex justify-center py-2" aria-hidden="true">
        <div className="w-3/4 h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />
    </div>
);

// Custom Toast Component
const ToastNotification = ({ toast }) => {
    if (!toast) return null;
    const isError = toast.type === "error";
    return (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300 ${
            isError ? 'bg-red-950/90 border-red-900/50 text-red-200 shadow-red-900/20' : 'bg-emerald-950/90 border-emerald-900/50 text-emerald-200 shadow-emerald-900/20'
        }`}>
            {isError ? <AlertCircle size={20} className="text-red-400" /> : <CheckCircle2 size={20} className="text-emerald-400" />}
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
        } catch (error) {
            showToast("error", "Failed to load configuration from backend.");
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

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

        const observer = new IntersectionObserver((entries) => {
            let visibleSection = null;
            let maxRatio = 0;
            
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
                    maxRatio = entry.intersectionRatio;
                    visibleSection = entry.target.id;
                }
            });

            if (visibleSection) {
                setActiveSection(visibleSection);
            }
        }, {
            root,
            rootMargin: "-20% 0px -70% 0px",
            threshold: [0, 0.25, 0.5, 0.75, 1.0]
        });

        const children = root.querySelectorAll(".settings-section-block");
        children.forEach(child => observer.observe(child));

        return () => {
            children.forEach(child => observer.unobserve(child));
            observer.disconnect();
        };
    }, []);

    // Calculate dirty settings
    const modifiedCount = useMemo(() => {
        let count = 0;
        for (const key in settings) {
            if (settings[key] !== originalSettings[key]) count++;
        }
        return count;
    }, [settings, originalSettings]);

    const updateSetting = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await api.updateSettings(settings);
            showToast("success", "Configuration successfully saved.");
            await fetchSettings(); // Always refresh from backend
        } catch (error) {
            showToast("error", error.message || "Failed to save configuration.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDiscard = () => {
        setSettings(originalSettings);
        showToast("success", "Changes discarded. Restored from backend.");
    };

    const handleReset = async () => {
        if (window.confirm("Are you sure you want to restore all settings to factory defaults? This action cannot be undone.")) {
            setIsLoading(true);
            try {
                await api.resetSettings();
                showToast("success", "Settings successfully reset to defaults.");
                await fetchSettings();
            } catch (error) {
                showToast("error", "Failed to reset settings.");
                setIsLoading(false);
            }
        }
    };

    const handleExport = async () => {
        try {
            await api.exportSettings();
            showToast("success", "Configuration exported successfully.");
        } catch (error) {
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
        <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] bg-slate-950 relative overflow-hidden">
            <ToastNotification toast={toast} />

            {/* Audit Banner */}
            <div className="shrink-0 bg-slate-900 border-b border-slate-800 px-8 py-4 flex items-center justify-between z-10 shadow-lg shadow-black/20">
                <div className="flex items-center gap-8 text-sm font-medium">
                    <span className="flex items-center gap-2.5 text-white font-bold tracking-wide">
                        <ShieldAlert size={18} className="text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                        Administration Console
                    </span>
                    <span className="text-slate-500">Last Sync: <span className="text-slate-300 font-semibold">{lastSync.toLocaleTimeString()}</span></span>
                    <span className="text-slate-500">Saved by: <span className="text-slate-300 font-semibold">System Administrator</span></span>
                    <span className="text-slate-500">Version: <span className="text-slate-300 font-semibold">v2.4.0</span></span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-md bg-purple-500/10 border border-purple-500/30 text-xs text-purple-400 uppercase tracking-wider font-extrabold shadow-[0_0_10px_rgba(168,85,247,0.15)]">
                        Production Profile
                    </span>
                </div>
            </div>

            {/* Executive KPI Header */}
            <div className="shrink-0 bg-slate-950 px-8 py-6 border-b border-slate-800/60 z-10">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 max-w-[1700px] mx-auto w-full">
                    {/* Compact KPI Cards */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-slate-500 font-bold mb-1 tracking-wider flex items-center gap-1.5"><ActivitySquare size={12} className="text-slate-400"/> Platform</span>
                        <div className="flex items-center gap-2 text-sm font-bold text-white"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Operational</div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-slate-500 font-bold mb-1 tracking-wider flex items-center gap-1.5"><Server size={12} className="text-slate-400"/> API</span>
                        <div className="flex items-center gap-2 text-sm font-bold text-white"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Connected</div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-slate-500 font-bold mb-1 tracking-wider flex items-center gap-1.5"><Database size={12} className="text-slate-400"/> Database</span>
                        <div className="flex items-center gap-2 text-sm font-bold text-white"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Connected</div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-slate-500 font-bold mb-1 tracking-wider flex items-center gap-1.5"><ShieldCheck size={12} className="text-slate-400"/> Environment</span>
                        <span className="text-sm font-bold text-purple-400">Production</span>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-slate-500 font-bold mb-1 tracking-wider flex items-center gap-1.5"><Clock size={12} className="text-slate-400"/> Last Save</span>
                        <span className="text-sm font-bold text-slate-300">Synchronized</span>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-slate-500 font-bold mb-1 tracking-wider flex items-center gap-1.5"><AlertCircle size={12} className="text-slate-400"/> Unsaved</span>
                        <span className={`text-sm font-bold ${modifiedCount > 0 ? "text-amber-400" : "text-slate-400"}`}>{modifiedCount} Changes</span>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-slate-500 font-bold mb-1 tracking-wider flex items-center gap-1.5"><HardDrive size={12} className="text-slate-400"/> Categories</span>
                        <span className="text-sm font-bold text-white">8 Groups</span>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-slate-500 font-bold mb-1 tracking-wider flex items-center gap-1.5"><Terminal size={12} className="text-slate-400"/> Configured</span>
                        <span className="text-sm font-bold text-white">26 Items</span>
                    </div>
                </div>
            </div>

            {isLoading && (
                <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                    <Loader2 size={48} className="text-purple-500 animate-spin mb-4" />
                    <p className="text-white font-semibold">Synchronizing with Backend...</p>
                </div>
            )}

            {/* 3-Panel Layout */}
            <div className={`flex-1 overflow-hidden flex max-w-[1700px] mx-auto w-full min-w-0 transition-opacity duration-300 ${isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                
                {/* Left Panel: Sidebar */}
                <div className="w-[20%] xl:w-[18%] shrink-0 border-r border-slate-800/60 overflow-y-auto py-6 pr-6">
                    <nav className="space-y-2">
                        {SECTIONS.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => {
                                    const el = document.getElementById(section.id);
                                    if (el) el.scrollIntoView({ behavior: "smooth" });
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                                    activeSection === section.id
                                        ? "bg-purple-500/10 text-purple-300 border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.1)]"
                                        : "text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent"
                                }`}
                            >
                                <section.icon size={18} className={activeSection === section.id ? "text-purple-400" : "text-slate-500"} />
                                {section.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Center Panel: Content */}
                <div className="flex-1 min-w-0 flex flex-col bg-slate-950">
                    {/* Integrated Search Bar */}
                    <div className="shrink-0 px-8 py-6 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md z-20 relative">
                        <Search size={18} className="absolute left-12 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            ref={searchRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search settings... (Ctrl+F)"
                            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:shadow-[0_0_0_1px_rgba(192,132,252,0.5),0_0_18px_rgba(168,85,247,0.15)] transition-all shadow-inner"
                        />
                    </div>
                    
                    <div ref={contentRef} className="flex-1 overflow-y-auto p-8 lg:p-12 pb-32 space-y-12">
                        <SectionWrapper id="platform"><PlatformSection settings={settings} updateSetting={updateSetting} query={searchQuery} /></SectionWrapper>
                        <SectionDivider />
                        <SectionWrapper id="scanning"><ScanningSection settings={settings} updateSetting={updateSetting} query={searchQuery} /></SectionWrapper>
                        <SectionDivider />
                        <SectionWrapper id="ai"><AISection settings={settings} updateSetting={updateSetting} query={searchQuery} /></SectionWrapper>
                        <SectionDivider />
                        <SectionWrapper id="security"><SecuritySection settings={settings} updateSetting={updateSetting} query={searchQuery} /></SectionWrapper>
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
                <div className="w-[24%] xl:w-[22%] shrink-0 border-l border-slate-800/60 overflow-y-auto p-6 hidden xl:block bg-slate-900/20">
                    <div className="sticky top-0">
                        <div key={activeContext.title} className="animate-in fade-in slide-in-from-right-4 duration-500 fill-mode-both">
                            <div className="mb-6">
                                <div className="w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center border border-slate-700/50 mb-4 shadow-inner">
                                    <HelpCircle size={20} className="text-purple-400" />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">{activeContext.title}</h3>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    {activeContext.description}
                                </p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className="bg-slate-900/50 border border-slate-800/60 p-3 rounded-xl">
                                    <span className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Status</span>
                                    <span className="text-xs font-bold text-cyan-400">{activeContext.status}</span>
                                </div>
                                <div className="bg-slate-900/50 border border-slate-800/60 p-3 rounded-xl">
                                    <span className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Settings</span>
                                    <span className="text-xs font-bold text-white">{activeContext.configs}</span>
                                </div>
                            </div>
    
                            <div className="space-y-4 mb-6">
                                {activeContext.notes.map((note, idx) => (
                                    <div key={idx} className="flex gap-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800/60 text-sm text-slate-300">
                                        <Info size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                                        <p className="leading-relaxed">{note}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mb-8">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Roadmap</h4>
                                <p className="text-sm text-slate-400 bg-slate-900/30 border border-slate-800/40 p-3 rounded-xl leading-relaxed">
                                    {activeContext.roadmap}
                                </p>
                            </div>
    
                            <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-300 transition-colors text-sm font-semibold shadow-[0_0_15px_rgba(168,85,247,0.1)] hover:shadow-[0_0_20px_rgba(168,85,247,0.2)]">
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
                <div className="bg-slate-800/95 backdrop-blur-xl border border-slate-700 p-4 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] flex items-center gap-6 min-w-[500px]">
                    <div className="flex-1">
                        <h4 className="text-white font-bold flex items-center gap-2">
                            <Save size={16} className="text-cyan-400" /> Unsaved Changes
                        </h4>
                        <p className="text-sm text-slate-400 mt-0.5">
                            You have modified {modifiedCount} setting{modifiedCount === 1 ? "" : "s"}.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <button 
                            onClick={handleDiscard}
                            disabled={isSaving}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white bg-slate-900/50 hover:bg-slate-700 transition-colors border border-slate-700/50 disabled:opacity-50"
                        >
                            Discard
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 hover:from-indigo-500 hover:via-purple-500 hover:to-fuchsia-500 transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:shadow-[0_0_25px_rgba(168,85,247,0.6)] disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSaving && <Loader2 size={16} className="animate-spin" />}
                            {isSaving ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
}
