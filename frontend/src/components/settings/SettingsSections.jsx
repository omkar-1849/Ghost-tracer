import { 
    Cpu, HardDrive, Server, Activity, Clock, ShieldCheck, 
    Database, ActivitySquare, Terminal, Globe, User, Fingerprint, Lock, 
    Bell, Mail, Monitor, Code, Play, RefreshCw, Zap, Upload, Download, Trash2, RotateCcw, Info
} from "lucide-react";
import { 
    SectionHeader, SettingGroup, ToggleCard, InputCard, SelectCard, ActionCard, DangerZone, StatusBadge
} from "./SettingsShared";

function matchesSearch(text, query) {
    if (!query) return true;
    return text.toLowerCase().includes(query.toLowerCase());
}

// 1. Platform Settings
export function PlatformSection({ settings, updateSetting, query }) {
    const isVisible = (title, desc) => matchesSearch(title, query) || matchesSearch(desc, query);
    
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <SectionHeader title="Platform" description="Core platform configuration and organization details." icon={Server} />
            <SettingGroup>
                {isVisible("Organization Name", "Display name") && (
                    <InputCard label="Organization Name" description="The primary enterprise name embedded in executive reports and exports." status="Implemented" value={settings.orgName} onChange={(val) => updateSetting("orgName", val)} validation="valid" />
                )}
                {isVisible("Platform Name", "Internal") && (
                    <InputCard label="Platform Name" description="Internal name for this Sentinel AI instance." status="Implemented" value={settings.platformName} onChange={(val) => updateSetting("platformName", val)} />
                )}
                {isVisible("Time Zone", "Global") && (
                    <SelectCard label="Time Zone" description="Global time zone for logging and reporting." status="Configurable" value={settings.timezone} onChange={(val) => updateSetting("timezone", val)} options={[{label: "UTC", value: "UTC"}, {label: "America/New_York", value: "America/New_York"}, {label: "Europe/London", value: "Europe/London"}]} />
                )}
                {isVisible("Region", "Data processing") && (
                    <SelectCard label="Region" description="Data processing region." status="Configurable" value={settings.region} onChange={(val) => updateSetting("region", val)} options={[{label: "US East (N. Virginia)", value: "us-east-1"}, {label: "EU West (Ireland)", value: "eu-west-1"}]} />
                )}
                {isVisible("Theme", "Interface") && (
                    <SelectCard label="Theme" description="Interface color theme." status="Implemented" value={settings.theme} onChange={(val) => updateSetting("theme", val)} options={[{label: "Dark (Default)", value: "dark"}]} disabled />
                )}
                {isVisible("Configuration Profile", "Active profile") && (
                    <SelectCard label="Configuration Profile" description="Active settings profile." status="Beta" value={settings.profile} onChange={(val) => updateSetting("profile", val)} options={[{label: "Development", value: "dev"}, {label: "Production", value: "prod"}, {label: "Testing", value: "test"}]} />
                )}
            </SettingGroup>
        </div>
    );
}

