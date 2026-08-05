/**
 * Shared filter/deployment option lists for the Website Management module.
 * Single source of truth so filters and forms stay in sync.
 */

export const ENVIRONMENTS = [
    { value: "Production", label: "Production" },
    { value: "Staging", label: "Staging" },
    { value: "Development", label: "Development" },
];

export const ENVIRONMENT_FILTER_OPTIONS = [
    { value: "All", label: "All Environments" },
    ...ENVIRONMENTS,
];

export const STATUS_FILTER_OPTIONS = [
    { value: "All", label: "All Statuses" },
    { value: "Active", label: "Active" },
    { value: "Inactive", label: "Inactive" },
    { value: "Archived", label: "Archived" },
];

export const HEALTH_FILTER_OPTIONS = [
    { value: "All", label: "All Health" },
    { value: "Healthy", label: "Healthy" },
    { value: "Warning", label: "Warning" },
    { value: "Critical", label: "Critical" },
    { value: "Unknown", label: "Unknown" },
];
