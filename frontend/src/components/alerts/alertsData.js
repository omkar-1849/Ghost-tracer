/**
 * alertsData
 * ----------
 * Shared domain config for the Security Incident Center:
 *  - severity themes (colours, icons, glows)
 *  - deterministic enrichment of raw backend alerts (id, ip_address,
 *    threat_level, message, created_at) into rich incident records
 *  - a curated fallback queue so the workspace is never empty
 *
 * Backend logic/APIs are untouched — enrichment is presentation-only and
 * stable for a given alert id (no layout jitter across re-renders).
 */

/* ------------------------------------------------------------------ */
/* Severity themes                                                     */
/* ------------------------------------------------------------------ */

export const SEVERITY_THEMES = {
    CRITICAL: {
        key: "CRITICAL",
        label: "Critical",
        chip: "border-red-500/25 bg-red-500/10 text-red-300",
        chipDot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]",
        iconWrap: "bg-gradient-to-br from-red-500/25 to-rose-600/10 ring-red-400/25 text-red-400",
        glow: "shadow-[0_0_18px_rgba(239,68,68,0.35)]",
        bar: "bg-gradient-to-b from-red-400 via-rose-500 to-red-600 shadow-[0_0_10px_rgba(239,68,68,0.8)]",
        text: "text-red-400",
        halo: "rgba(239,68,68,0.3)",
        ring: "rgba(248,113,113,0.7)",
        status: "Active",
        statusChip: "border-red-500/25 bg-red-500/10 text-red-300",
        scan: "rgba(239,68,68,0.55)",
    },
    HIGH: {
        key: "HIGH",
        label: "High",
        chip: "border-orange-500/25 bg-orange-500/10 text-orange-300",
        chipDot: "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.9)]",
        iconWrap: "bg-gradient-to-br from-orange-500/25 to-amber-600/10 ring-orange-400/25 text-orange-400",
        glow: "shadow-[0_0_18px_rgba(249,115,22,0.32)]",
        bar: "bg-gradient-to-b from-orange-400 via-orange-500 to-amber-600 shadow-[0_0_10px_rgba(249,115,22,0.8)]",
        text: "text-orange-400",
        halo: "rgba(249,115,22,0.28)",
        ring: "rgba(251,146,60,0.7)",
        status: "Triaging",
        statusChip: "border-orange-500/25 bg-orange-500/10 text-orange-300",
        scan: "rgba(249,115,22,0.5)",
    },
    MEDIUM: {
        key: "MEDIUM",
        label: "Medium",
        chip: "border-yellow-500/25 bg-yellow-500/10 text-yellow-300",
        chipDot: "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.9)]",
        iconWrap: "bg-gradient-to-br from-yellow-500/25 to-amber-600/10 ring-yellow-400/25 text-yellow-400",
        glow: "shadow-[0_0_18px_rgba(250,204,21,0.28)]",
        bar: "bg-gradient-to-b from-yellow-400 via-amber-500 to-yellow-600 shadow-[0_0_10px_rgba(250,204,21,0.8)]",
        text: "text-yellow-400",
        halo: "rgba(250,204,21,0.26)",
        ring: "rgba(253,224,71,0.65)",
        status: "Queued",
        statusChip: "border-yellow-500/25 bg-yellow-500/10 text-yellow-300",
        scan: "rgba(250,204,21,0.45)",
    },
    LOW: {
        key: "LOW",
        label: "Low",
        chip: "border-sky-500/25 bg-sky-500/10 text-sky-300",
        chipDot: "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]",
        iconWrap: "bg-gradient-to-br from-sky-500/25 to-cyan-600/10 ring-sky-400/25 text-sky-400",
        glow: "shadow-[0_0_18px_rgba(56,189,248,0.26)]",
        bar: "bg-gradient-to-b from-sky-400 via-cyan-500 to-sky-600 shadow-[0_0_10px_rgba(56,189,248,0.8)]",
        text: "text-sky-400",
        halo: "rgba(56,189,248,0.24)",
        ring: "rgba(125,211,252,0.65)",
        status: "Monitored",
        statusChip: "border-sky-500/25 bg-sky-500/10 text-sky-300",
        scan: "rgba(56,189,248,0.42)",
    },
};

