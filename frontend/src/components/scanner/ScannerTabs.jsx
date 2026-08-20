import { SCANNER_ENGINES } from "./constants";
import { Radar, Scan, Shield } from "lucide-react";

export default function ScannerTabs({ activeTab, onTabChange }) {
    return (
        <div className="flex items-center gap-1.5 mb-6 border-b border-[var(--color-border-default)] pb-2 overflow-x-auto scrollbar-none">
            {SCANNER_ENGINES.map((engine) => {
                const isActive = activeTab === engine.id;

                return (
                    <button
                        key={engine.id}
                        type="button"
                        onClick={() => onTabChange(engine.id)}
                        className={`px-3 py-2 rounded-md flex items-center gap-2 text-xs font-medium transition-colors duration-150 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
                            isActive
                                ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border border-[var(--color-accent)]"
                                : "text-[var(--color-text-muted)] bg-transparent border border-transparent hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-subtle)]"
                        }`}
                    >
                        {!engine.isEngine ? (
                            <Radar
                                size={15}
                                className={isActive ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"}
                            />
                        ) : engine.status === "Ready" ? (
                            <Scan
                                size={15}
                                className={isActive ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"}
                            />
                        ) : (
                            <Shield
                                size={15}
                                className={isActive ? "text-[var(--color-accent)]" : "text-[var(--color-text-disabled)]"}
                            />
                        )}

                        <span>{engine.name}</span>

                        {engine.status !== "Ready" && !isActive && (
                            <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[var(--color-surface-3)] text-[var(--color-text-disabled)] uppercase tracking-wider">
                                {engine.status === "Coming Soon" ? "Soon" : "Plan"}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
