import { useEffect, useEffectEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { completeActivity2048Game } from "../../../lib/activityApi.ts";
import {
  addRandomTile,
  applyMove,
  createInitialBoard,
  hasMovesAvailable,
  type Direction,
} from "../../../lib/game2048.ts";
import type { AuthState, ActivityScene, GameState } from "../../../types/activityUi.ts";

type UseGame2048ControllerOptions = {
  activeScene: ActivityScene;
  auth: AuthState | null;
  refreshLauncher: () => Promise<void>;
  setActiveScene: (scene: ActivityScene) => void;
};

export function useGame2048Controller({
  activeScene,
  auth,
  refreshLauncher,
  setActiveScene,
}: UseGame2048ControllerOptions) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const complete2048Mutation = useMutation({
    mutationFn: (request: {
      submissionId: string;
      guildId: string;
      score: number;
      moves: number;
      durationMs: number;
    }) => completeActivity2048Game(auth, request),
  });

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

  const backToLauncher = () => {
    setActiveScene("launcher");
    setGameState(null);
  };

  const completeCurrentGame = async () => {
    if (!gameState || gameState.submitting || gameState.submission) {
      return;
    }

    if (!auth?.guildId || !auth.accessToken) {
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
      const payload = await complete2048Mutation.mutateAsync({
        submissionId: crypto.randomUUID(),
        guildId: auth.guildId,
        score: gameState.score,
        moves: gameState.moves,
        durationMs: Math.max(0, Date.now() - gameState.startedAt),
      });

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

      await refreshLauncher();
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

  return {
    applyDirection,
    backToLauncher,
    completeCurrentGame,
    gameState,
    networkError,
    startGame2048,
  };
}
