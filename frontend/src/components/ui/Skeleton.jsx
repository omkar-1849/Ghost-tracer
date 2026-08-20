/* ============================================================
   Skeleton — Loading placeholder primitive
   ============================================================ */

export default function Skeleton({ className = "", ...props }) {
  return (
    <div
      className={`rounded bg-[var(--color-surface-3)] animate-pulse ${className}`}
      {...props}
    />
  );
}
