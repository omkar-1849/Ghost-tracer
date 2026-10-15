/* ============================================================
   Drawer — Right-side slide-over panel
   ============================================================ */

import { X } from "lucide-react";
import { useEffect } from "react";

export default function Drawer({
  open,
  onClose,
  title,
  children,
  width = "max-w-md",
  className = "",
}) {
  useEffect(() => {
    if (!open) return;

    function handleKey(e) {
      if (e.key === "Escape") onClose?.();
    }

    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[rgba(4,5,8,0.70)] backdrop-blur-[8px] animate-[fade-in_0.15s_ease-out_both]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`
          relative w-full ${width} h-full
          bg-gradient-to-b from-[rgba(24,21,19,0.96)] to-[rgba(16,14,13,0.98)]
          backdrop-blur-[28px] saturate-[125%]
          border-l border-[rgba(211,160,106,0.18)]
          shadow-[inset_1px_0_1px_rgba(255,255,255,0.06),-24px_0_64px_rgba(0,0,0,0.75)]
          animate-[drawer-in_0.2s_cubic-bezier(0.16,1,0.3,1)_both]
          flex flex-col
          ${className}
        `.trim()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(245,241,236,0.06)] shrink-0">
          <h2 className="text-[15px] font-semibold text-[#f5f1ec]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#a9a199] hover:text-[#f5f1ec] hover:bg-[rgba(211,160,106,0.10)] transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 text-[#d6cfc7]">{children}</div>
      </div>
    </div>
  );
}
