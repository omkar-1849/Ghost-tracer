import { useState } from "react";
import { useNavigate, useSearchParams, useLocation, Link } from "react-router-dom";
import { Lock, Mail, CheckCircle2 } from "lucide-react";
import { login, publicAuthRequest, clearToken } from "../services/authClient";

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
    const requested = searchParams.get("redirect") || "/";
    const redirect = requested.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\") ? requested : "/";
    const { pathname } = useLocation();
    const isRegister = pathname === "/register";
    const forgot = pathname === "/forgot-password";
    const reset = pathname === "/reset-password";
    const [message, setMessage] = useState("");
    const [resetToken] = useState(() => searchParams.get("token") || new URLSearchParams(window.location.hash.slice(1)).get("token") || "");

    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            if (isRegister) {
                await publicAuthRequest("register", { email, password, full_name: fullName.trim() || undefined });
                await login(email, password);
                navigate(redirect, { replace: true });
            } else if (forgot) {
                await publicAuthRequest("forgot-password", { email });
                setMessage("If an account exists, recovery instructions will be sent to its email address.");
            } else if (reset) {
                await publicAuthRequest("reset-password", { token: resetToken, new_password: password });
                clearToken();
                setPassword("");
                setMessage("Password reset successful. Sign in with your new password.");
                window.history.replaceState(null, "", "/reset-password");
            } else {
                await login(email, password);
                navigate(redirect, { replace: true });
            }
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

                {message && <p role="status" className="text-sm">{message}</p>}
                {error && (
                    <div className="p-3 rounded-lg bg-[rgba(230,57,70,0.12)] border border-[rgba(230,57,70,0.3)] text-[var(--color-critical)] text-xs font-mono">
                        {error}
                    </div>
                )}

                <h2>{isRegister ? "Create account" : forgot ? "Recover account" : reset ? "Reset password" : "Sign in"}</h2>
                {reset && !resetToken && <p role="alert">Open the reset link from your email to continue.</p>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {isRegister && <div>
                        <label className="block text-[11px] font-mono text-[var(--color-text-muted)] uppercase mb-1">
                            Full Name
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Security Analyst"
                                className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-xs text-white placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[rgba(255,255,255,0.4)]"
                            />
                        </div>
                    </div>}

                    {!reset && <div>
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
                    </div>}

                    {!forgot && <div>
                        <label className="block text-[11px] font-mono text-[var(--color-text-muted)] uppercase mb-1">
                            Password
                        </label>
                        <div className="relative">
                            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                            <input
                                type="password"
                                minLength={isRegister || reset ? 8 : undefined}
                                autoComplete={isRegister || reset ? "new-password" : "current-password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••••••"
                                required
                                className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[rgba(255,255,255,0.4)]"
                            />
                        </div>
                    </div>}

                    <button
                        type="submit"
                        disabled={isLoading || (reset && !resetToken)}
                        className="w-full py-2.5 rounded-lg bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all duration-150 shadow-sm disabled:opacity-50 mt-2"
                    >
                        {isLoading ? "Please wait…" : isRegister ? "Create Account" : forgot ? "Send recovery email" : reset ? "Reset password" : "Authenticate Session"}
                    </button>
                </form>

                <div className="flex justify-between items-center text-xs">
                    {isRegister ? (
                        <Link className="underline text-[var(--color-text-muted)] hover:text-white" to="/login">Already have an account? Sign in</Link>
                    ) : forgot || reset ? (
                        <Link className="underline text-[var(--color-text-muted)] hover:text-white" to="/login">Back to sign in</Link>
                    ) : (
                        <>
                            <Link className="underline text-[var(--color-text-muted)] hover:text-white" to="/register">Create account</Link>
                            <Link className="underline text-[var(--color-text-muted)] hover:text-white" to="/forgot-password">Forgot password?</Link>
                        </>
                    )}
                </div>
                {/* Transport security depends on deployment */}
                <div className="pt-4 border-t border-[var(--color-border-subtle)] text-center text-[11px] font-mono text-[var(--color-text-muted)] flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={13} className="text-[var(--color-success)]" />
                    <span>Use a trusted HTTPS deployment for remote access</span>
                </div>
            </div>
        </div>
    );
}
