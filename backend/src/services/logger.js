import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = ` ${JSON.stringify(meta)}`;
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Database transport for logging to Supabase
class DatabaseTransport extends winston.Transport {
  constructor(options = {}) {
    super(options);
    this.name = 'database';
    this.level = options.level || 'info';
    this.database = null;
    this.queue = [];
    this.processing = false;
  }

  setDatabase(database) {
    this.database = database;
    this.processQueue();
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    // Add to queue for database logging
    this.queue.push({
      level: info.level,
      message: info.message,
      meta: {
        timestamp: info.timestamp,
        service: info.service,
        requestId: info.requestId,
        userId: info.userId,
        ...info
      },
      userId: info.userId,
      requestId: info.requestId,
    });

    this.processQueue();
    callback();
  }

  async processQueue() {
    if (this.processing || !this.database || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      const batch = this.queue.splice(0, 10); // Process in batches of 10
      
      for (const logEntry of batch) {
        try {
          await this.database.createLog(logEntry);
        } catch (error) {
          // Don't log database errors to avoid recursion
          console.error('Failed to log to database:', error.message);
        }
      }
    } catch (error) {
      console.error('Error processing log queue:', error);
    } finally {
      this.processing = false;
      
      // Process remaining queue items
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 1000);
      }
    }
  }
}

// Create transports
const transports = [
  // Daily rotating file for errors
  new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '14d',
    zippedArchive: true,
  }),
  
  // Daily rotating file for all logs
  new DailyRotateFile({
    filename: path.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    zippedArchive: true,
  }),
];

// Add database transport if enabled
const databaseTransport = new DatabaseTransport({ level: 'info' });
if (process.env.LOG_TO_DATABASE === 'true') {
  transports.push(databaseTransport);
}

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  transports.push(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'gita-chatbot' },
  transports,
});

// Enhanced logging methods with context
const enhancedLogger = {
  ...logger,

  // Ensure basic methods are available
  info: logger.info.bind(logger),
  error: logger.error.bind(logger),
  warn: logger.warn.bind(logger),
  debug: logger.debug.bind(logger),

  // Set database for database transport
  setDatabase(database) {
    databaseTransport.setDatabase(database);
  },

  // Request-specific logging
  request(requestId, userId, message, meta = {}) {
    logger.info(message, { requestId, userId, ...meta });
  },

  // User-specific logging
  user(userId, message, meta = {}) {
    // Create a custom log entry with userId at the top level
    logger.log('info', message, { ...meta, userId });
  },

  // API logging
  api(method, path, statusCode, responseTime, userId, meta = {}) {
    logger.info(`${method} ${path} ${statusCode} ${responseTime}ms`, {
      method,
      path,
      statusCode,
      responseTime,
      userId,
      type: 'api',
      ...meta
    });
  },

  // Error logging with context
  errorWithContext(error, context = {}) {
    logger.error(error.message, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...context
    });
  },

  // Performance logging
  performance(operation, duration, meta = {}) {
    logger.info(`Performance: ${operation} took ${duration}ms`, {
      operation,
      duration,
      type: 'performance',
      ...meta
    });
  },

  // Security logging
  security(event, userId, meta = {}) {
    logger.warn(`Security event: ${event}`, {
      event,
      userId,
      type: 'security',
      ...meta
    });
  }
};

export default enhancedLogger;
