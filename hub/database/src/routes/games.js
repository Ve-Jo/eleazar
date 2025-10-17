import express from 'express';
import Database from '../client.js';
import { serializeBigInt } from '../utils/serialization.js';

const router = express.Router();

// Get game records
router.get('/records/:guildId/:userId', async (req, res) => {
  try {
    const { userId, guildId } = req.params;
    const records = await Database.getGameRecords(guildId, userId);
    res.json(serializeBigInt(records));
  } catch (error) {
    console.error('Error getting game records:', error);
    res.status(500).json({ error: 'Failed to get game records' });
  }
});

// Update game high score
router.post('/records/update', async (req, res) => {
  try {
    const { userId, guildId, gameId, score } = req.body;

    if (!userId || !guildId || !gameId || score === undefined) {
      return res.status(400).json({ error: 'userId, guildId, gameId, and score are required' });
    }

    const result = await Database.updateGameHighScore(guildId, userId, gameId, score);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error updating game record:', error);
    res.status(500).json({ error: 'Failed to update game record' });
  }
});

// Add game XP
router.post('/xp/add', async (req, res) => {
  try {
    const { userId, guildId, gameType, xp } = req.body;

    if (!userId || !guildId || !gameType || xp === undefined) {
      return res.status(400).json({ error: 'userId, guildId, gameType, and xp are required' });
    }

    const result = await Database.addGameXP(guildId, userId, gameType, xp);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error adding game XP:', error);
    res.status(500).json({ error: 'Failed to add game XP' });
  }
});

export default router;
