import { RefreshCw, Plus, Trash2, Eye, EyeOff, X } from "lucide-react";
import CustomSelect from "./CustomSelect";
import { ENVIRONMENT_FILTER_OPTIONS, STATUS_FILTER_OPTIONS } from "./constants";

export default function WebsiteFilters({
    filters, setFilters,
    onRefresh, onAdd,
    selectedCount, onBulkDelete, onBulkEnableMonitor, onBulkDisableMonitor, onClearSelection,
}) {
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="flex flex-wrap items-center gap-2.5">
            {/* Free-standing filter selects — no wrapper chrome, one optical baseline */}
            <CustomSelect
                id="filter-environment"
                value={filters.environment}
                onChange={(v) => handleFilterChange('environment', v)}
                options={ENVIRONMENT_FILTER_OPTIONS}
            />
            <CustomSelect
                id="filter-status"
                value={filters.status}
                onChange={(v) => handleFilterChange('status', v)}
                options={STATUS_FILTER_OPTIONS}
            />

            {/* Bulk actions appear only once rows are selected */}
            {selectedCount > 0 && (
                <div className="flex items-center gap-2 animate-fade-in">
                    <span className="w-px h-5 bg-slate-700/60" />
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-200 bg-slate-800/70 px-3 py-1.5 rounded-lg border border-slate-700/60">
                        {selectedCount} selected
                    </span>
                    <button
                        onClick={onClearSelection}
                        title="Clear selection"
                        aria-label="Clear selection"
                        className="inline-flex items-center gap-1 px-1.5 py-1.5 text-sm text-slate-400 hover:text-white rounded-md transition-colors duration-150"
                    >
                        <X size={13} />
                        Clear selection
                    </button>
                    <button
                        onClick={onBulkEnableMonitor}
                        title="Enable monitoring for selected"
                        aria-label="Enable monitoring for selected websites"
                        className="p-2 text-slate-300 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg border border-slate-700/60 hover:border-emerald-500/40 transition-colors duration-150"
                    >
                        <Eye size={16} />
                    </button>
                    <button
                        onClick={onBulkDisableMonitor}
                        title="Disable monitoring for selected"
                        aria-label="Disable monitoring for selected websites"
                        className="p-2 text-slate-300 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg border border-slate-700/60 hover:border-amber-500/40 transition-colors duration-150"
                    >
                        <EyeOff size={16} />
                    </button>
                    <button
                        onClick={onBulkDelete}
                        title="Delete selected websites"
                        aria-label="Delete selected websites"
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg border border-slate-700/60 hover:border-red-500/40 transition-colors duration-150"
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
                className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-emerald-300 rounded-lg transition-colors duration-150 border border-slate-700/80 shadow-inner active:opacity-70"
            >
                <RefreshCw size={16} />
            </button>

            <button
                onClick={onAdd}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-all duration-150 border border-emerald-400/20 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            >
                <Plus size={16} />
                Add Website
            </button>
        </div>
    );
}
