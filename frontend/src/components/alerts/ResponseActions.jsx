import { useState } from "react";
import {
    BellOff,
    Check,
    Crosshair,
    Download,
    ShieldCheck,
    UserPlus,
} from "lucide-react";

/**
 * ResponseActions
 * ---------------
 * Backend-connected action bar.
 */

function ResponseActions({
    incident,
    onResolved,
    onAssign,
}) {
    const [assigning, setAssigning] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [analystName, setAnalystName] = useState("");

    const [resolving, setResolving] = useState(false);
    const [muted, setMuted] = useState(false);

    const resolved = incident?.resolved;

    function handleAssign() {
        setShowAssignModal(true);
    }

    async function confirmAssign() {
        if (!analystName.trim()) return;

        setAssigning(true);

        try {
            await onAssign?.(
                incident.id,
                analystName.trim()
            );

            setShowAssignModal(false);
            setAnalystName("");
        } finally {
            setAssigning(false);
        }
    }


    async function handleResolve() {
        if (resolving || resolved) return;

        setResolving(true);

        try {
            await onResolved?.(incident.id);
        } finally {
            setResolving(false);
        }
    }

    return (
        <div className="flex flex-wrap items-center gap-2.5">
            {/* Investigate — primary action */}
            <button
                type="button"
                className="alerts-btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-bold tracking-wide text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-0"
            >
                <Crosshair size={15} />
                Investigate
            </button>

            {/* Assign */}
            <button
                type="button"
                onClick={handleAssign}
                className="alerts-btn-frost alerts-btn-assign inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/50 px-4 py-2.5 text-[14px] font-semibold text-slate-200 backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
            >
                {assigning ? (
                    <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-300 border-t-transparent" />
                        Assigning…
                    </>
                ) : (
                    <>
                        <span className="relative flex h-2 w-2">
                            <span className="alerts-assign-dot absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
                        </span>
                        <UserPlus
                            size={14}
                            className="text-indigo-300"
                        />
                        Assign
                    </>
                )}
            </button>

            {/* Resolve */}
            <button
                type="button"
                onClick={handleResolve}
                disabled={resolved}
                className={`alerts-btn-frost alerts-btn-resolve inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[14px] font-semibold backdrop-blur-xl transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 ${
                    resolved || resolving
                        ? "is-resolving border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                        : "border-white/10 bg-slate-950/50 text-slate-200"
                } ${resolving ? "is-resolving" : ""}`}
            >
                {resolved ? (
                    <>
                        <ShieldCheck
                            size={14}
                            className="text-emerald-300"
                        />
                        Resolved
                    </>
                ) : resolving ? (
                    <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
                        Resolving…
                    </>
                ) : (
                    <>
                        <Check
                            size={14}
                            className="text-emerald-300"
                        />
                        Mark Resolved
                    </>
                )}
            </button>

            {/* Export */}
            <button
                type="button"
                className="alerts-btn-frost alerts-btn-export inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/50 px-4 py-2.5 text-[14px] font-semibold text-slate-200 backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
            >
                <Download
                    size={14}
                    className="text-amber-300"
                />
                Export
            </button>

            {/* Mute */}
            <button
                type="button"
                onClick={() => setMuted((value) => !value)}
                className={`alerts-btn-frost alerts-btn-mute inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[14px] font-semibold backdrop-blur-xl transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 ${
                    muted
                        ? "is-muted border-slate-500/35 bg-slate-500/10 text-slate-400"
                        : "border-white/10 bg-slate-950/50 text-slate-300"
                }`}
            >
                <BellOff
                    size={14}
                    className={muted ? "text-slate-500" : "text-slate-400"}
                />
                {muted ? "Muted" : "Mute"}
            </button>

            
            {showAssignModal && (
                <div className="alerts-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
                    <div className="alerts-modal relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
                        {/* Gradient top border */}
                        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />
                        {/* Soft inner glow */}
                        <span
                            className="pointer-events-none absolute -top-16 left-1/2 h-32 w-64 -translate-x-1/2 opacity-30"
                            style={{
                                background:
                                    "radial-gradient(closest-side, rgba(34,211,238,0.35), transparent 100%)",
                                filter: "blur(30px)",
                            }}
                        />

                        <h3 className="relative text-xl font-bold tracking-tight text-white">
                            Assign Incident
                        </h3>

                        <p className="relative mt-2 text-[15px] text-slate-400">
                            Enter the analyst name.
                        </p>

                        <input
                            type="text"
                            value={analystName}
                            onChange={(e) => setAnalystName(e.target.value)}
                            placeholder="e.g. Omkar"
                            className="relative mt-5 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-[15px] text-slate-100 placeholder-slate-500 backdrop-blur-xl outline-none transition-all duration-300 focus:border-cyan-400/50 focus:bg-slate-950/80 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.08),0_0_24px_-6px_rgba(34,211,238,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
                        />

                        <div className="relative mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowAssignModal(false);
                                    setAnalystName("");
                                }}
                                className="rounded-full border border-white/10 bg-slate-950/40 px-4 py-2 text-[14px] font-semibold text-slate-300 backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:bg-slate-800/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={confirmAssign}
                                disabled={assigning}
                                className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2.5 text-[14px] font-bold text-white shadow-[0_10px_30px_-10px_rgba(34,211,238,0.6)] transition-all duration-300 hover:shadow-[0_14px_36px_-10px_rgba(34,211,238,0.75)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {assigning ? "Assigning..." : "Assign"}
                            </button>
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
}

export default ResponseActions;
