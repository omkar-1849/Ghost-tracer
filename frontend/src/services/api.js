import { collectPages } from "./evidence.js";
import { authFetch, BASE_URL } from "./authClient";



/* ------------------------------------------------------------------ */
/* Dashboard Endpoints                                                */
/* ------------------------------------------------------------------ */

export async function getDashboardStats() {
    const response = await authFetch(`${BASE_URL}/dashboard/stats`);
    if (!response.ok) throw new Error("Failed to fetch dashboard stats");
    return response.json();
}

export async function getSecurityScore() {
    const response = await authFetch(`${BASE_URL}/dashboard/security-score`);
    if (!response.ok) throw new Error("Failed to fetch security score");
    return response.json();
}

export async function getThreatActivity() {
    const response = await authFetch(`${BASE_URL}/dashboard/threat-activity`);
    if (!response.ok) throw new Error("Failed to fetch threat activity");
    return response.json();
}

export async function getLiveFeed() {
    const response = await authFetch(`${BASE_URL}/dashboard/live-feed`);
    if (!response.ok) throw new Error("Failed to fetch live feed");
    return response.json();
}

export async function getTopAttackingIPs() {
    const response = await authFetch(`${BASE_URL}/dashboard/top-attacking-ips`);
    if (!response.ok) throw new Error("Failed to fetch top attacking IPs");
    return response.json();
}

export async function getThreatDistribution() {
    const response = await authFetch(`${BASE_URL}/dashboard/threat-distribution`);
    if (!response.ok) throw new Error("Failed to fetch threat distribution");
    return response.json();
}

export async function getTopTargetedURLs() {
    const response = await authFetch(`${BASE_URL}/dashboard/top-targeted-urls`);
    if (!response.ok) throw new Error("Failed to fetch top targeted URLs");
    return response.json();
}

export async function getAttackTypes() {
    const response = await authFetch(`${BASE_URL}/dashboard/attack-types`);
    if (!response.ok) throw new Error("Failed to fetch attack types");
    return response.json();
}

/* ------------------------------------------------------------------ */
/* Security Logs & Events Pipeline                                    */
/* ------------------------------------------------------------------ */

export async function getRecentLogs() {
    const response = await authFetch(`${BASE_URL}/logs/recent`);
    if (!response.ok) throw new Error("Failed to fetch recent logs");
    return response.json();
}

export async function getRecentAlerts() {
    const response = await authFetch(`${BASE_URL}/alerts/recent`);
    if (!response.ok) throw new Error("Failed to fetch alerts");
    return response.json();
}

export async function getEventsByWebsite(websiteId) {
    const response = await authFetch(`${BASE_URL}/events/${websiteId}`);
    if (!response.ok) throw new Error(`Failed to fetch events for website ${websiteId}`);
    return response.json();
}

export async function getEventDetail(eventId) {
    const response = await authFetch(`${BASE_URL}/events/detail/${eventId}`);
    if (!response.ok) throw new Error(`Failed to fetch event detail for ${eventId}`);
    return response.json();
}

/* ------------------------------------------------------------------ */
/* Incidents & Investigation                                          */
/* ------------------------------------------------------------------ */

export async function getIncidents(params = {}) {
    const filters = { ...params };
    delete filters.limit;
    delete filters.offset;
    return collectPages(async ({ limit, offset }) => {
        const clean = Object.fromEntries(Object.entries({ ...filters, limit, offset }).filter((entry) => entry[1] !== undefined && entry[1] !== null && entry[1] !== ""));
        const response = await authFetch(`${BASE_URL}/incidents/?${new URLSearchParams(clean)}`);
        return response.json();
    });
}

export async function getIncidentById(id) {
    const response = await authFetch(`${BASE_URL}/incidents/${id}`);
    if (!response.ok) throw new Error(`Failed to fetch incident ${id}`);
    return response.json();
}

export async function updateIncidentStatus(id, status) {
    const response = await authFetch(`${BASE_URL}/incidents/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
    });
    if (!response.ok) throw new Error("Failed to update incident status");
    return response.json();
}

export async function assignIncident(id, assigned_to) {
    const response = await authFetch(`${BASE_URL}/incidents/${id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_to }),
    });
    if (!response.ok) throw new Error("Failed to assign incident");
    return response.json();
}

export async function getIncidentStatistics() {
    const response = await authFetch(`${BASE_URL}/incidents/statistics/overview`);
    if (!response.ok) throw new Error("Failed to fetch incident statistics");
    return response.json();
}

export async function addIncidentNote(id, note) {
    const response = await authFetch(`${BASE_URL}/incidents/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
    });
    if (!response.ok) throw new Error("Failed to add incident note");
    return response.json();
}

export async function getIncidentTimeline(id) {
    const response = await authFetch(`${BASE_URL}/incidents/${id}/timeline`);
    if (!response.ok) throw new Error("Failed to fetch incident timeline");
    return response.json();
}

export async function getIncidentEvidence(id) {
    const response = await authFetch(`${BASE_URL}/incidents/${id}/evidence`);
    if (!response.ok) throw new Error("Failed to fetch incident evidence");
    return response.json();
}

/* ------------------------------------------------------------------ */
/* Response Actions                                                   */
/* ------------------------------------------------------------------ */

export async function getResponseActionsByIncident(incidentId) {
    const response = await authFetch(`${BASE_URL}/response-actions/incident/${incidentId}`);
    if (!response.ok) throw new Error(`Failed to fetch response actions for incident ${incidentId}`);
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
    if (!response.ok) throw new Error("Failed to execute response action");
    return response.json();
}