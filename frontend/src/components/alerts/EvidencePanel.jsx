import { ChevronRight, FileCode2, Fingerprint, Link2 } from "lucide-react";

/**
 * EvidencePanel
 * -------------
 * Correlated evidence rows for the selected incident — log files tied to
 * the alert with lightweight hover interactions and a "view" affordance.
 */
function EvidencePanel({ incident }) {
    const rows = incident.evidence ?? [];

    return (
        <div className="space-y-2.5">
            {rows.map((evidence, index) => (
                <div
                    key={`${incident.id}-${evidence.name}`}
                    className="alerts-tl-node alerts-sheen group relative flex items-center gap-3.5 overflow-hidden rounded-xl border border-white/[0.07] bg-slate-950/30 px-4 py-3 transition-all duration-300 hover:translate-x-1 hover:border-cyan-400/25 hover:bg-slate-800/30"
                    style={{ animationDelay: `${index * 80}ms` }}
                >
                    {/* File icon */}
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-900/60 text-cyan-300 transition-transform duration-300 group-hover:scale-110">
                        <FileCode2 size={16} />
                    </span>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <p className="truncate font-mono text-[12px] font-semibold text-slate-100">
                                {evidence.name}
                            </p>
                            <span className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-slate-500 sm:inline-flex">
                                <Link2 size={9} className="text-slate-500" />
                                CORRELATED
                            </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                            {evidence.detail}
                        </p>
                    </div>

                    {/* View affordance */}
                    <span className="flex flex-shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold text-slate-400 transition-all duration-300 group-hover:border-cyan-400/40 group-hover:text-cyan-200">
                        View
                        <ChevronRight
                            size={11}
                            className="transition-transform duration-300 group-hover:translate-x-0.5"
                        />
                    </span>

                    {/* Fingerprint trail */}
                    <span className="pointer-events-none absolute right-14 top-2 hidden text-slate-700 opacity-0 transition-opacity duration-500 group-hover:opacity-100 md:block">
                        <Fingerprint size={10} />
                    </span>
                </div>
            ))}
        </div>
    );
}

export default EvidencePanel;
