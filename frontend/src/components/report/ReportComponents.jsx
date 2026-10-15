import { severityBreakdown, scanCompleteness } from "../../services/evidence.js";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    AlertTriangle,
    Activity,
    ArrowLeft,
    Braces,
    ChevronDown,
    ChevronRight,
    Clock,
    Download,
    ExternalLink,
    FileWarning,
    Globe,
    Printer,
    Server,
    ShieldAlert,
    ShieldCheck,
    Terminal,
    Zap,
} from "lucide-react";
import { StatusPill } from "../scanner/shared";
import { formatDuration, formatDate } from "../scanner/scannerUtils";

// Top Navigation Bar
export function TopBar({ scan }) {
    const navigate = useNavigate();

    const handleBack = () => {
        if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
        } else {
            navigate("/scanner");
        }
    };

    const handleExportJSON = () => {
        if (!scan) return;
        const dataStr = JSON.stringify(scan, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `scan-report-${scan.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={handleBack}
                    className="flex items-center gap-2 text-xs font-medium text-[#D6CFC7] hover:text-[#F5F1EC] transition-all bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-xl border border-white/10"
                >
                    <ArrowLeft size={14} />
                    Back to Scanner
                </button>
                <div className="h-4 w-px bg-white/10" />
                <div className="flex items-center gap-1.5 text-xs text-[#9E948A]">
                    <span onClick={handleBack} className="hover:text-[#F5F1EC] cursor-pointer">Scanner</span>
                    <ChevronRight size={12} className="text-[#6E675F]" />
                    <span className="text-[#D3A06A] font-mono">Assessment #{scan?.id}</span>
                </div>
            </div>

            <div className="hidden md:flex items-center gap-2">
                <button
                    type="button"
                    onClick={handleExportJSON}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#0D0C0A] transition-all bg-gradient-to-r from-[#D3A06A] to-[#E3B985] hover:brightness-105 px-3.5 py-2 rounded-xl shadow-[0_2px_10px_rgba(211,160,106,0.25)]"
                >
                    <ExternalLink size={13} /> Export JSON
                </button>
                <button
                    type="button"
                    disabled
                    title="Export to PDF is coming soon"
                    className="flex items-center gap-1.5 text-xs font-medium text-[#6E675F] bg-white/5 px-3.5 py-2 rounded-xl border border-white/5 cursor-not-allowed opacity-50"
                >
                    <Download size={13} /> Download PDF
                </button>
                <button
                    type="button"
                    disabled
                    title="Print report is coming soon"
                    className="flex items-center gap-1.5 text-xs font-medium text-[#6E675F] bg-white/5 px-3.5 py-2 rounded-xl border border-white/5 cursor-not-allowed opacity-50"
                >
                    <Printer size={13} /> Print
                </button>
            </div>
        </div>
    );
}

function riskLabelFromScore(score) {
    if (score >= 70) return { label: "High", color: "text-[#FF8585]" };
    if (score >= 40) return { label: "Medium", color: "text-[#E5B374]" };
    if (score > 0) return { label: "Low", color: "text-[#77C79A]" };
    return { label: "Unknown", color: "text-[#9E948A]" };
}

// 1. Assessment Hero
export function AssessmentHero({ scan, report }) {
    const summary = report?.summary || {};
    const risk = riskLabelFromScore(scan.risk_score);
    const isHighRisk = risk.label === "High";
    const engineName = summary.engine || scan.scanner || "Scanner";
    const duration = summary.duration || formatDuration(scan.created_at, scan.completed_at);

    return (
        <div className="sentinel-glass p-6 rounded-2xl mb-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="max-w-3xl">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[rgba(211,160,106,0.12)] border border-[rgba(211,160,106,0.25)] text-[#D3A06A] flex items-center gap-1.5">
                            <Activity size={13} /> {engineName} Assessment
                        </span>
                        <StatusPill status={scan.status} />
                    </div>

                    <h1 className="text-xl md:text-2xl font-bold text-[#F5F1EC] mb-2 font-mono break-words">
                        {summary.target || scan.target}
                    </h1>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#9E948A] mt-4">
                        <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-lg border border-white/10 text-[#D6CFC7]">
                            <Clock size={13} className="text-[#9E948A]" />
                            {duration || "—"}
                        </span>
                        <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-lg border border-white/10 font-mono text-[#D3A06A]">
                            <Zap size={13} className="text-[#D3A06A]" />
                            Scan #{scan.id}
                        </span>
                        <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-lg border border-white/10 text-[#77C79A]">
                            <Globe size={13} className="text-[#77C79A]" />
                            Verification not attested in this report
                        </span>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center bg-[rgba(18,16,14,0.45)] border border-[rgba(255,248,238,0.08)] rounded-2xl p-5 min-w-[200px]">
                    <span className="text-[11px] font-semibold text-[#9E948A] uppercase tracking-wider mb-2">
                        Risk Score
                    </span>
                    <div className={`flex flex-col items-center gap-1.5 ${risk.color}`}>
                        {isHighRisk ? <ShieldAlert size={36} /> : <ShieldCheck size={36} />}
                        <span className="text-3xl font-bold tabular-nums text-[#F5F1EC]">{scan.risk_score ?? "N/A"}</span>
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#9E948A]">/ 100 · {risk.label}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// 2. Summary Card
export function SummaryCard({ scan, report }) {
    const summary = report?.summary || {};
    const risk = riskLabelFromScore(scan.risk_score);
    const engineName = summary.engine || scan.scanner || "Scanner";
    const status = (scan.status || "").toUpperCase();

    if (!scanCompleteness(scan).complete) {
        return (
            <div className="sentinel-glass border border-[rgba(223,91,91,0.25)] rounded-2xl p-5 shadow-[0_4px_24px_rgba(223,91,91,0.10)]">
                <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={18} className="text-[#FF8585]" />
                    <h3 className="text-sm font-semibold text-[#FF8585]">Assessment {scanCompleteness(scan).label}</h3>
                </div>
                <p className="text-xs text-[#D6CFC7] leading-relaxed">
                    The <strong className="text-[#F5F1EC]">{engineName}</strong> assessment against{" "}
                    <strong className="text-[#F5F1EC] font-mono">{scan.target}</strong> has incomplete coverage. Recorded findings are partial evidence, not a clean bill of health.
                </p>
                {scan.error && (
                    <div className="mt-3 text-xs text-[#FF8585] bg-[rgba(18,16,14,0.50)] border border-[rgba(223,91,91,0.25)] rounded-xl p-3 font-mono break-words">
                        {scan.error}
                    </div>
                )}
                <p className="text-[11px] text-[#9E948A] mt-3">
                    Inspect the raw console logs below for underlying trace data.
                </p>
            </div>
        );
    }

    const duration = summary.duration || formatDuration(scan.created_at, scan.completed_at);

    return (
        <div className="sentinel-glass p-5 rounded-2xl">
            <h3 className="text-sm font-semibold text-[#F5F1EC] mb-3 flex items-center gap-2">
                <FileWarning size={16} className="text-[#D3A06A]" />
                Executive Summary
            </h3>
            <div className="text-xs text-[#D6CFC7] leading-relaxed space-y-2 max-w-4xl">
                <p>
                    An assessment was conducted targeting <strong className="text-[#F5F1EC] font-mono">{summary.target || scan.target}</strong> using the <strong className="text-[#F5F1EC]">{engineName}</strong> engine.{" "}
                    {status === "COMPLETED" && !scan.truncated ? (
                        <>The scan completed in <strong className="text-[#F5F1EC]">{duration || "an unknown duration"}</strong>.</>
                    ) : status === "COMPLETED" ? (
                        <>The scan ran to the end of its window; the output may be incomplete.</>
                    ) : (
                        <>The scan is currently {status.toLowerCase()}.</>
                    )}
                </p>
                <p>
                    The calculated risk score for this target is <strong className={risk.color}>{scan.risk_score ?? "N/A"}/100 ({risk.label})</strong> with{" "}
                    <strong className="text-[#F5F1EC] font-bold">{scan.findings ?? "N/A"}</strong> reported findings.
                    {risk.label === "High"
                        ? " Immediate remediation is recommended for the identified vulnerability indicators."
                        : " This automated scan did not reach the high-risk threshold."}
                </p>
            </div>
        </div>
    );
}

// 3. Risk Metric
export function RiskMetric({ label, value, icon: Icon, colorClass }) {
    const displayValue = value === null || value === undefined ? "N/A" : String(value);

    return (
        <div className="sentinel-glass p-4 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-semibold text-[#9E948A] uppercase tracking-wider">{label}</span>
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 ${colorClass}`}>
                    <Icon size={14} />
                </span>
            </div>
            <p className="text-2xl font-bold text-[#F5F1EC] truncate tabular-nums font-mono" title={displayValue}>{displayValue}</p>
        </div>
    );
}

