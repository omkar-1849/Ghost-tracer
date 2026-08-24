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
        case "critical": return "bg-[rgba(223,91,91,0.10)] text-[var(--color-critical)] border-[rgba(223,91,91,0.25)]";
        case "high": return "bg-[rgba(224,133,68,0.10)] text-[var(--color-high)] border-[rgba(224,133,68,0.25)]";
        case "medium": return "bg-[rgba(211,165,62,0.10)] text-[var(--color-medium)] border-[rgba(211,165,62,0.25)]";
        case "low": return "bg-[rgba(138,166,189,0.10)] text-[var(--color-low)] border-[rgba(138,166,189,0.25)]";
        case "info": return "bg-[rgba(138,148,140,0.10)] text-[var(--color-info)] border-[rgba(138,148,140,0.25)]";
        default: return "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]";
    }
}

export function SeverityBadge({ severity }) {
    const label = severity ? String(severity).toUpperCase() : "INFO";
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border whitespace-nowrap ${severityClasses(severity)}`}>
            {label}
        </span>
    );
}

export function SectionTitle({ children, className = "" }) {
    return (
        <h4 className={`text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2.5 ${className}`}>
            {children}
        </h4>
    );
}

export function DetailRow({ label, value, mono = true }) {
    return (
        <div className="flex items-center justify-between gap-4 py-1.5 border-b border-[var(--color-border-subtle)] last:border-0 text-xs">
            <span className="font-medium text-[var(--color-text-muted)] uppercase tracking-wider shrink-0 text-[11px]">{label}</span>
            <span className={`text-[var(--color-text-primary)] text-right truncate ${mono ? "font-mono" : ""}`}>{value || "N/A"}</span>
        </div>
    );
}

export function DetailGrid({ children, className = "" }) {
    return <div className={className}>{children}</div>;
}

const metricTones = {
    purple: { text: "text-[var(--color-text-primary)]" },
    cyan: { text: "text-[var(--color-text-primary)]" },
    green: { text: "text-[var(--color-success)]" },
    amber: { text: "text-[var(--color-high)]" },
    yellow: { text: "text-[var(--color-medium)]" },
    red: { text: "text-[var(--color-critical)]" },
    blue: { text: "text-[var(--color-low)]" },
};

export function MetricChip({ label, value, tone = "purple" }) {
    const theme = metricTones[tone] || metricTones.purple;
    return (
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-md p-3">
            <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{label}</p>
            <span className={`text-base font-bold tabular-nums truncate max-w-[200px] block ${theme.text}`}>{value ?? "—"}</span>
        </div>
    );
}

export function StringList({ title, items, tone = "amber" }) {
    if (!items || items.length === 0) return null;
    const tones = {
        red: "bg-[rgba(223,91,91,0.08)] text-[var(--color-critical)] border-[rgba(223,91,91,0.20)]",
        amber: "bg-[rgba(224,133,68,0.08)] text-[var(--color-high)] border-[rgba(224,133,68,0.20)]",
        cyan: "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]",
    };
    return (
        <div>
            <SectionTitle>{title}</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
                {items.map((item, i) => (
                    <span key={i} className={`px-2 py-1 rounded border text-xs font-mono ${tones[tone] || tones.amber}`}>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
                    <div key={idx} className="bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-md p-3.5">
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                            <h4 className="text-xs font-semibold text-[var(--color-text-primary)] break-words">{title}</h4>
                            <SeverityBadge severity={finding.severity} />
                        </div>
                        {description && (
                            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed break-words">{description}</p>
                        )}
                        {finding.solution && (
                            <p className="mt-2.5 flex items-start gap-1.5 text-xs text-[var(--color-success)] bg-[rgba(85,176,123,0.08)] border border-[rgba(85,176,123,0.20)] rounded p-2">
                                <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
                                <span>{finding.solution}</span>
                            </p>
                        )}
                        {meta.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2.5 pt-2 border-t border-[var(--color-border-subtle)]">
                                {meta.map((m) => (
                                    <span key={m.label} className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border-default)] text-[10px] font-mono text-[var(--color-text-muted)]">
                                        <strong className="text-[var(--color-text-secondary)]">{m.label}:</strong> {m.value}
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
        <div className="space-y-2">
            {recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-2.5 bg-[rgba(85,176,123,0.08)] border border-[rgba(85,176,123,0.20)] rounded-md p-3">
                    <CheckCircle2 size={14} className="text-[var(--color-success)] mt-0.5 shrink-0" />
                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{rec}</p>
                </div>
            ))}
        </div>
    );
}

export function EmptyPanel({ icon: Icon = ShieldCheck, title = "No data", subtitle = "No results available for this scan." }) {
    return (
        <div className="flex flex-col items-center justify-center py-8 text-center bg-[var(--color-surface-1)] rounded-md border border-[var(--color-border-default)] border-dashed">
            <Icon size={24} className="text-[var(--color-text-disabled)] mb-2" />
            <p className="text-xs font-medium text-[var(--color-text-secondary)]">{title}</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>
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
        <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricChip label="Risk" value={summary.risk || "Unknown"} tone={riskTone} />
                <MetricChip label="DBMS" value={findings.dbms || "Unknown"} tone="cyan" />
                <MetricChip label="WAF" value={findings.waf || "Not Detected"} tone="purple" />
                <MetricChip label="Injectable" value={findings.injectable ? "Yes" : "No"} tone={findings.injectable ? "red" : "green"} />
            </div>

            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-md p-3.5">
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
        INFO: "text-[var(--color-info)]",
        WARNING: "text-[var(--color-high)]",
        CRITICAL: "text-[var(--color-critical)]",
        ERROR: "text-[var(--color-critical)]",
    };
    return (
        <div>
            <SectionTitle>Execution Timeline</SectionTitle>
            <div className="space-y-1.5">
                {timeline.map((event, i) => (
                    <div key={i} className="flex items-start gap-2.5 bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded px-3 py-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5 ${levelColors[(event.level || "INFO").toUpperCase()] || "text-[var(--color-text-secondary)]"}`}>
                            {event.level || "INFO"}
                        </span>
                        <p className="text-xs text-[var(--color-text-secondary)] font-mono leading-relaxed">{event.message}</p>
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
        <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <MetricChip label="Hosts" value={summary.total_hosts ?? hosts.length} tone="blue" />
                <MetricChip label="Open Ports" value={summary.total_ports ?? totalPorts} tone="cyan" />
                <MetricChip label="Findings" value={summary.total_findings ?? findings.length} tone={findings.length ? "amber" : "green"} />
            </div>

            {hosts.length > 0 && (
                <div>
                    <SectionTitle>Hosts &amp; Ports</SectionTitle>
                    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-md overflow-x-auto">
                        <table className="w-full text-left text-xs min-w-[580px]">
                            <thead>
                                <tr className="border-b border-[var(--color-border-default)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                                    <th className="py-2 px-3">Host Status</th>
                                    <th className="py-2 px-3">Port</th>
                                    <th className="py-2 px-3">Service</th>
                                    <th className="py-2 px-3">Product / Version</th>
                                    <th className="py-2 px-3">NSE Scripts</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hosts.map((host, hi) => {
                                    const ports = host.ports || [];
                                    if (ports.length === 0) {
                                        return (
                                            <tr key={hi} className="border-b border-[var(--color-border-subtle)]">
                                                <td className="py-2 px-3 text-[var(--color-text-secondary)]" colSpan={5}>{host.status || "up"}</td>
                                            </tr>
                                        );
                                    }
                                    return ports.map((port, pi) => (
                                        <tr key={`${hi}-${pi}`} className="border-b border-[var(--color-border-subtle)] last:border-0">
                                            <td className="py-2 px-3 text-[var(--color-text-secondary)] capitalize">{hi === 0 ? host.status || "up" : ""}</td>
                                            <td className="py-2 px-3 font-mono text-[var(--color-text-secondary)]">{port.port}{port.protocol ? `/${port.protocol}` : ""}</td>
                                            <td className="py-2 px-3 text-[var(--color-text-primary)]">{port.service || "—"}</td>
                                            <td className="py-2 px-3 text-[var(--color-text-secondary)]">{[port.product, port.version].filter(Boolean).join(" ") || "—"}</td>
                                            <td className="py-2 px-3 text-[var(--color-text-muted)] text-[11px]">
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
        <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
        <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
        <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
        <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricChip label="Certificate Health" value={validity} tone={validity === "Valid" ? "green" : "red"} />
                <MetricChip label="Days to Expiry" value={cert.days_until_expiry ?? "N/A"} tone={cert.is_expiring_soon ? "amber" : "cyan"} />
                <MetricChip label="TLS Version" value={cipher.tls_version || "N/A"} tone="blue" />
                <MetricChip label="Findings" value={findings.length} tone={findings.length ? "amber" : "green"} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-md p-3.5">
                    <div className="flex items-center gap-2 mb-2.5">
                        <Lock size={13} className="text-[var(--color-text-secondary)]" />
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

                <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-md p-3.5">
                    <div className="flex items-center gap-2 mb-2.5">
                        <Server size={13} className="text-[var(--color-text-secondary)]" />
                        <SectionTitle className="mb-0">Cipher Suite</SectionTitle>
                    </div>
                    <DetailGrid>
                        <DetailRow label="Cipher" value={cipher.name} mono={false} />
                        <DetailRow label="Protocol" value={cipher.protocol} mono={false} />
                        <DetailRow label="Key Bits" value={cipher.bits} />
                    </DetailGrid>

                    <SectionTitle className="mt-4">Subject Alternative Names</SectionTitle>
                    {cert.sans && cert.sans.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {cert.sans.map((san, i) => (
                                <span key={i} className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border-default)] text-[10px] font-mono text-[var(--color-text-secondary)]">
                                    {san}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-[var(--color-text-muted)]">No SANs reported.</p>
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
