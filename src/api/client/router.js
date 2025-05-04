import express from "express";
import Database, {
  serializeWithBigInt,
  DEFAULT_VALUES,
} from "../../database/client.js"; // Adjust path as needed

const router = express.Router();

// --- API Routes ---

// Get User Data
router.get("/users/:guildId/:userId", async (req, res) => {
  const { guildId, userId } = req.params;
  console.log(
    `[API] Request received for user data: guild=${guildId}, user=${userId}`
  );
  try {
    const userData = await Database.ensureUser(guildId, userId);

    if (!userData) {
      console.error(
        `[API] Error: ensureUser did not return data for ${userId} in guild ${guildId}`
      );
      return res
        .status(500)
        .json({ error: "Failed to retrieve or create user data" });
    }

    // Step 1: Serialize the object with custom logic (handles BigInt/Decimal)
    const serializedString = serializeWithBigInt(userData);
    console.log(
      `[API] User data for ${userId} (after serializeWithBigInt):`,
      serializedString
    );

    // Step 2: Parse the serialized string back into a plain JS object
    let plainJsonObject;
    try {
      plainJsonObject = JSON.parse(serializedString);
      console.log(
        `[API] User data for ${userId} (after JSON.parse): object type = ${typeof plainJsonObject}`
      );
    } catch (parseError) {
      console.error(
        `[API] Failed to re-parse serialized data for ${userId}:`,
        parseError,
        "Serialized string was:",
        serializedString
      );
      return res
        .status(500)
        .json({ error: "Internal server error during data serialization" });
    }

    // Step 3: Send the plain JS object using res.json()
    // This object should now be safe for the default JSON.stringify used by res.json()
    console.log(
      `[API] Sending plainJsonObject for ${userId} via res.json()...`
    );
    res.json(plainJsonObject);
  } catch (error) {
    console.error(
      `[API] Error processing user data for ${userId} in guild ${guildId}:`,
      error
    );
    // Use .status().json() for errors too
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get Game Records
router.get("/games/records/:guildId/:userId", async (req, res) => {
  const { guildId, userId } = req.params;
  console.log(
    `[API] Request received for game records: guild=${guildId}, user=${userId}`
  );
  try {
    const gameRecords = await Database.getGameRecords(guildId, userId);
    const responseData = gameRecords || {
      2048: { highScore: 0 },
      snake: { highScore: 0 },
    };
    // Use res.json here as well
    res.json(responseData);
  } catch (error) {
    console.error(
      `[API] Error fetching game records for ${userId} in guild ${guildId}:`,
      error
    );
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update Game Record
router.post("/games/updateRecord", async (req, res) => {
  const { guildId, userId, gameId, score } = req.body;
  console.log(
    `[API] Request received to update game record: guild=${guildId}, user=${userId}, game=${gameId}, score=${score}`
  );
  if (!guildId || !userId || !gameId || score === undefined) {
    return res.status(400).json({
      error: "Missing required fields: guildId, userId, gameId, score",
    });
  }
  try {
    const result = await Database.updateGameHighScore(
      guildId,
      userId,
      gameId,
      score
    );
    // Use res.json here too
    res.json(result);
  } catch (error) {
    console.error(
      `[API] Error updating game record for ${userId} in guild ${guildId}:`,
      error
    );
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update Balance
router.post("/economy/updateBalance", async (req, res) => {
  const { guildId, userId, amount, reason } = req.body;
  console.log(
    `[API] Request received to update balance: guild=${guildId}, user=${userId}, amount=${amount}, reason=${reason}`
  );
  if (!guildId || !userId || amount === undefined) {
    return res
      .status(400)
      .json({ error: "Missing required fields: guildId, userId, amount" });
  }
  try {
    const result = await Database.addBalance(guildId, userId, amount);
    const responseData = {
      success: true,
      // Assuming result contains the updated economy record
      // Convert BigInt/Decimal to string for JSON compatibility if needed
      newBalance: result?.balance?.toString() ?? "N/A", // Example conversion
    };
    // Use res.json
    res.json(responseData);
  } catch (error) {
    console.error(
      `[API] Error updating balance for ${userId} in guild ${guildId}:`,
      error
    );
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get Shop Upgrades
router.get("/shop/upgrades/:guildId/:userId", async (req, res) => {
  const { guildId, userId } = req.params;
  console.log(
    `[API] Request received for shop upgrades: guild=${guildId}, user=${userId}`
  );
  try {
    const upgrades = await Database.getUserUpgrades(guildId, userId);
    const responseData = upgrades || [];
    // Use res.json
    res.json(responseData);
  } catch (error) {
    console.error(
      `[API] Error fetching upgrades for ${userId} in guild ${guildId}:`,
      error
    );
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
