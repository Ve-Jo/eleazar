class LevelsManager {
  static defaultConfig = {
    xpPerMessage: 1,
    messageCooldown: 60, // in seconds
    levelMultiplier: 100,
  };

  static calculateLevel(
    totalXp,
    multiplier = this.defaultConfig.levelMultiplier
  ) {
    // Start from level 1
    let level = 1;
    let xpForNextLevel = multiplier; // Initial XP needed
    let remainingXp = totalXp;
    let totalXpForCurrentLevel = 0;

    // Keep calculating until we don't have enough XP for next level
    while (remainingXp >= xpForNextLevel) {
      remainingXp -= xpForNextLevel;
      totalXpForCurrentLevel += xpForNextLevel;
      level++;
      xpForNextLevel = level * multiplier;
    }

    return {
      level,
      currentXP: totalXp, // Total XP as current
      requiredXP: totalXpForCurrentLevel + xpForNextLevel, // Total XP needed for next level
      totalXP: totalXp,
    };
  }

  static getTotalXPForLevel(
    level,
    multiplier = this.defaultConfig.levelMultiplier
  ) {
    let totalXP = 0;
    for (let i = 1; i < level; i++) {
      totalXP += i * multiplier;
    }
    return totalXP;
  }

  static getXPForMessage(guildConfig = null) {
    return guildConfig?.xp_per_message ?? this.defaultConfig.xpPerMessage;
  }

  static getMessageCooldown(guildConfig = null) {
    const cooldown =
      guildConfig?.xp_per_message_cooldown ??
      this.defaultConfig.messageCooldown;
    return cooldown * 1000; // Convert to milliseconds
  }

  static getLevelMultiplier(guildConfig = null) {
    return (
      guildConfig?.level_xp_multiplier ?? this.defaultConfig.levelMultiplier
    );
  }

  static getConfig(guildConfig = null) {
    return {
      xpPerMessage: this.getXPForMessage(guildConfig),
      messageCooldown: this.getMessageCooldown(guildConfig),
      levelMultiplier: this.getLevelMultiplier(guildConfig),
    };
  }
}

export default LevelsManager;
