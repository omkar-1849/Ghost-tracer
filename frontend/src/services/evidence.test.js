import test from "node:test";
import assert from "node:assert/strict";
import { collectPages, safeHttpUrl, scanCompleteness, severityBreakdown } from "./evidence.js";

test("SQLMap severity totals match injectable + critical + warnings + databases", () => {
    const report = { findings: { injectable: true, critical: ["c"], warnings: ["w"], databases: ["db"], http_errors: ["ignored in headline"] } };
    const counts = severityBreakdown(report);
    assert.deepEqual(counts, { critical: 2, high: 1, medium: 0, low: 0, info: 1 });
    assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), 4);
});
test("a full incident page is followed by subsequent pages, including exact multiples", async () => {
    const calls = [];
    const items = await collectPages(async ({ limit, offset }) => {
        calls.push(offset);
        return offset < 40 ? Array.from({ length: limit }, (_, i) => ({ id: offset + i })) : [];
    }, 20);
    assert.equal(items.length, 40);
    assert.deepEqual(calls, [0, 20, 40]);
});
test("pagination errors and repeated pages never return silent partial success", async () => {
    await assert.rejects(collectPages(async ({ offset }) => {
        if (offset) throw new Error("Forbidden");
        return [{ id: 1 }];
    }, 1), /Forbidden/);
    await assert.rejects(collectPages(async () => [{ id: 1 }], 1), /Collection changed/);
});
test("only complete, untruncated scans get a complete label", () => {
    for (const status of ["Pending", "Running", "Failed", "Partial", "Cancelled", "Unknown"]) assert.equal(scanCompleteness({ status }).complete, false);
    assert.equal(scanCompleteness({ status: "Completed", truncated: true }).complete, false);
    assert.equal(scanCompleteness({ status: "Completed" }).complete, true);
    assert.match(scanCompleteness({ status: "Partial", truncated: true }).label, /PARTIAL.*TRUNCATED/);
});
test("website navigation only accepts credential-free http(s) URLs", () => {
    for (const value of ["javascript:alert(1)", "data:text/html,test", "//host/path", "https://user:password@example.test", "file:///tmp/a"]) assert.equal(safeHttpUrl(value), undefined);
    assert.equal(safeHttpUrl("https://example.test/path"), "https://example.test/path");
});
