import React from "react";

/**
 * Engineered Technical SVG Branch Connector for Sentinel AI Sidebar.
 *
 * Spec §10 — Branch Geometry:
 * - Trunk x: 21 (center of 18px parent icon: 12px padding + 9px half-icon)
 * - Trunk width: 1px, round caps
 * - Elbow radius: 8
 * - Elbow end x: 29
 * - Horizontal tail end / node x: 32
 * - Node radius: idle 2, active 2.5
 * - Child center y: 4 + index * 35 + 16
 * - Trunk end y: lastChildCenterY - 8
 * - Origin node at (21, 0) with radius 2.5, fill #e3b985 — active group only
 */

const CHILD_H = 32;
const CHILD_GAP = 3;
const ROW_PITCH = CHILD_H + CHILD_GAP; // 35px
const PADDING_TOP = 4; // childrenInnerPaddingTop
const TRUNK_X = 21;
const NODE_X = 32;
const ELBOW_END_X = 29;
const RADIUS = 8;
const NODE_R_IDLE = 2;
const NODE_R_ACTIVE = 2.5;
const ORIGIN_NODE_R = 2.5;

function getChildCenterY(index) {
  return PADDING_TOP + index * ROW_PITCH + CHILD_H / 2; // 4 + index * 35 + 16
}

export function BranchConnector({
  childCount,
  activeIndex = -1,
  hoveredIndex = -1,
}) {
  if (childCount <= 0) return null;

  const lastCenterY = getChildCenterY(childCount - 1);
  const trunkEndY = lastCenterY - RADIUS;
  const totalHeight = PADDING_TOP + (childCount - 1) * ROW_PITCH + CHILD_H;

  // Build elbow curve path from trunk to child node
  const getElbowPath = (index) => {
    const cy = getChildCenterY(index);
    const curveStartY = cy - RADIUS;
    return `M ${TRUNK_X} ${curveStartY} Q ${TRUNK_X} ${cy} ${ELBOW_END_X} ${cy} L ${NODE_X} ${cy}`;
  };

  // Build single active path from origin (0,0) down the trunk and into the active child elbow
  let activePath = "";
  if (activeIndex >= 0 && activeIndex < childCount) {
    const cy = getChildCenterY(activeIndex);
    const curveStartY = cy - RADIUS;
    activePath = `M ${TRUNK_X} 0 L ${TRUNK_X} ${curveStartY} Q ${TRUNK_X} ${cy} ${ELBOW_END_X} ${cy} L ${NODE_X} ${cy}`;
  }

  const hasActiveChild = activeIndex >= 0 && activeIndex < childCount;

  return (
    <svg
      className="sb-branch-svg"
      style={{ height: totalHeight }}
      viewBox={`0 0 40 ${totalHeight}`}
      aria-hidden="true"
    >
      {/* 1. Main Vertical Trunk Line */}
      <line
        x1={TRUNK_X}
        y1={0}
        x2={TRUNK_X}
        y2={trunkEndY}
        className="sb-path-trunk"
      />

      {/* 2. Branch Elbows and Node Markers */}
      {Array.from({ length: childCount }).map((_, i) => {
        const isHovered = hoveredIndex === i;
        const isActive = activeIndex === i;
        const cy = getChildCenterY(i);

        return (
          <React.Fragment key={i}>
            <path
              d={getElbowPath(i)}
              className="sb-path-elbow"
              style={
                isHovered
                  ? { stroke: "rgba(214,204,194,0.38)" }
                  : undefined
              }
            />
            {/* Node Dot */}
            <circle
              cx={NODE_X}
              cy={cy}
              r={isActive ? NODE_R_ACTIVE : NODE_R_IDLE}
              className={`sb-node-dot ${isActive ? "is-active" : ""}`}
            />
          </React.Fragment>
        );
      })}

      {/* 3. Active path from origin to active child */}
      {activePath && (
        <path
          d={activePath}
          className="sb-path-active"
        />
      )}

      {/* 4. Origin node — active group only */}
      {hasActiveChild && (
        <circle
          cx={TRUNK_X}
          cy={0}
          r={ORIGIN_NODE_R}
          fill="#e3b985"
        />
      )}
    </svg>
  );
}

export default React.memo(BranchConnector);
