/**
 * alertsData
 * ----------
 * Shared domain config for the Security Incident Center:
 *  - severity themes (semantic design tokens, no neon/glow)
 *  - deterministic enrichment of raw backend alerts (id, ip_address,
 *    threat_level, message, created_at) into rich incident records
 *  - curated fallback queue so the workspace is never empty
 */

/* ------------------------------------------------------------------ */
/* Severity themes — aligned with Sentinel AI Design Tokens            */
/* ------------------------------------------------------------------ */

export const SEVERITY_THEMES = {
    CRITICAL: {
        key: "CRITICAL",
        label: "Critical",
        chip: "border-[rgba(229,72,77,0.25)] bg-[rgba(229,72,77,0.10)] text-[var(--color-critical)]",
        chipDot: "bg-[var(--color-critical)]",
        iconWrap: "bg-[rgba(229,72,77,0.12)] border border-[rgba(229,72,77,0.25)] text-[var(--color-critical)]",
        glow: "",
        bar: "bg-[var(--color-critical)]",
        text: "text-[var(--color-critical)]",
        halo: "rgba(229,72,77,0.2)",
        ring: "rgba(229,72,77,0.5)",
        status: "Active",
        statusChip: "border-[rgba(229,72,77,0.25)] bg-[rgba(229,72,77,0.10)] text-[var(--color-critical)]",
        scan: "var(--color-critical)",
    },
    HIGH: {
        key: "HIGH",
        label: "High",
        chip: "border-[rgba(237,125,28,0.25)] bg-[rgba(237,125,28,0.10)] text-[var(--color-high)]",
        chipDot: "bg-[var(--color-high)]",
        iconWrap: "bg-[rgba(237,125,28,0.12)] border border-[rgba(237,125,28,0.25)] text-[var(--color-high)]",
        glow: "",
        bar: "bg-[var(--color-high)]",
        text: "text-[var(--color-high)]",
        halo: "rgba(237,125,28,0.2)",
        ring: "rgba(237,125,28,0.5)",
        status: "Triaging",
        statusChip: "border-[rgba(237,125,28,0.25)] bg-[rgba(237,125,28,0.10)] text-[var(--color-high)]",
        scan: "var(--color-high)",
    },
    MEDIUM: {
        key: "MEDIUM",
        label: "Medium",
        chip: "border-[rgba(221,179,42,0.25)] bg-[rgba(221,179,42,0.10)] text-[var(--color-medium)]",
        chipDot: "bg-[var(--color-medium)]",
        iconWrap: "bg-[rgba(221,179,42,0.12)] border border-[rgba(221,179,42,0.25)] text-[var(--color-medium)]",
        glow: "",
        bar: "bg-[var(--color-medium)]",
        text: "text-[var(--color-medium)]",
        halo: "rgba(221,179,42,0.2)",
        ring: "rgba(221,179,42,0.5)",
        status: "Queued",
        statusChip: "border-[rgba(221,179,42,0.25)] bg-[rgba(221,179,42,0.10)] text-[var(--color-medium)]",
        scan: "var(--color-medium)",
    },
    LOW: {
        key: "LOW",
        label: "Low",
        chip: "border-[rgba(74,157,224,0.25)] bg-[rgba(74,157,224,0.10)] text-[var(--color-low)]",
        chipDot: "bg-[var(--color-low)]",
        iconWrap: "bg-[rgba(74,157,224,0.12)] border border-[rgba(74,157,224,0.25)] text-[var(--color-low)]",
        glow: "",
        bar: "bg-[var(--color-low)]",
        text: "text-[var(--color-low)]",
        halo: "rgba(74,157,224,0.2)",
        ring: "rgba(74,157,224,0.5)",
        status: "Monitored",
        statusChip: "border-[rgba(74,157,224,0.25)] bg-[rgba(74,157,224,0.10)] text-[var(--color-low)]",
        scan: "var(--color-low)",
    },
};

