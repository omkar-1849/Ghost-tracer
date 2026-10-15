import { useState } from "react";
import { useNavigate, useSearchParams, useLocation, Link } from "react-router-dom";
import {
    LockKeyhole,
    Mail,
    CheckCircle2,
    ShieldCheck,
    Activity,
    BrainCircuit,
    Fingerprint,
    Eye,
    EyeOff,
    User,
    ArrowRight,
} from "lucide-react";
import { login, publicAuthRequest, clearToken } from "../services/authClient";
import "./Login.css";

function BrandMark() {
    return (
        <div className="sentinel-brand-mark-box" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                <path
                    d="M16 5L25 9.5V17C25 22.8 21.2 26.2 16 27.5C10.8 26.2 7 22.8 7 17V9.5L16 5Z"
                    stroke="#E6E5E1"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                />
                <circle cx="16" cy="16" r="2.5" fill="#C5C4BE" />
            </svg>
        </div>
    );
}

const SECURITY_FEATURES = [
    {
        id: "detection",
        title: "Autonomous Threat Detection",
        icon: ShieldCheck,
    },
    {
        id: "response",
        title: "Real-time Incident Response",
        icon: Activity,
    },
    {
        id: "analytics",
        title: "Predictive Behavioral Analytics",
        icon: BrainCircuit,
    },
    {
        id: "intelligence",
        title: "Threat Intelligence",
        icon: Fingerprint,
    },
];

