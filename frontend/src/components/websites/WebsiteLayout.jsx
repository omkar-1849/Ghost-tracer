import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Loader2, Activity, Database } from "lucide-react";

import WebsiteSummary from "./WebsiteSummary";
import HealthSegments from "./HealthSegments";
import WebsiteFilters from "./WebsiteFilters";
import WebsiteSearch from "./WebsiteSearch";
import WebsiteTable from "./WebsiteTable";
import EmptyState from "./EmptyState";
import WebsiteDetailsDrawer from "./WebsiteDetailsDrawer";
import AddWebsiteModal from "./AddWebsiteModal";
import DeleteWebsiteDialog from "./DeleteWebsiteDialog";
import ToastStack, { TOAST_DURATION } from "./Toast";
import { SummarySkeleton, TableSkeleton } from "./Skeletons";

import * as api from "../../services/websiteApi";

/** Lightweight toast store — local to this module, no global provider needed. */
function useToasts() {
    const [toasts, setToasts] = useState([]);
    const idRef = useRef(0);

    const dismiss = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const push = useCallback((type, message) => {
        const id = ++idRef.current;
        setToasts(prev => [...prev.slice(-3), { id, type, message }]);
        setTimeout(() => dismiss(id), TOAST_DURATION);
    }, [dismiss]);

    const toast = useCallback((type, message) => push(type, message), [push]);

    return { toasts, dismiss, toast };
}

