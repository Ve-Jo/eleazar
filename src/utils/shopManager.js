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
    emoji: "🕵️",
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
    return {
      ...upgrade,
      name: i18n.__({
        phrase: `economy.upgrades.${upgrade.name}.name`,
        locale,
      }),
      short_description: i18n.__({
        phrase: `economy.upgrades.${upgrade.name}.shortDescription`,
        locale,
      }),
      price:
        upgrade.price * Math.pow(upgrade.price_increaser, current_level - 1),
      description: i18n.__({
        phrase: `economy.upgrades.${upgrade.name}.description`,
        locale,
      }),
      current_level,
      current_multiplier: upgrade.multiplier_increase * (current_level - 1),
    };
  });

  return Promise.all(upgradePromises);
}
