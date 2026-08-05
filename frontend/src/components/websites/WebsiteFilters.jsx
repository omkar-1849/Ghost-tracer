import { Filter, RefreshCw, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import CustomSelect from "./CustomSelect";
import { ENVIRONMENT_FILTER_OPTIONS, STATUS_FILTER_OPTIONS, HEALTH_FILTER_OPTIONS } from "./constants";

export default function WebsiteFilters({
    filters, setFilters,
    onRefresh, onAdd,
    selectedCount, onBulkDelete, onBulkEnableMonitor, onBulkDisableMonitor
}) {
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const hasActiveFilters = filters.environment !== "All" || filters.status !== "All" || filters.health !== "All";

    return (
        <div className="flex flex-wrap items-center gap-3">
            {/* Filters */}
            <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl pl-3 pr-1 shadow-inner divide-x divide-slate-700/50">
                <Filter size={14} className={`mr-3 ${hasActiveFilters ? "text-emerald-400" : "text-slate-500"}`} />
                <CustomSelect
                    id="filter-environment"
                    value={filters.environment}
                    onChange={(v) => handleFilterChange('environment', v)}
                    options={ENVIRONMENT_FILTER_OPTIONS}
                    className="pr-2"
                />
                <CustomSelect
                    id="filter-status"
                    value={filters.status}
                    onChange={(v) => handleFilterChange('status', v)}
                    options={STATUS_FILTER_OPTIONS}
                    className="pr-2"
                />
                <CustomSelect
                    id="filter-health"
                    value={filters.health}
                    onChange={(v) => handleFilterChange('health', v)}
                    options={HEALTH_FILTER_OPTIONS}
                />
            </div>

            {/* Bulk Actions Contextual Bar */}
            {selectedCount > 0 && (
                <div className="flex items-center gap-2 animate-pop-in">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-300 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
                        {selectedCount} Selected
                    </span>
                    <button
                        onClick={onBulkEnableMonitor}
                        title="Enable monitoring for selected"
                        aria-label="Enable monitoring for selected websites"
                        className="p-2 bg-slate-800/80 hover:bg-emerald-500/15 hover:text-emerald-300 text-slate-300 rounded-lg transition-all duration-150 border border-slate-700 hover:border-emerald-500/40 active:scale-95"
                    >
                        <Eye size={16} />
                    </button>
                    <button
                        onClick={onBulkDisableMonitor}
                        title="Disable monitoring for selected"
                        aria-label="Disable monitoring for selected websites"
                        className="p-2 bg-slate-800/80 hover:bg-amber-500/15 hover:text-amber-300 text-slate-300 rounded-lg transition-all duration-150 border border-slate-700 hover:border-amber-500/40 active:scale-95"
                    >
                        <EyeOff size={16} />
                    </button>
                    <button
                        onClick={onBulkDelete}
                        title="Delete selected websites"
                        aria-label="Delete selected websites"
                        className="p-2 bg-red-950/60 hover:bg-red-900/70 border border-red-900/60 text-red-400 hover:text-red-200 rounded-lg transition-all duration-150 shadow-[0_0_10px_rgba(220,38,38,0.15)] active:scale-95"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )}

            <div className="flex-1" />

            <button
                onClick={onRefresh}
                title="Refresh data"
                aria-label="Refresh website data"
                className="group p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-emerald-300 rounded-xl transition-all duration-150 border border-slate-700/80 shadow-inner active:scale-95"
            >
                <RefreshCw size={16} className="transition-transform duration-300 group-hover:rotate-180" />
            </button>

            <button
                onClick={onAdd}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_22px_rgba(16,185,129,0.5)] transition-all duration-150 border border-emerald-400/20 hover:scale-[1.02] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            >
                <Plus size={16} />
                Add Website
            </button>
        </div>
    );
}
