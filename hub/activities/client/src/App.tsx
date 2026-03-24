import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DiscordSDK } from "@discord/embedded-app-sdk";

import {
  applyMove,
  addRandomTile,
  createInitialBoard,
  hasMovesAvailable,
  type Board,
  type Direction,
} from "./lib/game2048.ts";

type AuthState = {
  accessToken: string;
  userId?: string;
  guildId?: string;
};

type LauncherGame = {
  id: string;
  title: string;
  emoji: string;
  status: "playable" | "coming_soon";
  highScore?: number;
  dailyStatus?: {
    cap?: number;
    earnedToday?: number;
    remainingToday?: number;
  } | null;
};

type LauncherData = {
  user?: {
    id?: string;
    username?: string;
    displayName?: string;
    avatar?: string;
  };
  guild?: {
    id?: string;
    name?: string;
  } | null;
  readOnly?: boolean;
  unsupportedReason?: string;
  economy?: {
    balance?: number;
    totalBankBalance?: number;
  } | null;
  crateSummary?: Record<string, number>;
  upgrades?: Array<{ type?: string; level?: number }>;
  stats?: Record<string, unknown> | null;
  records?: Record<string, { highScore?: number }>;
  games?: LauncherGame[];
};

type CompletionResponse = {
  success?: boolean;
  idempotent?: boolean;
  reward?: {
    awardedAmount?: number;
    visualAwardedAmount?: number;
    blockedAmount?: number;
    gameXp?: number;
    requestedEarning?: number;
  };
  progression?: {
    highScore?: number;
    isNewRecord?: boolean;
  };
  dailyStatus?: {
    cap?: number;
    earnedToday?: number;
    remainingToday?: number;
  };
};

type GameState = {
  board: Board;
  score: number;
  moves: number;
  startedAt: number;
  gameOver: boolean;
  submission?: CompletionResponse | null;
  submitting: boolean;
};

type SetupState = {
  loading: boolean;
  error: string | null;
  auth: AuthState | null;
  sdkReady: boolean;
  diagnostics: SetupDiagnostics | null;
};

type SetupDiagnostics = {
  clientId?: string;
  origin: string;
  href: string;
  guildId?: string;
  channelId?: string;
  errorStep?: string;
  currentStep: string;
  lastError?: string;
};

type DiscordAuthorizeInput = Parameters<DiscordSDK["commands"]["authorize"]>[0];

const TUNNEL_BYPASS_HEADER = "bypass-tunnel-reminder";
const LAUNCHER_DATA_TIMEOUT_MS = 5000;
const CLIENT_DEBUG_MARKER = "oauth-debug-2026-03-24-2059";

function formatNumber(value: unknown): string {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return "0";
  }

  return numeric.toLocaleString("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(numeric) ? 0 : 1,
  });
}

function getGuildIdFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("guildId") ||
    params.get("guild_id") ||
    params.get("guild") ||
    ""
  );
}

