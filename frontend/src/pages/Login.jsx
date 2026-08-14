import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ShieldCheck, Loader2, AlertCircle, Lock, Mail } from "lucide-react";
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
        <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
            <div className="w-full max-w-md">
                {/* Branding */}
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-fuchsia-600 flex items-center justify-center shadow-[0_0_32px_rgba(168,85,247,0.35)] mb-5">
                        <ShieldCheck size={32} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent tracking-tight">
                        Sentinel AI
                    </h1>
                    <p className="mt-1.5 text-sm text-slate-500">
                        Sign in to access the administration console
                    </p>
                </div>

                {/* Login card */}
                <form
                    onSubmit={handleSubmit}
                    className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-8 shadow-2xl shadow-black/30"
                >
                    {error && (
                        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                            <AlertCircle size={16} className="shrink-0 text-red-400" />
                            {error}
                        </div>
                    )}

                    <label className="block mb-5">
                        <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                            Email address
                        </span>
                        <div className="relative">
                            <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="analyst@sentinel.io"
                                autoComplete="email"
                                className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 transition-all duration-200 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                            />
                        </div>
                    </label>

                    <label className="block mb-8">
                        <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                            Password
                        </span>
                        <div className="relative">
                            <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••••••"
                                autoComplete="current-password"
                                className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 transition-all duration-200 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                            />
                        </div>
                    </label>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 py-3 text-sm font-bold text-white transition-all duration-200 hover:from-indigo-500 hover:via-purple-500 hover:to-fuchsia-500 shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading && <Loader2 size={16} className="animate-spin" />}
                        {isLoading ? "Authenticating…" : "Sign in"}
                    </button>
                </form>

                <p className="mt-6 text-center text-xs text-slate-600">
                    Sentinel AI · Enterprise Security Platform
                </p>
            </div>
        </div>
    );
}
