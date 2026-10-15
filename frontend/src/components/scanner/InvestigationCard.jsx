import { useState, useEffect } from "react";
import {
    AlertTriangle,
    BrainCircuit,
    CheckCircle2,
    Clock,
    FileText,
    HelpCircle,
    Info,
    Loader2,
    RefreshCw,
    ShieldAlert,
    Sparkles,
} from "lucide-react";
import { getScanInvestigation, triggerScanInvestigation } from "../../services/scannerApi";

export default function InvestigationCard({ scanId }) {
    const [investigation, setInvestigation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [retriggering, setRetriggering] = useState(false);
    const [error, setError] = useState(null);

    const fetchInvestigation = async () => {
        try {
            setError(null);
            const data = await getScanInvestigation(scanId);
            setInvestigation(data);
        } catch (err) {
            // If 404, no investigation yet exists
            if (err.message && err.message.includes("404")) {
                setInvestigation(null);
            } else {
                setError(err.message || "Failed to load investigation");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!scanId) return;
        fetchInvestigation();

        // Poll every 3 seconds if investigation is pending or processing
        const interval = setInterval(() => {
            if (investigation && (investigation.status === "PENDING" || investigation.status === "PROCESSING")) {
                fetchInvestigation();
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [scanId, investigation?.status]);

    const handleRetrigger = async () => {
        try {
            setRetriggering(true);
            const updated = await triggerScanInvestigation(scanId);
            setInvestigation(updated);
        } catch (err) {
            setError(err.message || "Failed to trigger analysis");
        } finally {
            setRetriggering(false);
        }
    };

    if (loading) {
        return (
            <div className="sentinel-glass p-6 rounded-2xl flex items-center justify-center gap-3 text-xs text-[var(--color-text-muted)]">
                <Loader2 size={16} className="animate-spin text-[var(--color-signal)]" />
                <span>Loading AI Investigation...</span>
            </div>
        );
    }

    if (!investigation) {
        return (
            <div className="sentinel-glass p-6 rounded-2xl border border-[var(--color-border-default)]">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[rgba(211,160,106,0.12)] border border-[rgba(211,160,106,0.25)] flex items-center justify-center">
                            <BrainCircuit size={20} className="text-[var(--color-signal)]" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">AI Investigation & Correlation</h3>
                            <p className="text-xs text-[var(--color-text-muted)]">No automated investigation has been performed for this scan yet.</p>
                        </div>
                    </div>
                    <button
                        onClick={handleRetrigger}
                        disabled={retriggering}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#D3A06A] to-[#E3B985] text-[#0D0C0A] hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                        {retriggering ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        Analyze with Sentinel AI
                    </button>
                </div>
            </div>
        );
    }

    const report = investigation.report || {};
    const isAnalyzing = investigation.status === "PENDING" || investigation.status === "PROCESSING";
    const isCompleted = investigation.status === "COMPLETED";
    const isFallback = investigation.generated_by === "deterministic_fallback";

    return (
        <div className="sentinel-glass p-6 rounded-2xl border border-[var(--color-border-default)] space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--color-border-default)]">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[rgba(211,160,106,0.12)] border border-[rgba(211,160,106,0.25)] flex items-center justify-center">
                        <BrainCircuit size={20} className="text-[var(--color-signal)]" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                                {investigation.title || "AI Scanner Investigation"}
                            </h3>
                            {/* Status Chip */}
                            <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                                    isAnalyzing
                                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                        : isCompleted
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                                }`}
                            >
                                {isAnalyzing && <Loader2 size={10} className="animate-spin" />}
                                {investigation.status}
                            </span>
                            {isFallback && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    Rule-based Summary
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            Provider: <span className="font-mono text-[var(--color-text-secondary)]">{investigation.generated_by || "GT-Beta"}</span>
                            {investigation.confidence != null && (
                                <> · Confidence: <span className="font-mono text-[var(--color-text-secondary)]">{Math.round(investigation.confidence * 100)}%</span></>
                            )}
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleRetrigger}
                    disabled={isAnalyzing || retriggering}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] transition-colors disabled:opacity-40"
                >
                    <RefreshCw size={13} className={retriggering || isAnalyzing ? "animate-spin" : ""} />
                    Re-analyze
                </button>
            </div>

            {/* Analysis in Progress banner */}
            {isAnalyzing && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
                    <Loader2 size={18} className="animate-spin text-amber-400 shrink-0" />
                    <div>
                        <p className="text-xs font-semibold text-amber-300">Analysis In Progress</p>
                        <p className="text-xs text-amber-400/80">The Sentinel AI analyst is synthesizing evidence, verifying findings, and correlating threat vectors.</p>
                    </div>
                </div>
            )}

            {/* Executive Summary */}
            {investigation.summary && (
                <div className="space-y-1.5">
                    <h4 className="text-[11px] font-semibold text-[var(--color-signal)] uppercase tracking-wider">Executive Synthesis</h4>
                    <p className="text-xs text-[var(--color-text-primary)] leading-relaxed bg-[var(--color-surface-1)] p-4 rounded-xl border border-[var(--color-border-default)]">
                        {investigation.summary}
                    </p>
                </div>
            )}

            {/* Prioritized Findings & Hypotheses */}
            {report.prioritized_findings && report.prioritized_findings.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-[11px] font-semibold text-[var(--color-signal)] uppercase tracking-wider">Prioritized Findings</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {report.prioritized_findings.map((item, idx) => (
                            <div key={idx} className="p-3.5 rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border-default)] space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate">{item.title}</span>
                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                        item.severity === "critical" || item.severity === "high"
                                            ? "bg-red-500/15 text-red-400"
                                            : "bg-amber-500/15 text-amber-400"
                                    }`}>
                                        {item.severity}
                                    </span>
                                </div>
                                {item.why_it_matters && (
                                    <p className="text-[11px] text-[var(--color-text-muted)] leading-normal">{item.why_it_matters}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Hypotheses vs Limitations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.hypotheses && report.hypotheses.length > 0 && (
                    <div className="p-4 rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border-default)] space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-primary)]">
                            <HelpCircle size={14} className="text-amber-400" />
                            Hypotheses to Validate
                        </div>
                        <ul className="space-y-1.5 text-xs text-[var(--color-text-muted)] list-disc list-inside">
                            {report.hypotheses.map((h, i) => (
                                <li key={i}>{h}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {report.limitations && report.limitations.length > 0 && (
                    <div className="p-4 rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border-default)] space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-primary)]">
                            <Info size={14} className="text-blue-400" />
                            Assessment Scope Limitations
                        </div>
                        <ul className="space-y-1.5 text-xs text-[var(--color-text-muted)] list-disc list-inside">
                            {report.limitations.map((lim, i) => (
                                <li key={i}>{lim}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Recommended Actions */}
            {report.recommended_actions && report.recommended_actions.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-[11px] font-semibold text-[var(--color-signal)] uppercase tracking-wider">Recommended Actions</h4>
                    <div className="space-y-2">
                        {report.recommended_actions.map((act, i) => (
                            <div key={i} className="p-3 rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border-default)] flex items-start gap-3">
                                <CheckCircle2 size={15} className="text-[var(--color-signal)] shrink-0 mt-0.5" />
                                <div className="text-xs">
                                    <span className="font-semibold text-[var(--color-text-primary)]">{act.title || act.action}</span>
                                    {act.description && <p className="text-[var(--color-text-muted)] mt-0.5">{act.description}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
