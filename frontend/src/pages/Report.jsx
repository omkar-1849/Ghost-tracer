import { scanCompleteness } from "../services/evidence.js";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, Bug, Layers, Server, ShieldAlert, Loader2 } from "lucide-react";
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
import InvestigationCard from "../components/scanner/InvestigationCard";
import FindingsTable from "../components/scanner/FindingsTable";

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
                setError(null);
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
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-3 text-[var(--color-text-muted)]">
                    <Loader2 size={28} className="animate-spin text-[var(--color-text-secondary)]" />
                    <p className="text-xs font-medium">Loading Assessment Data…</p>
                </div>
            </div>
        );
    }

    if (error || !scan || !report) {
        return (
            <div className="p-6 max-w-[1440px]">
                <div className="bg-[var(--color-surface-2)] border border-[rgba(223,91,91,0.25)] rounded-lg p-8 max-w-md mx-auto text-center shadow-[var(--shadow-2)]">
                    <AlertCircle size={36} className="mx-auto text-[var(--color-critical)] mb-3" />
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">Assessment Not Found</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">{error || "The requested assessment report could not be loaded."}</p>
                </div>
            </div>
        );
    }

    const parsed = report.report || {};
    const engineId = engineTabId(scan.engine);
    const recommendations = parsed.recommendations || [];
    const rawOutput = scan.raw_output || parsed.raw_output || "";
    const completeness = scanCompleteness(scan);

    return (
        <div className="sentinel-page space-y-6 animate-fade-in select-none">
            {/* Top Bar Navigation */}
            <TopBar scan={scan} />

            {/* Assessment Hero */}
            <AssessmentHero scan={scan} report={parsed} />

            <div className="space-y-6">
                {/* AI Investigation & Synthesis */}
                <section aria-label="AI Investigation">
                    <InvestigationCard scanId={scan.id} />
                </section>

                {/* Executive Summary */}
                <section aria-label="Executive Summary">
                    <SummaryCard scan={scan} report={parsed} />
                </section>

                {/* Risk Overview */}
                <section aria-label="Risk Overview">
                    <h3 className="text-[11px] font-semibold text-[#D3A06A] uppercase tracking-wider mb-3">
                        Risk Overview
                    </h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <RiskMetric label="Risk Score" value={scan.risk_score != null ? `${scan.risk_score}/100` : "N/A"} icon={ShieldAlert} colorClass="text-[#FF8585]" />
                        <RiskMetric label="Findings" value={scan.findings ?? "N/A"} icon={Bug} colorClass="text-[#FF8585]" />
                        <RiskMetric label="Status" value={scan.status || "N/A"} icon={Layers} colorClass="text-[#D3A06A]" />
                        <RiskMetric label="Target" value={scan.target || "N/A"} icon={Server} colorClass="text-[#D6CFC7]" />
                    </div>
                </section>

                {/* Normalized Security Findings */}
                <section aria-label="Normalized Security Findings">
                    <h3 className="text-[11px] font-semibold text-[#D3A06A] uppercase tracking-wider mb-3">
                        Normalized Findings & Triage
                    </h3>
                    <FindingsTable scanId={scan.id} />
                </section>

                {/* Severity Distribution */}
                <section aria-label="Severity Distribution">
                    <SeverityDistribution report={parsed} />
                </section>

                {/* Engine-Specific Results */}
                <section aria-labelledby="engine-results-title">
                    <h3 id="engine-results-title" className="text-[11px] font-semibold text-[#D3A06A] uppercase tracking-wider mb-3">
                        {scan.scanner} Discovered Findings
                    </h3>
                    {!completeness.complete && <p role="status" className="mb-3 text-sm text-[#FF8585]">{completeness.label}. Available output is incomplete; absence of findings is not evidence of safety.</p>}
                    {Object.keys(parsed).length > 0 ? <EngineResults report={parsed} engineId={engineId} /> : <p className="text-xs text-[#9E948A]">No structured output is available.</p>}
                </section>

                {/* Recommendations */}
                {recommendations.length > 0 && (
                    <section aria-labelledby="recommendations-title">
                        <h3 id="recommendations-title" className="text-[11px] font-semibold text-[#D3A06A] uppercase tracking-wider mb-3">
                            Remediation Recommendations
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
