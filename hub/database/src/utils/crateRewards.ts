import { CRATE_TYPES } from "../constants/database.ts";

type CrateRecord = {
  count?: number;
};

type CrateReward = {
  type: string;
  coins: number;
  seasonXp: number;
  discount: number;
};

type CrateRewardGenerationOptions = {
  coinMultiplier?: number;
};

type CrateRewardClient = {
  crate: {
    findUnique: (args: unknown) => Promise<unknown>;
  };
  $transaction: <T>(callback: (tx: unknown) => Promise<T>) => Promise<T>;
};

type GetCrateCooldownFn = (
  guildId: string,
  userId: string,
  type: string
) => Promise<number | null>;

type UpdateCrateCooldownFn = (
  guildId: string,
  userId: string,
  type: string
) => Promise<unknown>;

type RemoveCrateFn = (
  guildId: string,
  userId: string,
  type: string,
  amount: number
) => Promise<unknown>;

type GenerateCrateRewardsFn = (
  guildId: string,
  userId: string,
  type: string
) => Promise<CrateReward>;

type ProcessCrateRewardsFn = (
  guildId: string,
  userId: string,
  rewards: CrateReward
) => Promise<unknown>;

type AddBalanceFn = (
  guildId: string,
  userId: string,
  amount: number
) => Promise<unknown>;

type AddUpgradeDiscountFn = (
  guildId: string,
  userId: string,
  discount: number
) => Promise<unknown>;

type AddSeasonXpFn = (
  guildId: string,
  userId: string,
  amount: number
) => Promise<unknown>;

async function openCrate(
  client: CrateRewardClient,
  getCooldown: GetCrateCooldownFn,
  updateCrateCooldown: UpdateCrateCooldownFn,
  removeCrate: RemoveCrateFn,
  generateCrateRewards: GenerateCrateRewardsFn,
  processCrateRewards: ProcessCrateRewardsFn,
  guildId: string,
  userId: string,
  type: string
): Promise<CrateReward> {
  const crate = (await client.crate.findUnique({
    where: {
      guildId_userId_type: {
        guildId,
        userId,
        type,
      },
    },
  })) as CrateRecord | null;

  if (["daily", "weekly"].includes(type)) {
    const remainingCooldown = Number(
      await getCooldown(guildId, userId, `crate_${type}`)
    );

    if (remainingCooldown > 0) {
      throw new Error(`Cooldown active: ${remainingCooldown}`);
    }

    await updateCrateCooldown(guildId, userId, type);
  } else {
    if (!crate || (crate.count ?? 0) <= 0) {
      throw new Error("No crates available");
    }

    await removeCrate(guildId, userId, type, 1);
  }

  const rewards = await generateCrateRewards(guildId, userId, type);
  await processCrateRewards(guildId, userId, rewards);

  return rewards;
}

async function generateCrateRewards(
  _guildId: string,
  _userId: string,
  type: string,
  options: CrateRewardGenerationOptions = {}
): Promise<CrateReward> {
  const crateConfig = CRATE_TYPES[type as keyof typeof CRATE_TYPES];
  if (!crateConfig) {
    throw new Error(`Unknown crate type: ${type}`);
  }

  const rewards: CrateReward = {
    type,
    coins: 0,
    seasonXp: 0,
    discount: 0,
  };

  const coinMultiplier = Math.max(
    0.1,
    Number.isFinite(Number(options.coinMultiplier))
      ? Number(options.coinMultiplier)
      : 1
  );
  const scaledMinCoins = Math.max(
    1,
    Math.floor(crateConfig.rewards.min_coins * coinMultiplier)
  );
  const scaledMaxCoins = Math.max(
    scaledMinCoins,
    Math.floor(crateConfig.rewards.max_coins * coinMultiplier)
  );

  rewards.coins = Math.floor(
    Math.random() *
      (scaledMaxCoins - scaledMinCoins + 1) +
      scaledMinCoins
  );

  if (Math.random() < crateConfig.rewards.seasonXp_chance) {
    rewards.seasonXp = crateConfig.rewards.seasonXp_amount;
  }

  const discountRoll = Math.random();
  console.log(
    `Discount roll: ${discountRoll}, chance: ${crateConfig.rewards.discount_chance}`
  );
  if (discountRoll < crateConfig.rewards.discount_chance) {
    rewards.discount = crateConfig.rewards.discount_amount;
    console.log(`Discount awarded: ${rewards.discount}%`);
  } else {
    console.log("No discount awarded");
  }

  return rewards;
}

async function processCrateRewards(
  client: CrateRewardClient,
  addBalance: AddBalanceFn,
  addUpgradeDiscount: AddUpgradeDiscountFn,
  addSeasonXp: AddSeasonXpFn,
  guildId: string,
  userId: string,
  rewards: CrateReward
): Promise<CrateReward> {
  await client.$transaction(async () => {
    if (rewards.coins > 0) {
      await addBalance(guildId, userId, rewards.coins);
    }

    if (rewards.discount > 0) {
      await addUpgradeDiscount(guildId, userId, rewards.discount);
    }

    if (rewards.seasonXp > 0) {
      await addSeasonXp(guildId, userId, rewards.seasonXp);
    }
  });

  return rewards;
}

export { openCrate, generateCrateRewards, processCrateRewards };
