import {
    AlertTriangle,
    Bug,
    CheckCircle2,
    Lock,
    Server,
    ShieldCheck,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Generic building blocks shared by every engine renderer            */
/* ------------------------------------------------------------------ */

function severityClasses(severity) {
    switch ((severity || "").toLowerCase()) {
        case "critical": return "bg-red-500/15 text-red-400 border-red-500/30";
        case "high": return "bg-orange-500/15 text-orange-400 border-orange-500/30";
        case "medium": return "bg-amber-500/15 text-amber-400 border-amber-500/30";
        case "low": return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
        case "info": return "bg-sky-500/15 text-sky-300 border-sky-500/30";
        default: return "bg-slate-500/15 text-slate-400 border-slate-500/30";
    }
}

export function SeverityBadge({ severity }) {
    const label = severity ? String(severity).toUpperCase() : "INFO";
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${severityClasses(severity)}`}>
            {label}
        </span>
    );
}

export function SectionTitle({ children, className = "" }) {
    return (
        <h4 className={`text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 ${className}`}>
            {children}
        </h4>
    );
}

export function DetailRow({ label, value, mono = true }) {
    return (
        <div className="flex items-center justify-between gap-4 py-2 border-b border-slate-800/50 last:border-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">{label}</span>
            <span className={`text-sm text-white text-right truncate ${mono ? "font-mono" : ""}`}>{value || "N/A"}</span>
        </div>
    );
}

export function DetailGrid({ children, className = "" }) {
    return <div className={className}>{children}</div>;
}

const metricTones = {
    purple: { chip: "from-purple-500/25 to-fuchsia-600/10", text: "text-purple-300" },
    cyan: { chip: "from-cyan-500/25 to-blue-600/10", text: "text-cyan-300" },
    green: { chip: "from-green-500/25 to-emerald-600/10", text: "text-green-300" },
    amber: { chip: "from-amber-500/25 to-orange-600/10", text: "text-amber-300" },
    yellow: { chip: "from-yellow-500/25 to-amber-600/10", text: "text-yellow-300" },
    red: { chip: "from-red-500/25 to-rose-600/10", text: "text-red-400" },
    blue: { chip: "from-blue-500/25 to-indigo-600/10", text: "text-blue-300" },
};

export function MetricChip({ label, value, tone = "purple" }) {
    const theme = metricTones[tone] || metricTones.purple;
    return (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">{label}</p>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-br border border-slate-700/50 ${theme.chip}`}>
                <span className={`text-lg font-bold tabular-nums truncate max-w-[220px] ${theme.text}`}>{value ?? "—"}</span>
            </div>
        </div>
    );
}

export function StringList({ title, items, tone = "amber" }) {
    if (!items || items.length === 0) return null;
    const tones = {
        red: "text-red-400 bg-red-500/10 border-red-500/20",
        amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        cyan: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20",
    };
    return (
        <div>
            <SectionTitle>{title}</SectionTitle>
            <div className="flex flex-wrap gap-2">
                {items.map((item, i) => (
                    <span key={i} className={`px-3 py-1.5 rounded-lg border text-xs font-mono ${tones[tone] || tones.amber}`}>
                        {item}
                    </span>
                ))}
            </div>
        </div>
    );
}

