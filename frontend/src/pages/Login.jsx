import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Mail, ShieldAlert, Cpu, Radar, CheckCircle2 } from "lucide-react";
import { login } from "../services/authClient";

function BrandMark({ size = 32 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#12141A" stroke="#222530" strokeWidth="1" />
            <path
                d="M16 6L24 10V17C24 22.5 20.6 25.8 16 27C11.4 25.8 8 22.5 8 17V10L16 6Z"
                stroke="#FFFFFF"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx="16" cy="16" r="2.5" fill="#FFFFFF" />
        </svg>
    );
}

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
            setError(err.message || "Authentication failed. Check credentials.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)] p-6 select-none animate-fade-in relative overflow-hidden">
            {/* Subtle background ambient grid */}
            <div className="absolute inset-0 bg-[radial-gradient(#222530_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

            <div className="w-full max-w-md frosted-card p-8 relative z-10 space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="flex justify-center mb-3">
                        <BrandMark size={40} />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-white">
                        Sentinel <span className="font-mono text-sm text-[var(--color-text-muted)] font-normal">AI</span>
                    </h1>
                    <p className="text-xs text-[var(--color-text-muted)]">
                        Enterprise Security Operations & Threat Defense
                    </p>
                </div>

                {error && (
                    <div className="p-3 rounded-lg bg-[rgba(230,57,70,0.12)] border border-[rgba(230,57,70,0.3)] text-[var(--color-critical)] text-xs font-mono">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[11px] font-mono text-[var(--color-text-muted)] uppercase mb-1">
                            Email Address
                        </label>
                        <div className="relative">
                            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="analyst@sentinel.local"
                                required
                                className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[rgba(255,255,255,0.4)]"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[11px] font-mono text-[var(--color-text-muted)] uppercase mb-1">
                            Password
                        </label>
                        <div className="relative">
                            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••••••"
                                required
                                className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[rgba(255,255,255,0.4)]"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-2.5 rounded-lg bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all duration-150 shadow-sm disabled:opacity-50 mt-2"
                    >
                        {isLoading ? "Authenticating…" : "Authenticate Session"}
                    </button>
                </form>

                {/* Footer security badge */}
                <div className="pt-4 border-t border-[var(--color-border-subtle)] text-center text-[11px] font-mono text-[var(--color-text-muted)] flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={13} className="text-[var(--color-success)]" />
                    <span>256-bit TLS Encrypted Session</span>
                </div>
            </div>
        </div>
    );
}
