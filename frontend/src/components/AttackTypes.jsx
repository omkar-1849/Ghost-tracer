import { useEffect, useState } from "react";
import { getAttackTypes } from "../services/api";

/**
 * AttackTypes — presentational body only.
 * Data fetching / polling logic is unchanged.
 */

/* Presentational severity mapping derived from the attack family name. */
const SEVERITY_BY_NAME = [
    { match: /sql/i, dot: "bg-red-500", text: "text-red-300", bar: "from-red-500/80 to-rose-500/80" },
    { match: /xss|script|inject/i, dot: "bg-orange-400", text: "text-orange-300", bar: "from-orange-400/80 to-amber-500/80" },
    { match: /brute|credential|password/i, dot: "bg-amber-400", text: "text-amber-300", bar: "from-amber-400/80 to-yellow-500/80" },
    { match: /ddos|dos|flood|volumetric/i, dot: "bg-purple-400", text: "text-purple-300", bar: "from-purple-400/80 to-fuchsia-500/80" },
    { match: /port|scan|probe/i, dot: "bg-blue-400", text: "text-blue-300", bar: "from-blue-400/80 to-cyan-500/80" },
    { match: /rce|remote|exec/i, dot: "bg-rose-400", text: "text-rose-300", bar: "from-rose-400/80 to-red-500/80" },
];

function severityFor(name) {
    return (
        SEVERITY_BY_NAME.find((s) => s.match.test(String(name))) ?? {
            dot: "bg-cyan-400",
            text: "text-cyan-300",
            bar: "from-cyan-400/80 to-blue-500/80",
        }
    );
}

function AttackTypes() {
    const [attacks, setAttacks] = useState([]);

    useEffect(() => {
        async function loadAttackTypes() {
            try {
                const data = await getAttackTypes();
                setAttacks(data);
            } catch (error) {
                console.error(error);
            }
        }

        loadAttackTypes();

        const interval = setInterval(loadAttackTypes, 5000);

        return () => clearInterval(interval);
    }, []);

    if (attacks.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-700/60 bg-slate-950/30 px-6 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10">
                    <svg
                        className="h-5 w-5 text-violet-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M12 5v14" />
                        <path d="M5 12h14" />
                        <path d="m19 5-14 14" />
                        <path d="m5 5 14 14" />
                    </svg>
                </span>
                <p className="text-sm font-medium text-slate-300">
                    No attack signatures yet
                </p>
                <p className="max-w-xs text-xs text-slate-500">
                    Classified attack families will be listed here once the
                    detection engine tags its first event.
                </p>
            </div>
        );
    }

    const max = Math.max(1, ...attacks.map((a) => Number(a.count) || 0));

    return (
        <div className="flex flex-1 flex-col gap-2.5">
            {attacks.map((attack, index) => {
                const count = Number(attack.count) || 0;
                const pct = Math.round((count / max) * 100);
                const severity = severityFor(attack.attack);

                return (
                    <div
                        key={index}
                        className="group/row flex items-center gap-3.5 rounded-xl border border-slate-800/50 bg-slate-800/25 px-3.5 py-2.5 transition-all duration-300 hover:border-violet-400/25 hover:bg-slate-800/45"
                    >
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/70 font-mono text-[11px] font-bold text-slate-400">
                            {String(index + 1).padStart(2, "0")}
                        </span>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                                <span className="flex min-w-0 items-center gap-2">
                                    <span
                                        className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${severity.dot}`}
                                    />
                                    <span
                                        className={`truncate text-[13px] font-semibold ${severity.text}`}
                                    >
                                        {attack.attack}
                                    </span>
                                </span>
                                <span className="flex-shrink-0 text-xs font-bold tabular-nums text-slate-300">
                                    {count}
                                    <span className="ml-1 font-medium text-slate-500">
                                        events
                                    </span>
                                </span>
                            </div>

                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800/80">
                                <div
                                    className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out ${severity.bar}`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default AttackTypes;