export function FindingsList({ findings }) {
    if (!findings || findings.length === 0) {
        return (
            <EmptyPanel
                icon={ShieldCheck}
                title="No Findings"
                subtitle="This scan reported no findings."
            />
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {findings.map((finding, idx) => {
                const details = finding.details || {};
                const get = (key) => finding[key] ?? details[key];
                const title = finding.name || finding.title || finding.template_id || finding.type || `Finding #${idx + 1}`;
                const description = finding.description || finding.message || "";

                const meta = [
                    get("template_id") && { label: "Template", value: get("template_id") },
                    get("matched_at") && { label: "Matched", value: get("matched_at") },
                    get("url") && { label: "URL", value: get("url") },
                    get("method") && { label: "Method", value: get("method") },
                    get("confidence") && { label: "Confidence", value: get("confidence") },
                    get("cweid") && { label: "CWE", value: get("cweid") },
                    get("osvdb") && { label: "OSVDB", value: get("osvdb") },
                    get("port") && { label: "Port", value: `${get("port")}${get("protocol") ? "/" + get("protocol") : ""}` },
                    get("service") && { label: "Service", value: get("service") },
                    get("product") && { label: "Product", value: get("product") },
                    get("version") && { label: "Version", value: get("version") },
                    finding.id && { label: "ID", value: finding.id },
                ].filter(Boolean);

                return (
                    <div key={idx} className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <h4 className="text-sm font-bold text-white break-words">{title}</h4>
                            <SeverityBadge severity={finding.severity} />
                        </div>
                        {description && (
                            <p className="text-[13px] text-slate-400 leading-relaxed break-words">{description}</p>
                        )}
                        {finding.solution && (
                            <p className="mt-3 flex items-start gap-2 text-[13px] text-emerald-300 bg-emerald-950/20 border border-emerald-500/20 rounded-lg px-3 py-2">
                                <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                                <span>{finding.solution}</span>
                            </p>
                        )}
                        {meta.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                                {meta.map((m) => (
                                    <span key={m.label} className="px-2 py-0.5 rounded-md bg-slate-800/70 border border-slate-700/60 text-[10px] font-mono text-slate-300">
                                        {m.label}: {m.value}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export function RecommendationsList({ recommendations }) {
    if (!recommendations || recommendations.length === 0) return null;
    return (
        <div className="space-y-2.5">
            {recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4">
                    <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-slate-300 leading-relaxed">{rec}</p>
                </div>
            ))}
        </div>
    );
}

export function EmptyPanel({ icon: Icon = ShieldCheck, title = "No data", subtitle = "No results available for this scan." }) {
    return (
        <div className="flex flex-col items-center justify-center py-10 text-center bg-slate-950/30 rounded-xl border border-slate-800/40 border-dashed">
            <Icon size={32} className="text-slate-600 mb-3" />
            <p className="text-slate-300 font-medium">{title}</p>
            <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Per-engine renderers                                                */
/* ------------------------------------------------------------------ */

function SQLMapResults({ report }) {
    const summary = report.summary || {};
    const findings = report.findings || {};
    const riskTone = summary.risk === "High" ? "red" : summary.risk === "Medium" ? "amber" : summary.risk === "Low" ? "green" : "purple";
    const httpErrors = (findings.http_errors || []).map((e) =>
        typeof e === "string" ? e : `${e.code} ${e.message}`.trim()
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricChip label="Risk" value={summary.risk || "Unknown"} tone={riskTone} />
                <MetricChip label="DBMS" value={findings.dbms || "Unknown"} tone="cyan" />
                <MetricChip label="WAF" value={findings.waf || "Not Detected"} tone="purple" />
                <MetricChip label="Injectable" value={findings.injectable ? "Yes" : "No"} tone={findings.injectable ? "red" : "green"} />
            </div>

            <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-4">
                <SectionTitle>Injection Profile</SectionTitle>
                <DetailGrid>
                    <DetailRow label="Parameters Tested" value={findings.parameters_tested ?? "0"} />
                    <DetailRow label="Exit Status" value={report.metadata?.exit_status || "N/A"} />
                </DetailGrid>
            </div>

            <StringList title="Critical Findings" items={findings.critical} tone="red" />
            <StringList title="Warnings" items={findings.warnings} tone="amber" />
            <StringList title="HTTP Errors" items={httpErrors} tone="amber" />
            <StringList title="Databases Enumerated" items={findings.databases} tone="cyan" />
            <StringList title="Tables Discovered" items={findings.tables} tone="cyan" />
            <StringList title="Columns Exposed" items={findings.columns} tone="cyan" />

            <TimelineList timeline={report.timeline} />
        </div>
    );
}

function TimelineList({ timeline }) {
    if (!timeline || timeline.length === 0) return null;
    const levelColors = {
        INFO: "text-cyan-400",
        WARNING: "text-amber-400",
        CRITICAL: "text-red-400",
        ERROR: "text-red-400",
    };
    return (
        <div>
            <SectionTitle>Execution Timeline</SectionTitle>
            <div className="space-y-2">
                {timeline.map((event, i) => (
                    <div key={i} className="flex items-start gap-3 bg-slate-950/40 border border-slate-800/60 rounded-lg px-4 py-2.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5 ${levelColors[(event.level || "INFO").toUpperCase()] || "text-slate-400"}`}>
                            {event.level || "INFO"}
                        </span>
                        <p className="text-[13px] text-slate-300 font-mono leading-relaxed">{event.message}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function NmapResults({ report }) {
    const summary = report.summary || {};
    const hosts = report.hosts || [];
    const findings = report.findings || [];
    const totalPorts = hosts.reduce((acc, host) => acc + (host.ports || []).length, 0);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <MetricChip label="Hosts" value={summary.total_hosts ?? hosts.length} tone="blue" />
                <MetricChip label="Open Ports" value={summary.total_ports ?? totalPorts} tone="cyan" />
                <MetricChip label="Findings" value={summary.total_findings ?? findings.length} tone={findings.length ? "amber" : "green"} />
            </div>

            {hosts.length > 0 && (
                <div>
                    <SectionTitle>Hosts &amp; Ports</SectionTitle>
                    <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl overflow-x-auto">
                        <table className="w-full text-left text-sm min-w-[640px]">
                            <thead>
                                <tr className="border-b border-slate-700/60 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                    <th className="py-2.5 px-4">Host Status</th>
                                    <th className="py-2.5 px-4">Port</th>
                                    <th className="py-2.5 px-4">Service</th>
                                    <th className="py-2.5 px-4">Product / Version</th>
                                    <th className="py-2.5 px-4">NSE Scripts</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hosts.map((host, hi) => {
                                    const ports = host.ports || [];
                                    if (ports.length === 0) {
                                        return (
                                            <tr key={hi} className="border-b border-slate-800/60">
                                                <td className="py-2.5 px-4 text-slate-300" colSpan={5}>{host.status || "up"}</td>
                                            </tr>
                                        );
                                    }
                                    return ports.map((port, pi) => (
                                        <tr key={`${hi}-${pi}`} className="border-b border-slate-800/60 last:border-0">
                                            <td className="py-2.5 px-4 text-slate-300 capitalize">{hi === 0 ? host.status || "up" : ""}</td>
                                            <td className="py-2.5 px-4 font-mono text-cyan-300">{port.port}{port.protocol ? `/${port.protocol}` : ""}</td>
                                            <td className="py-2.5 px-4 text-slate-200">{port.service || "—"}</td>
                                            <td className="py-2.5 px-4 text-slate-400">{[port.product, port.version].filter(Boolean).join(" ") || "—"}</td>
                                            <td className="py-2.5 px-4 text-slate-500 text-xs">
                                                {(port.scripts || []).map((s) => s.id).join(", ") || "—"}
                                            </td>
                                        </tr>
                                    ));
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {findings.length > 0 && (
                <div>
                    <SectionTitle>Findings</SectionTitle>
                    <FindingsList findings={findings} />
                </div>
            )}
        </div>
    );
}

function NucleiResults({ report }) {
    const summary = report.summary || {};
    const breakdown = summary.severity_breakdown || {};
    const cveList = report.cve_list || [];
    const templates = report.templates_matched || [];
    const findings = report.findings || [];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <MetricChip label="Critical" value={breakdown.critical ?? 0} tone="red" />
                <MetricChip label="High" value={breakdown.high ?? 0} tone="amber" />
                <MetricChip label="Medium" value={breakdown.medium ?? 0} tone="yellow" />
                <MetricChip label="Low" value={breakdown.low ?? 0} tone="blue" />
                <MetricChip label="Info" value={breakdown.info ?? 0} tone="cyan" />
            </div>

            <StringList title="CVEs Detected" items={cveList} tone="red" />
            <StringList title="Templates Executed" items={templates} tone="cyan" />

            {findings.length > 0 && (
                <div>
                    <SectionTitle>Findings</SectionTitle>
                    <FindingsList findings={findings} />
                </div>
            )}
        </div>
    );
}

function NiktoResults({ report }) {
    const findings = report.findings || [];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <MetricChip label="Total Findings" value={report.total_findings ?? findings.length} tone="amber" />
                <MetricChip label="Server" value={report.server_info || "Unknown"} tone="cyan" />
            </div>

            {findings.length > 0 ? (
                <div>
                    <SectionTitle>Server Findings</SectionTitle>
                    <FindingsList findings={findings} />
                </div>
            ) : (
                <EmptyPanel icon={ShieldCheck} title="No Findings" subtitle="No server misconfigurations or outdated components detected." />
            )}
        </div>
    );
}

function ZapResults({ report }) {
    const breakdown = report.risk_breakdown || {};
    const findings = report.findings || [];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricChip label="High" value={breakdown.high ?? 0} tone="red" />
                <MetricChip label="Medium" value={breakdown.medium ?? 0} tone="amber" />
                <MetricChip label="Low" value={breakdown.low ?? 0} tone="yellow" />
                <MetricChip label="Info" value={breakdown.info ?? 0} tone="cyan" />
            </div>

            {findings.length > 0 ? (
                <div>
                    <SectionTitle>Alerts</SectionTitle>
                    <FindingsList findings={findings} />
                </div>
            ) : (
                <EmptyPanel icon={ShieldCheck} title="No Alerts" subtitle="ZAP reported no alerts for this target." />
            )}
        </div>
    );
}

function SSLResults({ report }) {
    const cert = report.certificate_details || {};
    const cipher = report.cipher_info || {};
    const findings = report.findings || [];
    const validity = report.validity_status || "Unknown";

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricChip label="Certificate Health" value={validity} tone={validity === "Valid" ? "green" : "red"} />
                <MetricChip label="Days to Expiry" value={cert.days_until_expiry ?? "N/A"} tone={cert.is_expiring_soon ? "amber" : "cyan"} />
                <MetricChip label="TLS Version" value={cipher.tls_version || "N/A"} tone="blue" />
                <MetricChip label="Findings" value={findings.length} tone={findings.length ? "amber" : "green"} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Lock size={14} className="text-cyan-400" />
                        <SectionTitle className="mb-0">Certificate</SectionTitle>
                    </div>
                    <DetailGrid>
                        <DetailRow label="Subject" value={cert.subject} mono={false} />
                        <DetailRow label="Issuer" value={cert.issuer} mono={false} />
                        <DetailRow label="Serial Number" value={cert.serial_number} />
                        <DetailRow label="Not Before" value={cert.not_before} mono={false} />
                        <DetailRow label="Not After" value={cert.not_after} mono={false} />
                        <DetailRow label="Expired" value={cert.is_expired ? "Yes" : "No"} />
                        <DetailRow label="Expiring Soon" value={cert.is_expiring_soon ? "Yes" : "No"} />
                    </DetailGrid>
                </div>

                <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Server size={14} className="text-blue-400" />
                        <SectionTitle className="mb-0">Cipher Suite</SectionTitle>
                    </div>
                    <DetailGrid>
                        <DetailRow label="Cipher" value={cipher.name} mono={false} />
                        <DetailRow label="Protocol" value={cipher.protocol} mono={false} />
                        <DetailRow label="Key Bits" value={cipher.bits} />
                    </DetailGrid>

                    <SectionTitle className="mt-5">Subject Alternative Names</SectionTitle>
                    {cert.sans && cert.sans.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {cert.sans.map((san, i) => (
                                <span key={i} className="px-2 py-1 rounded-md bg-slate-800/70 border border-slate-700/60 text-[11px] font-mono text-cyan-300">
                                    {san}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500">No SANs reported.</p>
                    )}
                </div>
            </div>

            {findings.length > 0 && (
                <div>
                    <SectionTitle>Weak Algorithms &amp; Issues</SectionTitle>
                    <FindingsList findings={findings} />
                </div>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Registry — the extension point for new scanners                    */
/* ------------------------------------------------------------------ */
/**
 * To add a new scanner engine (e.g. OpenVAS, Trivy, Burp, Wazuh, Nessus):
 *   1. Add backend support (VALID_ENGINES + ScannerFactory registration).
 *   2. Add an entry to SCANNER_ENGINES in ./constants (id + backend engine value).
 *   3. Add a small renderer component below that reads that engine's
 *      parsed_output shape, and register it in ENGINE_RENDERERS keyed by
 *      the frontend tab id.
 * EngineTab and the Report page pick it up automatically — no new page.
 */
const ENGINE_RENDERERS = {
    sqlmap: SQLMapResults,
    nmap: NmapResults,
    nuclei: NucleiResults,
    nikto: NiktoResults,
    "owasp-zap": ZapResults,
    "ssl-analyzer": SSLResults,
};

function getEngineRenderer(engineId) {
    return ENGINE_RENDERERS[engineId] || null;
}

export function EngineResults({ report, engineId }) {
    if (!report || typeof report !== "object") {
        return (
            <EmptyPanel
                icon={AlertTriangle}
                title="No Report Data"
                subtitle="The parsed report for this scan is unavailable."
            />
        );
    }

    // Renderers are resolved from the ENGINE_RENDERERS registry at runtime —
    // this is the deliberate extension point for new engines, so the component
    // reference is intentionally dynamic rather than a static import.
    const Renderer = getEngineRenderer(engineId);
    if (!Renderer) {
        return (
            <EmptyPanel
                icon={Bug}
                title="Renderer Not Found"
                subtitle={`No result renderer is registered for engine "${engineId}".`}
            />
        );
    }

    // eslint-disable-next-line react-hooks/static-components
    return <Renderer report={report} />;
}
