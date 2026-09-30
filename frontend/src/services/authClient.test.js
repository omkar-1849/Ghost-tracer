import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";

// Inject Vite's build-time environment; all transport below is stubbed, never live.
const source = (await readFile(new URL("./authClient.js", import.meta.url), "utf8"))
    .replace("resolveApiBase(import.meta.env)", 'resolveApiBase({ DEV: true })');
const client = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const store = new Map();
const browser = new EventTarget();
browser.sessionStorage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: (key) => store.delete(key) };
globalThis.window = browser;
const token = `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url")}.signature`;

test("API transport validates environment and boundaries before credentials", () => {
    assert.equal(client.resolveApiBase({ DEV: true }), "http://127.0.0.1:8000");
    assert.equal(client.resolveApiBase({}), "");
    assert.throws(() => client.resolveApiBase({ VITE_API_BASE_URL: "http://api.example.test" }), /HTTPS/);
    for (const url of ["https://untrusted.test", "//untrusted.test", "http://u:p@127.0.0.1:8000/a"]) assert.throws(() => client.apiUrl(url), /Refusing/);
});

test("tenant requests, 403, logout failure, successful logout and 401", async () => {
    client.setToken(token);
    await assert.rejects(client.authFetch("http://127.0.0.1:8000/dashboard/stats"), /validated organization/);
    globalThis.fetch = async (url, options) => {
        assert.equal(options.headers.get("Authorization"), `Bearer ${token}`);
        assert.equal(options.headers.get("X-Organization-ID"), "7");
        assert.equal(options.redirect, "error");
        return Response.json({ id: 7, current_user_role: "viewer" });
    };
    await client.selectOrganization(7);
    await client.authFetch("http://127.0.0.1:8000/dashboard/stats", { headers: { "X-Organization-ID": "999" } });
    let contacted = false;
    globalThis.fetch = async () => { contacted = true; return Response.json({}); };
    await assert.rejects(client.authFetch("https://untrusted.test"), /Refusing/);
    assert.equal(contacted, false);
    globalThis.fetch = async () => Response.json({ detail: "Forbidden" }, { status: 403 });
    await assert.rejects(client.authFetch("http://127.0.0.1:8000/settings"), /Forbidden/);
    assert.equal(client.getToken(), token);
    await assert.rejects(client.logout(), /Forbidden/);
    assert.equal(client.getToken(), token, "failed server logout preserves token");
    globalThis.fetch = async () => Response.json({ message: "Logged out" });
    await client.logout();
    assert.equal(client.getToken(), null);
    client.setToken(token);
    globalThis.fetch = async () => Response.json({ id: 7 });
    await client.selectOrganization(7);
    let notified = false;
    browser.addEventListener("sentinel-auth-change", () => { notified = true; }, { once: true });
    globalThis.fetch = async () => Response.json({ detail: "Expired" }, { status: 401 });
    await assert.rejects(client.authFetch("http://127.0.0.1:8000/dashboard/stats"), /Expired/);
    assert.equal(client.getToken(), null);
    assert.equal(notified, true);
});
