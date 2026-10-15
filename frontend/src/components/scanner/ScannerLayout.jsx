import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Trash2, WifiOff } from "lucide-react";
import { getAllScans, cancelScan, deleteScan, getScannerEngines } from "../../services/scannerApi";

import ScannerTabs from "./ScannerTabs";
import OverviewTab from "./OverviewTab";
import EngineTab from "./EngineTab";
import LiveDot from "../ui/LiveDot";
import { SCANNER_ENGINES, ACTIVE_STATUSES } from "./constants";

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
                const enginesData = await getScannerEngines();
                if (!cancelled) {
                    setEngines(enginesData);
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

    // Render the active tab
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
        if (!engine) return null;

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
        <div className="sentinel-page space-y-6 animate-fade-in select-none">
            {/* Page header */}
            <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                    <p className="text-[11px] font-semibold tracking-wider uppercase text-[#D3A06A] mb-1.5">Assessment Console</p>
                    <h1 className="text-2xl font-bold tracking-tight text-[#F5F1EC]">
                        Scanner Module
                    </h1>
                    <p className="text-xs text-[#9E948A] mt-1">
                        Multi-engine security testing and vulnerability assessment
                    </p>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-semibold text-[#77C79A] bg-[rgba(119,199,154,0.10)] border border-[rgba(119,199,154,0.22)] shadow-[0_2px_8px_rgba(0,0,0,0.25)]">
                    <LiveDot color="#77C79A" size={5} />
                    SCANNER READY
                </div>
            </div>

            {/* Backend offline warning banner - only when error AND no scans */}
            {historyError && recentScans.length === 0 && (
                <div className="mb-6 flex items-center justify-between gap-3 bg-[rgba(223,91,91,0.08)] border border-[rgba(223,91,91,0.20)] rounded-md px-4 py-3 text-xs text-[var(--color-critical)]">
                    <p className="flex items-center gap-2 font-medium">
                        <WifiOff size={15} />
                        Backend unreachable — scan history could not be loaded.
                    </p>
                    <button
                        type="button"
                        onClick={loadScans}
                        disabled={historyLoading}
                        className="font-semibold hover:underline uppercase tracking-wider disabled:opacity-50"
                    >
                        Retry
                    </button>
                </div>
            )}

            <ScannerTabs activeTab={activeTab} onTabChange={setActiveTab} />

            <div className="pt-6">{renderTabContent()}</div>

            {/* Delete confirmation dialog */}
            {deleteTarget && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={() => setDeleteTarget(null)}
                >
                    <div className="absolute inset-0 bg-[#0D0C0A]/80 backdrop-blur-sm animate-[fade-in_0.15s_ease-out_both]" aria-hidden="true" />
                    <div
                        className="relative bg-[#12100E]/95 backdrop-blur-2xl border border-[rgba(255,248,238,0.10)] rounded-2xl p-6 w-full max-w-sm shadow-[0_24px_64px_rgba(0,0,0,0.85)] animate-[modal-in_0.18s_cubic-bezier(0.16,1,0.3,1)_both]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <span className="w-9 h-9 rounded-xl bg-[rgba(223,91,91,0.12)] border border-[rgba(223,91,91,0.25)] flex items-center justify-center">
                                <Trash2 size={16} className="text-[#FF8585]" />
                            </span>
                            <h3 className="text-sm font-semibold text-[#F5F1EC]">Delete Scan Record</h3>
                        </div>
                        <p className="text-xs text-[#D6CFC7] mb-5 leading-relaxed">
                            Permanently delete scan <span className="font-mono text-[#D3A06A]">#{deleteTarget.id}</span> targeting{" "}
                            <span className="text-[#F5F1EC] font-mono">{deleteTarget.target}</span>? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setDeleteTarget(null)}
                                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[#D6CFC7] hover:bg-white/10 hover:text-[#F5F1EC] text-xs font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDeleteScan(deleteTarget.id)}
                                disabled={deletingId === deleteTarget.id}
                                className="px-4 py-2 rounded-xl bg-[rgba(223,91,91,0.2)] border border-[rgba(223,91,91,0.4)] text-[#FF8585] text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 hover:bg-[rgba(223,91,91,0.3)] shadow-[0_2px_8px_rgba(223,91,91,0.2)]"
                            >
                                {deletingId === deleteTarget.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
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
                    className={`fixed bottom-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-md border shadow-[var(--shadow-2)] animate-[toast-in_0.18s_ease-out_both] ${
                        toast.type === "success"
                            ? "bg-[var(--color-surface-3)] border-l-[3px] border-l-[var(--color-success)] border-[var(--color-border-default)] text-[var(--color-text-primary)]"
                            : "bg-[var(--color-surface-3)] border-l-[3px] border-l-[var(--color-critical)] border-[var(--color-border-default)] text-[var(--color-text-primary)]"
                    }`}
                >
                    {toast.type === "success" ? (
                        <CheckCircle2 size={15} className="text-[var(--color-success)] shrink-0" />
                    ) : (
                        <AlertTriangle size={15} className="text-[var(--color-critical)] shrink-0" />
                    )}
                    <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                        {toast.message}
                    </p>
                </div>
            )}
        </div>
    );
}
