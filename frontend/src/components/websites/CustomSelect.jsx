import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

/**
 * Accessible dark-glass dropdown.
 * Keyboard: ArrowUp/Down to navigate, Enter to select, Escape to close.
 * Used by WebsiteFilters, AddWebsiteModal and WebsiteTable (rows-per-page).
 */
export default function CustomSelect({ value, onChange, options, id, className = "" }) {
    const [open, setOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(0);
    const rootRef = useRef(null);

    const close = () => {
        setOpen(false);
        setHighlighted(0);
    };

    // Close on outside click / Escape
    useEffect(() => {
        if (!open) return;
        const handlePointerDown = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) close();
        };
        const handleKeyDown = (e) => {
            if (e.key === "Escape") close();
        };
        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    const selectOption = (value) => {
        onChange(value);
        close();
    };

    const handleKeyDown = (e) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) {
                setOpen(true);
                setHighlighted(0);
            } else {
                setHighlighted(h => Math.min(h + 1, options.length - 1));
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted(h => Math.max(h - 1, 0));
        } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!open) {
                setOpen(true);
            } else {
                selectOption(options[highlighted].value);
            }
        }
    };

    const active = options.find(o => o.value === value);

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            <button
                type="button"
                id={id}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen(o => !o)}
                onKeyDown={handleKeyDown}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm text-slate-300 hover:text-white rounded-lg cursor-pointer transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 ${
                    open ? "bg-slate-800/80 text-white" : "hover:bg-slate-800/50"
                }`}
            >
                <span className="truncate font-semibold">{active ? active.label : value}</span>
                <ChevronDown
                    size={14}
                    className={`text-slate-500 transition-transform duration-150 ${open ? "rotate-180 text-emerald-400" : ""}`}
                />
            </button>

            {open && (
                <ul
                    role="listbox"
                    aria-labelledby={id}
                    className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[180px] py-1.5 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/70 shadow-2xl shadow-black/50 animate-scale-in origin-top-right"
                >
                    {options.map((opt, idx) => {
                        const selected = opt.value === value;
                        const isHighlighted = idx === highlighted;
                        return (
                            <li key={opt.value} role="option" aria-selected={selected}>
                                <button
                                    type="button"
                                    onMouseEnter={() => setHighlighted(idx)}
                                    onClick={() => selectOption(opt.value)}
                                    className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 text-sm text-left transition-colors duration-150 ${
                                        isHighlighted ? "bg-emerald-500/10 text-white" : selected ? "text-emerald-300" : "text-slate-300"
                                    }`}
                                >
                                    <span className="font-medium">{opt.label}</span>
                                    {selected && <Check size={14} className="text-emerald-400 shrink-0" />}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
