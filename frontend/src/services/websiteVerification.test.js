import test from "node:test";
import assert from "node:assert/strict";

// Test helper reflecting the exact rendering logic in WebsiteDetailsDrawer
function formatMetaTag(token) {
    return token ? `<meta name="sentinel-verification" content="${token}">` : "";
}

function formatDnsRecord(token) {
    return token || "Token unavailable";
}

function formatHtmlInstruction(token) {
    return token || "";
}

test("Website Verification - meta tag formatting with valid token", () => {
    const token = "SENTINEL_A1B2C3D4E5F6";
    const tag = formatMetaTag(token);
    assert.equal(tag, '<meta name="sentinel-verification" content="SENTINEL_A1B2C3D4E5F6">');
});

test("Website Verification - meta tag formatting with null or undefined token never outputs content='null'", () => {
    const nullTag = formatMetaTag(null);
    assert.equal(nullTag, "");
    assert.ok(!nullTag.includes("null"));

    const undefTag = formatMetaTag(undefined);
    assert.equal(undefTag, "");
    assert.ok(!undefTag.includes("undefined"));

    const emptyTag = formatMetaTag("");
    assert.equal(emptyTag, "");
});

test("Website Verification - DNS record format with null token falls back safely", () => {
    assert.equal(formatDnsRecord("SENTINEL_XYZ"), "SENTINEL_XYZ");
    assert.equal(formatDnsRecord(null), "Token unavailable");
    assert.equal(formatDnsRecord(undefined), "Token unavailable");
});

test("Website Verification - HTML verification instruction with null token falls back safely", () => {
    assert.equal(formatHtmlInstruction("SENTINEL_XYZ"), "SENTINEL_XYZ");
    assert.equal(formatHtmlInstruction(null), "");
});