// 2. Scanning Settings
export function ScanningSection({ settings, updateSetting, query }) {
    const isVisible = (title, desc) => matchesSearch(title, query) || matchesSearch(desc, query);
    
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <SectionHeader title="Scanning" description="Configure global scanning parameters and engine integrations." icon={Terminal} />
            
            <SettingGroup>
                <h3 className="text-sm font-semibold text-white mb-2 mt-4 flex items-center gap-2"><Globe size={16} className="text-slate-400" /> General Engine Settings</h3>
                {isVisible("Default Scanner", "Primary") && (
                    <SelectCard label="Default Scanner" description="Primary engine for ad-hoc scans." status="Configurable" value={settings.defaultScanner} onChange={(val) => updateSetting("defaultScanner", val)} options={[{label: "SQLMap", value: "sqlmap"}]} />
                )}
                {isVisible("Concurrent Scans", "Maximum") && (
                    <InputCard label="Concurrent Scans" description="Maximum number of simultaneous scans." type="number" status="Implemented" value={settings.concurrentScans} onChange={(val) => updateSetting("concurrentScans", val)} />
                )}
                {isVisible("Scan Timeout", "Abort") && (
                    <InputCard label="Scan Timeout (minutes)" description="Abort scan if running longer than timeout." type="number" status="Configurable" value={settings.scanTimeout} onChange={(val) => updateSetting("scanTimeout", val)} />
                )}
                {isVisible("Proxy", "Route") && (
                    <InputCard label="Global Proxy" description="Route all scanning traffic through this proxy endpoint." placeholder="http://127.0.0.1:8080" status="Beta" value={settings.proxy} onChange={(val) => updateSetting("proxy", val)} validation={settings.proxy ? "valid" : null} />
                )}
            </SettingGroup>

            <SettingGroup>
                <h3 className="text-sm font-semibold text-white mb-2 mt-6 flex items-center gap-2"><Terminal size={16} className="text-slate-400" /> SQLMap Configuration</h3>
                {isVisible("Executable Path", "Absolute") && (
                    <InputCard label="Executable Path" description="Absolute system path to the sqlmap engine binary." status="Implemented" value={settings.sqlmapPath} onChange={(val) => updateSetting("sqlmapPath", val)} validation={settings.sqlmapPath === "" ? "warning" : "valid"} />
                )}
                {isVisible("Risk Threshold", "Default") && (
                    <SelectCard label="Risk Threshold" description="Default risk level for automated scans (1-3)." status="Configurable" value={settings.sqlmapRisk} onChange={(val) => updateSetting("sqlmapRisk", val)} options={[{label: "Level 1 (Low)", value: "1"}, {label: "Level 2 (Medium)", value: "2"}, {label: "Level 3 (High)", value: "3"}]} />
                )}
                {isVisible("Random User-Agent", "Use random") && (
                    <ToggleCard label="Random User-Agent" description="Use random User-Agent header for HTTP requests." status="Implemented" value={settings.randomAgent} onChange={(val) => updateSetting("randomAgent", val)} />
                )}
                {isVisible("Follow Redirects", "Automatically") && (
                    <ToggleCard label="Follow Redirects" description="Automatically follow HTTP redirects." status="Configurable" value={settings.followRedirects} onChange={(val) => updateSetting("followRedirects", val)} />
                )}
            </SettingGroup>

            <SettingGroup>
                <h3 className="text-sm font-semibold text-white mb-2 mt-6 flex items-center gap-2"><Clock size={16} className="text-slate-400" /> Future Engines</h3>
                <ActionCard label="Nmap Integration" description="Network discovery and port scanning engine." status="Coming Soon" buttonText="Configure" disabled />
                <ActionCard label="Nuclei Integration" description="Template based fast vulnerability scanner." status="Coming Soon" buttonText="Configure" disabled />
                <ActionCard label="OWASP ZAP" description="Integrated web application security scanner." status="Coming Soon" buttonText="Configure" disabled />
            </SettingGroup>
        </div>
    );
}

