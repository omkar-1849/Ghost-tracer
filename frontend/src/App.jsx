import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Spinner from "./components/ui/Spinner";
import { isAuthenticated } from "./services/authClient";

// Route-level code splitting — heavy charting pages load on demand
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Scanner = lazy(() => import("./pages/Scanner"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Settings = lazy(() => import("./pages/Settings"));
const Report = lazy(() => import("./pages/Report"));
const Websites = lazy(() => import("./pages/Websites"));
const Login = lazy(() => import("./pages/Login"));

function PageLoader() {
    return (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-[var(--color-text-muted)]">
            <Spinner size={24} />
            <p className="text-xs font-medium">Loading module…</p>
        </div>
    );
}

/**
 * Layout wrapper for the main application shell (sidebar + content area).
 * Login is rendered OUTSIDE this layout so it has a clean full-screen view.
 */
function AppLayout() {
    return (
        <div className="flex bg-[var(--color-canvas)] text-[var(--color-text-primary)] h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto scroll-smooth">
                <Suspense fallback={<PageLoader />}>
                    <Outlet />
                </Suspense>
            </main>
        </div>
    );
}

/**
 * Route guard — redirects to /login if the user is not authenticated.
 * Only wraps routes whose backend endpoints require a JWT.
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
            {/* Login — full-screen, outside the main shell */}
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
                <Route path="/scanner" element={<Scanner />} />
                <Route path="/scanner/report/:id" element={<Report />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route
                    path="/settings"
                    element={
                        <RequireAuth>
                            <Settings />
                        </RequireAuth>
                    }
                />
                <Route path="/websites" element={<Websites />} />
            </Route>
        </Routes>
    );
}

export default App;
