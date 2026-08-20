/* ============================================================
   Spinner — Loading indicator
   ============================================================ */

import { Loader2 } from "lucide-react";

export default function Spinner({ size = 20, className = "" }) {
  return (
    <Loader2
      size={size}
      className={`animate-spin text-[var(--color-text-muted)] ${className}`}
    />
  );
}
