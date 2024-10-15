import mysql from "mysql2/promise";
import { escape } from "mysql2";

let validTables = [];
let pool;

function createPool() {
  return mysql.createPool({
    uri: process.env.MYSQL_DATABASE,
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0,
    namedPlaceholders: true,
    multipleStatements: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });
}

async function getConnection() {
  if (!pool) {
    pool = createPool();
  }

  try {
    const connection = await pool.getConnection();
    return connection;
  } catch (error) {
    if (error.code === "PROTOCOL_CONNECTION_LOST") {
      console.log("Database connection was closed. Attempting to reconnect...");
      pool = createPool();
      return getConnection();
    }
    throw error;
  }
}

class EconomyEZ {
  static async initializeTables() {
    const tables = [
      {
        name: "economy",
        query: `CREATE TABLE IF NOT EXISTS economy (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(255) NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          latest_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          balance INT NOT NULL DEFAULT 0,
          bank INT NOT NULL DEFAULT 0,
          xp INT NOT NULL DEFAULT 0,
          total_xp INT NOT NULL DEFAULT 0,
          level INT NOT NULL DEFAULT 1,
          UNIQUE KEY guild_user (guild_id, user_id)
        )`,
        columns: [
          "latest_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
          "balance INT NOT NULL DEFAULT 0",
          "bank INT NOT NULL DEFAULT 0",
          "xp INT NOT NULL DEFAULT 0",
          "total_xp INT NOT NULL DEFAULT 0",
          "level INT NOT NULL DEFAULT 1",
        ],
      },
      {
        name: "timestamps",
        query: `CREATE TABLE IF NOT EXISTS timestamps (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(255) NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          daily BIGINT DEFAULT 0,
          work BIGINT DEFAULT 0,
          crime BIGINT DEFAULT 0,
          message BIGINT DEFAULT 0,
          UNIQUE KEY guild_user (guild_id, user_id)
        )`,
        columns: [
          "daily BIGINT DEFAULT 0",
          "work BIGINT DEFAULT 0",
          "crime BIGINT DEFAULT 0",
          "message BIGINT DEFAULT 0",
        ],
      },
      {
        name: "shop",
        query: `CREATE TABLE IF NOT EXISTS shop (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(255) NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          upgrade_id INT NOT NULL,
          upgrade_level INT NOT NULL DEFAULT 1,
          UNIQUE KEY guild_user (guild_id, user_id)
        )`,
        columns: [
          "upgrade_id INT NOT NULL",
          "upgrade_level INT NOT NULL DEFAULT 1",
        ],
      },
      {
        name: "config",
        query: `CREATE TABLE IF NOT EXISTS config (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(255) NOT NULL UNIQUE,
          xp_per_message INT NOT NULL DEFAULT 1,
          xp_per_message_cooldown INT NOT NULL DEFAULT 60,
          level_xp_multiplier INT NOT NULL DEFAULT 100
        )`,
        columns: [
          "xp_per_message INT NOT NULL DEFAULT 1",
          "xp_per_message_cooldown INT NOT NULL DEFAULT 60",
          "level_xp_multiplier INT NOT NULL DEFAULT 100",
        ],
      },
      {
        name: "stats",
        query: `CREATE TABLE IF NOT EXISTS stats (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL UNIQUE,
          guild_id VARCHAR(255) NOT NULL,
          total_messages INT NOT NULL DEFAULT 0,
          commands_used INT NOT NULL DEFAULT 0,
          total_earned INT NOT NULL DEFAULT 0
        )`,
        columns: [
          "total_messages INT NOT NULL DEFAULT 0",
          "commands_used INT NOT NULL DEFAULT 0",
          "total_earned INT NOT NULL DEFAULT 0",
        ],
      },
      {
        name: "counting",
        query: `CREATE TABLE IF NOT EXISTS counting (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(255) NOT NULL UNIQUE,
          channel_id VARCHAR(255) NOT NULL,
          message INT NOT NULL DEFAULT 1,
          pinoneach INT NOT NULL DEFAULT 0,
          pinnedrole VARCHAR(255) NOT NULL DEFAULT '0',
          only_numbers BOOLEAN NOT NULL DEFAULT FALSE,
          lastpinnedmember VARCHAR(255) NOT NULL DEFAULT '0',
          no_same_user BOOLEAN NOT NULL DEFAULT FALSE,
          no_unique_role BOOLEAN NOT NULL DEFAULT FALSE,
          lastwritter VARCHAR(255) NOT NULL DEFAULT '0'
        )`,
        columns: [
          "channel_id VARCHAR(255) NOT NULL",
          "message INT NOT NULL DEFAULT 1",
          "pinoneach INT NOT NULL DEFAULT 0",
          "pinnedrole VARCHAR(255) NOT NULL DEFAULT '0'",
          "lastpinnedmember VARCHAR(255) NOT NULL DEFAULT '0'",
          "only_numbers BOOLEAN NOT NULL DEFAULT FALSE",
          "no_same_user BOOLEAN NOT NULL DEFAULT FALSE",
          "no_unique_role BOOLEAN NOT NULL DEFAULT FALSE",
          "lastwritter VARCHAR(255) NOT NULL DEFAULT '0'",
        ],
      },
    ];

    /*const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const table of tables) {
        await connection.execute(table.query);
        console.log(`Created ${table.name} table`);

        // Get existing columns
        const [existingColumns] = await connection.execute(
          `SHOW COLUMNS FROM ${table.name}`
        );
        const existingColumnMap = new Map(
          existingColumns.map((col) => [col.Field, col])
        );

        // Add missing columns and update existing ones
        for (const column of table.columns) {
          const [columnName, ...columnDef] = column.split(" ");
          const columnDefinition = columnDef.join(" ");

          if (existingColumnMap.has(columnName)) {
            // Column exists, check if it needs to be modified
            const existingColumn = existingColumnMap.get(columnName);
            const existingType = `${existingColumn.Type}${
              existingColumn.Null === "YES" ? "" : " NOT NULL"
            }${
              existingColumn.Default ? ` DEFAULT ${existingColumn.Default}` : ""
            }`;

            if (existingType.toLowerCase() !== columnDefinition.toLowerCase()) {
              try {
                await connection.execute(`
                  ALTER TABLE ${table.name} 
                  MODIFY COLUMN ${columnName} ${columnDefinition}
                `);
                console.log(`Modified column ${columnName} in ${table.name}`);
              } catch (error) {
                console.error(
                  `Error modifying column ${columnName} in ${table.name}:`,
                  error
                );
              }
            }
          } else {
            // Column doesn't exist, add it
            try {
              await connection.execute(`
                ALTER TABLE ${table.name} 
                ADD COLUMN ${columnName} ${columnDefinition}
              `);
              console.log(`Added column ${columnName} to ${table.name}`);
            } catch (error) {
              console.error(
                `Error adding column ${columnName} to ${table.name}:`,
                error
              );
            }
          }
        }

        // Delete columns not in the definition
        const definedColumnNames = table.columns.map(
          (col) => col.split(" ")[0]
        );
        const columnsToDelete = Array.from(existingColumnMap.keys()).filter(
          (col) =>
            !definedColumnNames.includes(col) &&
            col !== "id" &&
            col !== "guild_id" &&
            col !== "user_id"
        );

        for (const columnToDelete of columnsToDelete) {
          try {
            await connection.execute(`
              ALTER TABLE ${table.name}
              DROP COLUMN ${columnToDelete}
            `);
            console.log(`Deleted column ${columnToDelete} from ${table.name}`);
          } catch (error) {
            console.error(
              `Error deleting column ${columnToDelete} from ${table.name}:`,
              error
            );
          }
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error("Error initializing tables:", error);
    } finally {
      connection.release();
    }*/
  }

