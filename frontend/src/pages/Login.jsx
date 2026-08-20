import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Shield, Loader2, AlertCircle, Lock, Mail } from "lucide-react";
import { login } from "../services/authClient";

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

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)] px-4">
            <div className="w-full max-w-sm">
                {/* Branding */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-12 h-12 rounded-lg bg-[var(--color-accent)] flex items-center justify-center mb-4">
                        <Shield size={24} className="text-white" />
                    </div>
                    <h1 className="text-xl font-semibold text-[var(--color-text-primary)] tracking-tight">
                        Sentinel AI
                    </h1>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                        Sign in to access the administration console
                    </p>
                </div>

                {/* Login card */}
                <form
                    onSubmit={handleSubmit}
                    className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-2)] p-6 shadow-[var(--shadow-2)]"
                >
                    {error && (
                        <div className="mb-5 flex items-center gap-2.5 rounded-md border border-[rgba(229,72,77,0.25)] bg-[rgba(229,72,77,0.08)] px-3.5 py-2.5 text-sm text-[var(--color-critical)]">
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
                                className="w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] py-2 pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] transition-colors duration-150 hover:border-[var(--color-border-strong)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
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
                                className="w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] py-2 pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] transition-colors duration-150 hover:border-[var(--color-border-strong)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                            />
                        </div>
                    </label>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full rounded-md bg-[var(--color-accent)] py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading && <Loader2 size={15} className="animate-spin" />}
                        {isLoading ? "Authenticating…" : "Sign in"}
                    </button>
                </form>

                <p className="mt-5 text-center text-xs text-[var(--color-text-disabled)]">
                    Sentinel AI · Enterprise Security Platform
                </p>
            </div>
        </div>
    );
}
