/* ============================================================
   Sentinel AI — Severity & Status semantic token system
   Single source of truth for severity/status → color mapping.
   Components import from here instead of repeating lookup logic.
   ============================================================ */

/** Severity → design token mapping (uses index.css custom properties) */
export const SEVERITY = {
  CRITICAL: {
    label: "Critical",
    color: "var(--color-critical)",
    bg: "rgba(229,72,77,0.10)",
    border: "rgba(229,72,77,0.25)",
    text: "text-[var(--color-critical)]",
    tailwind: {
      bg: "bg-[rgba(229,72,77,0.10)]",
      border: "border-[rgba(229,72,77,0.25)]",
      text: "text-[var(--color-critical)]",
      dot: "bg-[var(--color-critical)]",
    },
  },
  HIGH: {
    label: "High",
    color: "var(--color-high)",
    bg: "rgba(237,125,28,0.10)",
    border: "rgba(237,125,28,0.25)",
    text: "text-[var(--color-high)]",
    tailwind: {
      bg: "bg-[rgba(237,125,28,0.10)]",
      border: "border-[rgba(237,125,28,0.25)]",
      text: "text-[var(--color-high)]",
      dot: "bg-[var(--color-high)]",
    },
  },
  MEDIUM: {
    label: "Medium",
    color: "var(--color-medium)",
    bg: "rgba(221,179,42,0.10)",
    border: "rgba(221,179,42,0.25)",
    text: "text-[var(--color-medium)]",
    tailwind: {
      bg: "bg-[rgba(221,179,42,0.10)]",
      border: "border-[rgba(221,179,42,0.25)]",
      text: "text-[var(--color-medium)]",
      dot: "bg-[var(--color-medium)]",
    },
  },
  LOW: {
    label: "Low",
    color: "var(--color-low)",
    bg: "rgba(74,157,224,0.10)",
    border: "rgba(74,157,224,0.25)",
    text: "text-[var(--color-low)]",
    tailwind: {
      bg: "bg-[rgba(74,157,224,0.10)]",
      border: "border-[rgba(74,157,224,0.25)]",
      text: "text-[var(--color-low)]",
      dot: "bg-[var(--color-low)]",
    },
  },
  INFO: {
    label: "Info",
    color: "var(--color-info)",
    bg: "rgba(107,118,131,0.10)",
    border: "rgba(107,118,131,0.25)",
    text: "text-[var(--color-info)]",
    tailwind: {
      bg: "bg-[rgba(107,118,131,0.10)]",
      border: "border-[rgba(107,118,131,0.25)]",
      text: "text-[var(--color-info)]",
      dot: "bg-[var(--color-info)]",
    },
  },
};

/** Status → design token mapping */
export const STATUS = {
  HEALTHY: {
    label: "Healthy",
    color: "var(--color-success)",
    tailwind: {
      bg: "bg-[rgba(63,163,77,0.10)]",
      border: "border-[rgba(63,163,77,0.25)]",
      text: "text-[var(--color-success)]",
      dot: "bg-[var(--color-success)]",
    },
  },
  RUNNING: {
    label: "Running",
    color: "var(--color-accent)",
    tailwind: {
      bg: "bg-[var(--color-accent-subtle)]",
      border: "border-[rgba(61,122,240,0.25)]",
      text: "text-[var(--color-accent)]",
      dot: "bg-[var(--color-accent)]",
    },
  },
  COMPLETED: {
    label: "Completed",
    color: "var(--color-success)",
    tailwind: {
      bg: "bg-[rgba(63,163,77,0.10)]",
      border: "border-[rgba(63,163,77,0.25)]",
      text: "text-[var(--color-success)]",
      dot: "bg-[var(--color-success)]",
    },
  },
  FAILED: {
    label: "Failed",
    color: "var(--color-critical)",
    tailwind: {
      bg: "bg-[rgba(229,72,77,0.10)]",
      border: "border-[rgba(229,72,77,0.25)]",
      text: "text-[var(--color-critical)]",
      dot: "bg-[var(--color-critical)]",
    },
  },
  PENDING: {
    label: "Pending",
    color: "var(--color-warning)",
    tailwind: {
      bg: "bg-[rgba(217,161,26,0.10)]",
      border: "border-[rgba(217,161,26,0.25)]",
      text: "text-[var(--color-warning)]",
      dot: "bg-[var(--color-warning)]",
    },
  },
  CONNECTED: {
    label: "Connected",
    color: "var(--color-success)",
    tailwind: {
      bg: "bg-[rgba(63,163,77,0.10)]",
      border: "border-[rgba(63,163,77,0.25)]",
      text: "text-[var(--color-success)]",
      dot: "bg-[var(--color-success)]",
    },
  },
  DISCONNECTED: {
    label: "Disconnected",
    color: "var(--color-info)",
    tailwind: {
      bg: "bg-[rgba(107,118,131,0.10)]",
      border: "border-[rgba(107,118,131,0.25)]",
      text: "text-[var(--color-info)]",
      dot: "bg-[var(--color-info)]",
    },
  },
};

/**
 * Look up severity tokens by level string (case-insensitive).
 * Returns INFO as fallback.
 */
export function getSeverity(level) {
  if (!level) return SEVERITY.INFO;
  const key = String(level).toUpperCase();
  return SEVERITY[key] ?? SEVERITY.INFO;
}

/**
 * Look up status tokens by status string (case-insensitive).
 * Returns PENDING as fallback.
 */
export function getStatus(status) {
  if (!status) return STATUS.PENDING;
  const key = String(status).toUpperCase();
  return STATUS[key] ?? STATUS.PENDING;
}

/** Risk score to severity mapping */
export function riskToSeverity(score) {
  const v = Number(score);
  if (v >= 80) return SEVERITY.CRITICAL;
  if (v >= 60) return SEVERITY.HIGH;
  if (v >= 40) return SEVERITY.MEDIUM;
  if (v >= 20) return SEVERITY.LOW;
  return SEVERITY.INFO;
}
