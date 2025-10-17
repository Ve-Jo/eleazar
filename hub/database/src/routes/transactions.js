import express from 'express';
import Database from '../client.js';
import { serializeBigInt } from '../utils/serialization.js';

const router = express.Router();

// Execute database transaction
router.post('/', async (req, res) => {
  try {
    const { operations } = req.body;

    if (!operations || !Array.isArray(operations)) {
      return res.status(400).json({ error: 'operations array is required' });
    }

    const result = await Database.transaction(async (tx) => {
      const results = [];

      for (const operation of operations) {
        const { method, args } = operation;

        if (!method || !args) {
          throw new Error('Each operation must have method and args');
        }

        // Execute the database method with transaction
        const methodResult = await Database[method](...args, tx);
        results.push(methodResult);
      }

      return results;
    });

    res.json(serializeBigInt({ results: result }));
  } catch (error) {
    console.error('Error executing transaction:', error);
    res.status(500).json({ error: 'Failed to execute transaction' });
  }
});

// Universal data getter
router.post('/get', async (req, res) => {
  try {
    const { path, guildId, userId, relations } = req.body;

    if (!path) {
      return res.status(400).json({ error: 'path is required' });
    }

    const result = await Database.get(path, guildId, userId, relations);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error('Error getting data:', error);
    res.status(500).json({ error: 'Failed to get data' });
  }
});

export default router;
