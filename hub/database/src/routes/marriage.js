import express from 'express';
import Database from '../client.js';
import { serializeBigInt } from '../utils/serialization.js';

const router = express.Router();

// Get marriage status
router.get('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { guildId } = req.query;
    
    if (!guildId) {
      return res.status(400).json({ error: 'guildId is required' });
    }
    
    const status = await Database.getMarriageStatus(guildId, userId);
    res.json(serializeBigInt(status));
  } catch (error) {
    console.error('Error getting marriage status:', error);
    res.status(500).json({ error: 'Failed to get marriage status' });
  }
});

// Propose marriage
router.post('/propose', async (req, res) => {
  try {
    const { guildId, userId1, userId2 } = req.body;
    
    if (!guildId || !userId1 || !userId2) {
      return res.status(400).json({ error: 'guildId, userId1, and userId2 are required' });
    }
    
    const result = await Database.proposeMarriage(guildId, userId1, userId2);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error proposing marriage:', error);
    res.status(500).json({ error: 'Failed to propose marriage' });
  }
});

// Accept marriage
router.post('/accept', async (req, res) => {
  try {
    const { guildId, userId1, userId2 } = req.body;
    
    if (!guildId || !userId1 || !userId2) {
      return res.status(400).json({ error: 'guildId, userId1, and userId2 are required' });
    }
    
    const result = await Database.acceptMarriage(guildId, userId1, userId2);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error accepting marriage:', error);
    res.status(500).json({ error: 'Failed to accept marriage' });
  }
});

// Reject marriage
router.post('/reject', async (req, res) => {
  try {
    const { guildId, userId1, userId2 } = req.body;
    
    if (!guildId || !userId1 || !userId2) {
      return res.status(400).json({ error: 'guildId, userId1, and userId2 are required' });
    }
    
    const result = await Database.rejectMarriage(guildId, userId1, userId2);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error rejecting marriage:', error);
    res.status(500).json({ error: 'Failed to reject marriage' });
  }
});

// Dissolve marriage
router.post('/dissolve', async (req, res) => {
  try {
    const { guildId, userId1, userId2 } = req.body;
    
    if (!guildId || !userId1 || !userId2) {
      return res.status(400).json({ error: 'guildId, userId1, and userId2 are required' });
    }
    
    const result = await Database.dissolveMarriage(guildId, userId1, userId2);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error dissolving marriage:', error);
    res.status(500).json({ error: 'Failed to dissolve marriage' });
  }
});

export default router;