export default function Login() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const requested = searchParams.get("redirect") || "/";
    const redirect = requested.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\") ? requested : "/";
    const { pathname } = useLocation();
    const isRegister = pathname === "/register";
    const forgot = pathname === "/forgot-password";
    const reset = pathname === "/reset-password";
    const isLogin = !isRegister && !forgot && !reset;

    const [message, setMessage] = useState("");
    const [resetToken] = useState(() => searchParams.get("token") || new URLSearchParams(window.location.hash.slice(1)).get("token") || "");

    const [fullName, setFullName] = useState("");
    const [rememberMe, setRememberMe] = useState(() => {
        try {
            return localStorage.getItem("sentinel_remember_me") === "true";
        } catch {
            return false;
        }
    });
    const [email, setEmail] = useState(() => {
        try {
            return localStorage.getItem("sentinel_remember_email") || "";
        } catch {
            return "";
        }
    });
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const persistRememberedEmail = (targetEmail, shouldRemember) => {
        try {
            if (shouldRemember && targetEmail) {
                localStorage.setItem("sentinel_remember_email", targetEmail);
                localStorage.setItem("sentinel_remember_me", "true");
            } else {
                localStorage.removeItem("sentinel_remember_email");
                localStorage.removeItem("sentinel_remember_me");
            }
        } catch {
            // Ignore localStorage errors (e.g. storage access restricted)
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            if (isRegister) {
                await publicAuthRequest("register", { email, password, full_name: fullName.trim() || undefined });
                await login(email, password);
                persistRememberedEmail(email, rememberMe);
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
                persistRememberedEmail(email, rememberMe);
                navigate(redirect, { replace: true });
            }
        } catch (err) {
            setError(err.message || "Authentication failed. Check credentials.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="sentinel-login-shell">
            {/* Layer 1: Dedicated Background Layer with loginback.png */}
            <div className="sentinel-login-bg-layer" aria-hidden="true" />

            {/* Layer 2: Restrained Neutral-Black Readability Scrim */}
            <div className="sentinel-login-scrim" aria-hidden="true" />

            {/* Layer 3: Interactive Foreground Layout */}
            <main className="sentinel-login-foreground">
                {/* Left Hero Section */}
                <header className="sentinel-login-hero-section">
                    <div className="sentinel-login-brand-row">
                        <BrandMark />
                        <span className="sentinel-login-brand-wordmark">
                            SENTINEL <span className="accent">AI</span>
                        </span>
                    </div>
                    <h1 className="sentinel-login-headline">
                        <span className="sentinel-login-headline-line1">INTELLIGENT</span>
                        <span className="sentinel-login-headline-line2">SECURITY OPERATIONS</span>
                    </h1>
                    <p className="sentinel-login-supporting">
                        Unified Threat Defense &amp; Threat Intelligence
                    </p>
                </header>

                {/* Left Features List */}
                <section className="sentinel-login-features" aria-label="Security Capabilities">
                    {SECURITY_FEATURES.map((feature) => {
                        const Icon = feature.icon;
                        return (
                            <div key={feature.id} className="sentinel-feature-row">
                                <div className="sentinel-feature-icon-box" aria-hidden="true">
                                    <Icon size={18} strokeWidth={1.75} />
                                </div>
                                <span className="sentinel-feature-label">{feature.title}</span>
                            </div>
                        );
                    })}
                </section>

                {/* Left Footer Section */}
                <footer className="sentinel-login-footer">
                    <p className="sentinel-login-footer-meta">
                        Enterprise Cyber Defense Platform • Security Operations Console
                    </p>
                    <p className="sentinel-login-footer-copyright">
                        &copy; {new Date().getFullYear()} Sentinel AI. Authorized personnel only.
                    </p>
                </footer>

                {/* Right Large Floating Liquid-Glass Sign-In Panel */}
                <section className="sentinel-login-panel-container" aria-label="Console Sign-in">
                    <div className="sentinel-login-panel">
                        {/* Panel Brand Identity */}
                        <div className="sentinel-panel-brand-header">
                            <div className="sentinel-panel-brand-identity">
                                <BrandMark />
                                <div className="sentinel-panel-brand-titles">
                                    <span className="sentinel-panel-brand-name">
                                        SENTINEL <span className="accent">AI</span>
                                    </span>
                                    <span className="sentinel-panel-brand-soc">
                                        SECURITY OPERATIONS CENTER
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Panel Typography Hierarchy */}
                        <div className="sentinel-panel-header">
                            <h2 className="sentinel-panel-title">
                                {isRegister
                                    ? "Create account"
                                    : forgot
                                    ? "Recover account"
                                    : reset
                                    ? "Reset password"
                                    : "Sign in to Console"}
                            </h2>
                            <p className="sentinel-panel-subtitle">
                                {isRegister
                                    ? "Set up an operator account for the security console"
                                    : forgot
                                    ? "Enter your email to receive recovery instructions"
                                    : reset
                                    ? "Enter a new secure password for your account"
                                    : "Access your security operations environment"}
                            </p>
                        </div>

                        {message && (
                            <div role="status" id="auth-status-desc" className="sentinel-alert-status">
                                {message}
                            </div>
                        )}

                        {error && (
                            <div role="alert" id="auth-error-desc" className="sentinel-alert-error">
                                {error}
                            </div>
                        )}

                        {reset && !resetToken && (
                            <div role="alert" className="sentinel-alert-status">
                                Open the reset link from your email to continue.
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="sentinel-login-form">
                            {isRegister && (
                                <div className="sentinel-field-group">
                                    <label htmlFor="auth-fullname" className="sentinel-field-label">
                                        Full Name
                                    </label>
                                    <div className="sentinel-input-container">
                                        <User size={18} strokeWidth={1.75} className="sentinel-input-icon" aria-hidden="true" />
                                        <input
                                            id="auth-fullname"
                                            name="name"
                                            type="text"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder="Security Analyst"
                                            autoComplete="name"
                                            className="sentinel-input"
                                            aria-describedby={error ? "auth-error-desc" : undefined}
                                        />
                                    </div>
                                </div>
                            )}

                            {!reset && (
                                <div className="sentinel-field-group">
                                    <label htmlFor="auth-email" className="sentinel-field-label">
                                        Email Address
                                    </label>
                                    <div className="sentinel-input-container">
                                        <Mail size={18} strokeWidth={1.75} className="sentinel-input-icon" aria-hidden="true" />
                                        <input
                                            id="auth-email"
                                            name="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="analyst@sentinel.local"
                                            required
                                            autoComplete="email"
                                            className="sentinel-input"
                                            aria-describedby={error ? "auth-error-desc" : undefined}
                                        />
                                    </div>
                                </div>
                            )}

                            {!forgot && (
                                <div className="sentinel-field-group">
                                    <label htmlFor="auth-password" className="sentinel-field-label">
                                        {reset ? "New Password" : "Password"}
                                    </label>
                                    <div className="sentinel-input-container">
                                        <LockKeyhole size={18} strokeWidth={1.75} className="sentinel-input-icon" aria-hidden="true" />
                                        <input
                                            id="auth-password"
                                            name="password"
                                            type={showPassword ? "text" : "password"}
                                            minLength={isRegister || reset ? 8 : undefined}
                                            autoComplete={isRegister || reset ? "new-password" : "current-password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder={reset || isRegister ? "Minimum 8 characters" : "••••••••••••"}
                                            required
                                            className="sentinel-input with-toggle"
                                            aria-describedby={error ? "auth-error-desc" : undefined}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((prev) => !prev)}
                                            className="sentinel-toggle-visibility-btn"
                                            aria-label={showPassword ? "Hide password" : "Show password"}
                                            aria-pressed={showPassword}
                                        >
                                            {showPassword ? <EyeOff size={18} strokeWidth={1.75} aria-hidden="true" /> : <Eye size={18} strokeWidth={1.75} aria-hidden="true" />}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {isLogin && (
                                <div className="sentinel-options-row">
                                    <label htmlFor="auth-remember" className="sentinel-remember-container">
                                        <input
                                            id="auth-remember"
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            className="sentinel-checkbox"
                                        />
                                        <span className="sentinel-checkbox-label">Remember Me</span>
                                    </label>
                                    <Link to="/forgot-password" className="sentinel-link">
                                        Forgot password?
                                    </Link>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading || (reset && !resetToken)}
                                className="sentinel-primary-btn"
                            >
                                <span className="sentinel-btn-text">
                                    {isLoading
                                        ? "Please wait…"
                                        : isRegister
                                        ? "Create Account"
                                        : forgot
                                        ? "Send recovery email"
                                        : reset
                                        ? "Reset password"
                                        : "Authenticate Session"}
                                </span>
                                {!isLoading && <ArrowRight size={18} className="sentinel-btn-icon" aria-hidden="true" />}
                            </button>
                        </form>

                        <div className="sentinel-panel-alt-nav">
                            {isRegister ? (
                                <span>
                                    Already have an account?{" "}
                                    <Link to="/login" className="sentinel-link sentinel-link-accent">
                                        Sign in
                                    </Link>
                                </span>
                            ) : forgot || reset ? (
                                <Link to="/login" className="sentinel-link sentinel-link-accent">
                                    Back to sign in
                                </Link>
                            ) : (
                                <span>
                                    Don&apos;t have an account?{" "}
                                    <Link to="/register" className="sentinel-link sentinel-link-accent">
                                        Create account
                                    </Link>
                                </span>
                            )}
                        </div>

                        <div className="sentinel-trust-note">
                            <CheckCircle2 size={14} className="sentinel-trust-icon" aria-hidden="true" />
                            <span>Use a trusted HTTPS deployment for remote access</span>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
