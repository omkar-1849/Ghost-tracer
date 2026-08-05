import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Radar, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getScanHistory, getScanReport, cancelScan } from "../../services/api";

import ScannerTabs from "./ScannerTabs";
import OverviewTab from "./OverviewTab";
import SQLMapTab from "./SQLMapTab";
import ScannerEnginePlaceholder from "./ScannerEnginePlaceholder";
import { SCANNER_ENGINES } from "./constants";
import { ACTIVE_STATUSES } from "./shared";

const keyframes = `
@keyframes scanner-sweep {
  0% { transform: translateX(-140%) skewX(-12deg); }
  100% { transform: translateX(440%) skewX(-12deg); }
}
@keyframes scanner-bar {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(420%); }
}
@keyframes toast-in {
  from { opacity: 0; transform: translateY(12px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes section-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

export default function ScannerLayout() {
    const [activeTab, setActiveTab] = useState("overview");
    const [recentScans, setRecentScans] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState(false);
    const [now, setNow] = useState(Date.now());
    
    // Toast notification state
    const [toast, setToast] = useState(null);
    const toastTimerRef = useRef(null);

    const loadScanHistory = useCallback(async () => {
        setHistoryError(false);
        try {
            const data = await getScanHistory();
            setRecentScans(data);
        } catch (error) {
            console.error(error);
            setHistoryError(true);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    const hasActive = useMemo(
        () => recentScans.some((scan) => ACTIVE_STATUSES.has((scan.status || "").toUpperCase())),
        [recentScans]
    );

    const sqlmapBusy = useMemo(
        () =>
            recentScans.some(
                (scan) =>
                    (scan.scanner || "").toUpperCase() === "SQLMAP" &&
                    ACTIVE_STATUSES.has((scan.status || "").toUpperCase())
            ),
        [recentScans]
    );

    function showToast(message, type = "success") {
        setToast({ message, type, id: Date.now() });
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), 4000);
    }

    // Poll scan status every 3 seconds while any scan is active.
    useEffect(() => {
        loadScanHistory();
        const interval = setInterval(() => {
            if (hasActive) {
                loadScanHistory();
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [loadScanHistory, hasActive]);

    // Live elapsed timer while scans are running.
    useEffect(() => {
        if (!hasActive) return undefined;
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [hasActive]);
    
    // Derived stats
    const stats = useMemo(() => {
        const result = { total: recentScans.length, queued: 0, running: 0, completed: 0, failed: 0 };
        for (const scan of recentScans) {
            switch ((scan.status || "").toUpperCase()) {
                case "QUEUED": result.queued += 1; break;
                case "RUNNING": result.running += 1; break;
                case "COMPLETED": result.completed += 1; break;
                case "FAILED": result.failed += 1; break;
                default: break;
            }
        }
        return result;
    }, [recentScans]);

    // Handle scan cancellation globally
    const [cancellingId, setCancellingId] = useState(null);
    async function handleCancelScan(id) {
        setCancellingId(id);
        try {
            await cancelScan(id);
            showToast("Scan cancelled", "success");
            await loadScanHistory();
        } catch (error) {
            console.error(error);
            showToast(error.message || "Failed to cancel scan", "error");
        } finally {
            setCancellingId(null);
        }
    }

    // Render appropriate tab content
    const renderTabContent = () => {
        if (activeTab === "overview") {
            return (
                <OverviewTab 
                    stats={stats} 
                    recentScans={recentScans} 
                    now={now} 
                    historyLoading={historyLoading}
                    historyError={historyError}
                    onRefresh={loadScanHistory}
                    cancellingId={cancellingId}
                    onCancelScan={handleCancelScan}
                    onTabChange={setActiveTab}
                    showToast={showToast}
                />
            );
        }
        
        if (activeTab === "sqlmap") {
            return (
                <SQLMapTab 
                    recentScans={recentScans}
                    now={now}
                    sqlmapBusy={sqlmapBusy}
                    historyLoading={historyLoading}
                    historyError={historyError}
                    onRefresh={loadScanHistory}
                    cancellingId={cancellingId}
                    onCancelScan={handleCancelScan}
                    showToast={showToast}
                />
            );
        }
        
        const activeEngine = SCANNER_ENGINES.find(e => e.id === activeTab);
        return <ScannerEnginePlaceholder engine={activeEngine} />;
    };

    return (
        <div className="flex-1 p-8">
            <style>{keyframes}</style>

            {/* Page header */}
            <div className="relative flex items-center justify-between gap-4 mb-8 p-6 bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl shadow-lg shadow-black/40 overflow-hidden">
                <div
                    className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-purple-500/[0.08] to-transparent"
                    style={{ animation: "scanner-sweep 9s linear infinite" }}
                />

                <div className="relative z-10 flex items-center gap-4">
                    <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-fuchsia-600 flex items-center justify-center shadow-[0_0_24px_rgba(168,85,247,0.5)] ring-1 ring-purple-400/30">
                        <Radar size={24} className="text-white" />
                    </span>

                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-cyan-300 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                            Scanner Module
                        </h1>
                        <p className="text-slate-400 mt-1 text-sm">
                            Multi-engine security testing and vulnerability assessment platform.
                        </p>
                    </div>
                </div>

                <div className="relative z-10 hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30">
                    <span className="relative flex w-2 h-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                    <span className="text-xs font-bold tracking-widest text-green-400">
                        LIVE
                    </span>
                </div>
            </div>

            <ScannerTabs activeTab={activeTab} onTabChange={setActiveTab} />
            
            {renderTabContent()}

            {/* Global Toast notifications */}
            {toast && (
                <div
                    key={toast.id}
                    className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-xl border backdrop-blur-xl shadow-2xl shadow-black/50 ${
                        toast.type === "success"
                            ? "bg-green-500/15 border-green-500/40"
                            : "bg-red-500/15 border-red-500/40"
                    }`}
                    style={{ animation: "toast-in 0.25s ease-out" }}
                >
                    {toast.type === "success" ? (
                        <CheckCircle2 size={18} className="text-green-400" />
                    ) : (
                        <AlertTriangle size={18} className="text-red-400" />
                    )}
                    <p className="text-sm font-medium text-white">
                        {toast.message}
                    </p>
                </div>
            )}
        </div>
    );
}
