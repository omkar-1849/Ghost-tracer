// Credentials are only sent to the configured API, never to target/report URLs.
export function resolveApiBase(env = {}) {
    const value = env.VITE_API_BASE_URL || (env.DEV ? "http://127.0.0.1:8000" : "");
    if (!value) return "";
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("Invalid API base URL");
    if (!env.DEV && url.protocol !== "https:") throw new Error("Production API requires HTTPS");
    return url.href.replace(/\/$/, "");
}
export const BASE_URL = resolveApiBase(import.meta.env);
const TOKEN_KEY = "sentinel_access_token";
const ORG_KEY = "sentinel_organization_id";
let membership = null;
const storage = () => typeof window === "undefined" ? null : window.sessionStorage;
export const getToken = () => storage()?.getItem(TOKEN_KEY) || null;
export const getOrganization = () => membership;
export function setToken(token) {
    membership = null;
    storage()?.removeItem(ORG_KEY);
    storage()?.setItem(TOKEN_KEY, token);
}
export function clearToken() {
    membership = null;
    storage()?.removeItem(TOKEN_KEY);
    storage()?.removeItem(ORG_KEY);
    if (typeof window !== "undefined") window.dispatchEvent(new Event("sentinel-auth-change"));
}
export function tokenExpired(token) {
    try {
        const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        return !Number.isFinite(payload.exp) || payload.exp * 1000 <= Date.now();
    } catch { return true; }
}
export function isAuthenticated() {
    const token = getToken();
    return !!token && !tokenExpired(token);
}
export function apiUrl(input, base = BASE_URL) {
    if (!base) throw new Error("Configure VITE_API_BASE_URL before using the application.");
    const root = new URL(`${base}/`);
    const url = new URL(input, root);
    if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname) || url.username || url.password) throw new Error("Refusing credentials outside the configured API");
    return url.href;
}
async function checked(response) {
    if (!response.ok) {
        let message = `Request failed (${response.status})`;
        try {
            const data = await response.json();
            if (typeof data.detail === "string") message = data.detail;
        } catch { /* Non-JSON error */ }
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }
    return response;
}
async function authenticatedRequest(url, options = {}, organizationId) {
    const destination = apiUrl(url); // Validate before accessing/attaching any secret.
    const token = getToken();
    if (!token || tokenExpired(token)) {
        clearToken();
        throw new Error("Session expired. Please sign in again.");
    }
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.delete("X-Organization-ID");
    if (organizationId) headers.set("X-Organization-ID", String(organizationId));
    const response = await fetch(destination, { ...options, headers, credentials: "omit", redirect: "error" });
    if (response.status === 401) clearToken();
    return checked(response);
}
export async function authFetch(url, options = {}) {
    if (!membership) throw new Error("Select a validated organization before accessing application data.");
    return authenticatedRequest(url, options, membership.id);
}
export async function getMemberships() {
    const response = await authenticatedRequest(`${BASE_URL}/organization/list`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid membership list");
    return data;
}
export async function selectOrganization(id) {
    membership = null;
    const response = await authenticatedRequest(`${BASE_URL}/organization`, {}, id);
    const data = await response.json();
    if (String(data.id) !== String(id)) throw new Error("Organization validation failed");
    membership = data;
    storage()?.setItem(ORG_KEY, String(id));
    return data;
}
export async function createOrganization(name) {
    const response = await authenticatedRequest(`${BASE_URL}/organization`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    return response.json();
}
export function switchOrganization() {
    membership = null;
    storage()?.removeItem(ORG_KEY);
    window.dispatchEvent(new Event("sentinel-org-change"));
}
export const storedOrganizationId = () => storage()?.getItem(ORG_KEY);
export async function publicAuthRequest(path, body) {
    const response = await checked(await fetch(apiUrl(`${BASE_URL}/auth/${path}`), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), credentials: "omit", redirect: "error",
    }));
    return response.json();
}
export async function login(email, password) {
    const data = await publicAuthRequest("login", { email, password });
    setToken(data.access_token);
    return data;
}
export async function logout() {
    await authenticatedRequest(`${BASE_URL}/sessions/logout`, { method: "POST" }, membership?.id);
    clearToken();
}
