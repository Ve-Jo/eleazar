import express from 'express';
import Database from '../client.js';
import { serializeBigInt } from '../utils/serialization.js';

const router = express.Router();

// Create voice session
router.post('/sessions', async (req, res) => {
  try {
    const { userId, guildId, channelId } = req.body;
    
    if (!userId || !guildId || !channelId) {
      return res.status(400).json({ error: 'userId, guildId, and channelId are required' });
    }
    
    const session = await Database.createVoiceSession(guildId, userId, channelId);
    res.json(serializeBigInt(session));
  } catch (error) {
    console.error('Error creating voice session:', error);
    res.status(500).json({ error: 'Failed to create voice session' });
  }
});

// Get voice session
router.get('/sessions/:guildId/:userId', async (req, res) => {
  try {
    const { userId, guildId } = req.params;
    
    const session = await Database.getVoiceSession(guildId, userId);
    
    if (!session) {
      return res.status(404).json({ error: 'Voice session not found' });
    }
    
    res.json(serializeBigInt(session));
  } catch (error) {
    console.error('Error getting voice session:', error);
    res.status(500).json({ error: 'Failed to get voice session' });
  }
});

// Remove voice session
router.delete('/sessions/:guildId/:userId', async (req, res) => {
  try {
    const { userId, guildId } = req.params;
    
    const result = await Database.removeVoiceSession(guildId, userId);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error removing voice session:', error);
    res.status(500).json({ error: 'Failed to remove voice session' });
  }
});

// Get all voice sessions for a guild
router.get('/sessions/guild/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    const sessions = await Database.getAllVoiceSessions(guildId);
    res.json(serializeBigInt(sessions));
  } catch (error) {
    console.error('Error getting guild voice sessions:', error);
    res.status(500).json({ error: 'Failed to get guild voice sessions' });
  }
});

// Calculate and add voice XP
router.post('/xp/calculate', async (req, res) => {
  try {
    const { userId, guildId, timeSpent } = req.body;
    
    if (!userId || !guildId || timeSpent === undefined) {
      return res.status(400).json({ error: 'userId, guildId, and timeSpent are required' });
    }
    
    const result = await Database.calculateAndAddVoiceXP(guildId, userId, timeSpent);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error calculating voice XP:', error);
    res.status(500).json({ error: 'Failed to calculate voice XP' });
  }
});

export default router;