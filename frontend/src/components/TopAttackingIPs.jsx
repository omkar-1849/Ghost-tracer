import { useEffect, useState } from "react";
import { getTopAttackingIPs } from "../services/api";

/**
 * TopAttackingIPs — presentational body only.
 * Data fetching / polling logic is unchanged.
 */
function TopAttackingIPs() {
    const [ips, setIps] = useState([]);

    useEffect(() => {
        async function loadIPs() {
            try {
                const data = await getTopAttackingIPs();
                setIps(data);
            } catch (error) {
                console.error(error);
            }
        }

        loadIPs();

        const interval = setInterval(loadIPs, 5000);

        return () => clearInterval(interval);
    }, []);

    if (ips.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-700/60 bg-slate-950/30 px-6 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10">
                    <svg
                        className="h-5 w-5 text-cyan-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                        <path d="M2 12h20" />
                    </svg>
                </span>
                <p className="text-sm font-medium text-slate-300">
                    No attacker activity yet
                </p>
                <p className="max-w-xs text-xs text-slate-500">
                    Source IPs will appear here as soon as the monitoring
                    engine records an attack.
                </p>
            </div>
        );
    }

    const max = Math.max(1, ...ips.map((ip) => Number(ip.attack_count) || 0));

    return (
        <div className="flex flex-1 flex-col gap-2.5">
            {ips.map((ip, index) => {
                const count = Number(ip.attack_count) || 0;
                const pct = Math.round((count / max) * 100);

                return (
                    <div
                        key={index}
                        className="group/row flex items-center gap-3.5 rounded-xl border border-slate-800/50 bg-slate-800/25 px-3.5 py-2.5 transition-all duration-300 hover:border-cyan-400/25 hover:bg-slate-800/45"
                    >
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/70 font-mono text-[11px] font-bold text-slate-400">
                            {String(index + 1).padStart(2, "0")}
                        </span>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                                <span className="truncate font-mono text-[13px] font-medium text-cyan-300">
                                    {ip.ip_address}
                                </span>
                                <span className="flex-shrink-0 text-xs font-bold tabular-nums text-red-400">
                                    {count}
                                    <span className="ml-1 font-medium text-slate-500">
                                        attacks
                                    </span>
                                </span>
                            </div>

                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800/80">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-cyan-400/80 to-blue-500/80 transition-all duration-700 ease-out group-hover/row:from-cyan-400 group-hover/row:to-blue-400"
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

export default TopAttackingIPs;
