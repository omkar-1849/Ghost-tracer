// Pure display helpers: unknown/incomplete evidence must not become assurance.
export function safeHttpUrl(value) {
    try {
        const url = new URL(value);
        return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
    } catch { return undefined; }
}
export function scanCompleteness(scan = {}) {
    const status = String(scan.status || "UNKNOWN").toUpperCase();
    const truncated = scan.truncated === true || scan.parsed_output?.truncated === true;
    return { status, truncated, complete: status === "COMPLETED" && !truncated,
        label: `${status}${truncated ? " — TRUNCATED" : ""}` };
}
export function severityBreakdown(report) {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const explicit = report?.summary?.severity_breakdown || report?.risk_breakdown;
    if (explicit) {
        for (const key of Object.keys(counts)) counts[key] = Math.max(0, Number(explicit[key]) || 0);
        return counts;
    }
    const list = report?.findings;
    if (Array.isArray(list)) {
        for (const finding of list) {
            const key = String(finding.severity || "info").toLowerCase();
            counts[key in counts ? key : "info"] += 1;
        }
    } else if (list && typeof list === "object") {
        counts.critical = Array.isArray(list.critical) ? list.critical.length : 0;
        counts.high = Array.isArray(list.warnings) ? list.warnings.length : 0;
        // Match SQLMap's persisted headline: injectable + critical + warnings + databases.
        if (list.injectable === true) counts.critical += 1;
        counts.info = Array.isArray(list.databases) ? list.databases.length : 0;
    }
    return counts;
}
export async function collectPages(loadPage, limit = 100) {
    const result = [];
    const seen = new Set();
    for (let offset = 0; ; offset += limit) {
        const page = await loadPage({ limit, offset });
        if (!Array.isArray(page)) throw new Error("Invalid collection response");
        for (const item of page) {
            if (seen.has(item.id)) throw new Error("Collection changed while loading; retry to load all records.");
            seen.add(item.id);
            result.push(item);
        }
        if (page.length < limit) return result;
    }
}
