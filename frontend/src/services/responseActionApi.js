import { authFetch, BASE_URL } from "./authClient";

export async function getResponseActions(incidentId) {
    const url = incidentId
        ? `${BASE_URL}/response-actions/incident/${incidentId}`
        : `${BASE_URL}/response-actions/`;
    const response = await authFetch(url);
    if (!response.ok) throw new Error("Failed to fetch response actions");
    return response.json();
}

export async function createResponseAction(incidentId, actionData) {
    const response = await authFetch(`${BASE_URL}/response-actions/?incident_id=${incidentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actionData),
    });
    if (!response.ok) throw new Error("Failed to create response action");
    return response.json();
}

export async function executeResponseAction(actionId) {
    const response = await authFetch(`${BASE_URL}/response-actions/${actionId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to execute response action");
    }
    return response.json();
}
