import { Search, X, Command } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function WebsiteSearch({ query, setQuery }) {
    const [localQuery, setLocalQuery] = useState(query);
    const [focused, setFocused] = useState(false);
    const inputRef = useRef(null);

    // Debounce search
    useEffect(() => {
        const handler = setTimeout(() => {
            setQuery(localQuery);
        }, 300);
        return () => clearTimeout(handler);
    }, [localQuery, setQuery]);

    // Keyboard shortcut: Ctrl/Cmd + K focuses the search bar
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    return (
        <div className="relative flex-1 min-w-[200px] max-w-[280px]">
            <div className="relative flex items-center">
                <Search
                    size={15}
                    className="absolute left-3 transition-colors duration-150"
                    style={{ color: focused ? "#F4F6F7" : "#626B74" }}
                />
                <input
                    ref={inputRef}
                    type="text"
                    role="searchbox"
                    aria-label="Search websites"
                    placeholder="Search assets…"
                    value={localQuery}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onChange={(e) => setLocalQuery(e.target.value)}
                    className="w-full rounded-[10px] pl-9 pr-14 py-2 text-[13px] text-[#F4F6F7] placeholder:text-[#626B74] focus:outline-none transition-all duration-200"
                    style={{
                        background: "rgba(11,14,18,0.78)",
                        backdropFilter: "blur(18px) saturate(112%)",
                        WebkitBackdropFilter: "blur(18px) saturate(112%)",
                        border: focused ? "1px solid rgba(255,255,255,0.24)" : "1px solid rgba(255,255,255,0.065)",
                        boxShadow: focused ? "0 0 0 3px rgba(255,255,255,0.06)" : "none",
                    }}
                />
                {localQuery ? (
                    <button
                        onClick={() => {
                            setLocalQuery("");
                            inputRef.current?.focus();
                        }}
                        aria-label="Clear search"
                        className="absolute right-2.5 text-[#626B74] hover:text-[#F4F6F7] transition-colors duration-150 p-1 rounded-md hover:bg-[rgba(255,255,255,0.06)]"
                    >
                        <X size={13} />
                    </button>
                ) : (
                    <kbd className="absolute right-3 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-[#626B74] pointer-events-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.055)" }}>
                        <Command size={10} />K
                    </kbd>
                )}
            </div>
        </div>
    );
}
