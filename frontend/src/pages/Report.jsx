import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ShieldAlert, AlertCircle, Database, Server } from "lucide-react";
import { getScanReport } from "../services/api";

import {
    TopBar,
    AssessmentHero,
    SummaryCard,
    RiskMetric,
    FindingCard,
    EvidenceSection,
    TimelineEvent,
    RecommendationCard,
    MetadataPanel,
    TerminalViewer
} from "../components/report/ReportComponents";

export default function Report() {
    const { id } = useParams();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchReport() {
            try {
                setLoading(true);
                const data = await getScanReport(id);
                setReport(data);
            } catch (err) {
                console.error("Failed to load report:", err);
                setError(err.message || "Failed to load report");
            } finally {
                setLoading(false);
            }
        }
        
        if (id) {
            fetchReport();
        }
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-4 text-slate-500">
                    <div className="w-8 h-8 border-4 border-slate-700 border-t-purple-500 rounded-full animate-spin"></div>
                    <p className="font-medium animate-pulse">Loading Assessment Data...</p>
                </div>
            </div>
        );
    }

    if (error || !report) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md text-center">
                    <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Assessment Not Found</h3>
                    <p className="text-slate-400">{error || "The requested assessment report could not be loaded."}</p>
                </div>
            </div>
        );
    }

    const data = report.report || {};
    
    const summary = data.summary || null;
    const findings = data.findings || {};
    const timeline = data.timeline || [];
    const recommendations = data.recommendations || [];
    const metadata = data.metadata || {};
    const rawOutput = data.raw_output || report.findings || "";

    const wafStatus = findings.waf || "Not Detected";
    const injectionStatus = findings.injectable ? "Vulnerable" : "Secure";
    const dbmsDetected = findings.dbms || "Unknown";
    const httpErrors = findings.http_errors || "0";

    const keyFindings = [];
    
    if (Array.isArray(findings.critical)) {
        findings.critical.forEach(crit => {
            keyFindings.push({
                title: typeof crit === 'string' ? "Critical Vulnerability" : (crit.title || "Critical Vulnerability"),
                description: typeof crit === 'string' ? crit : (crit.description || ""),
                severity: "CRITICAL",
                evidence: typeof crit !== 'string' ? crit.evidence : undefined
            });
        });
    }

    if (Array.isArray(findings.warnings)) {
        findings.warnings.forEach(warn => {
            keyFindings.push({
                title: typeof warn === 'string' ? "Warning" : (warn.title || "Warning"),
                description: typeof warn === 'string' ? warn : (warn.description || ""),
                severity: "HIGH",
                evidence: typeof warn !== 'string' ? warn.evidence : undefined
            });
        });
    }

    return (
        <div className="max-w-[1600px] mx-auto pb-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Top Bar Navigation */}
            <TopBar scanResponse={report} />

            {/* Assessment Hero */}
            <AssessmentHero scanResponse={report} summary={summary} />

            <div className="space-y-8">
                {/* Executive Summary */}
                <section aria-label="Executive Summary">
                    <SummaryCard summary={summary} />
                </section>

                {/* Risk Overview */}
                <section aria-label="Risk Overview">
                    <h3 className="text-xl font-bold text-white mb-6">Risk Overview</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        <RiskMetric label="WAF Status" value={wafStatus} icon={ShieldAlert} colorClass="text-amber-400 border-amber-500/20" />
                        <RiskMetric label="Injections" value={injectionStatus} icon={AlertCircle} colorClass="text-red-400 border-red-500/20" />
                        <RiskMetric label="Target DBMS" value={dbmsDetected} icon={Database} colorClass="text-cyan-400 border-cyan-500/20" />
                        <RiskMetric label="HTTP Errors" value={httpErrors} icon={Server} colorClass="text-purple-400 border-purple-500/20" />
                    </div>
                </section>

                {/* Key Findings */}
                <section aria-labelledby="key-findings-title">
                    <h3 id="key-findings-title" className="text-xl font-bold text-white mb-6">Key Findings</h3>
                    {keyFindings.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {keyFindings.map((finding, idx) => (
                                <FindingCard key={idx} finding={finding} />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-8 text-center shadow-inner">
                            <ShieldCheck size={48} className="mx-auto text-emerald-500/50 mb-4" />
                            <h4 className="text-lg font-bold text-slate-300 mb-2">No Critical Findings</h4>
                            <p className="text-slate-500">The scanner did not report any high-severity warnings or critical vulnerabilities.</p>
                        </div>
                    )}
                </section>

                {/* Analyst Evidence */}
                <section aria-label="Analyst Evidence">
                    <EvidenceSection findings={findings} />
                </section>

                {/* Execution Timeline */}
                <section aria-labelledby="timeline-title">
                    <h3 id="timeline-title" className="text-xl font-bold text-white mb-6">Execution Timeline</h3>
                    <div className="bg-slate-900/30 border border-slate-800/60 rounded-2xl p-8 pt-10 shadow-lg">
                        {timeline.length > 0 ? (
                            timeline.map((event, idx) => (
                                <TimelineEvent key={idx} event={event} isLast={idx === timeline.length - 1} />
                            ))
                        ) : (
                            <div className="text-center py-6">
                                <Clock size={32} className="mx-auto text-slate-600 mb-3" />
                                <p className="text-slate-500">Timeline data is not available for this assessment.</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Recommendations */}
                <section aria-labelledby="recommendations-title">
                    <h3 id="recommendations-title" className="text-xl font-bold text-white mb-6">Recommendations</h3>
                    {recommendations.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {recommendations.map((rec, idx) => (
                                <RecommendationCard key={idx} recommendation={rec} />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-8 text-slate-500 text-center shadow-inner">
                            No specific recommendations were provided for this run.
                        </div>
                    )}
                </section>

                {/* Scanner Metadata */}
                <section aria-label="Scanner Metadata">
                    <MetadataPanel scanResponse={report} metadata={metadata} />
                </section>

                {/* Raw Output */}
                <section aria-label="Raw Scanner Output">
                    <TerminalViewer output={rawOutput} />
                </section>
                
            </div>
        </div>
    );
}
