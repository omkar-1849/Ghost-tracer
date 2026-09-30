import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Spinner from "./components/ui/Spinner";
import { isAuthenticated, getMemberships, selectOrganization, storedOrganizationId, createOrganization, logout } from "./services/authClient";

// Route-level code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Activity = lazy(() => import("./pages/Activity"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Incidents = lazy(() => import("./pages/Incidents"));
const ResponseActions = lazy(() => import("./pages/ResponseActions"));
const Scanner = lazy(() => import("./pages/Scanner"));
const Report = lazy(() => import("./pages/Report"));
const Websites = lazy(() => import("./pages/Websites"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const Settings = lazy(() => import("./pages/Settings"));
const Login = lazy(() => import("./pages/Login"));

function PageLoader() {
    return (
        <div className="h-full min-h-[50vh] flex flex-col items-center justify-center gap-3 text-[var(--color-text-muted)]">
            <Spinner size={24} />
            <p className="text-xs font-mono">Loading module…</p>
        </div>
    );
}

/**
 * Main application shell:
 * - Sidebar on the left
 * - Top Navbar with search, live system status, notifications, and profile
 * - Scrollable main content area
 */
function AppLayout() {
    return (
        <div className="flex bg-[var(--color-canvas)] text-[var(--color-text-primary)] h-screen overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Navbar />
                <main className="flex-1 overflow-y-auto scroll-smooth">
                    <Suspense fallback={<PageLoader />}>
                        <Outlet />
                    </Suspense>
                </main>
            </div>
        </div>
    );
}

/**
 * Route guard for all protected application pages:
 * requires a live token, a validated organization selection, and
 * re-validates membership server-side on every mount.
 */
function RequireAuth({ children }) {
    const location = useLocation();
    const [status, setStatus] = useState(isAuthenticated() ? "loading" : "redirect");
    const [error, setError] = useState("");
    const [memberships, setMemberships] = useState([]);

    useEffect(() => {
        let isMounted = true;
        async function bootstrap() {
            try {
                const list = await getMemberships();
                if (!isMounted) return;
                if (!list.length) { setStatus("onboarding"); return; }
                setMemberships(list);
                const stored = storedOrganizationId();
                const match = list.find((m) => String(m.id) === stored);
                const target = match || (list.length === 1 ? list[0] : null);
                if (!target) { setStatus("select"); return; }
                await selectOrganization(target.id);
                if (isMounted) setStatus("ready");
            } catch (err) {
                if (isMounted) { setError(err.message); setStatus(isAuthenticated() ? "error" : "redirect"); }
            }
        }
        if (status === "loading") bootstrap();
        const onAuthChange = () => { if (isMounted) setStatus("redirect"); };
        const onOrganizationChange = () => { if (isMounted) setStatus("loading"); };
        window.addEventListener("sentinel-org-change", onOrganizationChange);
        window.addEventListener("sentinel-auth-change", onAuthChange);
        return () => { isMounted = false; window.removeEventListener("sentinel-auth-change", onAuthChange); window.removeEventListener("sentinel-org-change", onOrganizationChange); };
    }, [status]);

    if (status === "loading") return <PageLoader />;
    if (status === "error") return <div className="p-8" role="alert">{error}<button className="ml-4" onClick={() => setStatus("loading")}>Retry</button><button className="ml-4" onClick={async () => { try { await logout(); } catch (err) { setError(err.message); } }}>Sign out</button></div>;
    if (status === "select") return <div className="p-8 space-y-4"><h2>Select organization</h2>{error && <p role="alert">{error}</p>}{memberships.map((org) => <button className="block" key={org.id} onClick={async () => { try { await selectOrganization(org.id); setStatus("ready"); } catch (err) { setError(err.message); } }}>{org.name} ({org.current_user_role})</button>)}</div>;
    if (status === "ready") return children;
    if (status === "onboarding") {
        return (
            <div className="p-8 max-w-md mx-auto frosted-card space-y-4 animate-fade-in">
                <h2 className="text-xl font-bold text-white">Create your organization</h2>
                {error && <p role="alert">{error}</p>}
                <form
                    onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        try {
                            const created = await createOrganization(form.orgName.value);
                            await selectOrganization(created.id);
                            setStatus("ready");
                        } catch (err) {
                            setError(err.message);
                        }
                    }}
                    className="space-y-3"
                >
                    <input name="orgName" placeholder="Organization name" required className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-lg px-3.5 py-2 text-sm text-white" />
                    <button type="submit" className="px-5 py-2 rounded-lg bg-white text-black font-semibold text-xs">Create</button>
                </form>
            </div>
        );
    }
    return (
        <Navigate
            to={`/login?redirect=${encodeURIComponent(location.pathname)}`}
            replace
        />
    );
}

function App() {
    return (
        <Routes>
            {/* Login — full-screen outside main shell */}
            <Route
                path="/login"
                element={
                    <Suspense fallback={<PageLoader />}>
                        <Login />
                    </Suspense>
                }
            />

            <Route path="/register" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />
            <Route path="/forgot-password" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />
            <Route path="/reset-password" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />
            <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/activity" element={<Activity />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/incidents" element={<Incidents />} />
                <Route path="/response-actions" element={<ResponseActions />} />
                <Route path="/websites" element={<Websites />} />
                <Route path="/scanner" element={<Scanner />} />
                <Route path="/scanner/report/:id" element={<Report />} />
                <Route path="/audit-logs" element={<AuditLogs />} />
                <Route path="/settings" element={<Settings />} />
                {/* Fallback to dashboard */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
}

export default App;
