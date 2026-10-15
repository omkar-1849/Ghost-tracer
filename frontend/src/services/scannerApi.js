import { authFetch, BASE_URL } from "./authClient";
import { getWebsites } from "./websiteApi";

const API_URL = BASE_URL;

// Backend engine value -> display name and frontend tab id.
const ENGINE_META = {
    sqlmap: { name: "SQLMap", tabId: "sqlmap" },
    nmap: { name: "Nmap", tabId: "nmap" },
    nuclei: { name: "Nuclei", tabId: "nuclei" },
    nikto: { name: "Nikto", tabId: "nikto" },
    zap: { name: "OWASP ZAP", tabId: "owasp-zap" },
    ssl: { name: "SSL Analyzer", tabId: "ssl-analyzer" },
};

export function engineDisplayName(engine) {
    return ENGINE_META[engine]?.name || engine || "Unknown";
}

export function engineTabId(engine) {
    return ENGINE_META[engine]?.tabId || engine;
}

function mapScanToFrontend(scan) {
    if (!scan) return null;
    return {
        id: scan.id,
        website_id: scan.website_id,
        engine: scan.engine,                                  // raw backend value
        engineId: engineTabId(scan.engine),                   // frontend tab id
        scanner: engineDisplayName(scan.engine),              // display name for rows
        target: scan.target,
        status: scan.status,
        findings: scan.findings,
        risk_score: scan.risk_score,
        command: scan.command,
        raw_output: scan.raw_output,
        parsed_output: scan.parsed_output,
        error: scan.error,
        truncated: scan.truncated === true,
        created_at: scan.started_at,
        started_at: scan.started_at,
        completed_at: scan.completed_at,
    };
}

async function request(url, options = {}) {
    const response = await authFetch(url, options);

    if (!response.ok) {
        let message = null;
        try {
            const error = await response.json();
            message = error.detail && Array.isArray(error.detail)
                ? error.detail[0].msg
                : error.detail;
        } catch {
            // Non-JSON error body — fall through to the generic message.
        }
        throw new Error(message || `Request failed (${response.status})`);
    }

    return response.json();
}

export async function startScan(websiteId, engine, profile = null) {
    const payload = { website_id: websiteId, engine };
    if (profile) payload.profile = profile;
    const data = await request(`${API_URL}/scans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return mapScanToFrontend(data);
}

export async function getAllScans() {
    const data = await request(`${API_URL}/scans`);
    return data.map(mapScanToFrontend);
}

export async function getScanById(scanId) {
    const data = await request(`${API_URL}/scans/${scanId}`);
    return mapScanToFrontend(data);
}

export async function getScanReport(scanId) {
    return request(`${API_URL}/scanner/${scanId}/report`);
}

export async function getScanFindings(scanId) {
    return request(`${API_URL}/scans/${scanId}/findings`);
}

export async function getScanInvestigation(scanId) {
    return request(`${API_URL}/scans/${scanId}/investigation`);
}

export async function triggerScanInvestigation(scanId) {
    return request(`${API_URL}/scans/${scanId}/investigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });
}

export async function getFindings(filters = {}) {
    const params = new URLSearchParams();
    if (filters.website_id) params.set("website_id", filters.website_id);
    if (filters.status) params.set("status", filters.status);
    if (filters.severity) params.set("severity", filters.severity);
    if (filters.engine) params.set("engine", filters.engine);
    const qs = params.toString();
    return request(`${API_URL}/findings${qs ? `?${qs}` : ""}`);
}

export async function getFindingById(findingId) {
    return request(`${API_URL}/findings/${findingId}`);
}

export async function updateFindingStatus(findingId, status) {
    return request(`${API_URL}/findings/${findingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
    });
}

export async function getInvestigations(filters = {}) {
    const params = new URLSearchParams();
    if (filters.website_id) params.set("website_id", filters.website_id);
    if (filters.status) params.set("status", filters.status);
    const qs = params.toString();
    return request(`${API_URL}/investigations${qs ? `?${qs}` : ""}`);
}

export async function getInvestigationById(investigationId) {
    return request(`${API_URL}/investigations/${investigationId}`);
}

export async function cancelInvestigation(investigationId) {
    return request(`${API_URL}/investigations/${investigationId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });
}

export async function cancelScan(scanId) {
    const data = await request(`${API_URL}/scanner/${scanId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });
    return mapScanToFrontend(data);
}

export async function deleteScan(scanId) {
    return request(`${API_URL}/scans/${scanId}`, { method: "DELETE" });
}

export async function getScannerEngines() {
    const data = await request(`${API_URL}/scanner/engines`);
    return data.engines || [];
}

export { getWebsites };
