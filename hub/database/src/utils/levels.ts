type LevelResult = {
  level: number;
  currentXP: number;
  requiredXP: number;
  totalXP: number;
};

type LevelUpResult = {
  oldLevel: number;
  newLevel: number;
  levelUp: true;
};

function calculateLevel(xp: number | bigint): LevelResult {
  const xpNumber = typeof xp === "bigint" ? Number(xp) : xp;

  console.log(`calculateLevel input XP: ${xpNumber}`);

  const level = Math.floor(Math.sqrt(xpNumber / 100)) + 1;
  const currentLevelXP = Math.pow(level - 1, 2) * 100;
  const nextLevelXP = Math.pow(level, 2) * 100;
  const actualLevel = xpNumber < 100 ? 1 : level;

  const result = {
    level: actualLevel,
    currentXP: xpNumber - currentLevelXP,
    requiredXP: nextLevelXP - currentLevelXP,
    totalXP: xpNumber,
  };

  console.log(`calculateLevel result: ${JSON.stringify(result)}`);

  return result;
}

function checkLevelUp(
  oldXp: number | bigint,
  newXp: number | bigint
): LevelUpResult | null {
  const oldXpNumber = typeof oldXp === "bigint" ? Number(oldXp) : oldXp;
  const newXpNumber = typeof newXp === "bigint" ? Number(newXp) : newXp;

  const oldLevelCalc = Math.floor(Math.sqrt(oldXpNumber / 100)) + 1;
  const oldLevel = oldXpNumber < 100 ? 1 : oldLevelCalc;
  const newLevelCalc = Math.floor(Math.sqrt(newXpNumber / 100)) + 1;
  const newLevel = newXpNumber < 100 ? 1 : newLevelCalc;

  console.log(
    `checkLevelUp: old XP ${oldXpNumber} (level ${oldLevel}), new XP ${newXpNumber} (level ${newLevel})`
  );

  if (newLevel > oldLevel) {
    return {
      oldLevel,
      newLevel,
      levelUp: true,
    };
  }

  return null;
}

export { calculateLevel, checkLevelUp };