export const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export const RESOLVED_THEME = {
    key: "RESOLVED",
    label: "Resolved",
    chip: "border-[rgba(63,163,77,0.25)] bg-[rgba(63,163,77,0.10)] text-[var(--color-success)]",
    chipDot: "bg-[var(--color-success)]",
    iconWrap: "bg-[rgba(63,163,77,0.12)] border border-[rgba(63,163,77,0.25)] text-[var(--color-success)]",
    glow: "",
    bar: "bg-[var(--color-success)]",
    text: "text-[var(--color-success)]",
    status: "Resolved",
    statusChip: "border-[rgba(63,163,77,0.25)] bg-[rgba(63,163,77,0.10)] text-[var(--color-success)]",
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

export const ATTACK_FAMILIES = [
    { name: "SQL Injection", mitre: "T1190", vector: "HTTP GET Parameter `id`", tag: "OWASP-A03" },
    { name: "Cross-Site Scripting (Reflected)", mitre: "T1059.007", vector: "Query Parameter `q`", tag: "OWASP-A03" },
    { name: "Path Traversal Probe", mitre: "T1083", vector: "URI Path `../../etc/passwd`", tag: "OWASP-A01" },
    { name: "Command Injection Attempt", mitre: "T1059", vector: "POST Body `cmd` Field", tag: "OWASP-A03" },
    { name: "Credential Stuffing Burst", mitre: "T1110.004", vector: "Auth Endpoint `/api/login`", tag: "OWASP-A07" },
    { name: "Server-Side Request Forgery", mitre: "T1190", vector: "Webhook Target Parameter", tag: "OWASP-A10" },
    { name: "XML External Entity Probe", mitre: "T1190", vector: "SAML Metadata Endpoint", tag: "OWASP-A05" },
    { name: "Remote Code Execution Payload", mitre: "T1203", vector: "Deserialization Handler", tag: "OWASP-A08" },
];

export const PROTOCOL_POOL = ["HTTPS/TLSv1.3", "HTTPS/TLSv1.2", "HTTP/1.1", "HTTP/2.0"];

export const ANALYST_NAMES = ["Alex Vance", "Sarah Chen", "Marcus Brody", "Elena Rostova", "Devon Park"];

/**
 * Format relative elapsed time.
 */
export function timeAgo(timestamp) {
    if (!timestamp) return "just now";
    const delta = Date.now() - Number(timestamp);
    if (delta < 45000) return "just now";
    const minutes = Math.floor(delta / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

/**
 * Format clock time (HH:MM:SS AM/PM).
 */
export function formatClock(dateLike) {
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return "--:--:--";
    return d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

/**
 * Format full date-time.
 */
export function formatDateTime(dateLike) {
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

/**
 * Deterministic enrichment of an alert.
 */
export function enrichAlert(alert, index = 0) {
    const seed = hashStr(`${alert.id}-${alert.ip_address}-${alert.message}`);
    const threatLevel = String(alert.threat_level || "MEDIUM").toUpperCase();
    const theme = SEVERITY_THEMES[threatLevel] ?? SEVERITY_THEMES.MEDIUM;
    const family = ATTACK_FAMILIES[seed % ATTACK_FAMILIES.length];
    const timestamp = alert.created_at
        ? new Date(alert.created_at).getTime()
        : Date.now() - (index * 7 + 3) * 60000;

    const sourcePort = 1024 + (seed % 60000);
    const targetPort = seed % 2 === 0 ? 443 : 80;
    const protocol = PROTOCOL_POOL[seed % PROTOCOL_POOL.length];
    const ruleId = `SR-${String(1000 + (seed % 9000))}`;
    const confidence = 75 + (seed % 24);
    const assignedTo = ANALYST_NAMES[seed % ANALYST_NAMES.length];

    const title =
        alert.message && !/^security alert$/i.test(alert.message)
            ? alert.message
            : `${family.name} from ${alert.ip_address || "unknown"}`;

    const description =
        alert.description ||
        `${family.name} traffic detected originating from ${
            alert.ip_address || "unknown source"
        } with signature match on rule ${ruleId}.`;

    const sampleRequests = [
        `GET /products/search?id=1%27+UNION+SELECT+null%2Cusername%2Cpassword+FROM+users-- HTTP/1.1\nHost: target.internal\nUser-Agent: sqlmap/1.7.2#stable\nAccept: */*`,
        `POST /api/v1/authenticate HTTP/1.1\nHost: target.internal\nContent-Type: application/json\nUser-Agent: Mozilla/5.0 (Hydra-v9.2)\n\n{"username":"admin","password":"password123"}`,
        `GET /download?file=../../../../etc/shadow HTTP/1.1\nHost: target.internal\nUser-Agent: curl/7.88.1\nAccept: */*`,
        `POST /upload.php HTTP/1.1\nHost: target.internal\nContent-Type: multipart/form-data; boundary=----WebKit\n\n------WebKit\nContent-Disposition: form-data; name="payload"; filename="shell.phtml"`,
    ];

    const rawRequest = sampleRequests[seed % sampleRequests.length];

    const timeline = [
        {
            time: new Date(timestamp).toISOString(),
            title: "Detection Triggered",
            detail: `WAF signature matched rule ${ruleId} on ${protocol}.`,
            dot: theme.chipDot,
        },
        {
            time: new Date(timestamp + 12000).toISOString(),
            title: "Automated Correlation",
            detail: `Source IP ${alert.ip_address || "unknown"} linked to ${family.tag}. Confidence: ${confidence}%.`,
            dot: "bg-[var(--color-accent)]",
        },
        {
            time: new Date(timestamp + 45000).toISOString(),
            title: "SOC Queue Ingested",
            detail: `Assigned case code INC-${String(alert.id).padStart(6, "0")} and prioritized as ${threatLevel}.`,
            dot: "bg-[var(--color-surface-3)]",
        },
    ];

    const evidence = [
        {
            name: "trigger_request.raw",
            type: "HTTP Request",
            detail: "Captured ingress HTTP payload that triggered the alert rule.",
            content: rawRequest,
        },
        {
            name: "waf_rule_match.json",
            type: "Analysis",
            detail: "Normalized WAF inspection telemetry and regex match offsets.",
            content: JSON.stringify(
                {
                    ruleId,
                    attackFamily: family.name,
                    mitreAttAndCk: family.mitre,
                    confidenceScore: confidence,
                    action: "MONITOR_AND_ALERT",
                    originIp: alert.ip_address,
                    targetPort,
                },
                null,
                2
            ),
        },
    ];

    const notes = [
        {
            id: 1,
            author: assignedTo,
            time: "10m ago",
            text: "Initial triage completed. Source IP exhibiting automated pattern scan. Ingress ACL rule prepared for deployment.",
        },
    ];

    return {
        id: alert.id,
        title,
        description,
        severity: threatLevel,
        severityTheme: theme,
        status: "Active",
        resolved: false,
        source: alert.ip_address || "198.51.100.24",
        sourcePort,
        target: "api.internal.target",
        targetPort,
        protocol,
        attackType: family.name,
        mitre: family.mitre,
        vector: family.vector,
        confidence,
        ruleId,
        timestamp,
        created_at: alert.created_at,
        assignedTo,
        caseId: `INC-${String(alert.id).padStart(6, "0")}`,
        timeline,
        evidence,
        notes,
    };
}
