import express from 'express';
import chatRoutes from './chatRoutes.js';
import healthRoutes from './healthRoutes.js';
import systemHealthRoutes from './health.js';
import webhookRoutes from './webhooks.js';
import authRoutes from './auth.js';
import userRoutes from './userRoutes.js';
import gitaRoutes from './gitaRoutes.js';
import meditationRoutes from './meditationRoutes.js';

const router = express.Router();

// API version prefix
const API_VERSION = '/api/v1';

// Mount routes
router.use(`${API_VERSION}/chat`, chatRoutes);
router.use(`${API_VERSION}/health`, healthRoutes);
router.use(`${API_VERSION}/auth`, authRoutes); // Auth endpoints
router.use(`${API_VERSION}/user`, userRoutes); // User management endpoints
router.use(`${API_VERSION}/gita`, gitaRoutes); // Gita quotes endpoints
router.use(`${API_VERSION}/meditation`, meditationRoutes); // Meditation endpoints
router.use('/api/health', systemHealthRoutes); // System health endpoints
router.use('/api/webhooks', webhookRoutes); // Webhook endpoints

// Docker health check endpoint
router.get('/ping', (req, res) => {
  res.status(200).send('OK');
});

// Root endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'GitaGPT API Server',
    version: '1.0.0',
    endpoints: {
      chat: `${API_VERSION}/chat`,
      health: `${API_VERSION}/health`,
      auth: `${API_VERSION}/auth`,
      user: `${API_VERSION}/user`,
      gita: `${API_VERSION}/gita`,
      meditation: `${API_VERSION}/meditation`,
      systemHealth: '/api/health',
      ping: '/ping'
    },
    documentation: '/docs',
  });
});

export default router;
