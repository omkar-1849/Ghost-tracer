import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, AlertCircle, Lock, Mail, Radar, ShieldAlert, Activity } from "lucide-react";
import { login } from "../services/authClient";

function BrandMark({ size = 40 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect width="48" height="48" rx="10" fill="#1b2120" />
            <path
                d="M24 7.5l12.5 4.7v10.5c0 8.2-5.3 15.1-12.5 17.9-7.2-2.8-12.5-9.7-12.5-17.9V12.2L24 7.5z"
                fill="#45a583"
            />
            <path
                d="M24 14.5l7.4 2.8v6.3c0 4.9-3.1 9-7.4 10.6-4.3-1.6-7.4-5.7-7.4-10.6v-6.3l7.4-2.8z"
                fill="#0b0e0d"
            />
            <circle cx="24" cy="22.4" r="2.7" fill="#c9a961" />
            <path d="M23 24.5h2l1 5.2h-4l1-5.2z" fill="#c9a961" />
        </svg>
    );
}

/* Real platform modules — no fabricated capability claims */
const modules = [
    {
        icon: Radar,
        title: "Multi-Engine Scanning",
        text: "SQLMap, Nmap, Nikto, Nuclei, ZAP and SSL analysis from one console.",
    },
    {
        icon: ShieldAlert,
        title: "Incident Response",
        text: "Triage, investigate and resolve threats with a structured queue.",
    },
    {
        icon: Activity,
        title: "Live Telemetry",
        text: "Real-time event ingestion, risk scoring and attack surface metrics.",
    },
];

export default function Login() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const redirect = searchParams.get("redirect") || "/";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            await login(email, password);
            navigate(redirect, { replace: true });
        } catch (err) {
            setError(err.message || "Authentication failed.");
        } finally {
            setIsLoading(false);
        }
    };

    const inputClasses =
        "w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] py-2 pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] transition-colors duration-150 hover:border-[var(--color-border-strong)] focus:border-[var(--color-signal)] focus:outline-none focus:ring-1 focus:ring-[var(--color-signal-strong)]";

    return (
        <div className="min-h-screen grid lg:grid-cols-[5fr_4fr]">
            {/* ------------------------------------------------------------
                Brand panel — the operations identity. Static, quiet, matte.
                ------------------------------------------------------------ */}
            <div className="hidden lg:flex flex-col bg-[var(--color-surface-1)] border-r border-[var(--color-border-subtle)] px-12 py-10 relative overflow-hidden">
                {/* Hairline instrument column — structure, not decoration */}
                <div
                    className="absolute inset-y-0 left-1/2 w-px bg-[var(--color-border-subtle)] opacity-60"
                    aria-hidden="true"
                />

                <div className="relative flex items-center gap-3">
                    <BrandMark />
                    <div>
                        <p className="text-[15px] font-bold tracking-tight text-[var(--color-text-primary)] leading-none">
                            Sentinel <span className="text-[var(--color-signal)]">AI</span>
                        </p>
                        <p className="text-[10px] font-medium tracking-[0.1em] uppercase text-[var(--color-text-muted)] mt-1">
                            Security Operations
                        </p>
                    </div>
                </div>

                <div className="relative mt-auto max-w-md">
                    <p className="section-label mb-3">The Platform</p>
                    <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)] leading-snug">
                        Continuous visibility across your entire attack surface.
                    </h2>
                    <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mt-3">
                        Sentinel AI unifies vulnerability assessment, threat detection and
                        incident response into a single operational console for security teams.
                    </p>

                    <div className="mt-8 space-y-4">
                        {modules.map((m) => (
                            <div key={m.title} className="flex items-start gap-3">
                                <span className="w-8 h-8 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border-subtle)] flex items-center justify-center shrink-0">
                                    <m.icon size={15} className="text-[var(--color-text-secondary)]" />
                                </span>
                                <div>
                                    <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                                        {m.title}
                                    </p>
                                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
                                        {m.text}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="relative mono-value text-[10px] text-[var(--color-text-disabled)] mt-10">
                    v2.4.0-enterprise · Authorized access only
                </p>
            </div>

            {/* ------------------------------------------------------------
                Form panel
                ------------------------------------------------------------ */}
            <div className="flex items-center justify-center bg-[var(--color-canvas)] px-6 py-12">
                <div className="w-full max-w-sm">
                    {/* Mobile brand */}
                    <div className="flex flex-col items-center mb-8 lg:hidden">
                        <BrandMark size={44} />
                        <h1 className="mt-4 text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
                            Sentinel <span className="text-[var(--color-signal)]">AI</span>
                        </h1>
                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                            Security Operations Console
                        </p>
                    </div>

                    <p className="section-label mb-1.5">Sign In</p>
                    <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">
                        Analyst Console Access
                    </h2>
                    <p className="mt-1.5 text-[13px] text-[var(--color-text-muted)]">
                        Authenticate to continue to the operations workspace.
                    </p>

                    <form onSubmit={handleSubmit} className="mt-7">
                        {error && (
                            <div
                                role="alert"
                                className="mb-5 flex items-center gap-2.5 rounded-md border border-[rgba(223,91,91,0.25)] bg-[rgba(223,91,91,0.08)] px-3.5 py-2.5 text-sm text-[var(--color-critical)] animate-[shake_0.35s_ease-in-out_both]"
                            >
                                <AlertCircle size={15} className="shrink-0" />
                                {error}
                            </div>
                        )}

                        <label className="block mb-4">
                            <span className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                                Email address
                            </span>
                            <div className="relative">
                                <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="analyst@sentinel.io"
                                    autoComplete="email"
                                    className={inputClasses}
                                />
                            </div>
                        </label>

                        <label className="block mb-6">
                            <span className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                                Password
                            </span>
                            <div className="relative">
                                <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    autoComplete="current-password"
                                    className={inputClasses}
                                />
                            </div>
                        </label>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full rounded-md bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-[var(--color-accent-foreground)] shadow-[var(--shadow-1)] transition-all duration-150 hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-active)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading && <Loader2 size={15} className="animate-spin" />}
                            {isLoading ? "Authenticating…" : "Sign in to Console"}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-[11px] leading-relaxed text-[var(--color-text-disabled)]">
                        Sentinel AI · Enterprise Security Platform
                        <br />
                        All activity is monitored and audited.
                    </p>
                </div>
            </div>
        </div>
    );
}
