import { authFetch, BASE_URL } from "./authClient";

const API_URL = `${BASE_URL}/audit-logs`;

async function getErrorMessage(response) {
    try {
        const payload = await response.json();
        return payload?.detail || `Request failed (${response.status})`;
    } catch {
        return `Request failed (${response.status})`;
    }
}

/**
 * Read the current user's organization-scoped audit log. The endpoint owns
 * authorization and returns the newest records first.
 *
 * Uses the centralized authFetch client so that the stored JWT is
 * automatically included in the Authorization header.
 */
export async function getAuditLogs({ limit = 100, signal } = {}) {
    const params = new URLSearchParams({ limit: String(limit) });
    const response = await authFetch(`${API_URL}?${params}`, { signal });

    if (!response.ok) {
        throw new Error(await getErrorMessage(response));
    }

    return response.json();
}
