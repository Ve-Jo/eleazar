import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";
import { DiscordSDK } from "@discord/embedded-app-sdk";
import BalanceSectionView from "../../../shared/src/ui/BalanceSectionView.jsx";
import CasesSectionView from "../../../shared/src/ui/CasesSectionView.jsx";
import GamesSectionView from "../../../shared/src/ui/GamesSectionView.jsx";
import UpgradesSectionView from "../../../shared/src/ui/UpgradesSectionView.jsx";

import type {
  ActivityLauncherPayload,
  ActivityMutationEnvelope,
} from "../../../shared/src/contracts/hub.ts";
import Game2048Scene from "./components/Game2048Scene.tsx";
import MoneyModal from "./components/MoneyModal.tsx";
import {
  type ActivitySection,
  CAROUSEL_FLOAT_FRICTION,
  CAROUSEL_FLOAT_MIN_VELOCITY,
  CAROUSEL_SETTLE_DELAY_MS,
  CAROUSEL_WHEEL_FLOAT_SENSITIVITY,
  CAROUSEL_WHEEL_LINE_HEIGHT_PX,
  CAROUSEL_WHEEL_MAX_VELOCITY_RATIO,
  LAUNCHER_DATA_TIMEOUT_MS,
  NAV_DOCK_IDLE_MS,
  SECTIONS,
  TUNNEL_BYPASS_HEADER,
} from "./lib/activityConstants.ts";
import {
  parsePositiveAmount,
  projectBankSnapshot,
  type MoneyMoveDirection,
  type MoneyMoveMode,
} from "./lib/activityMath.ts";
import {
  addRandomTile,
  applyMove,
  createInitialBoard,
  hasMovesAvailable,
  type Direction,
} from "./lib/game2048.ts";
import {
  buildCasesCalendarPresentation,
  createPaletteStyle,
  formatCooldownClock,
  formatNumber,
  getCrateByType,
  getDailyProgress,
  getGameById,
  getGuildIdFromUrl,
  getLocaleTag,
  getRewardEntries,
  getStatusDailyRemaining,
  getUpgradeByType,
} from "./lib/activityView.ts";
import type {
  AuthState,
  CompletionResponse,
  CrateRevealState,
  GameState,
  MoneyModalState,
  NoticeState,
  SetupDiagnostics,
  SetupState,
  ViewportState,
  ViewportTier,
} from "./types/activityUi.ts";

type DiscordAuthorizeInput = Parameters<DiscordSDK["commands"]["authorize"]>[0];

