import test from "node:test";
import assert from "node:assert/strict";
import {
    AI_STATUS,
    getAiAnalystDisplayState,
    computeNextPollingInterval,
    shouldPollEvent,
    DEFAULT_DELAYED_THRESHOLD_MS,
    INITIAL_POLL_INTERVAL_MS,
    MAX_POLL_INTERVAL_MS,
} from "./aiAnalystStatus.js";

test("aiAnalystStatus handles legacy events and null/undefined values safely", () => {
    // Null event
    const nullState = getAiAnalystDisplayState(null);
    assert.equal(nullState.status, AI_STATUS.NOT_REQUESTED);
    assert.equal(nullState.badge, null);
    assert.equal(nullState.showSpinner, false);
    assert.equal(nullState.useDeterministic, true);
    assert.equal(nullState.shouldPoll, false);

    // Event without ai_status (legacy row)
    const legacyEvent = {
        id: 101,
        title: "Legacy port scan",
        analyst_result: { decision: "INVESTIGATE" },
    };
    const legacyState = getAiAnalystDisplayState(legacyEvent);
    assert.equal(legacyState.status, AI_STATUS.NOT_REQUESTED);
    assert.equal(legacyState.badge, null);
    assert.equal(legacyState.showSpinner, false);
    assert.equal(legacyState.decision, "INVESTIGATE");
    assert.equal(legacyState.useDeterministic, true);
    assert.equal(legacyState.shouldPoll, false);

    // Explicit NOT_REQUESTED
    const notRequestedState = getAiAnalystDisplayState({
        id: 102,
        ai_status: "NOT_REQUESTED",
    });
    assert.equal(notRequestedState.status, AI_STATUS.NOT_REQUESTED);
    assert.equal(notRequestedState.showSpinner, false);
    assert.equal(notRequestedState.shouldPoll, false);
});

test("aiAnalystStatus handles PENDING status with spinner and non-blocking preliminary indicator", () => {
    const now = 1700000000000;
    const freshPendingEvent = {
        id: 201,
        ai_status: "PENDING",
        created_at: new Date(now - 10000).toISOString(), // 10s ago
        analyst_result: { decision: "MONITOR" },
    };

    const state = getAiAnalystDisplayState(freshPendingEvent, { now });
    assert.equal(state.status, AI_STATUS.PENDING);
    assert.equal(state.badge, "Analyzing");
    assert.equal(state.showSpinner, true);
    assert.equal(state.text, "Preliminary — GT-Beta analysis pending");
    assert.equal(state.decision, "MONITOR");
    assert.equal(state.useDeterministic, true); // Fallback to interim deterministic rules
    assert.equal(state.isDelayed, false);
    assert.equal(state.shouldPoll, true);
    assert.equal(shouldPollEvent(freshPendingEvent, { now }), true);
});

test("aiAnalystStatus handles stale PENDING events exceeding delay threshold", () => {
    const now = 1700000000000;
    const stalePendingEvent = {
        id: 202,
        ai_status: "PENDING",
        created_at: new Date(now - (DEFAULT_DELAYED_THRESHOLD_MS + 5000)).toISOString(), // 65s ago
        analyst_result: { decision: "MONITOR" },
    };

    const state = getAiAnalystDisplayState(stalePendingEvent, { now });
    assert.equal(state.status, AI_STATUS.PENDING);
    assert.equal(state.badge, "Analysis Delayed");
    assert.equal(state.showSpinner, false);
    assert.equal(state.text, "Analysis delayed");
    assert.equal(state.isDelayed, true);
    assert.equal(state.shouldPoll, false); // stops spinning/polling endlessly
});

test("aiAnalystStatus handles COMPLETED status with GT-Beta decision badge", () => {
    const completedEvent = {
        id: 301,
        ai_status: "COMPLETED",
        ai_completed_at: "2026-10-10T12:00:00Z",
        analyst_result: {
            decision: "RESPOND",
            threat_level: "CRITICAL",
            engine: "gt-beta-http",
        },
    };

    const state = getAiAnalystDisplayState(completedEvent);
    assert.equal(state.status, AI_STATUS.COMPLETED);
    assert.equal(state.badge, "Completed");
    assert.equal(state.showSpinner, false);
    assert.equal(state.text, "GT-Beta Analysis Ready");
    assert.equal(state.decision, "RESPOND");
    assert.equal(state.useDeterministic, false); // Uses GT-Beta result
    assert.equal(state.shouldPoll, false);
});

test("aiAnalystStatus handles FAILED status with deterministic fallback and no spinner", () => {
    const failedEvent = {
        id: 401,
        ai_status: "FAILED",
        analyst_result: {
            decision: "INVESTIGATE",
            engine: "deterministic_rules_v1",
        },
    };

    const state = getAiAnalystDisplayState(failedEvent);
    assert.equal(state.status, AI_STATUS.FAILED);
    assert.equal(state.badge, "AI Unavailable");
    assert.equal(state.showSpinner, false);
    assert.equal(state.text, "AI analysis unavailable");
    assert.equal(state.decision, "INVESTIGATE");
    assert.equal(state.useDeterministic, true);
    assert.equal(state.shouldPoll, false);
});

test("aiAnalystStatus handles SKIPPED status for queue limit or disabled AI", () => {
    const skippedEvent = {
        id: 501,
        ai_status: "SKIPPED",
        analyst_result: {
            decision: "MONITOR",
            engine: "deterministic_rules_v1",
        },
    };

    const state = getAiAnalystDisplayState(skippedEvent);
    assert.equal(state.status, AI_STATUS.SKIPPED);
    assert.equal(state.badge, "AI Skipped");
    assert.equal(state.showSpinner, false);
    assert.equal(state.text, "AI analysis not run (queue limit)");
    assert.equal(state.decision, "MONITOR");
    assert.equal(state.useDeterministic, true);
    assert.equal(state.shouldPoll, false);
});

test("computeNextPollingInterval implements bounded exponential backoff", () => {
    // Initial interval
    let interval = computeNextPollingInterval(INITIAL_POLL_INTERVAL_MS);
    assert.equal(interval, 7500); // 5000 * 1.5

    interval = computeNextPollingInterval(interval);
    assert.equal(interval, 11250); // 7500 * 1.5

    interval = computeNextPollingInterval(interval);
    assert.equal(interval, MAX_POLL_INTERVAL_MS); // Bounded at 15000

    interval = computeNextPollingInterval(MAX_POLL_INTERVAL_MS);
    assert.equal(interval, MAX_POLL_INTERVAL_MS); // Stays at 15000
});
