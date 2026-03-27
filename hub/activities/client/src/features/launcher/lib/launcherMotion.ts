import type { Transition } from "motion/react";

import type {
  LauncherPagingZone,
  LauncherSnapDecision,
  LauncherSnapDecisionReason,
} from "../../../types/activityUi.ts";
import type { ActivitySection } from "../../../lib/activityConstants.ts";

export type LauncherAnchor = {
  section: ActivitySection;
  index: number;
  left: number;
};

export const LAUNCHER_WHEEL_END_MS = 96;
export const LAUNCHER_IDLE_SCROLL_SETTLE_MS = 140;
export const LAUNCHER_POINTER_DRAG_THRESHOLD_PX = 8;
export const LAUNCHER_PAGE_THRESHOLD = 0.3;
export const LAUNCHER_PAGE_VELOCITY_CUTOFF = 0.48;
export const LAUNCHER_EDGE_RESISTANCE = 0.34;
export const LAUNCHER_DRAG_RESISTANCE = 0.9;
export const LAUNCHER_SETTLE_BASE_MS = 220;
export const LAUNCHER_SETTLE_MAX_MS = 360;
export const LAUNCHER_SETTLE_DISTANCE_FACTOR = 0.18;

export const LAUNCHER_SCENE_TRANSITION: Transition = {
  duration: 0.24,
  ease: [0.22, 1, 0.36, 1],
};

export const LAUNCHER_DOCK_TRANSITION: Transition = {
  duration: 0.2,
  ease: [0.2, 0.9, 0.2, 1],
};

export const LAUNCHER_INDICATOR_TRANSITION: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 32,
  mass: 0.82,
};

export const LAUNCHER_NOTICE_TRANSITION: Transition = {
  duration: 0.2,
  ease: [0.16, 1, 0.3, 1],
};

export const LAUNCHER_MODAL_SCRIM_TRANSITION: Transition = {
  duration: 0.18,
  ease: [0.25, 0.8, 0.25, 1],
};

export const LAUNCHER_MODAL_SHEET_TRANSITION: Transition = {
  type: "spring",
  stiffness: 340,
  damping: 30,
  mass: 0.88,
};

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeWheelDelta(delta: number, deltaMode: number) {
  if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return delta * 18;
  }
  if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return delta * window.innerWidth * 0.92;
  }

  return delta;
}

export function applyEdgeResistance(
  nextLeft: number,
  minLeft: number,
  maxLeft: number,
  resistance = LAUNCHER_EDGE_RESISTANCE
) {
  if (nextLeft < minLeft) {
    return minLeft + (nextLeft - minLeft) * resistance;
  }
  if (nextLeft > maxLeft) {
    return maxLeft + (nextLeft - maxLeft) * resistance;
  }

  return nextLeft;
}

export function getNearestAnchorIndex(anchors: LauncherAnchor[], scrollLeft: number) {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  anchors.forEach((anchor, index) => {
    const distance = Math.abs(scrollLeft - anchor.left);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

export function resolveProgressBetween(
  currentLeft: number,
  fromLeft: number,
  toLeft: number
) {
  if (toLeft === fromLeft) {
    return 0;
  }

  return clamp((currentLeft - fromLeft) / (toLeft - fromLeft), 0, 1);
}

export function resolveSnapDecision(options: {
  anchors: LauncherAnchor[];
  baseIndex: number;
  scrollLeft: number;
  velocityPxPerMs: number;
}) {
  const { anchors, baseIndex, scrollLeft, velocityPxPerMs } = options;
  const baseAnchor = anchors[baseIndex];
  const maxIndex = anchors.length - 1;

  if (!baseAnchor) {
    return null;
  }

  const offsetFromBase = scrollLeft - baseAnchor.left;
  const inferredDirection =
    offsetFromBase === 0 ? 0 : offsetFromBase > 0 ? 1 : -1;
  const velocityDirection = velocityPxPerMs === 0 ? 0 : velocityPxPerMs > 0 ? 1 : -1;
  const direction = velocityDirection === 0 ? inferredDirection : velocityDirection;
  const candidateIndex =
    direction === 0 ? baseIndex : clamp(baseIndex + direction, 0, maxIndex);
  const candidate = anchors[candidateIndex] || baseAnchor;
  const progress = resolveProgressBetween(scrollLeft, baseAnchor.left, candidate.left);
  let reason: LauncherSnapDecisionReason = "return";
  let targetIndex = baseIndex;

  if (candidateIndex !== baseIndex) {
    if (progress >= LAUNCHER_PAGE_THRESHOLD) {
      reason = "threshold";
      targetIndex = candidateIndex;
    } else if (Math.abs(velocityPxPerMs) >= LAUNCHER_PAGE_VELOCITY_CUTOFF) {
      reason = "velocity";
      targetIndex = candidateIndex;
    }
  } else if (
    (baseIndex === 0 && scrollLeft < baseAnchor.left) ||
    (baseIndex === maxIndex && scrollLeft > baseAnchor.left)
  ) {
    reason = "edge";
  }

  const target = anchors[targetIndex] || baseAnchor;
  const decision: LauncherSnapDecision = {
    fromSection: baseAnchor.section,
    toSection: target.section,
    direction: targetIndex === baseIndex ? 0 : targetIndex > baseIndex ? 1 : -1,
    progress,
    reason,
  };

  return {
    decision,
    target,
    targetIndex,
  };
}

export function resolvePagingZone(target: EventTarget | null): LauncherPagingZone {
  if (!(target instanceof Element)) {
    return "unknown";
  }

  if (target.closest("[data-launcher-page-zone='blocked']")) {
    return "blocked";
  }

  if (
    target.closest(
      "button, a, input, textarea, select, option, label, summary, [role='button'], [role='link'], [role='slider'], [contenteditable='true'], [data-launcher-page-zone='interactive']"
    )
  ) {
    return "interactive";
  }

  if (target.closest("[data-launcher-page-zone='content']")) {
    return "content";
  }

  if (target.closest("[data-launcher-page-zone='chrome']")) {
    return "chrome";
  }

  if (target.closest(".carousel-shell")) {
    return "chrome";
  }

  return "unknown";
}
