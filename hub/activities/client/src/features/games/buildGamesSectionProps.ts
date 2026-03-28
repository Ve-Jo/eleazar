import type { ActivityLauncherPayload } from "../../../../../shared/src/contracts/hub.ts";
import {
  formatNumber,
  getDailyProgress,
  getGameById,
  getStatusDailyRemaining,
} from "../../lib/activityView.ts";
import { createSectionColoring } from "../launcher/lib/createSectionColoring.ts";

type BuildGamesSectionPropsOptions = {
  focusedGameId: string;
  isReadOnly: boolean;
  launcherData: ActivityLauncherPayload;
  setFocusedGameId: (gameId: string) => void;
  shouldCompactPanels: boolean;
  onPlay2048: () => void;
};

export function buildGamesSectionProps({
  focusedGameId,
  isReadOnly,
  launcherData,
  setFocusedGameId,
  shouldCompactPanels,
  onPlay2048,
}: BuildGamesSectionPropsOptions) {
  const locale = launcherData.locale;
  const playable2048 = getGameById(launcherData, "2048");
  const focusedGame = getGameById(launcherData, focusedGameId) || playable2048 || launcherData.games.items[0];
  const focusedGameDailyProgress = getDailyProgress(focusedGame);
  const playableGamesCount = launcherData.games.items.filter((game) => game.playable).length;

  return {
    highScore: playable2048?.highScore || 0,
    sectionProps: {
      compact: shouldCompactPanels,
      eyebrow: launcherData.strings.nav.games,
      title: launcherData.strings.games.title,
      subtitle: launcherData.strings.games.subtitle,
      coloring: createSectionColoring(launcherData),
      summaryCards: [
        {
          label: launcherData.strings.nav.playable,
          value: formatNumber(playableGamesCount, locale, 0),
        },
        {
          label: launcherData.strings.common.highScore,
          value: formatNumber(focusedGame?.highScore || 0, locale, 0),
        },
      ],
      featuredGame: focusedGame
        ? {
            kicker: launcherData.strings.nav.games,
            title: focusedGame.title,
            subtitle: focusedGame.playable
              ? launcherData.strings.nav.playable
              : launcherData.strings.nav.comingSoon,
            emoji: focusedGame.emoji,
            statusLabel: launcherData.strings.common.dailyLeft,
            statusValue: formatNumber(getStatusDailyRemaining(focusedGame), locale, 0),
            statCards: [
              {
                icon: "🏆",
                label: launcherData.strings.common.highScore,
                value: formatNumber(focusedGame.highScore || 0, locale, 0),
              },
              {
                icon: "🎯",
                label: launcherData.strings.common.available,
                value: focusedGame.playable
                  ? launcherData.strings.nav.playable
                  : launcherData.strings.nav.comingSoon,
              },
            ],
            progress: focusedGameDailyProgress
              ? {
                  label: launcherData.strings.common.dailyLeft,
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
                ? launcherData.strings.common.unavailableInPreview
                : focusedGame.playable
                ? launcherData.strings.games.subtitle
                : launcherData.strings.nav.comingSoon,
              color:
                focusedGame.playable && !isReadOnly
                  ? launcherData.palette.secondaryTextColor
                  : launcherData.palette.tertiaryTextColor,
            },
            action: {
              label: focusedGame.playable
                ? launcherData.strings.games.play2048
                : launcherData.strings.nav.comingSoon,
              disabled: isReadOnly || !focusedGame.playable,
              onClick: focusedGame.playable ? onPlay2048 : undefined,
            },
          }
        : null,
      collectionTitle: launcherData.strings.games.title,
      collectionCountText: `${formatNumber(
        launcherData.games.items.length,
        locale,
        0
      )} ${launcherData.strings.games.title}`,
      collectionHintText: focusedGame?.playable
        ? launcherData.strings.games.play2048
        : launcherData.strings.nav.comingSoon,
      games: launcherData.games.items.map((game) => ({
        id: game.id,
        title: game.title,
        emoji: game.emoji,
        meta: `${launcherData.strings.common.highScore}: ${formatNumber(
          game.highScore || 0,
          locale,
          0
        )}`,
        statusLabel: game.playable
          ? launcherData.strings.nav.playable
          : launcherData.strings.nav.comingSoon,
        isActive: game.id === focusedGame?.id,
        isMuted: !game.playable,
        onSelect: () => setFocusedGameId(game.id),
      })),
    },
  };
}
