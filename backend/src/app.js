import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config/index.js';
import logger from './utils/logger.js';
import routes from './routes/index.js';

// Enhanced services (ES modules) - Initialize with error handling
let database, cache, enhancedLogger, messageQueue, queueConsumers, cronService;

// Initialize services with individual error handling
try {
  database = (await import('./services/database.js')).default;
  console.log('✅ Database service loaded');
} catch (error) {
  console.log('⚠️ Database service not available:', error.message);
}

try {
  cache = (await import('./services/cache.js')).default;
  console.log('✅ Cache service loaded');
} catch (error) {
  console.log('⚠️ Cache service not available:', error.message);
}

try {
  enhancedLogger = (await import('./services/logger.js')).default;
  console.log('✅ Enhanced logger service loaded');
} catch (error) {
  console.log('⚠️ Enhanced logger service not available:', error.message);
}

try {
  messageQueue = (await import('./services/messageQueue.js')).default;
  console.log('✅ Message queue service loaded');
} catch (error) {
  console.log('⚠️ Message queue service not available:', error.message);
}

try {
  queueConsumers = (await import('./services/queueConsumers.js')).default;
  console.log('✅ Queue consumers service loaded');
} catch (error) {
  console.log('⚠️ Queue consumers service not available:', error.message);
}

try {
  cronService = (await import('./services/cronService.js')).default;
  console.log('✅ Cron service loaded');
} catch (error) {
  console.log('⚠️ Cron service not available:', error.message);
}

// Initialize services that were successfully loaded
try {
  // Initialize logger with database for log storage
  if (database && logger.setDatabase) {
    logger.setDatabase(database);
    console.log('✅ Logger initialized with database storage');
  }

  // Initialize message queue consumers
  if (queueConsumers && queueConsumers.start) {
    await queueConsumers.start();
    console.log('✅ Message queue consumers started');
  }

  // Initialize cron service
  if (cronService && cronService.initialize) {
    await cronService.initialize();
    console.log('✅ Cron service initialized');
  }
} catch (error) {
  console.log('⚠️ Service initialization error:', error.message);
}
import { 
  errorHandler, 
  notFound, 
  handleUncaughtException, 
  handleUnhandledRejection 
} from './middleware/errorHandler.js';
import { 
  corsOptions, 
  securityHeaders, 
  sanitizeInput, 
  requestSizeLimiter 
} from './middleware/security.js';

/**
 * Initialize enhanced services
 */
async function initializeServices() {
  try {
    if (database) {
      const dbConnected = await database.initialize();
      if (dbConnected && enhancedLogger) {
        enhancedLogger.setDatabase(database);
        console.log('✅ Database service initialized');
      }
    }

    if (cache) {
      const cacheConnected = await cache.initialize();
      if (cacheConnected) {
        console.log('✅ Cache service initialized');
      }
    }
  } catch (error) {
    console.warn('⚠️ Some services failed to initialize:', error.message);
  }
}

/**
 * Create Express application
 */
