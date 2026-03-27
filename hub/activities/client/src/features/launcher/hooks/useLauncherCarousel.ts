import { useCallback, useEffect, useRef, useState } from "react";

import { NAV_DOCK_IDLE_MS, SECTIONS, type ActivitySection } from "../../../lib/activityConstants.ts";
import { useActivityUiStore } from "../../../store/activityUiStore.ts";
import type {
  LauncherMotionPhase,
  LauncherPagingZone,
} from "../../../types/activityUi.ts";
import {
  LAUNCHER_DRAG_RESISTANCE,
  LAUNCHER_IDLE_SCROLL_SETTLE_MS,
  LAUNCHER_POINTER_DRAG_THRESHOLD_PX,
  LAUNCHER_SETTLE_BASE_MS,
  LAUNCHER_SETTLE_DISTANCE_FACTOR,
  LAUNCHER_SETTLE_MAX_MS,
  LAUNCHER_WHEEL_END_MS,
  type LauncherAnchor,
  applyEdgeResistance,
  clamp,
  getNearestAnchorIndex,
  normalizeWheelDelta,
  resolvePagingZone,
  resolveProgressBetween,
  resolveSnapDecision,
} from "../lib/launcherMotion.ts";

export type LauncherMotionState = {
  phase: LauncherMotionPhase;
  targetSection: ActivitySection | null;
  progress: number;
  releaseVelocity: number;
  pagingZone: LauncherPagingZone;
  scrollLeft: number;
  sectionFocus: Record<ActivitySection, number>;
};

type UseLauncherCarouselOptions = {
  blocked?: boolean;
};

type InteractionSnapshot = {
  phase: Extract<LauncherMotionPhase, "wheelActive" | "dragActive">;
  baseIndex: number;
  pagingZone: LauncherPagingZone;
  lastLeft: number;
  lastAt: number;
  releaseVelocity: number;
  pointerId: number | null;
  pointerStartX: number;
  pointerStartY: number;
  pointerScrollLeft: number;
  hasDragged: boolean;
};

const DEFAULT_INTERACTION: InteractionSnapshot = {
  phase: "wheelActive",
  baseIndex: 0,
  pagingZone: "unknown",
  lastLeft: 0,
  lastAt: 0,
  releaseVelocity: 0,
  pointerId: null,
  pointerStartX: 0,
  pointerStartY: 0,
  pointerScrollLeft: 0,
  hasDragged: false,
};

const LAUNCHER_WHEEL_LERP_ALPHA = 0.26;
const LAUNCHER_WHEEL_LERP_MIN_STEP = 0.35;

function useEffectEvent<Fn extends (...args: any[]) => any>(handler: Fn): Fn {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  return useCallback(((...args: Parameters<Fn>) => handlerRef.current(...args)) as Fn, []);
}

function createSectionFocus(
  activeSection: ActivitySection,
  scrollLeft: number,
  anchors: LauncherAnchor[],
  viewportWidth: number
) {
  const anchorGap =
    anchors.length > 1
      ? Math.max(
          1,
          anchors.reduce((largestGap, anchor, index) => {
            if (index === 0) {
              return largestGap;
            }

            return Math.max(largestGap, Math.abs(anchor.left - anchors[index - 1]!.left));
          }, 0)
        )
      : Math.max(1, viewportWidth);
  const focusEntries = SECTIONS.map((section) => {
    const anchor = anchors.find((entry) => entry.section === section);
    if (!anchor) {
      return [section, section === activeSection ? 1 : 0] as const;
    }

    const distance = Math.abs(scrollLeft - anchor.left) / anchorGap;
    return [section, Math.max(0, 1 - distance)] as const;
  });

  return Object.fromEntries(focusEntries) as Record<ActivitySection, number>;
}

function getSectionCenteredLeft(carousel: HTMLDivElement, element: HTMLElement) {
  const carouselRect = carousel.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const leftWithinContent = carousel.scrollLeft + (elementRect.left - carouselRect.left);
  return leftWithinContent - (carousel.clientWidth - element.clientWidth) / 2;
}

