import { useState } from "react";
import { Check, Copy, FileText, Globe, Loader2, X, Clock } from "lucide-react";
import { formatDuration, formatDate, StatusPill, ACTIVE_STATUSES } from "./shared";

export default function ReportViewerModal({ report, onClose }) {
    const [copied, setCopied] = useState(false);

    if (!report) return null;

    async function copyFindings() {
        if (!report?.findings) return;
        try {
            await navigator.clipboard.writeText(report.findings);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (error) {
            console.error(error);
        }
    }

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-slate-900/95 backdrop-blur-xl border border-slate-800/70 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl shadow-black/60"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/95 backdrop-blur-xl">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/25 to-fuchsia-600/10 flex items-center justify-center shadow-[0_0_16px_rgba(168,85,247,0.3)]">
                            <FileText size={20} className="text-purple-300" />
                        </span>
                        <div>
                            <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-300 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                                Scan Report
                            </h3>
                            <p className="text-slate-500 text-xs mt-0.5">
                                #{report.id} · {report.scanner}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-slate-800 hover:bg-slate-700 hover:shadow-[0_0_12px_rgba(168,85,247,0.3)] rounded-lg p-2 transition-all duration-200 hover:scale-105"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    <div>
                        <p className="text-slate-500 text-sm mb-1 flex items-center gap-1.5">
                            <Globe size={13} /> Target
                        </p>
                        <p className="text-white font-medium break-words" title={report.target}>
                            {report.target}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <p className="text-slate-500 text-sm mb-1">Status</p>
                            <StatusPill status={report.status} />
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm mb-1">Duration</p>
                            <p className="text-white flex items-center gap-1.5">
                                <Clock size={14} className="text-cyan-400/80" />
                                {formatDuration(report.created_at, report.completed_at)}
                            </p>
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm mb-1">Created At</p>
                            <p className="text-white">{formatDate(report.created_at)}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm mb-1">Completed At</p>
                            <p className="text-white">{formatDate(report.completed_at)}</p>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-slate-500 text-sm">Findings</p>
                            <div className="flex items-center gap-3">
                                {ACTIVE_STATUSES.has((report.status || "").toUpperCase()) && (
                                    <span className="flex items-center gap-1.5 text-xs text-cyan-300">
                                        <Loader2 size={12} className="animate-spin" /> Auto-refreshing
                                    </span>
                                )}
                                <button
                                    onClick={copyFindings}
                                    disabled={!report.findings}
                                    className="bg-slate-800/60 hover:bg-slate-700 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-all duration-200 disabled:opacity-40"
                                >
                                    {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                                    {copied ? "Copied" : "Copy"}
                                </button>
                            </div>
                        </div>
                        <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-sm text-slate-300 whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                            {report.findings || "No findings recorded."}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
}
