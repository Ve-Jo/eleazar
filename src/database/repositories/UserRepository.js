import BaseRepository from "../BaseRepository.js";
import DatabaseConnection from "../connection.js";
import { DEFAULT_VALUES } from "../../utils/economy.js";
import GuildRepository from "./GuildRepository.js";

class UserRepository extends BaseRepository {
  constructor() {
    super("users");
  }

  // Utility method for data validation
  validateUserData(data) {
    if (data.balance !== undefined && data.balance < 0) {
      throw new Error("Balance cannot be negative");
    }
    if (data.total_xp !== undefined && data.total_xp < 0) {
      throw new Error("Total XP cannot be negative");
    }
    if (data.total_messages !== undefined && data.total_messages < 0) {
      throw new Error("Total messages cannot be negative");
    }
    if (data.commands_used !== undefined && data.commands_used < 0) {
      throw new Error("Commands used cannot be negative");
    }
    if (data.total_earned !== undefined && data.total_earned < 0) {
      throw new Error("Total earned cannot be negative");
    }
  }

  // Utility method for safe number conversion
  safeNumber(value, defaultValue = 0) {
    if (value === null || value === undefined) return defaultValue;
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  }

  async getUserData(guildId, userId) {
    const query = `
      SELECT u.*, ub.amount as bank_amount, ub.started_to_hold, ub.holding_percentage,
             uc.daily_timestamp, uc.work_timestamp, uc.crime_timestamp, uc.message_timestamp
      FROM users u
      LEFT JOIN user_bank ub ON u.guild_id = ub.guild_id AND u.user_id = ub.user_id
      LEFT JOIN user_cooldowns uc ON u.guild_id = uc.guild_id AND u.user_id = uc.user_id
      WHERE u.guild_id = $1 AND u.user_id = $2
    `;

    try {
      const [userData] = await DatabaseConnection.query(query, [
        guildId,
        userId,
      ]);

      if (!userData) {
        return DEFAULT_VALUES.guild.user;
      }

      const upgrades = await DatabaseConnection.query(
        `SELECT upgrade_type, level FROM user_upgrades 
         WHERE guild_id = $1 AND user_id = $2`,
        [guildId, userId]
      );

      const upgradesMap = {};
      for (const upgrade of upgrades) {
        upgradesMap[upgrade.upgrade_type] = {
          level: Math.max(1, this.safeNumber(upgrade.level, 1)),
        };
      }

      return {
        balance: this.safeNumber(userData.balance),
        bank: {
          amount: this.safeNumber(userData.bank_amount),
          started_to_hold: this.safeNumber(
            userData.started_to_hold,
            Date.now()
          ),
          holding_percentage: this.safeNumber(userData.holding_percentage),
        },
        total_xp: this.safeNumber(userData.total_xp),
        banner_url: userData.banner_url,
        latest_activity: this.safeNumber(userData.latest_activity, Date.now()),
        daily: this.safeNumber(userData.daily_timestamp),
        work: this.safeNumber(userData.work_timestamp),
        crime: this.safeNumber(userData.crime_timestamp),
        message: this.safeNumber(userData.message_timestamp),
        total_messages: this.safeNumber(userData.total_messages),
        commands_used: this.safeNumber(userData.commands_used),
        total_earned: this.safeNumber(userData.total_earned),
        upgrades: upgradesMap,
      };
    } catch (error) {
      console.error("Error in getUserData:", error);
      throw new Error(`Failed to get user data: ${error.message}`);
    }
  }

  async ensureUserExists(guildId, userId) {
    return await DatabaseConnection.transaction(async (client) => {
      try {
        // Ensure guild exists first
        await GuildRepository.upsert({ guild_id: guildId }, {});

        // Create user with default values
        const userData = {
          guild_id: guildId,
          user_id: userId,
          balance: DEFAULT_VALUES.guild.user.balance,
          total_xp: DEFAULT_VALUES.guild.user.total_xp,
          banner_url: DEFAULT_VALUES.guild.user.banner_url,
          latest_activity: Date.now(),
          total_messages: DEFAULT_VALUES.guild.user.total_messages,
          commands_used: DEFAULT_VALUES.guild.user.commands_used,
          total_earned: DEFAULT_VALUES.guild.user.total_earned,
        };

        await this.upsert({ guild_id: guildId, user_id: userId }, userData);

        // Initialize bank data with safe defaults
        await client.query(
          `INSERT INTO user_bank (guild_id, user_id, amount, started_to_hold, holding_percentage)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (guild_id, user_id) DO NOTHING`,
          [
            guildId,
            userId,
            DEFAULT_VALUES.guild.user.bank.amount,
            Date.now(),
            DEFAULT_VALUES.guild.user.bank.holding_percentage,
          ]
        );

        // Initialize cooldowns with safe defaults
        await client.query(
          `INSERT INTO user_cooldowns (guild_id, user_id, daily_timestamp, work_timestamp, crime_timestamp, message_timestamp)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (guild_id, user_id) DO NOTHING`,
          [guildId, userId, 0, 0, 0, 0]
        );

        // Initialize upgrades with safe defaults
        for (const [type, data] of Object.entries(
          DEFAULT_VALUES.guild.user.upgrades
        )) {
          await client.query(
            `INSERT INTO user_upgrades (guild_id, user_id, upgrade_type, level)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (guild_id, user_id, upgrade_type) DO NOTHING`,
            [guildId, userId, type, Math.max(1, data.level)]
          );
        }

        return await this.getUserData(guildId, userId);
      } catch (error) {
        console.error("Error in ensureUserExists:", error);
        throw new Error(`Failed to ensure user exists: ${error.message}`);
      }
    });
  }

