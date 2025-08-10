import cache from './cache.js';
import database from './database.js';
import logger from '../utils/logger.js';

/**
 * Service for managing conversation context with cache-first approach
 */
class ConversationContextService {
  constructor() {
    this.maxContextMessages = 20; // Maximum messages to keep in context
    this.cacheExpiry = 3600; // 1 hour cache expiry
    this.batchSize = 10; // Number of messages to batch before DB write
  }

  /**
   * Get conversation context (cache-first, then database)
   */
  async getConversationContext(conversationId, requestId) {
    try {
      logger.info(`🗄️ [${requestId}] Fetching conversation context`, { conversationId });
      
      // Try cache first
      const cachedContext = await this.getCachedContext(conversationId);
      if (cachedContext && cachedContext.length > 0) {
        logger.info(`✅ [${requestId}] Context loaded from cache`, { 
          messageCount: cachedContext.length,
          conversationId 
        });
        return cachedContext;
      }

      // Fallback to database
      logger.info(`💾 [${requestId}] Cache miss, loading from database`, { conversationId });
      const dbContext = await this.getDatabaseContext(conversationId);
      
      // Cache the database results for future use
      if (dbContext.length > 0) {
        await this.cacheContext(conversationId, dbContext);
        logger.info(`✅ [${requestId}] Context loaded from database and cached`, { 
          messageCount: dbContext.length,
          conversationId 
        });
      }

      return dbContext;
    } catch (error) {
      logger.error(`❌ [${requestId}] Failed to get conversation context`, {
        error: error.message,
        conversationId
      });
      return [];
    }
  }

  /**
   * Add message to conversation context (cache-first)
   */
  async addMessageToContext(conversationId, message, requestId) {
    try {
      logger.info(`📝 [${requestId}] Adding message to context`, { 
        conversationId,
        role: message.role,
        contentLength: message.content?.length || 0
      });

      // Add to cache immediately
      await this.addToCachedContext(conversationId, message);

      // Check if we should persist to database
      const cachedContext = await this.getCachedContext(conversationId);
      const pendingMessages = cachedContext.filter(msg => !msg.persisted);

      if (pendingMessages.length >= this.batchSize) {
        logger.info(`💾 [${requestId}] Batch size reached, persisting to database`, {
          conversationId,
          pendingCount: pendingMessages.length
        });
        await this.persistPendingMessages(conversationId, pendingMessages, requestId);
      }

      return true;
    } catch (error) {
      logger.error(`❌ [${requestId}] Failed to add message to context`, {
        error: error.message,
        conversationId,
        message: message.content?.substring(0, 100)
      });
      return false;
    }
  }

  /**
   * Get cached conversation context
   */
  async getCachedContext(conversationId) {
    try {
      const cacheKey = `conversation:${conversationId}:context`;
      const cached = await cache.get(cacheKey);
      
      if (cached) {
        const context = JSON.parse(cached);
        return Array.isArray(context) ? context : [];
      }
      
      return [];
    } catch (error) {
      logger.warn('Failed to get cached context', { error: error.message, conversationId });
      return [];
    }
  }

  /**
   * Cache conversation context
   */
  async cacheContext(conversationId, context) {
    try {
      const cacheKey = `conversation:${conversationId}:context`;
      
      // Keep only the most recent messages
      const trimmedContext = context.slice(-this.maxContextMessages);
      
      await cache.set(cacheKey, JSON.stringify(trimmedContext), this.cacheExpiry);
      return true;
    } catch (error) {
      logger.warn('Failed to cache context', { error: error.message, conversationId });
      return false;
    }
  }

  /**
   * Add message to cached context
   */
  async addToCachedContext(conversationId, message) {
    try {
      const currentContext = await this.getCachedContext(conversationId);
      
      // Add timestamp and pending flag
      const contextMessage = {
        ...message,
        timestamp: new Date().toISOString(),
        persisted: false
      };
      
      currentContext.push(contextMessage);
      
      // Keep only recent messages
      const trimmedContext = currentContext.slice(-this.maxContextMessages);
      
      await this.cacheContext(conversationId, trimmedContext);
      return true;
    } catch (error) {
      logger.warn('Failed to add to cached context', { error: error.message, conversationId });
      return false;
    }
  }

  /**
   * Get conversation context from database
   */
  async getDatabaseContext(conversationId) {
    try {
      const messages = await database.getConversationMessages(conversationId, this.maxContextMessages);
      
      return messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.created_at,
        persisted: true
      }));
    } catch (error) {
      logger.warn('Failed to get database context', { error: error.message, conversationId });
      return [];
    }
  }

  /**
   * Persist pending messages to database
   */
  async persistPendingMessages(conversationId, pendingMessages, requestId) {
    try {
      for (const message of pendingMessages) {
        await database.createMessage(conversationId, {
          content: message.content,
          role: message.role,
          audioUrl: message.audioUrl || null,
          lipsyncData: message.lipsyncData || null,
          facialExpression: message.facialExpression || null,
          animation: message.animation || null
        });
      }

      // Update cache to mark messages as persisted
      const cachedContext = await this.getCachedContext(conversationId);
      const updatedContext = cachedContext.map(msg => ({
        ...msg,
        persisted: true
      }));
      
      await this.cacheContext(conversationId, updatedContext);
      
      logger.info(`✅ [${requestId}] Persisted ${pendingMessages.length} messages to database`, {
        conversationId
      });
      
      return true;
    } catch (error) {
      logger.error(`❌ [${requestId}] Failed to persist pending messages`, {
        error: error.message,
        conversationId,
        messageCount: pendingMessages.length
      });
      return false;
    }
  }

  /**
   * Force persist all pending messages (called on app shutdown or periodically)
   */
  async flushPendingMessages(conversationId, requestId) {
    try {
      const cachedContext = await this.getCachedContext(conversationId);
      const pendingMessages = cachedContext.filter(msg => !msg.persisted);
      
      if (pendingMessages.length > 0) {
        logger.info(`🔄 [${requestId}] Flushing ${pendingMessages.length} pending messages`, {
          conversationId
        });
        await this.persistPendingMessages(conversationId, pendingMessages, requestId);
      }
      
      return true;
    } catch (error) {
      logger.error(`❌ [${requestId}] Failed to flush pending messages`, {
        error: error.message,
        conversationId
      });
      return false;
    }
  }

  /**
   * Format context for OpenAI API
   */
  formatContextForAI(context, systemPrompt) {
    const messages = [
      {
        role: "system",
        content: systemPrompt
      }
    ];

    // Add conversation history
    context.forEach(msg => {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    });

    return messages;
  }

  /**
   * Clean up old cached contexts (maintenance function)
   */
  async cleanupOldContexts() {
    try {
      // This would be implemented with Redis SCAN in a real scenario
      logger.info('Context cleanup would run here');
      return true;
    } catch (error) {
      logger.error('Failed to cleanup old contexts', { error: error.message });
      return false;
    }
  }
}

export default new ConversationContextService();
