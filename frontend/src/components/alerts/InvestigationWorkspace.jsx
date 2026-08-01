import { ArrowLeft, Clock3, Fingerprint, ShieldAlert } from "lucide-react";
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
}) {
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
            <div className="relative z-10 px-6 pb-5 pt-5 sm:px-8">
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
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] ${theme.chip}`}
                    >
                        <span className={`h-1.5 w-1.5 rounded-full ${theme.chipDot}`} />
                        {theme.label.toUpperCase()}
                    </span>

                    {/* Status chip */}
                    <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] ${
                            incident.resolved
                                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                                : theme.statusChip
                        }`}
                    >
                        <span className={`h-1.5 w-1.5 rounded-full ${theme.chipDot}`} />
                        {incident.status.toUpperCase()}
                    </span>

                    <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/40 px-2.5 py-1 font-mono text-[10px] tracking-widest text-slate-500 sm:inline-flex">
                        <Fingerprint size={10} className="text-slate-500" />
                        {incident.caseId}
                    </span>
                </div>

                <h2 className="mt-3.5 text-2xl font-bold leading-tight tracking-tight text-white sm:text-[26px]">
                    {incident.title}
                </h2>

                <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-slate-400">
                    {incident.description}
                </p>

                <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
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
                            className={`font-bold tabular-nums ${
                                incident.confidence >= 85
                                    ? "text-emerald-300"
                                    : incident.confidence >= 70
                                      ? "text-amber-300"
                                      : "text-slate-300"
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
                className="alerts-enter alerts-scroll relative z-10 flex-1 space-y-8 overflow-y-auto px-6 py-6 sm:px-8"
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
                    <div className="mt-4 rounded-2xl border border-white/[0.06] bg-slate-950/20 px-5 py-6">
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

                {/* Response Actions */}
                <section className="pb-2">
                    <SectionHeading
                        index="04"
                        title="Response Actions"
                        caption="Next steps for the assigned analyst"
                    />
                    <div className="mt-4 rounded-2xl border border-white/[0.06] bg-slate-950/20 px-5 py-5">
                        <ResponseActions incident={incident} onResolved={onResolved} />
                        <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
                            Actions are UI-only placeholders in this build —
                            backend orchestration can be wired to these controls
                            without changing the workspace layout.
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
            <span className="font-mono text-[11px] font-bold tracking-widest text-cyan-400/70">
                {index}
            </span>
            <div>
                <h3 className="text-[15px] font-bold tracking-tight text-white">
                    {title}
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500">{caption}</p>
            </div>
        </div>
    );
}

export default InvestigationWorkspace;
