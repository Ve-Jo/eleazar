import express from 'express';
import Database from '../client.js';
import { serializeWithBigInt } from '../client.js';

const router = express.Router();

// Get current season
router.get('/current', async (req, res) => {
  try {
    const season = await Database.getCurrentSeason();
    res.json(serializeWithBigInt(season));
  } catch (error) {
    console.error('Error getting current season:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get season leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { seasonId, limit = 250 } = req.query;
    
    if (!seasonId) {
      return res.status(400).json({ error: 'seasonId is required' });
    }
    
    const leaderboard = await Database.getSeasonLeaderboard(parseInt(seasonId), parseInt(limit));
    res.json(serializeWithBigInt(leaderboard));
  } catch (error) {
    console.error('Error getting season leaderboard:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;