export const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export const RESOLVED_THEME = {
    key: "RESOLVED",
    label: "Resolved",
    chip: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    chipDot: "bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.9)]",
    iconWrap: "bg-gradient-to-br from-emerald-500/25 to-teal-600/10 ring-emerald-400/25 text-emerald-400",
    glow: "shadow-[0_0_18px_rgba(52,211,153,0.3)]",
    bar: "bg-gradient-to-b from-emerald-400 via-teal-500 to-emerald-600 shadow-[0_0_10px_rgba(52,211,153,0.8)]",
    text: "text-emerald-400",
    status: "Resolved",
    statusChip: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
};

/* ------------------------------------------------------------------ */
/* Deterministic helpers                                               */
/* ------------------------------------------------------------------ */

function hashStr(value) {
    let h = 2166136261;
    const str = String(value ?? "");
    for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/* ------------------------------------------------------------------ */
/* Attack families + targets (presentation enrichment only)            */
/* ------------------------------------------------------------------ */

export const ATTACK_FAMILIES = [
    { name: "SQL Injection", mitre: "T1190", vector: "Exploit Public-Facing Application" },
    { name: "XSS Probe", mitre: "T1059.007", vector: "Command and Scripting Interpreter" },
    { name: "Brute Force", mitre: "T1110", vector: "Credential Access" },
    { name: "Path Traversal", mitre: "T1083", vector: "File and Directory Discovery" },
    { name: "RCE Attempt", mitre: "T1203", vector: "Exploitation for Client Execution" },
    { name: "Credential Stuffing", mitre: "T1110.004", vector: "Credential Stuffing" },
    { name: "Port Scan", mitre: "T1046", vector: "Network Service Discovery" },
    { name: "Botnet Beacon", mitre: "T1071.001", vector: "Application Layer Protocol" },
    { name: "Malware Download", mitre: "T1105", vector: "Ingress Tool Transfer" },
    { name: "Data Exfil", mitre: "T1048", vector: "Exfiltration Over C2 Channel" },
];

export const TARGET_POOL = [
    "/api/v1/auth/login",
    "/admin/panel/config",
    "/api/v2/users/export",
    "/wp-content/plugins",
    "/graphql",
    "/api/v1/payments",
    "/portal/upload",
    "/rest/endpoint/search",
    "/webmail/session",
    "/api/v1/health",
];

export const PROTOCOL_POOL = ["HTTPS", "HTTP", "TCP", "UDP"];

export const EVIDENCE_POOL = [
    { name: "firewall.log", detail: "Deny rule triggered for source address" },
    { name: "ids_events.json", detail: "Signature match — anomalous request pattern" },
    { name: "auth_audit.log", detail: "Repeated authentication failures observed" },
    { name: "proxy_access.log", detail: "Suspicious outbound request to external host" },
    { name: "dns_queries.log", detail: "DNS lookups matching known-bad domain" },
    { name: "waf_events.log", detail: "Request blocked by WAF rule set" },
];

/* ------------------------------------------------------------------ */
/* Raw → enriched incident                                             */
/* ------------------------------------------------------------------ */

export function enrichAlert(alert, index) {
    const seed = hashStr(`${alert.id}-${alert.message}-${alert.ip_address}`);
    const family = ATTACK_FAMILIES[seed % ATTACK_FAMILIES.length];
    const severity = alert.threat_level && SEVERITY_THEMES[alert.threat_level]
        ? alert.threat_level
        : "MEDIUM";
    const theme = SEVERITY_THEMES[severity];

    /* Deterministic lifecycle: every 5th incident is already resolved. */
    const resolved = index % 5 === 4;

    const createdMs = new Date(alert.created_at).getTime();
    const ts = Number.isFinite(createdMs) ? createdMs : Date.now() - index * 7 * 60000;

    return {
        id: alert.id,
        title: alert.message || `${family.name} detected from ${alert.ip_address}`,
        description: `${family.name.toLowerCase()} traffic observed from ${alert.ip_address} targeting a monitored asset — review immediately.`,
        severity,
        severityTheme: theme,
        status: resolved ? "Resolved" : theme.status,
        resolved,
        source: alert.ip_address,
        sourcePort: 1024 + (seed % 60000),
        target: TARGET_POOL[seed % TARGET_POOL.length],
        targetPort: seed % 2 === 0 ? 443 : 80,
        protocol: PROTOCOL_POOL[seed % PROTOCOL_POOL.length],
        attackType: family.name,
        mitre: family.mitre,
        vector: family.vector,
        confidence: 62 + (seed % 36),
        ruleId: `SR-${String(1000 + (seed % 9000))}`,
        timestamp: ts,
        created_at: alert.created_at,
        ip_address: alert.ip_address,
        message: alert.message,
        threat_level: alert.threat_level,
        evidence: EVIDENCE_POOL.slice(seed % 2, (seed % 2) + 3),
        caseId: `INC-${String(seed % 90000 + 10000)}`,
    };
}

/* ------------------------------------------------------------------ */
/* Curated fallback queue — keeps the workspace cinematic offline      */
/* ------------------------------------------------------------------ */

const FALLBACK_RAW = [
    {
        id: 1,
        ip_address: "185.220.101.34",
        threat_level: "CRITICAL",
        message: "SQL injection attempt blocked on /api/v1/auth/login",
        created_at: new Date(Date.now() - 4 * 60000).toISOString(),
    },
    {
        id: 2,
        ip_address: "45.155.205.12",
        threat_level: "HIGH",
        message: "Brute force detected against /admin/panel/config",
        created_at: new Date(Date.now() - 16 * 60000).toISOString(),
    },
    {
        id: 3,
        ip_address: "91.240.118.77",
        threat_level: "MEDIUM",
        message: "Unusual port scan across internal services",
        created_at: new Date(Date.now() - 41 * 60000).toISOString(),
    },
    {
        id: 4,
        ip_address: "103.27.12.109",
        threat_level: "HIGH",
        message: "Credential stuffing wave against /webmail/session",
        created_at: new Date(Date.now() - 67 * 60000).toISOString(),
    },
    {
        id: 5,
        ip_address: "198.51.100.23",
        threat_level: "MEDIUM",
        message: "Malware hash download blocked from external host",
        created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    },
    {
        id: 6,
        ip_address: "5.188.206.41",
        threat_level: "CRITICAL",
        message: "Remote code execution attempt on /portal/upload",
        created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    },
    {
        id: 7,
        ip_address: "162.19.96.9",
        threat_level: "LOW",
        message: "Suspicious DNS query to known-bad domain",
        created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    },
    {
        id: 8,
        ip_address: "84.17.42.190",
        threat_level: "MEDIUM",
        message: "Path traversal probe on /rest/endpoint/search",
        created_at: new Date(Date.now() - 9 * 3600000).toISOString(),
    },
];

export const FALLBACK_INCIDENTS = FALLBACK_RAW.map((alert, index) =>
    enrichAlert(alert, index)
);

/* ------------------------------------------------------------------ */
/* Time helpers                                                        */
/* ------------------------------------------------------------------ */

export function timeAgo(value) {
    if (!value) return "—";

    const diff = Math.max(0, Date.now() - new Date(value).getTime());
    const mins = Math.floor(diff / 60000);

    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;

    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;

    return new Date(value).toLocaleDateString();
}

export function formatClock(value) {
    return new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

export function formatDateTime(value) {
    return new Date(value).toLocaleString([], {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/* Timeline steps relative to the incident timestamp (minutes ago) */
export function timelineSteps(timestamp) {
    return [
        { key: "detection", label: "Detection", caption: "Anomalous activity identified", offsetMin: 9 },
        { key: "rule", label: "Rule Triggered", caption: "Detection rule matched event stream", offsetMin: 7 },
        { key: "alert", label: "Alert Created", caption: "Incident raised in Sentinel AI", offsetMin: 4 },
        { key: "review", label: "Analyst Review", caption: "Queued for manual triage", offsetMin: 1 },
        { key: "resolved", label: "Resolved", caption: "Case closed by security team", offsetMin: 0 },
    ].map((step, index) => ({
        ...step,
        time: new Date(timestamp - step.offsetMin * 60000).toISOString(),
        state: index === 4 ? "done" : "active",
    }));
}
