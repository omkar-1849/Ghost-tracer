import { useCallback, useEffect, useRef, useState } from "react";

const SEGMENTS = [
    { id: "All", label: "All", dot: null },
    { id: "Healthy", label: "Healthy", dot: "bg-emerald-400" },
    { id: "Warning", label: "Warning", dot: "bg-amber-400" },
    { id: "Critical", label: "Critical", dot: "bg-red-500" },
    { id: "Unknown", label: "Unknown", dot: "bg-slate-500" },
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
            className={`relative inline-flex items-stretch rounded-lg border border-slate-700/70 bg-slate-900/60 p-1 ${className}`}
        >
            {/* Shared selection surface */}
            <span
                aria-hidden="true"
                className="absolute top-1 bottom-1 rounded-md bg-slate-800 border border-slate-700/60 transition-all duration-200 ease-out"
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
                        className={`relative z-10 inline-flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 ${
                            active ? "text-white" : "text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        {seg.dot && (
                            <span className={`w-1.5 h-1.5 rounded-full ${seg.dot} ${active ? "opacity-90" : "opacity-50"}`} />
                        )}
                        {seg.label}
                        <span className={`tabular-nums text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>{count}</span>
                    </button>
                );
            })}
        </div>
    );
}
