import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import "./GlassOverlayModal.css";

/**
 * GlassOverlayModal
 *
 * A reusable, floating bubbly dark-graphite glass overlay modal.
 * Rendered into document.body using a React Portal.
 *
 * Features:
 * - Locks document.body scroll while active
 * - Dims and blurs the underlying page tastefully
 * - Independent scrollable viewport for table records
 * - Ambient neutral whitish corner and upper-edge lighting
 * - Dismissable via close button (×), Escape key, or backdrop click
 */
export default function GlassOverlayModal({
    isOpen,
    onClose,
    title,
    subtitle,
    countBadge,
    icon: Icon,
    children,
    footer,
    maxWidth = "max-w-6xl",
}) {
    const panelRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        function handleKeyDown(e) {
            if (e.key === "Escape") {
                onClose?.();
            }
        }

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [isOpen, onClose]);

    if (!isOpen || typeof document === "undefined") return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose?.();
        }
    };

    return createPortal(
        <div
            className="glass-overlay-backdrop animate-fade-in"
            onClick={handleBackdropClick}
            aria-modal="true"
            role="dialog"
        >
            <div
                ref={panelRef}
                className={`glass-overlay-panel ${maxWidth}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Fixed Header */}
                <header className="glass-overlay-header">
                    <div className="flex items-center gap-3 min-w-0">
                        {Icon && (
                            <div className="p-2 rounded-xl bg-[rgba(230,232,234,0.08)] border border-[rgba(230,232,234,0.12)] shrink-0 text-[#C6C7C5]">
                                <Icon size={20} aria-hidden="true" />
                            </div>
                        )}
                        <div className="min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h2 className="glass-overlay-title truncate">{title}</h2>
                                {countBadge && (
                                    <span className="glass-overlay-count-pill shrink-0">
                                        {countBadge}
                                    </span>
                                )}
                            </div>
                            {subtitle && (
                                <p className="glass-overlay-subtitle truncate">{subtitle}</p>
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="glass-close-btn"
                        aria-label="Close overlay"
                    >
                        <X size={18} />
                    </button>
                </header>

                {/* Independently Scrollable Body Area */}
                <main className="glass-overlay-body custom-scrollbar">
                    {children}
                </main>

                {/* Optional Footer */}
                {footer && (
                    <footer className="glass-overlay-footer">
                        {footer}
                    </footer>
                )}
            </div>
        </div>,
        document.body
    );
}
