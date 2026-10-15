/* ============================================================
   Skeleton — Loading placeholder primitive
   ============================================================ */

export default function Skeleton({ className = "", ...props }) {
  return (
    <div
      className={`rounded-lg bg-[rgba(255,248,238,0.06)] animate-pulse ${className}`}
      {...props}
    />
  );
}
