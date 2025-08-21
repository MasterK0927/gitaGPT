import logger from '../utils/logger.js';
import messageQueue from './messageQueue.js';
import database from './database.js';

/**
 * Queue Consumers
 * Handles processing of messages from various queue topics
 */
class QueueConsumers {
  constructor() {
    this.consumers = new Map();
    this.isRunning = false;
  }

  /**
   * Start all queue consumers
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Queue consumers are already running');
      return;
    }

    try {
      // Start email consumers
      await this.startEmailConsumers();

      // Start meditation consumers
      await this.startMeditationConsumers();

      // Start system consumers
      await this.startSystemConsumers();

      this.isRunning = true;
      logger.info('All queue consumers started successfully');
    } catch (error) {
      logger.error('Failed to start queue consumers:', error);
      throw error;
    }
  }

  /**
   * Stop all queue consumers
   */
  async stop() {
    if (!this.isRunning) return;

    try {
      // Unsubscribe all consumers
      for (const [topic, consumerIds] of this.consumers.entries()) {
        for (const consumerId of consumerIds) {
          messageQueue.unsubscribe(topic, consumerId);
        }
      }

      this.consumers.clear();
      this.isRunning = false;
      logger.info('All queue consumers stopped');
    } catch (error) {
      logger.error('Failed to stop queue consumers:', error);
    }
  }

  /**
   * Start email processing consumers
   */
  async startEmailConsumers() {
    const emailConsumerId = messageQueue.subscribe(
      'email',
      'email-processors',
      this.handleEmailMessage.bind(this),
      {
        batchSize: 5,
        autoAck: true,
        timeout: 30000
      }
    );

    this.addConsumer('email', emailConsumerId);
    logger.info('Email consumers started');
  }

  /**
   * Start meditation processing consumers
   */
  async startMeditationConsumers() {
    const meditationConsumerId = messageQueue.subscribe(
      'meditation',
      'meditation-processors',
      this.handleMeditationMessage.bind(this),
      {
        batchSize: 10,
        autoAck: true,
        timeout: 15000
      }
    );

    this.addConsumer('meditation', meditationConsumerId);
    logger.info('Meditation consumers started');
  }

  /**
   * Start system processing consumers
   */
  async startSystemConsumers() {
    const systemConsumerId = messageQueue.subscribe(
      'system',
      'system-processors',
      this.handleSystemMessage.bind(this),
      {
        batchSize: 1,
        autoAck: true,
        timeout: 10000
      }
    );

    this.addConsumer('system', systemConsumerId);
    logger.info('System consumers started');
  }

  /**
   * Handle email messages
   */
  async handleEmailMessage(message) {
    try {
      logger.debug('Processing email message', {
        messageId: message.id,
        type: message.payload.type
      });

      const { type, userEmail, userName, schedule } = message.payload;

      switch (type) {
        case 'meditation_schedule_created':
          logger.info(`🔄 QUEUE: Processing meditation_schedule_created for schedule: ${schedule.id}`);
          try {
            logger.info(`📧 QUEUE: Email service disabled, skipping email for schedule: ${schedule.id}`);
            logger.info(`✅ QUEUE: Email skipped, updating status to 'sent' for schedule: ${schedule.id}`);
            // Update email status to sent
            await database.updateScheduleEmailStatus(schedule.id, 'sent');
            logger.info(`✅ QUEUE: Email status updated to 'sent' for schedule: ${schedule.id}`);
          } catch (emailError) {
            logger.error(`❌ QUEUE: Email failed for schedule: ${schedule.id}`, emailError);
            // Update email status to failed
            logger.info(`❌ QUEUE: Updating email status to 'failed' for schedule: ${schedule.id}`);
            await database.updateScheduleEmailStatus(schedule.id, 'failed', emailError.message);
            logger.error(`❌ QUEUE: Email status updated to 'failed' for schedule: ${schedule.id}`);
            throw emailError; // Re-throw to trigger retry mechanism
          }
          break;

        case 'meditation_reminder':
          await this.sendMeditationReminder(userEmail, userName, schedule);
          break;

        case 'weekly_progress_report':
          await this.sendWeeklyProgressReport(userEmail, userName, message.payload.stats);
          break;

        default:
          logger.warn(`Unknown email message type: ${type}`);
      }

      logger.info('Email message processed successfully', {
        messageId: message.id,
        type,
        userEmail
      });

    } catch (error) {
      logger.error('Failed to process email message:', {
        messageId: message.id,
        error: error.message,
        payload: message.payload
      });
      throw error;
    }
  }

