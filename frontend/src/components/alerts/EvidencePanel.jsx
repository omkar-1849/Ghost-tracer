import {
    Braces,
    ChevronRight,
    Crosshair,
    FileText,
    Fingerprint,
    Gauge,
    Link2,
    ScanSearch,
    ScrollText,
    Send,
} from "lucide-react";

/**
 * EvidencePanel
 * -------------
 * Displays real forensic evidence returned by the backend as a compact
 * digital-forensics viewer. Each artifact is classified by type (HTTP
 * Request / Analysis / JSON / LOG / TEXT) with a distinct colour, icon and
 * badge. The HTTP-Request artifact — the original attack — visually stands
 * out via a rose ring + "TRIGGER REQUEST" badge.
 *
 * Metadata is presented as label-above-value key/value cells (the
 * enterprise SOC convention): Source IP → Method → URL → Status →
 * Risk Score, with Detection Reasons as individual tag badges.
 */

const EVIDENCE_TYPES = [
    {
        key: "http",
        label: "HTTP Request",
        match: /request|http[_\s-]?request|trigger/i,
        Icon: Send,
        iconWrap: "border-rose-400/30 bg-rose-500/15 text-rose-300",
        hoverBorder: "hover:border-rose-400/45",
        hoverBg: "hover:bg-rose-950/20",
        chip: "border-rose-400/30 bg-rose-500/10 text-rose-200",
        isTrigger: true,
    },
    {
        key: "analysis",
        label: "Analysis",
        match: /analysis/i,
        Icon: ScanSearch,
        iconWrap: "border-violet-400/25 bg-violet-500/15 text-violet-300",
        hoverBorder: "hover:border-violet-400/40",
        hoverBg: "hover:bg-violet-950/20",
        chip: "border-violet-400/25 bg-violet-500/10 text-violet-300",
    },
    {
        key: "json",
        label: "JSON",
        match: /\.json|json/i,
        Icon: Braces,
        iconWrap: "border-amber-400/25 bg-amber-500/15 text-amber-300",
        hoverBorder: "hover:border-amber-400/40",
        hoverBg: "hover:bg-amber-950/20",
        chip: "border-amber-400/25 bg-amber-500/10 text-amber-300",
    },
    {
        key: "log",
        label: "LOG",
        match: /\.log|\blog\b/i,
        Icon: ScrollText,
        iconWrap: "border-cyan-400/25 bg-cyan-500/15 text-cyan-300",
        hoverBorder: "hover:border-cyan-400/40",
        hoverBg: "hover:bg-cyan-950/20",
        chip: "border-cyan-400/25 bg-cyan-500/10 text-cyan-300",
    },
    {
        key: "text",
        label: "TEXT",
        match: /text|\.txt/i,
        Icon: FileText,
        iconWrap: "border-white/10 bg-slate-700/30 text-slate-300",
        hoverBorder: "hover:border-white/20",
        hoverBg: "hover:bg-slate-800/30",
        chip: "border-white/10 bg-white/[0.04] text-slate-400",
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

/* Split the backend detection_reason string into individual tag badges. */
function splitDetectionReasons(value) {
    return String(value ?? "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
}

function statusColor(code) {
    const n = Number(code);
    if (!Number.isFinite(n)) return "text-slate-300";
    if (n >= 200 && n < 300) return "text-emerald-300";
    if (n >= 400 && n < 500) return "text-amber-300";
    if (n >= 500) return "text-red-400";
    return "text-slate-300";
}

function EvidencePanel({ incident }) {
    const rows = incident?.evidence ?? [];

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
                        className={`alerts-tl-node group relative overflow-hidden rounded-xl border bg-slate-950/30 p-4 transition-all duration-300 ${
                            isTrigger
                                ? "border-rose-400/35 bg-rose-950/10 shadow-[0_0_24px_-8px_rgba(244,63,94,0.45),inset_0_0_0_1px_rgba(244,63,94,0.08)]"
                                : "border-white/[0.07]"
                        } ${type.hoverBorder} ${type.hoverBg}`}
                        style={{ animationDelay: `${index * 80}ms` }}
                    >
                        {/* Trigger accent rail */}
                        {isTrigger && (
                            <span className="pointer-events-none absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-gradient-to-b from-rose-400 to-red-600 shadow-[0_0_10px_rgba(244,63,94,0.8)]" />
                        )}

                        <div className="flex items-start gap-3">
                            <span
                                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border bg-slate-900/60 transition-all duration-300 group-hover:brightness-125 ${type.iconWrap}`}
                            >
                                <TypeIcon size={16} />
                            </span>

                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="truncate font-mono text-[14px] font-semibold text-slate-100">
                                        {evidence.filename}
                                    </h4>

                                    <span
                                        className={`hidden items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold tracking-widest sm:inline-flex ${type.chip}`}
                                    >
                                        <Link2 size={9} />
                                        {evidence.file_type}
                                    </span>

                                    {isTrigger && (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/40 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-rose-200 shadow-[0_0_10px_-2px_rgba(244,63,94,0.6)]">
                                            <Crosshair size={9} />
                                            TRIGGER REQUEST
                                        </span>
                                    )}
                                </div>

                                <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                                    {evidence.description}
                                </p>

                                {/* Key/value metadata — label above value */}
                                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12px] lg:grid-cols-3">

                                    {evidence.ip_address && (
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                                Source IP
                                            </p>
                                            <p className="mt-0.5 truncate font-mono text-[12px] text-slate-200">
                                                {evidence.ip_address}
                                            </p>
                                        </div>
                                    )}

                                    {evidence.method && (
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                                Method
                                            </p>
                                            <p className="mt-0.5 truncate font-mono text-[12px] font-bold text-sky-300">
                                                {evidence.method}
                                            </p>
                                        </div>
                                    )}

                                    {evidence.url && (
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                                URL
                                            </p>
                                            <p className="mt-0.5 truncate font-mono text-[12px] text-slate-200">
                                                {evidence.url}
                                            </p>
                                        </div>
                                    )}

                                    {evidence.status_code != null && (
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                                Status
                                            </p>
                                            <p className={`mt-0.5 truncate font-mono text-[12px] font-bold ${statusColor(evidence.status_code)}`}>
                                                {evidence.status_code}
                                            </p>
                                        </div>
                                    )}

                                    {evidence.risk_score != null && (
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                                Risk Score
                                            </p>
                                            <p className="mt-0.5 inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-mono text-[14px] font-bold text-red-300">
                                                <Gauge size={13} className="text-red-400" />
                                                {evidence.risk_score}
                                            </p>
                                        </div>
                                    )}

                                    {detectionReasons.length > 0 && (
                                        <div className="min-w-0 lg:col-span-3">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                                Detection
                                            </p>
                                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                {detectionReasons.map((reason, reasonIndex) => (
                                                    <span
                                                        key={`${evidence.id ?? index}-${reasonIndex}`}
                                                        className="rounded-md border border-white/10 bg-slate-900/60 px-2 py-0.5 font-mono text-[11px] text-slate-300"
                                                    >
                                                        {reason}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {evidence.user_agent && (
                                        <div className="min-w-0 md:col-span-2 lg:col-span-3">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                                User-Agent
                                            </p>
                                            <p className="mt-0.5 truncate font-mono text-[12px] text-slate-300">
                                                {evidence.user_agent}
                                            </p>
                                        </div>
                                    )}

                                </div>
                            </div>

                            <span className="flex flex-shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-slate-400 transition-all duration-300 group-hover:border-cyan-400/40 group-hover:text-cyan-200">
                                View
                                <ChevronRight
                                    size={11}
                                    className="transition-transform duration-300 group-hover:translate-x-0.5"
                                />
                            </span>
                        </div>

                        <span className="pointer-events-none absolute right-14 top-2 hidden text-slate-700 opacity-0 transition-opacity duration-500 group-hover:opacity-100 md:block">
                            <Fingerprint size={10} />
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

export default EvidencePanel;
