import { useState } from "react";
import { ArrowLeft, Clock3, Fingerprint, Plus, ShieldAlert, User } from "lucide-react";
import { formatDateTime, timeAgo } from "./alertsData";
import AttackDetails from "./AttackDetails";
import IncidentTimeline from "./IncidentTimeline";
import EvidencePanel from "./EvidencePanel";
import ResponseActions from "./ResponseActions";

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
                className={`flex min-h-[24rem] flex-col items-center justify-center gap-3 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-2)] p-10 text-center shadow-[var(--shadow-1)] ${
                    mobileHidden ? "hidden md:flex" : "flex"
                }`}
            >
                <span className="flex h-12 w-12 items-center justify-center rounded-md bg-[var(--color-surface-3)] text-[var(--color-text-disabled)]">
                    <ShieldAlert size={22} />
                </span>
                <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                    No Incident Selected
                </p>
                <p className="max-w-xs text-[11px] leading-relaxed text-[var(--color-text-muted)]">
                    Choose an alert or incident record from the queue to open its full forensic workspace.
                </p>
            </section>
        );
    }

    const theme = incident.severityTheme;

    return (
        <section
            className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-2)] shadow-[var(--shadow-1)] ${
                mobileHidden ? "hidden md:flex" : "flex"
            }`}
        >
            {/* Header */}
            <div className="p-5 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-1)]">
                {/* Mobile back button */}
                <div className="mb-2.5 flex items-center justify-between md:hidden">
                    <button
                        type="button"
                        onClick={onBack}
                        className="inline-flex items-center gap-1 rounded bg-[var(--color-surface-2)] border border-[var(--color-border-default)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)]"
                    >
                        <ArrowLeft size={12} />
                        Queue
                    </button>

                    <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                        {incident.caseId}
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${theme.chip}`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${theme.chipDot}`} />
                        {theme.label}
                    </span>

                    <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            incident.resolved
                                ? "bg-[rgba(63,163,77,0.10)] border border-[rgba(63,163,77,0.25)] text-[var(--color-success)]"
                                : theme.statusChip
                        }`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${theme.chipDot}`} />
                        {incident.status}
                    </span>

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[var(--color-surface-3)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)]">
                        <Fingerprint size={10} className="text-[var(--color-text-muted)]" />
                        {incident.caseId}
                    </span>
                </div>

                <h2 className="text-base font-semibold tracking-tight text-[var(--color-text-primary)]">
                    {incident.title}
                </h2>

                <p className="mt-1 text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-2xl">
                    {incident.description}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--color-text-muted)] pt-2.5 border-t border-[var(--color-border-subtle)]">
                    <span className="inline-flex items-center gap-1 text-[11px]">
                        <Clock3 size={12} className="text-[var(--color-text-muted)]" />
                        {formatDateTime(incident.timestamp)}
                    </span>
                    <span>·</span>
                    <span className="text-[11px]">
                        Detected <strong className="text-[var(--color-text-primary)] font-medium">{timeAgo(incident.created_at)}</strong>
                    </span>
                    <span>·</span>
                    <span className="text-[11px]">
                        Confidence:{" "}
                        <span className="font-mono font-semibold text-[var(--color-text-primary)]">
                            {incident.confidence}%
                        </span>
                    </span>
                </div>
            </div>

            {/* Scrollable sections */}
            <div className="flex-1 space-y-6 overflow-y-auto max-h-[640px] p-5 scrollbar-thin scrollbar-thumb-[var(--color-border-strong)] scrollbar-track-transparent">
                {/* 01. Attack Surface Details */}
                <div>
                    <SectionHeading
                        index="01"
                        title="Attack Surface Details"
                        caption="Ingress vectors and MITRE ATT&CK taxonomy"
                    />
                    <div className="mt-3">
                        <AttackDetails incident={incident} />
                    </div>
                </div>

                {/* 02. Timeline */}
                <div>
                    <SectionHeading
                        index="02"
                        title="Investigation Timeline"
                        caption="Chronological record of detections and case milestones"
                    />
                    <div className="mt-3 rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] p-4">
                        <IncidentTimeline incident={incident} />
                    </div>
                </div>

                {/* 03. Forensic Evidence */}
                <div>
                    <SectionHeading
                        index="03"
                        title="Forensic Evidence"
                        caption="Correlated network payloads and telemetry artifacts"
                    />
                    <div className="mt-3">
                        <EvidencePanel incident={incident} />
                    </div>
                </div>

                {/* 04. Case Notes */}
                <div>
                    <SectionHeading
                        index="04"
                        title="Case Notes"
                        caption="Analyst log and investigation annotations"
                    />
                    <div className="mt-3 rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] p-4">
                        {incident.notes && incident.notes.length > 0 ? (
                            <div className="space-y-2 mb-3">
                                {incident.notes.map((n) => (
                                    <div
                                        key={n.id}
                                        className="rounded border border-[var(--color-border-default)] bg-[var(--color-surface-2)] p-2.5"
                                    >
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <User size={11} className="text-[var(--color-accent)]" />
                                            <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                                                {n.analyst}
                                            </span>
                                            <span className="text-[10px] text-[var(--color-text-muted)] font-mono ml-auto">
                                                {timeAgo(n.created_at)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                                            {n.note}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-[var(--color-text-muted)] mb-3">
                                No case annotations recorded. Add an observation below.
                            </p>
                        )}

                        <div className="flex gap-2">
                            <textarea
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Add analyst case note…"
                                rows={2}
                                className="flex-1 resize-none rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-2)] p-2.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:border-[var(--color-accent)] focus:outline-none"
                            />
                            <button
                                type="button"
                                disabled={!noteText.trim()}
                                onClick={() => {
                                    if (!noteText.trim()) return;
                                    onAddNote?.(incident.id, "SOC Analyst", noteText.trim());
                                    setNoteText("");
                                }}
                                className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center self-end rounded-md bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-40 transition-colors"
                                title="Add note"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* 05. Response Actions */}
                <div className="pb-2">
                    <SectionHeading
                        index="05"
                        title="Response Actions"
                        caption="Orchestrate containment and case mitigation"
                    />
                    <div className="mt-3 rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] p-4">
                        <ResponseActions
                            incident={incident}
                            onResolved={onResolved}
                            onAssign={onAssign}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}

function SectionHeading({ index, title, caption }) {
    return (
        <div className="flex items-baseline gap-2">
            <span className="font-mono text-[11px] font-semibold text-[var(--color-accent)]">
                {index}.
            </span>
            <div>
                <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
                    {title}
                </h3>
                <p className="text-[11px] text-[var(--color-text-muted)]">{caption}</p>
            </div>
        </div>
    );
}

export default InvestigationWorkspace;
