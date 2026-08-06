import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, ChevronDown, Check, Globe, AlertTriangle, Search } from "lucide-react";
import { getWebsites } from "../../services/scannerApi";

function healthDot(health) {
    const normalized = (health || "").toLowerCase();
    if (normalized === "healthy" || normalized === "online" || normalized === "up") {
        return "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]";
    }
    if (normalized === "unhealthy" || normalized === "offline" || normalized === "down") {
        return "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]";
    }
    return "bg-slate-500";
}

export default function TargetSelect({ value, onChange, disabled = false }) {
    const [websites, setWebsites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const rootRef = useRef(null);

    const loadWebsites = async () => {
        try {
            const data = await getWebsites();
            setWebsites(data);
            setError(false);
        } catch (err) {
            console.error(err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let cancelled = false;
        getWebsites()
            .then((data) => {
                if (!cancelled) {
                    setWebsites(data);
                    setError(false);
                }
            })
            .catch((err) => {
                console.error(err);
                if (!cancelled) setError(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // Close the dropdown when clicking outside.
    useEffect(() => {
        function handleClick(event) {
            if (rootRef.current && !rootRef.current.contains(event.target)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return websites;
        return websites.filter(
            (w) =>
                (w.name || "").toLowerCase().includes(q) ||
                (w.url || "").toLowerCase().includes(q) ||
                (w.domain || "").toLowerCase().includes(q)
        );
    }, [websites, query]);

    const selected = websites.find((w) => w.id === value) || null;

    return (
        <div className="relative flex-1" ref={rootRef}>
            <button
                type="button"
                onClick={() => !disabled && setOpen((o) => !o)}
                disabled={disabled}
                className={`w-full bg-slate-800/50 border rounded-xl px-4 py-3 text-left text-sm text-white placeholder:text-slate-500 focus:outline-none transition-all duration-300 flex items-center gap-3 ${
                    open
                        ? "border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:shadow-[0_0_18px_rgba(168,85,247,0.15)]"
                        : "border-slate-700 hover:border-slate-600"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
                {selected ? (
                    <>
                        <Building2 size={18} className="text-cyan-400/80 shrink-0" />
                        <span className="font-semibold text-white truncate">{selected.name}</span>
                        <span className="text-slate-500 text-[13px] truncate font-mono flex-1">{selected.url}</span>
                    </>
                ) : (
                    <>
                        <Globe size={18} className="text-cyan-400/80 shrink-0" />
                        <span className="text-slate-400 truncate">Select a target website…</span>
                        <span className="flex-1" />
                    </>
                )}
                <ChevronDown size={16} className={`text-slate-500 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <div className="absolute left-0 right-0 z-30 mt-2 bg-slate-900/95 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
                    {loading ? (
                        <div className="p-4 space-y-2.5">
                            {[0, 1, 2].map((row) => (
                                <div key={row} className="h-10 rounded-xl bg-slate-800/40 animate-pulse" />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="p-6 text-center">
                            <AlertTriangle size={22} className="text-red-400 mx-auto mb-2" />
                            <p className="text-sm font-semibold text-white">Failed to load websites</p>
                            <p className="text-xs text-slate-500 mt-1">Make sure the backend is running.</p>
                            <button
                                onClick={loadWebsites}
                                className="mt-4 bg-purple-600/10 text-purple-300 hover:bg-purple-600 hover:text-white rounded-lg px-4 py-2 text-xs font-medium transition-all duration-200"
                            >
                                Retry
                            </button>
                        </div>
                    ) : websites.length === 0 ? (
                        <div className="p-6 text-center">
                            <Globe size={22} className="text-slate-500 mx-auto mb-2" />
                            <p className="text-sm font-semibold text-white">No websites registered</p>
                            <p className="text-xs text-slate-500 mt-1 mb-3">Register a website before running scans.</p>
                            <Link
                                to="/websites"
                                className="inline-flex bg-emerald-600/10 text-emerald-300 hover:bg-emerald-600 hover:text-white rounded-lg px-4 py-2 text-xs font-medium transition-all duration-200"
                            >
                                Go to Websites
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="p-3 border-b border-slate-800/70">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="text"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Search by name, URL or domain…"
                                        className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-200"
                                    />
                                </div>
                            </div>
                            <div className="max-h-[260px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                {filtered.length > 0 ? (
                                    filtered.map((website) => {
                                        const isSelected = website.id === value;
                                        return (
                                            <button
                                                key={website.id}
                                                type="button"
                                                onClick={() => {
                                                    onChange(website);
                                                    setOpen(false);
                                                    setQuery("");
                                                }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ${
                                                    isSelected ? "bg-purple-500/10" : "hover:bg-slate-800/50"
                                                }`}
                                            >
                                                <span className="relative flex w-2 h-2 shrink-0">
                                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${healthDot(website.health)}`} />
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block text-sm font-semibold text-white truncate">
                                                        {website.name}
                                                    </span>
                                                    <span className="block text-xs text-slate-500 font-mono truncate">
                                                        {website.url}
                                                    </span>
                                                </span>
                                                <span className="flex-1" />
                                                {isSelected && <Check size={16} className="text-purple-400 shrink-0" />}
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="p-6 text-center text-sm text-slate-500">
                                        No websites match "{query}"
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