// 3. AI Settings
export function AISection({ settings, updateSetting, query }) {
    const isVisible = (title, desc) => matchesSearch(title, query) || matchesSearch(desc, query);
    
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <SectionHeader title="Artificial Intelligence" description="Configure LLM providers and automated analysis features." icon={Zap} />
            <SettingGroup>
                {isVisible("AI Enabled", "Toggle") && (
                    <ToggleCard label="AI Enabled" description="Toggle AI-driven insights and automated analysis across the platform." status="Implemented" value={settings.aiEnabled} onChange={(val) => updateSetting("aiEnabled", val)} />
                )}
                {isVisible("AI Provider", "Select") && (
                    <SelectCard label="AI Provider" description="Select the underlying LLM provider." status="Configurable" value={settings.aiProvider} onChange={(val) => updateSetting("aiProvider", val)} disabled={!settings.aiEnabled} options={[{label: "OpenAI", value: "openai"}, {label: "Anthropic Claude", value: "claude"}, {label: "Google Gemini", value: "gemini"}]} />
                )}
                {isVisible("Model", "Specific") && (
                    <SelectCard label="Model" description="Specific model variant to use." status="Configurable" value={settings.aiModel} onChange={(val) => updateSetting("aiModel", val)} disabled={!settings.aiEnabled} options={[{label: "GPT-4o", value: "gpt-4o"}]} />
                )}
                {isVisible("API Key", "Authentication") && (
                    <InputCard label="API Key" description="Encrypted authentication key for the selected LLM provider." status="Implemented" masked={true} value={settings.aiKey} onChange={(val) => updateSetting("aiKey", val)} disabled={!settings.aiEnabled} validation={settings.aiEnabled && settings.aiKey ? "valid" : null} />
                )}
                {isVisible("Temperature", "Creativity") && (
                    <InputCard label="Temperature" description="Creativity vs deterministic output (0.0 - 1.0)." type="number" status="Beta" value={settings.aiTemp} onChange={(val) => updateSetting("aiTemp", val)} disabled={!settings.aiEnabled} />
                )}
                {isVisible("Context Length", "Max") && (
                    <InputCard label="Context Length" description="Maximum tokens to send per request." type="number" status="Configurable" value={settings.aiContext} onChange={(val) => updateSetting("aiContext", val)} disabled={!settings.aiEnabled} />
                )}
                {isVisible("Automatic Summaries", "Generate") && (
                    <ToggleCard label="Automatic Summaries" description="Generate AI summaries for completed scan reports automatically." status="Beta" value={settings.aiSummaries} onChange={(val) => updateSetting("aiSummaries", val)} disabled={!settings.aiEnabled} />
                )}
                {isVisible("Auto-Remediation", "Suggest") && (
                    <ToggleCard label="Auto-Remediation Suggestions" description="Suggest code snippets to fix discovered vulnerabilities." status="Coming Soon" value={settings.aiRemediation} onChange={(val) => updateSetting("aiRemediation", val)} disabled={!settings.aiEnabled} />
                )}
            </SettingGroup>
        </div>
    );
}

// 4. Security Settings
export function SecuritySection({ settings, updateSetting, query, onOpenAuditActivity }) {
    const isVisible = (title, desc) => matchesSearch(title, query) || matchesSearch(desc, query);
    
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <SectionHeader title="Security" description="Platform access control and audit logging." icon={ShieldCheck} />
            <SettingGroup>
                {isVisible("Session Timeout", "Idle") && (
                    <InputCard label="Session Timeout (minutes)" description="Idle time before requiring re-authentication." type="number" status="Configurable" value={settings.sessionTimeout} onChange={(val) => updateSetting("sessionTimeout", val)} />
                )}
                {isVisible("Audit Logging", "Record") && (
                    <ToggleCard label="Audit Logging" description="Record all configuration changes and user actions." status="Implemented" value={settings.auditLogging} onChange={(val) => updateSetting("auditLogging", val)} />
                )}
                {isVisible("Audit Activity", "Review organization activity") && (
                    <ActionCard label="Audit Activity" description="Review recent organization activity and expand individual events for their recorded context." status="Available" buttonText="View activity" onClick={onOpenAuditActivity} />
                )}
                {isVisible("API Token Management", "Generate") && (
                    <ActionCard label="API Token Management" description="Generate and revoke personal access tokens for external integrations." status="Coming Soon" buttonText="Manage Tokens" disabled />
                )}
                {isVisible("Password Policy", "Enforce") && (
                    <ActionCard label="Password Policy" description="Enforce strict password requirements for all analysts." status="Coming Soon" buttonText="Configure Policy" disabled />
                )}
            </SettingGroup>
        </div>
    );
}

