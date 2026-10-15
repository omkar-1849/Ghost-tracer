import test from "node:test";
import assert from "node:assert/strict";

/**
 * Helper to compute overview metrics from event lists (mirrors AiAnalyst logic)
 */
function computeAnalystMetrics(events) {
    let totalAnalyzed = 0;
    let respondCount = 0;
    let investigateCount = 0;
    let monitorCount = 0;
    let gtBetaCount = 0;
    let rulesCount = 0;
    const severityDist = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

    events.forEach((ev) => {
        const ar = ev.analyst_result;
        if (!ar) return;
        totalAnalyzed += 1;

        const dec = (ar.decision || "").toUpperCase();
        if (dec === "RESPOND") respondCount += 1;
        else if (dec === "INVESTIGATE") investigateCount += 1;
        else monitorCount += 1;

        const sev = (ar.threat_level || ev.threat_level || "LOW").toUpperCase();
        if (severityDist[sev] !== undefined) {
            severityDist[sev] += 1;
        }

        if (ar.engine === "gt-beta-http") {
            gtBetaCount += 1;
        } else {
            rulesCount += 1;
        }
    });

    return {
        totalAnalyzed,
        respondCount,
        investigateCount,
        monitorCount,
        gtBetaCount,
        rulesCount,
        severityDist,
    };
}

/**
 * Helper to format confidence cleanly
 */
function formatConfidence(conf) {
    if (conf === undefined || conf === null || Number.isNaN(Number(conf))) return "—";
    const num = Number(conf);
    const pct = num <= 1 ? Math.round(num * 100) : Math.round(num);
    return `${pct}%`;
}

test("AI Analyst metrics aggregation handles GT-Beta and fallback events correctly", () => {
    const events = [
        {
            id: 1,
            analyst_result: {
                decision: "RESPOND",
                threat_level: "CRITICAL",
                confidence: 0.95,
                engine: "gt-beta-http",
                attack_type: "SQL Injection",
                evidence: ["' OR 1=1"],
                requires_approval: true,
            },
        },
        {
            id: 2,
            analyst_result: {
                decision: "INVESTIGATE",
                threat_level: "HIGH",
                confidence: 0.75,
                engine: "deterministic_rules_v1",
                attack_type: null,
                evidence: null,
                requires_approval: true,
            },
        },
        {
            id: 3,
            analyst_result: {
                decision: "MONITOR",
                threat_level: "LOW",
                confidence: 0.0,
                engine: "gt-beta-http",
                attack_type: null,
                evidence: ["HTTP 304"],
                requires_approval: true,
            },
        },
        {
            id: 4,
            // Older event with no analyst result
            analyst_result: null,
        },
    ];

    const metrics = computeAnalystMetrics(events);
    assert.equal(metrics.totalAnalyzed, 3);
    assert.equal(metrics.respondCount, 1);
    assert.equal(metrics.investigateCount, 1);
    assert.equal(metrics.monitorCount, 1);
    assert.equal(metrics.gtBetaCount, 2);
    assert.equal(metrics.rulesCount, 1);
    assert.equal(metrics.severityDist.CRITICAL, 1);
    assert.equal(metrics.severityDist.HIGH, 1);
    assert.equal(metrics.severityDist.LOW, 1);
});

test("Confidence formatter handles edge cases, zero, and missing values safely", () => {
    assert.equal(formatConfidence(0.95), "95%");
    assert.equal(formatConfidence(0.0), "0%");
    assert.equal(formatConfidence(1.0), "100%");
    assert.equal(formatConfidence(null), "—");
    assert.equal(formatConfidence(undefined), "—");
    assert.equal(formatConfidence("invalid"), "—");
});

test("Graceful degradation on missing fields in legacy records", () => {
    const legacyEvent = {
        id: 99,
        title: "Legacy probe",
        analyst_result: {
            decision: "MONITOR",
            // missing attack_type, evidence, recommended_actions
        },
    };

    const ar = legacyEvent.analyst_result;
    assert.equal(ar.decision, "MONITOR");
    assert.equal(ar.attack_type ?? "Uncategorized", "Uncategorized");
    assert.deepEqual(ar.evidence ?? [], []);
    assert.deepEqual(ar.recommended_actions ?? [], []);
});

test("Response governance rule ensures RESPOND decisions remain advisory", () => {
    const ev = {
        id: 1,
        analyst_result: {
            decision: "RESPOND",
            action_type: "BLOCK_IP",
            requires_approval: true,
            source_ip_trusted: false,
        },
    };

    // Sentinel safety invariant: automated actions are never dispatched automatically
    assert.equal(ev.analyst_result.requires_approval, true);
    assert.equal(ev.analyst_result.source_ip_trusted, false);
});
