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
        <div className="relative flex-1 min-w-[240px] max-w-[320px]">
            <div className="relative flex items-center">
                <Search
                    size={16}
                    className={`absolute left-3.5 transition-colors duration-150 ${focused ? "text-emerald-400" : "text-slate-500"}`}
                />
                <input
                    ref={inputRef}
                    type="text"
                    role="searchbox"
                    aria-label="Search websites"
                    placeholder="Search websites…"
                    value={localQuery}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onChange={(e) => setLocalQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-10 pr-16 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/15 shadow-inner transition-colors duration-150"
                />
                {localQuery ? (
                    <button
                        onClick={() => {
                            setLocalQuery("");
                            inputRef.current?.focus();
                        }}
                        aria-label="Clear search"
                        className="absolute right-2.5 text-slate-500 hover:text-white transition-colors duration-150 p-1 rounded-md hover:bg-slate-800"
                    >
                        <X size={14} />
                    </button>
                ) : (
                    <kbd className="absolute right-3 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-[10px] font-semibold text-slate-500 pointer-events-none">
                        <Command size={10} />K
                    </kbd>
                )}
            </div>
        </div>
    );
}
