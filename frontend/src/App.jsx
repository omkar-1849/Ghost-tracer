import { Routes, Route } from "react-router-dom";

import Sidebar from "./components/Sidebar";

import Dashboard from "./pages/Dashboard";
import Scanner from "./pages/Scanner";
import Analytics from "./pages/Analytics";
import Alerts from "./pages/Alerts";
import Settings from "./pages/Settings";
import Report from "./pages/Report";

function App() {
    return (
        <div className="flex bg-slate-950 text-white h-screen overflow-hidden">
            <Sidebar />

            <main className="flex-1 overflow-y-auto scroll-smooth p-8">
                <Routes>

                    <Route
                        path="/"
                        element={<Dashboard />}
                    />

                    <Route
                        path="/scanner"
                        element={<Scanner />}
                    />

                    <Route
                        path="/scanner/report/:id"
                        element={<Report />}
                    />

                    <Route
                        path="/analytics"
                        element={<Analytics />}
                    />

                    <Route
                        path="/alerts"
                        element={<Alerts />}
                    />

                    <Route
                        path="/settings"
                        element={<Settings />}
                    />

                </Routes>
            </main>
        </div>
    );
}

export default App;