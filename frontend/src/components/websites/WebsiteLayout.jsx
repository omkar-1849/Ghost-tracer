import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    Loader2, Activity, Globe, Shield, Layers,
    Eye, EyeOff, Trash2, X, RefreshCw, Plus,
    MoreHorizontal, ExternalLink, Copy, ScanLine, Edit2,
    ChevronLeft, ChevronRight, Check, CheckCheck,
    ShieldCheck, ShieldAlert, SearchX, Search, Command,
} from "lucide-react";

import WebsiteDetailsDrawer from "./WebsiteDetailsDrawer";
import AddWebsiteModal from "./AddWebsiteModal";
import DeleteWebsiteDialog from "./DeleteWebsiteDialog";
import ToastStack, { TOAST_DURATION } from "./Toast";
import CustomSelect from "./CustomSelect";
import { safeHttpUrl } from "../../services/evidence.js";
import {
    ENVIRONMENT_FILTER_OPTIONS,
    STATUS_FILTER_OPTIONS,
} from "./constants";
import * as api from "../../services/websiteApi";
import { getOrganization } from "../../services/authClient";

/* ═══════════════════════════════════════════════════════════════════════════
   ASSETS MATERIAL SYSTEM — SMOKED BRONZE GLASS
   Canonical Sentinel material system aligned with Dashboard
   ═══════════════════════════════════════════════════════════════════════════ */
const GLASS = {
    background: "rgba(18, 16, 14, 0.45)",
    backdropFilter: "blur(28px) saturate(125%)",
    WebkitBackdropFilter: "blur(28px) saturate(125%)",
    borderRadius: "20px",
    border: "none",
    boxShadow: [
        "inset 0 1px 1px 0 rgba(255,248,238,0.08)",
        "inset 0 -1px 2px 0 rgba(0,0,0,0.35)",
        "0 24px 56px -12px rgba(0,0,0,0.65)",
        "0 8px 24px -4px rgba(0,0,0,0.40)",
    ].join(", "),
    position: "relative",
    overflow: "hidden",
};

/* Shared constant for reflection and occlusion */
const reflectionGradient = "linear-gradient(135deg, rgba(255,248,238,0.04) 0%, transparent 42%)";
const ambientOcclusion = "radial-gradient(ellipse 70% 45% at 50% 100%, rgba(0,0,0,0.25), transparent 75%)";

/* ═══════════════════════════════════════════════════════════════════════════
   COLOR TOKENS — Smoked Bronze Glass unified palette
   ═══════════════════════════════════════════════════════════════════════════ */
const C = {
    textPrimary:   "#F5F1EC",
    textSecondary: "#D6CFC7",
    textTertiary:  "#A9A199",
    textMuted:     "#8B837B",
    textFaint:     "#635B54",
    canvas:        "transparent",
    bronze:        "#D3A06A",
    bronzeLight:   "#E3B985",
    success:       "#77C79A",
    warning:       "#E3B985",
    critical:      "#E67868",
    unknown:       "#8B837B",
};

const getScoreColor = (s) => {
    if (s == null) return C.textMuted;
    if (s >= 90) return C.success;
    if (s >= 70) return C.warning;
    return C.critical;
};
const healthColor = (h) => ({ Healthy: C.success, Warning: C.warning, Critical: C.critical, Unknown: C.unknown }[h] || C.unknown);

/* ═══════════════════════════════════════════════════════════════════════════
   GLASS SURFACE — reusable component matching Dashboard's .sentinel-glass
   Uses ::before/::after pseudo approach via layered divs
   ═══════════════════════════════════════════════════════════════════════════ */
function GlassSurface({ children, className = "", style = {}, ...rest }) {
    return (
        <div className={`relative overflow-hidden ${className}`} style={{ ...GLASS, ...style }} {...rest}>
            {/* Specular reflection (::before equivalent) */}
            <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: "inherit", background: reflectionGradient, mixBlendMode: "screen", opacity: 0.55, zIndex: 1 }} />
            {/* Ambient occlusion bottom (::after equivalent) */}
            <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: "inherit", background: ambientOcclusion, zIndex: 1 }} />
            {/* Content above reflection layers */}
            <div className="relative" style={{ zIndex: 2 }}>{children}</div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TOAST HOOK
   ═══════════════════════════════════════════════════════════════════════════ */
function useToasts() {
    const [toasts, setToasts] = useState([]);
    const idRef = useRef(0);
    const dismiss = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
    const push = useCallback((type, message) => {
        const id = ++idRef.current;
        setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
        setTimeout(() => dismiss(id), TOAST_DURATION);
    }, [dismiss]);
    const toast = useCallback((type, message) => push(type, message), [push]);
    return { toasts, dismiss, toast };
}

/* ═══════════════════════════════════════════════════════════════════════════
   SKELETON LOADERS
   ═══════════════════════════════════════════════════════════════════════════ */
function ShimmerBar({ className = "" }) {
    return (
        <div className={`relative overflow-hidden rounded ${className}`} style={{ background: "rgba(255,255,255,0.035)" }}>
            <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.05)] to-transparent" />
        </div>
    );
}

function PostureSkeleton() {
    return (
        <GlassSurface style={{ padding: "24px 26px" }}>
            <div className="flex items-center gap-8">
                <ShimmerBar className="w-28 h-28 rounded-full shrink-0" />
                <div className="flex-1 grid grid-cols-4 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i}><ShimmerBar className="h-3 w-20 mb-2" /><ShimmerBar className="h-7 w-12 mb-1" /><ShimmerBar className="h-2.5 w-24" /></div>
                    ))}
                </div>
            </div>
        </GlassSurface>
    );
}

