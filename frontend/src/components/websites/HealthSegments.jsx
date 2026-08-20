import { useCallback, useEffect, useRef, useState } from "react";

const SEGMENTS = [
    { id: "All", label: "All", dot: null },
    { id: "Healthy", label: "Healthy", dot: "bg-[var(--color-success)]" },
    { id: "Warning", label: "Warning", dot: "bg-[var(--color-warning)]" },
    { id: "Critical", label: "Critical", dot: "bg-[var(--color-critical)]" },
    { id: "Unknown", label: "Unknown", dot: "bg-[var(--color-info)]" },
];

/**
 * Health segmented filter — one joined control that drives the table's
 * health lens. A shared surface indicator slides to the active segment
 * (the only composed transition on this strip); the result set updates
 * immediately, without waiting for the transition.
 */
export default function HealthSegments({ value, counts, onChange, className = "" }) {
    const containerRef = useRef(null);
    const activeRef = useRef(null);
    const [indicator, setIndicator] = useState({ left: 0, width: 0 });

    const updateIndicator = useCallback(() => {
        const container = containerRef.current;
        const active = activeRef.current;
        if (!container || !active) return;
        const containerRect = container.getBoundingClientRect();
        const activeRect = active.getBoundingClientRect();
        setIndicator({ left: activeRect.left - containerRect.left, width: activeRect.width });
    }, []);

    // Position the shared surface after selection changes or counts reflow it.
    useEffect(() => {
        const frame = requestAnimationFrame(updateIndicator);
        return () => cancelAnimationFrame(frame);
    }, [value, counts, updateIndicator]);

    useEffect(() => {
        window.addEventListener("resize", updateIndicator);
        return () => window.removeEventListener("resize", updateIndicator);
    }, [updateIndicator]);

    return (
        <div
            ref={containerRef}
            role="tablist"
            aria-label="Filter by security health"
            className={`relative inline-flex items-stretch rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-2)] p-1 ${className}`}
        >
            {/* Shared selection surface */}
            <span
                aria-hidden="true"
                className="absolute top-1 bottom-1 rounded-sm bg-[var(--color-surface-3)] border border-[var(--color-border-subtle)] transition-all duration-200 ease-out"
                style={{ left: indicator.left, width: indicator.width }}
            />

            {SEGMENTS.map(seg => {
                const active = seg.id === value;
                const count = counts[seg.id] ?? 0;
                return (
                    <button
                        key={seg.id}
                        ref={active ? activeRef : undefined}
                        role="tab"
                        aria-selected={active}
                        aria-label={`${seg.label} websites (${count})`}
                        onClick={() => onChange(seg.id)}
                        className={`relative z-10 inline-flex items-center gap-2 px-4 py-2 rounded-sm text-[13px] font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                            active ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                        }`}
                    >
                        {seg.dot && (
                            <span className={`w-1.5 h-1.5 rounded-full ${seg.dot} ${active ? "opacity-90" : "opacity-50"}`} />
                        )}
                        {seg.label}
                        <span className={`tabular-nums text-xs ${active ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"}`}>{count}</span>
                    </button>
                );
            })}
        </div>
    );
}
