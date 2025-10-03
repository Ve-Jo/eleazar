import express from 'express';
import Database from '../client.js';
import { serializeBigInt } from '../utils/serialization.js';

const router = express.Router();

// Get guild data
router.get('/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    const guild = await Database.getGuild(guildId);
    
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    res.json(serializeBigInt(guild));
  } catch (error) {
    console.error('Error getting guild:', error);
    res.status(500).json({ error: 'Failed to get guild' });
  }
});

// Ensure guild exists
router.post('/ensure', async (req, res) => {
  try {
    const { guildId, guildData } = req.body;
    
    if (!guildId) {
      return res.status(400).json({ error: 'guildId is required' });
    }
    
    const guild = await Database.ensureGuild(guildId, guildData);
    res.json(serializeBigInt(guild));
  } catch (error) {
    console.error('Error ensuring guild:', error);
    res.status(500).json({ error: 'Failed to ensure guild' });
  }
});

// Update/insert guild data
router.put('/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    const guildData = req.body;
    
    const guild = await Database.upsertGuild(guildId, guildData);
    res.json(serializeBigInt(guild));
  } catch (error) {
    console.error('Error upserting guild:', error);
    res.status(500).json({ error: 'Failed to upsert guild' });
  }
});

// Get guild users
router.get('/:guildId/users', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    const users = await Database.getGuildUsers(guildId);
    res.json(serializeBigInt(users));
  } catch (error) {
    console.error('Error getting guild users:', error);
    res.status(500).json({ error: 'Failed to get guild users' });
  }
});

// Ensure guild user exists
router.post('/:guildId/users/ensure', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    const result = await Database.ensureGuildUser(guildId, userId);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error ensuring guild user:', error);
    res.status(500).json({ error: 'Failed to ensure guild user' });
  }
});

export default router;