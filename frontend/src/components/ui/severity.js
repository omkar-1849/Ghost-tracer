/* ============================================================
   Sentinel AI — Severity & Status semantic token system
   Single source of truth for severity/status → color mapping.
   Components import from here instead of repeating lookup logic.
   ============================================================ */

/** Severity → design token mapping (uses Smoked Bronze Glass reference values) */
export const SEVERITY = {
  CRITICAL: {
    label: "Critical",
    color: "#e63946",
    bg: "rgba(230,120,104,0.12)",
    border: "rgba(230,120,104,0.22)",
    text: "text-[#e67868]",
    tailwind: {
      bg: "bg-[rgba(230,120,104,0.12)]",
      border: "border-[rgba(230,120,104,0.22)]",
      text: "text-[#e67868]",
      dot: "bg-[#e67868]",
    },
  },
  HIGH: {
    label: "High",
    color: "#d3a06a",
    bg: "rgba(211,160,106,0.12)",
    border: "rgba(211,160,106,0.20)",
    text: "text-[#d3a06a]",
    tailwind: {
      bg: "bg-[rgba(211,160,106,0.12)]",
      border: "border-[rgba(211,160,106,0.20)]",
      text: "text-[#d3a06a]",
      dot: "bg-[#d3a06a]",
    },
  },
  MEDIUM: {
    label: "Medium",
    color: "#e3b985",
    bg: "rgba(227,185,133,0.10)",
    border: "rgba(227,185,133,0.18)",
    text: "text-[#e3b985]",
    tailwind: {
      bg: "bg-[rgba(227,185,133,0.10)]",
      border: "border-[rgba(227,185,133,0.18)]",
      text: "text-[#e3b985]",
      dot: "bg-[#e3b985]",
    },
  },
  LOW: {
    label: "Low",
    color: "#a9a199",
    bg: "rgba(169,161,153,0.08)",
    border: "rgba(169,161,153,0.14)",
    text: "text-[#a9a199]",
    tailwind: {
      bg: "bg-[rgba(169,161,153,0.08)]",
      border: "border-[rgba(169,161,153,0.14)]",
      text: "text-[#a9a199]",
      dot: "bg-[#a9a199]",
    },
  },
  INFO: {
    label: "Info",
    color: "#a9a199",
    bg: "rgba(169,161,153,0.08)",
    border: "rgba(169,161,153,0.14)",
    text: "text-[#a9a199]",
    tailwind: {
      bg: "bg-[rgba(169,161,153,0.08)]",
      border: "border-[rgba(169,161,153,0.14)]",
      text: "text-[#a9a199]",
      dot: "bg-[#a9a199]",
    },
  },
};

/** Status → design token mapping */
export const STATUS = {
  HEALTHY: {
    label: "Healthy",
    color: "#77c79a",
    tailwind: {
      bg: "bg-[rgba(119,199,154,0.12)]",
      border: "border-[rgba(119,199,154,0.22)]",
      text: "text-[#77c79a]",
      dot: "bg-[#77c79a]",
    },
  },
  RUNNING: {
    label: "Running",
    color: "#d3a06a",
    tailwind: {
      bg: "bg-[rgba(211,160,106,0.12)]",
      border: "border-[rgba(211,160,106,0.20)]",
      text: "text-[#d3a06a]",
      dot: "bg-[#d3a06a]",
    },
  },
  COMPLETED: {
    label: "Completed",
    color: "#77c79a",
    tailwind: {
      bg: "bg-[rgba(119,199,154,0.12)]",
      border: "border-[rgba(119,199,154,0.22)]",
      text: "text-[#77c79a]",
      dot: "bg-[#77c79a]",
    },
  },
  FAILED: {
    label: "Failed",
    color: "#e67868",
    tailwind: {
      bg: "bg-[rgba(230,120,104,0.12)]",
      border: "border-[rgba(230,120,104,0.22)]",
      text: "text-[#e67868]",
      dot: "bg-[#e67868]",
    },
  },
  PENDING: {
    label: "Pending",
    color: "#e3b985",
    tailwind: {
      bg: "bg-[rgba(227,185,133,0.10)]",
      border: "border-[rgba(227,185,133,0.18)]",
      text: "text-[#e3b985]",
      dot: "bg-[#e3b985]",
    },
  },
  CONNECTED: {
    label: "Connected",
    color: "#77c79a",
    tailwind: {
      bg: "bg-[rgba(119,199,154,0.12)]",
      border: "border-[rgba(119,199,154,0.22)]",
      text: "text-[#77c79a]",
      dot: "bg-[#77c79a]",
    },
  },
  DISCONNECTED: {
    label: "Disconnected",
    color: "#a9a199",
    tailwind: {
      bg: "bg-[rgba(169,161,153,0.08)]",
      border: "border-[rgba(169,161,153,0.14)]",
      text: "text-[#a9a199]",
      dot: "bg-[#a9a199]",
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
