import { ArrowDownWideNarrow, ChevronsLeft, ChevronsRight, Inbox } from "lucide-react";
import IncidentRow from "./IncidentRow";

/**
 * IncidentQueue
 * -------------
 * Left investigation workspace (35% on desktop). A scrollable queue of
 * incidents with an Outlook/Teams-style rhythm: rows, hover states,
 * selected state, and a quiet footer with the total count.
 *
 * Collapsible to an 88px rail (minimal local UI state): the parent grid
 * switches to the rail column via the `.alerts-workspace-grid--collapsed`
 * modifier, and rows render a compact variant — severity indicator,
 * incident icon, status colour and a small title.
 */
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
            className={`alerts-enter alerts-panel alerts-queue-panel flex min-h-0 flex-col overflow-hidden rounded-3xl ${
                mobileHidden ? "hidden md:flex" : "flex"
            }`}
            style={{ animationDelay: "260ms" }}
        >
            {/* Panel header */}
            <div
                className={`relative z-10 flex items-center gap-3 pb-3 pt-4 ${
                    collapsed ? "justify-center px-2" : "justify-between px-6"
                }`}
            >
                {collapsed ? (
                    <button
                        type="button"
                        onClick={onToggleCollapse}
                        aria-expanded={false}
                        aria-label="Expand incident queue"
                        title="Expand incident queue"
                        className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-950/40 text-slate-400 transition-colors duration-300 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                    >
                        <ChevronsRight size={16} />
                    </button>
                ) : (
                    <>
                        <div className="min-w-0">
                            <p className="text-[11px] font-bold tracking-[0.24em] text-slate-400">
                                INCIDENT QUEUE
                            </p>
                            <h2 className="mt-1 text-xl font-bold tracking-tight text-white">
                                Active Incidents
                            </h2>
                        </div>

                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/40 px-2.5 py-1 text-[11px] font-bold tracking-widest text-slate-400">
                            <ArrowDownWideNarrow size={11} className="text-cyan-400" />
                            {incidents.length} TOTAL
                        </span>

                        <button
                            type="button"
                            onClick={onToggleCollapse}
                            aria-expanded={true}
                            aria-label="Collapse incident queue"
                            title="Collapse incident queue"
                            className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-950/40 text-slate-400 transition-colors duration-300 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                        >
                            <ChevronsLeft size={16} />
                        </button>
                    </>
                )}
            </div>

            {/* Accent hairline */}
            {!collapsed && <div className="alerts-hairline relative z-10 mx-6 h-px" />}

            {/* Scrollable list */}
            <div
                className={`alerts-scroll relative z-10 flex-1 space-y-2 overflow-y-auto ${
                    collapsed ? "px-1.5 py-2" : "px-4 py-3 lg:px-5"
                }`}
            >
                {incidents.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-slate-950/30 px-6 py-14 text-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-800/50">
                            <Inbox size={20} className="text-slate-500" />
                        </span>
                        <p className="text-sm font-semibold text-slate-300">
                            No incidents match
                        </p>
                        <p className="max-w-[16rem] text-xs leading-relaxed text-slate-500">
                            Adjust your search or clear the active filters to see
                            the full queue.
                        </p>
                    </div>
                ) : (
                    incidents.map((incident, index) => (
                        <IncidentRow
                            key={incident.id}
                            incident={incident}
                            selected={incident.id === selectedId}
                            onSelect={onSelect}
                            collapsed={collapsed}
                            delay={Math.min(300 + index * 45, 700)}
                        />
                    ))
                )}
            </div>

            {/* Footer */}
            {!collapsed && (
                <div className="relative z-10 border-t border-white/5 px-6 py-2.5">
                    <p className="text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-300">
                            {incidents.length}
                        </span>{" "}
                        incident{incidents.length === 1 ? "" : "s"} in queue · selecting
                        one updates the investigation workspace instantly
                    </p>
                </div>
            )}
        </section>
    );
}

export default IncidentQueue;
