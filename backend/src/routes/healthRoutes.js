import express from 'express';
import { catchAsync } from '../middleware/errorHandler.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

// Import services with error handling
let OpenAIService, TTSService, AudioService, database, messageQueue, queueConsumers;

try {
  OpenAIService = (await import('../services/OpenAIService.js')).default;
} catch (error) {
  logger.warn('OpenAIService not available for health checks');
}

try {
  TTSService = (await import('../services/TTSService.js')).default;
} catch (error) {
  logger.warn('TTSService not available for health checks');
}

try {
  AudioService = (await import('../services/AudioService.js')).default;
} catch (error) {
  logger.warn('AudioService not available for health checks');
}

try {
  database = (await import('../services/database.js')).default;
} catch (error) {
  logger.warn('Database service not available for health checks');
}

try {
  messageQueue = (await import('../services/messageQueue.js')).default;
} catch (error) {
  logger.warn('MessageQueue service not available for health checks');
}

try {
  queueConsumers = (await import('../services/queueConsumers.js')).default;
} catch (error) {
  logger.warn('QueueConsumers service not available for health checks');
}


const router = express.Router();

/**
 * @route GET /api/v1/health
 * @desc Basic health check
 * @access Public
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
  });
});

/**
 * @route GET /api/v1/health/tts
 * @desc TTS service health check
 * @access Public
 */
