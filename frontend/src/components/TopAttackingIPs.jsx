import { useEffect, useState } from "react";
import { getTopAttackingIPs } from "../services/api";

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
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-1)] px-6 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--color-info)]/20 bg-[var(--color-info)]/10">
                    <svg
                        className="h-5 w-5 text-[var(--color-info)]"
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
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    No attacker activity yet
                </p>
                <p className="max-w-xs text-xs text-[var(--color-text-muted)]">
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
                        className="group/row flex items-center gap-3.5 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-3.5 py-2.5 transition-all duration-300 hover:border-[var(--color-border-default)] hover:bg-[var(--color-surface-3)]"
                    >
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-2)] font-mono text-[11px] font-bold text-[var(--color-text-muted)] tabular-nums">
                            {String(index + 1).padStart(2, "0")}
                        </span>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                                <span className="truncate font-mono text-[13px] font-medium text-[var(--color-info)]">
                                    {ip.ip_address}
                                </span>
                                <span className="flex-shrink-0 text-xs font-bold tabular-nums text-[var(--color-critical)]">
                                    {count}
                                    <span className="ml-1 font-medium text-[var(--color-text-muted)]">
                                        attacks
                                    </span>
                                </span>
                            </div>

                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
                                <div
                                    className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-700 ease-out"
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
