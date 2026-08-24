import { useState, useEffect } from "react";
import {
    Settings as SettingsIcon,
    Server,
    Terminal,
    ShieldCheck,
    Bell,
    HardDrive,
    Users,
    Key,
    Info,
    Save,
    RotateCcw,
    CheckCircle2,
    AlertCircle,
    User,
    LogOut,
} from "lucide-react";
import { getSettings, updateSettings, resetSettings } from "../services/settingsApi";
import { authFetch, isAuthenticated } from "../services/authClient";

const SECTIONS = [
    { id: "platform", label: "General & Platform", icon: Server },
    { id: "scanning", label: "Scanning Engines", icon: Terminal },
    { id: "security", label: "Security & Access", icon: ShieldCheck },
    { id: "notifications", label: "Notifications & Alerts", icon: Bell },
    { id: "organization", label: "Organization & RBAC", icon: Users },
    { id: "sessions", label: "Active Sessions", icon: Key },
    { id: "about", label: "About & Diagnostics", icon: Info },
];

export default function Settings() {
    const [activeSection, setActiveSection] = useState("platform");
    const [settings, setSettings] = useState({
        orgName: "Sentinel Security Ops",
        platformName: "Sentinel AI",
        timezone: "UTC",
        region: "us-east-1",
        defaultScanner: "sqlmap",
        concurrentScans: 5,
        scanTimeout: 120,
        randomAgent: true,
        followRedirects: true,
        sessionTimeout: 30,
        auditLogging: true,
        emailAlerts: true,
        desktopAlerts: false,
    });

    const [members, setMembers] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);

    const isAuthed = isAuthenticated();

    useEffect(() => {
        let isMounted = true;
        async function fetchAll() {
            try {
                const data = await getSettings();
                if (isMounted && data) {
                    setSettings(data);
                }

                if (isAuthed) {
                    // Fetch organization members & sessions
                    const [memRes, sessRes] = await Promise.allSettled([
                        authFetch("http://127.0.0.1:8000/organization/members").then((r) => r.json()),
                        authFetch("http://127.0.0.1:8000/sessions").then((r) => r.json()),
                    ]);
                    if (isMounted) {
                        if (memRes.status === "fulfilled" && Array.isArray(memRes.value)) {
                            setMembers(memRes.value);
                        }
                        if (sessRes.status === "fulfilled" && Array.isArray(sessRes.value)) {
                            setSessions(sessRes.value);
                        }
                    }
                }
            } catch (err) {
                console.error("Settings load error", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchAll();
        return () => { isMounted = false; };
    }, [isAuthed]);

    const showToast = (msg, type = "success") => {
        setToastMessage({ text: msg, type });
        setTimeout(() => setToastMessage(null), 4000);
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);
        try {
            const updated = await updateSettings(settings);
            setSettings(updated);
            showToast("Settings successfully saved to backend.");
        } catch (err) {
            showToast(err.message || "Failed to save settings.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!confirm("Are you sure you want to reset settings to default?")) return;
        setSaving(true);
        try {
            const res = await resetSettings();
            setSettings(res);
            showToast("Settings reset to defaults.");
        } catch (err) {
            showToast("Failed to reset settings.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleRevokeSession = async (sessionId) => {
        try {
            await authFetch(`http://127.0.0.1:8000/sessions/${sessionId}`, { method: "DELETE" });
            setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
            showToast("Session revoked.");
        } catch (err) {
            showToast("Failed to revoke session.", "error");
        }
    };

    return (
        <div className="p-8 space-y-6 max-w-[1600px] mx-auto animate-fade-in select-none">
            {/* Toast feedback */}
            {toastMessage && (
                <div
                    className={`fixed top-5 right-8 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium shadow-[var(--shadow-modal)] animate-fade-in ${
                        toastMessage.type === "error"
                            ? "bg-[var(--color-surface-3)] border-[var(--color-critical)] text-[var(--color-critical)]"
                            : "bg-[var(--color-surface-3)] border-white/40 text-white"
                    }`}
                >
                    {toastMessage.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                    <span>{toastMessage.text}</span>
                </div>
            )}

            {/* Top Title & Sticky Save Control Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--color-border-subtle)]">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                        <SettingsIcon size={24} className="text-white" />
                        <span>System & Security Settings</span>
                    </h1>
                    <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                        Enterprise configuration, scanning rules, access controls, and preferences
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleReset}
                        className="px-3.5 py-2 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] text-xs text-[var(--color-text-secondary)] hover:text-white transition-all"
                    >
                        Reset Defaults
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 rounded-lg bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all shadow-sm disabled:opacity-50"
                    >
                        <Save size={14} />
                        <span>{saving ? "Saving Changes…" : "Save Changes"}</span>
                    </button>
                </div>
            </div>

            {/* Layout Grid: Left Sidebar Navigation + Right Config Panel */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
                {/* Navigation Tabs */}
                <div className="frosted-card p-2 space-y-1 md:col-span-1">
                    {SECTIONS.map((sec) => {
                        const isActive = activeSection === sec.id;
                        return (
                            <button
                                key={sec.id}
                                type="button"
                                onClick={() => setActiveSection(sec.id)}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                                    isActive
                                        ? "bg-white text-black font-semibold shadow-sm"
                                        : "text-[var(--color-text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.04)]"
                                }`}
                            >
                                <sec.icon size={16} />
                                <span>{sec.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Configuration Forms */}
                <div className="md:col-span-3 frosted-card p-6 space-y-6">
                    {/* 1. General & Platform */}
                    {activeSection === "platform" && (
                        <div className="space-y-5">
                            <div>
                                <h3 className="text-base font-bold text-white">General Platform Settings</h3>
                                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                    Organization identity and regional operational context
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-mono text-[var(--color-text-muted)] uppercase mb-1.5">
                                        Organization Name
                                    </label>
                                    <input
                                        type="text"
                                        value={settings.orgName || ""}
                                        onChange={(e) => setSettings({ ...settings, orgName: e.target.value })}
                                        className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[rgba(255,255,255,0.4)]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-mono text-[var(--color-text-muted)] uppercase mb-1.5">
                                        Platform Display Name
                                    </label>
                                    <input
                                        type="text"
                                        value={settings.platformName || ""}
                                        onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                                        className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[rgba(255,255,255,0.4)]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-mono text-[var(--color-text-muted)] uppercase mb-1.5">
                                        Time Zone
                                    </label>
                                    <select
                                        value={settings.timezone || "UTC"}
                                        onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                                        className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none"
                                    >
                                        <option value="UTC">UTC (Coordinated Universal Time)</option>
                                        <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                                        <option value="America/New_York">America/New_York (EST)</option>
                                        <option value="Europe/London">Europe/London (GMT)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-mono text-[var(--color-text-muted)] uppercase mb-1.5">
                                        Cloud Region
                                    </label>
                                    <select
                                        value={settings.region || "us-east-1"}
                                        onChange={(e) => setSettings({ ...settings, region: e.target.value })}
                                        className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none"
                                    >
                                        <option value="us-east-1">US East (N. Virginia)</option>
                                        <option value="eu-central-1">Europe (Frankfurt)</option>
                                        <option value="ap-south-1">Asia Pacific (Mumbai)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. Scanning Engines */}
                    {activeSection === "scanning" && (
                        <div className="space-y-5">
                            <div>
                                <h3 className="text-base font-bold text-white">Vulnerability Scanner Parameters</h3>
                                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                    Execution timeouts, concurrency limits, and engine preferences
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-mono text-[var(--color-text-muted)] uppercase mb-1.5">
                                        Default Scanner Engine
                                    </label>
                                    <select
                                        value={settings.defaultScanner || "sqlmap"}
                                        onChange={(e) => setSettings({ ...settings, defaultScanner: e.target.value })}
                                        className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none"
                                    >
                                        <option value="sqlmap">SQLMap (SQL Injection)</option>
                                        <option value="nmap">Nmap (Network Port Scan)</option>
                                        <option value="nuclei">Nuclei (Vulnerability Templates)</option>
                                        <option value="nikto">Nikto (Web Server Security)</option>
                                        <option value="zap">OWASP ZAP (API & Web App)</option>
                                        <option value="ssl">SSL Analyzer (TLS Audit)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-mono text-[var(--color-text-muted)] uppercase mb-1.5">
                                        Max Concurrent Scans
                                    </label>
                                    <input
                                        type="number"
                                        value={settings.concurrentScans || 5}
                                        onChange={(e) => setSettings({ ...settings, concurrentScans: Number(e.target.value) })}
                                        className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-mono text-[var(--color-text-muted)] uppercase mb-1.5">
                                        Scan Timeout (seconds)
                                    </label>
                                    <input
                                        type="number"
                                        value={settings.scanTimeout || 120}
                                        onChange={(e) => setSettings({ ...settings, scanTimeout: Number(e.target.value) })}
                                        className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none"
                                    />
                                </div>

                                <div className="flex items-center gap-3 pt-6">
                                    <input
                                        type="checkbox"
                                        id="randomAgent"
                                        checked={!!settings.randomAgent}
                                        onChange={(e) => setSettings({ ...settings, randomAgent: e.target.checked })}
                                        className="w-4 h-4 rounded bg-[var(--color-surface-1)] border-[var(--color-border-default)]"
                                    />
                                    <label htmlFor="randomAgent" className="text-sm text-white font-medium cursor-pointer">
                                        Randomize User Agent per scan request
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. Security & Access */}
                    {activeSection === "security" && (
                        <div className="space-y-5">
                            <div>
                                <h3 className="text-base font-bold text-white">Security & Access Policies</h3>
                                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                    Session timeout thresholds and audit logging enforcement
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-mono text-[var(--color-text-muted)] uppercase mb-1.5">
                                        Inactivity Session Timeout (Minutes)
                                    </label>
                                    <input
                                        type="number"
                                        value={settings.sessionTimeout || 30}
                                        onChange={(e) => setSettings({ ...settings, sessionTimeout: Number(e.target.value) })}
                                        className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none"
                                    />
                                </div>

                                <div className="flex items-center gap-3 pt-6">
                                    <input
                                        type="checkbox"
                                        id="auditLogging"
                                        checked={!!settings.auditLogging}
                                        onChange={(e) => setSettings({ ...settings, auditLogging: e.target.checked })}
                                        className="w-4 h-4 rounded bg-[var(--color-surface-1)] border-[var(--color-border-default)]"
                                    />
                                    <label htmlFor="auditLogging" className="text-sm text-white font-medium cursor-pointer">
                                        Enable immutable audit logging for all mutations
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. Notifications */}
                    {activeSection === "notifications" && (
                        <div className="space-y-5">
                            <div>
                                <h3 className="text-base font-bold text-white">Notification Channels</h3>
                                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                    Alert delivery for critical and high severity security events
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)]">
                                    <input
                                        type="checkbox"
                                        id="emailAlerts"
                                        checked={!!settings.emailAlerts}
                                        onChange={(e) => setSettings({ ...settings, emailAlerts: e.target.checked })}
                                        className="w-4 h-4 rounded"
                                    />
                                    <label htmlFor="emailAlerts" className="text-sm text-white font-medium cursor-pointer">
                                        Email Notifications for Critical Threat Detections
                                    </label>
                                </div>

                                <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)]">
                                    <input
                                        type="checkbox"
                                        id="desktopAlerts"
                                        checked={!!settings.desktopAlerts}
                                        onChange={(e) => setSettings({ ...settings, desktopAlerts: e.target.checked })}
                                        className="w-4 h-4 rounded"
                                    />
                                    <label htmlFor="desktopAlerts" className="text-sm text-white font-medium cursor-pointer">
                                        Browser Real-time Toast Notifications
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 5. Organization & Members */}
                    {activeSection === "organization" && (
                        <div className="space-y-5">
                            <div>
                                <h3 className="text-base font-bold text-white">Organization Members & RBAC</h3>
                                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                    Active team members and role assignment
                                </p>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-[var(--color-border-default)] font-mono text-[var(--color-text-muted)] uppercase">
                                            <th className="pb-2 font-medium">User</th>
                                            <th className="pb-2 font-medium">Role</th>
                                            <th className="pb-2 font-medium">Joined</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-border-subtle)]">
                                        {members.length === 0 ? (
                                            <tr>
                                                <td colSpan="3" className="py-4 text-[var(--color-text-muted)]">
                                                    Admin Analyst (Owner) · Active
                                                </td>
                                            </tr>
                                        ) : (
                                            members.map((m) => (
                                                <tr key={m.id}>
                                                    <td className="py-2.5 text-white font-medium">{m.user?.email || `User #${m.user_id}`}</td>
                                                    <td className="py-2.5 font-mono text-[var(--color-text-secondary)]">{m.role}</td>
                                                    <td className="py-2.5 font-mono text-[var(--color-text-muted)]">{new Date(m.created_at).toLocaleDateString()}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 6. Active Sessions */}
                    {activeSection === "sessions" && (
                        <div className="space-y-5">
                            <div>
                                <h3 className="text-base font-bold text-white">Active User Sessions</h3>
                                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                    Current active JWT tokens and client connections
                                </p>
                            </div>

                            <div className="space-y-2.5">
                                {sessions.length === 0 ? (
                                    <div className="p-4 text-xs font-mono text-[var(--color-text-muted)]">
                                        Current Session (Active) · 127.0.0.1
                                    </div>
                                ) : (
                                    sessions.map((s) => (
                                        <div
                                            key={s.session_id}
                                            className="p-3 rounded-lg bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] flex items-center justify-between"
                                        >
                                            <div>
                                                <p className="text-xs font-mono text-white font-semibold">
                                                    Session: {s.session_id.slice(0, 16)}…
                                                </p>
                                                <p className="text-[11px] font-mono text-[var(--color-text-muted)] mt-0.5">
                                                    IP: {s.ip_address || "127.0.0.1"} · Created: {new Date(s.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRevokeSession(s.session_id)}
                                                className="px-2.5 py-1 rounded bg-[rgba(230,57,70,0.15)] text-[var(--color-critical)] text-[11px] font-mono hover:bg-[rgba(230,57,70,0.25)] transition-colors"
                                            >
                                                Revoke
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* 7. About */}
                    {activeSection === "about" && (
                        <div className="space-y-5">
                            <div>
                                <h3 className="text-base font-bold text-white">About Sentinel AI</h3>
                                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                    Platform version, build identifier, and system diagnostics
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                                <div className="p-3 rounded-lg bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)]">
                                    <span className="text-[var(--color-text-muted)] block">Version</span>
                                    <span className="text-white font-bold text-sm">v2.5.0 Enterprise</span>
                                </div>
                                <div className="p-3 rounded-lg bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)]">
                                    <span className="text-[var(--color-text-muted)] block">Build Hash</span>
                                    <span className="text-white font-bold text-sm">#94e02fb</span>
                                </div>
                                <div className="p-3 rounded-lg bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)]">
                                    <span className="text-[var(--color-text-muted)] block">FastAPI Backend</span>
                                    <span className="text-[var(--color-success)] font-bold text-sm">Connected (Port 8000)</span>
                                </div>
                                <div className="p-3 rounded-lg bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)]">
                                    <span className="text-[var(--color-text-muted)] block">Vulnerability Engines</span>
                                    <span className="text-white font-bold text-sm">6 Engines Ready</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}