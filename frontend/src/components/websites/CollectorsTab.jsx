import { useState, useEffect, useCallback } from "react";
import {
    PlugZap, KeyRound, Loader2, RotateCcw,
    XCircle, Plus, ChevronDown, ChevronUp,
    Copy, Check, Power, PowerOff, Ban
} from "lucide-react";
import * as api from "../../services/websiteApi";
import { getOrganization } from "../../services/authClient";
import EnrollmentTokenModal from "./EnrollmentTokenModal";

const STATUS_BADGES = {
    online: { label: "Online", text: "text-[#16D98B]", chip: "bg-[rgba(22,217,139,0.1)] border-[rgba(22,217,139,0.25)]", dot: "bg-[#16D98B]" },
    pending: { label: "Pending", text: "text-[#E6A93A]", chip: "bg-[rgba(230,169,58,0.1)] border-[rgba(230,169,58,0.25)]", dot: "bg-[#E6A93A]" },
    offline: { label: "Offline", text: "text-[#F05A5A]", chip: "bg-[rgba(240,90,90,0.1)] border-[rgba(240,90,90,0.25)]", dot: "bg-[#F05A5A]" },
    disabled: { label: "Disabled", text: "text-[#858E97]", chip: "bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)]", dot: "bg-[#858E97]" },
    revoked: { label: "Revoked", text: "text-[#626B74]", chip: "bg-[rgba(11,14,18,0.78)] border-[rgba(255,255,255,0.05)]", dot: "bg-[#454C54]" },
};

function StatusBadge({ status }) {
    const s = STATUS_BADGES[status] || STATUS_BADGES.offline;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border ${s.chip} ${s.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}
        </span>
    );
}

function KindBadge({ kind }) {
    return (
        <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-mono uppercase font-semibold bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] text-[#B7BEC5]">
            {kind || "collector"}
        </span>
    );
}

