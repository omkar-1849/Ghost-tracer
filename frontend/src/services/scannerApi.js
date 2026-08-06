import { getWebsites } from "./websiteApi";

const API_URL = "http://127.0.0.1:8000";

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
        created_at: scan.started_at,
        started_at: scan.started_at,
        completed_at: scan.completed_at,
    };
}

async function request(url, options = {}) {
    const response = await fetch(url, options);

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

export async function startScan(websiteId, engine) {
    const data = await request(`${API_URL}/scanner/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website_id: websiteId, engine }),
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
