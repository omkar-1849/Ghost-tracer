import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  Box,
  ShieldCheck,
  Sliders,
  Bell,
  TriangleAlert,
  Zap,
  Activity,
  Globe,
  Radar,
  FileText,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  User,
  LogOut,
  MoreHorizontal,
  Brain,
} from "lucide-react";

import { getOrganization, logout, switchOrganization } from "../services/authClient";
import { NavLeaf, NavGroup } from "./sidebar/NavComponents";
import "./sidebar/sidebar.css";

/**
 * BrandMark — §8.1: Keep the shield geometry, change stroke to bronze gradient,
 * stroke width 1.6, no fill. Size 32px.
 */
function BrandMark({ size = 32 }) {
  const gradientId = "sb-brand-gradient";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e3b985" />
          <stop offset="100%" stopColor="#b98248" />
        </linearGradient>
      </defs>
      <path
        d="M16 6L24 10V17C24 22.5 20.6 25.8 16 27C11.4 25.8 8 22.5 8 17V10L16 6Z"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="16" cy="16" r="2.5" fill={`url(#${gradientId})`} />
    </svg>
  );
}

const STORAGE_KEY_OPEN_GROUPS = "sentinel_sb_open_groups";
const STORAGE_KEY_COLLAPSED = "sentinel_sb_collapsed";

