import config from '../config/index.js';

/**
 * Logger utility class
 */
class Logger {
  constructor() {
    this.logs = [];
    this.maxLogs = config.logConfig.maxLogs;
    // Will be set later to avoid circular imports
    this.database = null;
  }

  // Set database instance
  // called from app initialization
  setDatabase(databaseInstance) {
    this.database = databaseInstance;
  }

  /**
   * Log levels
   */
  static LEVELS = {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug',
  };

  /**
   * Format log message
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    return {
      timestamp,
      level,
      message,
      meta,
      pid: process.pid,
    };
  }

  /**
   * Add log to memory store and database
   */
  addToStore(logEntry) {
    // Add to memory store
    this.logs.push(logEntry);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Store in database
    // async, don't wait for it
    this.storeInDatabase(logEntry);
  }

  /**
   * Store log entry in database
   */
  async storeInDatabase(logEntry) {
    try {
      if (this.database && config.logConfig.logToDatabase) {
        await this.database.createLog({
          level: logEntry.level,
          message: logEntry.message,
          metadata: logEntry.meta,
          timestamp: logEntry.timestamp,
          pid: logEntry.pid
        });
      }
    } catch (error) {
      // Don't log database errors to avoid infinite loops
      console.error('Failed to store log in database:', error.message);
    }
  }

  /**
   * Log error message
   */
  error(message, meta = {}) {
    const logEntry = this.formatMessage(Logger.LEVELS.ERROR, message, meta);
    console.error(`[${logEntry.timestamp}] ERROR: ${message}`, meta);
    this.addToStore(logEntry);
    return logEntry;
  }

  /**
   * Log warning message
   */
  warn(message, meta = {}) {
    const logEntry = this.formatMessage(Logger.LEVELS.WARN, message, meta);
    console.warn(`[${logEntry.timestamp}] WARN: ${message}`, meta);
    this.addToStore(logEntry);
    return logEntry;
  }

  /**
   * Log info message
   */
  info(message, meta = {}) {
    const logEntry = this.formatMessage(Logger.LEVELS.INFO, message, meta);
    console.log(`[${logEntry.timestamp}] INFO: ${message}`, meta);
    this.addToStore(logEntry);
    return logEntry;
  }

  /**
   * Log debug message
   */
  debug(message, meta = {}) {
    if (config.isDevelopment) {
      const logEntry = this.formatMessage(Logger.LEVELS.DEBUG, message, meta);
      console.debug(`[${logEntry.timestamp}] DEBUG: ${message}`, meta);
      this.addToStore(logEntry);
      return logEntry;
    }
  }

  /**
   * Get recent logs
   */
  getLogs(limit = this.maxLogs) {
    return this.logs.slice(-limit);
  }

  /**
   * Clear logs
   */
  clearLogs() {
    const clearedCount = this.logs.length;
    this.logs = [];
    this.info(`Cleared ${clearedCount} log entries`);
    return clearedCount;
  }

  /**
   * Log request information
   */
  logRequest(req, res, next) {
    const start = Date.now();
    const { method, url, ip } = req;
    
    this.info(`${method} ${url}`, { ip, userAgent: req.get('User-Agent') });
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      
      if (statusCode >= 400) {
        this.warn(`${method} ${url} - ${statusCode} (${duration}ms)`, { ip, statusCode, duration });
      } else {
        this.info(`${method} ${url} - ${statusCode} (${duration}ms)`, { ip, statusCode, duration });
      }
    });
    
    next();
  }
}

export default new Logger();
