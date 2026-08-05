import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";

import Sidebar from "./components/Sidebar";

// Route-level code splitting — heavy charting pages load on demand
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Scanner = lazy(() => import("./pages/Scanner"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Settings = lazy(() => import("./pages/Settings"));
const Report = lazy(() => import("./pages/Report"));
const Websites = lazy(() => import("./pages/Websites"));

function PageLoader() {
    return (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 size={28} className="animate-spin text-cyan-400" />
            <p className="text-sm font-semibold">Loading module…</p>
        </div>
    );
}

function App() {
    return (
        <div className="flex bg-slate-950 text-white h-screen overflow-hidden">
            <Sidebar />

            <main className="flex-1 overflow-y-auto scroll-smooth p-8">
                <Suspense fallback={<PageLoader />}>
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/scanner" element={<Scanner />} />
                        <Route path="/scanner/report/:id" element={<Report />} />
                        <Route path="/analytics" element={<Analytics />} />
                        <Route path="/alerts" element={<Alerts />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/websites" element={<Websites />} />
                    </Routes>
                </Suspense>
            </main>
        </div>
    );
}

export default App;
