import express from 'express';
import Database from '../client.js';
import { serializeWithBigInt } from '../client.js';

const router = express.Router();

// Get user crates
router.get('/:guildId/:userId', async (req, res) => {
  try {
    const { userId, guildId } = req.params;
    
    if (!userId || !guildId) {
      return res.status(400).json({ error: 'userId and guildId are required' });
    }

    const crates = await Database.getUserCrates(guildId, userId);
    res.json(serializeWithBigInt(crates));
  } catch (error) {
    console.error('Error getting user crates:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific user crate
router.get('/:guildId/:userId/:type', async (req, res) => {
  try {
    const { userId, guildId, type } = req.params;
    
    if (!userId || !guildId || !type) {
      return res.status(400).json({ error: 'userId, guildId, and type are required' });
    }

    const crate = await Database.getUserCrate(guildId, userId, type);
    res.json(serializeWithBigInt(crate));
  } catch (error) {
    console.error('Error getting user crate:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add crate to user
router.post('/', async (req, res) => {
  try {
    const { userId, guildId, type, count = 1, properties = {} } = req.body;
    
    if (!userId || !guildId || !type) {
      return res.status(400).json({ error: 'userId, guildId, and type are required' });
    }

    const result = await Database.addCrate(guildId, userId, type, count);
    res.json(serializeWithBigInt(result));
  } catch (error) {
    console.error('Error adding crate:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove crate from user
router.delete('/:guildId/:userId/:type', async (req, res) => {
  try {
    const { userId, guildId, type } = req.params;
    const { count = 1 } = req.body;
    
    if (!userId || !guildId || !type) {
      return res.status(400).json({ error: 'userId, guildId, and type are required' });
    }

    const result = await Database.removeCrate(guildId, userId, type, count);
    res.json(serializeWithBigInt(result));
  } catch (error) {
    console.error('Error removing crate:', error);
    res.status(500).json({ error: error.message });
  }
});

// Open crate
router.post('/open', async (req, res) => {
  try {
    const { userId, guildId, type } = req.body;
    
    if (!userId || !guildId || !type) {
      return res.status(400).json({ error: 'userId, guildId, and type are required' });
    }

    const result = await Database.openCrate(guildId, userId, type);
    res.json(serializeWithBigInt(result));
  } catch (error) {
    console.error('Error opening crate:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;