function AssetSkeleton() {
    return (
        <GlassSurface style={{ padding: "28px 32px" }}>
            <div className="flex items-start gap-5">
                <ShimmerBar className="w-12 h-12 rounded-xl shrink-0" />
                <div className="flex-1">
                    <ShimmerBar className="h-5 w-48 mb-2" />
                    <ShimmerBar className="h-3 w-56 mb-4" />
                    <ShimmerBar className="h-3 w-72 mb-5" />
                    <div className="grid grid-cols-5 gap-4"><ShimmerBar className="h-10" /><ShimmerBar className="h-10" /><ShimmerBar className="h-10" /><ShimmerBar className="h-10" /><ShimmerBar className="h-10" /></div>
                </div>
                <ShimmerBar className="w-16 h-16 rounded-full shrink-0" />
            </div>
        </GlassSurface>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════════════════════════════════════ */
function AssetEmptyState({ onAdd, canManage = true }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <Shield size={36} style={{ color: C.textMuted }} strokeWidth={1.3} />
            <h3 style={{ fontSize: "18px", fontWeight: 620, color: C.textPrimary, letterSpacing: "-0.02em", marginTop: "16px" }}>No Assets Configured</h3>
            <p style={{ fontSize: "14px", color: C.textTertiary, maxWidth: "400px", margin: "8px auto 28px", lineHeight: 1.55 }}>
                Configure your first protected application to enable continuous Sentinel threat detection.
            </p>
            {canManage && (
                <button
                    onClick={onAdd}
                    style={{
                        padding: "10px 22px",
                        background: "linear-gradient(135deg, #d3a06a 0%, #e3b985 100%)",
                        color: "#0d0c0a",
                        borderRadius: "12px",
                        fontSize: "13px",
                        fontWeight: 650,
                        letterSpacing: "-0.01em",
                        boxShadow: "0 2px 12px rgba(211,160,106,0.25)",
                    }}
                    className="inline-flex items-center gap-2 transition-all duration-200 hover:brightness-105"
                >
                    <Plus size={15} /> Protect a Website
                </button>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HEALTH FILTER CHIPS — compact, text-driven
   ═══════════════════════════════════════════════════════════════════════════ */
const HEALTH_SEGMENTS = [
    { id: "All", label: "All", color: null },
    { id: "Healthy", label: "Healthy", color: C.success },
    { id: "Warning", label: "Warning", color: C.warning },
    { id: "Critical", label: "Critical", color: C.critical },
    { id: "Unknown", label: "Unknown", color: C.unknown },
];

function HealthChips({ value, counts, onChange }) {
    return (
        <div className="flex items-center gap-1 flex-wrap" role="tablist" aria-label="Filter by health">
            {HEALTH_SEGMENTS.map((seg) => {
                const active = seg.id === value;
                const count = counts[seg.id] ?? 0;
                return (
                    <button key={seg.id} role="tab" aria-selected={active} onClick={() => onChange(seg.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-white/15"
                        style={{ fontSize: "11px", fontWeight: 550, background: active ? "rgba(255,255,255,0.07)" : "transparent", border: active ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent", color: active ? C.textPrimary : C.textMuted }}>
                        {seg.color && <span className="w-1.5 h-1.5 rounded-full" style={{ background: seg.color, opacity: active ? 0.85 : 0.35 }} />}
                        {seg.label}
                        <span style={{ fontSize: "10px", fontVariantNumeric: "tabular-nums", color: active ? C.textTertiary : C.textFaint }}>{count}</span>
                    </button>
                );
            })}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   INLINE SEARCH — compact, integrated
   ═══════════════════════════════════════════════════════════════════════════ */
function InlineSearch({ query, setQuery }) {
    const [local, setLocal] = useState(query);
    const [focused, setFocused] = useState(false);
    const ref = useRef(null);

    useEffect(() => { const t = setTimeout(() => setQuery(local), 300); return () => clearTimeout(t); }, [local, setQuery]);
    useEffect(() => {
        const handler = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); ref.current?.focus(); } };
        window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
    }, []);

    return (
        <div className="relative flex-1 min-w-[180px] max-w-[260px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-150" style={{ color: focused ? C.textSecondary : C.textFaint }} />
            <input ref={ref} type="text" role="searchbox" aria-label="Search assets" placeholder="Search assets…" value={local}
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChange={(e) => setLocal(e.target.value)}
                className="w-full pl-9 pr-12 py-[7px] text-[13px] focus:outline-none transition-all duration-200"
                style={{ background: "rgba(14,15,17,0.5)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderRadius: "10px", color: C.textPrimary, border: focused ? "1px solid rgba(255,255,255,0.16)" : "1px solid rgba(255,255,255,0.05)", boxShadow: focused ? "0 0 0 3px rgba(255,255,255,0.04)" : "none" }} />
            {local ? (
                <button onClick={() => { setLocal(""); ref.current?.focus(); }} aria-label="Clear" className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors" style={{ color: C.textMuted }}><X size={13} /></button>
            ) : (
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold pointer-events-none" style={{ color: C.textFaint, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}><Command size={9} />K</kbd>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCORE ARC
   ═══════════════════════════════════════════════════════════════════════════ */
function ScoreArc({ score, size = 64 }) {
    const r = (size - 6) / 2;
    const circumference = 2 * Math.PI * r;
    const pct = score != null ? Math.max(0, Math.min(100, score)) / 100 : 0;
    const offset = circumference * (1 - pct);
    const color = getScoreColor(score);
    return (
        <div className="relative flex flex-col items-center justify-center shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="absolute inset-0 -rotate-90">
                <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />
                {score != null && <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" style={{ filter: `drop-shadow(0 0 4px ${color}33)` }} />}
            </svg>
            <span style={{ fontSize: size > 56 ? "20px" : "14px", fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em", color, lineHeight: 1 }}>
                {score ?? "—"}
            </span>
        </div>
    );
}

function formatRelativeTime(dateString) {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Never";
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}

function MonitoringStatusBadge({ status, online = 0, total = 0, lastSeen = null }) {
    if (status === "waiting") {
        return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-[rgba(230,169,58,0.10)] border-[rgba(230,169,58,0.30)] text-[#E6A93A]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E6A93A] animate-pulse" />
                Waiting for Telemetry
            </span>
        );
    }
    if (status === "active") {
        return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-[rgba(22,217,139,0.10)] border-[rgba(22,217,139,0.25)] text-[#16D98B]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16D98B]" />
                Active
            </span>
        );
    }
    if (status === "degraded") {
        return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-[rgba(230,169,58,0.10)] border-[rgba(230,169,58,0.30)] text-[#E6A93A]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E6A93A]" />
                Degraded ({online}/{total} online)
            </span>
        );
    }
    if (status === "offline") {
        return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-[rgba(240,90,90,0.10)] border-[rgba(240,90,90,0.25)] text-[#F05A5A]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F05A5A]" />
                Offline{lastSeen ? ` (${formatRelativeTime(lastSeen)})` : ""}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.08)] text-[#8A939D]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#626B74]" />
            Not Connected
        </span>
    );
}

function ScanAuthorizationBadge({ scanAuth }) {
    if (scanAuth === "not_available") {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.06)] text-[#626B74]">
                <ShieldAlert size={11} strokeWidth={1.5} />
                Internal (Scan N/A)
            </span>
        );
    }
    if (scanAuth === "verified") {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-[rgba(22,217,139,0.10)] border-[rgba(22,217,139,0.25)] text-[#16D98B]">
                <ShieldCheck size={11} strokeWidth={1.7} />
                Verified
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-[rgba(230,169,58,0.10)] border-[rgba(230,169,58,0.25)] text-[#E6A93A]">
            <ShieldAlert size={11} strokeWidth={1.5} />
            Unverified
        </span>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ASSET SURFACE — the hero object
   Wide horizontal composition:
   LEFT: identity  |  CENTER: state & metadata  |  RIGHT: score & actions
   ═══════════════════════════════════════════════════════════════════════════ */
function AssetSurface({ website, selected, onToggleSelect, onView, onEdit, onDelete, onScan, canManage = true, canScan = true }) {
    const [copied, setCopied] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    const handleCopy = async (e) => { e.stopPropagation(); try { await navigator.clipboard.writeText(website.url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard write disallowed */ } };

    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
        const escHandler = (e) => { if (e.key === "Escape") setMenuOpen(false); };
        document.addEventListener("mousedown", handler); document.addEventListener("keydown", escHandler);
        return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", escHandler); };
    }, [menuOpen]);

    const hColor = healthColor(website.health);
    const isScanAllowed = canScan && (website.scan_authorization === "verified" || website.verified);

    return (
        <GlassSurface
            onClick={() => onView(website)}
            className="group cursor-pointer transition-all duration-250"
            style={{ padding: 0, ...(selected ? { boxShadow: GLASS.boxShadow + ", 0 0 0 1px rgba(255,255,255,0.12)" } : {}) }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "inset 0 1px 1px 0 rgba(255,255,255,0.09), inset 0 -1px 2px 0 rgba(0,0,0,0.28), 0 32px 70px -12px rgba(0,0,0,0.60), 0 10px 28px -4px rgba(0,0,0,0.40)" + (selected ? ", 0 0 0 1px rgba(255,255,255,0.12)" : ""); }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = GLASS.boxShadow + (selected ? ", 0 0 0 1px rgba(255,255,255,0.12)" : ""); }}
        >
            <div className="flex items-stretch" style={{ padding: "24px 28px" }}>

                {/* ── LEFT: Identity ── */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Checkbox */}
                    {canManage && (
                        <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                            <label className="inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only" checked={selected} onChange={() => onToggleSelect(website.id)} aria-label={`Select ${website.name}`} />
                                <span className={`w-[16px] h-[16px] rounded-[5px] border flex items-center justify-center transition-all duration-150 ${selected ? "bg-[#E8EAED] border-[#E8EAED]" : "bg-transparent border-[rgba(255,255,255,0.10)] hover:border-[rgba(255,255,255,0.20)]"}`}>
                                    {selected && <Check size={10} className="text-[#050607]" strokeWidth={3} />}
                                </span>
                            </label>
                        </div>
                    )}

                    {/* Favicon */}
                    <div className="w-12 h-12 rounded-[13px] flex items-center justify-center shrink-0 overflow-hidden" style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.04)" }}>
                        {website.faviconUrl ? <img src={website.faviconUrl} alt="" className="w-5 h-5 object-contain" /> : <Globe size={20} style={{ color: C.textMuted }} strokeWidth={1.4} />}
                    </div>

                    {/* Name + domain + status badges */}
                    <div className="flex-1 min-w-0 py-0.5">
                        <h3 style={{ fontSize: "20px", fontWeight: 650, color: C.textPrimary, lineHeight: 1.15, letterSpacing: "-0.025em" }} className="truncate">{website.name}</h3>
                        <p style={{ fontSize: "13px", fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace", color: C.textMuted, letterSpacing: "-0.005em", lineHeight: 1.4, marginTop: "2px" }} className="truncate">{website.domain}</p>

                        {/* Status badges line */}
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            <MonitoringStatusBadge
                                status={website.monitoring_status || "not_connected"}
                                online={website.collectors_online}
                                total={website.collectors_total}
                                lastSeen={website.last_telemetry_at}
                            />
                            <ScanAuthorizationBadge
                                scanAuth={website.scan_authorization || (website.exposure === "internal" ? "not_available" : (website.verified ? "verified" : "unverified"))}
                            />
                            <span style={{ color: C.textFaint, margin: "0 4px", fontSize: "6px", lineHeight: 1 }}>●</span>
                            <span style={{ color: C.textTertiary, fontSize: "12px" }}>{website.environment}</span>
                        </div>
                    </div>
                </div>

                {/* ── DIVIDER ── */}
                <div className="mx-6 self-stretch" style={{ width: "1px", background: "rgba(255,255,255,0.04)" }} />

                {/* ── CENTER: Operational metadata ── */}
                <div className="flex items-center gap-6 shrink-0">
                    {[
                        { label: "Health", value: website.health, color: hColor, dot: true },
                        { label: "Collectors", value: `${website.collectors_online ?? 0}/${website.collectors_total ?? 0}`, color: (website.collectors_online ?? 0) > 0 ? C.success : C.textMuted },
                        { label: "Telemetry", value: formatRelativeTime(website.last_telemetry_at), color: website.last_telemetry_at ? C.textSecondary : C.textMuted },
                        { label: "Last Scan", value: website.lastScan ? new Date(website.lastScan).toLocaleDateString() : "—", color: C.textSecondary },
                        { label: "Owner", value: website.owner || "—", color: C.textSecondary, truncate: true },
                    ].map(({ label, value, color, dot, icon: Icon, truncate }) => (
                        <div key={label} className="flex flex-col" style={{ minWidth: truncate ? "60px" : "auto", maxWidth: truncate ? "100px" : "auto" }}>
                            <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: C.textFaint, marginBottom: "4px" }}>{label}</span>
                            <span className={`inline-flex items-center gap-1 ${truncate ? "truncate" : ""}`} style={{ fontSize: "13px", fontWeight: 530, color }}>
                                {dot && <span className="w-[4px] h-[4px] rounded-full shrink-0" style={{ background: color }} />}
                                {Icon && <Icon size={11} strokeWidth={1.5} />}
                                {value}
                            </span>
                        </div>
                    ))}
                </div>

                {/* ── DIVIDER ── */}
                <div className="mx-6 self-stretch" style={{ width: "1px", background: "rgba(255,255,255,0.04)" }} />

                {/* ── RIGHT: Score + Actions ── */}
                <div className="flex items-center gap-4 shrink-0">
                    <div className="flex flex-col items-center">
                        <ScoreArc score={website.securityScore} size={58} />
                        <span style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textFaint, marginTop: "4px" }}>Security</span>
                    </div>

                    <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
                        <button onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }} aria-haspopup="menu" aria-expanded={menuOpen} aria-label={`Actions for ${website.name}`} title="Actions"
                            className="p-2 rounded-[10px] transition-all duration-150"
                            style={{ color: copied ? C.success : menuOpen ? C.textPrimary : C.textMuted, background: menuOpen ? "rgba(255,255,255,0.06)" : "transparent" }}>
                            {copied ? <CheckCheck size={16} /> : <MoreHorizontal size={16} />}
                        </button>
                        {menuOpen && (
                            <div role="menu" className="absolute right-0 bottom-full z-30 mb-1 w-44 py-1 rounded-xl overflow-hidden"
                                style={{ background: "rgba(12,13,15,0.95)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 20px 50px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
                                {[
                                    { icon: Eye, label: "View Details", action: () => onView(website) },
                                    { icon: ExternalLink, label: "Open URL", action: () => window.open(safeHttpUrl(website.url), "_blank", "noopener,noreferrer"), disabled: !safeHttpUrl(website.url) },
                                    { icon: Copy, label: "Copy URL", action: handleCopy },
                                    { icon: ScanLine, label: "Run Scan", action: () => onScan(website), disabled: !isScanAllowed, title: !canScan ? "Insufficient permissions" : (isScanAllowed ? "Run scan" : "Verify ownership first") },
                                ].map(({ icon: I, label, action, disabled, title }) => (
                                    <button key={label} role="menuitem" disabled={disabled} title={title} onClick={(e) => { e.stopPropagation(); setMenuOpen(false); action(); }}
                                        className={`w-full flex items-center gap-2.5 px-3.5 py-[7px] text-[12px] text-left transition-colors duration-100 ${disabled ? "text-[#3A3F47] cursor-not-allowed" : "text-[#8A939D] hover:text-[#F2F3F5] hover:bg-[rgba(255,255,255,0.04)]"}`}>
                                        <I size={13} /> {label}
                                    </button>
                                ))}
                                {canManage && (
                                    <>
                                        <div className="my-0.5 h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
                                        <button role="menuitem" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(website); }} className="w-full flex items-center gap-2.5 px-3.5 py-[7px] text-[12px] text-[#8A939D] hover:text-[#F2F3F5] hover:bg-[rgba(255,255,255,0.04)] transition-colors duration-100 text-left"><Edit2 size={13} /> Edit</button>
                                        <button role="menuitem" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(website); }} className="w-full flex items-center gap-2.5 px-3.5 py-[7px] text-[12px] text-[#F05A5A] hover:bg-[rgba(240,90,90,0.06)] transition-colors duration-100 text-left"><Trash2 size={13} /> Archive</button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </GlassSurface>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ENVIRONMENT PANEL
   ═══════════════════════════════════════════════════════════════════════════ */
function EnvironmentPanel({ websites }) {
    const envCounts = useMemo(() => {
        const c = { Production: 0, Staging: 0, Development: 0 };
        for (const w of websites) { if (c[w.environment] !== undefined) c[w.environment]++; }
        return c;
    }, [websites]);
    const total = websites.length || 1;
    const envs = [
        { name: "Production", count: envCounts.Production, color: C.success },
        { name: "Staging", count: envCounts.Staging, color: C.warning },
        { name: "Development", count: envCounts.Development, color: C.unknown },
    ];
    return (
        <GlassSurface style={{ padding: "22px 24px" }}>
            <h4 style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: C.textMuted }} className="flex items-center gap-2 mb-4">
                <Layers size={12} style={{ color: C.textMuted }} strokeWidth={1.5} /> Environment Distribution
            </h4>
            <div className="flex rounded-full h-[5px] overflow-hidden mb-4" style={{ background: "rgba(255,255,255,0.03)" }}>
                {envs.map((e) => <div key={e.name} style={{ width: `${(e.count / total) * 100}%`, background: e.color, minWidth: e.count > 0 ? 3 : 0 }} className="transition-all duration-300" />)}
            </div>
            <div className="space-y-2.5">
                {envs.map((e) => (
                    <div key={e.name} className="flex items-center justify-between" style={{ fontSize: "13px" }}>
                        <span className="flex items-center gap-2" style={{ color: C.textTertiary, fontWeight: 450 }}><span className="w-[6px] h-[6px] rounded-full" style={{ background: e.color }} />{e.name}</span>
                        <span style={{ fontWeight: 620, fontVariantNumeric: "tabular-nums", color: C.textPrimary }}>{e.count}</span>
                    </div>
                ))}
            </div>
        </GlassSurface>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN LAYOUT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function WebsiteLayout() {
    const [websites, setWebsites] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState(null);
    const [activeDrawerWebsite, setActiveDrawerWebsite] = useState(null);
    const [websiteToEdit, setWebsiteToEdit] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [deleteTargets, setDeleteTargets] = useState([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [filters, setFilters] = useState({ environment: "All", status: "All", health: "All" });
    const [selectedIds, setSelectedIds] = useState([]);
    const [pagination, setPagination] = useState({ currentPage: 1, itemsPerPage: 10 });
    const { toasts, dismiss, toast } = useToasts();
    const userRole = getOrganization()?.current_user_role?.toLowerCase();
    const canManage = !["analyst", "viewer"].includes(userRole);
    const canScan = !["viewer"].includes(userRole);

    const fetchWebsites = useCallback(async (query = "", showLoader = true) => {
        if (showLoader) setIsLoading(true);
        try { const data = await api.searchWebsites(query); setWebsites(data); setLastRefreshed(new Date().toISOString()); setSelectedIds([]); }
        catch (error) { console.error("Failed to fetch websites:", error); toast("error", "Failed to load websites from the backend."); }
        finally { if (showLoader) setIsLoading(false); }
    }, [toast]);

    useEffect(() => {
        let cancelled = false;
        api.searchWebsites(searchQuery).then((data) => { if (cancelled) return; setWebsites(data); setLastRefreshed(new Date().toISOString()); setSelectedIds([]); setIsLoading(false); })
            .catch(() => { if (cancelled) return; setIsLoading(false); toast("error", "Failed to load websites from the backend."); });
        return () => { cancelled = true; };
    }, [searchQuery, toast]);

    const filteredWebsites = useMemo(() => websites.filter((w) => {
        if (filters.environment !== "All" && w.environment !== filters.environment) return false;
        if (filters.status !== "All" && w.status !== filters.status) return false;
        if (filters.health !== "All" && w.health !== filters.health) return false;
        return true;
    }), [websites, filters]);

    const healthCounts = useMemo(() => {
        const counts = { All: websites.length, Healthy: 0, Warning: 0, Critical: 0, Unknown: 0 };
        for (const w of websites) { if (counts[w.health] !== undefined) counts[w.health] += 1; }
        return counts;
    }, [websites]);

    const total = websites.length;
    const active = useMemo(() => websites.filter((w) => w.status === "Active").length, [websites]);
    const inactive = useMemo(() => websites.filter((w) => w.status === "Inactive").length, [websites]);
    const monitored = useMemo(() => websites.filter((w) => w.monitoringEnabled).length, [websites]);
    const avgScore = useMemo(() => {
        const scores = websites.filter((w) => w.securityScore != null).map((w) => w.securityScore);
        return scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : null;
    }, [websites]);

    const { currentPage, itemsPerPage } = pagination;
    const totalItems = filteredWebsites.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const validPage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (validPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const visibleWebsites = filteredWebsites.slice(startIndex, endIndex);
    const allSelected = visibleWebsites.length > 0 && visibleWebsites.every((w) => selectedIds.includes(w.id));
    const goToPage = (page) => setPagination((prev) => ({ ...prev, currentPage: Math.min(Math.max(1, page), totalPages) }));

    const handleAddClick = () => { setWebsiteToEdit(null); setIsAddModalOpen(true); };
    const handleEditClick = (website) => { setWebsiteToEdit(website); setIsAddModalOpen(true); setActiveDrawerWebsite(null); };
    const handleDeleteClick = (website) => { setDeleteTargets([website.id]); setIsDeleteDialogOpen(true); setActiveDrawerWebsite(null); };
    const handleBulkDeleteClick = () => { if (selectedIds.length === 0) return; setDeleteTargets([...selectedIds]); setIsDeleteDialogOpen(true); };
    const handleClearSelection = useCallback(() => setSelectedIds([]), []);
    const handleResetFilters = useCallback(() => setFilters({ environment: "All", status: "All", health: "All" }), []);

    const handleSaveWebsite = async (formData) => {
        setSaving(true);
        try {
            if (websiteToEdit) { await api.updateWebsite(websiteToEdit.id, formData); toast("success", `${websiteToEdit.name} updated successfully.`); }
            else { await api.createWebsite(formData); toast("success", `${formData.name} registered and monitoring ${formData.monitoringEnabled ? "enabled" : "paused"}.`); }
            await fetchWebsites(searchQuery, false); setIsAddModalOpen(false);
        } catch (error) { console.error(error); toast("error", error.message || "Failed to save website."); } finally { setSaving(false); }
    };

    const confirmDelete = async () => {
        setDeleting(true);
        try {
            for (const id of deleteTargets) await api.deleteWebsite(id);
            toast("success", deleteTargets.length === 1 ? "Website archived successfully." : `${deleteTargets.length} websites archived.`);
            await fetchWebsites(searchQuery, false); setIsDeleteDialogOpen(false); setDeleteTargets([]);
        } catch (error) { console.error(error); toast("error", "Failed to archive websites."); } finally { setDeleting(false); }
    };

    const handleBulkMonitor = async (enable) => {
        if (selectedIds.length === 0) return; setIsBusy(true);
        try {
            let changed = 0;
            for (const id of selectedIds) { const t = websites.find((w) => w.id === id); if (t && t.monitoringEnabled !== enable) { await api.updateWebsite(id, { ...t, monitoringEnabled: enable }); changed++; } }
            toast("success", `Monitoring ${enable ? "enabled" : "paused"} for ${changed} website${changed === 1 ? "" : "s"}.`);
            await fetchWebsites(searchQuery, false);
        } catch (error) { console.error(error); toast("error", "Failed to update monitoring."); } finally { setIsBusy(false); }
    };

    const handleToggleSelect = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    const handleToggleSelectAll = (checked) => {
        const ids = visibleWebsites.map((w) => w.id);
        if (checked) setSelectedIds((prev) => [...new Set([...prev, ...ids])]);
        else setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    };
    const handleScan = (website) => toast("info", `Scan queued for ${website.name} — wires into the Scanner module in a future release.`);
    const handleFilterChange = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

    /* ══════════════════════ RENDER ══════════════════════ */
    return (
        <div className="flex-1 flex flex-col min-h-0 relative">
            <ToastStack toasts={toasts} onDismiss={dismiss} />

            {isBusy && (
                <div className="absolute top-4 right-8 z-[90] flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium animate-fade-in" style={{ ...GLASS, color: C.success }}><Loader2 size={14} className="animate-spin" /> Updating…</div>
            )}

            {/* ── PAGE CONTENT ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative" style={{ zIndex: 1 }}>
                <div className="max-w-[1600px] mx-auto pb-10" style={{ fontFamily: "var(--font-sans), -apple-system, sans-serif" }}>

                    {/* ═══ BAND 1: COMMAND HEADER ═══ */}
                    <header className="flex items-end justify-between mb-7">
                        <div>
                            <h1 style={{ fontSize: "28px", fontWeight: 700, color: C.textPrimary, letterSpacing: "-0.025em", lineHeight: 1.1, margin: "0 0 4px 0" }}>Asset Management</h1>
                            <p style={{ fontSize: "14px", fontWeight: 400, color: C.textTertiary, margin: 0 }}>Controlled target infrastructure, active environments, and security posture.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => fetchWebsites(searchQuery)} title="Refresh" aria-label="Refresh" className="p-2.5 rounded-xl border border-[rgba(255,248,238,0.08)] bg-[rgba(20,18,16,0.55)] hover:border-[rgba(211,160,106,0.3)] transition-all duration-150" style={{ color: C.textSecondary }}><RefreshCw size={15} /></button>
                            {canManage && (
                                <button
                                    onClick={handleAddClick}
                                    className="flex items-center gap-1.5 transition-all duration-150 shrink-0 bg-gradient-to-r from-[#d3a06a] to-[#e3b985] text-[#0d0c0a] font-bold rounded-xl px-4 py-2.5 text-xs shadow-[0_2px_12px_rgba(211,160,106,0.25)] hover:brightness-105"
                                >
                                    <Plus size={15} strokeWidth={2.2} /> Protect a Website
                                </button>
                            )}
                        </div>
                    </header>

                    {/* ═══ BAND 2: POSTURE INSTRUMENT — ONE CONTINUOUS GLASS SURFACE ═══ */}
                    {isLoading && websites.length === 0 ? (
                        <PostureSkeleton />
                    ) : (
                        <GlassSurface style={{ padding: "24px 28px", marginBottom: "24px" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(160px, 0.7fr) repeat(4, minmax(120px, 1fr))", gap: 0, alignItems: "center" }}>
                                {/* Primary metric — larger */}
                                <div style={{ paddingRight: "24px", borderRight: "1px solid rgba(255,255,255,0.04)", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                    <span style={{ fontSize: "13px", fontWeight: 500, color: C.textTertiary, marginBottom: "6px", lineHeight: 1.2 }}>Total Assets</span>
                                    <span style={{ fontSize: "36px", fontWeight: 650, color: C.textPrimary, lineHeight: 1, fontVariantNumeric: "tabular-nums lining-nums", letterSpacing: "-0.03em", marginBottom: "4px" }}>{total}</span>
                                    <span style={{ fontSize: "13px", color: C.textMuted, lineHeight: 1.2 }}>Registered Infrastructure</span>
                                </div>
                                {/* Supporting metrics — pure typography cells */}
                                {[
                                    { label: "Active", value: active, color: C.success, desc: "Operational targets" },
                                    { label: "Inactive", value: inactive, color: C.textMuted, desc: "Dormant targets" },
                                    { label: "Monitored", value: monitored, color: C.textPrimary, desc: "Continuous observation" },
                                    { label: "Security Score", value: avgScore ?? "—", color: getScoreColor(avgScore), desc: avgScore != null ? "Mean posture score" : "No scored targets" },
                                ].map(({ label, value, color, desc }) => (
                                    <div key={label} style={{ padding: "0 24px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                        <span style={{ fontSize: "13px", fontWeight: 500, color: C.textTertiary, marginBottom: "6px", lineHeight: 1.2 }}>{label}</span>
                                        <span style={{ fontSize: "30px", fontWeight: 600, lineHeight: 1, color, fontVariantNumeric: "tabular-nums lining-nums", letterSpacing: "-0.03em", marginBottom: "4px" }}>{value}</span>
                                        <span style={{ fontSize: "13px", color: C.textMuted, lineHeight: 1.2 }}>{desc}</span>
                                    </div>
                                ))}
                            </div>
                        </GlassSurface>
                    )}

                    {/* ═══ BAND 3: ASSET WORKSPACE ═══ */}
                    <GlassSurface style={{ padding: "24px 28px", marginBottom: "24px" }}>
                        {/* Controls rail */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
                            <div>
                                <h2 style={{ fontSize: "20px", fontWeight: 650, color: C.textPrimary, letterSpacing: "-0.025em", margin: "0 0 2px 0" }}>Your Assets</h2>
                                <p style={{ fontSize: "13px", color: C.textMuted, margin: 0 }}>Registered websites and security posture.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <InlineSearch query={searchQuery} setQuery={setSearchQuery} />
                                <CustomSelect id="filter-environment" value={filters.environment} onChange={(v) => handleFilterChange("environment", v)} options={ENVIRONMENT_FILTER_OPTIONS} />
                                <CustomSelect id="filter-status" value={filters.status} onChange={(v) => handleFilterChange("status", v)} options={STATUS_FILTER_OPTIONS} />
                            </div>
                        </div>

                        <HealthChips value={filters.health} counts={healthCounts} onChange={(h) => setFilters((prev) => ({ ...prev, health: h }))} />

                        {canManage && selectedIds.length > 0 && (
                            <div className="flex items-center gap-2 mt-3 p-2.5 rounded-xl animate-fade-in" style={{ background: "rgba(14,15,17,0.6)", border: "1px solid rgba(255,255,255,0.04)" }}>
                                <span style={{ fontSize: "12px", fontWeight: 600, color: C.textPrimary, padding: "0 6px" }}>{selectedIds.length} selected</span>
                                <button onClick={handleClearSelection} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors" style={{ fontSize: "11px", color: C.textMuted }}><X size={11} /> Clear</button>
                                <span className="w-px h-3.5" style={{ background: "rgba(255,255,255,0.05)" }} />
                                <button onClick={() => handleBulkMonitor(true)} title="Enable monitoring" className="p-1 rounded-md transition-colors" style={{ color: C.textMuted }}><Eye size={14} /></button>
                                <button onClick={() => handleBulkMonitor(false)} title="Pause monitoring" className="p-1 rounded-md transition-colors" style={{ color: C.textMuted }}><EyeOff size={14} /></button>
                                <button onClick={handleBulkDeleteClick} title="Archive selected" className="p-1 rounded-md transition-colors" style={{ color: C.critical }}><Trash2 size={14} /></button>
                            </div>
                        )}

                        {/* Asset surfaces */}
                        <div className="mt-5 space-y-3">
                            {isLoading && websites.length === 0 ? (
                                <>{Array.from({ length: 3 }).map((_, i) => <AssetSkeleton key={i} />)}</>
                            ) : websites.length === 0 && !searchQuery ? (
                                <AssetEmptyState onAdd={handleAddClick} canManage={canManage} />
                            ) : visibleWebsites.length === 0 ? (
                                <div className="flex flex-col items-center gap-2.5 py-14 text-center">
                                    <SearchX size={24} style={{ color: C.textFaint }} />
                                    <p style={{ fontSize: "14px", fontWeight: 580, color: C.textPrimary }}>No matching assets</p>
                                    <p style={{ fontSize: "12px", color: C.textMuted }}>Adjust environment, status, or health filters.</p>
                                    <button onClick={handleResetFilters} className="mt-1 px-3.5 py-1.5 rounded-lg transition-colors duration-150" style={{ background: "rgba(255,255,255,0.05)", fontSize: "12px", fontWeight: 550, color: C.textTertiary }}>Reset Filters</button>
                                </div>
                            ) : (
                                visibleWebsites.map((website) => (
                                    <AssetSurface key={website.id} website={website} selected={selectedIds.includes(website.id)} onToggleSelect={handleToggleSelect} onView={setActiveDrawerWebsite} onEdit={handleEditClick} onDelete={handleDeleteClick} onScan={handleScan} canManage={canManage} canScan={canScan} />
                                ))
                            )}
                        </div>

                        {/* Pagination */}
                        {filteredWebsites.length > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                                <div className="flex items-center gap-3" style={{ fontSize: "12px", color: C.textMuted }}>
                                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{totalItems === 0 ? 0 : startIndex + 1}–{Math.min(endIndex, totalItems)} of {totalItems}</span>
                                    <span className="hidden lg:flex items-center gap-1" style={{ color: C.textFaint, fontSize: "11px", fontVariantNumeric: "tabular-nums" }}>Synced {lastRefreshed ? new Date(lastRefreshed).toLocaleTimeString() : "—"}</span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <button onClick={() => handleToggleSelectAll(!allSelected)} className="transition-colors" style={{ fontSize: "11px", fontWeight: 500, color: C.textMuted }}>{allSelected ? "Deselect" : "Select all"}</button>
                                    <span className="w-px h-3" style={{ background: "rgba(255,255,255,0.04)" }} />
                                    <span className="hidden md:flex items-center gap-1" style={{ fontSize: "10px", color: C.success }}><span className="w-1 h-1 rounded-full" style={{ background: C.success }} /> Online</span>
                                    <span className="w-px h-3" style={{ background: "rgba(255,255,255,0.04)" }} />
                                    <CustomSelect id="rows-per-page" value={itemsPerPage} onChange={(v) => setPagination((prev) => ({ ...prev, itemsPerPage: Number(v), currentPage: 1 }))} options={[{ value: "10", label: "10 / page" }, { value: "25", label: "25 / page" }, { value: "50", label: "50 / page" }]} />
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => goToPage(validPage - 1)} disabled={validPage <= 1} aria-label="Previous page" className="p-1 rounded-md disabled:opacity-25 disabled:cursor-not-allowed transition-colors" style={{ color: C.textMuted }}><ChevronLeft size={15} /></button>
                                        <span className="px-2 py-0.5 rounded-md" style={{ background: "rgba(14,15,17,0.5)", border: "1px solid rgba(255,255,255,0.04)", fontSize: "11px", fontVariantNumeric: "tabular-nums", color: C.textTertiary }}>
                                            <span style={{ color: C.textPrimary, fontWeight: 600 }}>{validPage}</span>/{totalPages}
                                        </span>
                                        <button onClick={() => goToPage(validPage + 1)} disabled={validPage >= totalPages} aria-label="Next page" className="p-1 rounded-md disabled:opacity-25 disabled:cursor-not-allowed transition-colors" style={{ color: C.textMuted }}><ChevronRight size={15} /></button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </GlassSurface>

                    {/* ═══ BAND 4: INTELLIGENCE PANELS ═══ */}
                    {websites.length > 0 && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                            <EnvironmentPanel websites={websites} />
                            <GlassSurface style={{ padding: "22px 24px" }}>
                                <h4 style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: C.textMuted }} className="flex items-center gap-2 mb-4">
                                    <Activity size={12} style={{ color: C.textMuted }} strokeWidth={1.5} /> Recent Activity
                                </h4>
                                <div className="flex flex-col items-center justify-center py-8 text-center rounded-xl" style={{ border: "1px dashed rgba(255,255,255,0.04)" }}>
                                    <Activity size={22} className="mb-2" style={{ color: C.textFaint, opacity: 0.5 }} />
                                    <span style={{ fontSize: "12px", fontWeight: 480, color: C.textFaint }}>Activity stream available in a future release</span>
                                </div>
                            </GlassSurface>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── OVERLAYS ─── */}
            <WebsiteDetailsDrawer website={activeDrawerWebsite} onClose={() => setActiveDrawerWebsite(null)} onRefresh={() => fetchWebsites(searchQuery, false)} onEdit={(w) => { setActiveDrawerWebsite(null); handleEditClick(w); }} />
            <AddWebsiteModal

                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleSaveWebsite}
                onAssetCreated={async (newAsset) => {
                    await fetchWebsites(searchQuery, false);
                    if (newAsset) {
                        try {
                            const updatedList = await api.getWebsites();
                            const target = updatedList.find((w) => w.id === newAsset.id);
                            if (target) setActiveDrawerWebsite(target);
                        } catch {
                            // ignore
                        }
                    }
                }}
                initialData={websiteToEdit}
                saving={saving}
            />
            <DeleteWebsiteDialog isOpen={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)} onConfirm={confirmDelete} count={deleteTargets.length} deleting={deleting} />

        </div>
    );
}