  static async testDatabaseConnection() {
    try {
      await this.executeQuery("SELECT 1");
      await initializeDatabase();
      console.log("Successfully connected to the database");
    } catch (error) {
      console.error("Failed to connect to the database:", error);
    }
  }

  static async enableWALMode() {
    try {
      await pool.execute("SET GLOBAL innodb_flush_log_at_trx_commit = 2");
      await pool.execute("SET GLOBAL innodb_flush_method = O_DIRECT");
      console.log("WAL mode enabled successfully");
    } catch (error) {
      console.error("Failed to enable WAL mode:", error);
    }
  }

  static async get(path) {
    console.log(`get for: ${path}`);

    const parts = path.split(".");
    let [table, guildId, userId, field, upgradeId] = parts;

    if (!table || !(await this.isValidTable(table))) {
      throw new Error(`Invalid or missing table: ${table}`);
    }

    // Check if userId is actually a field
    if (userId && isNaN(userId)) {
      field = userId;
      userId = undefined;
    }

    if (!userId) {
      // Get all guild data
      const result = await this.executeQuery(
        `SELECT * FROM ${table} WHERE guild_id = ?`,
        [guildId]
      );
      return field ? result[0]?.[field] || null : result;
    }

    await this.ensure(path);

    const result = await this.executeQuery(
      `SELECT * FROM ${table} WHERE guild_id = ? AND user_id = ?`,
      [guildId, userId]
    );
    const userData = result[0] || {}; // Return an empty object if no data found

    // If upgradeId is provided, get the specific upgrade level
    if (upgradeId && table === "shop") {
      const upgradeResult = await this.executeQuery(
        `SELECT upgrade_level FROM ${table} WHERE guild_id = ? AND user_id = ? AND upgrade_id = ?`,
        [guildId, userId, upgradeId]
      );
      return upgradeResult[0]?.upgrade_level || 1; // Default to level 1 if not found
    }

    return field ? userData[field] || null : userData;
  }

