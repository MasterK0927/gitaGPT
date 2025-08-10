import cron from 'node-cron';
import logger from '../utils/logger.js';

/**
 * Cron Service for scheduled tasks
 * Handles background jobs and cleanup tasks
 */
class CronService {
  constructor() {
    this.jobs = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the cron service
   */
  async initialize() {
    try {
      logger.info('🕐 Initializing Cron Service...');
      
      // Schedule cleanup tasks
      this.scheduleCleanupTasks();
      
      this.initialized = true;
      logger.info('✅ Cron Service initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Cron Service:', error);
      throw error;
    }
  }

  /**
   * Schedule cleanup tasks
   */
  scheduleCleanupTasks() {
    // Daily cleanup at 2 AM
    const dailyCleanup = cron.schedule('0 2 * * *', async () => {
      try {
        logger.info('🧹 Running daily cleanup tasks...');
        await this.runDailyCleanup();
        logger.info('✅ Daily cleanup completed');
      } catch (error) {
        logger.error('❌ Daily cleanup failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.jobs.set('dailyCleanup', {
      name: 'Daily Cleanup',
      schedule: '0 2 * * *',
      task: dailyCleanup,
      running: false,
      lastRun: null,
      nextRun: null
    });

    // Start the job
    dailyCleanup.start();
    this.jobs.get('dailyCleanup').running = true;
  }

  /**
   * Run daily cleanup tasks
   */
  async runDailyCleanup() {
    try {
      // Update last run time
      const job = this.jobs.get('dailyCleanup');
      if (job) {
        job.lastRun = new Date().toISOString();
      }

      // Add cleanup logic here if needed
      logger.info('Daily cleanup tasks completed');
    } catch (error) {
      logger.error('Daily cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get jobs status
   */
  getJobsStatus() {
    const jobsArray = Array.from(this.jobs.entries()).map(([key, job]) => ({
      id: key,
      name: job.name,
      schedule: job.schedule,
      running: job.running,
      lastRun: job.lastRun,
      nextRun: job.nextRun
    }));

    return {
      initialized: this.initialized,
      totalJobs: this.jobs.size,
      jobs: jobsArray
    };
  }

  /**
   * Stop all cron jobs
   */
  async stop() {
    try {
      logger.info('🛑 Stopping Cron Service...');
      
      for (const [key, job] of this.jobs.entries()) {
        if (job.task && job.running) {
          job.task.stop();
          job.running = false;
          logger.info(`Stopped job: ${job.name}`);
        }
      }
      
      this.initialized = false;
      logger.info('✅ Cron Service stopped');
    } catch (error) {
      logger.error('❌ Failed to stop Cron Service:', error);
      throw error;
    }
  }

  /**
   * Trigger user cleanup manually (for testing)
   */
  async triggerUserCleanup() {
    try {
      logger.info('🧹 Manual user cleanup triggered...');
      
      // Placeholder for user cleanup logic
      // In a real implementation, this would clean up old user data
      const deletedCount = 0;
      
      logger.info(`✅ Manual user cleanup completed: ${deletedCount} users processed`);
      return deletedCount;
    } catch (error) {
      logger.error('❌ Manual user cleanup failed:', error);
      throw error;
    }
  }
}

// Create singleton instance
const cronService = new CronService();

export default cronService;
