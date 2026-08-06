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
    Shield,
    ShieldAlert,
    ShieldCheck,
    Terminal,
    Zap,
} from "lucide-react";
import { formatDuration, formatDate, StatusPill } from "../scanner/shared";

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
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <button
                    onClick={handleBack}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-slate-900/50 hover:bg-slate-800 px-4 py-2 rounded-xl border border-slate-800/60"
                >
                    <ArrowLeft size={16} />
                    Back to Scanner
                </button>
                <div className="h-6 w-px bg-slate-800"></div>
                <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                    <span onClick={handleBack} className="text-slate-400 hover:text-slate-300 cursor-pointer">Scanner</span>
                    <ChevronRight size={14} className="text-slate-700" />
                    <span className="text-slate-400 hover:text-slate-300 cursor-pointer">Reports</span>
                    <ChevronRight size={14} className="text-slate-700" />
                    <span className="text-white">Assessment #{scan?.id}</span>
                </div>
            </div>

            <div className="hidden md:flex items-center gap-3">
                <button
                    onClick={handleExportJSON}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-slate-900/30 hover:bg-slate-800 px-4 py-2 rounded-xl border border-slate-800/60 text-sm font-medium"
                >
                    <ExternalLink size={14} /> Export JSON
                </button>
                <button
                    disabled
                    title="Export to PDF is coming soon"
                    className="flex items-center gap-2 text-slate-600 bg-slate-900/10 px-4 py-2 rounded-xl border border-slate-800/30 text-sm font-medium cursor-not-allowed"
                >
                    <Download size={14} /> Download PDF
                </button>
                <button
                    disabled
                    title="Print report is coming soon"
                    className="flex items-center gap-2 text-slate-600 bg-slate-900/10 px-4 py-2 rounded-xl border border-slate-800/30 text-sm font-medium cursor-not-allowed"
                >
                    <Printer size={14} /> Print
                </button>
            </div>
        </div>
    );
}

function riskLabelFromScore(score) {
    if (score >= 70) return { label: "High", color: "text-red-400" };
    if (score >= 40) return { label: "Medium", color: "text-amber-400" };
    if (score > 0) return { label: "Low", color: "text-emerald-400" };
    return { label: "Unknown", color: "text-slate-400" };
}

