const BASE_URL = "http://127.0.0.1:8000";

export async function getDashboardStats() {
    const response = await fetch(`${BASE_URL}/dashboard/stats`);

    if (!response.ok) {
        throw new Error("Failed to fetch dashboard stats");
    }

    return response.json();
}

export async function getRecentLogs() {
    const response = await fetch(`${BASE_URL}/logs/recent`);

    if (!response.ok) {
        throw new Error("Failed to fetch recent logs");
    }

    return response.json();
}

export async function getRecentAlerts() {
    const response = await fetch(`${BASE_URL}/alerts/recent`);

    if (!response.ok) {
        throw new Error("Failed to fetch alerts");
    }

    return response.json();
}