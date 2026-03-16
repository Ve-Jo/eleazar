import { Prisma } from "@prisma/client";
import { UPGRADES } from "../constants/database.ts";

function calculateInterest(
  principal: number,
  annualRate: number,
  timeMs: number
): string {
  const msPerYear = 365 * 24 * 60 * 60 * 1000;
  const timeInYears = Number((timeMs / msPerYear).toFixed(10));

  if (timeInYears <= 0) {
    return Number(principal).toFixed(5);
  }

  const rate = annualRate / 100;
  const interest = principal * rate * timeInYears;
  return Number(principal + interest).toFixed(5);
}

function calculateInterestDecimal(
  principal: Prisma.Decimal,
  annualRate: Prisma.Decimal,
  timeMs: number | bigint | Prisma.Decimal
): Prisma.Decimal {
  const msPerYear = new Prisma.Decimal(365 * 24 * 60 * 60 * 1000);
  const normalizedTimeMs =
    typeof timeMs === "bigint" ? timeMs.toString() : timeMs;
  const timeInYears = new Prisma.Decimal(normalizedTimeMs).dividedBy(msPerYear);

  if (
    timeInYears.lessThan(new Prisma.Decimal(0)) ||
    timeInYears.equals(new Prisma.Decimal(0))
  ) {
    return principal;
  }

  const rate = annualRate.dividedBy(100);
  return principal.plus(principal.times(rate).times(timeInYears));
}

type UpgradeInfo = {
  type: string;
  level: number;
  price: number;
  effect: number;
  basePrice: number;
  priceMultiplier: number;
};

function getUpgradeInfo(type: string, level: number): UpgradeInfo {
  const upgrade = UPGRADES[type as keyof typeof UPGRADES];

  if (!upgrade) {
    throw new Error(`Invalid upgrade type: ${type}`);
  }

  const price = Math.floor(upgrade.basePrice * Math.pow(upgrade.priceMultiplier, level - 1));

  let effect: number;
  if ("effectMultiplier" in upgrade && upgrade.effectMultiplier !== undefined) {
    effect = 1 + (level - 1) * upgrade.effectMultiplier;
  } else if ("effectValue" in upgrade && upgrade.effectValue !== undefined) {
    effect = (level - 1) * upgrade.effectValue;
  } else {
    effect = level;
  }

  return {
    type,
    level,
    price,
    effect,
    basePrice: upgrade.basePrice,
    priceMultiplier: upgrade.priceMultiplier,
  };
}

export { calculateInterest, calculateInterestDecimal, getUpgradeInfo };
