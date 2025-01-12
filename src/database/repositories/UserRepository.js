import BaseRepository from "../BaseRepository.js";
import DatabaseConnection from "../connection.js";
import { DEFAULT_VALUES } from "../../utils/economy.js";

class UserRepository extends BaseRepository {
  constructor() {
    super("users");
  }

  // Utility Methods
  safeNumber(value, defaultValue = 0) {
    if (value === null || value === undefined) return defaultValue;
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  }

  validateUserData(data) {
    const numericFields = [
      "balance",
      "total_xp",
      "total_messages",
      "commands_used",
      "total_earned",
    ];
    for (const field of numericFields) {
      if (data[field] !== undefined && data[field] < 0) {
        throw new Error(`${field} cannot be negative`);
      }
    }
  }

  // Core Operations
  async getUserData(guildId, userId) {
    const query = `
      SELECT 
        u.*,
        ub.amount as bank_amount,
        ub.started_to_hold,
        ub.holding_percentage,
        uc.daily as daily_cooldown,
        uc.work as work_cooldown,
        uc.crime as crime_cooldown,
        uc.message as message_cooldown,
        json_agg(json_build_object(
          'upgradeType', uu.upgrade_type,
          'level', uu.level
        )) as upgrades
      FROM users u
      LEFT JOIN user_bank ub ON u.guild_id = ub.guild_id AND u.user_id = ub.user_id
      LEFT JOIN user_cooldowns uc ON u.guild_id = uc.guild_id AND u.user_id = uc.user_id
      LEFT JOIN user_upgrades uu ON u.guild_id = uu.guild_id AND u.user_id = uu.user_id
      WHERE u.guild_id = $1 AND u.user_id = $2
      GROUP BY u.guild_id, u.user_id, ub.amount, ub.started_to_hold, ub.holding_percentage,
               uc.daily, uc.work, uc.crime, uc.message
    `;

    try {
      const [userData] = await DatabaseConnection.query(query, [
        guildId,
        userId,
      ]);

      if (!userData) return null;

      return {
        balance: this.safeNumber(userData.balance),
        bank: {
          amount: this.safeNumber(userData.bank_amount),
          startedToHold: this.safeNumber(userData.started_to_hold, Date.now()),
          holdingPercentage: this.safeNumber(userData.holding_percentage),
        },
        totalXp: this.safeNumber(userData.total_xp),
        bannerUrl: userData.banner_url,
        latestActivity: this.safeNumber(userData.latest_activity, Date.now()),
        cooldowns: {
          daily: this.safeNumber(userData.daily_cooldown),
          work: this.safeNumber(userData.work_cooldown),
          crime: this.safeNumber(userData.crime_cooldown),
          message: this.safeNumber(userData.message_cooldown),
        },
        totalMessages: this.safeNumber(userData.total_messages),
        commandsUsed: this.safeNumber(userData.commands_used),
        totalEarned: this.safeNumber(userData.total_earned),
        upgrades: userData.upgrades?.filter(Boolean) || [],
      };
    } catch (error) {
      console.error("Error in getUserData:", error);
      throw error;
    }
  }

  async createUser(guildId, userId) {
    return await DatabaseConnection.transaction(async (client) => {
      try {
        // Create base user
        await client.query(
          `INSERT INTO users (
            guild_id, user_id, balance, total_xp, banner_url, 
            latest_activity, total_messages, commands_used, total_earned
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            guildId,
            userId,
            DEFAULT_VALUES.user.balance,
            DEFAULT_VALUES.user.totalXp,
            DEFAULT_VALUES.user.bannerUrl,
            Date.now(),
            DEFAULT_VALUES.user.totalMessages,
            DEFAULT_VALUES.user.commandsUsed,
            DEFAULT_VALUES.user.totalEarned,
          ]
        );

        // Initialize bank
        await client.query(
          `INSERT INTO user_bank (guild_id, user_id, amount, started_to_hold, holding_percentage)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            guildId,
            userId,
            DEFAULT_VALUES.bank.amount,
            0,
            DEFAULT_VALUES.bank.holdingPercentage,
          ]
        );

        // Initialize cooldowns
        await client.query(
          `INSERT INTO user_cooldowns (guild_id, user_id, daily, work, crime, message)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [guildId, userId, 0, 0, 0, 0]
        );

        // Initialize upgrades
        for (const [type, data] of Object.entries(DEFAULT_VALUES.upgrades)) {
          await client.query(
            `INSERT INTO user_upgrades (guild_id, user_id, upgrade_type, level)
             VALUES ($1, $2, $3, $4)`,
            [guildId, userId, type, data.level]
          );
        }

        return await this.getUserData(guildId, userId);
      } catch (error) {
        console.error("Error in createUser:", error);
        throw error;
      }
    });
  }

  async updateUserData(guildId, userId, data) {
    return await DatabaseConnection.transaction(async (client) => {
      try {
        this.validateUserData(data);

        if (data.balance !== undefined) {
          await client.query(
            `UPDATE users SET balance = $3 WHERE guild_id = $1 AND user_id = $2`,
            [guildId, userId, data.balance]
          );
        }

        if (data.bank) {
          const bankUpdates = [];
          const bankValues = [];
          let valueIndex = 3;

          if (data.bank.amount !== undefined) {
            bankUpdates.push(`amount = $${valueIndex}`);
            bankValues.push(data.bank.amount);
            valueIndex++;
          }
          if (data.bank.startedToHold !== undefined) {
            bankUpdates.push(`started_to_hold = $${valueIndex}`);
            bankValues.push(data.bank.startedToHold);
            valueIndex++;
          }
          if (data.bank.holdingPercentage !== undefined) {
            bankUpdates.push(`holding_percentage = $${valueIndex}`);
            bankValues.push(data.bank.holdingPercentage);
            valueIndex++;
          }

          if (bankUpdates.length > 0) {
            await client.query(
              `UPDATE user_bank 
               SET ${bankUpdates.join(", ")}
               WHERE guild_id = $1 AND user_id = $2`,
              [guildId, userId, ...bankValues]
            );
          }
        }

        // Always update latest activity
        await client.query(
          `UPDATE users SET latest_activity = $3 WHERE guild_id = $1 AND user_id = $2`,
          [guildId, userId, Date.now()]
        );

        return await this.getUserData(guildId, userId);
      } catch (error) {
        console.error("Error in updateUserData:", error);
        throw error;
      }
    });
  }

  async updateCooldown(guildId, userId, type, value) {
    try {
      await DatabaseConnection.query(
        `UPDATE user_cooldowns 
         SET ${type} = $3
         WHERE guild_id = $1 AND user_id = $2`,
        [guildId, userId, value]
      );
      return true;
    } catch (error) {
      console.error("Error in updateCooldown:", error);
      throw error;
    }
  }

  async getUpgrades(guildId, userId) {
    try {
      const result = await DatabaseConnection.query(
        `SELECT upgrade_type, level 
         FROM user_upgrades 
         WHERE guild_id = $1 AND user_id = $2`,
        [guildId, userId]
      );
      return result;
    } catch (error) {
      console.error("Error in getUpgrades:", error);
      throw error;
    }
  }
}

export default new UserRepository();
