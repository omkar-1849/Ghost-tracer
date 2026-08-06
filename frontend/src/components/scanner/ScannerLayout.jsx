import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Radar, AlertTriangle, CheckCircle2, Loader2, Trash2, WifiOff } from "lucide-react";
import { getAllScans, cancelScan, deleteScan, getScannerEngines } from "../../services/scannerApi";

import ScannerTabs from "./ScannerTabs";
import OverviewTab from "./OverviewTab";
import EngineTab from "./EngineTab";
import { SCANNER_ENGINES, ACTIVE_STATUSES } from "./constants";

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
    const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem("scanner_tab") || "overview");

    useEffect(() => {
        sessionStorage.setItem("scanner_tab", activeTab);
    }, [activeTab]);

    const [recentScans, setRecentScans] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState(false);
    const [now, setNow] = useState(0);

    const [engines, setEngines] = useState([]);
    const [enginesLoading, setEnginesLoading] = useState(true);
    const [enginesError, setEnginesError] = useState(false);

    // Toast notification state
    const [toast, setToast] = useState(null);
    const toastTimerRef = useRef(null);

    const loadScans = useCallback(async () => {
        try {
            const data = await getAllScans();
            setRecentScans(data);
            setHistoryError(false);
        } catch (error) {
            console.error(error);
            setHistoryError(true);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    const loadEngines = useCallback(async () => {
        try {
            const data = await getScannerEngines();
            setEngines(data);
            setEnginesError(false);
        } catch (error) {
            console.error(error);
            setEnginesError(true);
        } finally {
            setEnginesLoading(false);
        }
    }, []);

    const hasActive = useMemo(
        () => recentScans.some((scan) => ACTIVE_STATUSES.has((scan.status || "").toUpperCase())),
        [recentScans]
    );

    // Keep the polling interval from re-binding on every status flip.
    const hasActiveRef = useRef(hasActive);
    useEffect(() => {
        hasActiveRef.current = hasActive;
    }, [hasActive]);

    function showToast(message, type = "success") {
        setToast({ message, type, id: Date.now() });
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), 4000);
    }

    // Load history + engines on mount, poll scan status while any scan is active.
    useEffect(() => {
        let cancelled = false;

        async function bootstrap() {
            try {
                const scans = await getAllScans();
                if (!cancelled) {
                    setRecentScans(scans);
                    setHistoryError(false);
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) setHistoryError(true);
            } finally {
                if (!cancelled) setHistoryLoading(false);
            }

            try {
                const engines = await getScannerEngines();
                if (!cancelled) {
                    setEngines(engines);
                    setEnginesError(false);
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) setEnginesError(true);
            } finally {
                if (!cancelled) setEnginesLoading(false);
            }
        }

        bootstrap();

        const interval = setInterval(() => {
            if (hasActiveRef.current) {
                loadScans();
            }
        }, 3000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [loadScans]);

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
                case "PENDING":
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
            await loadScans();
        } catch (error) {
            console.error(error);
            showToast(error.message || "Failed to cancel scan", "error");
        } finally {
            setCancellingId(null);
        }
    }

    // Handle scan deletion (with confirmation dialog)
    const [deletingId, setDeletingId] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    async function handleDeleteScan(id) {
        setDeletingId(id);
        try {
            await deleteScan(id);
            showToast(`Scan #${id} deleted`, "success");
            await loadScans();
        } catch (error) {
            console.error(error);
            showToast(error.message || "Failed to delete scan", "error");
        } finally {
            setDeletingId(null);
            setDeleteTarget(null);
        }
    }

    // Render the active tab. Every engine uses the same generic EngineTab;
    // only the engine config (id, name, icon, accent) differs.
    const renderTabContent = () => {
        if (activeTab === "overview") {
            return (
                <OverviewTab
                    stats={stats}
                    recentScans={recentScans}
                    engines={engines}
                    enginesLoading={enginesLoading}
                    enginesError={enginesError}
                    onRefreshEngines={loadEngines}
                    now={now}
                    historyLoading={historyLoading}
                    historyError={historyError}
                    onRefresh={loadScans}
                    cancellingId={cancellingId}
                    deletingId={deletingId}
                    onCancelScan={handleCancelScan}
                    onDeleteScan={setDeleteTarget}
                    onTabChange={setActiveTab}
                    showToast={showToast}
                />
            );
        }

        const engine = SCANNER_ENGINES.find((e) => e.id === activeTab);
        return (
            <EngineTab
                engine={engine}
                recentScans={recentScans}
                now={now}
                historyLoading={historyLoading}
                historyError={historyError}
                onRefresh={loadScans}
                cancellingId={cancellingId}
                deletingId={deletingId}
                onCancelScan={handleCancelScan}
                onDeleteScan={setDeleteTarget}
                showToast={showToast}
            />
        );
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

            {/* Backend offline banner */}
            {historyError && recentScans.length === 0 && (
                <div className="mb-6 flex items-center justify-between gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                    <p className="flex items-center gap-2 text-sm text-red-300">
                        <WifiOff size={16} />
                        Backend unreachable — scan history could not be loaded.
                    </p>
                    <button
                        onClick={loadScans}
                        disabled={historyLoading}
                        className="text-xs font-bold text-red-300 hover:text-white uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                        Retry
                    </button>
                </div>
            )}

            <ScannerTabs activeTab={activeTab} onTabChange={setActiveTab} />

            {renderTabContent()}

            {/* Delete confirmation dialog */}
            {deleteTarget && (
                <div
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm animate-backdrop-in"
                    onClick={() => setDeleteTarget(null)}
                >
                    <div
                        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl shadow-black/60 animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <span className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                                <Trash2 size={18} className="text-red-400" />
                            </span>
                            <h3 className="text-lg font-bold text-white">Delete Scan</h3>
                        </div>
                        <p className="text-sm text-slate-400 mb-6">
                            Delete scan <span className="font-mono text-white">#{deleteTarget.id}</span> targeting{" "}
                            <span className="text-white">{deleteTarget.target}</span>? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteScan(deleteTarget.id)}
                                disabled={deletingId === deleteTarget.id}
                                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {deletingId === deleteTarget.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
