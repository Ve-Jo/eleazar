import EconomyEZ from "./economy.js";
import prettyMs from "pretty-ms";

const COOLDOWNS = {
  crime: 8 * 60 * 60 * 1000, // 8 hours in milliseconds
  daily: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
};

const MIN_CRIME_COOLDOWN = 2 * 60 * 60 * 1000; // Minimum 2 hours

async function getCooldownTime(guildId, userId, type) {
  const timestamps = await EconomyEZ.get(`timestamps.${guildId}.${userId}`);
  const currentTime = Date.now();

  if (type === "crime") {
    const upgradeLevel =
      (await EconomyEZ.get(`shop.${guildId}.${userId}.upgrade_level`)) || 1;
    const cooldownReduction = (upgradeLevel - 1) * 20 * 60 * 1000; // 20 minutes per level
    const cooldownTime = Math.max(
      COOLDOWNS.crime - cooldownReduction,
      MIN_CRIME_COOLDOWN
    );
    const timeLeft = timestamps.crime + cooldownTime - currentTime;
    return timeLeft > 0 ? timeLeft : 0;
  }

  if (type === "daily") {
    const timeLeft = timestamps.daily + COOLDOWNS.daily - currentTime;
    return timeLeft > 0 ? timeLeft : 0;
  }

  return 0;
}

async function isCooldownActive(guildId, userId, type) {
  const timeLeft = await getCooldownTime(guildId, userId, type);
  return timeLeft > 0;
}

async function getCooldownMessage(guildId, userId, type) {
  const timeLeft = await getCooldownTime(guildId, userId, type);
  return timeLeft > 0 ? prettyMs(timeLeft, { verbose: true }) : null;
}

export default {
  getCooldownTime,
  isCooldownActive,
  getCooldownMessage,
};