export function useLauncherCarousel(options: UseLauncherCarouselOptions = {}) {
  const blockedByModal = Boolean(options.blocked);
  const activeScene = useActivityUiStore((state) => state.activeScene);
  const activeSection = useActivityUiStore((state) => state.activeSection);
  const setActiveSection = useActivityUiStore((state) => state.setActiveSection);
  const isNavExpanded = useActivityUiStore((state) => state.isNavExpanded);
  const setIsNavExpanded = useActivityUiStore((state) => state.setIsNavExpanded);

  const launcherShellRef = useRef<HTMLDivElement | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const navIdleTimerRef = useRef<number | null>(null);
  const wheelEndTimerRef = useRef<number | null>(null);
  const wheelLerpFrameRef = useRef<number | null>(null);
  const wheelTargetLeftRef = useRef<number | null>(null);
  const wheelPagingZoneRef = useRef<LauncherPagingZone>("unknown");
  const idleSettleTimerRef = useRef<number | null>(null);
  const settleFrameRef = useRef<number | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const prefersReducedMotionRef = useRef(
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const anchorsRef = useRef<LauncherAnchor[]>([]);
  const activeSectionRef = useRef<ActivitySection>(activeSection);
  const interactionRef = useRef<InteractionSnapshot>(DEFAULT_INTERACTION);
  const [carouselReadyVersion, setCarouselReadyVersion] = useState(0);
  const motionPhaseRef = useRef<LauncherMotionPhase>(
    activeScene === "launcher" && !blockedByModal ? "idle" : "blocked"
  );
  const motionTargetSectionRef = useRef<ActivitySection | null>(null);
  const lastPublishedSectionRef = useRef<ActivitySection>(activeSection);
  const [motionState, setMotionState] = useState<LauncherMotionState>(() => ({
    phase: activeScene === "launcher" && !blockedByModal ? "idle" : "blocked",
    targetSection: activeSection,
    progress: 0,
    releaseVelocity: 0,
    pagingZone: "unknown",
    scrollLeft: 0,
    sectionFocus: Object.fromEntries(
      SECTIONS.map((section) => [section, section === activeSection ? 1 : 0])
    ) as Record<ActivitySection, number>,
  }));

  const isBlocked = activeScene !== "launcher" || blockedByModal;
  const isCarouselSettled = motionState.phase === "idle" || motionState.phase === "blocked";
  const isCarouselInteracting =
    motionState.phase === "wheelActive" || motionState.phase === "dragActive";

  const clearNavDockTimer = useEffectEvent(() => {
    if (navIdleTimerRef.current !== null) {
      window.clearTimeout(navIdleTimerRef.current);
      navIdleTimerRef.current = null;
    }
  });

  const clearWheelEndTimer = useEffectEvent(() => {
    if (wheelEndTimerRef.current !== null) {
      window.clearTimeout(wheelEndTimerRef.current);
      wheelEndTimerRef.current = null;
    }
  });

  const clearIdleSettleTimer = useEffectEvent(() => {
    if (idleSettleTimerRef.current !== null) {
      window.clearTimeout(idleSettleTimerRef.current);
      idleSettleTimerRef.current = null;
    }
  });

  const cancelSettleAnimation = useEffectEvent(() => {
    if (settleFrameRef.current !== null) {
      window.cancelAnimationFrame(settleFrameRef.current);
      settleFrameRef.current = null;
    }
  });

  const clearWheelLerpAnimation = useEffectEvent(() => {
    if (wheelLerpFrameRef.current !== null) {
      window.cancelAnimationFrame(wheelLerpFrameRef.current);
      wheelLerpFrameRef.current = null;
    }
    wheelTargetLeftRef.current = null;
    wheelPagingZoneRef.current = "unknown";
  });

  const openNavDock = useEffectEvent(() => {
    clearNavDockTimer();
    setIsNavExpanded(true);
  });

  const collapseNavDock = useEffectEvent(() => {
    clearNavDockTimer();
    setIsNavExpanded(false);
  });

  const scheduleNavDockCollapse = useEffectEvent((delay = NAV_DOCK_IDLE_MS) => {
    clearNavDockTimer();

    const tryCollapse = () => {
      if (
        motionPhaseRef.current === "wheelActive" ||
        motionPhaseRef.current === "dragActive" ||
        motionPhaseRef.current === "settling"
      ) {
        navIdleTimerRef.current = window.setTimeout(tryCollapse, 120);
        return;
      }

      setIsNavExpanded(false);
      navIdleTimerRef.current = null;
    };

    navIdleTimerRef.current = window.setTimeout(tryCollapse, delay);
  });

  const publishMotionState = useEffectEvent(
    (partial: Partial<LauncherMotionState>, leftOverride?: number) => {
      const carousel = carouselRef.current;
      const scrollLeft = leftOverride ?? carousel?.scrollLeft ?? 0;
      const phase = partial.phase ?? motionPhaseRef.current;
      const targetSection = partial.targetSection ?? motionTargetSectionRef.current;
      const nextActiveSection = partial.targetSection ?? activeSectionRef.current;
      const sectionFocus = createSectionFocus(
        nextActiveSection,
        scrollLeft,
        anchorsRef.current,
        carousel?.clientWidth ?? window.innerWidth
      );

      motionPhaseRef.current = phase;
      motionTargetSectionRef.current = targetSection;

      setMotionState((previous) => ({
        phase,
        targetSection,
        progress: partial.progress ?? previous.progress,
        releaseVelocity: partial.releaseVelocity ?? previous.releaseVelocity,
        pagingZone: partial.pagingZone ?? previous.pagingZone,
        scrollLeft,
        sectionFocus,
      }));
    }
  );

  const measureAnchors = useEffectEvent(() => {
    const carousel = carouselRef.current;
    if (!carousel) {
      anchorsRef.current = [];
      return [];
    }

    const maxScrollLeft = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
    const anchors = SECTIONS.flatMap((section, index) => {
      const element = resolveSectionElement(section);
      if (!element) {
        return [];
      }

      const centeredLeft = getSectionCenteredLeft(carousel, element);

      return [
        {
          section,
          index,
          left: clamp(centeredLeft, 0, maxScrollLeft),
        },
      ];
    });

    anchorsRef.current = anchors;
    publishMotionState({}, carousel.scrollLeft);
    return anchors;
  });

  const resolveAnchorsOrFallback = useEffectEvent(() => {
    if (anchorsRef.current.length > 0) {
      return anchorsRef.current;
    }

    const measured = measureAnchors();
    if (measured.length > 0) {
      return measured;
    }

    const carousel = carouselRef.current;
    if (!carousel) {
      return [];
    }

    const maxScrollLeft = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
    const fallbackAnchors = SECTIONS.flatMap((section, index) => {
      const element = resolveSectionElement(section);
      if (!element) {
        return [];
      }

      const centeredLeft = getSectionCenteredLeft(carousel, element);

      return [
        {
          section,
          index,
          left: clamp(centeredLeft, 0, maxScrollLeft),
        },
      ];
    });

    anchorsRef.current = fallbackAnchors;
    return fallbackAnchors;
  });

  const syncActiveSectionToScroll = useEffectEvent((scrollLeft: number) => {
    const anchors = resolveAnchorsOrFallback();
    if (!anchors.length) {
      return;
    }

    const nearestAnchor = anchors[getNearestAnchorIndex(anchors, scrollLeft)];
    if (nearestAnchor && nearestAnchor.section !== activeSectionRef.current) {
      setActiveSection(nearestAnchor.section);
    }
  });

  const resolveAnchorBySection = useEffectEvent((section: ActivitySection) => {
    const anchors = resolveAnchorsOrFallback();
    return anchors.find((anchor) => anchor.section === section) || null;
  });

  const resolveSectionElement = useEffectEvent((section: ActivitySection) => {
    const fromRef = sectionRefs.current[section];
    if (fromRef) {
      return fromRef;
    }

    const carousel = carouselRef.current;
    if (!carousel) {
      return null;
    }

    const sectionIndex = SECTIONS.indexOf(section);
    if (sectionIndex < 0) {
      return null;
    }

    const cards = carousel.querySelectorAll<HTMLElement>(".section-card");
    const fromDom = cards.item(sectionIndex) || null;
    if (fromDom) {
      sectionRefs.current[section] = fromDom;
    }

    return fromDom;
  });

  const resolveSectionCenterLeft = useEffectEvent((section: ActivitySection) => {
    const carousel = carouselRef.current;
    const element = resolveSectionElement(section);
    if (!carousel || !element) {
      return null;
    }

    const maxScrollLeft = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
    const centeredLeft = getSectionCenteredLeft(carousel, element);
    return clamp(centeredLeft, 0, maxScrollLeft);
  });

  const canConsumeVerticalScroll = useEffectEvent((target: EventTarget | null, deltaY: number) => {
    if (!(target instanceof Element) || deltaY === 0) {
      return false;
    }

    const activeCard = sectionRefs.current[activeSectionRef.current];
    if (!activeCard || !activeCard.contains(target)) {
      return false;
    }

    let current: Element | null = target;
    const direction = Math.sign(deltaY);

    while (current && current instanceof HTMLElement) {
      const style = window.getComputedStyle(current);
      const allowsVerticalScroll = /(auto|scroll|overlay)/.test(style.overflowY);
      const hasScrollableRange = current.scrollHeight > current.clientHeight + 1;

      if (allowsVerticalScroll && hasScrollableRange) {
        const canScrollUp = current.scrollTop > 0;
        const canScrollDown =
          current.scrollTop + current.clientHeight < current.scrollHeight - 1;

        if ((direction < 0 && canScrollUp) || (direction > 0 && canScrollDown)) {
          return true;
        }
      }

      if (current === activeCard) {
        break;
      }

      current = current.parentElement;
    }

    return false;
  });

  const applyScrollLeft = useEffectEvent((nextLeft: number, pagingZone?: LauncherPagingZone) => {
    const carousel = carouselRef.current;
    if (!carousel) {
      return 0;
    }

    const maxScrollLeft = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
    const appliedLeft = applyEdgeResistance(nextLeft, 0, maxScrollLeft);

    carousel.scrollLeft = appliedLeft;
    syncActiveSectionToScroll(appliedLeft);
    const anchors = resolveAnchorsOrFallback();
    const interaction = interactionRef.current;
    const baseAnchor = anchors[interaction.baseIndex];
    if (!baseAnchor) {
      publishMotionState(
        {
          pagingZone,
          progress: 0,
        },
        appliedLeft
      );
      return appliedLeft;
    }
    const direction =
      appliedLeft === interaction.lastLeft ? 0 : appliedLeft > baseAnchor.left ? 1 : -1;
    const adjacentAnchor =
      direction === 0
        ? baseAnchor
        : anchors[clamp(interaction.baseIndex + direction, 0, anchors.length - 1)];
    const progress =
      baseAnchor && adjacentAnchor
        ? resolveProgressBetween(appliedLeft, baseAnchor.left, adjacentAnchor.left)
        : 0;

    publishMotionState(
      {
        pagingZone,
        progress,
      },
      appliedLeft
    );

    return appliedLeft;
  });

  const beginInteraction = useEffectEvent(
    (phase: Extract<LauncherMotionPhase, "wheelActive" | "dragActive">, zone: LauncherPagingZone) => {
      const carousel = carouselRef.current;
      const anchors = resolveAnchorsOrFallback();
      if (!carousel || !anchors.length) {
        return false;
      }

      if (phase === "dragActive") {
        clearWheelLerpAnimation();
      }

      cancelSettleAnimation();
      clearWheelEndTimer();
      clearIdleSettleTimer();
      openNavDock();

      const baseIndex = getNearestAnchorIndex(anchors, carousel.scrollLeft);
      interactionRef.current = {
        ...interactionRef.current,
        phase,
        baseIndex,
        pagingZone: zone,
        lastLeft: carousel.scrollLeft,
        lastAt: performance.now(),
        releaseVelocity: 0,
        hasDragged: false,
      };
      publishMotionState({
        phase,
        pagingZone: zone,
        targetSection: anchors[baseIndex]?.section || null,
        progress: 0,
      });

      return true;
    }
  );

  const updateInteractionVelocity = useEffectEvent((nextLeft: number) => {
    const interaction = interactionRef.current;
    const now = performance.now();
    const elapsed = Math.max(1, now - interaction.lastAt);
    const sampleVelocity = (nextLeft - interaction.lastLeft) / elapsed;
    const releaseVelocity = interaction.releaseVelocity * 0.4 + sampleVelocity * 0.6;

    interaction.lastAt = now;
    interaction.lastLeft = nextLeft;
    interaction.releaseVelocity = releaseVelocity;

    publishMotionState(
      {
        releaseVelocity,
      },
      nextLeft
    );

    return releaseVelocity;
  });

  const animateWheelTowardsTarget = useEffectEvent(() => {
    if (wheelLerpFrameRef.current !== null) {
      return;
    }

    const tick = () => {
      const carousel = carouselRef.current;
      const targetLeft = wheelTargetLeftRef.current;
      if (!carousel || targetLeft === null) {
        wheelLerpFrameRef.current = null;
        return;
      }

      const currentLeft = carousel.scrollLeft;
      const distance = targetLeft - currentLeft;
      if (Math.abs(distance) <= 0.45) {
        const settledLeft = applyScrollLeft(targetLeft, wheelPagingZoneRef.current);
        updateInteractionVelocity(settledLeft);
        wheelLerpFrameRef.current = null;
        return;
      }

      const interpolatedStep = distance * LAUNCHER_WHEEL_LERP_ALPHA;
      const signedMinStep = Math.sign(distance) * LAUNCHER_WHEEL_LERP_MIN_STEP;
      const nextLeft =
        currentLeft +
        (Math.abs(interpolatedStep) < LAUNCHER_WHEEL_LERP_MIN_STEP
          ? signedMinStep
          : interpolatedStep);
      const appliedLeft = applyScrollLeft(nextLeft, wheelPagingZoneRef.current);
      updateInteractionVelocity(appliedLeft);

      wheelLerpFrameRef.current = window.requestAnimationFrame(tick);
    };

    wheelLerpFrameRef.current = window.requestAnimationFrame(tick);
  });

  const queueWheelDelta = useEffectEvent((delta: number, pagingZone: LauncherPagingZone) => {
    const carousel = carouselRef.current;
    if (!carousel || !Number.isFinite(delta) || delta === 0) {
      return;
    }

    const maxScrollLeft = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
    const baseTarget = wheelTargetLeftRef.current ?? carousel.scrollLeft;
    wheelPagingZoneRef.current = pagingZone;
    wheelTargetLeftRef.current = clamp(baseTarget + delta, 0, maxScrollLeft);
    animateWheelTowardsTarget();
  });

  const completeSettle = useEffectEvent((section: ActivitySection, left: number) => {
    const carousel = carouselRef.current;
    if (carousel) {
      carousel.scrollLeft = left;
    }

    setActiveSection(section);
    activeSectionRef.current = section;
    interactionRef.current = {
      ...DEFAULT_INTERACTION,
      baseIndex: Math.max(0, SECTIONS.indexOf(section)),
    };
    publishMotionState(
      {
        phase: isBlocked ? "blocked" : "idle",
        targetSection: section,
        pagingZone: "unknown",
        progress: 0,
        releaseVelocity: 0,
      },
      left
    );
    scheduleNavDockCollapse(1100);
  });

  const settleToAnchor = useEffectEvent(
    (
      targetSection: ActivitySection,
      reason: "nav" | "scroll" | "interaction",
      preferredLeft: number | null = null
    ) => {
      const carousel = carouselRef.current;
      let targetLeft = preferredLeft;
      if (targetLeft === null) {
        let anchor = resolveAnchorBySection(targetSection);
        if (!anchor) {
          measureAnchors();
          anchor = resolveAnchorBySection(targetSection);
        }
        targetLeft = anchor?.left ?? resolveSectionCenterLeft(targetSection);
      }

      if (!carousel || targetLeft === null) {
        return;
      }

      clearWheelLerpAnimation();
      cancelSettleAnimation();
      clearWheelEndTimer();
      clearIdleSettleTimer();

      const startLeft = carousel.scrollLeft;
      const distance = Math.abs(targetLeft - startLeft);

      publishMotionState({
        phase: isBlocked ? "blocked" : "settling",
        targetSection,
        progress: 1,
      });

      if (distance <= 0.5 || prefersReducedMotionRef.current) {
        completeSettle(targetSection, targetLeft);
        return;
      }

      const duration = clamp(
        LAUNCHER_SETTLE_BASE_MS + distance * LAUNCHER_SETTLE_DISTANCE_FACTOR,
        LAUNCHER_SETTLE_BASE_MS,
        LAUNCHER_SETTLE_MAX_MS
      );
      const startedAt = performance.now();

      const tick = (now: number) => {
        const progress = clamp((now - startedAt) / duration, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const nextLeft = startLeft + (targetLeft - startLeft) * eased;
        carousel.scrollLeft = nextLeft;
        syncActiveSectionToScroll(nextLeft);
        publishMotionState(
          {
            phase: isBlocked ? "blocked" : "settling",
            targetSection,
            progress,
            pagingZone: reason === "nav" ? "interactive" : interactionRef.current.pagingZone,
          },
          nextLeft
        );

        if (progress >= 1) {
          settleFrameRef.current = null;
          completeSettle(targetSection, targetLeft);
          return;
        }

        settleFrameRef.current = window.requestAnimationFrame(tick);
      };

      settleFrameRef.current = window.requestAnimationFrame(tick);
    }
  );

  const finishInteraction = useEffectEvent(() => {
    const carousel = carouselRef.current;
    const anchors = resolveAnchorsOrFallback();
    const interaction = interactionRef.current;
    if (!carousel || !anchors.length) {
      publishMotionState({ phase: isBlocked ? "blocked" : "idle" });
      return;
    }

    clearWheelLerpAnimation();

    const decisionResult = resolveSnapDecision({
      anchors,
      baseIndex: interaction.baseIndex,
      scrollLeft: carousel.scrollLeft,
      velocityPxPerMs: interaction.releaseVelocity,
    });

    if (!decisionResult) {
      return;
    }

    publishMotionState({
      releaseVelocity: interaction.releaseVelocity,
      progress: decisionResult.decision.progress,
      targetSection: decisionResult.target.section,
    });

    settleToAnchor(decisionResult.target.section, "interaction");
  });

  const scheduleWheelFinish = useEffectEvent((delay = LAUNCHER_WHEEL_END_MS) => {
    clearWheelEndTimer();
    wheelEndTimerRef.current = window.setTimeout(() => {
      if (wheelLerpFrameRef.current !== null) {
        wheelEndTimerRef.current = window.setTimeout(() => {
          wheelEndTimerRef.current = null;
          finishInteraction();
        }, 32);
        return;
      }

      wheelEndTimerRef.current = null;
      finishInteraction();
    }, delay);
  });

  const scheduleIdleSettle = useEffectEvent(() => {
    clearIdleSettleTimer();
    idleSettleTimerRef.current = window.setTimeout(() => {
      idleSettleTimerRef.current = null;
      const carousel = carouselRef.current;
      const anchors = resolveAnchorsOrFallback();
      if (!carousel || !anchors.length || motionPhaseRef.current !== "idle") {
        return;
      }

      const nearest = anchors[getNearestAnchorIndex(anchors, carousel.scrollLeft)];
      if (nearest) {
        settleToAnchor(nearest.section, "scroll");
      }
    }, LAUNCHER_IDLE_SCROLL_SETTLE_MS);
  });

  const jumpToSection = (section: ActivitySection) => {
    if (isBlocked) {
      return;
    }

    clearWheelLerpAnimation();
    openNavDock();
    publishMotionState({
      pagingZone: "interactive",
      releaseVelocity: 0,
    });

    measureAnchors();
    const sectionLeft = resolveSectionCenterLeft(section);
    if (sectionLeft !== null) {
      settleToAnchor(section, "nav", sectionLeft);
      return;
    }

    settleToAnchor(section, "nav");
  };

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  useEffect(() => {
    if (activeScene !== "launcher") {
      return;
    }

    let frameId: number | null = null;
    let cancelled = false;

    const waitForCarouselNode = () => {
      if (cancelled) {
        return;
      }

      if (carouselRef.current) {
        setCarouselReadyVersion((previous) => previous + 1);
        return;
      }

      frameId = window.requestAnimationFrame(waitForCarouselNode);
    };

    waitForCarouselNode();

    return () => {
      cancelled = true;
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [activeScene]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event: MediaQueryListEvent) => {
      prefersReducedMotionRef.current = event.matches;
    };

    prefersReducedMotionRef.current = mediaQuery.matches;
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (isBlocked) {
        publishMotionState({ phase: "blocked", pagingZone: resolvePagingZone(event.target) });
        return;
      }

      if ((event.target as Element | null)?.closest(".section-nav")) {
        return;
      }

      const pagingZone = resolvePagingZone(event.target);
      const normalizedDeltaX = normalizeWheelDelta(event.deltaX, event.deltaMode);
      const normalizedDeltaY = normalizeWheelDelta(event.deltaY, event.deltaMode);
      const horizontalDelta = event.shiftKey
        ? Math.abs(normalizedDeltaX) >= Math.abs(normalizedDeltaY)
          ? normalizedDeltaX
          : normalizedDeltaY
        : normalizedDeltaX;
      const isHorizontalGesture =
        Math.abs(horizontalDelta) > Math.abs(normalizedDeltaY) * 0.6 &&
        Math.abs(horizontalDelta) > 0.5;

      if (
        pagingZone === "blocked" ||
        (pagingZone === "interactive" && !event.shiftKey)
      ) {
        publishMotionState({ pagingZone });
        return;
      }

      if (isHorizontalGesture) {
        event.preventDefault();
        const shiftBoost = event.shiftKey ? 2.2 : 1;
        const delta = horizontalDelta * shiftBoost;
        if (!beginInteraction("wheelActive", pagingZone)) {
          queueWheelDelta(delta, pagingZone);
          scheduleWheelFinish(event.shiftKey ? LAUNCHER_WHEEL_END_MS + 220 : LAUNCHER_WHEEL_END_MS);
          return;
        }
        queueWheelDelta(delta, pagingZone);
        scheduleWheelFinish(event.shiftKey ? LAUNCHER_WHEEL_END_MS + 220 : LAUNCHER_WHEEL_END_MS);
        return;
      }

      if (Math.abs(normalizedDeltaY) < 0.5) {
        publishMotionState({ pagingZone });
        return;
      }

      if (canConsumeVerticalScroll(event.target, normalizedDeltaY)) {
        publishMotionState({ pagingZone: "content" });
        return;
      }

      if (!beginInteraction("wheelActive", pagingZone)) {
        event.preventDefault();
        queueWheelDelta(normalizedDeltaY, pagingZone);
        scheduleWheelFinish();
        return;
      }
      event.preventDefault();
      queueWheelDelta(normalizedDeltaY, pagingZone);
      scheduleWheelFinish();
    };

    let scrollFrameId: number | null = null;
    const handleScroll = () => {
      if (scrollFrameId !== null) {
        window.cancelAnimationFrame(scrollFrameId);
      }

      scrollFrameId = window.requestAnimationFrame(() => {
        scrollFrameId = null;
        const scrollLeft = carousel.scrollLeft;
        syncActiveSectionToScroll(scrollLeft);
        publishMotionState({}, scrollLeft);

        if (motionPhaseRef.current === "idle") {
          scheduleIdleSettle();
        }
      });
    };

    carousel.addEventListener("wheel", handleWheel, { passive: false });
    carousel.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (scrollFrameId !== null) {
        window.cancelAnimationFrame(scrollFrameId);
      }
      carousel.removeEventListener("wheel", handleWheel);
      carousel.removeEventListener("scroll", handleScroll);
    };
  }, [
    beginInteraction,
    carouselReadyVersion,
    isBlocked,
    publishMotionState,
    queueWheelDelta,
    scheduleIdleSettle,
    scheduleWheelFinish,
    syncActiveSectionToScroll,
  ]);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (isBlocked || event.button !== 0) {
        return;
      }

      const pagingZone = resolvePagingZone(event.target);
      if (pagingZone === "blocked" || pagingZone === "interactive") {
        publishMotionState({ pagingZone });
        return;
      }

      if (!beginInteraction("dragActive", pagingZone)) {
        return;
      }

      interactionRef.current.pointerId = event.pointerId;
      interactionRef.current.pointerStartX = event.clientX;
      interactionRef.current.pointerStartY = event.clientY;
      interactionRef.current.pointerScrollLeft = carousel.scrollLeft;
      interactionRef.current.hasDragged = false;
      carousel.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (
        isBlocked ||
        interaction.pointerId === null ||
        interaction.pointerId !== event.pointerId ||
        motionPhaseRef.current !== "dragActive"
      ) {
        return;
      }

      const deltaX = event.clientX - interaction.pointerStartX;
      const deltaY = event.clientY - interaction.pointerStartY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (!interaction.hasDragged) {
        if (absX < LAUNCHER_POINTER_DRAG_THRESHOLD_PX || absX <= absY) {
          return;
        }
        interaction.hasDragged = true;
      }

      event.preventDefault();
      const nextLeft =
        interaction.pointerScrollLeft - deltaX * LAUNCHER_DRAG_RESISTANCE;
      const appliedLeft = applyScrollLeft(nextLeft, interaction.pagingZone);
      updateInteractionVelocity(appliedLeft);
      carousel.classList.add("is-dragging");
    };

    const handlePointerUp = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (interaction.pointerId === null || interaction.pointerId !== event.pointerId) {
        return;
      }

      if (carousel.hasPointerCapture(event.pointerId)) {
        carousel.releasePointerCapture(event.pointerId);
      }
      carousel.classList.remove("is-dragging");

      const shouldFinish = interaction.hasDragged;
      interaction.pointerId = null;
      interaction.hasDragged = false;

      if (shouldFinish) {
        finishInteraction();
      } else {
        publishMotionState({
          phase: isBlocked ? "blocked" : "idle",
          pagingZone: interaction.pagingZone,
          progress: 0,
          releaseVelocity: 0,
        });
      }
    };

    const handlePointerCancel = (event: PointerEvent) => {
      handlePointerUp(event);
    };

    carousel.addEventListener("pointerdown", handlePointerDown);
    carousel.addEventListener("pointermove", handlePointerMove);
    carousel.addEventListener("pointerup", handlePointerUp);
    carousel.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      carousel.classList.remove("is-dragging");
      carousel.removeEventListener("pointerdown", handlePointerDown);
      carousel.removeEventListener("pointermove", handlePointerMove);
      carousel.removeEventListener("pointerup", handlePointerUp);
      carousel.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [
    applyScrollLeft,
    beginInteraction,
    carouselReadyVersion,
    finishInteraction,
    isBlocked,
    publishMotionState,
    updateInteractionVelocity,
  ]);

  useEffect(() => {
    if (activeScene !== "launcher") {
      clearWheelLerpAnimation();
      cancelSettleAnimation();
      clearWheelEndTimer();
      clearIdleSettleTimer();
      clearNavDockTimer();
      publishMotionState({
        phase: "blocked",
        targetSection: activeSectionRef.current,
        progress: 0,
        releaseVelocity: 0,
      });
      collapseNavDock();
      return;
    }

    resizeFrameRef.current = window.requestAnimationFrame(() => {
      const anchors = measureAnchors();
      const activeAnchor =
        anchors.find((anchor) => anchor.section === activeSectionRef.current) || anchors[0];
      if (activeAnchor) {
        completeSettle(activeAnchor.section, activeAnchor.left);
        return;
      }

      const fallbackLeft = resolveSectionCenterLeft(activeSectionRef.current);
      if (fallbackLeft !== null) {
        completeSettle(activeSectionRef.current, fallbackLeft);
      }
    });

    const handleResize = () => {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }

      resizeFrameRef.current = window.requestAnimationFrame(() => {
        const anchors = measureAnchors();
        const targetSection = motionTargetSectionRef.current || activeSectionRef.current;
        const targetAnchor =
          anchors.find((anchor) => anchor.section === targetSection) || anchors[0];
        if (!targetAnchor) {
          const fallbackLeft = resolveSectionCenterLeft(targetSection);
          if (fallbackLeft !== null) {
            completeSettle(targetSection, fallbackLeft);
          }
          return;
        }

        if (motionPhaseRef.current === "settling") {
          settleToAnchor(targetAnchor.section, "scroll");
        } else {
          completeSettle(targetAnchor.section, targetAnchor.left);
        }
      });
    };

    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            handleResize();
          })
        : null;

    if (resizeObserver) {
      if (carouselRef.current) {
        resizeObserver.observe(carouselRef.current);
      }

      SECTIONS.forEach((section) => {
        const node = sectionRefs.current[section];
        if (node) {
          resizeObserver.observe(node);
        }
      });
    }

    return () => {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
    };
  }, [
    activeScene,
    clearWheelLerpAnimation,
    cancelSettleAnimation,
    clearIdleSettleTimer,
    clearNavDockTimer,
    clearWheelEndTimer,
    collapseNavDock,
    completeSettle,
    carouselReadyVersion,
    measureAnchors,
    publishMotionState,
    settleToAnchor,
  ]);

  useEffect(() => {
    if (activeScene !== "launcher" || !blockedByModal) {
      if (!blockedByModal && motionPhaseRef.current === "blocked") {
        publishMotionState({
          phase: "idle",
          targetSection: activeSectionRef.current,
          progress: 0,
        });
      }
      return;
    }

    clearWheelLerpAnimation();
    cancelSettleAnimation();
    clearWheelEndTimer();
    clearIdleSettleTimer();
    publishMotionState({
      phase: "blocked",
      targetSection: activeSectionRef.current,
      progress: 0,
    });
  }, [
    activeScene,
    blockedByModal,
    clearWheelLerpAnimation,
    cancelSettleAnimation,
    clearIdleSettleTimer,
    clearWheelEndTimer,
    publishMotionState,
  ]);

  useEffect(() => {
    if (activeScene !== "launcher") {
      lastPublishedSectionRef.current = activeSection;
      return;
    }

    if (lastPublishedSectionRef.current === activeSection) {
      return;
    }

    lastPublishedSectionRef.current = activeSection;
    openNavDock();
    scheduleNavDockCollapse(1150);
  }, [activeScene, activeSection, openNavDock, scheduleNavDockCollapse]);

  useEffect(() => {
    return () => {
      clearWheelLerpAnimation();
      cancelSettleAnimation();
      clearIdleSettleTimer();
      clearNavDockTimer();
      clearWheelEndTimer();
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }
    };
  }, [
    clearWheelLerpAnimation,
    cancelSettleAnimation,
    clearIdleSettleTimer,
    clearNavDockTimer,
    clearWheelEndTimer,
  ]);

  return {
    activeSection,
    carouselRef,
    collapseNavDock,
    isCarouselInteracting,
    isCarouselSettled,
    isNavExpanded,
    jumpToSection,
    launcherShellRef,
    motionState,
    navRef,
    openNavDock,
    scheduleNavDockCollapse,
    sectionRefs,
  };
}
