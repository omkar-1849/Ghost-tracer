import { useState } from "react";
import { ArrowLeft, Clock3, Fingerprint, MessageSquare, Plus, ShieldAlert, User } from "lucide-react";
import { formatDateTime, timeAgo } from "./alertsData";
import AttackDetails from "./AttackDetails";
import IncidentTimeline from "./IncidentTimeline";
import EvidencePanel from "./EvidencePanel";
import ResponseActions from "./ResponseActions";

/**
 * InvestigationWorkspace
 * ----------------------
 * Right investigation workspace (65% on desktop). Shows the selected
 * incident's identity header, attack facts, animated timeline, evidence
 * and the response action bar. Crossfades on incident change via the
 * `key` remount pattern.
 */
function InvestigationWorkspace({
    incident,
    onBack,
    mobileHidden,
    onResolved,
    onAssign,
    onAddNote,
}) {
    const [noteText, setNoteText] = useState("");
    if (!incident) {
        return (
            <section
                className={`alerts-enter alerts-panel flex min-h-[24rem] flex-col items-center justify-center gap-3 rounded-3xl p-10 text-center ${
                    mobileHidden ? "hidden md:flex" : "flex"
                }`}
                style={{ animationDelay: "300ms" }}
            >
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-slate-800/50">
                    <ShieldAlert size={24} className="text-slate-500" />
                </span>
                <p className="text-base font-semibold text-slate-300">
                    No incident selected
                </p>
                <p className="max-w-xs text-sm leading-relaxed text-slate-500">
                    Choose an incident from the queue to open its investigation
                    workspace.
                </p>
            </section>
        );
    }

    const theme = incident.severityTheme;

    return (
        <section
            className={`alerts-enter alerts-panel flex min-h-0 flex-col overflow-hidden rounded-3xl ${
                mobileHidden ? "hidden md:flex" : "flex"
            }`}
            style={{ animationDelay: "300ms" }}
        >
            {/* ---------------------------------------------------------- */}
            {/* Incident identity header                                   */}
            {/* ---------------------------------------------------------- */}
            <div className="relative z-10 px-6 pb-4 pt-4 sm:px-7">
                {/* Mobile back affordance */}
                <div className="mb-3 flex items-center justify-between md:hidden">
                    <button
                        type="button"
                        onClick={onBack}
                        className="alerts-back-btn inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/50 px-3 py-1.5 text-[11px] font-semibold text-slate-300 backdrop-blur-xl"
                    >
                        <ArrowLeft size={12} />
                        Queue
                    </button>

                    <span className="font-mono text-[10px] tracking-widest text-slate-500">
                        {incident.caseId}
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Severity chip */}
                    <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-[0.16em] ${theme.chip}`}
                    >
                        <span className={`h-1.5 w-1.5 rounded-full ${theme.chipDot}`} />
                        {theme.label.toUpperCase()}
                    </span>

                    {/* Status chip */}
                    <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-[0.16em] ${
                            incident.resolved
                                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                                : theme.statusChip
                        }`}
                    >
                        <span className={`h-1.5 w-1.5 rounded-full ${theme.chipDot}`} />
                        {incident.status.toUpperCase()}
                    </span>

                    <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/40 px-2.5 py-1 font-mono text-[11px] tracking-widest text-slate-500 sm:inline-flex">
                        <Fingerprint size={10} className="text-slate-500" />
                        {incident.caseId}
                    </span>
                </div>

                <h2 className="mt-3.5 text-2xl font-bold leading-tight tracking-tight text-white sm:text-[28px]">
                    {incident.title}
                </h2>

                <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-slate-300">
                    {incident.description}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                        <Clock3 size={13} className="text-slate-600" />
                        {formatDateTime(incident.timestamp)}
                    </span>
                    <span className="text-slate-700">•</span>
                    <span>
                        <span className="font-semibold text-slate-300">
                            {timeAgo(incident.created_at)}
                        </span>{" "}
                        since detection
                    </span>
                    <span className="text-slate-700">•</span>
                    <span>
                        Confidence{" "}
                        <span
                            className={`rounded-full border px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums ${
                                incident.confidence >= 85
                                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                                    : incident.confidence >= 70
                                      ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                                      : "border-white/10 bg-white/[0.03] text-slate-300"
                            }`}
                        >
                            {incident.confidence}%
                        </span>
                    </span>
                </div>
            </div>

            {/* ---------------------------------------------------------- */}
            {/* Investigation sections (keyed → crossfade on change)       */}
            {/* ---------------------------------------------------------- */}
            <div
                key={`workspace-${incident.id}`}
                className="alerts-enter alerts-scroll relative z-10 flex-1 space-y-5 overflow-y-auto px-6 py-5 sm:px-7 lg:space-y-6"
                style={{ animationDelay: "120ms" }}
            >
                {/* Attack Details */}
                <section>
                    <SectionHeading
                        index="01"
                        title="Attack Details"
                        caption="Identified attack surface and classification"
                    />
                    <div className="mt-4">
                        <AttackDetails incident={incident} />
                    </div>
                </section>

                {/* Timeline */}
                <section>
                    <SectionHeading
                        index="02"
                        title="Timeline"
                        caption="Detection-to-resolution investigation trail"
                    />
                    <div className="mt-4 rounded-2xl border border-white/[0.06] bg-slate-950/20 px-5 py-4">
                        <IncidentTimeline incident={incident} />
                    </div>
                </section>

                {/* Evidence */}
                <section>
                    <SectionHeading
                        index="03"
                        title="Evidence"
                        caption="Correlated logs tied to this incident"
                    />
                    <div className="mt-4">
                        <EvidencePanel incident={incident} />
                    </div>
                </section>

                {/* Investigation Notes */}
                <section>
                    <SectionHeading
                        index="04"
                        title="Investigation Notes"
                        caption="Analyst observations and case annotations"
                    />
                    <div className="mt-4 rounded-2xl border border-white/[0.06] bg-slate-950/20 px-5 py-4">
                        {/* Existing notes */}
                        {incident.notes && incident.notes.length > 0 ? (
                            <div className="space-y-3">
                                {incident.notes.map((n) => (
                                    <div
                                        key={n.id}
                                        className="rounded-xl border border-white/[0.06] bg-slate-950/30 px-4 py-3"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-500/10">
                                                <User size={11} className="text-cyan-400" />
                                            </span>
                                            <span className="text-[12px] font-semibold text-slate-300">
                                                {n.analyst}
                                            </span>
                                            <span className="text-[11px] text-slate-600">•</span>
                                            <span className="font-mono text-[11px] text-slate-500">
                                                {timeAgo(n.created_at)}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
                                            {n.note}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[12px] text-slate-500">
                                No investigation notes yet. Add an observation below.
                            </p>
                        )}

                        {/* Add note form */}
                        <div className="mt-3 flex gap-2">
                            <textarea
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Add a note…"
                                rows={2}
                                className="flex-1 resize-none rounded-xl border border-white/[0.08] bg-slate-950/40 px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-200 placeholder-slate-600 outline-none transition-colors duration-300 focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20"
                            />
                            <button
                                type="button"
                                disabled={!noteText.trim()}
                                onClick={() => {
                                    if (!noteText.trim()) return;
                                    onAddNote?.(incident.id, "SOC Analyst", noteText.trim());
                                    setNoteText("");
                                }}
                                className="alerts-btn-frost inline-flex h-9 w-9 flex-shrink-0 items-center justify-center self-end rounded-xl border border-white/10 bg-white/[0.04] text-cyan-400 transition-all duration-300 hover:border-cyan-400/30 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>
                </section>

                {/* Response Actions */}
                <section className="pb-2">

                    <SectionHeading
                        index="05"
                        title="Response Actions"
                        caption="Next steps for the assigned analyst"
                    />
                    <div className="mt-4 rounded-2xl border border-white/[0.06] bg-slate-950/20 px-5 py-4">
                        <ResponseActions
                            incident={incident}
                            onResolved={onResolved}
                            onAssign={onAssign}
                        />

                        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                            Response actions are connected to the Sentinel AI backend.
                            Incident status, analyst assignment and investigation workflow
                            are synchronized with the database in real time.
                        </p>
                    </div>
                </section>
            </div>
        </section>
    );
}

/* Section heading with a subtle index marker */
function SectionHeading({ index, title, caption }) {
    return (
        <div className="flex items-baseline gap-3">
            <span className="font-mono text-[12px] font-bold tracking-widest text-cyan-400/70">
                {index}
            </span>
            <div>
                <h3 className="text-[18px] font-bold tracking-tight text-white">
                    {title}
                </h3>
                <p className="mt-0 text-[12px] text-slate-500">{caption}</p>
            </div>
        </div>
    );
}

export default InvestigationWorkspace;
