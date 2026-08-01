import { ArrowDownWideNarrow, Inbox } from "lucide-react";
import IncidentRow from "./IncidentRow";

/**
 * IncidentQueue
 * -------------
 * Left investigation workspace (35% on desktop). A scrollable queue of
 * incidents with an Outlook/Teams-style rhythm: rows, hover states,
 * selected state, and a quiet footer with the total count.
 */
function IncidentQueue({ incidents, selectedId, onSelect, mobileHidden }) {
    return (
        <section
            className={`alerts-enter alerts-panel flex min-h-0 flex-col overflow-hidden rounded-3xl ${
                mobileHidden ? "hidden md:flex" : "flex"
            }`}
            style={{ animationDelay: "260ms" }}
        >
            {/* Panel header */}
            <div className="relative z-10 flex items-center justify-between gap-3 px-6 pb-4 pt-5">
                <div>
                    <p className="text-[10px] font-bold tracking-[0.24em] text-slate-500">
                        INCIDENT QUEUE
                    </p>
                    <h2 className="mt-1 text-lg font-bold tracking-tight text-white">
                        Active Incidents
                    </h2>
                </div>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/40 px-2.5 py-1 text-[10px] font-bold tracking-widest text-slate-400">
                    <ArrowDownWideNarrow size={11} className="text-cyan-400" />
                    {incidents.length} TOTAL
                </span>
            </div>

            {/* Accent hairline */}
            <div className="alerts-hairline relative z-10 mx-6 h-px" />

            {/* Scrollable list */}
            <div className="alerts-scroll relative z-10 flex-1 space-y-2.5 overflow-y-auto px-4 py-4 lg:px-5">
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
                            delay={Math.min(300 + index * 45, 700)}
                        />
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="relative z-10 border-t border-white/5 px-6 py-3.5">
                <p className="text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-300">
                        {incidents.length}
                    </span>{" "}
                    incident{incidents.length === 1 ? "" : "s"} in queue · selecting
                    one updates the investigation workspace instantly
                </p>
            </div>
        </section>
    );
}

export default IncidentQueue;
