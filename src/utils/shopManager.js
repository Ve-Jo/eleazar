import i18n from "../utils/i18n";
import EconomyEZ from "../utils/economy";

const upgrades = [
  {
    id: 0,
    emoji: "💰",
    name: "dailyBonus",
    short_description: "dailyBonusShortDescription",
    description: "dailyBonusDescription",
    price: 20,
    price_increaser: 1.5,
    multiplier_increase: 15,
  },
  {
    id: 1,
    emoji: "⏳",
    name: "crimeCooldown",
    short_description: "crimeCooldownShortDescription",
    description: "crimeCooldownDescription",
    price: 50,
    price_increaser: 1.2,
    multiplier_increase: 20,
  },
];

export function getUpgrades() {
  return upgrades;
}

export async function getUpgradesForUser(guildId, userId, locale) {
  const upgradePromises = upgrades.map(async (upgrade) => {
    const current_level =
      (await EconomyEZ.get(
        `shop.${guildId}.${userId}.upgrade_level.${upgrade.id}`
      )) || 1;
    const price = Math.round(
      upgrade.price * Math.pow(upgrade.price_increaser, current_level - 1)
    );
    const current_multiplier =
      upgrade.multiplier_increase * (current_level - 1);

    const balance = await EconomyEZ.get(`economy.${guildId}.${userId}.balance`);

    return {
      title: i18n.__(`economy.upgrades.${upgrade.name}.name`, {
        locale: locale,
      }),
      description: i18n.__(`economy.upgrades.${upgrade.name}.description`, {
        current_multiplier: current_multiplier,
        locale: locale,
      }),
      currentLevel: current_level,
      nextLevel: current_level + 1,
      price: price,
      progress: Math.min(100, Math.floor((balance / price) * 100)),
      emoji: upgrade.emoji,
      id: upgrade.id,
    };
  });

  return Promise.all(upgradePromises);
}
