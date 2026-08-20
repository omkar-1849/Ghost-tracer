import { ArrowDownWideNarrow, ChevronsLeft, ChevronsRight, Inbox } from "lucide-react";
import IncidentRow from "./IncidentRow";

function IncidentQueue({
    incidents,
    selectedId,
    onSelect,
    mobileHidden,
    collapsed,
    onToggleCollapse,
}) {
    return (
        <section
            className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-2)] shadow-[var(--shadow-1)] ${
                mobileHidden ? "hidden md:flex" : "flex"
            }`}
        >
            {/* Panel header */}
            <div
                className={`flex items-center gap-3 py-3 border-b border-[var(--color-border-subtle)] ${
                    collapsed ? "justify-center px-2" : "justify-between px-4"
                }`}
            >
                {collapsed ? (
                    <button
                        type="button"
                        onClick={onToggleCollapse}
                        aria-expanded={false}
                        aria-label="Expand incident queue"
                        title="Expand incident queue"
                        className="inline-flex h-7 w-7 items-center justify-center rounded bg-[var(--color-surface-1)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors"
                    >
                        <ChevronsRight size={14} />
                    </button>
                ) : (
                    <>
                        <div>
                            <h2 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
                                Incident Queue
                            </h2>
                            <p className="text-[11px] text-[var(--color-text-muted)]">
                                Prioritized security alerts
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-surface-1)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] tabular-nums">
                                <ArrowDownWideNarrow size={11} className="text-[var(--color-accent)]" />
                                {incidents.length} TOTAL
                            </span>

                            <button
                                type="button"
                                onClick={onToggleCollapse}
                                aria-expanded={true}
                                aria-label="Collapse incident queue"
                                title="Collapse incident queue"
                                className="inline-flex h-7 w-7 items-center justify-center rounded bg-[var(--color-surface-1)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors"
                            >
                                <ChevronsLeft size={14} />
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Scrollable list */}
            <div
                className={`flex-1 space-y-2 overflow-y-auto max-h-[640px] p-3 scrollbar-thin scrollbar-thumb-[var(--color-border-strong)] scrollbar-track-transparent ${
                    collapsed ? "px-1" : ""
                }`}
            >
                {incidents.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2.5 rounded-md border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-1)] p-8 text-center">
                        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-surface-3)] text-[var(--color-text-disabled)]">
                            <Inbox size={20} />
                        </span>
                        <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                            No matching incidents
                        </p>
                        <p className="max-w-[14rem] text-[11px] text-[var(--color-text-muted)]">
                            Adjust your search query or clear the active severity and status filters.
                        </p>
                    </div>
                ) : (
                    incidents.map((incident) => (
                        <IncidentRow
                            key={incident.id}
                            incident={incident}
                            selected={incident.id === selectedId}
                            onSelect={onSelect}
                            collapsed={collapsed}
                        />
                    ))
                )}
            </div>

            {/* Footer */}
            {!collapsed && (
                <div className="border-t border-[var(--color-border-subtle)] px-4 py-2 bg-[var(--color-surface-1)]">
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                        <span className="font-semibold text-[var(--color-text-primary)] tabular-nums">
                            {incidents.length}
                        </span>{" "}
                        incident{incidents.length === 1 ? "" : "s"} loaded · select to inspect
                    </p>
                </div>
            )}
        </section>
    );
}

export default IncidentQueue;
