import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, ChevronDown, Check, Globe, AlertTriangle, Search } from "lucide-react";
import { getWebsites } from "../../services/scannerApi";

function healthDot(health) {
    const normalized = (health || "").toLowerCase();
    if (normalized === "healthy" || normalized === "online" || normalized === "up") {
        return "bg-[var(--color-success)]";
    }
    if (normalized === "unhealthy" || normalized === "offline" || normalized === "down") {
        return "bg-[var(--color-critical)]";
    }
    return "bg-[var(--color-text-disabled)]";
}

export default function TargetSelect({ value, onChange, disabled = false }) {
    const [websites, setWebsites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const rootRef = useRef(null);

    const loadWebsites = async () => {
        setLoading(true);
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
                className={`w-full bg-[var(--color-surface-1)] border rounded-md px-3.5 py-2.5 text-left text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none transition-colors duration-150 flex items-center gap-2.5 ${
                    open
                        ? "border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]"
                        : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)]"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                {selected ? (
                    <>
                        <Building2 size={16} className="text-[var(--color-text-muted)] shrink-0" />
                        <span className="font-semibold text-[var(--color-text-primary)] truncate">{selected.name}</span>
                        <span className="text-[var(--color-text-muted)] text-xs truncate font-mono flex-1">{selected.url}</span>
                    </>
                ) : (
                    <>
                        <Globe size={16} className="text-[var(--color-text-muted)] shrink-0" />
                        <span className="text-[var(--color-text-muted)] truncate">Select a target website…</span>
                        <span className="flex-1" />
                    </>
                )}
                <ChevronDown size={14} className={`text-[var(--color-text-muted)] shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <div className="absolute left-0 right-0 z-30 mt-1 bg-[var(--color-surface-3)] border border-[var(--color-border-default)] rounded-md shadow-[var(--shadow-3)] overflow-hidden">
                    {loading ? (
                        <div className="p-3 space-y-2">
                            {[0, 1, 2].map((row) => (
                                <div key={row} className="h-8 rounded bg-[var(--color-surface-2)] animate-pulse" />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="p-4 text-center">
                            <AlertTriangle size={18} className="text-[var(--color-critical)] mx-auto mb-1.5" />
                            <p className="text-xs font-semibold text-[var(--color-text-primary)]">Failed to load websites</p>
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Make sure the backend is reachable.</p>
                            <button
                                type="button"
                                onClick={loadWebsites}
                                className="mt-3 bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded px-3 py-1 text-xs font-medium transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    ) : websites.length === 0 ? (
                        <div className="p-4 text-center">
                            <Globe size={18} className="text-[var(--color-text-muted)] mx-auto mb-1.5" />
                            <p className="text-xs font-semibold text-[var(--color-text-primary)]">No websites registered</p>
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 mb-2.5">Register a website asset before running scans.</p>
                            <Link
                                to="/websites"
                                className="inline-flex bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] rounded px-3 py-1 text-xs font-medium transition-colors"
                            >
                                Go to Websites
                            </Link>
                        </div>
                    ) : (
                        <div>
                            <div className="p-2 border-b border-[var(--color-border-subtle)] relative">
                                <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                                <input
                                    type="text"
                                    placeholder="Search targets…"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded pl-7 pr-3 py-1 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[var(--color-accent)]"
                                    autoFocus
                                />
                            </div>
                            <div className="max-h-48 overflow-y-auto divide-y divide-[var(--color-border-subtle)]">
                                {filtered.length === 0 ? (
                                    <p className="p-3 text-center text-xs text-[var(--color-text-muted)]">No matching targets found</p>
                                ) : (
                                    filtered.map((w) => {
                                        const isSel = w.id === value;
                                        return (
                                            <div
                                                key={w.id}
                                                onClick={() => {
                                                    onChange(w);
                                                    setOpen(false);
                                                }}
                                                className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                                                    isSel
                                                        ? "bg-[var(--color-accent-subtle)] text-[var(--color-text-primary)]"
                                                        : "hover:bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]"
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${healthDot(w.health)} shrink-0`} />
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{w.name}</p>
                                                        <p className="text-[11px] text-[var(--color-text-muted)] font-mono truncate">{w.url || w.domain}</p>
                                                    </div>
                                                </div>
                                                {isSel && <Check size={14} className="text-[var(--color-accent)] shrink-0 ml-2" />}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