  /**
   * Handle meditation messages
   */
  async handleMeditationMessage(message) {
    try {
      logger.debug('Processing meditation message', {
        messageId: message.id,
        type: message.payload.type
      });

      const { type } = message.payload;

      switch (type) {
        case 'session_started':
          await this.handleSessionStarted(message.payload);
          break;

        case 'session_completed':
          await this.handleSessionCompleted(message.payload);
          break;

        case 'schedule_reminder':
          await this.handleScheduleReminder(message.payload);
          break;

        case 'streak_milestone':
          await this.handleStreakMilestone(message.payload);
          break;

        default:
          logger.warn(`Unknown meditation message type: ${type}`);
      }

      logger.info('Meditation message processed successfully', {
        messageId: message.id,
        type
      });

    } catch (error) {
      logger.error('Failed to process meditation message:', {
        messageId: message.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle system messages
   */
  async handleSystemMessage(message) {
    try {
      logger.debug('Processing system message', {
        messageId: message.id,
        type: message.payload.type
      });

      const { type } = message.payload;

      switch (type) {
        case 'health_check':
          await this.performHealthCheck(message.payload);
          break;

        case 'metrics_collection':
          await this.collectMetrics(message.payload);
          break;

        case 'cleanup_task':
          await this.performCleanup(message.payload);
          break;

        default:
          logger.warn(`Unknown system message type: ${type}`);
      }

      logger.info('System message processed successfully', {
        messageId: message.id,
        type
      });

    } catch (error) {
      logger.error('Failed to process system message:', {
        messageId: message.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send meditation reminder email
   */
  async sendMeditationReminder(userEmail, userName, schedule) {
    // Email service disabled - logging only
    logger.info('Meditation reminder (email disabled)', { userEmail, scheduleTitle: schedule.title });
  }

  /**
   * Send weekly progress report
   */
  async sendWeeklyProgressReport(userEmail, userName, stats) {
    // Email service disabled - logging only
    logger.info('Weekly progress report (email disabled)', { userEmail });
  }

  /**
   * Handle session started event
   */
  async handleSessionStarted(payload) {
    const { userId, sessionId, scheduleId } = payload;

    // Log session start for analytics
    logger.info('Meditation session started', { userId, sessionId, scheduleId });

    // Could trigger real-time notifications, analytics updates, etc.
  }

  /**
   * Handle session completed event
   */
  async handleSessionCompleted(payload) {
    const { userId, sessionId, duration, rating } = payload;

    // Log session completion
    logger.info('Meditation session completed', { userId, sessionId, duration, rating });

    // Check for streak milestones
    if (payload.newStreak && payload.newStreak % 7 === 0) {
      await messageQueue.publish('meditation', {
        type: 'streak_milestone',
        userId,
        streak: payload.newStreak
      }, { priority: 8 });
    }
  }

  /**
   * Handle schedule reminder
   */
  async handleScheduleReminder(payload) {
    const { userId, scheduleId, userEmail, userName, schedule } = payload;

    // Send reminder email
    await messageQueue.publish('email', {
      type: 'meditation_reminder',
      userEmail,
      userName,
      schedule
    }, { priority: 7 });
  }

  /**
   * Handle streak milestone
   */
  async handleStreakMilestone(payload) {
    const { userId, streak } = payload;

    logger.info(`User ${userId} reached ${streak}-day meditation streak!`);

    // TODO: Could send congratulatory email, unlock achievements, etc.
  }

  /**
   * Perform health check
   */
  async performHealthCheck(payload) {
    const health = messageQueue.getHealthStatus();
    logger.info('Queue health check completed', health);

    // TODO: Could store health metrics, send alerts if unhealthy, etc.
  }

  /**
   * Collect metrics
   */
  async collectMetrics(payload) {
    const metrics = messageQueue.getMetrics();
    logger.debug('Queue metrics collected', metrics);

    // TODO: Could store metrics in database, send to monitoring service, etc.
  }

  /**
   * Perform cleanup tasks
   */
  async performCleanup(payload) {
    logger.info('Performing queue cleanup tasks');

    // TODO: Could clean up old messages, dead letter queues, etc.
  }

  /**
   * Add consumer to tracking
   */
  addConsumer(topic, consumerId) {
    if (!this.consumers.has(topic)) {
      this.consumers.set(topic, []);
    }
    this.consumers.get(topic).push(consumerId);
  }

  /**
   * Get consumer status
   */
  getStatus() {
    const status = {
      isRunning: this.isRunning,
      consumers: {},
      totalConsumers: 0
    };

    for (const [topic, consumerIds] of this.consumers.entries()) {
      status.consumers[topic] = consumerIds.length;
      status.totalConsumers += consumerIds.length;
    }

    return status;
  }
}

export default new QueueConsumers();
