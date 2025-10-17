import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import Database from './client.js';
import userRoutes from './routes/users.js';
import economyRoutes from './routes/economy.js';
import gameRoutes from './routes/games.js';
import statsRoutes from './routes/stats.js';
import marriageRoutes from './routes/marriage.js';
import musicRoutes from './routes/music.js';
import cacheRoutes from './routes/cache.js';
import xpRoutes from './routes/xp.js';
import cooldownRoutes from './routes/cooldowns.js';
import guildRoutes from './routes/guilds.js';
import voiceRoutes from './routes/voice.js';
import levelRoutes from './routes/levels.js';
import cryptoRoutes from './routes/crypto.js';
import transactionRoutes from './routes/transactions.js';
import crateRoutes from './routes/crates.js';
import seasonRoutes from './routes/seasons.js';

dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.DATABASE_SERVICE_PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'database',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Routes
app.use('/users', userRoutes);
app.use('/economy', economyRoutes);
app.use('/games', gameRoutes);
app.use('/stats', statsRoutes);
app.use('/marriage', marriageRoutes);
app.use('/music', musicRoutes);
app.use('/cache', cacheRoutes);
app.use('/xp', xpRoutes);
app.use('/cooldowns', cooldownRoutes);
app.use('/guilds', guildRoutes);
app.use('/voice', voiceRoutes);
app.use('/levels', levelRoutes);
app.use('/crypto', cryptoRoutes);
app.use('/transactions', transactionRoutes);
app.use('/crates', crateRoutes);
app.use('/seasons', seasonRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Database service error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`🗄️  Database service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
