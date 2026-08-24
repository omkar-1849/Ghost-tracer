import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Spinner from "./components/ui/Spinner";
import { isAuthenticated } from "./services/authClient";

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
 * Route guard for protected settings & audit routes
 */
function RequireAuth({ children }) {
    const location = useLocation();

    if (!isAuthenticated()) {
        return (
            <Navigate
                to={`/login?redirect=${encodeURIComponent(location.pathname)}`}
                replace
            />
        );
    }

    return children;
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

            {/* Main application shell */}
            <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/activity" element={<Activity />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/incidents" element={<Incidents />} />
                <Route path="/response-actions" element={<ResponseActions />} />
                <Route path="/websites" element={<Websites />} />
                <Route path="/scanner" element={<Scanner />} />
                <Route path="/scanner/report/:id" element={<Report />} />
                <Route path="/audit-logs" element={<AuditLogs />} />
                <Route
                    path="/settings"
                    element={
                        <RequireAuth>
                            <Settings />
                        </RequireAuth>
                    }
                />
                {/* Fallback to dashboard */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
}

export default App;