// 1. Assessment Hero
export function AssessmentHero({ scan, report }) {
    const summary = report?.summary || {};
    const risk = riskLabelFromScore(scan.risk_score);
    const isHighRisk = risk.label === "High";
    const engineName = summary.engine || scan.scanner || "Scanner";
    const duration = summary.duration || formatDuration(scan.created_at, scan.completed_at);

    return (
        <div className="relative bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-8 md:p-12 shadow-2xl shadow-black/50 overflow-hidden mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.04] via-transparent to-cyan-500/[0.04] pointer-events-none" />

            <div className="absolute -top-24 -right-24 p-8 opacity-[0.03] pointer-events-none transform rotate-12">
                <Shield size={400} />
            </div>

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 relative z-10">
                <div className="max-w-4xl">
                    <div className="flex items-center gap-4 mb-5">
                        <span className="px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                            <Activity size={14} /> {engineName} Assessment
                        </span>
                        <StatusPill status={scan.status} />
                    </div>

                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 break-words leading-tight">
                        {summary.target || scan.target}
                    </h1>

                    <div className="flex flex-wrap items-center gap-6 text-sm text-slate-400 mt-6">
                        <span className="flex items-center gap-2 bg-slate-950/50 px-3 py-1.5 rounded-lg border border-slate-800/50">
                            <Clock size={16} className="text-cyan-400" />
                            {duration || "—"}
                        </span>
                        <span className="flex items-center gap-2 bg-slate-950/50 px-3 py-1.5 rounded-lg border border-slate-800/50">
                            <Zap size={16} className="text-purple-400" />
                            ID: #{scan.id}
                        </span>
                        <span className="flex items-center gap-2 bg-slate-950/50 px-3 py-1.5 rounded-lg border border-slate-800/50">
                            <Globe size={16} className="text-emerald-400" />
                            Target Scanned
                        </span>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-3xl p-8 min-w-[240px] shadow-xl">
                    <span className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-3">
                        Risk Score
                    </span>
                    <div className={`text-5xl font-bold flex flex-col items-center gap-3 ${risk.color}`}>
                        {isHighRisk ? <ShieldAlert size={48} className="drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" /> : <ShieldCheck size={48} className="drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]" />}
                        <span className="drop-shadow-lg tabular-nums">{scan.risk_score ?? 0}</span>
                        <span className="text-sm font-bold uppercase tracking-widest text-slate-400">/ 100 · {risk.label}</span>
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

    if (status === "FAILED") {
        return (
            <div className="bg-red-950/20 border border-red-500/20 rounded-2xl p-8 shadow-lg shadow-black/20">
                <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle size={22} className="text-red-400" />
                    <h3 className="text-xl font-bold text-white">Scan Failed</h3>
                </div>
                <p className="text-slate-300 leading-relaxed">
                    The <strong className="text-white">{engineName}</strong> assessment against{" "}
                    <strong className="text-white">{scan.target}</strong> did not complete successfully.
                </p>
                {scan.error && (
                    <p className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 break-words">
                        {scan.error}
                    </p>
                )}
                <p className="text-slate-400 text-sm mt-4 italic">
                    Review the raw console output below for the underlying error.
                </p>
            </div>
        );
    }

    const duration = summary.duration || formatDuration(scan.created_at, scan.completed_at);

    return (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-8 shadow-lg shadow-black/40">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                    <FileWarning size={20} className="text-purple-400" />
                </span>
                Executive Summary
            </h3>
            <div className="text-slate-300 leading-relaxed text-base space-y-4 max-w-5xl">
                <p>
                    A comprehensive security assessment was conducted targeting <strong className="text-white">{summary.target || scan.target}</strong> using the <strong className="text-white">{engineName}</strong> engine.{" "}
                    {status === "COMPLETED" ? (
                        <>The scan completed in <strong className="text-white">{duration || "an unknown duration"}</strong>.</>
                    ) : (
                        <>The scan is currently {status.toLowerCase()}.</>
                    )}
                </p>
                <p>
                    The overall risk score for this target is <strong className={risk.color}>{scan.risk_score ?? 0}/100 ({risk.label})</strong> with{" "}
                    <strong className="text-white">{scan.findings ?? 0}</strong> reported findings.
                    {risk.label === "High"
                        ? " Immediate remediation is strongly advised for the critical vulnerabilities discovered."
                        : " No critical vulnerabilities were discovered during this assessment."}
                </p>
                <p className="text-slate-400 text-sm mt-2 italic">
                    This report contains automated findings. Analysts should verify high-severity indicators and review raw output if necessary.
                </p>
            </div>
        </div>
    );
}

// 3. Risk Metric
export function RiskMetric({ label, value, icon: Icon, colorClass }) {
    const displayValue = value === null || value === undefined ? "N/A" : String(value);

    return (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 flex flex-col gap-4 shadow-lg shadow-black/20 hover:bg-slate-800/50 transition-colors">
            <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg bg-slate-950 border border-slate-800 ${colorClass}`}>
                    <Icon size={22} />
                </div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{label}</p>
            </div>
            <div>
                <p className="text-2xl font-bold text-white truncate" title={displayValue}>{displayValue}</p>
            </div>
        </div>
    );
}

// 4. Severity Distribution
const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];
const SEVERITY_STYLES = {
    critical: { bar: "bg-red-500", text: "text-red-400" },
    high: { bar: "bg-orange-500", text: "text-orange-400" },
    medium: { bar: "bg-amber-500", text: "text-amber-400" },
    low: { bar: "bg-yellow-500", text: "text-yellow-300" },
    info: { bar: "bg-sky-500", text: "text-sky-300" },
};

function computeSeverityBreakdown(report) {
    if (!report) return { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    if (report.summary?.severity_breakdown) return report.summary.severity_breakdown;
    if (report.risk_breakdown) return report.risk_breakdown;

    const breakdown = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const list = report.findings;
    if (Array.isArray(list)) {
        for (const finding of list) {
            const sev = (finding.severity || "info").toLowerCase();
            if (sev in breakdown) breakdown[sev] += 1;
        }
    } else if (list && typeof list === "object") {
        breakdown.critical = Array.isArray(list.critical) ? list.critical.length : 0;
        breakdown.high = Array.isArray(list.warnings) ? list.warnings.length : 0;
    }
    return breakdown;
}

export function SeverityDistribution({ report }) {
    const breakdown = computeSeverityBreakdown(report);
    const total = SEVERITY_ORDER.reduce((acc, sev) => acc + (breakdown[sev] || 0), 0);

    return (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-8 shadow-lg shadow-black/40">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                    <AlertTriangle size={20} className="text-amber-400" />
                </span>
                Severity Distribution
            </h3>

            {total === 0 ? (
                <div className="text-center py-8 text-slate-500">
                    No findings to distribute — this scan is clean.
                </div>
            ) : (
                <div className="space-y-4">
                    {SEVERITY_ORDER.map((sev) => {
                        const count = breakdown[sev] || 0;
                        const style = SEVERITY_STYLES[sev];
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        if (count === 0) return null;
                        return (
                            <div key={sev}>
                                <div className="flex items-center justify-between text-sm mb-1.5">
                                    <span className={`font-semibold uppercase tracking-wider text-xs ${style.text}`}>
                                        {sev}
                                    </span>
                                    <span className="text-slate-400 tabular-nums">
                                        {count} <span className="text-slate-600">({pct}%)</span>
                                    </span>
                                </div>
                                <div className="h-2.5 rounded-full bg-slate-800/80 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${style.bar} transition-all duration-700`}
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
    const status = (scan.status || "").toUpperCase();
    const duration = formatDuration(scan.created_at, scan.completed_at);

    return (
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden shadow-lg shadow-black/20">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-6 bg-slate-900/60 hover:bg-slate-800/80 transition-colors focus:outline-none"
            >
                <div className="flex items-center gap-3">
                    <Server size={18} className="text-slate-400" />
                    <h3 className="text-lg font-bold text-white">Scanner Metadata</h3>
                </div>
                {expanded ? <ChevronDown size={20} className="text-slate-500" /> : <ChevronRight size={20} className="text-slate-500" />}
            </button>

            {expanded && (
                <div className="p-6 border-t border-slate-800">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Engine</p>
                            <p className="text-sm text-white font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 inline-block">{scan.scanner}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Version</p>
                            <p className="text-sm text-white font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 inline-block">N/A</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Started</p>
                            <p className="text-sm text-white font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 inline-block">{formatDate(scan.created_at)}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Completed</p>
                            <p className="text-sm text-white font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 inline-block">{scan.completed_at ? formatDate(scan.completed_at) : "In Progress"}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Status</p>
                            <p className="text-sm text-white font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 inline-block">{scan.status || "N/A"}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Duration</p>
                            <p className="text-sm text-white font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 inline-block">{duration || "N/A"}</p>
                        </div>
                    </div>
                    {status === "FAILED" && scan.error && (
                        <div className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 break-words">
                            {scan.error}
                        </div>
                    )}
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
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-6 bg-[#0f172a] hover:bg-[#1e293b] transition-colors focus:outline-none border-b border-slate-800"
                aria-expanded={expanded}
            >
                <div className="flex items-center gap-3">
                    <Terminal size={20} className="text-cyan-400" />
                    <span className="text-lg font-bold text-slate-200">Raw Console Output</span>
                </div>
                {expanded ? <ChevronDown size={22} className="text-slate-500" /> : <ChevronRight size={22} className="text-slate-500" />}
            </button>

            {expanded && (
                <div className="relative">
                    <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                        <button
                            onClick={handleCopy}
                            className="bg-slate-800/80 hover:bg-slate-700 backdrop-blur-md text-slate-300 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-xl border border-slate-700 transition-colors shadow-lg"
                        >
                            {copied ? "Copied!" : "Copy"}
                        </button>
                        <button
                            onClick={handleDownload}
                            className="bg-slate-800/80 hover:bg-slate-700 backdrop-blur-md text-slate-300 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-xl border border-slate-700 transition-colors shadow-lg flex items-center gap-2"
                        >
                            <Download size={14} /> Log
                        </button>
                    </div>
                    <div className="p-6 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent bg-[#09090b]">
                        <pre className="font-mono text-[13px] leading-relaxed text-slate-300 whitespace-pre-wrap">
                            {output || "No raw output available."}
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
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-6 bg-[#0f172a] hover:bg-[#1e293b] transition-colors focus:outline-none border-b border-slate-800"
                aria-expanded={expanded}
            >
                <div className="flex items-center gap-3">
                    <Braces size={20} className="text-purple-400" />
                    <span className="text-lg font-bold text-slate-200">Parsed JSON</span>
                    <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[10px] font-bold uppercase tracking-widest">
                        Developer Mode
                    </span>
                </div>
                {expanded ? <ChevronDown size={22} className="text-slate-500" /> : <ChevronRight size={22} className="text-slate-500" />}
            </button>

            {expanded && (
                <div className="relative">
                    <div className="absolute top-4 right-4 z-10">
                        <button
                            onClick={handleCopy}
                            className="bg-slate-800/80 hover:bg-slate-700 backdrop-blur-md text-slate-300 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-xl border border-slate-700 transition-colors shadow-lg"
                        >
                            {copied ? "Copied!" : "Copy"}
                        </button>
                    </div>
                    <div className="p-6 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent bg-[#09090b]">
                        <pre className="font-mono text-[12px] leading-relaxed text-cyan-200/90 whitespace-pre-wrap">{json}</pre>
                    </div>
                </div>
            )}
        </div>
    );
}
