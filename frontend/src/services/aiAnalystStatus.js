/**
 * Sentinel AI - AI Analyst Display & Lifecycle Status Helpers
 *
 * Implements pure presentation helpers for async GT-Beta AI inference status
 * according to Sentinel Phase 1 Implementation Design §4.13.
 */

export const AI_STATUS = {
    PENDING: "PENDING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    SKIPPED: "SKIPPED",
    NOT_REQUESTED: "NOT_REQUESTED",
};

export const DEFAULT_DELAYED_THRESHOLD_MS = 60 * 1000; // 60 seconds
export const INITIAL_POLL_INTERVAL_MS = 5 * 1000;      // 5 seconds
export const MAX_POLL_INTERVAL_MS = 15 * 1000;         // 15 seconds
export const POLL_BACKOFF_FACTOR = 1.5;

/**
 * Returns presentation metadata and display state for an event's AI analysis status.
 *
 * @param {Object} event - Event record containing optional `ai_status`, `analyst_result`, `created_at`
 * @param {Object} [options]
 * @param {number} [options.now] - Current epoch ms (injectable for testing)
 * @param {number} [options.delayedThresholdMs] - Threshold ms after which PENDING is marked delayed
 * @returns {Object} Display state definition
 */
export function getAiAnalystDisplayState(event, options = {}) {
    if (!event) {
        return {
            status: AI_STATUS.NOT_REQUESTED,
            badge: null,
            showSpinner: false,
            text: null,
            decision: null,
            useDeterministic: true,
            isDelayed: false,
            shouldPoll: false,
        };
    }

    const rawStatus = event.ai_status;
    const status = (rawStatus ? String(rawStatus).toUpperCase() : null);
    const analystResult = event.analyst_result || null;
    const decision = analystResult?.decision || null;

    if (!status || status === AI_STATUS.NOT_REQUESTED) {
        return {
            status: AI_STATUS.NOT_REQUESTED,
            badge: null,
            showSpinner: false,
            text: null,
            decision,
            useDeterministic: true,
            isDelayed: false,
            shouldPoll: false,
        };
    }

    if (status === AI_STATUS.PENDING) {
        const now = options.now ?? Date.now();
        const threshold = options.delayedThresholdMs ?? DEFAULT_DELAYED_THRESHOLD_MS;
        let isDelayed = false;

        const eventTime = event.created_at || event.timestamp;
        if (eventTime) {
            const parsedTime = new Date(eventTime).getTime();
            if (!Number.isNaN(parsedTime) && now - parsedTime > threshold) {
                isDelayed = true;
            }
        }

        return {
            status: AI_STATUS.PENDING,
            badge: isDelayed ? "Analysis Delayed" : "Analyzing",
            showSpinner: !isDelayed,
            text: isDelayed
                ? "Analysis delayed"
                : "Preliminary — GT-Beta analysis pending",
            decision,
            useDeterministic: true,
            isDelayed,
            shouldPoll: !isDelayed, // Stop spinning forever when delayed threshold exceeded
        };
    }

    if (status === AI_STATUS.COMPLETED) {
        return {
            status: AI_STATUS.COMPLETED,
            badge: "Completed",
            showSpinner: false,
            text: "GT-Beta Analysis Ready",
            decision,
            useDeterministic: false,
            isDelayed: false,
            shouldPoll: false,
        };
    }

    if (status === AI_STATUS.FAILED) {
        return {
            status: AI_STATUS.FAILED,
            badge: "AI Unavailable",
            showSpinner: false,
            text: "AI analysis unavailable",
            decision,
            useDeterministic: true,
            isDelayed: false,
            shouldPoll: false,
        };
    }

    if (status === AI_STATUS.SKIPPED) {
        return {
            status: AI_STATUS.SKIPPED,
            badge: "AI Skipped",
            showSpinner: false,
            text: "AI analysis not run (queue limit)",
            decision,
            useDeterministic: true,
            isDelayed: false,
            shouldPoll: false,
        };
    }

    // Default fallback for unknown status strings
    return {
        status,
        badge: status,
        showSpinner: false,
        text: `AI status: ${status}`,
        decision,
        useDeterministic: true,
        isDelayed: false,
        shouldPoll: false,
    };
}

/**
 * Calculates next polling interval with bounded exponential backoff (e.g. 5s -> 7.5s -> ... -> 15s)
 *
 * @param {number} [currentInterval=INITIAL_POLL_INTERVAL_MS]
 * @param {Object} [options]
 * @param {number} [options.maxInterval=MAX_POLL_INTERVAL_MS]
 * @param {number} [options.factor=POLL_BACKOFF_FACTOR]
 * @returns {number} Next interval in milliseconds
 */
export function computeNextPollingInterval(
    currentInterval = INITIAL_POLL_INTERVAL_MS,
    options = {}
) {
    const maxInterval = options.maxInterval ?? MAX_POLL_INTERVAL_MS;
    const factor = options.factor ?? POLL_BACKOFF_FACTOR;
    const next = Math.round(currentInterval * factor);
    return Math.min(next, maxInterval);
}

/**
 * Returns true if an event is in active pending state and should be polled.
 *
 * @param {Object} event
 * @param {Object} [options]
 * @returns {boolean}
 */
export function shouldPollEvent(event, options = {}) {
    const state = getAiAnalystDisplayState(event, options);
    return state.shouldPoll;
}
