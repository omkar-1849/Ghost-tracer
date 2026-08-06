import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, Bug, Layers, Server, ShieldAlert } from "lucide-react";
import { getScanById, getScanReport, engineTabId } from "../services/scannerApi";
import { EngineResults, RecommendationsList } from "../components/scanner/engineResults";

import {
    TopBar,
    AssessmentHero,
    SummaryCard,
    RiskMetric,
    SeverityDistribution,
    MetadataPanel,
    TerminalViewer,
    ParsedJsonViewer,
} from "../components/report/ReportComponents";

export default function Report() {
    const { id } = useParams();
    const [scan, setScan] = useState(null);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchReport() {
            try {
                setLoading(true);
                const [scanData, reportData] = await Promise.all([
                    getScanById(id),
                    getScanReport(id),
                ]);
                setScan(scanData);
                setReport(reportData);
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

    if (error || !scan || !report) {
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

    const parsed = report.report || {};
    const engineId = engineTabId(scan.engine);
    const recommendations = parsed.recommendations || [];
    const rawOutput = scan.raw_output || parsed.raw_output || "";

    const isFailed = (scan.status || "").toUpperCase() === "FAILED";

    return (
        <div className="max-w-[1600px] mx-auto pb-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Top Bar Navigation */}
            <TopBar scan={scan} />

            {/* Assessment Hero */}
            <AssessmentHero scan={scan} report={parsed} />

            <div className="space-y-8">
                {/* Executive Summary */}
                <section aria-label="Executive Summary">
                    <SummaryCard scan={scan} report={parsed} />
                </section>

                {/* Risk Overview */}
                <section aria-label="Risk Overview">
                    <h3 className="text-xl font-bold text-white mb-6">Risk Overview</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        <RiskMetric label="Risk Score" value={scan.risk_score ?? "N/A"} icon={ShieldAlert} colorClass="text-amber-400 border-amber-500/20" />
                        <RiskMetric label="Findings" value={scan.findings ?? "N/A"} icon={Bug} colorClass="text-red-400 border-red-500/20" />
                        <RiskMetric label="Status" value={scan.status || "N/A"} icon={Layers} colorClass="text-cyan-400 border-cyan-500/20" />
                        <RiskMetric label="Target" value={scan.target || "N/A"} icon={Server} colorClass="text-purple-400 border-purple-500/20" />
                    </div>
                </section>

                {/* Severity Distribution */}
                <section aria-label="Severity Distribution">
                    <SeverityDistribution report={parsed} />
                </section>

                {/* Engine-Specific Results */}
                <section aria-labelledby="engine-results-title">
                    <h3 id="engine-results-title" className="text-xl font-bold text-white mb-6">
                        {scan.scanner} Findings
                    </h3>
                    {isFailed ? (
                        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-8 text-center shadow-inner">
                            <AlertCircle size={40} className="mx-auto text-slate-600 mb-4" />
                            <h4 className="text-lg font-bold text-slate-300 mb-2">No Results — Scan Failed</h4>
                            <p className="text-slate-500">The scanner did not produce a report for this run.</p>
                        </div>
                    ) : (
                        <EngineResults report={parsed} engineId={engineId} />
                    )}
                </section>

                {/* Recommendations */}
                {recommendations.length > 0 && (
                    <section aria-labelledby="recommendations-title">
                        <h3 id="recommendations-title" className="text-xl font-bold text-white mb-6">
                            Recommendations
                        </h3>
                        <RecommendationsList recommendations={recommendations} />
                    </section>
                )}

                {/* Scanner Metadata */}
                <section aria-label="Scanner Metadata">
                    <MetadataPanel scan={scan} />
                </section>

                {/* Raw Output */}
                <section aria-label="Raw Scanner Output">
                    <TerminalViewer output={rawOutput} />
                </section>

                {/* Parsed JSON (developer mode) */}
                <section aria-label="Parsed JSON">
                    <ParsedJsonViewer report={parsed} />
                </section>
            </div>
        </div>
    );
}