  static async set(path, value) {
    const parts = path.split(".");
    let [table, guildId, userId, field] = parts;

    if (!table || !(await this.isValidTable(table))) {
      throw new Error(`Invalid or missing table: ${table}`);
    }

    // Check if userId is actually a field
    if (userId && isNaN(userId)) {
      field = userId;
      userId = undefined;
    }

    if (!userId) {
      // Set guild-specific data
      if (typeof value === "object" && value !== null) {
        const setClause = Object.keys(value)
          .map((key) => `${key} = ?`)
          .join(", ");
        const values = Object.values(value);
        await this.executeQuery(
          `UPDATE ${table} SET ${setClause} WHERE guild_id = ?`,
          [...values, guildId]
        );
      } else {
        await this.executeQuery(
          `UPDATE ${table} SET ${field} = ? WHERE guild_id = ?`,
          [value, guildId]
        );
      }
      return;
    }

    if (typeof value === "object" && value !== null) {
      await this.updateMultipleFields(table, guildId, userId, value);
    } else {
      await this.executeQuery(
        `INSERT INTO ${table} (guild_id, user_id, ${field}) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE ${field} = VALUES(${field})`,
        [guildId, userId, value]
      );
    }
  }

  static async updateMultipleFields(table, guildId, userId, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const placeholders = fields.map(() => "?").join(", ");
    const updateClauses = fields
      .map((field) => `${field} = VALUES(${field})`)
      .join(", ");

    await this.executeQuery(
      `INSERT INTO ${table} (guild_id, user_id, ${fields.join(", ")})
       VALUES (?, ?, ${placeholders})
       ON DUPLICATE KEY UPDATE ${updateClauses}`,
      [guildId, userId, ...values]
    );
  }

  static async remove(path) {
    const parts = path.split(".");
    let [table, guildId, userId, field] = parts;

    if (!table || !(await this.isValidTable(table))) {
      throw new Error(`Invalid or missing table: ${table}`);
    }

    // Check if userId is actually a field
    if (userId && isNaN(userId)) {
      field = userId;
      userId = undefined;
    }

    if (!userId) {
      // Remove guild-specific data
      if (field) {
        await this.executeQuery(
          `UPDATE ${table} SET ${field} = NULL WHERE guild_id = ?`,
          [guildId]
        );
      } else {
        await this.executeQuery(`DELETE FROM ${table} WHERE guild_id = ?`, [
          guildId,
        ]);
      }
    } else {
      // Remove user-specific data
      await this.executeQuery(
        `DELETE FROM ${table} WHERE guild_id = ? AND user_id = ?`,
        [guildId, userId]
      );
    }
  }

