import {
    Braces,
    Crosshair,
    FileText,
    Gauge,
    Link2,
    ScanSearch,
    ScrollText,
    Send,
} from "lucide-react";

const EVIDENCE_TYPES = [
    {
        key: "http",
        label: "HTTP Request",
        match: /request|http[_\s-]?request|trigger/i,
        Icon: Send,
        isTrigger: true,
    },
    {
        key: "analysis",
        label: "Analysis",
        match: /analysis/i,
        Icon: ScanSearch,
    },
    {
        key: "json",
        label: "JSON",
        match: /\.json|json/i,
        Icon: Braces,
    },
    {
        key: "log",
        label: "LOG",
        match: /\.log|\blog\b/i,
        Icon: ScrollText,
    },
    {
        key: "text",
        label: "TEXT",
        match: /text|\.txt/i,
        Icon: FileText,
    },
];

const DEFAULT_TYPE = EVIDENCE_TYPES[EVIDENCE_TYPES.length - 1];

function detectEvidenceType(evidence) {
    const sample = `${evidence?.file_type ?? ""} ${evidence?.filename ?? ""}`.trim();
    if (!sample) return DEFAULT_TYPE;
    return (
        EVIDENCE_TYPES.find((type) => type.match.test(sample)) ?? DEFAULT_TYPE
    );
}

function splitDetectionReasons(value) {
    return String(value ?? "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
}

function statusColor(code) {
    const n = Number(code);
    if (!Number.isFinite(n)) return "text-[var(--color-text-secondary)]";
    if (n >= 200 && n < 300) return "text-[var(--color-success)]";
    if (n >= 400 && n < 500) return "text-[var(--color-warning)]";
    if (n >= 500) return "text-[var(--color-critical)]";
    return "text-[var(--color-text-secondary)]";
}

function EvidencePanel({ incident }) {
    const rows = incident?.evidence ?? [];

    if (rows.length === 0) {
        return (
            <div className="p-4 rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] text-center text-xs text-[var(--color-text-muted)]">
                No correlated evidence artifacts recorded for this incident.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {rows.map((evidence, index) => {
                const type = detectEvidenceType(evidence);
                const TypeIcon = type.Icon;
                const isTrigger = type.isTrigger;
                const detectionReasons = splitDetectionReasons(
                    evidence.detection_reason
                );

                return (
                    <div
                        key={`${incident.id}-${evidence.id ?? index}`}
                        className={`relative rounded-md border p-3.5 transition-colors ${
                            isTrigger
                                ? "border-[rgba(229,72,77,0.30)] bg-[var(--color-surface-1)]"
                                : "border-[var(--color-border-default)] bg-[var(--color-surface-1)]"
                        }`}
                    >
                        {isTrigger && (
                            <span className="absolute inset-y-0 left-0 w-[3px] bg-[var(--color-critical)] rounded-l" />
                        )}

                        <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-[var(--color-surface-3)] text-[var(--color-text-muted)]">
                                <TypeIcon size={15} />
                            </span>

                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="font-mono text-xs font-semibold text-[var(--color-text-primary)]">
                                        {evidence.filename}
                                    </h4>

                                    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--color-surface-3)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)]">
                                        <Link2 size={9} />
                                        {evidence.file_type}
                                    </span>

                                    {isTrigger && (
                                        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[rgba(229,72,77,0.10)] border border-[rgba(229,72,77,0.25)] text-[var(--color-critical)]">
                                            <Crosshair size={9} />
                                            TRIGGER PAYLOAD
                                        </span>
                                    )}
                                </div>

                                {evidence.description && (
                                    <p className="mt-1 text-xs text-[var(--color-text-secondary)] leading-relaxed">
                                        {evidence.description}
                                    </p>
                                )}

                                {/* Key/value metadata grid */}
                                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3 pt-2.5 border-t border-[var(--color-border-subtle)]">
                                    {evidence.ip_address && (
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                                                Source IP
                                            </p>
                                            <p className="mt-0.5 font-mono text-xs text-[var(--color-text-primary)] truncate">
                                                {evidence.ip_address}
                                            </p>
                                        </div>
                                    )}

                                    {evidence.method && (
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                                                Method
                                            </p>
                                            <p className="mt-0.5 font-mono text-xs font-semibold text-[var(--color-accent)]">
                                                {evidence.method}
                                            </p>
                                        </div>
                                    )}

                                    {evidence.url && (
                                        <div className="col-span-2 sm:col-span-1">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                                                URI Path
                                            </p>
                                            <p className="mt-0.5 font-mono text-xs text-[var(--color-text-secondary)] truncate">
                                                {evidence.url}
                                            </p>
                                        </div>
                                    )}

                                    {evidence.status_code != null && (
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                                                HTTP Status
                                            </p>
                                            <p className={`mt-0.5 font-mono text-xs font-semibold ${statusColor(evidence.status_code)}`}>
                                                {evidence.status_code}
                                            </p>
                                        </div>
                                    )}

                                    {evidence.risk_score != null && (
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                                                Risk Assessment
                                            </p>
                                            <p className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs font-semibold text-[var(--color-critical)]">
                                                <Gauge size={12} />
                                                {evidence.risk_score}/100
                                            </p>
                                        </div>
                                    )}

                                    {detectionReasons.length > 0 && (
                                        <div className="col-span-2 sm:col-span-3">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                                                Rule Signatures
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                {detectionReasons.map((reason, rIdx) => (
                                                    <span
                                                        key={rIdx}
                                                        className="rounded px-1.5 py-0.5 font-mono text-[10px] bg-[var(--color-surface-3)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)]"
                                                    >
                                                        {reason}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default EvidencePanel;
