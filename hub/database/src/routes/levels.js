import express from 'express';
import Database from '../client.js';
import { serializeBigInt } from '../utils/serialization.js';

const router = express.Router();

// Get guild level roles configuration
router.get('/roles/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;

    const levelRoles = await Database.getLevelRoles(guildId);
    res.json(serializeBigInt(levelRoles));
  } catch (error) {
    console.error('Error getting level roles:', error);
    res.status(500).json({ error: 'Failed to get level roles' });
  }
});

// Get eligible role for specific level
router.get('/roles/:guildId/level/:level', async (req, res) => {
  try {
    const { guildId, level } = req.params;

    const levelNum = parseInt(level);
    if (isNaN(levelNum)) {
      return res.status(400).json({ error: 'Invalid level number' });
    }

    const role = await Database.getEligibleLevelRole(guildId, levelNum);
    res.json(serializeBigInt({ role }));
  } catch (error) {
    console.error('Error getting eligible level role:', error);
    res.status(500).json({ error: 'Failed to get eligible level role' });
  }
});

// Get next level role
router.get('/roles/:guildId/next/:currentLevel', async (req, res) => {
  try {
    const { guildId, currentLevel } = req.params;

    const levelNum = parseInt(currentLevel);
    if (isNaN(levelNum)) {
      return res.status(400).json({ error: 'Invalid current level number' });
    }

    const nextRole = await Database.getNextLevelRole(guildId, levelNum);
    res.json(serializeBigInt({ nextRole }));
  } catch (error) {
    console.error('Error getting next level role:', error);
    res.status(500).json({ error: 'Failed to get next level role' });
  }
});

// Add level role mapping
router.post('/roles', async (req, res) => {
  try {
    const { guildId, level, roleId } = req.body;

    if (!guildId || level === undefined || !roleId) {
      return res.status(400).json({ error: 'guildId, level, and roleId are required' });
    }

    const levelNum = parseInt(level);
    if (isNaN(levelNum)) {
      return res.status(400).json({ error: 'Invalid level number' });
    }

    const result = await Database.addLevelRole(guildId, levelNum, roleId);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error adding level role:', error);
    res.status(500).json({ error: 'Failed to add level role' });
  }
});

// Remove level role mapping
router.delete('/roles/:guildId/:level', async (req, res) => {
  try {
    const { guildId, level } = req.params;

    const levelNum = parseInt(level);
    if (isNaN(levelNum)) {
      return res.status(400).json({ error: 'Invalid level number' });
    }

    const result = await Database.removeLevelRole(guildId, levelNum);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error removing level role:', error);
    res.status(500).json({ error: 'Failed to remove level role' });
  }
});

export default router;
