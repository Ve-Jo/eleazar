import express from 'express';
import Database from '../client.js';
import { serializeBigInt } from '../utils/serialization.js';

const router = express.Router();

// Ensure user exists
router.post('/ensure', async (req, res) => {
  try {
    const { userId, guildId } = req.body;
    
    if (!userId || !guildId) {
      return res.status(400).json({ error: 'userId and guildId are required' });
    }
    
    const user = await Database.ensureUser(guildId, userId);
    res.json(serializeBigInt(user));
  } catch (error) {
    console.error('Error ensuring user:', error);
    res.status(500).json({ error: 'Failed to ensure user' });
  }
});

// Get user data
router.get('/:guildId/:userId', async (req, res) => {
  try {
    const { userId, guildId } = req.params;
    const user = await Database.getUser(guildId, userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(serializeBigInt(user));
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user data
router.patch('/:guildId/:userId', async (req, res) => {
  try {
    const { userId, guildId } = req.params;
    const updateData = req.body;
    
    const user = await Database.updateUser(guildId, userId, updateData);
    res.json(serializeBigInt(user));
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Get user locale
router.get('/:guildId/:userId/locale', async (req, res) => {
  try {
    const { userId, guildId } = req.params;
    
    // Ensure user exists before getting locale
    await Database.ensureGuildUser(guildId, userId);
    const locale = await Database.getUserLocale(guildId, userId);
    res.json({ locale });
  } catch (error) {
    console.error('Error getting user locale:', error);
    res.json({ locale: null });
  }
});

// Set user locale
router.put('/:guildId/:userId/locale', async (req, res) => {
  try {
    const { userId, guildId } = req.params;
    const { locale } = req.body;
    
    if (!locale) {
      return res.status(400).json({ error: 'locale is required' });
    }
    
    // Ensure user exists before setting locale
    await Database.ensureGuildUser(guildId, userId);
    await Database.setUserLocale(guildId, userId, locale);
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting user locale:', error);
    res.status(500).json({ error: 'Failed to set user locale' });
  }
});

export default router;