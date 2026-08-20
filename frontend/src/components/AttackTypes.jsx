import { useEffect, useState } from "react";
import { getAttackTypes } from "../services/api";

/**
 * AttackTypes — presentational body only.
 * Data fetching / polling logic is unchanged.
 */

/* Presentational severity mapping derived from the attack family name. */
const SEVERITY_BY_NAME = [
    { match: /sql/i, dot: "bg-[var(--color-critical)]", text: "text-[var(--color-critical)]", bar: "bg-[var(--color-critical)]" },
    { match: /xss|script|inject/i, dot: "bg-[var(--color-high)]", text: "text-[var(--color-high)]", bar: "bg-[var(--color-high)]" },
    { match: /brute|credential|password/i, dot: "bg-[var(--color-medium)]", text: "text-[var(--color-medium)]", bar: "bg-[var(--color-medium)]" },
    { match: /ddos|dos|flood|volumetric/i, dot: "bg-[var(--color-accent)]", text: "text-[var(--color-accent)]", bar: "bg-[var(--color-accent)]" },
    { match: /port|scan|probe/i, dot: "bg-[var(--color-accent)]", text: "text-[var(--color-accent)]", bar: "bg-[var(--color-accent)]" },
    { match: /rce|remote|exec/i, dot: "bg-[var(--color-critical)]", text: "text-[var(--color-critical)]", bar: "bg-[var(--color-critical)]" },
];

function severityFor(name) {
    return (
        SEVERITY_BY_NAME.find((s) => s.match.test(String(name))) ?? {
            dot: "bg-[var(--color-accent)]",
            text: "text-[var(--color-accent)]",
            bar: "bg-[var(--color-accent)]",
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
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-6 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-2)]">
                    <svg
                        className="h-5 w-5 text-[var(--color-text-muted)]"
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
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    No attack signatures yet
                </p>
                <p className="max-w-xs text-xs text-[var(--color-text-muted)]">
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
                        className="group/row flex items-center gap-3.5 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-2)] px-3.5 py-2.5 transition-all duration-300 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-3)]"
                    >
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-3)] font-mono text-[11px] font-bold tabular-nums text-[var(--color-text-muted)]">
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
                                <span className="flex-shrink-0 text-xs font-bold tabular-nums text-[var(--color-text-primary)]">
                                    {count}
                                    <span className="ml-1 font-medium text-[var(--color-text-muted)]">
                                        events
                                    </span>
                                </span>
                            </div>

                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ease-out ${severity.bar}`}
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
