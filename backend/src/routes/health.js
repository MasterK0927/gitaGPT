import express from 'express';
import database from '../services/database.js';
import cache from '../services/cache.js';
import logger from '../services/logger.js';
import config from '../config/index.js';
import os from 'os';
import process from 'process';
import fs from 'fs';

const router = express.Router();

// Simple ping endpoint for basic health check (always works)
router.get('/ping', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'pong',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv
  });
});

// Health check endpoints for system status monitoring

// Database health check
router.get('/db', async (_req, res) => {
  try {
    const startTime = Date.now();
    const isHealthy = await database.healthCheck();
    const responseTime = Date.now() - startTime;

    if (isHealthy) {
      res.json({
        status: 'online',
        responseTime,
        timestamp: new Date().toISOString(),
        service: 'database'
      });
    } else {
      res.status(503).json({
        status: 'offline',
        responseTime,
        timestamp: new Date().toISOString(),
        service: 'database',
        error: 'Database connection failed'
      });
    }
  } catch (error) {
    logger.error('Database health check failed:', error);
    res.status(503).json({
      status: 'offline',
      timestamp: new Date().toISOString(),
      service: 'database',
      error: error.message
    });
  }
});

// Redis health check
router.get('/redis', async (_req, res) => {
  try {
    const startTime = Date.now();
    const isHealthy = await cache.healthCheck();
    const responseTime = Date.now() - startTime;

    if (isHealthy) {
      res.json({
        status: 'online',
        responseTime,
        timestamp: new Date().toISOString(),
        service: 'redis'
      });
    } else {
      res.status(503).json({
        status: 'offline',
        responseTime,
        timestamp: new Date().toISOString(),
        service: 'redis',
        error: 'Redis connection failed'
      });
    }
  } catch (error) {
    logger.error('Redis health check failed:', error);
    res.status(503).json({
      status: 'offline',
      timestamp: new Date().toISOString(),
      service: 'redis',
      error: error.message
    });
  }
});

// Load balancer health check (simple endpoint status)
router.get('/lb', async (_req, res) => {
  try {
    const startTime = Date.now();
    const responseTime = Date.now() - startTime;

    // Simple load balancer health - if this endpoint responds, LB is working
    res.json({
      status: 'online',
      responseTime,
      timestamp: new Date().toISOString(),
      service: 'load_balancer',
      endpoints: {
        primary: 'active',
        backup: 'standby'
      }
    });
  } catch (error) {
    logger.error('Load balancer health check failed:', error);
    res.status(503).json({
      status: 'offline',
      timestamp: new Date().toISOString(),
      service: 'load_balancer',
      error: error.message
    });
  }
});

// Overall system health
router.get('/system', async (_req, res) => {
  try {
    const startTime = Date.now();
    const checks = await Promise.allSettled([
      database.healthCheck(),
      cache.healthCheck()
    ]);

    const dbHealthy = checks[0].status === 'fulfilled' && checks[0].value;
    const redisHealthy = checks[1].status === 'fulfilled' && checks[1].value;

    // System metrics
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const systemLoad = os.loadavg();
    const freeMemory = os.freemem();
    const totalMemory = os.totalmem();

    // Disk space check
    let diskSpace = null;
    try {
      const stats = fs.statSync('.');
      diskSpace = {
        available: stats.size || 'unknown',
        used: 'unknown'
      };
    } catch (error) {
      diskSpace = { error: 'Unable to check disk space' };
    }

    const services = {
      database: dbHealthy ? 'online' : 'offline',
      redis: redisHealthy ? 'online' : 'offline',
      load_balancer: 'online', // If we can respond, LB is working
      auth_service: 'online' // Clerk is external, assume online
    };

    const allHealthy = Object.values(services).every(status => status === 'online');
    const overallStatus = allHealthy ? 'online' : 'degraded';

    // Performance metrics
    const responseTime = Date.now() - startTime;

    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime,
      services,
      system: {
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        environment: config.nodeEnv,
        pid: process.pid
      },
      performance: {
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          external: Math.round(memoryUsage.external / 1024 / 1024), // MB
          systemFree: Math.round(freeMemory / 1024 / 1024), // MB
          systemTotal: Math.round(totalMemory / 1024 / 1024), // MB
          memoryUsagePercent: Math.round(((totalMemory - freeMemory) / totalMemory) * 100)
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
          loadAverage: systemLoad
        },
        disk: diskSpace
      },
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    logger.error('System health check failed:', error);
    res.status(503).json({
      status: 'offline',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Performance metrics endpoint
router.get('/metrics', async (_req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Get cache metrics if available
    let cacheMetrics = null;
    try {
      cacheMetrics = await cache.getMetrics();
    } catch (error) {
      cacheMetrics = { error: 'Cache metrics unavailable' };
    }

    // Get database metrics if available
    let dbMetrics = null;
    try {
      dbMetrics = await database.getMetrics();
    } catch (error) {
      dbMetrics = { error: 'Database metrics unavailable' };
    }

    res.json({
      timestamp: new Date().toISOString(),
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external,
          arrayBuffers: memoryUsage.arrayBuffers
        },
        cpu: cpuUsage
      },
      system: {
        loadAverage: os.loadavg(),
        freeMemory: os.freemem(),
        totalMemory: os.totalmem(),
        cpus: os.cpus().length,
        platform: os.platform(),
        arch: os.arch()
      },
      cache: cacheMetrics,
      database: dbMetrics
    });
  } catch (error) {
    logger.error('Metrics endpoint failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      timestamp: new Date().toISOString()
    });
  }
});

// Readiness probe (for Kubernetes)
router.get('/ready', async (_req, res) => {
  try {
    // Check if all critical services are ready
    const dbReady = await database.healthCheck();

    if (dbReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        reason: 'Database not available',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      reason: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Liveness probe (for Kubernetes)
router.get('/live', (_req, res) => {
  // Simple liveness check - if we can respond, we're alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;
