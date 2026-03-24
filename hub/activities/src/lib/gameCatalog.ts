export type ActivityGameStatus = "playable" | "coming_soon";

export type ActivityGameConfig = {
  id: string;
  title: string;
  emoji: string;
  status: ActivityGameStatus;
};

export const ACTIVITY_GAME_CATALOG: ActivityGameConfig[] = [
  { id: "2048", title: "2048", emoji: "🎲", status: "playable" },
  { id: "snake", title: "Snake", emoji: "🐍", status: "coming_soon" },
  { id: "coinflip", title: "Coinflip", emoji: "🪙", status: "coming_soon" },
  { id: "tower", title: "Tower", emoji: "🗼", status: "coming_soon" },
  { id: "crypto2", title: "Crypto 2.0", emoji: "📈", status: "coming_soon" },
];