// 4. Severity Distribution
const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];
const SEVERITY_STYLES = {
    critical: { bar: "bg-[var(--color-critical)]", text: "text-[var(--color-critical)]" },
    high: { bar: "bg-[var(--color-high)]", text: "text-[var(--color-high)]" },
    medium: { bar: "bg-[var(--color-medium)]", text: "text-[var(--color-medium)]" },
    low: { bar: "bg-[var(--color-low)]", text: "text-[var(--color-low)]" },
    info: { bar: "bg-[var(--color-info)]", text: "text-[var(--color-info)]" },
};

export function SeverityDistribution({ report }) {
    const breakdown = severityBreakdown(report);
    const total = SEVERITY_ORDER.reduce((acc, sev) => acc + (breakdown[sev] || 0), 0);

    return (
        <div className="sentinel-glass p-5 rounded-2xl">
            <h3 className="text-sm font-semibold text-[#F5F1EC] mb-4 flex items-center gap-2">
                <AlertTriangle size={16} className="text-[#E5B374]" />
                Severity Distribution
            </h3>

            {total === 0 ? (
                <div className="text-center py-6 text-xs text-[#9E948A]">
                    No findings recorded for this assessment.
                </div>
            ) : (
                <div className="space-y-3">
                    {SEVERITY_ORDER.map((sev) => {
                        const count = breakdown[sev] || 0;
                        const style = SEVERITY_STYLES[sev];
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        if (count === 0) return null;

                        return (
                            <div key={sev}>
                                <div className="flex items-center justify-between text-xs mb-1">
                                    <span className={`font-semibold uppercase tracking-wider text-[10px] ${style.text}`}>
                                        {sev}
                                    </span>
                                    <span className="text-[#D6CFC7] tabular-nums text-xs">
                                        {count} <span className="text-[#9E948A]">({pct}%)</span>
                                    </span>
                                </div>
                                <div className="h-2 rounded-full bg-white/5 overflow-hidden border border-white/10">
                                    <div
                                        className={`h-full rounded-full ${style.bar}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// 5. Metadata Panel
export function MetadataPanel({ scan }) {
    const [expanded, setExpanded] = useState(false);
    const duration = formatDuration(scan.created_at, scan.completed_at);

    return (
        <div className="sentinel-glass rounded-2xl overflow-hidden border border-[rgba(255,248,238,0.08)]">
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 bg-transparent hover:bg-white/5 transition-colors focus:outline-none"
            >
                <div className="flex items-center gap-2.5">
                    <Server size={15} className="text-[#D3A06A]" />
                    <h3 className="text-xs font-semibold text-[#F5F1EC] uppercase tracking-wider">Scanner Metadata</h3>
                </div>
                {expanded ? <ChevronDown size={16} className="text-[#9E948A]" /> : <ChevronRight size={16} className="text-[#9E948A]" />}
            </button>

            {expanded && (
                <div className="p-5 border-t border-white/5 bg-[rgba(18,16,14,0.35)]">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div>
                            <p className="text-[10px] font-semibold text-[#9E948A] uppercase tracking-wider mb-1">Engine</p>
                            <p className="text-xs text-[#F5F1EC] font-mono">{scan.scanner}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold text-[#9E948A] uppercase tracking-wider mb-1">Version</p>
                            <p className="text-xs text-[#F5F1EC] font-mono">Not reported</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold text-[#9E948A] uppercase tracking-wider mb-1">Started</p>
                            <p className="text-xs text-[#F5F1EC] font-mono">{formatDate(scan.created_at)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold text-[#9E948A] uppercase tracking-wider mb-1">Completed</p>
                            <p className="text-xs text-[#F5F1EC] font-mono">{scan.completed_at ? formatDate(scan.completed_at) : "Not recorded"}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold text-[#9E948A] uppercase tracking-wider mb-1">Status</p>
                            <p className="text-xs text-[#F5F1EC] font-mono">{scan.status || "N/A"}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold text-[#9E948A] uppercase tracking-wider mb-1">Duration</p>
                            <p className="text-xs text-[#F5F1EC] font-mono">{duration || "N/A"}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// 6. Terminal Viewer
export function TerminalViewer({ output }) {
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    async function handleCopy() {
        if (!output) return;
        try {
            await navigator.clipboard.writeText(output);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error(error);
        }
    }

    function handleDownload() {
        if (!output) return;
        const blob = new Blob([output], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "scan-raw-output.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    return (
        <div className="sentinel-glass rounded-2xl overflow-hidden border border-[rgba(255,248,238,0.08)]">
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 bg-transparent hover:bg-white/5 transition-colors focus:outline-none"
                aria-expanded={expanded}
            >
                <div className="flex items-center gap-2.5">
                    <Terminal size={15} className="text-[#D3A06A]" />
                    <span className="text-xs font-semibold text-[#F5F1EC] uppercase tracking-wider">Raw Console Output</span>
                </div>
                {expanded ? <ChevronDown size={16} className="text-[#9E948A]" /> : <ChevronRight size={16} className="text-[#9E948A]" />}
            </button>

            {expanded && (
                <div className="relative border-t border-white/5">
                    <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="bg-white/5 hover:bg-white/10 text-[#D6CFC7] hover:text-[#F5F1EC] text-[11px] font-medium px-3 py-1.5 rounded-lg border border-white/10 transition-colors"
                        >
                            {copied ? "Copied!" : "Copy"}
                        </button>
                        <button
                            type="button"
                            onClick={handleDownload}
                            className="bg-white/5 hover:bg-white/10 text-[#D6CFC7] hover:text-[#F5F1EC] text-[11px] font-medium px-3 py-1.5 rounded-lg border border-white/10 transition-colors flex items-center gap-1.5"
                        >
                            <Download size={12} /> Log
                        </button>
                    </div>
                    <div className="p-4 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent bg-[#0A0908]/90">
                        <pre className="font-mono text-xs leading-relaxed text-[#D6CFC7] whitespace-pre-wrap">
                            {output || "No raw console output available."}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
}

// 7. Parsed JSON (developer mode)
export function ParsedJsonViewer({ report }) {
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const json = JSON.stringify(report, null, 2) || "{}";

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(json);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error(error);
        }
    }

    return (
        <div className="sentinel-glass rounded-2xl overflow-hidden border border-[rgba(255,248,238,0.08)]">
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 bg-transparent hover:bg-white/5 transition-colors focus:outline-none"
                aria-expanded={expanded}
            >
                <div className="flex items-center gap-2.5">
                    <Braces size={15} className="text-[#D3A06A]" />
                    <span className="text-xs font-semibold text-[#F5F1EC] uppercase tracking-wider">Parsed JSON Document</span>
                    <span className="px-2 py-0.5 rounded-full bg-[rgba(211,160,106,0.12)] border border-[rgba(211,160,106,0.25)] text-[#D3A06A] text-[10px] font-mono">
                        Developer Mode
                    </span>
                </div>
                {expanded ? <ChevronDown size={16} className="text-[#9E948A]" /> : <ChevronRight size={16} className="text-[#9E948A]" />}
            </button>

            {expanded && (
                <div className="relative border-t border-white/5">
                    <div className="absolute top-3 right-3 z-10">
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="bg-white/5 hover:bg-white/10 text-[#D6CFC7] hover:text-[#F5F1EC] text-[11px] font-medium px-3 py-1.5 rounded-lg border border-white/10 transition-colors"
                        >
                            {copied ? "Copied!" : "Copy JSON"}
                        </button>
                    </div>
                    <div className="p-4 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent bg-[#0A0908]/90">
                        <pre className="font-mono text-xs leading-relaxed text-[#D6CFC7] whitespace-pre-wrap">{json}</pre>
                    </div>
                </div>
            )}
        </div>
    );
}