  static async ensure(path) {
    console.log(`ensure for: ${path}`);

    const parts = path.split(".");
    let [table, guildId, userId] = parts;

    if (!table || !(await this.isValidTable(table))) {
      throw new Error(`Invalid or missing table: ${table}`);
    }

    if (!userId) {
      await this.executeQuery(
        `INSERT IGNORE INTO ${table} (guild_id) VALUES (?)`,
        [guildId]
      );
    } else {
      await this.executeQuery(
        `INSERT IGNORE INTO ${table} (guild_id, user_id) VALUES (?, ?)`,
        [guildId, userId]
      );
    }
  }

  static async getTableForField(field) {
    const tables = await this.isValidTable();
    for (const table of tables) {
      const [columns] = await this.executeQuery(`SHOW COLUMNS FROM ${table}`);
      if (columns.some((col) => col.Field === field)) {
        return table;
      }
    }
    throw new Error(`Unknown field: ${field}`);
  }

  static async isValidTable(table) {
    if (validTables.length === 0) {
      try {
        const result = await this.executeQuery(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = DATABASE()
        `);

        if (Array.isArray(result)) {
          validTables = result.map((row) => row.TABLE_NAME.toLowerCase());
        } else {
          console.error(
            "Unexpected result format from database query:",
            result
          );
          validTables = [];
        }
      } catch (error) {
        console.error("Error fetching valid tables:", error);
        validTables = [];
      }
    }

    if (!table) {
      return validTables;
    }
    return validTables.includes(table.toLowerCase());
  }

  static async math(path, operator, number) {
    const parts = path.split(".");
    const [table, guildId, userId, field] = parts;

    if (!table || !(await this.isValidTable(table))) {
      throw new Error(`Invalid or missing table: ${table}`);
    }

    let currentValue = await this.get(path);

    // Initialize the value to 0 if it doesn't exist
    if (currentValue === null || currentValue === undefined) {
      currentValue = 0;
      await this.set(path, 0);
    }

    if (typeof currentValue !== "number" || isNaN(currentValue)) {
      throw new Error(
        `Invalid current value for field ${field}: ${currentValue}`
      );
    }

    if (typeof number !== "number" || isNaN(number)) {
      throw new Error(`Invalid number for operation: ${number}`);
    }

    let newValue;
    switch (operator) {
      case "+":
        newValue = currentValue + number;
        break;
      case "-":
        newValue = currentValue - number;
        break;
      case "*":
        newValue = currentValue * number;
        break;
      case "/":
        if (number === 0) {
          throw new Error("Division by zero");
        }
        newValue = currentValue / number;
        break;
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }

    if (isNaN(newValue) || !isFinite(newValue)) {
      throw new Error(`Operation resulted in an invalid value: ${newValue}`);
    }

    await this.executeQuery(
      `UPDATE ${table} SET ${field} = ? WHERE guild_id = ? AND user_id = ?`,
      [newValue, guildId, userId]
    );

    return newValue;
  }

  // Add this new method for batch operations
  static async batchOperation(operations) {
    const connection = await getConnection();
    try {
      await connection.beginTransaction();

      for (const op of operations) {
        const { type, path, value } = op;
        const [table, guildId, userId, field] = path.split(".");

        if (type === "set") {
          if (typeof value === "object") {
            const setClause = Object.keys(value)
              .map((key) => `${key} = ?`)
              .join(", ");
            const values = Object.values(value);
            await connection.execute(
              `INSERT INTO ${table} (guild_id, user_id, ${Object.keys(
                value
              ).join(", ")}) 
               VALUES (?, ?, ${values.map(() => "?").join(", ")})
               ON DUPLICATE KEY UPDATE ${setClause}`,
              [guildId, userId, ...values, ...values]
            );
          } else {
            await connection.execute(
              `INSERT INTO ${table} (guild_id, user_id, ${field}) 
               VALUES (?, ?, ?)
               ON DUPLICATE KEY UPDATE ${field} = VALUES(${field})`,
              [guildId, userId, value]
            );
          }
        }
        // Add other operation types as needed
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async executeQuery(query, params = []) {
    let connection;
    try {
      connection = await getConnection();
      const [results] = await connection.execute(query, params);
      return results;
    } catch (error) {
      console.error("Error executing query:", error);
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
}

// Move this function outside of the class
async function initializeDatabase() {
  await EconomyEZ.initializeTables();
  await EconomyEZ.enableWALMode();
  console.log("Successfully connected to the database");
}

export default EconomyEZ;
export { getConnection, initializeDatabase };
