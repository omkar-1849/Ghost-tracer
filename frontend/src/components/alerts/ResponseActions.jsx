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
 * Premium action bar for the selected incident — UI only.
 *
 * Every button has its own interaction language:
 *  - Investigate   → gradient glass, magnetic lift, light sweep
 *  - Assign        → frosted indigo, breathing assignment dot on hover
 *  - Mark Resolved → emerald, success flash ring + label morph
 *  - Export        → frosted amber, progress glow fill
 *  - Mute          → quiet slate, bell wiggle + muted persistence
 */
function ResponseActions({ incident, onResolved }) {
    const [assigning, setAssigning] = useState(false);
    const [resolving, setResolving] = useState(false);
    const [muted, setMuted] = useState(false);

    const resolved = incident.resolved;

    function handleAssign() {
        if (assigning) return;
        setAssigning(true);
        window.setTimeout(() => setAssigning(false), 1400);
    }

    function handleResolve() {
        if (resolving || resolved) return;
        setResolving(true);
        window.setTimeout(() => {
            setResolving(false);
            onResolved?.(incident.id);
        }, 1000);
    }

    return (
        <div className="flex flex-wrap items-center gap-2.5">
            {/* Investigate — primary */}
            <button
                type="button"
                className="alerts-btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold tracking-wide text-white"
            >
                <Crosshair size={15} />
                Investigate
            </button>

            {/* Assign — frosted indigo */}
            <button
                type="button"
                onClick={handleAssign}
                className="alerts-btn-frost alerts-btn-assign inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/50 px-4 py-2.5 text-[13px] font-semibold text-slate-200 backdrop-blur-xl"
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
                        <UserPlus size={14} className="text-indigo-300" />
                        Assign
                    </>
                )}
            </button>

            {/* Mark Resolved — emerald */}
            <button
                type="button"
                onClick={handleResolve}
                disabled={resolved}
                className={`alerts-btn-frost alerts-btn-resolve inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-semibold backdrop-blur-xl transition-all duration-500 ${
                    resolved || resolving
                        ? "is-resolving border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                        : "border-white/10 bg-slate-950/50 text-slate-200"
                } ${resolving ? "is-resolving" : ""}`}
            >
                {resolved ? (
                    <>
                        <ShieldCheck size={14} className="text-emerald-300" />
                        Resolved
                    </>
                ) : resolving ? (
                    <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
                        Resolving…
                    </>
                ) : (
                    <>
                        <Check size={14} className="text-emerald-300" />
                        Mark Resolved
                    </>
                )}
            </button>

            {/* Export — frosted amber */}
            <button
                type="button"
                className="alerts-btn-frost alerts-btn-export inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/50 px-4 py-2.5 text-[13px] font-semibold text-slate-200 backdrop-blur-xl"
            >
                <Download size={14} className="text-amber-300" />
                Export
            </button>

            {/* Mute — quiet slate */}
            <button
                type="button"
                onClick={() => setMuted((value) => !value)}
                title={muted ? "Unmute incident" : "Mute incident"}
                className={`alerts-btn-frost alerts-btn-mute inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-semibold backdrop-blur-xl transition-all duration-500 ${
                    muted
                        ? "is-muted border-slate-500/35 bg-slate-500/10 text-slate-400"
                        : "border-white/10 bg-slate-950/50 text-slate-300"
                }`}
            >
                <BellOff size={14} className={muted ? "text-slate-500" : "text-slate-400"} />
                {muted ? "Muted" : "Mute"}
            </button>
        </div>
    );
}

export default ResponseActions;