export default function WebsiteLayout() {
    // Core Data State
    const [websites, setWebsites] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [isBusy, setIsBusy] = useState(false); // bulk operations
    const [lastRefreshed, setLastRefreshed] = useState(null);

    // View States
    const [activeDrawerWebsite, setActiveDrawerWebsite] = useState(null);
    const [websiteToEdit, setWebsiteToEdit] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Delete Dialog
    const [deleteTargets, setDeleteTargets] = useState([]); // array of IDs
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Filters & Search
    const [searchQuery, setSearchQuery] = useState("");
    const [filters, setFilters] = useState({
        environment: "All",
        status: "All",
        health: "All"
    });

    // Bulk Select & Pagination
    const [selectedIds, setSelectedIds] = useState([]);
    const [pagination, setPagination] = useState({ currentPage: 1, itemsPerPage: 10 });

    const { toasts, dismiss, toast } = useToasts();

    const fetchWebsites = useCallback(async (query = "", showLoader = true) => {
        if (showLoader) setIsLoading(true);
        try {
            const data = await api.searchWebsites(query);
            setWebsites(data);
            setLastRefreshed(new Date().toISOString());
            setSelectedIds([]);
        } catch (error) {
            console.error("Failed to fetch websites:", error);
            toast("error", "Failed to load websites from the backend.");
        } finally {
            if (showLoader) setIsLoading(false);
        }
    }, [toast]);

    // Initial load & search debounce trigger (all setState in async callbacks)
    useEffect(() => {
        let cancelled = false;
        api.searchWebsites(searchQuery).then((data) => {
            if (cancelled) return;
            setWebsites(data);
            setLastRefreshed(new Date().toISOString());
            setSelectedIds([]);
            setIsLoading(false);
        }).catch(() => {
            if (cancelled) return;
            setIsLoading(false);
            toast("error", "Failed to load websites from the backend.");
        });
        return () => { cancelled = true; };
    }, [searchQuery, toast]);

    // Derived Filtered Data
    const filteredWebsites = useMemo(() => {
        return websites.filter(w => {
            if (filters.environment !== "All" && w.environment !== filters.environment) return false;
            if (filters.status !== "All" && w.status !== filters.status) return false;
            if (filters.health !== "All" && w.health !== filters.health) return false;
            return true;
        });
    }, [websites, filters]);

    // Counts for the health segmented filter (drives segment badges + sliding surface)
    const healthCounts = useMemo(() => {
        const counts = { All: websites.length, Healthy: 0, Warning: 0, Critical: 0, Unknown: 0 };
        for (const w of websites) {
            if (counts[w.health] !== undefined) counts[w.health] += 1;
        }
        return counts;
    }, [websites]);

    // Handlers
    const handleAddClick = () => {
        setWebsiteToEdit(null);
        setIsAddModalOpen(true);
    };

    const handleEditClick = (website) => {
        setWebsiteToEdit(website);
        setIsAddModalOpen(true);
        setActiveDrawerWebsite(null);
    };

    const handleDeleteClick = (website) => {
        setDeleteTargets([website.id]);
        setIsDeleteDialogOpen(true);
        setActiveDrawerWebsite(null);
    };

    const handleBulkDeleteClick = () => {
        if (selectedIds.length === 0) return;
        setDeleteTargets([...selectedIds]);
        setIsDeleteDialogOpen(true);
    };

    const handleClearSelection = useCallback(() => {
        setSelectedIds([]);
    }, []);

    const handleResetFilters = useCallback(() => {
        setFilters({ environment: "All", status: "All", health: "All" });
    }, []);

    const handleSaveWebsite = async (formData) => {
        setSaving(true);
        try {
            if (websiteToEdit) {
                await api.updateWebsite(websiteToEdit.id, formData);
                toast("success", `${websiteToEdit.name} updated successfully.`);
            } else {
                await api.createWebsite(formData);
                toast("success", `${formData.name} registered and monitoring ${formData.monitoringEnabled ? "enabled" : "paused"}.`);
            }
            await fetchWebsites(searchQuery, false);
            setIsAddModalOpen(false);
        } catch (error) {
            console.error(error);
            toast("error", error.message || "Failed to save website.");
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = async () => {
        setDeleting(true);
        try {
            for (const id of deleteTargets) {
                await api.deleteWebsite(id);
            }
            const n = deleteTargets.length;
            toast("success", n === 1 ? "Website deleted successfully." : `${n} websites deleted successfully.`);
            await fetchWebsites(searchQuery, false);
            setIsDeleteDialogOpen(false);
            setDeleteTargets([]);
        } catch (error) {
            console.error(error);
            toast("error", "Failed to delete websites.");
        } finally {
            setDeleting(false);
        }
    };

    // Bulk Monitoring
    const handleBulkMonitor = async (enable) => {
        if (selectedIds.length === 0) return;
        setIsBusy(true);
        try {
            let changed = 0;
            for (const id of selectedIds) {
                const target = websites.find(w => w.id === id);
                if (target && target.monitoringEnabled !== enable) {
                    await api.updateWebsite(id, { ...target, monitoringEnabled: enable });
                    changed++;
                }
            }
            toast("success", `Monitoring ${enable ? "enabled" : "paused"} for ${changed} website${changed === 1 ? "" : "s"}.`);
            await fetchWebsites(searchQuery, false);
        } catch (error) {
            console.error(error);
            toast("error", "Failed to update monitoring settings.");
        } finally {
            setIsBusy(false);
        }
    };

    const handleToggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleToggleSelectAll = (checked, visibleIds) => {
        if (checked) {
            const newIds = [...new Set([...selectedIds, ...visibleIds])];
            setSelectedIds(newIds);
        } else {
            setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
        }
    };

    const handleScan = (website) => {
        toast("info", `Scan queued for ${website.name} — wires into the Scanner module in a future release.`);
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 relative">
            <ToastStack toasts={toasts} onDismiss={dismiss} />

            {/* Non-blocking progress pill (bulk ops) */}
            {isBusy && (
                <div className="absolute top-4 right-8 z-[90] flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-success)] text-sm font-semibold text-[var(--color-success)] shadow-[var(--shadow-2)] animate-fade-in-down">
                    <Loader2 size={15} className="animate-spin" />
                    Updating telemetry…
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-8 pb-12 custom-scrollbar">
                {/* Header */}
                <div className="mb-8 mt-2 animate-fade-in-up">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                        <span className="flex items-center gap-1.5"><Activity size={12} className="text-[var(--color-success)]" /> Asset Inventory</span>
                        <span className="w-1 h-1 rounded-full bg-[var(--color-surface-3)]" />
                        <span className="flex items-center gap-1.5"><Database size={12} className="text-[var(--color-text-secondary)]" /> Websites</span>
                    </div>
                    <h1 className="text-3xl font-extrabold text-[var(--color-text-primary)] tracking-tight">Website Management</h1>
                    <p className="text-[var(--color-text-secondary)] mt-1.5">Manage target infrastructure, active environments, and telemetry health.</p>
                </div>

                {/* Summary strip / Skeleton */}
                {isLoading && websites.length === 0 ? <SummarySkeleton /> : <WebsiteSummary websites={websites} />}

                {/* Health segmented filter — below the strip, drives the table lens */}
                <HealthSegments
                    className="mb-6"
                    value={filters.health}
                    counts={healthCounts}
                    onChange={(h) => setFilters(prev => ({ ...prev, health: h }))}
                />

                {/* Toolbench toolbar — dense, aligned with the table rails */}
                <div className="mb-6 flex flex-col md:flex-row gap-3 md:items-center justify-between">
                    <WebsiteSearch query={searchQuery} setQuery={setSearchQuery} />
                    <WebsiteFilters
                        filters={filters}
                        setFilters={setFilters}
                        onRefresh={() => fetchWebsites(searchQuery)}
                        onAdd={handleAddClick}
                        selectedCount={selectedIds.length}
                        onClearSelection={handleClearSelection}
                        onBulkDelete={handleBulkDeleteClick}
                        onBulkEnableMonitor={() => handleBulkMonitor(true)}
                        onBulkDisableMonitor={() => handleBulkMonitor(false)}
                    />
                </div>

                {/* Table, Skeleton or Empty State */}
                {isLoading && websites.length === 0 ? (
                    <TableSkeleton />
                ) : websites.length === 0 && !searchQuery ? (
                    <EmptyState onAdd={handleAddClick} />
                ) : (
                    <WebsiteTable
                        websites={filteredWebsites}
                        selectedIds={selectedIds}
                        onToggleSelect={handleToggleSelect}
                        onToggleSelectAll={handleToggleSelectAll}
                        pagination={pagination}
                        setPagination={setPagination}
                        onView={setActiveDrawerWebsite}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                        onScan={handleScan}
                        filters={filters}
                        lastRefreshed={lastRefreshed}
                        onRefresh={() => fetchWebsites(searchQuery, false)}
                        onResetFilters={handleResetFilters}
                    />
                )}
            </div>

            {/* Overlays */}
            <WebsiteDetailsDrawer
                website={activeDrawerWebsite}
                onClose={() => setActiveDrawerWebsite(null)}
                onRefresh={() => fetchWebsites(searchQuery, false)}
                onEdit={(w) => {
                    setActiveDrawerWebsite(null);
                    handleEditClick(w);
                }}
            />

            <AddWebsiteModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleSaveWebsite}
                initialData={websiteToEdit}
                saving={saving}
            />

            <DeleteWebsiteDialog
                isOpen={isDeleteDialogOpen}
                onClose={() => setIsDeleteDialogOpen(false)}
                onConfirm={confirmDelete}
                count={deleteTargets.length}
                deleting={deleting}
            />
        </div>
    );
}
