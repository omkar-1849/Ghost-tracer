/* ============================================================
   Modal — Dialog overlay primitive
   ============================================================ */

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  className = "",
}) {
  const overlayRef = useRef(null);

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

  const widths = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        ref={overlayRef}
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
          relative w-full ${widths[size] || widths.md}
          bg-gradient-to-b from-[rgba(28,25,23,0.95)] to-[rgba(18,16,14,0.98)]
          backdrop-blur-[28px] saturate-[125%]
          border border-[rgba(211,160,106,0.18)]
          rounded-[20px]
          shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_24px_64px_-12px_rgba(0,0,0,0.75)]
          animate-[modal-in_0.18s_cubic-bezier(0.16,1,0.3,1)_both]
          ${className}
        `.trim()}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(245,241,236,0.06)]">
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
        )}

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto max-h-[60vh] text-[#d6cfc7]">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(245,241,236,0.06)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
