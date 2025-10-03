import express from 'express';
import Database from '../client.js';
import { serializeBigInt } from '../utils/serialization.js';

const router = express.Router();

// Get user statistics
router.get('/:guildId/:userId', async (req, res) => {
  try {
    const { userId, guildId } = req.params;
    const stats = await Database.getStatistics(guildId, userId);
    res.json(serializeBigInt(stats));
  } catch (error) {
    console.error('Error getting statistics:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Update statistics
router.patch('/:guildId/:userId', async (req, res) => {
  try {
    const { userId, guildId } = req.params;
    const updateData = req.body;
    
    const stats = await Database.updateStatistics(guildId, userId, updateData);
    res.json(serializeBigInt(stats));
  } catch (error) {
    console.error('Error updating statistics:', error);
    res.status(500).json({ error: 'Failed to update statistics' });
  }
});

// Get interaction statistics
router.get('/interactions/:guildId/:userId', async (req, res) => {
  try {
    const { userId, guildId } = req.params;
    
    const stats = await Database.getInteractionStats(guildId, userId);
    res.json(serializeBigInt(stats));
  } catch (error) {
    console.error('Error getting interaction stats:', error);
    res.status(500).json({ error: 'Failed to get interaction stats' });
  }
});

// Get most used interactions
router.get('/interactions/:guildId/:userId/top', async (req, res) => {
  try {
    const { userId, guildId } = req.params;
    const { limit } = req.query;
    
    const limitNum = limit ? parseInt(limit) : 10;
    if (isNaN(limitNum)) {
      return res.status(400).json({ error: 'Invalid limit number' });
    }
    
    const stats = await Database.getMostUsedInteractions(guildId, userId, limitNum);
    res.json(serializeBigInt(stats));
  } catch (error) {
    console.error('Error getting most used interactions:', error);
    res.status(500).json({ error: 'Failed to get most used interactions' });
  }
});

export default router;