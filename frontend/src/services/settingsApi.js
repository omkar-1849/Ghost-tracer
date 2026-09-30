import { authFetch, BASE_URL } from "./authClient";

const API_URL = `${BASE_URL}/settings`;

function mapToFrontend(backend) {
    if (!backend) return null;
    return {
        orgName: backend.organization_name,
        platformName: backend.platform_name,
        timezone: backend.timezone,
        region: backend.region,
        defaultScanner: backend.default_scanner,
        concurrentScans: backend.concurrent_scans,
        scanTimeout: backend.scan_timeout,
        proxy: backend.proxy,
        sqlmapPath: backend.sqlmap_path,
        sqlmapRisk: backend.risk_level,
        randomAgent: backend.random_user_agent,
        followRedirects: backend.follow_redirects,
        aiEnabled: backend.ai_enabled,
        aiProvider: backend.ai_provider,
        aiModel: backend.ai_model,
        aiKey: "",
        aiKeyConfigured: backend.api_key_configured === true,
        aiTemp: backend.temperature,
        aiContext: backend.context_length,
        aiSummaries: backend.auto_summary,
        aiRemediation: backend.auto_remediation,
        sessionTimeout: backend.session_timeout,
        auditLogging: backend.audit_logging,
        emailAlerts: backend.email_notifications,
        desktopAlerts: backend.desktop_notifications,
    };
}

function mapToBackend(frontend) {
    if (!frontend) return null;
    return {
        organization_name: frontend.orgName,
        platform_name: frontend.platformName,
        timezone: frontend.timezone,
        region: frontend.region,
        default_scanner: frontend.defaultScanner,
        concurrent_scans: parseInt(frontend.concurrentScans, 10),
        scan_timeout: parseInt(frontend.scanTimeout, 10),
        proxy: frontend.proxy,
        sqlmap_path: frontend.sqlmapPath,
        risk_level: frontend.sqlmapRisk,
        random_user_agent: frontend.randomAgent,
        follow_redirects: frontend.followRedirects,
        ai_enabled: frontend.aiEnabled,
        ai_provider: frontend.aiProvider,
        ai_model: frontend.aiModel,
        ...(frontend.aiKey?.trim() ? { api_key: frontend.aiKey.trim() } : {}),
        temperature: parseFloat(frontend.aiTemp),
        context_length: parseInt(frontend.aiContext, 10),
        auto_summary: frontend.aiSummaries,
        auto_remediation: frontend.aiRemediation,
        session_timeout: parseInt(frontend.sessionTimeout, 10),
        audit_logging: frontend.auditLogging,
        email_notifications: frontend.emailAlerts,
        desktop_notifications: frontend.desktopAlerts,
    };
}

export async function getSettings() {
    const res = await authFetch(API_URL);
    if (!res.ok) throw new Error("Failed to fetch settings");
    const data = await res.json();
    return mapToFrontend(data);
}

export async function updateSettings(frontendSettings) {
    const backendPayload = mapToBackend(frontendSettings);
    const res = await authFetch(API_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backendPayload),
    });
    
    if (!res.ok) {
        const error = await res.json();
        const msg = error.detail && Array.isArray(error.detail) 
            ? error.detail[0].msg 
            : error.detail;
        throw new Error(msg || "Failed to update settings");
    }
    
    const data = await res.json();
    return mapToFrontend(data);
}

export async function resetSettings() {
    const res = await authFetch(`${API_URL}/reset`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to reset settings");
    const data = await res.json();
    return mapToFrontend(data);
}

export async function exportSettings() {
    const res = await authFetch(`${API_URL}/export`);
    if (!res.ok) throw new Error("Failed to export settings");
    const data = await res.json();
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentinel-settings-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function importSettings(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const configData = JSON.parse(e.target.result);
                const res = await authFetch(`${API_URL}/import`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(configData),
                });
                
                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.detail || "Failed to import settings");
                }
                
                const data = await res.json();
                resolve(mapToFrontend(data));
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
    });
}
