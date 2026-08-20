import { Fragment } from "react";
import { Info } from "lucide-react";

const scoreTone = (score) => {
    if (score === null || score === undefined) return "text-[var(--color-text-muted)]";
    if (score >= 90) return "text-[var(--color-success)]";
    if (score >= 70) return "text-[var(--color-warning)]";
    return "text-[var(--color-critical)]";
};

/**
 * Inline estate summary strip — typography-led operational context.
 * Large tabular numerals with quiet labels, hairline dividers, no cards.
 * Numbers carry the hierarchy; the average score is the only colored value
 * (it reports a status, the others report counts).
 */
export default function WebsiteSummary({ websites }) {
    const total = websites.length;
    const active = websites.filter(w => w.status === "Active").length;
    const inactive = websites.filter(w => w.status === "Inactive").length;
    const monitored = websites.filter(w => w.monitoringEnabled).length;

    const scores = websites.filter(w => w.securityScore != null).map(w => w.securityScore);
    const avgScore = scores.length
        ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
        : null;

    const metrics = [
        { value: total, label: total === 1 ? "Website" : "Websites", valueClass: "text-[var(--color-text-primary)]" },
        { value: active, label: "Active", valueClass: "text-[var(--color-text-primary)]" },
        { value: inactive, label: "Inactive", valueClass: "text-[var(--color-text-primary)]" },
        { value: monitored, label: "Monitored", valueClass: "text-[var(--color-text-primary)]" },
        {
            value: avgScore ?? "—",
            label: avgScore == null ? "Security score unavailable" : "Average security score",
            valueClass: scoreTone(avgScore),
            info: avgScore != null,
        },
    ];

    return (
        <div className="flex flex-wrap items-center gap-x-10 gap-y-4 mb-8" aria-label="Estate summary">
            {metrics.map((metric, idx) => (
                <Fragment key={metric.label}>
                    {idx > 0 && (
                        <span aria-hidden="true" className="hidden md:block w-px self-stretch min-h-7 bg-[var(--color-border-subtle)]" />
                    )}
                    <div className="flex items-baseline gap-3">
                        <span className={`text-4xl font-bold tabular-nums leading-none ${metric.valueClass}`}>
                            {metric.value}
                        </span>
                        <span className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)]">
                            {metric.label}
                            {metric.info && (
                                <span
                                    title="Mean security score across all monitored targets"
                                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors duration-150"
                                >
                                    <Info size={13} />
                                </span>
                            )}
                        </span>
                    </div>
                </Fragment>
            ))}
        </div>
    );
}
