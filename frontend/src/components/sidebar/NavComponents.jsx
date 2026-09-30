import React, { useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import BranchConnector from "./BranchConnector";
import CollapsedFlyout from "./CollapsedFlyout";

/**
 * NavLeaf: Renders a top-level single item (e.g. Dashboard).
 * Spec §8.2: Same material as parent row (§9.1). Icon LayoutGrid. No chevron.
 * Spec §9: Gradient rim via CSS ::before; active tint via CSS ::after.
 * §14: Remove left section-indicator pill.
 */
export const NavLeaf = React.memo(function NavLeaf({
  item,
  isCollapsed,
  currentPath,
}) {
  const Icon = item.icon;
  const isActive = currentPath === item.to;

  return (
    <div className="sb-dashboard-leaf">
      <NavLink
        to={item.to}
        end={item.end}
        aria-current={isActive ? "page" : undefined}
        title={item.label}
        className={`sb-row-parent sb-focusable ${isActive ? "is-active" : ""}`}
        style={isCollapsed ? { width: 40, height: 40, padding: 0, justifyContent: "center", borderRadius: 12 } : undefined}
      >
        <Icon
          size={isCollapsed ? 18 : 18}
          strokeWidth={isActive ? 1.75 : 1.6}
          style={{ color: isActive ? "#ffe9cc" : "#d6cfc7", position: "relative", zIndex: 1 }}
        />

        {!isCollapsed && (
          <span
            className="truncate flex-1 text-left"
            style={{ position: "relative", zIndex: 1 }}
            title={item.label}
          >
            {item.label}
          </span>
        )}

        {!isCollapsed && item.badgeCount > 0 && (
          <span className="sb-badge" style={{ position: "relative", zIndex: 1 }}>
            {item.badgeCount}
          </span>
        )}
      </NavLink>
    </div>
  );
});

/**
 * NavGroup: Renders a collapsible group with trunk and branch elbows.
 * Spec §8.3: Operations, Security, Management — parent row plus children.
 * Spec §9.1-9.4: Parent idle/hover/active materials; child materials.
 * Spec §11: Every child has a 16px line icon.
 * §14: Remove left section-indicator pill.
 */
export const NavGroup = React.memo(function NavGroup({
  group,
  isOpen,
  onToggle,
  isCollapsed,
  currentPath,
}) {
  const Icon = group.icon;
  const triggerRef = useRef(null);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [hoveredChildIndex, setHoveredChildIndex] = useState(-1);
  const flyoutTimerRef = useRef(null);

  // Check if any child is active
  const activeChildIndex = group.children.findIndex(
    (c) => c.to === currentPath || (c.to !== "/" && currentPath.startsWith(c.to))
  );
  const isGroupActive = activeChildIndex >= 0;

  // Aggregate badges if any
  const totalBadges = group.children.reduce(
    (acc, child) => acc + (child.badgeCount || 0),
    0
  );

  // Handle collapsed flyout hover intent
  const handleMouseEnter = () => {
    if (!isCollapsed) return;
    flyoutTimerRef.current = setTimeout(() => {
      setFlyoutOpen(true);
    }, 120); // 120ms intent delay
  };

  const handleMouseLeave = () => {
    if (!isCollapsed) return;
    if (flyoutTimerRef.current) clearTimeout(flyoutTimerRef.current);
    setTimeout(() => {
      // Small grace period
      setFlyoutOpen(false);
    }, 150);
  };

  return (
    <div
      className="sb-group-wrapper relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Parent Row Toggle Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (isCollapsed) {
            setFlyoutOpen((prev) => !prev);
          } else {
            onToggle(group.id);
          }
        }}
        aria-expanded={isOpen}
        aria-controls={`sb-group-${group.id}`}
        aria-label={group.title}
        title={isCollapsed ? group.title : undefined}
        className={`sb-row-parent sb-focusable ${
          isGroupActive ? "is-active" : ""
        }`}
        style={isCollapsed ? { width: 40, height: 40, padding: 0, justifyContent: "center", borderRadius: 12, position: "relative" } : undefined}
      >
        <Icon
          size={isCollapsed ? 18 : 18}
          strokeWidth={isGroupActive ? 1.75 : 1.6}
          style={{ color: isGroupActive ? "#ffe9cc" : "#d6cfc7", position: "relative", zIndex: 1 }}
        />

        {!isCollapsed && (
          <>
            <span
              className="truncate flex-1 text-left"
              style={{ position: "relative", zIndex: 1 }}
              title={group.title}
            >
              {group.title}
            </span>

            {/* If closed, show aggregate badge if exists */}
            {!isOpen && totalBadges > 0 && (
              <span className="sb-badge" style={{ position: "relative", zIndex: 1, marginRight: 4 }}>
                {totalBadges}
              </span>
            )}

            <ChevronDown
              size={14}
              strokeWidth={1.75}
              style={{
                color: isGroupActive ? "#ffe9cc" : "#8b837b",
                transition: "transform 180ms ease",
                transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                position: "relative",
                zIndex: 1,
              }}
            />
          </>
        )}

        {/* Collapsed badge at top-right */}
        {isCollapsed && totalBadges > 0 && (
          <span className="sb-badge sb-badge-collapsed">
            {totalBadges}
          </span>
        )}
      </button>

      {/* Flyout when collapsed */}
      {isCollapsed && (
        <CollapsedFlyout
          triggerRef={triggerRef}
          group={group}
          isOpen={flyoutOpen}
          onClose={() => setFlyoutOpen(false)}
          activeChildPath={currentPath}
        />
      )}

      {/* Expanded Children Branch Container */}
      {!isCollapsed && (
        <div
          id={`sb-group-${group.id}`}
          className={`sb-children-grid ${isOpen ? "is-open" : "is-closed"}`}
        >
          <div className="sb-children-inner">
            <div className="relative">
              {/* Deterministic SVG Branch Connector */}
              <BranchConnector
                childCount={group.children.length}
                activeIndex={activeChildIndex}
                hoveredIndex={hoveredChildIndex}
              />

              {/* Children Links */}
              <ul className="list-none p-0 m-0" style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                {group.children.map((child, index) => {
                  const ChildIcon = child.icon;
                  const isChildActive = index === activeChildIndex;
                  return (
                    <li key={child.to}>
                      <NavLink
                        to={child.to}
                        aria-current={isChildActive ? "page" : undefined}
                        onMouseEnter={() => setHoveredChildIndex(index)}
                        onMouseLeave={() => setHoveredChildIndex(-1)}
                        className={`sb-row-child sb-focusable ${
                          isChildActive ? "is-active" : ""
                        }`}
                        title={child.label}
                      >
                        {/* Child icon — 16px, stroke 1.5 */}
                        {ChildIcon && (
                          <ChildIcon
                            size={16}
                            strokeWidth={1.5}
                            style={{
                              color: isChildActive ? "#e3b985" : "#a9a199",
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span className="truncate flex-1">{child.label}</span>
                        {child.badgeCount > 0 && (
                          <span className="sb-badge">
                            {child.badgeCount}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