export function App() {
  const [setup, setSetup] = useState<SetupState>({
    loading: true,
    error: null,
    auth: null,
    sdkReady: false,
    diagnostics: null,
  });
  const [diagnostics, setDiagnostics] = useState<SetupDiagnostics>({
    origin: window.location.origin,
    href: window.location.href,
    guildId: getGuildIdFromUrl(),
    channelId: "",
    currentStep: "boot",
  });
  const [launcherData, setLauncherData] = useState<ActivityLauncherPayload | null>(null);
  const [activeSection, setActiveSection] = useState<ActivitySection>("balance");
  const [activeScene, setActiveScene] = useState<"launcher" | "2048">("launcher");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [moneyModal, setMoneyModal] = useState<MoneyModalState>({
    open: false,
    direction: "deposit",
    input: "",
    selectedPreset: null,
    submitting: false,
    error: null,
  });
  const [notice, setNotice] = useState<NoticeState>(null);
  const [crateReveal, setCrateReveal] = useState<CrateRevealState>(null);
  const [pendingCrateType, setPendingCrateType] = useState<string | null>(null);
  const [pendingUpgradeType, setPendingUpgradeType] = useState<string | null>(null);
  const [focusedCrateType, setFocusedCrateType] = useState<string>("daily");
  const [focusedUpgradeType, setFocusedUpgradeType] = useState<string>("");
  const [focusedGameId, setFocusedGameId] = useState<string>("2048");
  const [now, setNow] = useState(Date.now());
  const [isNavExpanded, setIsNavExpanded] = useState(false);
  const [viewport, setViewport] = useState<ViewportState>({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const sdkRef = useRef<DiscordSDK | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const navIdleTimerRef = useRef<number | null>(null);
  const carouselSettleTimerRef = useRef<number | null>(null);
  const carouselMotionRafRef = useRef<number | null>(null);
  const carouselVelocityRef = useRef(0);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const updateDiagnostics = (patch: Partial<SetupDiagnostics>) => {
    setDiagnostics((previous) => ({
      ...previous,
      origin: window.location.origin,
      href: window.location.href,
      ...patch,
    }));
  };

  const viewportTier: ViewportTier =
    viewport.width < 820 || viewport.height < 560
      ? "micro"
      : viewport.width < 1040 || viewport.height < 640
      ? "dense"
      : viewport.width < 1280 || viewport.height < 740
      ? "compact"
      : "regular";
  const isCompactViewport = viewportTier !== "regular";
  const isDenseViewport = viewportTier === "dense" || viewportTier === "micro";
  const isMicroViewport = viewportTier === "micro";
  const shouldCompactBalance = viewportTier === "dense" || viewportTier === "micro";
  const shouldCompactPanels = viewportTier !== "regular";

  const fetchLauncherData = async (auth: AuthState | null) => {
    const guildId = auth?.guildId || getGuildIdFromUrl();
    const params = new URLSearchParams();
    if (guildId) {
      params.set("guildId", guildId);
    }

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => abortController.abort(), LAUNCHER_DATA_TIMEOUT_MS);

    try {
      const response = await fetch(`/api/launcher-data?${params.toString()}`, {
        headers: {
          [TUNNEL_BYPASS_HEADER]: "1",
          ...(auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
          ...(auth?.userId ? { "x-user-id": auth.userId } : {}),
          ...(guildId ? { "x-guild-id": guildId } : {}),
        },
        signal: abortController.signal,
      });

      const payload = (await response.json()) as ActivityLauncherPayload & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load launcher data");
      }

      startTransition(() => {
        setLauncherData(payload);
      });
      return payload;
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const clearNavDockTimer = useEffectEvent(() => {
    if (navIdleTimerRef.current !== null) {
      window.clearTimeout(navIdleTimerRef.current);
      navIdleTimerRef.current = null;
    }
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
    navIdleTimerRef.current = window.setTimeout(() => {
      setIsNavExpanded(false);
      navIdleTimerRef.current = null;
    }, delay);
  });

  const setupSdk = async () => {
    updateDiagnostics({
      currentStep: "config",
      lastError: "",
      guildId: getGuildIdFromUrl(),
    });

    const configResponse = await fetch("/api/config", {
      headers: {
        [TUNNEL_BYPASS_HEADER]: "1",
      },
    });
    const configPayload = (await configResponse.json().catch(() => ({}))) as {
      clientId?: string;
    };

    const configuredClientId =
      configPayload.clientId ||
      import.meta.env.VITE_ACTIVITY_CLIENT_ID ||
      import.meta.env.VITE_DISCORD_CLIENT_ID;

    if (!configuredClientId) {
      throw new Error("Missing Activity client id in /api/config or VITE env vars.");
    }

    const discordSdk = new DiscordSDK(configuredClientId);
    sdkRef.current = discordSdk;
    await discordSdk.ready();

    const nextDiagnostics = {
      clientId: configuredClientId,
      origin: window.location.origin,
      href: window.location.href,
      guildId: discordSdk.guildId || getGuildIdFromUrl(),
      channelId: discordSdk.channelId || "",
      errorStep: "authorize",
      currentStep: "sdk-ready",
    };

    setDiagnostics(nextDiagnostics);

    const authorizeParams: Omit<DiscordAuthorizeInput, "prompt"> = {
      client_id: configuredClientId,
      response_type: "code" as const,
      state: crypto.randomUUID(),
      scope: ["identify"],
    };

    const authorizeResult = await discordSdk.commands.authorize({
      ...authorizeParams,
    });
    const tokenResponse = await fetch("/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [TUNNEL_BYPASS_HEADER]: "1",
      },
      body: JSON.stringify({ code: authorizeResult.code }),
    });

    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
      error?: string;
      message?: string;
      error_description?: string;
    };
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      throw new Error(
        tokenPayload.message ||
          tokenPayload.error_description ||
          tokenPayload.error ||
          "Failed to exchange OAuth token."
      );
    }

    const auth = await discordSdk.commands.authenticate({
      access_token: tokenPayload.access_token,
    });

    if (!auth?.user?.id) {
      throw new Error("Discord authenticate command failed.");
    }

    return {
      accessToken: tokenPayload.access_token,
      userId: auth.user.id,
      guildId: discordSdk.guildId || getGuildIdFromUrl(),
      diagnostics: {
        ...nextDiagnostics,
        currentStep: "authenticated",
      },
    } as AuthState & { diagnostics: SetupDiagnostics };
  };

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const auth = await setupSdk();
        if (cancelled) {
          return;
        }

        const launcher = await fetchLauncherData(auth);
        if (cancelled) {
          return;
        }

        setSetup({
          loading: false,
          error: null,
          auth,
          sdkReady: true,
          diagnostics:
            (auth as AuthState & { diagnostics?: SetupDiagnostics }).diagnostics || null,
        });
        setLauncherData(launcher);
      } catch (error: any) {
        const nextDiagnostics = {
          clientId: sdkRef.current?.clientId || undefined,
          origin: window.location.origin,
          href: window.location.href,
          guildId: sdkRef.current?.guildId || getGuildIdFromUrl(),
          channelId: sdkRef.current?.channelId || "",
          errorStep: "authorize",
          currentStep: diagnostics.currentStep || "authorize",
          lastError: error?.message || "Discord SDK auth unavailable.",
        };

        setDiagnostics(nextDiagnostics);
        setSetup({
          loading: false,
          error:
            `${error?.message || "Discord SDK auth unavailable."} Trying local read-only preview...`,
          auth: null,
          sdkReady: false,
          diagnostics: nextDiagnostics,
        });

        try {
          const launcher = await fetchLauncherData(null);
          if (cancelled) {
            return;
          }
          setLauncherData(launcher);
        } catch (fallbackError: any) {
          if (cancelled) {
            return;
          }
          setSetup({
            loading: false,
            error:
              `${error?.message || "Discord SDK auth unavailable."} ${fallbackError?.message || "Also failed to load local preview."}`,
            auth: null,
            sdkReady: false,
            diagnostics: {
              ...nextDiagnostics,
              currentStep: "fallback-error",
              lastError:
                fallbackError?.message ||
                error?.message ||
                "Failed to initialize activity",
            },
          });
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => setNotice(null), 2800);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notice]);

  useEffect(() => {
    const availableGames = launcherData?.games.items || [];
    if (availableGames.length === 0) {
      return;
    }

    if (!availableGames.some((game) => game.id === focusedGameId)) {
      setFocusedGameId(availableGames[0]?.id || "2048");
    }
  }, [focusedGameId, launcherData]);

  useEffect(() => {
    const availableCrates = launcherData?.cases.cards || [];
    if (availableCrates.length === 0) {
      return;
    }

    if (!availableCrates.some((crate) => crate.type === focusedCrateType)) {
      const preferredCrate = availableCrates.find((crate) => crate.available) || availableCrates[0];
      setFocusedCrateType(preferredCrate?.type || "daily");
    }
  }, [focusedCrateType, launcherData]);

  useEffect(() => {
    const availableUpgrades =
      launcherData?.upgrades.groups.flatMap((group) => group.items) || [];
    if (availableUpgrades.length === 0) {
      return;
    }

    if (!availableUpgrades.some((upgrade) => upgrade.type === focusedUpgradeType)) {
      setFocusedUpgradeType(availableUpgrades[0]?.type || "");
    }
  }, [focusedUpgradeType, launcherData]);

  const clearCarouselSettleTimer = useEffectEvent(() => {
    if (carouselSettleTimerRef.current !== null) {
      window.clearTimeout(carouselSettleTimerRef.current);
      carouselSettleTimerRef.current = null;
    }
  });

  const clearCarouselMotionRaf = useEffectEvent(() => {
    if (carouselMotionRafRef.current !== null) {
      window.cancelAnimationFrame(carouselMotionRafRef.current);
      carouselMotionRafRef.current = null;
    }
    carouselVelocityRef.current = 0;
  });

  const resolveMostVisibleSection = useEffectEvent((): ActivitySection => {
    const carousel = carouselRef.current;
    if (!carousel) {
      return activeSection;
    }

    const viewportLeft = carousel.scrollLeft;
    const viewportRight = viewportLeft + carousel.clientWidth;
    let mostVisibleSection: ActivitySection = activeSection;
    let largestVisibleWidth = Number.NEGATIVE_INFINITY;

    for (const sectionKey of SECTIONS) {
      const element = sectionRefs.current[sectionKey];
      if (!element) {
        continue;
      }

      const cardLeft = element.offsetLeft;
      const cardRight = cardLeft + element.clientWidth;
      const visibleWidth =
        Math.max(0, Math.min(cardRight, viewportRight) - Math.max(cardLeft, viewportLeft));

      if (visibleWidth > largestVisibleWidth) {
        largestVisibleWidth = visibleWidth;
        mostVisibleSection = sectionKey;
      }
    }

    return mostVisibleSection;
  });

  const scrollToSection = useEffectEvent(
    (section: ActivitySection, behavior: ScrollBehavior = "smooth") => {
      const carousel = carouselRef.current;
      const target = sectionRefs.current[section];
      if (!carousel || !target) {
        return;
      }

      const centeredLeft = target.offsetLeft - (carousel.clientWidth - target.clientWidth) / 2;
      const maxScrollLeft = Math.max(0, carousel.scrollWidth - carousel.clientWidth);

      carousel.scrollTo({
        left: Math.max(0, Math.min(maxScrollLeft, centeredLeft)),
        behavior,
      });
    }
  );

  const updateActiveSectionFromScroll = useEffectEvent(() => {
    const mostVisibleSection = resolveMostVisibleSection();
    if (mostVisibleSection !== activeSection) {
      setActiveSection(mostVisibleSection);
    }
  });

  const settleCarouselSection = useEffectEvent(() => {
    const targetSection = resolveMostVisibleSection();
    setActiveSection(targetSection);
    scrollToSection(targetSection, "smooth");
  });

  const scheduleCarouselSettle = useEffectEvent((delay = CAROUSEL_SETTLE_DELAY_MS) => {
    clearCarouselSettleTimer();
    carouselSettleTimerRef.current = window.setTimeout(() => {
      settleCarouselSection();
      clearCarouselSettleTimer();
    }, delay);
  });

  const startCarouselMotion = useEffectEvent(() => {
    const carousel = carouselRef.current;
    if (!carousel || carouselMotionRafRef.current !== null) {
      return;
    }

    const step = () => {
      const nextVelocity = carouselVelocityRef.current * CAROUSEL_FLOAT_FRICTION;
      const maxVelocity = Math.max(
        CAROUSEL_WHEEL_LINE_HEIGHT_PX * 2,
        carousel.clientWidth * CAROUSEL_WHEEL_MAX_VELOCITY_RATIO
      );
      const clampedVelocity = Math.max(-maxVelocity, Math.min(maxVelocity, nextVelocity));
      carouselVelocityRef.current = clampedVelocity;

      if (Math.abs(clampedVelocity) < CAROUSEL_FLOAT_MIN_VELOCITY) {
        carouselVelocityRef.current = 0;
        carouselMotionRafRef.current = null;
        scheduleCarouselSettle();
        return;
      }

      carousel.scrollLeft += clampedVelocity;
      carouselMotionRafRef.current = window.requestAnimationFrame(step);
    };

    carouselMotionRafRef.current = window.requestAnimationFrame(step);
  });

  const canConsumeVerticalScroll = useEffectEvent((event: WheelEvent): boolean => {
    const target = event.target;
    const activeCard = sectionRefs.current[activeSection];
    if (!(target instanceof Element) || !activeCard || !activeCard.contains(target)) {
      return false;
    }

    if (target.closest(".modal-backdrop")) {
      return true;
    }

    const direction = Math.sign(event.deltaY);
    let current: Element | null = target;

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

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) {
      return;
    }

    const handleScroll = () => {
      window.requestAnimationFrame(() => updateActiveSectionFromScroll());

      if (
        carouselMotionRafRef.current !== null ||
        Math.abs(carouselVelocityRef.current) >= CAROUSEL_FLOAT_MIN_VELOCITY
      ) {
        clearCarouselSettleTimer();
        return;
      }

      scheduleCarouselSettle();
    };

    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return;
      }

      if (canConsumeVerticalScroll(event)) {
        return;
      }

      let normalizedDeltaY = event.deltaY;
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        normalizedDeltaY *= CAROUSEL_WHEEL_LINE_HEIGHT_PX;
      } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        normalizedDeltaY *= carousel.clientHeight;
      }

      event.preventDefault();
      clearCarouselSettleTimer();
      carouselVelocityRef.current += normalizedDeltaY * CAROUSEL_WHEEL_FLOAT_SENSITIVITY;
      startCarouselMotion();
    };

    carousel.addEventListener("scroll", handleScroll, { passive: true });
    carousel.addEventListener("wheel", handleWheel, { passive: false });
    handleScroll();

    return () => {
      clearCarouselSettleTimer();
      clearCarouselMotionRaf();
      carousel.removeEventListener("scroll", handleScroll);
      carousel.removeEventListener("wheel", handleWheel);
    };
  }, [
    activeSection,
    canConsumeVerticalScroll,
    clearCarouselMotionRaf,
    clearCarouselSettleTimer,
    resolveMostVisibleSection,
    scheduleCarouselSettle,
    settleCarouselSection,
    startCarouselMotion,
    updateActiveSectionFromScroll,
  ]);

  const startGame2048 = () => {
    setNetworkError(null);
    setGameState({
      board: createInitialBoard(),
      score: 0,
      moves: 0,
      startedAt: Date.now(),
      gameOver: false,
      submission: null,
      submitting: false,
    });
    setActiveScene("2048");
  };

  const completeCurrentGame = async () => {
    if (!gameState || gameState.submitting || gameState.submission) {
      return;
    }

    if (!setup.auth?.guildId || !setup.auth.accessToken) {
      setGameState((previous) =>
        previous
          ? {
              ...previous,
              gameOver: true,
              submission: {
                success: false,
              },
            }
          : previous
      );
      return;
    }

    setGameState((previous) => (previous ? { ...previous, submitting: true } : previous));

    try {
      const response = await fetch("/api/games/2048/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [TUNNEL_BYPASS_HEADER]: "1",
          Authorization: `Bearer ${setup.auth.accessToken}`,
          "x-guild-id": setup.auth.guildId,
        },
        body: JSON.stringify({
          submissionId: crypto.randomUUID(),
          guildId: setup.auth.guildId,
          score: gameState.score,
          moves: gameState.moves,
          durationMs: Math.max(0, Date.now() - gameState.startedAt),
        }),
      });

      const payload = (await response.json()) as CompletionResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to submit game result");
      }

      setGameState((previous) =>
        previous
          ? {
              ...previous,
              gameOver: true,
              submitting: false,
              submission: payload,
            }
          : previous
      );

      await fetchLauncherData(setup.auth);
    } catch (error: any) {
      setNetworkError(error?.message || "Failed to complete game.");
      setGameState((previous) =>
        previous
          ? {
              ...previous,
              gameOver: true,
              submitting: false,
            }
          : previous
      );
    }
  };

  const applyDirection = (direction: Direction) => {
    setNetworkError(null);
    setGameState((previous) => {
      if (!previous || previous.gameOver || previous.submitting) {
        return previous;
      }

      const moved = applyMove(previous.board, direction);
      if (!moved.moved) {
        return previous;
      }

      const boardWithRandomTile = addRandomTile(moved.board);
      const nextScore = previous.score + moved.scoreGained;
      const nextMoves = previous.moves + 1;
      const gameOver = !hasMovesAvailable(boardWithRandomTile);

      return {
        ...previous,
        board: boardWithRandomTile,
        score: nextScore,
        moves: nextMoves,
        gameOver,
      };
    });
  };

  useEffect(() => {
    if (!gameState?.gameOver || gameState.submission || gameState.submitting) {
      return;
    }

    void completeCurrentGame();
  }, [gameState?.gameOver, gameState?.submission, gameState?.submitting]);

  const handleGameKeydown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      applyDirection("up");
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      applyDirection("down");
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      applyDirection("left");
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      applyDirection("right");
    }
  });

  useEffect(() => {
    if (activeScene !== "2048") {
      return;
    }

    window.addEventListener("keydown", handleGameKeydown);
    return () => {
      window.removeEventListener("keydown", handleGameKeydown);
    };
  }, [activeScene, handleGameKeydown]);

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearNavDockTimer();
    };
  }, [clearNavDockTimer]);

  useEffect(() => {
    if (activeScene !== "launcher") {
      collapseNavDock();
    }
  }, [activeScene, collapseNavDock]);

  const performMutation = async <TAction extends Record<string, unknown>>(
    path: string,
    body: Record<string, unknown>
  ) => {
    if (!setup.auth?.accessToken || !setup.auth.guildId) {
      throw new Error("This action requires Discord authorization.");
    }

    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [TUNNEL_BYPASS_HEADER]: "1",
        Authorization: `Bearer ${setup.auth.accessToken}`,
        "x-guild-id": setup.auth.guildId,
      },
      body: JSON.stringify({
        guildId: setup.auth.guildId,
        ...body,
      }),
    });

    const payload = (await response.json()) as ActivityMutationEnvelope<TAction> & {
      error?: string;
      message?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error || payload.message || "Action failed");
    }

    startTransition(() => {
      setLauncherData(payload.launcher);
    });

    return payload;
  };

  const openMoneyModal = (direction: MoneyMoveDirection) => {
    setMoneyModal({
      open: true,
      direction,
      input: "",
      selectedPreset: null,
      submitting: false,
      error: null,
    });
  };

  const submitMoneyMove = async () => {
    if (!launcherData) {
      return;
    }

    const amountMode: MoneyMoveMode =
      moneyModal.selectedPreset !== null ? "percent" : "fixed";
    const parsedAmount =
      amountMode === "percent"
        ? moneyModal.selectedPreset || 0
        : parsePositiveAmount(moneyModal.input);

    if (parsedAmount <= 0) {
      setMoneyModal((previous) => ({
        ...previous,
        error: "Enter a valid amount.",
      }));
      return;
    }

    setMoneyModal((previous) => ({
      ...previous,
      submitting: true,
      error: null,
    }));

    try {
      const payload = await performMutation<{
        direction: MoneyMoveDirection;
        amount: number;
        amountMode: MoneyMoveMode;
      }>("/api/economy/move", {
        direction: moneyModal.direction,
        amountMode,
        amount: parsedAmount,
      });

      setMoneyModal({
        open: false,
        direction: moneyModal.direction,
        input: "",
        selectedPreset: null,
        submitting: false,
        error: null,
      });
      setNotice({
        kind: "success",
        message:
          payload.action?.direction === "deposit"
            ? launcherData.strings.balance.depositTitle || "Deposit"
            : launcherData.strings.balance.withdrawTitle || "Withdraw",
      });
    } catch (error: any) {
      setMoneyModal((previous) => ({
        ...previous,
        submitting: false,
        error: error?.message || "Failed to move funds.",
      }));
    }
  };

  const openCrate = async (type: string) => {
    if (!launcherData || launcherData.readOnly) {
      return;
    }

    setPendingCrateType(type);

    try {
      const payload = await performMutation<{ type: string; reward: Record<string, unknown> }>(
        "/api/crates/open",
        {
          type,
        }
      );

      setCrateReveal({
        type,
        reward:
          payload.action?.reward && typeof payload.action.reward === "object"
            ? payload.action.reward
            : {},
      });
      setNotice({
        kind: "success",
        message: launcherData.strings.cases.openSuccess || "Case opened",
      });
    } catch (error: any) {
      setNotice({
        kind: "error",
        message: error?.message || "Failed to open case.",
      });
    } finally {
      setPendingCrateType(null);
    }
  };

  const purchaseUpgrade = async (upgradeType: string) => {
    if (!launcherData || launcherData.readOnly) {
      return;
    }

    setPendingUpgradeType(upgradeType);

    try {
      await performMutation<{ upgradeType: string }>("/api/upgrades/purchase", {
        upgradeType,
      });
      setNotice({
        kind: "success",
        message: launcherData.strings.upgrades.boughtSuccess || "Upgrade purchased",
      });
    } catch (error: any) {
      setNotice({
        kind: "error",
        message: error?.message || "Failed to purchase upgrade.",
      });
    } finally {
      setPendingUpgradeType(null);
    }
  };

  const jumpToSection = (section: ActivitySection) => {
    setActiveSection(section);
    scrollToSection(section, "smooth");
    scheduleNavDockCollapse(950);
  };

  if (setup.loading) {
    return <div className="screen center">Loading Activity...</div>;
  }

  if (setup.error && !launcherData) {
    return (
      <div className="screen center error">
        <p>{setup.error}</p>
        {setup.diagnostics ? (
          <p className="muted">
            {setup.diagnostics.clientId || "missing"} · {setup.diagnostics.guildId || "missing"}
          </p>
        ) : null}
      </div>
    );
  }

  if (!launcherData) {
    return <div className="screen center error">Failed to load launcher.</div>;
  }

  const locale = launcherData.locale;
  const paletteStyle = createPaletteStyle(launcherData);
  const playable2048 = getGameById(launcherData, "2048");
  const projectedBalance = projectBankSnapshot(launcherData.balance, now);
  const isReadOnly = launcherData.readOnly;
  const localeTag = getLocaleTag(locale);
  const playableGamesCount = launcherData.games.items.filter((game) => game.playable).length;
  const availableCasesCount = launcherData.cases.cards.filter((crate) => crate.available).length;
  const focusedCrate =
    getCrateByType(launcherData, focusedCrateType) ||
    launcherData.cases.cards.find((crate) => crate.available) ||
    launcherData.cases.cards[0];
  const focusedUpgrade =
    getUpgradeByType(launcherData, focusedUpgradeType) ||
    launcherData.upgrades.groups[0]?.items[0];
  const activeUpgradeGroup =
    launcherData.upgrades.groups.find((group) => group.key === focusedUpgrade?.category) ||
    launcherData.upgrades.groups[0];
  const focusedGame =
    getGameById(launcherData, focusedGameId) ||
    playable2048 ||
    launcherData.games.items[0];
  const focusedGameDailyProgress = getDailyProgress(focusedGame);
  const casesCalendar = buildCasesCalendarPresentation(
    locale,
    launcherData.cases.dailyStatus,
    {
      monthStatus: "Monthly calendar",
      streak: launcherData.strings.common.streak || "Streak",
      rewardMultiplier:
        launcherData.strings.common.rewardMultiplier || "Reward Multiplier",
      dailyReady: launcherData.strings.cases.readyNow || "Ready now",
    }
  );
  const balanceFooterCards = launcherData.cases.dailyStatus
    ? [
        {
          key: "streak",
          label: launcherData.strings.common.streak || "Streak",
          value: formatNumber(launcherData.cases.dailyStatus.streak || 0, locale, 0),
          icon: "🔥",
        },
        {
          key: "multiplier",
          label: launcherData.strings.common.rewardMultiplier || "Reward Multiplier",
          value: `${formatNumber(
            launcherData.cases.dailyStatus.rewardMultiplier || 1,
            locale,
            2
          )}x`,
          icon: "✨",
        },
      ]
    : [];
  const balanceCycleRemainingMs = Math.max(
    0,
    launcherData.balance.maxInactiveMs - projectedBalance.timeIntoCycleMs
  );
  const balanceProfilePanel = {
    avatarUrl: launcherData.user.avatarUrl || launcherData.user.avatar || undefined,
    userId: launcherData.user.id || undefined,
    displayName:
      launcherData.user.displayName || launcherData.user.username || undefined,
    meta:
      launcherData.guild?.name ||
      (isReadOnly ? launcherData.strings.common.readOnly || "Read-only preview" : localeTag),
    guildName: launcherData.guild?.name || undefined,
  };
  const balanceClassicBanner = {
    icon: isReadOnly ? "🔒" : projectedBalance.cycleComplete ? "✅" : "🏦",
    dotColor: "rgba(24, 22, 20, 0.82)",
    label: isReadOnly
      ? launcherData.strings.common.readOnly || "Read-only preview"
      : launcherData.strings.common.liveGrowth || "Live bank growth",
    value: isReadOnly
      ? launcherData.guild?.name || localeTag
      : projectedBalance.cycleComplete
      ? "done"
      : formatCooldownClock(balanceCycleRemainingMs),
    background: isReadOnly
      ? "linear-gradient(90deg, rgba(108, 108, 116, 0.94), rgba(77, 77, 83, 0.82))"
      : projectedBalance.cycleComplete
      ? "linear-gradient(90deg, rgba(104, 130, 115, 0.94), rgba(74, 98, 84, 0.82))"
      : "linear-gradient(90deg, rgba(216, 65, 55, 0.94), rgba(181, 42, 37, 0.82))",
    captionTone: "rgba(255,255,255,0.54)",
  };

  if (activeScene === "2048" && gameState) {
    return (
      <Game2048Scene
        launcherData={launcherData}
        gameState={gameState}
        locale={locale}
        paletteStyle={paletteStyle}
        highScore={playable2048?.highScore || 0}
        networkError={networkError}
        onBack={() => {
          setActiveScene("launcher");
          setGameState(null);
        }}
        onMove={applyDirection}
        onStopAndSubmit={() => void completeCurrentGame()}
      />
    );
  }

  return (
    <div
      className={`screen launcher-shell ${isCompactViewport ? "is-compact" : ""} ${isDenseViewport ? "is-dense" : ""} ${isMicroViewport ? "is-micro" : ""}`}
      style={paletteStyle}
    >
      <div className="ambient-layer" />
      <nav
        ref={navRef}
        className={`section-nav ${isNavExpanded ? "is-expanded" : "is-collapsed"}`}
        onPointerEnter={() => openNavDock()}
        onPointerLeave={() => scheduleNavDockCollapse(280)}
        onFocusCapture={() => openNavDock()}
        onBlurCapture={(event) => {
          const nextTarget = event.relatedTarget as Node | null;
          if (nextTarget && navRef.current?.contains(nextTarget)) {
            return;
          }

          scheduleNavDockCollapse(220);
        }}
      >
        <button
          type="button"
          className="section-nav-handle"
          aria-expanded={isNavExpanded}
          aria-label={isNavExpanded ? "Collapse navigation" : "Expand navigation"}
          onClick={() => {
            if (isNavExpanded) {
              collapseNavDock();
            } else {
              openNavDock();
            }
          }}
        >
          <span className="section-nav-handle-bar" />
        </button>
        <div className="section-nav-track">
          {SECTIONS.map((section) => (
            <button
              key={section}
              className={`section-chip ${activeSection === section ? "is-active" : ""}`}
              onClick={() => jumpToSection(section)}
            >
              {launcherData.strings.nav[section] || section}
            </button>
          ))}
        </div>
      </nav>

      {setup.error ? <div className="notice warning">{setup.error}</div> : null}
      {launcherData.unsupportedReason ? (
        <div className="notice warning">{launcherData.unsupportedReason}</div>
      ) : null}
      {notice ? <div className={`notice ${notice.kind}`}>{notice.message}</div> : null}

      <div className="carousel-shell" ref={carouselRef}>
        <section
          className={`section-card ${activeSection === "balance" ? "is-active" : "is-inactive"}`}
          ref={(node) => {
            sectionRefs.current.balance = node;
          }}
        >
          <div className="section-content">
            <BalanceSectionView
              layout="classic"
              compact={shouldCompactBalance}
              density={viewportTier}
              eyebrow={launcherData.strings.nav.balance}
              title={launcherData.strings.balance.title || launcherData.strings.nav.balance}
              titleMeta={
                launcherData.user.displayName || launcherData.user.username || null
              }
              subtitle={null}
              profilePanel={balanceProfilePanel}
              classicBanner={balanceClassicBanner}
              coloring={{
                textColor: launcherData.palette.textColor,
                secondaryTextColor: launcherData.palette.secondaryTextColor,
                tertiaryTextColor: launcherData.palette.tertiaryTextColor,
                overlayBackground: launcherData.palette.overlayBackground,
                accentColor: launcherData.palette.accentColor,
                dominantColor:
                  launcherData.palette.dominantColor || launcherData.palette.accentColor,
              }}
              summaryCards={[]}
              primaryCards={[
                {
                  key: "wallet-card",
                  icon: "💵",
                  label: launcherData.strings.common.wallet || "Wallet",
                  value: formatNumber(launcherData.balance.walletBalance, locale),
                  description: launcherData.strings.balance.withdrawHint,
                  action: {
                    label: "+",
                    disabled: isReadOnly,
                    onClick: () => openMoneyModal("withdraw"),
                  },
                },
                {
                  key: "bank-card",
                  icon: "🏦",
                  label: launcherData.strings.common.bank || "Bank",
                  value: formatNumber(projectedBalance.projectedTotalBankBalance, locale),
                  description: launcherData.strings.balance.depositHint,
                  action: {
                    label: "+",
                    disabled: isReadOnly,
                    onClick: () => openMoneyModal("deposit"),
                  },
                  supportingItems: [
                    {
                      key: "annual-rate",
                      label: launcherData.strings.common.annualRate || "Annual Rate",
                      value: `${formatNumber(
                        launcherData.balance.annualRatePercent,
                        locale,
                        2
                      )}%`,
                      icon: "↗",
                    },
                  ],
                },
              ]}
              metricCards={[
                {
                  key: "annual-metric",
                  label: launcherData.strings.common.annualRate || "Annual Rate",
                  value: `${formatNumber(launcherData.balance.annualRatePercent, locale, 2)}%`,
                  icon: "📈",
                },
                {
                  key: "projected-metric",
                  label: launcherData.strings.balance.projectedTitle || "Projected Total",
                  value: formatNumber(projectedBalance.projectedTotalBankBalance, locale),
                  icon: "✨",
                },
                {
                  key: "discount-metric",
                  label: launcherData.strings.balance.discountTitle || "Upgrade Discount",
                  value: `${formatNumber(launcherData.balance.upgradeDiscount, locale, 0)}%`,
                  icon: "🛍️",
                },
              ]}
              progress={{
                label: launcherData.strings.balance.cycleTitle,
                value: `${formatNumber(
                  projectedBalance.timeIntoCycleMs / 60000,
                  locale,
                  0
                )}m / ${formatNumber(
                  launcherData.balance.maxInactiveMs / 60000,
                  locale,
                  0
                )}m`,
                subtitle: launcherData.strings.common.liveGrowth,
                progress: projectedBalance.cycleProgress,
              }}
              footerCards={balanceFooterCards}
            />
          </div>
        </section>

        <section
          className={`section-card ${activeSection === "cases" ? "is-active" : "is-inactive"}`}
          ref={(node) => {
            sectionRefs.current.cases = node;
          }}
        >
          <div className="section-content">
            <CasesSectionView
              compact={shouldCompactPanels}
              density={viewportTier}
              eyebrow={launcherData.strings.nav.cases}
              title={launcherData.strings.cases.title || launcherData.strings.nav.cases}
              subtitle={launcherData.strings.cases.rewardTitle}
              coloring={{
                textColor: launcherData.palette.textColor,
                secondaryTextColor: launcherData.palette.secondaryTextColor,
                tertiaryTextColor: launcherData.palette.tertiaryTextColor,
                overlayBackground: launcherData.palette.overlayBackground,
                accentColor: launcherData.palette.accentColor,
                dominantColor:
                  launcherData.palette.dominantColor || launcherData.palette.accentColor,
              }}
              summaryCards={[
                {
                  label: launcherData.strings.common.available || "Available",
                  value: formatNumber(availableCasesCount, locale, 0),
                },
                {
                  label: launcherData.strings.common.streak || "Streak",
                  value: formatNumber(
                    launcherData.cases.dailyStatus?.streak || 0,
                    locale,
                    0
                  ),
                },
              ]}
              calendar={casesCalendar}
              featuredCase={
                focusedCrate
                  ? {
                      kicker: launcherData.strings.cases.rewardTitle,
                      title: focusedCrate.name,
                      description: focusedCrate.description,
                      emoji: focusedCrate.emoji,
                      countLabel: launcherData.strings.common.available || "Available",
                      countValue: formatNumber(focusedCrate.count, locale, 0),
                      statusLabel: launcherData.strings.cases.openButton || "Open",
                      statusValue: focusedCrate.statusLabel,
                      statusTone: focusedCrate.available ? "ready" : "cooldown",
                      infoCards: [
                        {
                          icon: "💵",
                          label: launcherData.strings.common.coins || "coins",
                          value: `${formatNumber(
                            focusedCrate.rewardPreview.minCoins,
                            locale,
                            0
                          )} - ${formatNumber(
                            focusedCrate.rewardPreview.maxCoins,
                            locale,
                            0
                          )}`,
                        },
                        {
                          icon: "✨",
                          label: "XP / Discount",
                          value: `${formatNumber(
                            focusedCrate.rewardPreview.seasonXpAmount,
                            locale,
                            0
                          )} / ${formatNumber(
                            focusedCrate.rewardPreview.discountAmount,
                            locale,
                            0
                          )}%`,
                        },
                      ],
                      action: {
                        label:
                          pendingCrateType === focusedCrate.type
                            ? "..."
                            : launcherData.strings.cases.openButton || "Open Case",
                        disabled:
                          isReadOnly ||
                          !focusedCrate.available ||
                          pendingCrateType === focusedCrate.type,
                        onClick: () => openCrate(focusedCrate.type),
                      },
                    }
                  : null
              }
              collectionTitle={launcherData.strings.cases.title || launcherData.strings.nav.cases}
              collectionCountText={`${formatNumber(
                launcherData.cases.totalCount,
                locale,
                0
              )} total`}
              cases={launcherData.cases.cards.map((crate) => ({
                id: crate.type,
                title: crate.name,
                subtitle: crate.available
                  ? launcherData.strings.cases.readyNow || "Ready now"
                  : crate.statusLabel,
                emoji: crate.emoji,
                countLabel: formatNumber(crate.count, locale, 0),
                isActive: crate.type === focusedCrate?.type,
                disabled: isReadOnly,
                onSelect: () => setFocusedCrateType(crate.type),
              }))}
              detailPanel={{
                title: crateReveal
                  ? launcherData.strings.cases.rewardTitle
                  : launcherData.strings.cases.title || launcherData.strings.nav.cases,
                subtitle: crateReveal ? crateReveal.type : focusedCrate?.name || "",
                items: crateReveal
                  ? getRewardEntries(crateReveal.reward, locale, launcherData).map((entry) => ({
                      icon: entry.emoji,
                      label: entry.label,
                      value: entry.value,
                    }))
                  : focusedCrate
                  ? [
                      {
                        icon: "💵",
                        label: launcherData.strings.common.coins || "coins",
                        value: `${formatNumber(
                          focusedCrate.rewardPreview.minCoins,
                          locale,
                          0
                        )} - ${formatNumber(
                          focusedCrate.rewardPreview.maxCoins,
                          locale,
                          0
                        )}`,
                      },
                      {
                        icon: "✨",
                        label: "Season XP",
                        value: `+${formatNumber(
                          focusedCrate.rewardPreview.seasonXpAmount,
                          locale,
                          0
                        )}`,
                      },
                      {
                        icon: "🏷️",
                        label: "Discount",
                        value: `${formatNumber(
                          focusedCrate.rewardPreview.discountAmount,
                          locale,
                          0
                        )}%`,
                      },
                    ]
                  : [],
                emptyText: launcherData.strings.cases.noCratesAvailable,
              }}
            />
          </div>
        </section>

        <section
          className={`section-card ${activeSection === "upgrades" ? "is-active" : "is-inactive"}`}
          ref={(node) => {
            sectionRefs.current.upgrades = node;
          }}
        >
          <div className="section-content">
            <UpgradesSectionView
              compact={shouldCompactPanels}
              density={viewportTier}
              eyebrow={launcherData.strings.nav.upgrades}
              title={launcherData.strings.upgrades.title || launcherData.strings.nav.upgrades}
              subtitle={launcherData.strings.upgrades.focusTitle || launcherData.strings.nav.upgrades}
              coloring={{
                textColor: launcherData.palette.textColor,
                secondaryTextColor: launcherData.palette.secondaryTextColor,
                tertiaryTextColor: launcherData.palette.tertiaryTextColor,
                overlayBackground: launcherData.palette.overlayBackground,
                accentColor: launcherData.palette.accentColor,
                dominantColor:
                  launcherData.palette.dominantColor || launcherData.palette.accentColor,
              }}
              summaryCards={[
                {
                  label: launcherData.strings.common.wallet || "Wallet",
                  value: formatNumber(launcherData.balance.walletBalance, locale, 0),
                },
                {
                  label:
                    launcherData.strings.balance.discountTitle || "Upgrade Discount",
                  value: `${formatNumber(
                    launcherData.upgrades.discountPercent,
                    locale,
                    0
                  )}%`,
                },
              ]}
              featuredUpgrade={
                focusedUpgrade
                  ? {
                      kicker:
                        launcherData.strings.upgrades.focusTitle ||
                        launcherData.strings.nav.upgrades,
                      title: focusedUpgrade.name,
                      subtitle: `${focusedUpgrade.impactLabel} · ${activeUpgradeGroup?.title || ""}`,
                      emoji: focusedUpgrade.emoji,
                      description: focusedUpgrade.description,
                      effectLabel: "Effect summary",
                      currentValue: focusedUpgrade.currentEffectLabel,
                      nextValue: focusedUpgrade.nextEffectLabel,
                      gainLabel: launcherData.strings.upgrades.gain || "Gain",
                      gainValue: `+${focusedUpgrade.deltaEffectLabel}`,
                      gainTone: focusedUpgrade.isAffordable ? "positive" : "warning",
                      levelLabel: launcherData.strings.upgrades.current || "Current",
                      levelValue: `L${focusedUpgrade.currentLevel} → L${focusedUpgrade.nextLevel}`,
                      levelHint: launcherData.strings.upgrades.next || "Next",
                      priceValue: `${formatNumber(focusedUpgrade.price, locale, 0)} 💵`,
                      progressPercent: Math.max(
                        0,
                        Math.min(
                          100,
                          focusedUpgrade.price > 0
                            ? Math.round(
                                (launcherData.balance.walletBalance / focusedUpgrade.price) * 100
                              )
                            : 0
                        )
                      ),
                      progressText: focusedUpgrade.isAffordable
                        ? launcherData.strings.upgrades.buyNow || "Buy now"
                        : `${launcherData.strings.upgrades.needMore || "Need"} ${formatNumber(
                            focusedUpgrade.coinsNeeded,
                            locale,
                            0
                          )}`,
                      progressTone: focusedUpgrade.isAffordable ? "positive" : "warning",
                      action: {
                        label:
                          pendingUpgradeType === focusedUpgrade.type
                            ? "..."
                            : launcherData.strings.upgrades.purchaseButton ||
                              launcherData.strings.upgrades.buyNow ||
                              "Purchase",
                        disabled:
                          isReadOnly ||
                          !focusedUpgrade.isAffordable ||
                          pendingUpgradeType === focusedUpgrade.type,
                        onClick: () => purchaseUpgrade(focusedUpgrade.type),
                      },
                    }
                  : null
              }
              categoriesTitle={activeUpgradeGroup?.title || launcherData.strings.nav.upgrades}
              categoriesHint={`${formatNumber(
                activeUpgradeGroup?.items.length || 0,
                locale,
                0
              )} items`}
              categories={launcherData.upgrades.groups.map((group) => ({
                id: group.key,
                label: group.title,
                isActive: group.key === activeUpgradeGroup?.key,
                onSelect: () => setFocusedUpgradeType(group.items[0]?.type || focusedUpgradeType),
              }))}
              upgrades={(activeUpgradeGroup?.items || []).map((upgrade) => ({
                id: upgrade.type,
                title: upgrade.name,
                emoji: upgrade.emoji,
                levelLabel: `LVL ${upgrade.currentLevel}`,
                priceLabel: `${formatNumber(upgrade.price, locale, 0)} 💵`,
                statusLabel: upgrade.isAffordable
                  ? launcherData.strings.upgrades.buyNow || "Buy now"
                  : launcherData.strings.upgrades.needMore || "Need more",
                statusTone: upgrade.isAffordable
                  ? "#8ff0b7"
                  : launcherData.palette.tertiaryTextColor,
                isActive: upgrade.type === focusedUpgrade?.type,
                onSelect: () => setFocusedUpgradeType(upgrade.type),
              }))}
            />
          </div>
        </section>

        <section
          className={`section-card ${activeSection === "games" ? "is-active" : "is-inactive"}`}
          ref={(node) => {
            sectionRefs.current.games = node;
          }}
        >
          <div className="section-content">
            <GamesSectionView
              compact={shouldCompactPanels}
              density={viewportTier}
              eyebrow={launcherData.strings.nav.games}
              title={launcherData.strings.games.title}
              subtitle={launcherData.strings.games.subtitle}
              coloring={{
                textColor: launcherData.palette.textColor,
                secondaryTextColor: launcherData.palette.secondaryTextColor,
                tertiaryTextColor: launcherData.palette.tertiaryTextColor,
                overlayBackground: launcherData.palette.overlayBackground,
                accentColor: launcherData.palette.accentColor,
                dominantColor:
                  launcherData.palette.dominantColor || launcherData.palette.accentColor,
              }}
              summaryCards={[
                {
                  label: launcherData.strings.nav.playable || "Playable",
                  value: formatNumber(playableGamesCount, locale, 0),
                },
                {
                  label: launcherData.strings.common.highScore || "High Score",
                  value: formatNumber(focusedGame?.highScore || 0, locale, 0),
                },
              ]}
              featuredGame={
                focusedGame
                  ? {
                      kicker: launcherData.strings.nav.games,
                      title: focusedGame.title,
                      subtitle: focusedGame.playable
                        ? launcherData.strings.nav.playable || "Playable"
                        : launcherData.strings.nav.comingSoon || "Coming soon",
                      emoji: focusedGame.emoji,
                      statusLabel: launcherData.strings.common.dailyLeft || "Daily Left",
                      statusValue: formatNumber(getStatusDailyRemaining(focusedGame), locale, 0),
                      statCards: [
                        {
                          icon: "🏆",
                          label: launcherData.strings.common.highScore || "High Score",
                          value: formatNumber(focusedGame.highScore || 0, locale, 0),
                        },
                        {
                          icon: "🎯",
                          label: launcherData.strings.common.available || "Available",
                          value: focusedGame.playable
                            ? launcherData.strings.nav.playable || "Playable"
                            : launcherData.strings.nav.comingSoon || "Coming soon",
                        },
                      ],
                      progress: focusedGameDailyProgress
                        ? {
                            label: launcherData.strings.common.dailyLeft || "Daily Left",
                            value: `${formatNumber(
                              focusedGameDailyProgress.earnedToday,
                              locale,
                              0
                            )} / ${formatNumber(focusedGameDailyProgress.cap, locale, 0)}`,
                            percent: focusedGameDailyProgress.percent,
                          }
                        : null,
                      note: {
                        label: launcherData.strings.nav.games,
                        text: isReadOnly
                          ? launcherData.strings.common.unavailableInPreview ||
                            "Unavailable in read-only preview"
                          : focusedGame.playable
                          ? launcherData.strings.games.subtitle
                          : launcherData.strings.nav.comingSoon || "Coming soon",
                        color: focusedGame.playable && !isReadOnly
                          ? launcherData.palette.secondaryTextColor
                          : launcherData.palette.tertiaryTextColor,
                      },
                      action: {
                        label: focusedGame.playable
                          ? launcherData.strings.games.play2048 || "Play 2048"
                          : launcherData.strings.nav.comingSoon || "Coming soon",
                        disabled: isReadOnly || !focusedGame.playable,
                        onClick: focusedGame.playable ? startGame2048 : undefined,
                      },
                    }
                  : null
              }
              collectionTitle={launcherData.strings.games.title}
              collectionCountText={`${formatNumber(
                launcherData.games.items.length,
                locale,
                0
              )} ${launcherData.strings.games.title}`}
              collectionHintText={
                focusedGame?.playable
                  ? launcherData.strings.games.play2048 || "Play 2048"
                  : launcherData.strings.nav.comingSoon || "Coming soon"
              }
              games={launcherData.games.items.map((game) => ({
                id: game.id,
                title: game.title,
                emoji: game.emoji,
                meta: `${launcherData.strings.common.highScore || "High Score"}: ${formatNumber(
                  game.highScore || 0,
                  locale,
                  0
                )}`,
                statusLabel: game.playable
                  ? launcherData.strings.nav.playable || "Playable"
                  : launcherData.strings.nav.comingSoon || "Soon",
                isActive: game.id === focusedGame?.id,
                isMuted: !game.playable,
                onSelect: () => setFocusedGameId(game.id),
              }))}
            />
          </div>
        </section>
      </div>

      {moneyModal.open ? (
        <MoneyModal
          launcherData={launcherData}
          state={moneyModal}
          onClose={() =>
            setMoneyModal((previous) => ({
              ...previous,
              open: false,
              error: null,
            }))
          }
          onInputChange={(value) =>
            setMoneyModal((previous) => ({
              ...previous,
              input: value,
              selectedPreset: null,
              error: null,
            }))
          }
          onPresetSelect={(value) =>
            setMoneyModal((previous) => ({
              ...previous,
              selectedPreset: value,
              input: "",
              error: null,
            }))
          }
          onSubmit={() => void submitMoneyMove()}
        />
      ) : null}

      {import.meta.env.DEV && setup.diagnostics ? (
        <details className="debug-panel">
          <summary>Activity Debug</summary>
          <div>{setup.diagnostics.currentStep}</div>
          <div>{setup.diagnostics.guildId || "missing"}</div>
          <div>{setup.diagnostics.clientId || "missing"}</div>
          <div>{localeTag}</div>
        </details>
      ) : null}
    </div>
  );
}
