import express from 'express';
import Database from '../client.js';
import { serializeBigInt } from '../utils/serialization.js';

const router = express.Router();

// Get from cache
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const decodedKey = decodeURIComponent(key);
    
    const value = await Database.getFromCache(decodedKey);
    res.json(serializeBigInt({ value }));
  } catch (error) {
    console.error('Error getting from cache:', error);
    res.status(500).json({ error: 'Failed to get from cache' });
  }
});

// Set cache value
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value, ttl } = req.body;
    const decodedKey = decodeURIComponent(key);
    
    if (value === undefined) {
      return res.status(400).json({ error: 'value is required' });
    }
    
    const result = await Database.setCache(decodedKey, value, ttl);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error setting cache:', error);
    res.status(500).json({ error: 'Failed to set cache' });
  }
});

// Invalidate cache keys
router.post('/invalidate', async (req, res) => {
  try {
    const { keys } = req.body;
    
    if (!keys || !Array.isArray(keys)) {
      return res.status(400).json({ error: 'keys array is required' });
    }
    
    const result = await Database.invalidateCache(keys);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error invalidating cache:', error);
    res.status(500).json({ error: 'Failed to invalidate cache' });
  }
});

// Delete cache key
router.delete('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const decodedKey = decodeURIComponent(key);
    
    const result = await Database.deleteFromCache(decodedKey);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error deleting from cache:', error);
    res.status(500).json({ error: 'Failed to delete from cache' });
  }
});

export default router;