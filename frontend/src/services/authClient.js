/**
 * Centralized authentication client for Sentinel AI.
 *
 * Provides login, token management, and an authenticated fetch wrapper.
 * All protected API services should import `authFetch` from this module
 * rather than implementing their own token logic.
 *
 * Uses the same base URL pattern already established by the other
 * service modules (api.js, settingsApi.js, etc.).
 */

const BASE_URL = "http://127.0.0.1:8000";
const TOKEN_KEY = "sentinel_access_token";

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

/** Retrieve the stored JWT access token. */
export function getToken() {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(TOKEN_KEY);
}

/** Store a JWT access token in session storage. */
export function setToken(token) {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(TOKEN_KEY, token);
}

/** Clear the stored token (logout / session expiry). */
export function clearToken() {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(TOKEN_KEY);
}

/** Returns true when a token is currently stored. */
export function isAuthenticated() {
    return !!getToken();
}

// ---------------------------------------------------------------------------
// Login / Logout
// ---------------------------------------------------------------------------

/**
 * Authenticate against the Sentinel AI backend.
 *
 * On success the JWT is persisted to sessionStorage and the full
 * response payload `{ access_token, token_type, user }` is returned.
 *
 * On failure an Error with the backend's detail message is thrown.
 */
export async function login(email, password) {
    const response = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        let detail = "Authentication failed.";
        try {
            const payload = await response.json();
            detail = payload?.detail || detail;
        } catch {
            // ignore JSON parse errors on non-JSON error bodies
        }
        throw new Error(detail);
    }

    const data = await response.json();
    setToken(data.access_token);
    return data;
}

/** Clear all client-side session state. */
export function logout() {
    clearToken();
}

// ---------------------------------------------------------------------------
// Authenticated fetch wrapper
// ---------------------------------------------------------------------------

/**
 * Drop-in replacement for the native `fetch` that automatically attaches
 * the stored Bearer token to the `Authorization` header.
 *
 * If the server responds with 401 the local token is cleared so that
 * subsequent `isAuthenticated()` checks return false.
 *
 * Usage is identical to `fetch(url, options)`.
 */
export async function authFetch(url, options = {}) {
    const token = getToken();
    const headers = { ...(options.headers || {}) };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });

    // On 401, clear the stale/expired token.
    if (response.status === 401) {
        clearToken();
    }

    return response;
}
