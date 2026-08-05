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

export async function getTopAttackingIPs() {
    const response = await fetch(
        `${BASE_URL}/dashboard/top-attacking-ips`
    );

    if (!response.ok) {
        throw new Error("Failed to fetch top attacking IPs");
    }

    return response.json();
}

export async function getThreatActivity() {
    const response = await fetch(
        `${BASE_URL}/dashboard/threat-activity`
    );

    if (!response.ok) {
        throw new Error("Failed to fetch threat activity");
    }

    return response.json();
}

export async function getThreatDistribution() {
    const response = await fetch(
        `${BASE_URL}/dashboard/threat-distribution`
    );

    if (!response.ok) {
        throw new Error("Failed to fetch threat distribution");
    }

    return response.json();
}

export async function getTopTargetedURLs() {
    const response = await fetch(
        `${BASE_URL}/dashboard/top-targeted-urls`
    );

    if (!response.ok) {
        throw new Error("Failed to fetch top targeted URLs");
    }

    return response.json();
}

export async function getSecurityScore() {
    const response = await fetch(
        `${BASE_URL}/dashboard/security-score`
    );

    if (!response.ok) {
        throw new Error("Failed to fetch security score");
    }

    return response.json();
}

export async function getAttackTypes() {
    const response = await fetch(
        `${BASE_URL}/dashboard/attack-types`
    );

    if (!response.ok) {
        throw new Error("Failed to fetch attack types");
    }

    return response.json();
}

export async function getLiveFeed() {
    const response = await fetch(
        `${BASE_URL}/dashboard/live-feed`
    );

    if (!response.ok) {
        throw new Error("Failed to fetch live feed");
    }

    return response.json();
}

export async function runSqlmapScan(target) {
    const response = await fetch(`${BASE_URL}/scanner/sqlmap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
    });

    if (!response.ok) {
        throw new Error("Failed to start SQLMap scan");
    }

    return response.json();
}


export async function getScanById(scanId) {
    const response = await fetch(`${BASE_URL}/scanner/${scanId}`);

    if (!response.ok) {
        throw new Error("Failed to fetch scan details");
    }

    return response.json();
}


export async function startSQLMapScan(target) {
    const response = await fetch(`${BASE_URL}/scanner/sqlmap`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            target,
        }),
    });

    if (!response.ok)
        throw new Error("Failed to start scan");

    return response.json();
}

export async function getScanHistory() {
    const response = await fetch(`${BASE_URL}/scanner/history`);

    if (!response.ok)
        throw new Error("Failed to fetch scan history");

    return response.json();
}

export async function getScanReport(id) {
    const response = await fetch(`${BASE_URL}/scanner/report/${id}`);

    if (!response.ok)
        throw new Error("Failed to fetch report");

    return response.json();
}

export async function cancelScan(id) {
    const response = await fetch(`${BASE_URL}/scanner/${id}/cancel`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
    });

    if (!response.ok)
        throw new Error("Failed to cancel scan");

    return response.json();
}

export async function getIncidents(params = {}) {
    const query = new URLSearchParams(params).toString();

    const url = `${BASE_URL}/incidents/${query ? `?${query}` : ""}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Failed to fetch incidents");
    }

    return response.json();
}

export async function getIncidentById(id) {
    const response = await fetch(`${BASE_URL}/incidents/${id}`);

    if (!response.ok)
        throw new Error("Failed to fetch incident");

    return response.json();
}

export async function updateIncidentStatus(id, status) {
    const response = await fetch(
        `${BASE_URL}/incidents/${id}/status`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                status,
            }),
        }
    );

    if (!response.ok)
        throw new Error("Failed to update incident");

    return response.json();
}

export async function assignIncident(id, assigned_to) {
    const response = await fetch(
        `${BASE_URL}/incidents/${id}/assign`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                assigned_to,
            }),
        }
    );

    if (!response.ok)
        throw new Error("Failed to assign incident");

    return response.json();
}

export async function getIncidentStatistics() {
    const response = await fetch(
        `${BASE_URL}/incidents/statistics/overview`
    );

    if (!response.ok)
        throw new Error("Failed to fetch incident statistics");

    return response.json();
}

export async function addIncidentNote(id, analyst, note) {
    const response = await fetch(
        `${BASE_URL}/incidents/${id}/notes`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                analyst,
                note,
            }),
        }
    );

    if (!response.ok)
        throw new Error("Failed to add incident note");

    return response.json();
}