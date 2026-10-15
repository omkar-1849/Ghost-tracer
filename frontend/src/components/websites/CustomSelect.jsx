import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

/**
 * Accessible dark-glass dropdown — liquid glass control material.
 * Keyboard: ArrowUp/Down to navigate, Enter to select, Escape to close.
 * Used by filters, AddWebsiteModal, and pagination.
 */
export default function CustomSelect({ value, onChange, options, id, className = "" }) {
    const [open, setOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(0);
    const rootRef = useRef(null);

    const close = () => {
        setOpen(false);
        setHighlighted(0);
    };

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
            if (!open) { setOpen(true); setHighlighted(0); }
            else setHighlighted((h) => Math.min(h + 1, options.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted((h) => Math.max(h - 1, 0));
        } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!open) setOpen(true);
            else selectOption(options[highlighted].value);
        }
    };

    const active = options.find((o) => o.value === value);

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            <button
                type="button"
                id={id}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                onKeyDown={handleKeyDown}
                className="flex items-center gap-2 px-3 py-1.5 text-[13px] rounded-[10px] cursor-pointer transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                style={{
                    color: open ? "#F4F6F7" : "#858E97",
                    background: open ? "rgba(255,255,255,0.08)" : "transparent",
                    border: open ? "1px solid rgba(255,255,255,0.14)" : "1px solid transparent",
                }}
            >
                <span className="truncate font-semibold">{active ? active.label : value}</span>
                <ChevronDown
                    size={13}
                    className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                    style={{ color: open ? "#F4F6F7" : "#626B74" }}
                />
            </button>
            {open && (
                <ul
                    role="listbox"
                    aria-labelledby={id}
                    className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[180px] py-1.5 rounded-xl origin-top-right animate-fade-in overflow-hidden"
                    style={{
                        background: "rgba(11,14,18,0.92)",
                        backdropFilter: "blur(18px) saturate(112%)",
                        WebkitBackdropFilter: "blur(18px) saturate(112%)",
                        border: "1px solid rgba(255,255,255,0.085)",
                        boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
                    }}
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
                                    className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 text-[12px] text-left transition-colors duration-100 ${
                                        isHighlighted || selected
                                            ? "bg-[rgba(255,255,255,0.08)] text-[#F4F6F7] font-medium"
                                            : "text-[#B7BEC5] hover:text-[#F4F6F7]"
                                    }`}
                                >
                                    <span>{opt.label}</span>
                                    {selected && <Check size={13} className="text-[#F4F6F7] shrink-0" />}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