// 5. Notifications Settings
export function NotificationsSection({ settings, updateSetting, query }) {
    const isVisible = (title, desc) => matchesSearch(title, query) || matchesSearch(desc, query);
    
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <SectionHeader title="Notifications" description="Configure alerts and external messaging integrations." icon={Bell} />
            <SettingGroup>
                {isVisible("Email Alerts", "Send") && (
                    <ToggleCard label="Email Alerts" description="Send critical alerts to the registered administrator email." status="Implemented" value={settings.emailAlerts} onChange={(val) => updateSetting("emailAlerts", val)} />
                )}
                {isVisible("Desktop Notifications", "Browser") && (
                    <ToggleCard label="Desktop Notifications" description="Push browser notifications when a scan completes." status="Configurable" value={settings.desktopAlerts} onChange={(val) => updateSetting("desktopAlerts", val)} />
                )}
                {isVisible("Slack Integration", "Post") && (
                    <ActionCard label="Slack Integration" description="Post alerts directly to a Slack channel." status="Disabled" buttonText="Connect Slack" disabled />
                )}
                {isVisible("Discord Webhook", "Send") && (
                    <ActionCard label="Discord Webhook" description="Send automated incident reports to Discord." status="Coming Soon" buttonText="Configure Webhook" disabled />
                )}
                {isVisible("Microsoft Teams", "Connect") && (
                    <ActionCard label="Microsoft Teams" description="Connect to an MS Teams workspace." status="Coming Soon" buttonText="Connect Teams" disabled />
                )}
            </SettingGroup>
        </div>
    );
}

// 6. System Health Dashboard
export function SystemSection() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <SectionHeader title="System Dashboard" description="Live status of underlying services, engines, and resources." icon={ActivitySquare} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <HealthCard title="Backend API" icon={Server} status="Operational" metric="1.2ms latency" color="green" />
                <HealthCard title="Database" icon={Database} status="Operational" metric="Connected" color="green" />
                <HealthCard title="Scanner Engine" icon={Terminal} status="Idle" metric="0 Active" color="cyan" />
                <HealthCard title="AI Engine" icon={Zap} status="Degraded" metric="Rate Limited" color="amber" />
                <HealthCard title="Memory Usage" icon={Cpu} status="Healthy" metric="2.1 GB / 16 GB" color="purple" />
                <HealthCard title="Disk Usage" icon={HardDrive} status="Healthy" metric="45 GB / 500 GB" color="purple" />
                <HealthCard title="Service Uptime" icon={Clock} status="Healthy" metric="14d 6h 32m" color="green" />
                <HealthCard title="Network" icon={Globe} status="Operational" metric="0% Packet Loss" color="green" />
            </div>
        </div>
    );
}

