import express from 'express';
import Database from '../client.js';
import { serializeBigInt } from '../utils/serialization.js';

const router = express.Router();

// Get cooldown data
router.get('/:guildId/:userId/:type', async (req, res) => {
  try {
    const { userId, guildId, type } = req.params;

    const cooldown = await Database.getCooldown(guildId, userId, type);
    res.json(serializeBigInt({ cooldown }));
  } catch (error) {
    console.error('Error getting cooldown:', error);
    res.status(500).json({ error: 'Failed to get cooldown' });
  }
});

// Set cooldown
router.post('/', async (req, res) => {
  try {
    const { userId, guildId, type, duration } = req.body;

    if (!userId || !guildId || !type || duration === undefined) {
      return res.status(400).json({ error: 'userId, guildId, type, and duration are required' });
    }

    const result = await Database.setCooldown(guildId, userId, type, duration);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error setting cooldown:', error);
    res.status(500).json({ error: 'Failed to set cooldown' });
  }
});

// Delete cooldown
router.delete('/:guildId/:userId/:type', async (req, res) => {
  try {
    const { userId, guildId, type } = req.params;

    const result = await Database.deleteCooldown(guildId, userId, type);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error deleting cooldown:', error);
    res.status(500).json({ error: 'Failed to delete cooldown' });
  }
});

// Get crate cooldown
router.get('/crate/:guildId/:userId/:type', async (req, res) => {
  try {
    const { userId, guildId, type } = req.params;

    const cooldown = await Database.getCrateCooldown(guildId, userId, type);
    res.json(serializeBigInt(cooldown));
  } catch (error) {
    console.error('Error getting crate cooldown:', error);
    res.status(500).json({ error: 'Failed to get crate cooldown' });
  }
});

// Get all cooldowns for a user
router.get('/:guildId/:userId', async (req, res) => {
  try {
    const { userId, guildId } = req.params;

    // Get user data which includes cooldowns
    const user = await Database.getUser(guildId, userId);
    const cooldowns = user?.cooldowns || {};

    res.json(serializeBigInt({ cooldowns }));
  } catch (error) {
    console.error('Error getting user cooldowns:', error);
    res.status(500).json({ error: 'Failed to get user cooldowns' });
  }
});

export default router;
