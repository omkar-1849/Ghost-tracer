import { SCANNER_ENGINES } from "./constants";
import { Radar, Scan, Shield } from "lucide-react";

/**
 * Engine selector — console-style tab strip.
 * The active engine is anchored to the panel below it by shape
 * (connected bottom bar), weight and icon state — not colour alone.
 */
export default function ScannerTabs({ activeTab, onTabChange }) {
    return (
        <div
            className="flex items-end gap-1 mb-0 border-b border-[var(--color-border-default)] overflow-x-auto scrollbar-none"
            role="tablist"
            aria-label="Scanner engines"
        >
            {SCANNER_ENGINES.map((engine) => {
                const isActive = activeTab === engine.id;

                return (
                    <button
                        key={engine.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onTabChange(engine.id)}
                        className={`relative px-3.5 pt-2 pb-2.5 flex items-center gap-2 text-xs whitespace-nowrap transition-colors duration-150 border border-b-0 rounded-t-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-signal)] ${
                            isActive
                                ? // Active: raised panel connected to the content below */
                                  "bg-[var(--color-surface-2)] border-[var(--color-border-default)] text-[var(--color-text-primary)] font-semibold -mb-px"
                                : "bg-transparent border-transparent text-[var(--color-text-muted)] font-medium hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-1)]"
                        }`}
                    >
                        {/* Active anchor bar — brass selection language */}
                        {isActive && (
                            <span
                                className="absolute -top-px left-0 right-0 h-[2px] rounded-b bg-[var(--color-signal)]"
                                aria-hidden="true"
                            />
                        )}

                        {!engine.isEngine ? (
                            <Radar
                                size={15}
                                strokeWidth={isActive ? 2.2 : 1.8}
                                className={isActive ? "text-[var(--color-signal)]" : "text-[var(--color-text-muted)]"}
                            />
                        ) : engine.status === "Ready" ? (
                            <Scan
                                size={15}
                                strokeWidth={isActive ? 2.2 : 1.8}
                                className={isActive ? "text-[var(--color-signal)]" : "text-[var(--color-text-muted)]"}
                            />
                        ) : (
                            <Shield
                                size={15}
                                strokeWidth={1.8}
                                className={isActive ? "text-[var(--color-signal)]" : "text-[var(--color-text-disabled)]"}
                            />
                        )}

                        <span>{engine.name}</span>

                        {engine.status !== "Ready" && !isActive && (
                            <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[var(--color-surface-3)] text-[var(--color-text-disabled)] uppercase tracking-wider">
                                {engine.status === "Coming Soon" ? "Soon" : "Plan"}
                            </span>
                        )}

                        {isActive && (
                            <span
                                className="ml-1 w-1.5 h-1.5 rounded-full bg-[var(--color-signal)] animate-[pulse-soft_2.4s_ease-in-out_infinite]"
                                aria-hidden="true"
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
