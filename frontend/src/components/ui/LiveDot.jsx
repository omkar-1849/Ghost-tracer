/* ============================================================
   LiveDot — Subtle animated status indicator
   Uses the P0 pulse-soft animation. No ping, no expanding ring.
   ============================================================ */

export default function LiveDot({ color = "var(--color-success)", size = 6, className = "" }) {
  return (
    <span
      className={`inline-block rounded-full animate-[pulse-soft_2.4s_ease-in-out_infinite] ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
      }}
    />
  );
}
