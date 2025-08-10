/**
 * Enhanced Cache Service with TTL and Invalidation
 * Provides cache-first data fetching strategy for optimal performance
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  version: number;
}

interface CacheConfig {
  defaultTTL: number;
  maxSize: number;
  enableLogging: boolean;
  enableSystemLogs: boolean;
}

interface CacheLogEntry {
  timestamp: number;
  type: 'HIT' | 'MISS' | 'SET' | 'INVALIDATE' | 'EVICT' | 'CLEANUP';
  key: string;
  ttl?: number;
  size?: number;
  processingTime?: number;
  metadata?: any;
}

class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private config: CacheConfig;
  private accessLog = new Map<string, number>();
  private systemLogs: CacheLogEntry[] = [];
  private maxSystemLogs = 1000;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTTL: 5 * 60 * 1000, // 5 minutes default
      maxSize: 1000,
      enableLogging: process.env.NODE_ENV === 'development',
      enableSystemLogs: true,
      ...config
    };

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Get data from cache with cache-first strategy
   */
  async get<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: {
      ttl?: number;
      forceRefresh?: boolean;
      version?: number;
    } = {}
  ): Promise<T> {
    const cacheKey = this.normalizeKey(key);
    const { ttl = this.config.defaultTTL, forceRefresh = false, version = 1 } = options;

    // Track access for analytics
    this.trackAccess(cacheKey);

    // Check if we should force refresh
    if (forceRefresh) {
      this.log(`Force refresh for key: ${cacheKey}`);
      this.logToSystem('MISS', cacheKey, { reason: 'force_refresh', ttl });
      return this.fetchAndCache(cacheKey, fetchFunction, ttl, version);
    }

    // Try to get from cache first
    const startTime = Date.now();
    const cached = this.cache.get(cacheKey);

    if (cached) {
      // Check if cache entry is still valid
      if (this.isValid(cached) && cached.version >= version) {
        const processingTime = Date.now() - startTime;
        this.log(`Cache HIT for key: ${cacheKey}`);
        this.logToSystem('HIT', cacheKey, {
          processingTime,
          ttl: cached.ttl,
          age: Date.now() - cached.timestamp
        });
        return cached.data;
      } else {
        this.log(`Cache EXPIRED/OUTDATED for key: ${cacheKey}`);
        this.logToSystem('MISS', cacheKey, {
          reason: this.isValid(cached) ? 'outdated_version' : 'expired',
          ttl: cached.ttl
        });
        this.cache.delete(cacheKey);
      }
    }

    // Cache miss - fetch from source and cache
    this.log(`Cache MISS for key: ${cacheKey}`);
    this.logToSystem('MISS', cacheKey, { reason: 'not_found', ttl });
    return this.fetchAndCache(cacheKey, fetchFunction, ttl, version);
  }

  /**
   * Set data in cache directly
   */
  set<T>(key: string, data: T, ttl?: number, version = 1): void {
    const cacheKey = this.normalizeKey(key);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      version
    };

    // Ensure cache size limit
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    const dataSize = this.estimateDataSize(data);
    this.cache.set(cacheKey, entry);
    this.log(`Cache SET for key: ${cacheKey}`);
    this.logToSystem('SET', cacheKey, {
      ttl: entry.ttl,
      size: dataSize,
      version
    });
  }

  /**
   * Invalidate specific cache entries
   */
  invalidate(pattern: string | string[]): void {
    const patterns = Array.isArray(pattern) ? pattern : [pattern];
    let invalidatedCount = 0;

    patterns.forEach(p => {
      if (p.includes('*')) {
        // Wildcard pattern matching
        const regex = new RegExp(p.replace(/\*/g, '.*'));
        const keysToDelete = Array.from(this.cache.keys()).filter(key => regex.test(key));
        keysToDelete.forEach(key => {
          this.cache.delete(key);
          this.log(`Cache INVALIDATED (pattern): ${key}`);
          this.logToSystem('INVALIDATE', key, { pattern: p, type: 'wildcard' });
          invalidatedCount++;
        });
      } else {
        // Exact key match
        const normalizedKey = this.normalizeKey(p);
        if (this.cache.delete(normalizedKey)) {
          this.log(`Cache INVALIDATED: ${normalizedKey}`);
          this.logToSystem('INVALIDATE', normalizedKey, { pattern: p, type: 'exact' });
          invalidatedCount++;
        }
      }
    });

    if (invalidatedCount > 0) {
      this.logToSystem('INVALIDATE', `${patterns.join(', ')}`, {
        count: invalidatedCount,
        patterns: patterns
      });
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.accessLog.clear();
    this.log(`Cache CLEARED: ${size} entries removed`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    try {
      const now = Date.now();
      const entries = Array.from(this.cache.entries());

      return {
        totalEntries: this.cache.size,
        validEntries: entries.filter(([_, entry]) => this.isValid(entry)).length,
        expiredEntries: entries.filter(([_, entry]) => !this.isValid(entry)).length,
        memoryUsage: this.estimateMemoryUsage(),
        mostAccessed: this.getMostAccessedKeys(5),
        oldestEntry: entries.length > 0 ? Math.min(...entries.map(([_, entry]) => entry.timestamp)) : null,
        newestEntry: entries.length > 0 ? Math.max(...entries.map(([_, entry]) => entry.timestamp)) : null,
      };
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return {
        totalEntries: 0,
        validEntries: 0,
        expiredEntries: 0,
        memoryUsage: 0,
        mostAccessed: [],
        oldestEntry: null,
        newestEntry: null,
      };
    }
  }

  /**
   * Warm cache with predefined data
   */
  async warmCache(warmupTasks: Array<{
    key: string;
    fetchFunction: () => Promise<any>;
    ttl?: number;
    priority?: number;
  }>): Promise<void> {
    this.log('Starting cache warmup...');
    
    // Sort by priority (higher first)
    const sortedTasks = warmupTasks.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    const promises = sortedTasks.map(async task => {
      try {
        await this.get(task.key, task.fetchFunction, { ttl: task.ttl });
        this.log(`Cache warmed: ${task.key}`);
      } catch (error) {
        console.error(`Failed to warm cache for ${task.key}:`, error);
      }
    });

    await Promise.all(promises);
    this.log(`Cache warmup completed: ${warmupTasks.length} entries`);
  }

  /**
   * Private helper methods
   */
  private async fetchAndCache<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttl: number,
    version: number
  ): Promise<T> {
    try {
      const data = await fetchFunction();
      this.set(key, data, ttl, version);
      return data;
    } catch (error) {
      this.log(`Fetch failed for key: ${key}, error: ${error}`);
      throw error;
    }
  }

  private isValid(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  private normalizeKey(key: string): string {
    return key.toLowerCase().trim();
  }

  private trackAccess(key: string): void {
    const count = this.accessLog.get(key) || 0;
    this.accessLog.set(key, count + 1);
  }

  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.log(`Cache EVICTED (LRU): ${oldestKey}`);
    }
  }

  private cleanup(): void {
    const before = this.cache.size;
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (!this.isValid(entry)) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      this.cache.delete(key);
      this.logToSystem('CLEANUP', key, { reason: 'expired' });
    });

    if (expiredKeys.length > 0) {
      this.log(`Cache CLEANUP: ${expiredKeys.length} expired entries removed`);
      this.logToSystem('CLEANUP', 'batch', {
        count: expiredKeys.length,
        before,
        after: this.cache.size
      });
    }
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage in bytes
    let size = 0;
    for (const [key, entry] of this.cache.entries()) {
      size += key.length * 2; // UTF-16 characters
      size += JSON.stringify(entry.data).length * 2;
      size += 32; // Overhead for timestamp, ttl, version
    }
    return size;
  }

  private getMostAccessedKeys(limit: number): Array<{ key: string; count: number }> {
    return Array.from(this.accessLog.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([key, count]) => ({ key, count }));
  }

  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[CacheService] ${message}`);
    }
  }

  /**
   * Log cache operations to system logs for monitoring
   */
  private logToSystem(
    type: CacheLogEntry['type'],
    key: string,
    metadata: any = {}
  ): void {
    if (!this.config.enableSystemLogs) return;

    const logEntry: CacheLogEntry = {
      timestamp: Date.now(),
      type,
      key,
      ...metadata
    };

    this.systemLogs.push(logEntry);

    // Limit system logs size
    if (this.systemLogs.length > this.maxSystemLogs) {
      this.systemLogs.shift();
    }

    // Send to system monitor if available
    this.sendToSystemMonitor(logEntry);
  }

  /**
   * Send cache log to system monitor
   */
  private sendToSystemMonitor(logEntry: CacheLogEntry): void {
    try {
      // Send to system logs via custom event
      window.dispatchEvent(new CustomEvent('cache-log', {
        detail: {
          timestamp: new Date(logEntry.timestamp).toISOString(),
          level: 'info',
          category: 'cache',
          message: `Cache ${logEntry.type}: ${logEntry.key}`,
          metadata: {
            type: logEntry.type,
            key: logEntry.key,
            ttl: logEntry.ttl,
            size: logEntry.size,
            processingTime: logEntry.processingTime,
            ...logEntry.metadata
          }
        }
      }));
    } catch (error) {
      console.warn('Failed to send cache log to system monitor:', error);
    }
  }

  /**
   * Estimate data size in bytes
   */
  private estimateDataSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // UTF-16 characters
    } catch {
      return 0;
    }
  }

  /**
   * Get system logs for monitoring
   */
  getSystemLogs(limit = 100): CacheLogEntry[] {
    return this.systemLogs.slice(-limit);
  }

  /**
   * Get cache performance metrics
   */
  getPerformanceMetrics() {
    try {
      const logs = this.systemLogs;
      const now = Date.now();
      const lastHour = now - (60 * 60 * 1000);

      const recentLogs = logs.filter(log => log.timestamp > lastHour);
      const hits = recentLogs.filter(log => log.type === 'HIT').length;
      const misses = recentLogs.filter(log => log.type === 'MISS').length;
      const sets = recentLogs.filter(log => log.type === 'SET').length;

      const hitRate = hits + misses > 0 ? (hits / (hits + misses)) * 100 : 0;
      const avgProcessingTime = recentLogs
        .filter(log => log.processingTime)
        .reduce((sum, log) => sum + (log.processingTime || 0), 0) /
        Math.max(1, recentLogs.filter(log => log.processingTime).length);

      return {
        hitRate: Math.round(hitRate * 100) / 100,
        totalOperations: recentLogs.length,
        hits,
        misses,
        sets,
        avgProcessingTime: Math.round(avgProcessingTime * 100) / 100,
        cacheSize: this.cache.size,
        memoryUsage: this.estimateMemoryUsage()
      };
    } catch (error) {
      console.warn('Failed to get cache performance metrics:', error);
      return {
        hitRate: 0,
        totalOperations: 0,
        hits: 0,
        misses: 0,
        sets: 0,
        avgProcessingTime: 0,
        cacheSize: 0,
        memoryUsage: 0
      };
    }
  }

  /**
   * Clear system logs
   */
  clearSystemLogs(): void {
    this.systemLogs = [];
  }
}

// Cache TTL configurations for different data types
export const CACHE_TTL = {
  // Meditation data
  MEDITATION_SCHEDULES: 10 * 60 * 1000,    // 10 minutes
  MEDITATION_SESSIONS: 30 * 60 * 1000,     // 30 minutes
  MEDITATION_STATS: 5 * 60 * 1000,         // 5 minutes
  MEDITATION_TYPES: 24 * 60 * 60 * 1000,   // 24 hours (rarely changes)
  MEDITATION_SOUNDS: 24 * 60 * 60 * 1000,  // 24 hours (rarely changes)
  
  // User data
  USER_PROFILE: 15 * 60 * 1000,            // 15 minutes
  USER_STATS: 10 * 60 * 1000,              // 10 minutes
  
  // Chat data
  CHAT_HISTORY: 5 * 60 * 1000,             // 5 minutes
  CONVERSATIONS: 10 * 60 * 1000,           // 10 minutes
  
  // System data
  HEALTH_STATUS: 2 * 60 * 1000,            // 2 minutes
  SYSTEM_CONFIG: 60 * 60 * 1000,           // 1 hour
} as const;

// Cache key patterns for invalidation
export const CACHE_PATTERNS = {
  MEDITATION_USER: (userId: string) => `meditation:user:${userId}:*`,
  MEDITATION_SCHEDULES: (userId: string) => `meditation:schedules:${userId}`,
  MEDITATION_SESSIONS: (userId: string) => `meditation:sessions:${userId}:*`,
  MEDITATION_STATS: (userId: string) => `meditation:stats:${userId}`,
  USER_DATA: (userId: string) => `user:${userId}:*`,
  CHAT_DATA: (userId: string) => `chat:${userId}:*`,
} as const;

// Export singleton instance
export const cacheService = new CacheService({
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxSize: 2000,
  enableLogging: process.env.NODE_ENV === 'development'
});

export default cacheService;
