import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { NavLink } from "react-router-dom";

/**
 * CollapsedFlyout
 *
 * Appears when the sidebar is collapsed and the user hovers, focuses,
 * or clicks on a parent group icon.
 * Rendered in a React Portal attached to document.body to avoid clipping.
 *
 * Spec §16: Flyout material, gradient rim, 16px radius, 8px padding,
 * min-width 200px, 12px offset from rail, 110ms entrance animation.
 * §11: Every child has its icon at 16px.
 */
export function CollapsedFlyout({
  triggerRef,
  group,
  isOpen,
  onClose,
  activeChildPath,
}) {
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const flyoutRef = useRef(null);
  const closeTimerRef = useRef(null);

  // Compute position relative to trigger button — 12px offset from rail (§16)
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({
      top: Math.max(12, rect.top),
      left: rect.right + 12, // 12px offset from collapsed rail (spec §16)
    });
  }, [isOpen, triggerRef]);

  // Handle escape key and outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        onClose();
        triggerRef.current?.focus();
      }
    }

    function handlePointerDown(e) {
      if (
        flyoutRef.current &&
        !flyoutRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen || typeof document === "undefined") return null;

  const handleMouseEnter = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  };

  const handleMouseLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      onClose();
    }, 150); // 150ms close grace
  };

  return createPortal(
    <div
      ref={flyoutRef}
      role="menu"
      aria-label={group.title}
      className="sb-flyout"
      style={{
        top: `${coords.top}px`,
        left: `${coords.left}px`,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Group title header in flyout — §16: 11px uppercase */}
      <div className="sb-flyout-title">
        {group.title}
      </div>

      {/* Child links with icons — §16: 34px rows, 10px radius, 16px icon, 8px gap */}
      <div>
        {group.children.map((child) => {
          const isActive = child.to === activeChildPath ||
            (child.to !== "/" && activeChildPath.startsWith(child.to));
          const ChildIcon = child.icon;
          return (
            <NavLink
              key={child.to}
              to={child.to}
              onClick={onClose}
              className={`sb-flyout-row sb-focusable ${
                isActive ? "is-active" : ""
              }`}
            >
              {ChildIcon && (
                <ChildIcon
                  size={16}
                  strokeWidth={1.5}
                  style={{
                    color: isActive ? "#e3b985" : "#a9a199",
                    flexShrink: 0,
                  }}
                />
              )}
              <span className="truncate flex-1">{child.label}</span>
              {child.badgeCount > 0 && (
                <span className="sb-badge" style={{ marginLeft: 8 }}>
                  {child.badgeCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>
    </div>,
    document.body
  );
}

export default CollapsedFlyout;
