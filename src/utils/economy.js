import { Pool } from "pg";

let pool;

async function createConnection() {
  try {
    // First, try to connect to the local database
    pool = new Pool({
      connectionString: process.env.PG_DATABASE_URL_LOCAL,
    });
    await pool.query("SELECT 1");
    console.log("Connected to local database successfully");
  } catch (localError) {
    console.log(
      "Failed to connect to local database, falling back to public URL"
    );
    try {
      // If local connection fails, try the public URL
      pool = new Pool({
        connectionString: process.env.PG_DATABASE_URL,
      });
      await pool.query("SELECT 1");
      console.log("Connected to public database successfully");
    } catch (publicError) {
      console.error("Failed to connect to both local and public databases");
      throw publicError;
    }
  }
  return pool;
}

let validTables = [];

class EconomyEZ {
  static async executeQuery(query, params = []) {
    if (!pool) {
      await createConnection();
    }
    try {
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error("Error executing query:", error);
      throw error;
    }
  }

  static async initializeTables() {
    const tables = [
      {
        name: "economy",
        query: `CREATE TABLE IF NOT EXISTS economy (
          id SERIAL PRIMARY KEY,
          guild_id VARCHAR(255) NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          latest_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          balance INT NOT NULL DEFAULT 0,
          bank INT NOT NULL DEFAULT 0,
          xp INT NOT NULL DEFAULT 0,
          total_xp INT NOT NULL DEFAULT 0,
          level INT NOT NULL DEFAULT 1,
          UNIQUE (guild_id, user_id)
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
          id SERIAL PRIMARY KEY,
          guild_id VARCHAR(255) NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          daily BIGINT DEFAULT 0,
          work BIGINT DEFAULT 0,
          crime BIGINT DEFAULT 0,
          message BIGINT DEFAULT 0,
          UNIQUE (guild_id, user_id)
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
          id SERIAL PRIMARY KEY,
          guild_id VARCHAR(255) NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          upgrade_id INT NOT NULL,
          upgrade_level INT NOT NULL DEFAULT 1,
          UNIQUE (guild_id, user_id, upgrade_id)
        )`,
        columns: [
          "upgrade_id INT NOT NULL",
          "upgrade_level INT NOT NULL DEFAULT 1",
        ],
      },
      {
        name: "config",
        query: `CREATE TABLE IF NOT EXISTS config (
          id SERIAL PRIMARY KEY,
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
          id SERIAL PRIMARY KEY,
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
          id SERIAL PRIMARY KEY,
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
      {
        name: "economy_config",
        query: `CREATE TABLE IF NOT EXISTS economy_config (
          id SERIAL PRIMARY KEY,
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
    ];

    const client = await pool.connect();
    /*try {
      await client.query("BEGIN");

      for (const table of tables) {
        await client.query(table.query);
        console.log(`Created ${table.name} table`);

        // Get existing columns
        const res = await client.query(
          `SELECT column_name, data_type, is_nullable, column_default 
                                        FROM information_schema.columns 
                                        WHERE table_name = $1`,
          [table.name.toLowerCase()]
        );
        const existingColumns = res.rows;
        const existingColumnMap = new Map(
          existingColumns.map((col) => [col.column_name, col])
        );

        // Add missing columns and update existing ones
        for (const column of table.columns) {
          const [columnName, ...columnDef] = column.split(" ");
          const columnDefinition = columnDef.join(" ");

          if (existingColumnMap.has(columnName)) {
            // Column exists, check if it needs to be modified
            const existingColumn = existingColumnMap.get(columnName);
            let existingType = existingColumn.data_type.toUpperCase();

            if (existingColumn.is_nullable === "NO") {
              existingType += " NOT NULL";
            }
            if (existingColumn.column_default) {
              existingType += ` DEFAULT ${existingColumn.column_default}`;
            }

            if (existingType.toLowerCase() !== columnDefinition.toLowerCase()) {
              try {
                await client.query(`ALTER TABLE ${table.name} 
                                     ALTER COLUMN ${columnName} TYPE ${
                  columnDefinition.split(" ")[0]
                } USING ${columnName}::${columnDefinition.split(" ")[0]}`);
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
              await client.query(`ALTER TABLE ${table.name} 
                                   ADD COLUMN ${columnName} ${columnDefinition}`);
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
        const definedColumnNames = table.columns.map((col) =>
          col.split(" ")[0].toLowerCase()
        );
        const columnsToDelete = Array.from(existingColumnMap.keys()).filter(
          (col) =>
            !definedColumnNames.includes(col.toLowerCase()) &&
            col !== "id" &&
            col !== "guild_id" &&
            col !== "user_id"
        );

        for (const columnToDelete of columnsToDelete) {
          try {
            await client.query(`ALTER TABLE ${table.name}
                                 DROP COLUMN ${columnToDelete}`);
            console.log(`Deleted column ${columnToDelete} from ${table.name}`);
          } catch (error) {
            console.error(
              `Error deleting column ${columnToDelete} from ${table.name}:`,
              error
            );
          }
        }
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error initializing tables:", error);
    } finally {
      client.release();
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
      await this.executeQuery("SET synchronous_commit TO OFF");
      await this.executeQuery("SET work_mem = '64MB'");
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
        `SELECT * FROM ${table} WHERE guild_id = $1`,
        [guildId]
      );
      return field ? result[0]?.[field] || null : result;
    }

    await this.ensure(path);

    if (table === "shop") {
      if (!upgradeId) {
        console.warn(
          "Warning: upgrade_id is missing for shop table. Returning all upgrades for the user."
        );
        const result = await this.executeQuery(
          `SELECT * FROM ${table} WHERE guild_id = $1 AND user_id = $2`,
          [guildId, userId]
        );
        return field ? result.map((row) => row[field]) : result;
      }
      const result = await this.executeQuery(
        `SELECT * FROM ${table} WHERE guild_id = $1 AND user_id = $2 AND upgrade_id = $3`,
        [guildId, userId, upgradeId]
      );
      return field ? result[0]?.[field] || null : result[0] || null;
    } else {
      const result = await this.executeQuery(
        `SELECT * FROM ${table} WHERE guild_id = $1 AND user_id = $2`,
        [guildId, userId]
      );
      const userData = result[0] || {}; // Return an empty object if no data found
      return field ? userData[field] || null : userData;
    }
  }

  static async set(path, value) {
    const parts = path.split(".");
    let [table, guildId, userId, field, upgradeId] = parts;

    if (!table || !(await this.isValidTable(table))) {
      throw new Error(`Invalid or missing table: ${table}`);
    }

    if (table === "shop") {
      if (!upgradeId) {
        throw new Error("Missing upgrade_id for shop table");
      }
      await this.executeQuery(
        `INSERT INTO ${table} (guild_id, user_id, upgrade_id, upgrade_level)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (guild_id, user_id, upgrade_id)
         DO UPDATE SET upgrade_level = $4`,
        [guildId, userId, upgradeId, value]
      );
    } else {
      // Existing code for other tables
      if (typeof value === "object" && value !== null) {
        await this.updateMultipleFields(table, guildId, userId, value);
      } else {
        // Convert to bigint if the value is a large number
        if (typeof value === "number" && value > Number.MAX_SAFE_INTEGER) {
          value = BigInt(value);
        }
        await this.executeQuery(
          `INSERT INTO ${table} (guild_id, user_id, ${field}) 
           VALUES ($1, $2, $3)
           ON CONFLICT (guild_id, user_id) 
           DO UPDATE SET ${field} = $3`,
          [guildId, userId, value]
        );
      }
    }
  }

  static async updateMultipleFields(table, guildId, userId, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields
      .map((field, index) => `${field} = $${index + 3}`)
      .join(", ");

    await this.executeQuery(
      `INSERT INTO ${table} (guild_id, user_id, ${fields.join(", ")})
       VALUES ($1, $2, ${fields.map((_, i) => `$${i + 3}`).join(", ")})
       ON CONFLICT (guild_id, user_id)
       DO UPDATE SET ${setClause}`,
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
          `UPDATE ${table} SET ${field} = NULL WHERE guild_id = $1`,
          [guildId]
        );
      } else {
        await this.executeQuery(`DELETE FROM ${table} WHERE guild_id = $1`, [
          guildId,
        ]);
      }
    } else {
      // Remove user-specific data
      await this.executeQuery(
        `DELETE FROM ${table} WHERE guild_id = $1 AND user_id = $2`,
        [guildId, userId]
      );
    }
  }

  static async ensure(path) {
    console.log(`ensure for: ${path}`);

    const parts = path.split(".");
    let [table, guildId, userId, field, upgradeId] = parts;

    if (!table || !(await this.isValidTable(table))) {
      throw new Error(`Invalid or missing table: ${table}`);
    }

    if (table === "shop") {
      if (!upgradeId) {
        console.warn(
          "Warning: upgrade_id is missing for shop table. Using default value of 1."
        );
        upgradeId = 1; // Set a default value
      }
      await this.executeQuery(
        `INSERT INTO ${table} (guild_id, user_id, upgrade_id, upgrade_level) 
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (guild_id, user_id, upgrade_id) DO NOTHING`,
        [guildId, userId, upgradeId]
      );
    } else if (!userId) {
      await this.executeQuery(
        `INSERT INTO ${table} (guild_id) VALUES ($1)
         ON CONFLICT (guild_id) DO NOTHING`,
        [guildId]
      );
    } else {
      await this.executeQuery(
        `INSERT INTO ${table} (guild_id, user_id) VALUES ($1, $2)
         ON CONFLICT (guild_id, user_id) DO NOTHING`,
        [guildId, userId]
      );
    }
  }

  static async getTableForField(field) {
    const tables = await this.isValidTable();
    for (const table of tables) {
      const columns = await this.executeQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
        [table]
      );
      if (columns.some((col) => col.column_name === field)) {
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
          WHERE table_schema = 'public'
        `);

        if (Array.isArray(result)) {
          validTables = result.map((row) => row.table_name.toLowerCase());
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
      `INSERT INTO ${table} (guild_id, user_id, ${field}) 
       VALUES ($1, $2, $3)
       ON CONFLICT (guild_id, user_id) 
       DO UPDATE SET ${field} = $3`,
      [guildId, userId, newValue]
    );

    return newValue;
  }

  // Add this new method for batch operations
  static async batchOperation(operations) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const op of operations) {
        const { type, path, value } = op;
        const [table, guildId, userId, field] = path.split(".");

        if (type === "set") {
          if (typeof value === "object") {
            const keys = Object.keys(value);
            const vals = Object.values(value);
            const setClause = keys
              .map((key, index) => `${key} = $${index + 3}`)
              .join(", ");
            const query = `
              INSERT INTO ${table} (guild_id, user_id, ${keys.join(", ")})
              VALUES ($1, $2, ${keys.map((_, i) => `$${i + 3}`).join(", ")})
              ON CONFLICT (guild_id, user_id)
              DO UPDATE SET ${setClause}
            `;
            await client.query(query, [guildId, userId, ...vals]);
          } else {
            await client.query(
              `
              INSERT INTO ${table} (guild_id, user_id, ${field}) 
              VALUES ($1, $2, $3)
              ON CONFLICT (guild_id, user_id)
              DO UPDATE SET ${field} = EXCLUDED.${field}
              `,
              [guildId, userId, value]
            );
          }
        }
        // Add other operation types as needed
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

// Move this function outside of the class
async function initializeDatabase() {
  await createConnection();
  await EconomyEZ.initializeTables();
  await EconomyEZ.enableWALMode();
  console.log("Database initialized successfully");
}

export default EconomyEZ;
export { createConnection, initializeDatabase };