function HealthCard({ title, icon: Icon, status, metric, color }) {
    const colorMap = {
        green: "from-green-500/20 to-emerald-500/5 text-green-400 border-green-500/30",
        amber: "from-amber-500/20 to-orange-500/5 text-amber-400 border-amber-500/30",
        red: "from-red-500/20 to-rose-500/5 text-red-400 border-red-500/30",
        cyan: "from-cyan-500/20 to-blue-500/5 text-cyan-400 border-cyan-500/30",
        purple: "from-purple-500/20 to-fuchsia-500/5 text-purple-400 border-purple-500/30",
    };

    const dotMap = {
        green: "bg-green-400",
        amber: "bg-amber-400",
        red: "bg-red-400 animate-pulse",
        cyan: "bg-cyan-400",
        purple: "bg-purple-400",
    }

    return (
        <div className={`p-5 rounded-2xl border bg-gradient-to-br bg-slate-900/60 backdrop-blur-sm ${colorMap[color]} shadow-lg`}>
            <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-950/50 flex items-center justify-center border border-slate-700/50 shadow-inner">
                    <Icon size={20} />
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950/40 px-2 py-1 rounded border border-slate-800/80">
                    <span className={`w-2 h-2 rounded-full ${dotMap[color]}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">{status}</span>
                </div>
            </div>
            <h3 className="text-white font-semibold mb-1">{title}</h3>
            <p className="text-sm font-medium opacity-80">{metric}</p>
        </div>
    );
}

// 7. Storage / Data Settings
export function StorageSection({ query, onExport, onImport, onReset }) {
    const isVisible = (title, desc) => matchesSearch(title, query) || matchesSearch(desc, query);
    
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            onImport(file);
        }
        e.target.value = null; // Reset input so the same file can be imported again if needed
    };
    
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <SectionHeader title="Storage & Data" description="Manage platform data, backups, and configurations." icon={HardDrive} />
            <SettingGroup>
                {isVisible("Export Configuration", "Download") && (
                    <ActionCard label="Export Configuration" description="Download all current settings as a JSON profile." status="Implemented" buttonText="Export Profile" onClick={onExport} />
                )}
                {isVisible("Import Configuration", "Upload") && (
                    <>
                        <input type="file" accept=".json" id="import-config-input" className="hidden" onChange={handleFileChange} />
                        <ActionCard label="Import Configuration" description="Upload a JSON profile to overwrite settings." status="Implemented" buttonText="Import Profile" onClick={() => document.getElementById('import-config-input').click()} />
                    </>
                )}
                {isVisible("Backup Database", "Create") && (
                    <ActionCard label="Backup Database" description="Create a full snapshot of the PostgreSQL database." status="Coming Soon" buttonText="Create Backup" disabled />
                )}
            </SettingGroup>

            {isVisible("Danger", "Reset") && (
                <DangerZone>
                    <ActionCard label="Reset Settings" description="Restore all settings to factory defaults. This action cannot be undone." danger={true} buttonText="Reset Defaults" onClick={onReset} />
                    <ActionCard label="Purge Scan History" description="Permanently delete all reports, findings, and logs." danger={true} buttonText="Purge Data" disabled />
                </DangerZone>
            )}
        </div>
    );
}

// 8. About Section
export function AboutSection() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <SectionHeader title="About Sentinel AI" description="System information and licensing." icon={Info} />
            
            <div className="p-6 rounded-2xl border border-slate-800/60 bg-slate-900/40 space-y-6">
                <div className="flex items-center gap-4 border-b border-slate-800/60 pb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-fuchsia-600 flex items-center justify-center shadow-[0_0_24px_rgba(168,85,247,0.3)]">
                        <ShieldCheck size={32} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-300 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">Sentinel AI</h2>
                        <p className="text-slate-400 text-sm">Enterprise Security Platform</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Version</p>
                        <p className="text-sm font-medium text-white">v2.4.0-enterprise</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Build</p>
                        <p className="text-sm font-medium text-white">#8942a1b (Latest)</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">License</p>
                        <p className="text-sm font-medium text-cyan-400">Commercial / Valid</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Environment</p>
                        <p className="text-sm font-medium text-purple-400">Production</p>
                    </div>
                </div>

                <div className="border-t border-slate-800/60 pt-6">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">Core Technology Stack</p>
                    <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1.5 rounded-lg bg-slate-950/50 border border-slate-800 text-xs text-slate-300">FastAPI</span>
                        <span className="px-3 py-1.5 rounded-lg bg-slate-950/50 border border-slate-800 text-xs text-slate-300">React 18</span>
                        <span className="px-3 py-1.5 rounded-lg bg-slate-950/50 border border-slate-800 text-xs text-slate-300">TailwindCSS</span>
                        <span className="px-3 py-1.5 rounded-lg bg-slate-950/50 border border-slate-800 text-xs text-slate-300">PostgreSQL</span>
                        <span className="px-3 py-1.5 rounded-lg bg-slate-950/50 border border-slate-800 text-xs text-slate-300">SQLMap</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