function getAvatarUrl(userId?: string, avatarHash?: string | null): string {
  if (!userId || !avatarHash) {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }

  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=128`;
}

function resolveGuildId(discordSdk: DiscordSDK): string {
  return discordSdk.guildId || getGuildIdFromUrl();
}

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
  const [launcherData, setLauncherData] = useState<LauncherData | null>(null);
  const [activeView, setActiveView] = useState<"launcher" | "2048">("launcher");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const sdkRef = useRef<DiscordSDK | null>(null);

  const updateDiagnostics = useCallback((patch: Partial<SetupDiagnostics>) => {
    setDiagnostics((prev) => ({
      ...prev,
      origin: window.location.origin,
      href: window.location.href,
      ...patch,
    }));
  }, []);

  const fetchLauncherData = useCallback(
    async (auth: AuthState | null) => {
      const guildId = auth?.guildId || getGuildIdFromUrl();
      const params = new URLSearchParams();
      if (guildId) {
        params.set("guildId", guildId);
      }

      const abortController = new AbortController();
      const timeoutId = window.setTimeout(() => {
        abortController.abort();
      }, LAUNCHER_DATA_TIMEOUT_MS);

      updateDiagnostics({
        currentStep: auth?.accessToken
          ? "launcher-data-authenticated"
          : "launcher-data-preview",
        guildId,
      });

      try {
        const response = await fetch(`/api/launcher-data?${params.toString()}`, {
          headers: {
            [TUNNEL_BYPASS_HEADER]: "1",
            ...(auth?.accessToken
              ? { Authorization: `Bearer ${auth.accessToken}` }
              : {}),
            ...(auth?.userId ? { "x-user-id": auth.userId } : {}),
            ...(guildId ? { "x-guild-id": guildId } : {}),
          },
          signal: abortController.signal,
        });

        const payload = (await response.json()) as LauncherData & { error?: string };
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load launcher data");
        }

        setLauncherData(payload);
        updateDiagnostics({
          currentStep: auth?.accessToken
            ? "launcher-data-authenticated:done"
            : "launcher-data-preview:done",
        });
      } catch (error: any) {
        if (error?.name === "AbortError") {
          updateDiagnostics({
            currentStep: "launcher-data-timeout",
            lastError: "Timed out while loading launcher preview from /api/launcher-data",
          });
          throw new Error("Timed out while loading launcher preview from /api/launcher-data");
        }

        updateDiagnostics({
          currentStep: "launcher-data-error",
          lastError: error?.message || "Failed to load launcher data",
        });
        throw error;
      } finally {
        window.clearTimeout(timeoutId);
      }
    },
    [updateDiagnostics]
  );

  const setupSdk = useCallback(async () => {
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

    updateDiagnostics({
      currentStep: "sdk-init",
      clientId: configuredClientId,
    });

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

    updateDiagnostics({
      currentStep: "authorize",
      clientId: configuredClientId,
      guildId: discordSdk.guildId || getGuildIdFromUrl(),
      channelId: discordSdk.channelId || "",
      errorStep: "authorize",
    });

    const authorizeResult = await discordSdk.commands.authorize({
      ...authorizeParams,
    });
    const code = authorizeResult.code;

    updateDiagnostics({
      currentStep: "token-exchange",
    });

    const tokenResponse = await fetch("/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [TUNNEL_BYPASS_HEADER]: "1",
      },
      body: JSON.stringify({ code }),
    });

    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
      error?: string;
      message?: string;
      error_description?: string;
    };
    if (!tokenResponse.ok || !tokenPayload?.access_token) {
      throw new Error(
        tokenPayload?.message ||
          tokenPayload?.error_description ||
          tokenPayload?.error ||
          "Failed to exchange OAuth token."
      );
    }

    updateDiagnostics({
      currentStep: "authenticate",
    });

    const auth = await discordSdk.commands.authenticate({
      access_token: tokenPayload.access_token,
    });

    if (!auth?.user?.id) {
      throw new Error("Discord authenticate command failed.");
    }

    const guildId = resolveGuildId(discordSdk);

    return {
      accessToken: tokenPayload.access_token,
      userId: auth.user.id,
      guildId,
      diagnostics: {
        ...nextDiagnostics,
        guildId,
        currentStep: "authenticated",
      },
    } as AuthState & { diagnostics: typeof diagnostics };
  }, [updateDiagnostics]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const auth = await setupSdk();
        if (cancelled) {
          return;
        }

        await fetchLauncherData(auth);
        if (cancelled) {
          return;
        }

        setSetup({
          loading: false,
          error: null,
          auth,
          sdkReady: true,
          diagnostics:
            (auth as AuthState & {
              diagnostics?: SetupState["diagnostics"];
            }).diagnostics || null,
        });
      } catch (error: any) {
        console.warn("Activity SDK setup failed, trying local fallback", error);

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

        if (cancelled) {
          return;
        }

        setSetup({
          loading: false,
          error:
            `${error?.message || "Discord SDK auth unavailable."} Trying local read-only preview...`,
          auth: null,
          sdkReady: false,
          diagnostics: nextDiagnostics,
        });

        try {
          await fetchLauncherData(null);
          if (cancelled) {
            return;
          }

          setSetup({
            loading: false,
            error:
              `${error?.message || "Discord SDK auth unavailable."} Running in local read-only preview mode.`,
            auth: null,
            sdkReady: false,
            diagnostics: nextDiagnostics,
          });
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
  }, [fetchLauncherData, setupSdk]);

  const startGame2048 = useCallback(() => {
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
    setActiveView("2048");
  }, []);

  const completeCurrentGame = useCallback(async () => {
    if (!gameState || gameState.submitting || gameState.submission) {
      return;
    }

    if (!setup.auth?.guildId || !setup.auth?.accessToken) {
      setGameState((prev) =>
        prev
          ? {
              ...prev,
              gameOver: true,
              submission: {
                success: false,
              },
            }
          : prev
      );
      return;
    }

    setGameState((prev) => (prev ? { ...prev, submitting: true } : prev));

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
        throw new Error(payload?.error || "Failed to submit game result");
      }

      setGameState((prev) =>
        prev
          ? {
              ...prev,
              gameOver: true,
              submitting: false,
              submission: payload,
            }
          : prev
      );

      await fetchLauncherData(setup.auth);
    } catch (error: any) {
      setNetworkError(error?.message || "Failed to complete game.");
      setGameState((prev) =>
        prev
          ? {
              ...prev,
              gameOver: true,
              submitting: false,
            }
          : prev
      );
    }
  }, [fetchLauncherData, gameState, setup.auth]);

  const applyDirection = useCallback(
    (direction: Direction) => {
      setNetworkError(null);
      setGameState((prev) => {
        if (!prev || prev.gameOver || prev.submitting) {
          return prev;
        }

        const moved = applyMove(prev.board, direction);
        if (!moved.moved) {
          return prev;
        }

        const boardWithRandomTile = addRandomTile(moved.board);
        const nextScore = prev.score + moved.scoreGained;
        const nextMoves = prev.moves + 1;
        const gameOver = !hasMovesAvailable(boardWithRandomTile);

        return {
          ...prev,
          board: boardWithRandomTile,
          score: nextScore,
          moves: nextMoves,
          gameOver,
        };
      });
    },
    []
  );

  useEffect(() => {
    if (!gameState?.gameOver || gameState.submission || gameState.submitting) {
      return;
    }

    void completeCurrentGame();
  }, [completeCurrentGame, gameState?.gameOver, gameState?.submission, gameState?.submitting]);

  useEffect(() => {
    if (activeView !== "2048") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeView, applyDirection]);

  const playable2048 = useMemo(() => {
    return (launcherData?.games || []).find((game) => game.id === "2048");
  }, [launcherData?.games]);

  const isReadOnly = Boolean(launcherData?.readOnly);
  const canPlay2048 = !isReadOnly && playable2048?.status === "playable";
  const visibleDiagnostics = setup.diagnostics || diagnostics;

  const debugPanel = (
    <details
      open
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 9999,
        maxWidth: 420,
        padding: 12,
        borderRadius: 12,
        background: "rgba(10, 12, 18, 0.92)",
        color: "#f5f7fb",
        border: "1px solid rgba(255, 255, 255, 0.14)",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
        fontSize: 12,
        lineHeight: 1.5,
        whiteSpace: "normal",
      }}
    >
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>
        Activity Debug
      </summary>
      <div style={{ marginTop: 8 }}>
        <div>{CLIENT_DEBUG_MARKER}</div>
        <div>step={visibleDiagnostics.currentStep || "unknown"}</div>
        <div>clientId={visibleDiagnostics.clientId || "missing"}</div>
        <div>guildId={visibleDiagnostics.guildId || "missing"}</div>
        <div>channelId={visibleDiagnostics.channelId || "missing"}</div>
        <div>origin={visibleDiagnostics.origin || "missing"}</div>
        <div>href={visibleDiagnostics.href || "missing"}</div>
        <div>lastError={visibleDiagnostics.lastError || "none"}</div>
      </div>
    </details>
  );

  if (setup.loading) {
    return (
      <>
        <div className="screen center">
          Loading Activity...
          <br />
          <small>{CLIENT_DEBUG_MARKER}</small>
        </div>
        {debugPanel}
      </>
    );
  }

  if (setup.error && !launcherData) {
    return (
      <>
        <div className="screen center error">
          <p>{setup.error}</p>
          <p className="muted">{CLIENT_DEBUG_MARKER}</p>
          {visibleDiagnostics ? (
            <p className="muted">
              OAuth debug:
              {" "}
              clientId={visibleDiagnostics.clientId || "missing"}
              {" · "}
              guildId={visibleDiagnostics.guildId || "missing"}
              {" · "}
              channelId={visibleDiagnostics.channelId || "missing"}
              {" · "}
              origin={visibleDiagnostics.origin || "missing"}
            </p>
          ) : null}
        </div>
        {debugPanel}
      </>
    );
  }

  if (!launcherData) {
    return <div className="screen center error">Failed to load launcher.</div>;
  }

  if (activeView === "2048" && gameState) {
    return (
      <>
        <div className="screen game-screen">
          <header className="top-bar">
            <div>
              <div className="label">ELEAZAR ACTIVITY</div>
              <h1>2048</h1>
            </div>
            <button
              className="btn secondary"
              onClick={() => {
                setActiveView("launcher");
                setGameState(null);
              }}
            >
              Back To Launcher
            </button>
          </header>

          <div className="stats-row">
            <div className="stat-box">
              <span>Score</span>
              <strong>{formatNumber(gameState.score)}</strong>
            </div>
            <div className="stat-box">
              <span>Moves</span>
              <strong>{formatNumber(gameState.moves)}</strong>
            </div>
            <div className="stat-box">
              <span>Best</span>
              <strong>{formatNumber(playable2048?.highScore || 0)}</strong>
            </div>
          </div>

          <div className="board">
            {gameState.board.flatMap((row, rowIndex) =>
              row.map((cell, cellIndex) => (
                <div key={`${rowIndex}-${cellIndex}`} className={`tile tile-${cell || 0}`}>
                  {cell > 0 ? cell : ""}
                </div>
              ))
            )}
          </div>

          <div className="controls">
            <button className="btn" onClick={() => applyDirection("up")}>Up</button>
            <div className="control-row">
              <button className="btn" onClick={() => applyDirection("left")}>Left</button>
              <button className="btn" onClick={() => applyDirection("down")}>Down</button>
              <button className="btn" onClick={() => applyDirection("right")}>Right</button>
            </div>
            <button className="btn danger" onClick={() => void completeCurrentGame()}>
              Stop And Submit
            </button>
          </div>

          {networkError ? <p className="error">{networkError}</p> : null}

          {gameState.submitting ? <p className="muted">Submitting run...</p> : null}

          {gameState.submission ? (
            <div className="submission-card">
              <h3>Run Submitted</h3>
              <p>
                Awarded: {formatNumber(gameState.submission.reward?.visualAwardedAmount || 0)} coins
                {" · "}
                XP: {formatNumber(gameState.submission.reward?.gameXp || 0)}
              </p>
              <p>
                High Score: {formatNumber(gameState.submission.progression?.highScore || 0)}
                {gameState.submission.progression?.isNewRecord ? " (New Record)" : ""}
              </p>
              <p>
                Daily Remaining: {formatNumber(gameState.submission.dailyStatus?.remainingToday || 0)}
              </p>
            </div>
          ) : null}
        </div>
        {debugPanel}
      </>
    );
  }

  const avatarUrl = getAvatarUrl(launcherData.user?.id, launcherData.user?.avatar || null);

  return (
    <>
      <div className="screen launcher">
        <header className="top-bar">
          <div className="profile">
            <img src={avatarUrl} alt="avatar" />
            <div>
              <div className="label">ELEAZAR ACTIVITY</div>
              <h1>{launcherData.guild?.name || "Launcher"}</h1>
              <p>
                {launcherData.user?.displayName || launcherData.user?.username || "Player"}
              </p>
            </div>
          </div>
        </header>

        {setup.error ? <p className="warning">{setup.error}</p> : null}
        <p className="muted">{CLIENT_DEBUG_MARKER}</p>
        {visibleDiagnostics ? (
          <p className="warning">
            OAuth debug:
            {" "}
            clientId={visibleDiagnostics.clientId || "missing"}
            {" · "}
            guildId={visibleDiagnostics.guildId || "missing"}
            {" · "}
            channelId={visibleDiagnostics.channelId || "missing"}
            {" · "}
            origin={visibleDiagnostics.origin || "missing"}
          </p>
        ) : null}
        {launcherData.unsupportedReason ? (
          <p className="warning">{launcherData.unsupportedReason}</p>
        ) : null}

        <section className="cards-grid">
          <article className="card">
            <h3>Balance</h3>
            <strong>{formatNumber(launcherData.economy?.balance || 0)} 💵</strong>
            <small>Bank: {formatNumber(launcherData.economy?.totalBankBalance || 0)}</small>
          </article>

          <article className="card">
            <h3>Cases</h3>
            <strong>{formatNumber(launcherData.crateSummary?.total || 0)}</strong>
            <small>
              Daily: {formatNumber(launcherData.crateSummary?.daily || 0)} · Weekly: {formatNumber(launcherData.crateSummary?.weekly || 0)}
            </small>
          </article>

          <article className="card">
            <h3>Upgrades</h3>
            <strong>{formatNumber((launcherData.upgrades || []).length)}</strong>
            <small>
              Games Earning Lvl {formatNumber(
                (launcherData.upgrades || []).find((item) => item.type === "games_earning")?.level || 1
              )}
            </small>
          </article>
        </section>

        <section className="game-list">
          <h2>Game Launcher</h2>
          <p className="muted">
            Activity-first migration is live. 2048 is playable now; all other games are visible as coming soon.
          </p>

          <div className="games-grid">
            {(launcherData.games || []).map((game) => {
              const playable = game.id === "2048" && game.status === "playable" && canPlay2048;
              return (
                <article key={game.id} className="game-card">
                  <div className="game-head">
                    <span className="emoji">{game.emoji}</span>
                    <div>
                      <h3>{game.title}</h3>
                      <p>
                        {game.status === "playable" ? "Playable" : "Coming soon"}
                      </p>
                    </div>
                  </div>

                  <div className="game-meta">
                    <span>High Score: {formatNumber(game.highScore || 0)}</span>
                    <span>
                      Daily Left: {formatNumber(game.dailyStatus?.remainingToday || 0)}
                    </span>
                  </div>

                  {playable ? (
                    <button className="btn success" onClick={startGame2048}>
                      Play 2048
                    </button>
                  ) : (
                    <button className="btn secondary" disabled>
                      {game.status === "playable" && !canPlay2048 ? "Unavailable In Read-Only" : "Coming Soon"}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
      {debugPanel}
    </>
  );
}
