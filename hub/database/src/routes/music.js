import express from 'express';
import Database from '../client.js';
import { serializeBigInt } from '../utils/serialization.js';

const router = express.Router();

// Save player data
router.post('/players', async (req, res) => {
  try {
    const { player } = req.body;
    
    if (!player) {
      return res.status(400).json({ error: 'player data is required' });
    }
    
    const result = await Database.savePlayer(player);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error saving player:', error);
    res.status(500).json({ error: 'Failed to save player' });
  }
});

// Load all players
router.get('/players', async (req, res) => {
  try {
    const players = await Database.loadPlayers();
    res.json(serializeBigInt(players));
  } catch (error) {
    console.error('Error loading players:', error);
    res.status(500).json({ error: 'Failed to load players' });
  }
});

// Get specific player
router.get('/players/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    const player = await Database.getPlayer(guildId);
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    res.json(serializeBigInt(player));
  } catch (error) {
    console.error('Error getting player:', error);
    res.status(500).json({ error: 'Failed to get player' });
  }
});

// Update player data
router.put('/players/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    const data = req.body;
    
    const result = await Database.updatePlayer(guildId, data);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error updating player:', error);
    res.status(500).json({ error: 'Failed to update player' });
  }
});

// Delete player
router.delete('/players/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    const result = await Database.deletePlayer(guildId);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error deleting player:', error);
    res.status(500).json({ error: 'Failed to delete player' });
  }
});

export default router;