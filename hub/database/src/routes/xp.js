import express from 'express';
import Database from '../client.js';
import { serializeBigInt } from '../utils/serialization.js';

const router = express.Router();

// Add XP to user
router.post('/add', async (req, res) => {
  try {
    const { userId, guildId, amount } = req.body;

    if (!userId || !guildId || amount === undefined) {
      return res.status(400).json({ error: 'userId, guildId, and amount are required' });
    }

    const result = await Database.addXP(guildId, userId, amount);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error adding XP:', error);
    res.status(500).json({ error: 'Failed to add XP' });
  }
});

// Get user level information
router.get('/level/:guildId/:userId', async (req, res) => {
  try {
    const { userId, guildId } = req.params;
    const { type } = req.query; // 'activity', 'gaming', or 'season'

    const level = await Database.getLevel(guildId, userId, type);
    res.json(serializeBigInt(level));
  } catch (error) {
    console.error('Error getting level:', error);
    res.status(500).json({ error: 'Failed to get level' });
  }
});

// Get all level data for user
router.get('/levels/:guildId/:userId', async (req, res) => {
  try {
    const { userId, guildId } = req.params;

    const levels = await Database.getAllLevels(guildId, userId);
    res.json(serializeBigInt(levels));
  } catch (error) {
    console.error('Error getting all levels:', error);
    res.status(500).json({ error: 'Failed to get all levels' });
  }
});

// Calculate level from XP amount
router.post('/calculate', async (req, res) => {
  try {
    const { xp } = req.body;

    if (xp === undefined) {
      return res.status(400).json({ error: 'xp is required' });
    }

    const result = await Database.calculateLevel(xp);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error calculating level:', error);
    res.status(500).json({ error: 'Failed to calculate level' });
  }
});

// Check if level up occurred
router.post('/check-levelup', async (req, res) => {
  try {
    const { oldXp, newXp } = req.body;

    if (oldXp === undefined || newXp === undefined) {
      return res.status(400).json({ error: 'oldXp and newXp are required' });
    }

    const result = await Database.checkLevelUp(oldXp, newXp);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error checking level up:', error);
    res.status(500).json({ error: 'Failed to check level up' });
  }
});

export default router;
