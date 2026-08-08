const API_URL = "http://127.0.0.1:8000/websites";

function mapToFrontend(backend) {
    if (!backend) return null;
    return {
        id: backend.id,
        name: backend.name,
        url: backend.url,
        domain: backend.domain,
        ipAddress: backend.ip_address,
        description: backend.description,
        environment: backend.environment,
        status: backend.status,
        health: backend.health_status,
        securityScore: backend.security_score,
        owner: backend.owner,
        faviconUrl: backend.favicon_url,
        monitoringEnabled: backend.monitoring_enabled,
        tags: backend.tags,
        notes: backend.notes,
        lastScan: backend.last_scan,
        createdAt: backend.created_at,
        updatedAt: backend.updated_at,
        // Website Ownership Verification
        verified: backend.verified ?? false,
        verificationMethod: backend.verification_method || null,
        verificationToken: backend.verification_token || null,
        verifiedAt: backend.verified_at || null,
    };
}

function mapToBackend(frontend) {
    if (!frontend) return null;
    return {
        name: frontend.name,
        url: frontend.url,
        description: frontend.description,
        environment: frontend.environment,
        status: frontend.status,
        health_status: frontend.health || "Unknown",
        owner: frontend.owner,
        favicon_url: frontend.faviconUrl,
        monitoring_enabled: frontend.monitoringEnabled ?? true,
        tags: frontend.tags,
        notes: frontend.notes,
    };
}

export async function getWebsites() {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Failed to fetch websites");
    const data = await res.json();
    return data.map(mapToFrontend);
}

export async function searchWebsites(query) {
    if (!query) return getWebsites();
    const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error("Failed to search websites");
    const data = await res.json();
    return data.map(mapToFrontend);
}

export async function createWebsite(frontendData) {
    const payload = mapToBackend(frontendData);
    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const error = await res.json();
        const msg = error.detail && Array.isArray(error.detail) ? error.detail[0].msg : error.detail;
        throw new Error(msg || "Failed to create website");
    }
    const data = await res.json();
    return mapToFrontend(data);
}

export async function updateWebsite(id, frontendData) {
    const payload = mapToBackend(frontendData);
    const res = await fetch(`${API_URL}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const error = await res.json();
        const msg = error.detail && Array.isArray(error.detail) ? error.detail[0].msg : error.detail;
        throw new Error(msg || "Failed to update website");
    }
    const data = await res.json();
    return mapToFrontend(data);
}

export async function deleteWebsite(id) {
    const res = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
    });
    if (!res.ok) {
        throw new Error("Failed to delete website");
    }
    return true;
}

/* ------------------------------------------------------------------
 * Website Ownership Verification
 * ------------------------------------------------------------------ */

/** Resolve a common error shape ({detail: string | [{msg}]}) to a message. */
async function errorMessage(res) {
    try {
        const error = await res.json();
        return error && error.detail && Array.isArray(error.detail)
            ? error.detail[0].msg
            : (error?.detail || `Request failed (${res.status})`);
    } catch {
        return `Request failed (${res.status})`;
    }
}

export async function getVerificationToken(websiteId) {
    const res = await fetch(`${API_URL}/${websiteId}/verification-token`);
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
}

export async function verifyWebsite(websiteId, method) {
    const res = await fetch(`${API_URL}/${websiteId}/verify/${encodeURIComponent(method)}`, {
        method: "POST",
    });
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
}

/* ------------------------------------------------------------------
 * Website Integration (SDK / API keys)
 * ------------------------------------------------------------------ */

export async function getIntegration(websiteId) {
    const res = await fetch(`${API_URL}/${websiteId}/integration`);
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
}

export async function connectWebsite(websiteId) {
    const res = await fetch(`${API_URL}/${websiteId}/connect`, {
        method: "POST",
    });
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
}

export async function regenerateIntegrationKeys(websiteId) {
    const res = await fetch(`${API_URL}/${websiteId}/regenerate-key`, {
        method: "POST",
    });
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
}

export async function disconnectWebsite(websiteId) {
    const res = await fetch(`${API_URL}/${websiteId}/disconnect`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
}
