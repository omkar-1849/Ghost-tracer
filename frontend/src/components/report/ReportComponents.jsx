import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
    AlertTriangle, Shield, ShieldAlert, ShieldCheck, Clock, Terminal, 
    ChevronDown, ChevronRight, CheckCircle2, XCircle, Info, Activity,
    Server, Globe, Database, Bug, FileWarning, ArrowLeft, Download,
    Printer, ExternalLink, Zap
} from "lucide-react";
import { formatDuration, formatDate, StatusPill } from "../scanner/shared";

// Top Navigation Bar
export function TopBar({ scanResponse }) {
    const navigate = useNavigate();

    const handleBack = () => {
        if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
        } else {
            navigate("/scanner");
        }
    };

    const handleExportJSON = () => {
        if (!scanResponse) return;
        const dataStr = JSON.stringify(scanResponse, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `scan-report-${scanResponse.id}.json`;
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
                    <span className="text-white">Assessment #{scanResponse?.id}</span>
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

// 1. Assessment Hero
export function AssessmentHero({ scanResponse, summary }) {
    const risk = summary?.risk || "UNKNOWN";
    const isHighRisk = risk.toUpperCase() === "HIGH" || risk.toUpperCase() === "CRITICAL";
    const riskColor = isHighRisk ? "text-red-400" : "text-emerald-400";
    
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
                            <Activity size={14} /> {summary?.engine || scanResponse.scanner} Assessment
                        </span>
                        <StatusPill status={summary?.status || scanResponse.status} />
                    </div>
                    
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 break-words leading-tight">
                        {summary?.target || scanResponse.target}
                    </h1>
                    
                    <div className="flex flex-wrap items-center gap-6 text-sm text-slate-400 mt-6">
                        <span className="flex items-center gap-2 bg-slate-950/50 px-3 py-1.5 rounded-lg border border-slate-800/50">
                            <Clock size={16} className="text-cyan-400" />
                            {summary?.duration || formatDuration(scanResponse.created_at, scanResponse.completed_at || Date.now())}
                        </span>
                        <span className="flex items-center gap-2 bg-slate-950/50 px-3 py-1.5 rounded-lg border border-slate-800/50">
                            <Zap size={16} className="text-purple-400" />
                            ID: #{scanResponse.id}
                        </span>
                        <span className="flex items-center gap-2 bg-slate-950/50 px-3 py-1.5 rounded-lg border border-slate-800/50">
                            <Globe size={16} className="text-emerald-400" />
                            Target Scanned
                        </span>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-3xl p-8 min-w-[240px] shadow-xl">
                    <span className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-3">
                        Overall Risk
                    </span>
                    <div className={`text-5xl font-bold flex flex-col items-center gap-3 ${riskColor}`}>
                        {isHighRisk ? <ShieldAlert size={48} className="drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" /> : <ShieldCheck size={48} className="drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]" />}
                        <span className="drop-shadow-lg">{risk}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// 2. Summary Card
export function SummaryCard({ summary }) {
    if (!summary) {
        return (
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-8 text-center text-slate-500 shadow-lg shadow-black/20">
                <FileWarning size={32} className="mx-auto mb-3 opacity-50" />
                <p>No executive summary available for this scan.</p>
            </div>
        );
    }
    
    const isHighRisk = summary.risk?.toUpperCase() === "HIGH" || summary.risk?.toUpperCase() === "CRITICAL";

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
                    A comprehensive security assessment was conducted targeting <strong className="text-white">{summary.target}</strong> using the <strong className="text-white">{summary.engine}</strong> engine. 
                    The scan was completed successfully in <strong className="text-white">{summary.duration}</strong>.
                </p>
                <p>
                    The overall risk for this target has been determined as <strong className={isHighRisk ? "text-red-400" : "text-emerald-400"}>{summary.risk}</strong>. 
                    {isHighRisk 
                        ? " Immediate remediation is strongly advised for the critical vulnerabilities discovered during the execution phase."
                        : " No critical exploits were successfully executed against the target infrastructure."
                    }
                </p>
                <p className="text-slate-400 text-sm mt-2 italic">
                    This report contains automated findings. Analysts should verify high-severity indicators of compromise and review raw output if necessary.
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

// 4. Finding Card
export function FindingCard({ finding }) {
    const isCritical = finding.severity === "CRITICAL" || finding.severity === "HIGH";
    
    return (
        <div className="group relative bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 hover:bg-slate-800/40 transition-colors shadow-lg shadow-black/20 overflow-hidden">
            {isCritical && (
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-red-500 to-rose-600 shadow-[0_0_15px_rgba(239,68,68,0.6)]" />
            )}
            {!isCritical && (
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-500 to-yellow-600" />
            )}
            
            <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                        isCritical ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                    }`}>
                        <Bug size={24} />
                    </div>
                    <div>
                        <h4 className="text-xl font-bold text-white mb-1">{finding.title}</h4>
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${
                            isCritical ? "bg-red-500/10 text-red-400 border-red-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        }`}>
                            {finding.severity}
                        </span>
                    </div>
                </div>
            </div>
            
            <div className="pl-[64px]">
                <p className="text-sm text-slate-300 leading-relaxed mb-4">{finding.description}</p>
                
                {finding.evidence && (
                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 shadow-inner">
                        <span className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-3 block flex items-center gap-2">
                            <Terminal size={14} /> Evidence Artifact
                        </span>
                        <code className="text-sm text-cyan-300 font-mono break-words whitespace-pre-wrap">{finding.evidence}</code>
                    </div>
                )}
            </div>
        </div>
    );
}

// 5. Evidence Section (Analyst Evidence)
export function EvidenceSection({ findings }) {
    if (!findings) return null;

    const renderBadge = (label, value) => {
        if (!value) return null;
        return (
            <div className="flex items-center justify-between bg-slate-950/50 border border-slate-800/80 rounded-xl p-4">
                <span className="text-sm font-semibold text-slate-400">{label}</span>
                <span className="text-sm font-mono text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-lg border border-cyan-500/20">
                    {Array.isArray(value) ? value.length : value}
                </span>
            </div>
        );
    };

    const renderArray = (label, arr) => {
        if (!arr || !arr.length) return null;
        return (
            <div className="mt-4">
                <span className="text-sm font-semibold text-slate-400 block mb-2">{label}</span>
                <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4 max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                    <ul className="list-disc list-inside text-sm font-mono text-slate-300 space-y-1">
                        {arr.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-8 shadow-lg shadow-black/40">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                    <Database size={20} className="text-cyan-400" />
                </span>
                Analyst Evidence
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {renderBadge("Parameters Tested", findings.parameters_tested)}
                {renderBadge("WAF Detected", findings.waf)}
                {renderBadge("DBMS Identified", findings.dbms)}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
                {renderArray("Databases Enumerated", findings.databases)}
                {renderArray("Tables Discovered", findings.tables)}
            </div>
        </div>
    );
}

// 6. Timeline Event
export function TimelineEvent({ event, isLast }) {
    if (!event || !event.message) return null;

    const level = (event.level || "INFO").toUpperCase();
    
    const getIcon = () => {
        switch(level) {
            case "CRITICAL":
            case "ERROR": return <XCircle size={16} className="text-red-500" />;
            case "WARNING": return <AlertTriangle size={16} className="text-amber-500" />;
            case "INFO": return <Info size={16} className="text-cyan-500" />;
            default: return <CheckCircle2 size={16} className="text-emerald-500" />;
        }
    };

    return (
        <div className="relative pl-10 pb-8">
            {!isLast && (
                <div className="absolute left-[19px] top-6 bottom-0 w-0.5 bg-slate-800/80" />
            )}
            <div className="absolute left-0 top-1 w-10 h-10 rounded-full bg-slate-950 border-2 border-slate-800 flex items-center justify-center z-10 shadow-lg shadow-black/40">
                {getIcon()}
            </div>
            
            <div className="bg-slate-950/40 border border-slate-800/50 rounded-xl p-5 ml-4 hover:bg-slate-900/60 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded-md border border-slate-800/60">
                        {event.time || "N/A"}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${
                        level === "CRITICAL" || level === "ERROR" ? "text-red-400" :
                        level === "WARNING" ? "text-amber-400" :
                        "text-cyan-400"
                    }`}>
                        {level}
                    </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{event.message}</p>
            </div>
        </div>
    );
}

// 7. Recommendation Card
export function RecommendationCard({ recommendation }) {
    if (!recommendation) return null;
    return (
        <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-6 flex items-start gap-5 hover:bg-emerald-950/40 transition-colors shadow-lg shadow-black/20">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0 shadow-inner">
                <CheckCircle2 size={24} className="text-emerald-400" />
            </div>
            <div>
                <h4 className="text-base font-bold text-emerald-300 mb-2">Recommended Action</h4>
                <p className="text-sm text-slate-300 leading-relaxed">{recommendation}</p>
            </div>
        </div>
    );
}

// 8. Metadata Panel
export function MetadataPanel({ scanResponse, metadata }) {
    const [expanded, setExpanded] = useState(false);

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
                            <p className="text-sm text-white font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 inline-block">{scanResponse.scanner}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Version</p>
                            <p className="text-sm text-white font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 inline-block">{metadata?.sqlmap_version || "N/A"}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Started</p>
                            <p className="text-sm text-white font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 inline-block">{formatDate(scanResponse.created_at)}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Completed</p>
                            <p className="text-sm text-white font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 inline-block">{scanResponse.completed_at ? formatDate(scanResponse.completed_at) : "In Progress"}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Exit Status</p>
                            <p className="text-sm text-white font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 inline-block">{metadata?.exit_status ?? "N/A"}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Duration</p>
                            <p className="text-sm text-white font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 inline-block">{formatDuration(scanResponse.created_at, scanResponse.completed_at || Date.now())}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// 9. Terminal Viewer
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
                        <button className="bg-slate-800/80 hover:bg-slate-700 backdrop-blur-md text-slate-300 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-xl border border-slate-700 transition-colors shadow-lg flex items-center gap-2">
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
