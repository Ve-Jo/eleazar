import express from 'express';
import Database from '../client.js';
import { serializeBigInt } from '../utils/serialization.js';

const router = express.Router();

// Create crypto position
router.post('/positions', async (req, res) => {
  try {
    const { userId, guildId, symbol, amount, price, type } = req.body;
    
    if (!userId || !guildId || !symbol || amount === undefined || price === undefined || !type) {
      return res.status(400).json({ error: 'userId, guildId, symbol, amount, price, and type are required' });
    }
    
    const position = await Database.createCryptoPosition(guildId, userId, symbol, amount, price, type);
    res.json(serializeBigInt(position));
  } catch (error) {
    console.error('Error creating crypto position:', error);
    res.status(500).json({ error: 'Failed to create crypto position' });
  }
});

// Get user crypto positions
router.get('/positions/:guildId/:userId', async (req, res) => {
  try {
    const { userId, guildId } = req.params;
    
    const positions = await Database.getUserCryptoPositions(guildId, userId);
    res.json(serializeBigInt(positions));
  } catch (error) {
    console.error('Error getting user crypto positions:', error);
    res.status(500).json({ error: 'Failed to get user crypto positions' });
  }
});

// Get specific crypto position
router.get('/positions/id/:positionId', async (req, res) => {
  try {
    const { positionId } = req.params;
    
    const position = await Database.getCryptoPositionById(positionId);
    
    if (!position) {
      return res.status(404).json({ error: 'Crypto position not found' });
    }
    
    res.json(serializeBigInt(position));
  } catch (error) {
    console.error('Error getting crypto position:', error);
    res.status(500).json({ error: 'Failed to get crypto position' });
  }
});

// Update crypto position
router.put('/positions/:positionId', async (req, res) => {
  try {
    const { positionId } = req.params;
    const updateData = req.body;
    
    const position = await Database.updateCryptoPosition(positionId, updateData);
    res.json(serializeBigInt(position));
  } catch (error) {
    console.error('Error updating crypto position:', error);
    res.status(500).json({ error: 'Failed to update crypto position' });
  }
});

// Delete crypto position
router.delete('/positions/:positionId', async (req, res) => {
  try {
    const { positionId } = req.params;
    
    const result = await Database.deleteCryptoPosition(positionId);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error deleting crypto position:', error);
    res.status(500).json({ error: 'Failed to delete crypto position' });
  }
});

// Get all active crypto positions
router.get('/positions/active/all', async (req, res) => {
  try {
    const positions = await Database.getAllActiveCryptoPositions();
    res.json(serializeBigInt(positions));
  } catch (error) {
    console.error('Error getting active crypto positions:', error);
    res.status(500).json({ error: 'Failed to get active crypto positions' });
  }
});

export default router;