export default function CollectorsTab({ website, onRefreshWebsite }) {
    const [collectors, setCollectors] = useState([]);
    const [tokens, setTokens] = useState([]);
    const [legacy, setLegacy] = useState(undefined);
    const [legacyKeys, setLegacyKeys] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [showTokenModal, setShowTokenModal] = useState(false);
    const [tokensExpanded, setTokensExpanded] = useState(false);
    const [waitingActive, setWaitingActive] = useState(false);
    const [rotatedKeyData, setRotatedKeyData] = useState(null); // { collectorId, apiKey }
    const [copiedKey, setCopiedKey] = useState(false);

    // Action confirmation state: { action: 'rotate'|'disable'|'enable'|'revoke', collector }
    const [confirmModal, setConfirmModal] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Role check
    const userRole = getOrganization()?.current_user_role?.toLowerCase();
    const canManage = ["owner", "admin"].includes(userRole);

    const loadData = useCallback(async () => {
        if (!website?.id) return;
        try {
            const colsPromise = api.getCollectors(website.id);
            const legacyPromise = api.getIntegration(website.id).catch(() => null);
            const tokensPromise = canManage ? api.getEnrollmentTokens(website.id).catch(() => []) : Promise.resolve([]);

            const [cols, leg, toks] = await Promise.all([colsPromise, legacyPromise, tokensPromise]);
            setCollectors(cols || []);
            setLegacy(leg);
            setTokens(toks || []);
            setError(null);
        } catch (err) {
            setError(err.message || "Failed to load collectors.");
        } finally {
            setLoading(false);
        }
    }, [website, canManage]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadData();
        }, 0);
        return () => clearTimeout(timer);
    }, [loadData]);

    // Polling for "Waiting for collector..." panel (max 15 mins = 900s)
    useEffect(() => {
        if (!waitingActive || !website?.id) return;
        const start = Date.now();
        const initialCount = collectors.length;

        const interval = setInterval(async () => {
            if (Date.now() - start > 15 * 60 * 1000) {
                setWaitingActive(false);
                clearInterval(interval);
                return;
            }
            try {
                const cols = await api.getCollectors(website.id);
                if (cols && cols.length > initialCount) {
                    setCollectors(cols);
                    setWaitingActive(false);
                    onRefreshWebsite?.();
                }
            } catch {
                // ignore polling error
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [waitingActive, website?.id, collectors.length, onRefreshWebsite]);

    // Actions
    const handleExecuteAction = async () => {
        if (!confirmModal || actionLoading) return;
        const { action, collector } = confirmModal;
        setActionLoading(true);
        try {
            if (action === "rotate") {
                const res = await api.rotateCollectorKey(website.id, collector.id, 300);
                setRotatedKeyData({ collectorId: collector.id, apiKey: res.api_key });
            } else if (action === "disable") {
                await api.disableCollector(website.id, collector.id);
            } else if (action === "enable") {
                await api.enableCollector(website.id, collector.id);
            } else if (action === "revoke") {
                await api.revokeCollector(website.id, collector.id);
            }
            setConfirmModal(null);
            await loadData();
            onRefreshWebsite?.();
        } catch (err) {
            alert(err.message || "Action failed.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleRevokeToken = async (tokenId) => {
        if (!window.confirm("Are you sure you want to revoke this enrollment token?")) return;
        try {
            await api.revokeEnrollmentToken(website.id, tokenId);
            await loadData();
        } catch (err) {
            alert(err.message || "Failed to revoke token.");
        }
    };

    // Legacy integration actions
    const handleLegacyConnect = async () => {
        try {
            const keys = await api.connectWebsite(website.id);
            setLegacyKeys(keys);
            setLegacy({ status: "Connected" });
            await loadData();
            onRefreshWebsite?.();
        } catch (err) {
            setError(err.message || "Failed to connect legacy integration.");
        }
    };

    const handleLegacyRegenerate = async () => {
        try {
            const keys = await api.regenerateIntegrationKeys(website.id);
            setLegacyKeys(keys);
            await loadData();
            onRefreshWebsite?.();
        } catch (err) {
            setError(err.message || "Failed to regenerate legacy keys.");
        }
    };

    const handleLegacyDisconnect = async () => {
        if (!window.confirm("Are you sure you want to disconnect this legacy integration?")) return;
        try {
            await api.disconnectWebsite(website.id);
            setLegacy(null);
            setLegacyKeys(null);
            await loadData();
            onRefreshWebsite?.();
        } catch (err) {
            setError(err.message || "Failed to disconnect legacy integration.");
        }
    };

    const handleCopyRotatedKey = async () => {
        if (!rotatedKeyData?.apiKey) return;
        try {
            await navigator.clipboard.writeText(rotatedKeyData.apiKey);
            setCopiedKey(true);
            setTimeout(() => setCopiedKey(false), 2000);
        } catch {
            /* clipboard access denied */
        }
    };

    if (loading && collectors.length === 0) {
        return (
            <div className="flex items-center gap-3 p-5 rounded-[12px] border border-[rgba(255,255,255,0.055)] bg-[rgba(12,15,19,0.62)] text-sm text-[#B7BEC5]">
                <Loader2 size={16} className="animate-spin text-[#858E97]" />
                Loading collectors…
            </div>
        );
    }

    // Separate modern daemon/sdk/nginx collectors from legacy integration
    const modernCollectors = collectors.filter(c => c.kind !== "legacy");

    return (
        <div className="space-y-6">
            {error && (
                <div className="p-3 rounded-[10px] bg-[rgba(240,90,90,0.1)] border border-[rgba(240,90,90,0.25)] text-[#F05A5A] text-xs font-semibold flex items-center gap-2">
                    <XCircle size={14} className="shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Rotated Key Single-Display Alert */}
            {rotatedKeyData && (
                <div className="p-4 rounded-[12px] bg-[rgba(230,169,58,0.1)] border border-[rgba(230,169,58,0.25)] space-y-2 animate-fade-in-up">
                    <div className="flex items-center justify-between text-xs font-bold text-[#E6A93A]">
                        <span className="flex items-center gap-1.5">
                            <KeyRound size={14} /> New Runtime Key Generated
                        </span>
                        <button
                            onClick={() => setRotatedKeyData(null)}
                            className="text-[#858E97] hover:text-[#F4F6F7]"
                        >
                            Dismiss
                        </button>
                    </div>
                    <p className="text-[11px] text-[#B7BEC5]">
                        The previous key will remain valid during the grace window (300s). Copy the new key now; it will not be displayed again:
                    </p>
                    <div className="flex items-center gap-2 p-2 rounded-[8px] bg-[rgba(11,14,18,0.78)] border border-[rgba(255,255,255,0.1)] font-mono text-xs text-[#F4F6F7]">
                        <span className="flex-1 truncate">{rotatedKeyData.apiKey}</span>
                        <button
                            onClick={handleCopyRotatedKey}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-[11px] font-bold bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.15)] text-[#F4F6F7]"
                        >
                            {copiedKey ? <Check size={11} className="text-[#16D98B]" /> : <Copy size={11} />}
                            {copiedKey ? "Copied" : "Copy"}
                        </button>
                    </div>
                </div>
            )}

            {/* Waiting for Collector Panel */}
            {waitingActive && (
                <div className="p-4 rounded-[12px] border border-[rgba(22,217,139,0.25)] bg-[rgba(22,217,139,0.06)] space-y-2 animate-fade-in-up">
                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-xs font-bold text-[#16D98B]">
                            <Loader2 size={14} className="animate-spin" />
                            Waiting for collector connection…
                        </span>
                        <button
                            onClick={() => setWaitingActive(false)}
                            className="text-xs text-[#858E97] hover:text-[#F4F6F7]"
                        >
                            Cancel
                        </button>
                    </div>
                    <p className="text-[11px] text-[#B7BEC5]">
                        Polling every 5 seconds. Once the daemon completes enrollment, it will automatically register and appear in the table below.
                    </p>
                </div>
            )}

            {/* Header + Add Collector Button */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-sm font-bold text-[#F4F6F7]">Collectors</h4>
                    <p className="text-xs text-[#858E97]">
                        Telemetry agents and collectors forwarding security signals to this protected asset.
                    </p>
                </div>
                {canManage && (
                    <button
                        onClick={() => setShowTokenModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-bold bg-[#F4F6F7] hover:bg-white text-[#050607] transition-all active:scale-[0.98]"
                    >
                        <Plus size={13} strokeWidth={2.5} />
                        Add Collector
                    </button>
                )}
            </div>

            {/* Collectors Table */}
            {modernCollectors.length === 0 ? (
                <div className="rounded-[12px] border border-dashed border-[rgba(255,255,255,0.085)] bg-[rgba(12,15,19,0.62)] p-6 text-center space-y-2">
                    <PlugZap size={24} className="mx-auto text-[#858E97]" />
                    <h5 className="text-xs font-bold text-[#F4F6F7]">No active collectors</h5>
                    <p className="text-[11px] text-[#858E97] max-w-xs mx-auto">
                        Enroll a collector daemon or server integration to receive live security telemetry.
                    </p>
                    {canManage && (
                        <button
                            onClick={() => setShowTokenModal(true)}
                            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-semibold bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.12)] text-[#F4F6F7]"
                        >
                            <Plus size={12} /> Add First Collector
                        </button>
                    )}
                </div>
            ) : (
                <div className="rounded-[12px] border border-[rgba(255,255,255,0.085)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-[rgba(255,255,255,0.055)] bg-[rgba(255,255,255,0.02)] text-[10px] font-bold uppercase tracking-wider text-[#626B74]">
                                <tr>
                                    <th className="px-3.5 py-2.5">Collector</th>
                                    <th className="px-3 py-2.5">Kind</th>
                                    <th className="px-3 py-2.5">Status</th>
                                    <th className="px-3 py-2.5">Version</th>
                                    <th className="px-3 py-2.5">Last Seen</th>
                                    {canManage && <th className="px-3 py-2.5 text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[rgba(255,255,255,0.04)] bg-[rgba(12,15,19,0.62)]">
                                {modernCollectors.map((col) => {
                                    const isRevoked = col.status === "revoked";
                                    const isDisabled = col.status === "disabled";
                                    return (
                                        <tr key={col.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                                            <td className="px-3.5 py-3">
                                                <div className="font-semibold text-[#F4F6F7]">{col.name}</div>
                                                {col.hostname && (
                                                    <div className="text-[11px] text-[#858E97] font-mono">{col.hostname}</div>
                                                )}
                                            </td>
                                            <td className="px-3 py-3">
                                                <KindBadge kind={col.kind} />
                                            </td>
                                            <td className="px-3 py-3">
                                                <StatusBadge status={col.status} />
                                            </td>
                                            <td className="px-3 py-3 font-mono text-[11px] text-[#B7BEC5]">
                                                {col.version || "—"}
                                            </td>
                                            <td className="px-3 py-3 text-[11px] text-[#858E97]">
                                                {col.last_heartbeat_at || col.last_used
                                                    ? new Date(col.last_heartbeat_at || col.last_used).toLocaleString()
                                                    : "Never"}
                                            </td>
                                            {canManage && (
                                                <td className="px-3 py-3 text-right space-x-1 whitespace-nowrap">
                                                    {!isRevoked && (
                                                        <>
                                                            <button
                                                                onClick={() => setConfirmModal({ action: "rotate", collector: col })}
                                                                title="Rotate Runtime Key"
                                                                className="p-1 rounded text-[#858E97] hover:text-[#F4F6F7] hover:bg-[rgba(255,255,255,0.05)]"
                                                            >
                                                                <RotateCcw size={13} />
                                                            </button>
                                                            {isDisabled ? (
                                                                <button
                                                                    onClick={() => setConfirmModal({ action: "enable", collector: col })}
                                                                    title="Enable Collector"
                                                                    className="p-1 rounded text-[#16D98B] hover:bg-[rgba(22,217,139,0.1)]"
                                                                >
                                                                    <Power size={13} />
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setConfirmModal({ action: "disable", collector: col })}
                                                                    title="Disable Collector"
                                                                    className="p-1 rounded text-[#E6A93A] hover:bg-[rgba(230,169,58,0.1)]"
                                                                >
                                                                    <PowerOff size={13} />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => setConfirmModal({ action: "revoke", collector: col })}
                                                                title="Revoke Permanently"
                                                                className="p-1 rounded text-[#F05A5A] hover:bg-[rgba(240,90,90,0.1)]"
                                                            >
                                                                <Ban size={13} />
                                                            </button>
                                                        </>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pending Enrollment Tokens (Collapsible) */}
            {canManage && (
                <div className="rounded-[12px] border border-[rgba(255,255,255,0.085)] bg-[rgba(12,15,19,0.62)] overflow-hidden">
                    <button
                        onClick={() => setTokensExpanded(!tokensExpanded)}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                    >
                        <span className="text-xs font-bold text-[#B7BEC5] flex items-center gap-2">
                            <KeyRound size={13} className="text-[#858E97]" />
                            Pending Enrollment Tokens ({tokens.filter(t => t.status === "active").length})
                        </span>
                        {tokensExpanded ? <ChevronUp size={14} className="text-[#858E97]" /> : <ChevronDown size={14} className="text-[#858E97]" />}
                    </button>
                    {tokensExpanded && (
                        <div className="px-4 pb-3.5 pt-1 border-t border-[rgba(255,255,255,0.04)]">
                            {tokens.length === 0 ? (
                                <p className="text-[11px] text-[#858E97] py-2">No pending tokens found.</p>
                            ) : (
                                <div className="space-y-2 mt-2">
                                    {tokens.map((tok) => (
                                        <div
                                            key={tok.id}
                                            className="flex items-center justify-between p-2.5 rounded-[8px] bg-[rgba(11,14,18,0.78)] border border-[rgba(255,255,255,0.05)] text-xs"
                                        >
                                            <div>
                                                <div className="font-semibold text-[#F4F6F7]">
                                                    {tok.label || `Token ${tok.token_prefix}...`}
                                                </div>
                                                <div className="text-[10px] text-[#858E97] mt-0.5 space-x-2">
                                                    <span>Uses: {tok.used_count}/{tok.max_uses}</span>
                                                    <span>•</span>
                                                    <span>Expires: {new Date(tok.expires_at).toLocaleDateString()}</span>
                                                    <span>•</span>
                                                    <span className={tok.status === "active" ? "text-[#16D98B]" : "text-[#858E97]"}>
                                                        {tok.status}
                                                    </span>
                                                </div>
                                            </div>
                                            {tok.status === "active" && (
                                                <button
                                                    onClick={() => handleRevokeToken(tok.id)}
                                                    className="px-2.5 py-1 text-[11px] font-bold text-[#F05A5A] bg-[rgba(240,90,90,0.1)] hover:bg-[rgba(240,90,90,0.2)] rounded-[6px] transition-colors"
                                                >
                                                    Revoke
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Legacy Integration Section */}
            <div className="rounded-[12px] border border-[rgba(255,255,255,0.085)] bg-[rgba(12,15,19,0.62)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#F4F6F7]">Legacy Integration</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[rgba(255,255,255,0.06)] text-[#858E97]">
                            Deprecated
                        </span>
                    </div>
                    {legacy && (
                        <span className={`text-[11px] font-semibold ${legacy.status === "Connected" ? "text-[#16D98B]" : "text-[#858E97]"}`}>
                            {legacy.status}
                        </span>
                    )}
                </div>

                <p className="text-[11px] text-[#858E97] leading-relaxed">
                    Maintains backwards compatibility with existing API keys. For new setups, please use Sentinel Collector daemons.
                </p>

                {legacyKeys && (
                    <div className="p-3 rounded-[8px] bg-[rgba(230,169,58,0.08)] border border-[rgba(230,169,58,0.2)] space-y-1.5 text-xs">
                        <span className="font-bold text-[#E6A93A] block">Legacy Credentials (Shown Once)</span>
                        <div className="font-mono text-[11px] text-[#F4F6F7] truncate">
                            API Key: {legacyKeys.api_key}
                        </div>
                        {legacyKeys.api_secret && (
                            <div className="font-mono text-[11px] text-[#F4F6F7] truncate">
                                API Secret: {legacyKeys.api_secret}
                            </div>
                        )}
                    </div>
                )}

                {canManage && (
                    <div className="flex gap-2 pt-1">
                        {!legacy || legacy.status !== "Connected" ? (
                            <button
                                onClick={handleLegacyConnect}
                                className="px-3 py-1.5 rounded-[8px] text-xs font-bold bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.12)] text-[#F4F6F7]"
                            >
                                Connect Legacy Key
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleLegacyRegenerate}
                                    className="px-3 py-1.5 rounded-[8px] text-xs font-bold bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.12)] text-[#F4F6F7]"
                                >
                                    Regenerate Keys
                                </button>
                                <button
                                    onClick={handleLegacyDisconnect}
                                    className="px-3 py-1.5 rounded-[8px] text-xs font-bold text-[#F05A5A] bg-[rgba(240,90,90,0.1)] hover:bg-[rgba(240,90,90,0.2)]"
                                >
                                    Disconnect
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Add Collector Modal */}
            {showTokenModal && (
                <EnrollmentTokenModal
                    website={website}
                    onClose={() => setShowTokenModal(false)}
                    onCreated={() => {
                        setWaitingActive(true);
                        loadData();
                    }}
                />
            )}

            {/* Action Confirmation Modal */}
            {confirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
                    <div className="absolute inset-0 bg-[rgba(0,0,0,0.75)] backdrop-blur-md" onClick={() => setConfirmModal(null)} />
                    <div className="relative w-full max-w-sm rounded-[16px] border border-[rgba(255,255,255,0.085)] bg-[rgba(12,15,19,0.92)] p-5 text-[#F4F6F7] shadow-xl">
                        <h4 className="text-sm font-bold capitalize">Confirm {confirmModal.action}</h4>
                        <p className="text-xs text-[#858E97] mt-1.5 leading-relaxed">
                            {confirmModal.action === "rotate" && "Rotating the key generates a new runtime credential. The old key remains active for 300s."}
                            {confirmModal.action === "disable" && "Disabling this collector immediately rejects all telemetry submissions with a 401 error."}
                            {confirmModal.action === "enable" && "Enabling this collector restores telemetry submission authority."}
                            {confirmModal.action === "revoke" && "Revoking this collector permanently terminates its identity. This action cannot be undone."}
                        </p>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                onClick={() => setConfirmModal(null)}
                                className="px-3 py-1.5 rounded-[8px] text-xs font-semibold text-[#858E97] hover:text-[#F4F6F7]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleExecuteAction}
                                disabled={actionLoading}
                                className={`px-4 py-1.5 rounded-[8px] text-xs font-bold transition-all ${
                                    confirmModal.action === "revoke"
                                        ? "bg-[#F05A5A] text-white hover:bg-red-600"
                                        : "bg-[#F4F6F7] text-[#050607] hover:bg-white"
                                }`}
                            >
                                {actionLoading ? "Processing…" : `Confirm ${confirmModal.action}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
