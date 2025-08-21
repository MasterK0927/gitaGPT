import Redis from 'ioredis';
import logger from './logger.js';

class CacheService {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    this.defaultTTL = parseInt(process.env.CACHE_TTL) || 3600; // 1 hour
    this.maxSize = parseInt(process.env.CACHE_MAX_SIZE) || 1000;
  }

  async initialize() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const redisPassword = process.env.REDIS_PASSWORD;

      this.redis = new Redis(redisUrl, {
        password: redisPassword,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000,
      });

      // Event handlers
      this.redis.on('connect', () => {
        logger.info('Redis connected');
        this.isConnected = true;
      });

      this.redis.on('error', (error) => {
        logger.warn('Redis connection failed, running without cache:', error.message);
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        logger.warn('Redis connection closed');
        this.isConnected = false;
      });

      // Test connection with timeout
      const connectionTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
      );

      await Promise.race([
        this.redis.ping(),
        connectionTimeout
      ]);

      logger.info('Cache service initialized successfully');
      return true;
    } catch (error) {
      logger.warn('Cache service unavailable, running without Redis:', error.message);
      this.isConnected = false;
      this.redis = null;
      return false; // Return false but don't crash
    }
  }

  // Basic cache operations
  async get(key) {
    try {
      if (!this.isConnected) return null;

      logger.debug('🔍 Redis Operation: GET', {
        operation: 'GET',
        key,
        connected: this.isConnected
      });

      const value = await this.redis.get(key);
      if (value) {
        const parsed = JSON.parse(value);
        logger.debug('✅ Redis Operation: GET success', {
          operation: 'GET',
          key,
          found: true,
          size: value.length
        });
        return parsed;
      }

      logger.debug('🔍 Redis Operation: GET miss', {
        operation: 'GET',
        key,
        found: false
      });
      return null;
    } catch (error) {
      logger.error('❌ Redis Operation: GET failed', {
        operation: 'GET',
        key,
        error: error.message
      });
      return null;
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    try {
      if (!this.isConnected) return false;

      const serialized = JSON.stringify(value);

      logger.debug('🔄 Redis Operation: SET', {
        operation: 'SET',
        key,
        ttl,
        size: serialized.length,
        connected: this.isConnected
      });

      await this.redis.setex(key, ttl, serialized);

      logger.debug('✅ Redis Operation: SET success', {
        operation: 'SET',
        key,
        ttl,
        size: serialized.length
      });

      return true;
    } catch (error) {
      logger.error('❌ Redis Operation: SET failed', {
        operation: 'SET',
        key,
        ttl,
        error: error.message
      });
      return false;
    }
  }

  async del(key) {
    try {
      if (!this.isConnected) return false;

      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async exists(key) {
    try {
      if (!this.isConnected) return false;

      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  // Message caching with LRU eviction
  async cacheMessage(conversationId, message) {
    try {
      const key = `messages:${conversationId}`;
      const messagesKey = `${key}:list`;
      const metaKey = `${key}:meta`;

      // Get current messages
      const messages = await this.get(messagesKey) || [];
      
      // Add new message
      messages.push({
        ...message,
        timestamp: new Date().toISOString(),
        cached_at: Date.now()
      });

      // Implement LRU eviction - keep only recent messages
      const maxMessages = 50;
      if (messages.length > maxMessages) {
        messages.splice(0, messages.length - maxMessages);
      }

      // Cache messages with longer TTL for recent conversations
      await this.set(messagesKey, messages, 7200); // 2 hours

      // Update metadata
      await this.set(metaKey, {
        lastUpdated: new Date().toISOString(),
        messageCount: messages.length,
        conversationId
      }, 7200);

      return true;
    } catch (error) {
      logger.error(`Error caching message for conversation ${conversationId}:`, error);
      return false;
    }
  }

  async getCachedMessages(conversationId) {
    try {
      const key = `messages:${conversationId}:list`;
      return await this.get(key) || [];
    } catch (error) {
      logger.error(`Error getting cached messages for conversation ${conversationId}:`, error);
      return [];
    }
  }

  // User session caching
  async cacheUserSession(userId, sessionData) {
    try {
      const key = `session:${userId}`;
      await this.set(key, sessionData, 1800); // 30 minutes
      return true;
    } catch (error) {
      logger.error(`Error caching user session for ${userId}:`, error);
      return false;
    }
  }

  async getUserSession(userId) {
    try {
      const key = `session:${userId}`;
      return await this.get(key);
    } catch (error) {
      logger.error(`Error getting user session for ${userId}:`, error);
      return null;
    }
  }

  // Rate limiting
  async checkRateLimit(identifier, limit = 100, window = 900) { // 100 requests per 15 minutes
    try {
      if (!this.isConnected) return { allowed: true, remaining: limit };

      const key = `rate_limit:${identifier}`;
      const current = await this.redis.incr(key);
      
      if (current === 1) {
        await this.redis.expire(key, window);
      }

      const remaining = Math.max(0, limit - current);
      const allowed = current <= limit;

      return { allowed, remaining, current };
    } catch (error) {
      logger.error(`Rate limit check error for ${identifier}:`, error);
      return { allowed: true, remaining: limit };
    }
  }

  // Conversation metadata caching
  async cacheConversationMeta(userId, conversations) {
    try {
      const key = `conversations:${userId}`;
      await this.set(key, conversations, 1800); // 30 minutes
      return true;
    } catch (error) {
      logger.error(`Error caching conversations for user ${userId}:`, error);
      return false;
    }
  }

  async getCachedConversations(userId) {
    try {
      const key = `conversations:${userId}`;
      return await this.get(key);
    } catch (error) {
      logger.error(`Error getting cached conversations for user ${userId}:`, error);
      return null;
    }
  }

  // Health and monitoring
  async getStats() {
    try {
      if (!this.isConnected) return null;

      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      
      return {
        connected: this.isConnected,
        memory: info,
        keyspace: keyspace,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return null;
    }
  }

  // Cleanup operations
  async cleanup() {
    try {
      if (!this.isConnected) return;

      // Clean up expired keys 
      // Redis handles this automatically
      // but force it
      const keys = await this.redis.keys('*');
      logger.info(`Cache contains ${keys.length} keys`);

      // Clean up old message caches (older than 24 hours)
      const messageKeys = await this.redis.keys('messages:*:meta');
      let cleanedCount = 0;

      for (const key of messageKeys) {
        const meta = await this.get(key);
        if (meta && meta.lastUpdated) {
          const age = Date.now() - new Date(meta.lastUpdated).getTime();
          if (age > 24 * 60 * 60 * 1000) { // 24 hours
            const conversationId = meta.conversationId;
            await this.del(`messages:${conversationId}:list`);
            await this.del(key);
            cleanedCount++;
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} old message caches`);
      }
    } catch (error) {
      logger.error('Error during cache cleanup:', error);
    }
  }

  // List operations for message queues
  async lpush(key, value) {
    try {
      return await this.redis.lpush(key, value);
    } catch (error) {
      logger.error('LPUSH failed:', error);
      return 0;
    }
  }

  async lrange(key, start, stop) {
    try {
      return await this.redis.lrange(key, start, stop);
    } catch (error) {
      logger.error('LRANGE failed:', error);
      return [];
    }
  }

  async ltrim(key, start, stop) {
    try {
      return await this.redis.ltrim(key, start, stop);
    } catch (error) {
      logger.error('LTRIM failed:', error);
      return false;
    }
  }

  async expire(key, seconds) {
    try {
      return await this.redis.expire(key, seconds);
    } catch (error) {
      logger.error('EXPIRE failed:', error);
      return false;
    }
  }

  async pipeline() {
    return this.redis.pipeline();
  }

  // Health check
  async healthCheck() {
    try {
      if (!this.isConnected) return false;
      await this.redis.ping();
      return true;
    } catch (error) {
      logger.error('Cache health check failed:', error);
      return false;
    }
  }

  async disconnect() {
    try {
      if (this.redis) {
        await this.redis.quit();
        logger.info('Cache service disconnected');
      }
    } catch (error) {
      logger.error('Error disconnecting cache service:', error);
    }
  }
}

export default new CacheService();