function createApp() {
  const app = express();

  // Handle uncaught exceptions and unhandled rejections
  handleUncaughtException();

  // Trust proxy (for rate limiting and IP detection)
  app.set('trust proxy', 1);

  // Security middleware
  app.use(securityHeaders);
  app.use(cors(corsOptions));

  // Request parsing middleware
  app.use(express.json({ limit: config.securityConfig.requestSizeLimit }));
  app.use(express.urlencoded({ extended: true, limit: config.securityConfig.requestSizeLimit }));

  // Custom middleware
  app.use(requestSizeLimiter);
  app.use(sanitizeInput);
  app.use(logger.logRequest.bind(logger));

  // API routes
  app.use('/', routes);

  // Health check endpoint (before 404 handler)
  app.get('/ping', (_req, res) => {
    res.json({ 
      success: true, 
      message: 'pong', 
      timestamp: new Date().toISOString() 
    });
  });

  // 404 handler
  app.use(notFound);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Start the server with production-ready error handling
 */
async function startServer() {
  try {
    console.log('🚀 Starting GitaGPT API Server...');

    // Initialize enhanced services first
    await initializeServices();

    const app = createApp();

    const server = app.listen(config.port, async () => {
      logger.info(`GitaGPT API Server started`, {
        port: config.port,
        environment: config.nodeEnv,
        nodeVersion: process.version,
        pid: process.pid,
      });

      // Initialize services with better error handling
      const serviceStatus = [];

      // Initialize database
      if (database) {
        try {
          const dbInitialized = await database.initialize();
          serviceStatus.push(`Database: ${dbInitialized ? '✅ Connected' : '❌ Failed'}`);
          if (!dbInitialized) {
            console.error('❌ Database initialization failed - this may cause issues');
          }
        } catch (error) {
          serviceStatus.push(`Database: ❌ Failed (${error.message})`);
          console.error('❌ Database connection failed:', error.message);
        }
      } else {
        serviceStatus.push('Database: ❌ Service not loaded');
      }

      // Initialize cache
      if (cache) {
        try {
          const cacheInitialized = await cache.initialize();
          serviceStatus.push(`Cache: ${cacheInitialized ? '✅ Connected' : '❌ Failed'}`);

          // Start cache cleanup job
          if (cacheInitialized) {
            setInterval(() => {
              cache.cleanup().catch(error => {
                logger.error('Cache cleanup failed:', error);
              });
            }, 3600000); // Run every hour
          }
        } catch (error) {
          serviceStatus.push(`Cache: ❌ Failed (${error.message})`);
          console.warn('⚠️ Cache connection failed, continuing without cache:', error.message);
        }
      } else {
        serviceStatus.push('Cache: ❌ Service not loaded');
      }

    // Log configuration status
    logger.info('Configuration status', {
      hasOpenAIKey: !!config.openaiApiKey,
      hasElevenLabsKey: !!config.elevenLabsApiKey,
      hasGeminiKey: !!config.geminiApiKey,
      audioDir: config.audioConfig.outputDir,
      logLevel: config.logConfig.level,
    });

    console.log(`
🚀 GitaGPT API Server is running!
📍 Port: ${config.port}
🌍 Environment: ${config.nodeEnv}
📊 Health Check: http://localhost:${config.port}/api/v1/health
📚 API Docs: http://localhost:${config.port}/docs

💬 Chat API: http://localhost:${config.port}/api/v1/chat
🔗 Webhooks: http://localhost:${config.port}/api/webhooks

${!config.openaiApiKey ? '⚠️  Warning: OpenAI API key not configured' : '✅ OpenAI API key configured'}
${!config.elevenLabsApiKey ? '⚠️  Warning: ElevenLabs API key not configured' : '✅ ElevenLabs API key configured'}
${!config.geminiApiKey ? '⚠️  Warning: Gemini API key not configured' : '✅ Gemini API key configured'}

📊 Services Status:
${serviceStatus.join('\n')}
    `);
  });

  // Handle unhandled rejections
  handleUnhandledRejection(server);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
      logger.info('Process terminated');
      process.exit(0);
    });
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');

    // Stop queue consumers first
    if (queueConsumers) {
      try {
        await queueConsumers.stop();
        logger.info('Queue consumers stopped');
      } catch (error) {
        logger.error('Error stopping queue consumers:', error);
      }
    }

    // Stop message queue
    if (messageQueue) {
      try {
        await messageQueue.shutdown();
        logger.info('Message queue shutdown');
      } catch (error) {
        logger.error('Error shutting down message queue:', error);
      }
    }

    server.close(() => {
      logger.info('Process terminated');
      process.exit(0);
    });
  });

    return server;
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    logger.error('Server startup failed', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch(error => {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  });
}

export { createApp, startServer };
export default createApp();