export function Sidebar({ mobileOpen = false, onMobileClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const org = getOrganization();

  // Collapsed rail state (persisted)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_COLLAPSED) === "true";
    } catch {
      return false;
    }
  });

  // Track user menu dropdown in footer
  const [footerMenuOpen, setFooterMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  /**
   * Navigation tree — §11: Routes, labels, order and RBAC stay exactly as they are.
   * Icons added per §11 table. Child icons added as `icon` field.
   */
  const navTree = useMemo(
    () => ({
      leafTop: {
        to: "/",
        label: "Dashboard",
        icon: LayoutGrid,
        end: true,
      },
      groups: [
        {
          id: "operations",
          title: "Operations",
          icon: Box,
          children: [
            { to: "/alerts", label: "Threats", icon: Bell },
            { to: "/analyst", label: "AI Analyst", icon: Brain },
            { to: "/incidents", label: "Incidents", icon: TriangleAlert },
            { to: "/response-actions", label: "Response", icon: Zap },
            { to: "/activity", label: "Activity", icon: Activity },
          ],
        },
        {
          id: "security",
          title: "Security",
          icon: ShieldCheck,
          children: [
            { to: "/websites", label: "Assets", icon: Globe },
            { to: "/scanner", label: "Scanner", icon: Radar },
          ],
        },
        {
          id: "management",
          title: "Management",
          icon: Sliders,
          children: [
            { to: "/audit-logs", label: "Audit Logs", icon: FileText },
            { to: "/settings", label: "Settings", icon: Settings },
          ],
        },
      ],
    }),
    []
  );

  // Derive active group id directly from current route path
  const activeGroupId = useMemo(() => {
    const group = navTree.groups.find((g) =>
      g.children.some((c) => c.to === currentPath || (c.to !== "/" && currentPath.startsWith(c.to)))
    );
    return group ? group.id : null;
  }, [currentPath, navTree.groups]);

  // Manually toggled open/close state dictionary
  const [userToggledGroups, setUserToggledGroups] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_OPEN_GROUPS);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {};
  });

  // Effective open status for a group:
  // It is open if:
  // 1. It contains the currently active route (auto-expand rule), OR
  // 2. The user explicitly toggled it open (or stored in localStorage)
  const isGroupOpen = useCallback(
    (groupId) => {
      if (groupId === activeGroupId) return true;
      if (typeof userToggledGroups[groupId] === "boolean") {
        return userToggledGroups[groupId];
      }
      return false;
    },
    [activeGroupId, userToggledGroups]
  );

  // Persist collapse state
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_COLLAPSED, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Toggle group open/close explicitly
  const toggleGroup = useCallback(
    (groupId) => {
      setUserToggledGroups((prev) => {
        const currentlyOpen = isGroupOpen(groupId);
        const next = { ...prev, [groupId]: !currentlyOpen };
        try {
          localStorage.setItem(STORAGE_KEY_OPEN_GROUPS, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [isGroupOpen]
  );

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Logout failed", err);
    } finally {
      setLoggingOut(false);
    }
  };

  const navRef = useRef(null);
  const prevRouteRef = useRef(currentPath);
  const prevTopRef = useRef(0);

  // iOS-style moving active glass capsule state
  const [indicator, setIndicator] = useState({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    visible: false,
    direction: null,
    motionKey: 0,
    isInitial: true,
  });

  // Track and update the moving active glass capsule
  useEffect(() => {
    const routeChanged = prevRouteRef.current !== currentPath;
    prevRouteRef.current = currentPath;

    const nav = navRef.current;
    if (!nav) return;

    let frameId;
    let timerId;
    let startTime = null;
    const TRACK_DURATION = 280;

    const measureActive = (isFirstPass = false) => {
      const activeEl = nav.querySelector('[data-sb-active="true"]');
      if (!activeEl) {
        setIndicator((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      const navRect = nav.getBoundingClientRect();
      const elRect = activeEl.getBoundingClientRect();
      if (elRect.width === 0 || elRect.height === 0) return;

      const targetTop = elRect.top - navRect.top + nav.scrollTop;
      const targetLeft = elRect.left - navRect.left;
      const targetWidth = elRect.width;
      const targetHeight = elRect.height;

      setIndicator((prev) => {
        if (
          prev.visible &&
          Math.abs(prev.top - targetTop) < 0.5 &&
          Math.abs(prev.left - targetLeft) < 0.5 &&
          Math.abs(prev.width - targetWidth) < 0.5 &&
          Math.abs(prev.height - targetHeight) < 0.5
        ) {
          return prev;
        }

        if (prev.isInitial) {
          prevTopRef.current = targetTop;
          return {
            top: targetTop,
            left: targetLeft,
            width: targetWidth,
            height: targetHeight,
            visible: true,
            direction: null,
            motionKey: prev.motionKey,
            isInitial: false,
          };
        }

        const deltaY = targetTop - prevTopRef.current;
        const newDirection =
          isFirstPass && routeChanged && Math.abs(deltaY) > 4
            ? deltaY > 0
              ? "down"
              : "up"
            : prev.direction;

        prevTopRef.current = targetTop;

        return {
          top: targetTop,
          left: targetLeft,
          width: targetWidth,
          height: targetHeight,
          visible: true,
          direction: newDirection,
          motionKey: isFirstPass && routeChanged ? prev.motionKey + 1 : prev.motionKey,
          isInitial: false,
        };
      });
    };

    // First measurement immediately
    measureActive(true);

    // Frame tracking for smooth accordion transitions
    const trackLoop = (time) => {
      if (!startTime) startTime = time;
      measureActive(false);
      if (time - startTime < TRACK_DURATION) {
        frameId = requestAnimationFrame(trackLoop);
      }
    };
    frameId = requestAnimationFrame(trackLoop);

    // Settle animation class after 420ms
    timerId = setTimeout(() => {
      setIndicator((prev) => (prev.direction ? { ...prev, direction: null } : prev));
    }, 420);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      if (timerId) clearTimeout(timerId);
    };
  }, [currentPath, isCollapsed, userToggledGroups]);

  // Window resize observer to keep capsule aligned
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const ro = new ResizeObserver(() => {
      const activeEl = nav.querySelector('[data-sb-active="true"]');
      if (!activeEl) return;
      const navRect = nav.getBoundingClientRect();
      const elRect = activeEl.getBoundingClientRect();
      if (elRect.width === 0 || elRect.height === 0) return;

      const tt = elRect.top - navRect.top + nav.scrollTop;
      const tl = elRect.left - navRect.left;
      const tw = elRect.width;
      const th = elRect.height;

      setIndicator((prev) => {
        if (
          Math.abs(prev.top - tt) < 0.5 &&
          Math.abs(prev.left - tl) < 0.5 &&
          Math.abs(prev.width - tw) < 0.5 &&
          Math.abs(prev.height - th) < 0.5
        ) {
          return prev;
        }
        prevTopRef.current = tt;
        return {
          ...prev,
          top: tt,
          left: tl,
          width: tw,
          height: th,
          visible: true,
        };
      });
    });

    ro.observe(nav);
    return () => ro.disconnect();
  }, []);

  // §8.4: Get the display name and first letter for the avatar
  const displayName = org?.name || "Sentinel SOC";
  const displayRole = org?.current_user_role || "Analyst";
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <>
      {/* Mobile Drawer Backdrop — §17: rgba(0,0,0,0.60) with blur(4px) */}
      {mobileOpen && (
        <div
          className="sb-mobile-backdrop md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Desktop Layout In-Flow Spacer — §4: 272px expanded, 104px collapsed */}
      <div
        className={`sb-layout-spacer ${isCollapsed ? "is-collapsed" : ""}`}
        aria-hidden="true"
      />

      {/* Fixed Floating Navigation Shell */}
      <div
        className={`sb-floating-wrapper ${
          mobileOpen ? "fixed inset-y-3 left-3 z-50 flex shadow-2xl" : "hidden md:flex"
        }`}
      >
        {/* §7.2: Ambient backdrop layer — rendered BEFORE .sb-container */}
        <div className="sb-ambient" aria-hidden="true" />

        <aside
          className={`sb-container ${isCollapsed ? "is-collapsed" : ""}`}
          aria-label="Primary"
        >
          {/* §7.1: Grain texture layer inside the shell */}
          <div className="sb-grain" aria-hidden="true" />

          {/* 1. Header — §8.1: 64px (collapsed: 92px) */}
          <div
            className="sb-header"
            style={isCollapsed ? { height: 92, flexDirection: "column", justifyContent: "flex-start", paddingTop: 16, gap: 12 } : { justifyContent: "space-between" }}
          >
            <div className={`flex items-center min-w-0 ${isCollapsed ? "justify-center" : "gap-2.5"}`}>
              <BrandMark size={32} />
              {!isCollapsed && (
                <div className="min-w-0 truncate">
                  {/* §8.1: "Sentinel AI" as one text line, 15px / 600, -0.01em */}
                  <div
                    style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      color: "#f5f1ec",
                      lineHeight: 1.2,
                    }}
                  >
                    Sentinel AI
                  </div>
                  {/* §8.1: Tagline "SOC INTELLIGENCE", 10px / 500, uppercase, 0.08em */}
                  <p
                    style={{
                      fontSize: "10px",
                      fontWeight: 500,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "#a9a199",
                      lineHeight: 1.2,
                      marginTop: "3px",
                    }}
                  >
                    SOC Intelligence
                  </p>
                </div>
              )}
            </div>

            {/* Collapse Toggle — §8.1: 28×28px, r=9px, ChevronsLeft/ChevronsRight */}
            <button
              type="button"
              onClick={toggleCollapse}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="sb-collapse-toggle sb-focusable"
            >
              {isCollapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
            </button>
          </div>

          {/* 2. Nav Tree Scroll Area */}
          <nav
            ref={navRef}
            className={`sb-nav-scroll sb-nav-scroll-mask ${
              isCollapsed ? "is-collapsed" : ""
            }`}
            aria-label="Navigation Tree"
          >
            {/* The iOS-Style Moving Active Glass Surface */}
            <div
              className={`sb-active-indicator ${
                indicator.direction ? `is-moving-${indicator.direction}` : ""
              }`}
              style={{
                transform: `translate3d(${indicator.left}px, ${indicator.top}px, 0)`,
                width: `${indicator.width}px`,
                height: `${indicator.height}px`,
                opacity: indicator.visible ? 1 : 0,
              }}
              aria-hidden="true"
            >
              <div key={indicator.motionKey} className="sb-active-indicator-body">
                <div className="sb-active-indicator-highlight" />
                <div className="sb-active-indicator-tint" />
              </div>
            </div>

            {/* Top-Level Leaf: Dashboard — §8.2: icon LayoutGrid, no chevron */}
            <NavLeaf
              item={navTree.leafTop}
              isCollapsed={isCollapsed}
              currentPath={currentPath}
            />

            {/* Grouped Tree Branches — §8.3 */}
            <div>
              {navTree.groups.map((group) => (
                <NavGroup
                  key={group.id}
                  group={group}
                  isOpen={isGroupOpen(group.id)}
                  onToggle={toggleGroup}
                  isCollapsed={isCollapsed}
                  currentPath={currentPath}
                />
              ))}
            </div>
          </nav>

          {/* §8.4: Defense Grid banner REMOVED per spec — reference has none */}

          {/* Footer Divider — §8.4: 1px subtle bronze hairline, inset 16px */}
          <div className="sb-footer-divider" aria-hidden="true" />

          {/* 4. Footer User Card — §8.4: 64px */}
          <div className="sb-footer">
            <div className="relative w-full">
              {/* §8.4: User row is ONE button that opens the existing user menu */}
              <button
                type="button"
                onClick={() => setFooterMenuOpen((prev) => !prev)}
                aria-expanded={footerMenuOpen}
                aria-label="User Account Menu"
                className="sb-user-btn sb-focusable"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  borderRadius: "12px",
                  textAlign: "left",
                  padding: isCollapsed ? "4px" : "6px 8px",
                  justifyContent: isCollapsed ? "center" : "flex-start",
                  background: footerMenuOpen ? "rgba(211, 160, 106, 0.08)" : undefined,
                  borderColor: footerMenuOpen ? "rgba(211, 160, 106, 0.20)" : undefined,
                }}
              >
                {/* §8.4: Avatar — 32px circle, initial letter */}
                <div className="sb-avatar">
                  {displayName ? avatarLetter : <User size={14} />}
                </div>

                {!isCollapsed && (
                  <>
                    <div className="min-w-0 flex-1">
                      {/* §8.4: Name — 13.5px / 500, #f5f1ec */}
                      <p
                        className="truncate leading-tight"
                        style={{
                          fontSize: "13.5px",
                          fontWeight: 500,
                          color: "#f5f1ec",
                        }}
                        title={displayName}
                      >
                        {displayName}
                      </p>
                      {/* §8.4: Role — 11.5px / 400, #a9a199 */}
                      <p
                        className="truncate capitalize"
                        style={{
                          fontSize: "11.5px",
                          fontWeight: 400,
                          color: "#a9a199",
                        }}
                        title={displayRole}
                      >
                        {displayRole}
                      </p>
                    </div>

                    {/* §8.4: "..." glyph — 26px glass circle, decorative, aria-hidden */}
                    <div className="sb-more-button" aria-hidden="true">
                      <MoreHorizontal size={14} />
                    </div>
                  </>
                )}
              </button>

              {/* User Dropdown Menu — §16: flyout material */}
              {footerMenuOpen && (
                <div className="sb-user-menu">
                  {/* Header info */}
                  <div style={{ padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.10)", marginBottom: 4 }}>
                    <p style={{ fontWeight: 600, color: "#f5f1ec", fontSize: "13px" }} className="truncate">
                      {org?.name}
                    </p>
                    <p style={{ fontSize: "11px", color: "#a9a199" }} className="truncate">
                      Role: {org?.current_user_role}
                    </p>
                  </div>
                  {/* Menu items using flyout row style */}
                  <button
                    type="button"
                    onClick={() => {
                      setFooterMenuOpen(false);
                      navigate("/settings");
                    }}
                    className="sb-flyout-row sb-focusable"
                    style={{ width: "100%", textAlign: "left" }}
                  >
                    <Settings size={16} strokeWidth={1.5} style={{ color: "#a9a199", flexShrink: 0 }} />
                    <span>Settings & Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFooterMenuOpen(false);
                      switchOrganization();
                    }}
                    className="sb-flyout-row sb-focusable"
                    style={{ width: "100%", textAlign: "left" }}
                  >
                    <span>Switch organization</span>
                  </button>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "4px 0" }} />
                  <button
                    type="button"
                    disabled={loggingOut}
                    onClick={handleLogout}
                    className="sb-flyout-row sb-focusable"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      color: "#f5f1ec",
                      opacity: loggingOut ? 0.45 : 1,
                    }}
                  >
                    <LogOut size={16} strokeWidth={1.5} style={{ color: "#a9a199", flexShrink: 0 }} />
                    <span>{loggingOut ? "Signing out…" : "Sign out"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

export default Sidebar;
