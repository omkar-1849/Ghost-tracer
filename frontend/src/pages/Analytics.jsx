import { Bug, Globe, Radar, Target } from "lucide-react";

/* Existing intelligence widgets (logic untouched). */
import TopAttackingIPs from "../components/TopAttackingIPs";
import TopTargetedURLs from "../components/TopTargetedURLs";
import ThreatDistribution from "../components/ThreatDistribution";
import AttackTypes from "../components/AttackTypes";

/* Analytics workspace primitives. */
import AnalyticsBackground from "../components/analytics/AnalyticsBackground";
import AnalyticsHero from "../components/analytics/AnalyticsHero";
import AnalyticsSection from "../components/analytics/AnalyticsSection";
import AnalyticsCard from "../components/analytics/AnalyticsCard";
import ComingSoonPanel from "../components/analytics/ComingSoonPanel";

import "../components/analytics/AnalyticsPage.css";

function Analytics() {
    return (
        <div className="relative min-h-[calc(100vh-4rem)]">
            {/* Ambient layered background (decoration only). */}
            <AnalyticsBackground />

            <div className="relative z-10 mx-auto max-w-[1440px] px-1 pb-20 pt-2 sm:px-4 lg:px-6">
                {/* ------------------------------------------------------ */}
                {/* Hero — intelligence overview + controls                  */}
                {/* ------------------------------------------------------ */}
                <AnalyticsHero />

                {/* ------------------------------------------------------ */}
                {/* Threat intelligence — asymmetric widget composition      */}
                {/* ------------------------------------------------------ */}
                <AnalyticsSection
                    eyebrow="THREAT INTELLIGENCE"
                    title="Attack Surface Analysis"
                    subtitle="Live correlation of attacker origins, classified attack families, targeted assets and the overall event mix across your monitored surface."
                    actions={
                        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] text-emerald-400">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            </span>
                            AUTO-REFRESH · 5S
                        </span>
                    }
                >
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        {/* Wide: source IPs */}
                        <AnalyticsCard
                            icon={Globe}
                            accent="cyan"
                            title="Top Attacking IPs"
                            subtitle="Highest-volume source addresses"
                            delay={120}
                            className="lg:col-span-2"
                        >
                            <TopAttackingIPs />
                        </AnalyticsCard>

                        {/* Narrow: event mix */}
                        <AnalyticsCard
                            icon={Radar}
                            accent="amber"
                            title="Threat Distribution"
                            subtitle="Event mix by classification"
                            delay={200}
                        >
                            <ThreatDistribution />
                        </AnalyticsCard>

                        {/* Wide: attack families */}
                        <AnalyticsCard
                            icon={Bug}
                            accent="purple"
                            title="Attack Types"
                            subtitle="Classified attack families by volume"
                            delay={280}
                            className="lg:col-span-2"
                        >
                            <AttackTypes />
                        </AnalyticsCard>

                        {/* Narrow: targeted assets */}
                        <AnalyticsCard
                            icon={Target}
                            accent="blue"
                            title="Top Targeted URLs"
                            subtitle="Most frequently hit endpoints"
                            delay={360}
                        >
                            <TopTargetedURLs />
                        </AnalyticsCard>
                    </div>
                </AnalyticsSection>

                {/* ------------------------------------------------------ */}
                {/* Reserved space — future modules                          */}
                {/* ------------------------------------------------------ */}
                <AnalyticsSection
                    eyebrow="GLOBAL SURFACE"
                    title="Situational Awareness"
                    subtitle="Upcoming modules that will bring geospatial attack visualization and long-window trend forensics into the same workspace."
                >
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                        <ComingSoonPanel
                            variant="map"
                            title="World Attack Map"
                            subtitle="Live geospatial origin visualization"
                            footnote="Streams attacker origins onto a real-time world projection"
                            delay={440}
                            className="lg:col-span-3"
                        />

                        <ComingSoonPanel
                            variant="trends"
                            title="Historical Trends"
                            subtitle="Long-window detection forensics"
                            footnote="Compares campaign volume across rolling windows"
                            delay={520}
                            className="lg:col-span-2"
                        />
                    </div>
                </AnalyticsSection>
            </div>
        </div>
    );
}

export default Analytics;
