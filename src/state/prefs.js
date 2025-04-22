import { state } from "./state.js";
import CONFIG from "../config/aiConfig.js";

export function getUserPreferences(userId) {
  if (!state.userPreferences[userId]) {
    state.userPreferences[userId] = {
      selectedModel: null,
      systemPromptEnabled: true,
      toolsEnabled: true,
      messageHistory: [],
    };
  }
  return state.userPreferences[userId];
}

export function updateUserPreference(userId, key, value) {
  const prefs = getUserPreferences(userId);
  prefs[key] = value;
  return prefs;
}

export function clearUserHistory(userId) {
  const prefs = getUserPreferences(userId);
  prefs.messageHistory = [];
  console.log(`Cleared message history for user ${userId}`);
}

export function addConversationToHistory(userId, userMessage, aiResponse) {
  const prefs = getUserPreferences(userId);

  prefs.messageHistory.push({ role: "user", content: userMessage });
  prefs.messageHistory.push({ role: "assistant", content: aiResponse });

  const maxPairs = CONFIG.maxContextLength || 4;
  if (prefs.messageHistory.length > maxPairs * 2) {
    const systemMessage =
      prefs.systemPromptEnabled &&
      prefs.messageHistory.find((m) => m.role === "system");
    const numToRemove = 2;
    prefs.messageHistory.splice(systemMessage ? 1 : 0, numToRemove);
  }
}