router.get('/tts', catchAsync(async (req, res) => {
  const startTime = Date.now();

  try {
    // Check if TTS service is available
    if (!TTSService) {
      return res.status(503).json({
        success: false,
        status: 'unhealthy',
        service: 'tts',
        error: 'TTS service not available',
        responseTime: Date.now() - startTime
      });
    }

    // Check TTS service availability
    const availableProviders = TTSService.getAvailableProviders();
    const responseTime = Date.now() - startTime;

    // Test TTS generation with a short text
    let testResult = null;
    let activeProvider = null;

    if (availableProviders.length > 0) {
      try {
        const testText = "Test";
        testResult = await TTSService.generateSpeech(testText);
        activeProvider = availableProviders[0]; // First available provider
      } catch (error) {
        logger.warn('TTS test generation failed', { error: error.message });
      }
    }

    const status = availableProviders.length > 0 && testResult !== null ? 'online' :
                   availableProviders.length > 0 ? 'degraded' : 'offline';

    res.json({
      status,
      responseTime,
      availableProviders,
      activeProvider,
      hasAudio: testResult !== null,
      providersCount: availableProviders.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('TTS health check failed', { error: error.message });

    res.json({
      status: 'offline',
      responseTime,
      error: error.message,
      availableProviders: [],
      activeProvider: null,
      hasAudio: false,
      providersCount: 0,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * @route GET /api/v1/health/detailed
 * @desc Detailed health check with service status
 * @access Public
 */
router.get('/detailed', catchAsync(async (req, res) => {
  const startTime = Date.now();
  
  // Check services
  const checks = await Promise.allSettled([
    checkOpenAI(),
    checkTTSServices(),
    checkAudioService(),
    checkFileSystem(),
    checkMessageQueue(),
    checkQueueConsumers(),
  ]);

  const [openaiCheck, ttsCheck, audioCheck, filesystemCheck, queueCheck, consumersCheck] = checks;

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    responseTime: Date.now() - startTime,
    services: {
      openai: getCheckResult(openaiCheck),
      tts: getCheckResult(ttsCheck),
      audio: getCheckResult(audioCheck),
      filesystem: getCheckResult(filesystemCheck),
      messageQueue: getCheckResult(queueCheck),
      queueConsumers: getCheckResult(consumersCheck),
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    },
    config: {
      environment: config.nodeEnv,
      port: config.port,
      hasOpenAIKey: !!config.openaiApiKey,
      hasElevenLabsKey: !!config.elevenLabsApiKey,
    },
  };

  // Determine overall status
  const serviceStatuses = Object.values(health.services).map(s => s.status);
  if (serviceStatuses.includes('error')) {
    health.status = 'unhealthy';
  } else if (serviceStatuses.includes('warning')) {
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json({
    success: health.status !== 'unhealthy',
    data: health,
  });
}));

/**
 * Check OpenAI service
 */
async function checkOpenAI() {
  try {
    if (!config.openaiApiKey) {
      return { status: 'warning', message: 'API key not configured' };
    }

    const isValid = await OpenAIService.validateApiKey();
    return isValid
      ? { status: 'healthy', message: 'API key valid' }
      : { status: 'error', message: 'API key invalid' };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

/**
 * Check TTS services
 */
async function checkTTSServices() {
  try {
    const providerStatus = await TTSService.getProviderStatus();
    const availableProviders = TTSService.getAvailableProviders();

    if (availableProviders.length === 0) {
      return {
        status: 'error',
        message: 'No TTS providers configured',
        providers: providerStatus
      };
    }

    const healthyProviders = Object.entries(providerStatus)
      .filter(([_, status]) => status.available)
      .map(([name, _]) => name);

    if (healthyProviders.length === 0) {
      return {
        status: 'error',
        message: 'All TTS providers unavailable',
        providers: providerStatus
      };
    }

    return {
      status: 'healthy',
      message: `${healthyProviders.length} TTS provider(s) available: ${healthyProviders.join(', ')}`,
      providers: providerStatus
    };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

/**
 * Check audio service
 */
async function checkAudioService() {
  try {
    await AudioService.ensureAudioDirectory();
    
    // Check if we can get file info (tests file system access)
    const testResult = await AudioService.getFileInfo('test.mp3');
    
    return { 
      status: 'healthy', 
      message: 'Audio directory accessible',
      details: { audioDir: config.audioConfig.outputDir }
    };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

/**
 * Check file system
 */
async function checkFileSystem() {
  try {
    const fs = await import('fs');
    
    // Test write permissions
    const testFile = 'health-check-test.tmp';
    await fs.promises.writeFile(testFile, 'test');
    await fs.promises.unlink(testFile);
    
    return { status: 'healthy', message: 'File system accessible' };
  } catch (error) {
    return { status: 'error', message: `File system error: ${error.message}` };
  }
}

/**
 * Extract result from Promise.allSettled
 */
function getCheckResult(settledResult) {
  if (settledResult.status === 'fulfilled') {
    return settledResult.value;
  } else {
    return { 
      status: 'error', 
      message: settledResult.reason?.message || 'Check failed' 
    };
  }
}

/**
 * @route POST /api/v1/health/migrate-conversations
 * @desc Migrate conversations from development user to real user
 * @access Public (should be protected in production)
 */
router.post('/migrate-conversations', catchAsync(async (req, res) => {
  const { fromUserId, toUserId } = req.body;

  if (!fromUserId || !toUserId) {
    return res.status(400).json({
      success: false,
      error: 'Both fromUserId and toUserId are required'
    });
  }

  try {
    const result = await database.migrateConversationsToUser(fromUserId, toUserId);
    res.json({
      success: result.success,
      data: result,
      message: result.success
        ? `Migrated ${result.migratedCount} conversations successfully`
        : `Migration failed: ${result.error}`
    });
  } catch (error) {
    logger.error('Migration failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * @route POST /api/v1/health/cleanup-dev-data
 * @desc Clean up development/sample data
 * @access Public (should be protected in production)
 */
router.post('/cleanup-dev-data', catchAsync(async (req, res) => {
  try {
    const result = await database.cleanupDevelopmentData();
    res.json({
      success: true,
      data: result,
      message: `Cleaned up ${result.devUsersRemoved} development users and their data`
    });
  } catch (error) {
    logger.error('Cleanup failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * @route POST /api/v1/health/cleanup-users
 * @desc Manually trigger user cleanup (for testing)
 * @access Public (should be protected in production)
 */
// Cleanup users route removed - cronService no longer available

/**
 * Check message queue health
 */
async function checkMessageQueue() {
  try {
    const health = messageQueue.getHealthStatus();
    const metrics = messageQueue.getMetrics();

    return {
      status: health.status === 'healthy' ? 'healthy' : 'warning',
      details: {
        totalQueues: health.totalQueues,
        totalConsumers: health.totalConsumers,
        totalMessages: health.totalMessages,
        totalDeadLetters: health.totalDeadLetters,
        topics: health.topics,
        metrics: metrics
      }
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      details: 'Message queue service unavailable'
    };
  }
}

/**
 * Check queue consumers health
 */
async function checkQueueConsumers() {
  try {
    const status = queueConsumers.getStatus();

    return {
      status: status.isRunning ? 'healthy' : 'error',
      details: {
        isRunning: status.isRunning,
        totalConsumers: status.totalConsumers,
        consumers: status.consumers
      }
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      details: 'Queue consumers service unavailable'
    };
  }
}

/**
 * Check cron service
 */
// checkCronService function removed - cronService no longer available

export default router;