  async updateUserData(guildId, userId, data) {
    await this.ensureUserExists(guildId, userId);

    return await DatabaseConnection.transaction(async (client) => {
      try {
        // Validate the update data
        this.validateUserData(data);

        // Get current user data
        const currentData = await this.getUserData(guildId, userId);

        // Handle simple field updates
        const simpleFields = [
          "balance",
          "total_xp",
          "banner_url",
          "latest_activity",
          "total_messages",
          "commands_used",
          "total_earned",
        ];

        const simpleUpdates = {};
        const complexUpdates = {};

        // Separate and validate updates
        Object.entries(data).forEach(([key, value]) => {
          if (simpleFields.includes(key)) {
            if (value !== undefined) {
              simpleUpdates[key] = this.safeNumber(value);
            }
          } else {
            complexUpdates[key] = value;
          }
        });

        // Update simple fields if any
        if (Object.keys(simpleUpdates).length > 0) {
          const setClause = Object.keys(simpleUpdates)
            .map((key, index) => `${key} = $${index + 3}`)
            .join(", ");

          await client.query(
            `UPDATE users 
             SET ${setClause}
             WHERE guild_id = $1 AND user_id = $2`,
            [guildId, userId, ...Object.values(simpleUpdates)]
          );
        }

        // Handle complex updates safely
        if (complexUpdates.bank) {
          await client.query(
            `UPDATE user_bank 
             SET amount = COALESCE($3, amount),
                 started_to_hold = COALESCE($4, started_to_hold),
                 holding_percentage = COALESCE($5, holding_percentage)
             WHERE guild_id = $1 AND user_id = $2`,
            [
              guildId,
              userId,
              this.safeNumber(complexUpdates.bank.amount),
              this.safeNumber(complexUpdates.bank.started_to_hold, Date.now()),
              this.safeNumber(complexUpdates.bank.holding_percentage),
            ]
          );
        }

        if (complexUpdates.upgrades) {
          for (const [type, upgradeData] of Object.entries(
            complexUpdates.upgrades
          )) {
            if (upgradeData.level !== undefined) {
              await client.query(
                `UPDATE user_upgrades 
                 SET level = $4
                 WHERE guild_id = $1 AND user_id = $2 AND upgrade_type = $3`,
                [
                  guildId,
                  userId,
                  type,
                  Math.max(1, this.safeNumber(upgradeData.level, 1)),
                ]
              );
            }
          }
        }

        // Return updated user data
        return await this.getUserData(guildId, userId);
      } catch (error) {
        console.error("Error in updateUserData:", error);
        throw new Error(`Failed to update user data: ${error.message}`);
      }
    });
  }

  async updateField(guildId, userId, field, value) {
    await this.ensureUserExists(guildId, userId);

    if (field === "bank") {
      return await DatabaseConnection.query(
        `UPDATE user_bank 
                 SET amount = $3,
                     started_to_hold = $4,
                     holding_percentage = $5
                 WHERE guild_id = $1 AND user_id = $2`,
        [
          guildId,
          userId,
          value.amount || 0,
          value.started_to_hold || Date.now(),
          value.holding_percentage || 0,
        ]
      );
    } else if (field.startsWith("upgrades.")) {
      const upgradeType = field.split(".")[1];
      return await DatabaseConnection.query(
        `UPDATE user_upgrades 
                 SET level = $4
                 WHERE guild_id = $1 AND user_id = $2 AND upgrade_type = $3`,
        [guildId, userId, upgradeType, value.level]
      );
    } else if (["daily", "work", "crime", "message"].includes(field)) {
      const timestampField = `${field}_timestamp`;
      return await DatabaseConnection.query(
        `UPDATE user_cooldowns 
                 SET ${timestampField} = $3
                 WHERE guild_id = $1 AND user_id = $2`,
        [guildId, userId, value]
      );
    } else {
      return await DatabaseConnection.query(
        `UPDATE users SET ${field} = $3
                 WHERE guild_id = $1 AND user_id = $2`,
        [guildId, userId, value]
      );
    }
  }

  async mathOperation(guildId, userId, field, operator, number) {
    await this.ensureUserExists(guildId, userId);

    if (field === "bank.amount") {
      await DatabaseConnection.query(
        `UPDATE user_bank 
                 SET amount = amount ${operator} $3
                 WHERE guild_id = $1 AND user_id = $2`,
        [guildId, userId, number]
      );

      const result = await DatabaseConnection.query(
        `SELECT amount FROM user_bank WHERE guild_id = $1 AND user_id = $2`,
        [guildId, userId]
      );
      return result[0].amount;
    } else {
      await DatabaseConnection.query(
        `UPDATE users 
                 SET ${field} = COALESCE(${field}, 0) ${operator} $3
                 WHERE guild_id = $1 AND user_id = $2`,
        [guildId, userId, number]
      );

      const result = await DatabaseConnection.query(
        `SELECT ${field} FROM users WHERE guild_id = $1 AND user_id = $2`,
        [guildId, userId]
      );
      return result[0][field];
    }
  }
}

export default new UserRepository();
