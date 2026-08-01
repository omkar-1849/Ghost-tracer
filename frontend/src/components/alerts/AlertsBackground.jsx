/**
 * AlertsBackground
 * ----------------
 * Ambient layered backdrop for the Security Incident Center:
 *  - large blurred radial color fields (cyan / indigo / violet / rose)
 *  - two drifting glass orbs
 *  - a soft tech grid fading toward the bottom
 *  - fine film-grain noise
 *  - a slow ambient scan band
 *  - a bottom vignette for depth
 *
 * Pure decoration — pointer-events are disabled so it never interferes
 * with the workspace above it.
 */
function AlertsBackground() {
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
        >
            {/* Large radial color fields */}
            <div
                className="absolute -top-40 left-1/2 h-[34rem] w-[64rem] -translate-x-1/2 rounded-full opacity-40"
                style={{
                    background:
                        "radial-gradient(closest-side, rgba(34,211,238,0.26), rgba(37,99,235,0.15) 55%, transparent 100%)",
                    filter: "blur(70px)",
                }}
            />
            <div
                className="absolute top-24 -left-56 h-[30rem] w-[30rem] rounded-full opacity-35"
                style={{
                    background:
                        "radial-gradient(closest-side, rgba(99,102,241,0.30), transparent 100%)",
                    filter: "blur(80px)",
                }}
            />
            <div
                className="absolute top-1/3 -right-64 h-[32rem] w-[32rem] rounded-full opacity-30"
                style={{
                    background:
                        "radial-gradient(closest-side, rgba(168,85,247,0.26), transparent 100%)",
                    filter: "blur(90px)",
                }}
            />
            <div
                className="absolute bottom-[-12rem] left-1/4 h-[28rem] w-[44rem] rounded-full opacity-25"
                style={{
                    background:
                        "radial-gradient(closest-side, rgba(244,63,94,0.22), transparent 100%)",
                    filter: "blur(100px)",
                }}
            />

            {/* Drifting glass orbs */}
            <div
                className="alerts-orb top-[16%] left-[8%] h-40 w-40"
                style={{ background: "rgba(34,211,238,0.14)" }}
            />
            <div
                className="alerts-orb alerts-orb--b bottom-[18%] right-[10%] h-52 w-52"
                style={{ background: "rgba(139,92,246,0.16)" }}
            />

            {/* Tech grid (fades out downward) */}
            <div className="alerts-grid absolute inset-x-0 top-0 h-[42rem]" />

            {/* Slow ambient scan band */}
            <div
                className="alerts-ambient-scan absolute inset-x-0 top-0 h-40"
                style={{
                    background:
                        "linear-gradient(to bottom, transparent, rgba(34,211,238,0.035), rgba(99,102,241,0.045), transparent)",
                }}
            />

            {/* Film grain */}
            <div className="alerts-noise absolute inset-0" />

            {/* Bottom vignette for depth */}
            <div
                className="absolute inset-x-0 bottom-0 h-72"
                style={{
                    background:
                        "linear-gradient(to top, rgba(2,6,23,0.75), transparent)",
                }}
            />
        </div>
    );
}

export default AlertsBackground;
