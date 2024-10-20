import EconomyEZ from "./economy.js";
import prettyMs from "pretty-ms";

const COOLDOWNS = {
  crime: BigInt(8 * 60 * 60 * 1000),
  daily: BigInt(24 * 60 * 60 * 1000),
  s,
};

const MIN_CRIME_COOLDOWN = BigInt(2 * 60 * 60 * 1000);

async function getCooldownTime(guildId, userId, type) {
  try {
    const timestamps = await EconomyEZ.get(`timestamps.${guildId}.${userId}`);
    const currentTime = BigInt(Date.now());

    if (type === "crime") {
      const crimeUpgradeId = 2;
      const upgradeLevel =
        (await EconomyEZ.get(
          `shop.${guildId}.${userId}.upgrade_level.${crimeUpgradeId}`
        )) || 1;
      const cooldownReduction = BigInt((upgradeLevel - 1) * 20 * 60 * 1000);
      const cooldownTime = BigInt(
        Math.max(
          Number(BigInt(COOLDOWNS.crime) - cooldownReduction),
          Number(MIN_CRIME_COOLDOWN)
        )
      );
      const lastCrime = BigInt(timestamps?.crime || 0);
      const timeLeft = lastCrime + cooldownTime - currentTime;
      return timeLeft > 0n ? Number(timeLeft) : 0;
    }

    if (type === "daily") {
      const lastDaily = BigInt(timestamps?.daily || 0);
      const cooldown = BigInt(COOLDOWNS.daily);
      const timeLeft = lastDaily + cooldown - currentTime;
      return timeLeft > 0n ? Number(timeLeft) : 0;
    }

    return 0;
  } catch (error) {
    console.error(`Error in getCooldownTime: ${error.message}`);
    return 0;
  }
}

async function isCooldownActive(guildId, userId, type) {
  try {
    const timeLeft = await getCooldownTime(guildId, userId, type);
    return timeLeft > 0;
  } catch (error) {
    console.error(`Error in isCooldownActive: ${error.message}`);
    return false;
  }
}

async function getCooldownMessage(guildId, userId, type) {
  try {
    const timeLeft = await getCooldownTime(guildId, userId, type);
    return timeLeft > 0 ? prettyMs(timeLeft, { verbose: true }) : null;
  } catch (error) {
    console.error(`Error in getCooldownMessage: ${error.message}`);
    return null;
  }
}

export default {
  getCooldownTime,
  isCooldownActive,
  getCooldownMessage,
};
