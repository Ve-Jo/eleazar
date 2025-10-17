import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { generateImage, processImageColors } from './utils/imageGenerator.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

dotenv.config({ path: '../.env' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.RENDERING_SERVICE_PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'rendering',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Image generation endpoint
app.post('/generate', async (req, res) => {
  try {
    const { component, props, scaling, locale, options } = req.body;

    if (!component) {
      return res.status(400).json({ error: 'Component is required' });
    }

    // Create i18n mock object
    const i18n = {
      getLocale: () => locale || 'en',
      __: (key, ...args) => {
        // Simple fallback - in production you might want to load actual translations
        return key;
      }
    };

    const result = await generateImage(component, props || {}, scaling || { image: 1, emoji: 1 }, i18n, options || {});

    if (Buffer.isBuffer(result)) {
      res.set('Content-Type', 'image/png');
      res.send(result);
    } else if (Array.isArray(result)) {
      // If returnDominant is true, result is [buffer, coloring]
      const [buffer, coloring] = result;
      res.json({
        image: buffer.toString('base64'),
        coloring
      });
    } else {
      res.status(500).json({ error: 'Invalid result format' });
    }
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({
      error: 'Failed to generate image',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Image generation failed'
    });
  }
});

// Color processing endpoint
app.post('/colors', async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl is required' });
    }

    const colors = await processImageColors(imageUrl);
    res.json(colors);
  } catch (error) {
    console.error('Error processing colors:', error);
    res.status(500).json({
      error: 'Failed to process colors',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Color processing failed'
    });
  }
});

// List available components
app.get('/components', async (req, res) => {
  try {
    const componentsDir = path.join(__dirname, 'components');
    const files = await fs.readdir(componentsDir);
    const components = files
      .filter(f => f.endsWith('.jsx'))
      .map(f => f.replace('.jsx', ''));

    res.json({ components });
  } catch (error) {
    console.error('Error listing components:', error);
    res.status(500).json({ error: 'Failed to list components' });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Rendering service error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`🎨 Rendering service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🖼️  Static files: http://localhost:${PORT}/public`);
});
