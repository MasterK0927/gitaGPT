import { cacheService, CACHE_TTL } from './cacheService';
import { meditationAPI } from './meditationAPI';
import { apiClient } from '../lib/apiClient';
import { useAuthStore } from '../features/auth/stores/authStore';

/**
 * Cache Warming Service
 * Preloads critical data to improve user experience
 */
class CacheWarmingService {
  private isWarming = false;
  private warmingPromise: Promise<void> | null = null;

  /**
   * Warm cache with essential data for authenticated users
   */
  async warmCache(userId?: string): Promise<void> {
    if (!userId) {
      return;
    }

    if (this.isWarming) {
      return this.warmingPromise || Promise.resolve();
    }

    this.isWarming = true;

    this.warmingPromise = this.performCacheWarming(userId);

    try {
      await this.warmingPromise;
    } catch (error) {
    } finally {
      this.isWarming = false;
      this.warmingPromise = null;
    }
  }

  /**
   * Warm cache for meditation data
   */
  async warmMeditationCache(): Promise<void> {
    
    const warmupTasks = [
      {
        key: 'meditation:types:all',
        fetchFunction: () => meditationAPI.getTypes(true),
        priority: 10,
        description: 'Meditation types'
      },
      {
        key: 'meditation:sounds:all',
        fetchFunction: () => meditationAPI.getSounds(true),
        priority: 9,
        description: 'Meditation sounds'
      },
      {
        key: 'meditation:schedules:active',
        fetchFunction: () => meditationAPI.getSchedules(true, true),
        priority: 8,
        description: 'Active meditation schedules'
      },
      {
        key: 'meditation:stats',
        fetchFunction: () => meditationAPI.getStats(true),
        priority: 7,
        description: 'Meditation statistics'
      },
      {
        key: 'meditation:sessions:recent',
        fetchFunction: () => meditationAPI.getSessions(20, true),
        priority: 6,
        description: 'Recent meditation sessions'
      }
    ];

    await cacheService.warmCache(warmupTasks);
  }

  /**
   * Warm cache for chat data (requires authentication)
   */
  async warmChatCache(userId?: string): Promise<void> {
    if (!userId) {
      return;
    }


    try {
      const warmupTasks = [
        {
          key: `chat:user:${userId}:conversations:limit:10`,
          fetchFunction: async () => {
            const response = await apiClient.get('/api/v1/chat/conversations?limit=10');
            return response.data;
          },
          priority: 8,
          description: 'Recent conversations'
        },
        {
          key: `chat:user:${userId}:conversations:limit:5`,
          fetchFunction: async () => {
            const response = await apiClient.get('/api/v1/chat/conversations?limit=5');
            return response.data;
          },
          priority: 7,
          description: 'Top conversations'
        }
      ];

      await cacheService.warmCache(warmupTasks);
    } catch (error) {
    }
  }

  /**
   * Warm cache for user data (requires authentication)
   */
  async warmUserCache(userId?: string): Promise<void> {
    if (!userId) {
      return;
    }


    try {
      const user = useAuthStore.getState().user;
      if (!user) return;

      const warmupTasks = [
        {
          key: `user:${user.id}:profile`,
          fetchFunction: async () => {
            const response = await apiClient.get('/api/v1/user/profile');
            return response.data;
          },
          priority: 6,
          description: 'User profile'
        }
      ];

      await cacheService.warmCache(warmupTasks);
    } catch (error) {
    }
  }

  /**
   * Warm cache for system data
   */
  async warmSystemCache(): Promise<void> {
    
    try {
      const warmupTasks = [
        {
          key: 'system:health:status',
          fetchFunction: async () => {
            const response = await apiClient.get('/api/v1/health');
            return response.data;
          },
          priority: 3,
          description: 'System health status'
        }
      ];

      await cacheService.warmCache(warmupTasks);
    } catch (error) {
    }
  }

  /**
   * Perform the actual cache warming
   */
  private async performCacheWarming(userId: string): Promise<void> {
    const startTime = Date.now();

    try {

      // Warm caches in parallel for better performance
      await Promise.allSettled([
        this.warmMeditationCache(),
        this.warmChatCache(userId),
        this.warmUserCache(userId),
        this.warmSystemCache()
      ]);

      const duration = Date.now() - startTime;
      
      // Log cache statistics
      const stats = cacheService.getStats();
      
    } catch (error) {
      console.error('Cache warming error:', error);
      throw error;
    }
  }

  /**
   * Warm cache for specific route/page
   */
  async warmCacheForRoute(route: string): Promise<void> {
    
    switch (route) {
      case '/meditation':
        await this.warmMeditationCache();
        break;
      case '/chat':
        await this.warmChatCache();
        break;
      case '/dashboard':
        await Promise.allSettled([
          this.warmMeditationCache(),
          this.warmChatCache(),
          this.warmUserCache()
        ]);
        break;
      default:
        console.log(`No specific cache warming for route: ${route}`);
    }
  }

  /**
   * Get cache warming status
   */
  getStatus() {
    return {
      isWarming: this.isWarming,
      cacheStats: cacheService.getStats()
    };
  }

  /**
   * Clear all caches and optionally re-warm
   */
  async resetCache(reWarm = true): Promise<void> {
    
    cacheService.clear();
    
    if (reWarm) {
      await this.warmCache();
    }
  }

  /**
   * Schedule periodic cache refresh for critical data
   */
  startPeriodicRefresh(): void {
    // Refresh critical data every 5 minutes
    setInterval(async () => {
      try {
        
        // Refresh only the most critical data
        await Promise.allSettled([
          meditationAPI.getStats(true),
          meditationAPI.getSchedules(true, true)
        ]);
        
      } catch (error) {
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Preload data for upcoming user actions
   */
  async preloadForUserAction(action: string, context?: any): Promise<void> {
    
    switch (action) {
      case 'start_meditation':
        await Promise.allSettled([
          meditationAPI.getTypes(),
          meditationAPI.getSounds()
        ]);
        break;
      case 'view_chat_history':
        await this.warmChatCache();
        break;
      case 'create_schedule':
        await Promise.allSettled([
          meditationAPI.getTypes(),
          meditationAPI.getSounds()
        ]);
        break;
      default:
        console.log(`No preloading defined for action: ${action}`);
    }
  }
}

// Export singleton instance
export const cacheWarmingService = new CacheWarmingService();

export default cacheWarmingService;
