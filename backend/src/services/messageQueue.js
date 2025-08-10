import EventEmitter from 'events';
import logger from '../utils/logger.js';

/**
 * Message Queue Service
 * A custom pub/sub message queue system with multiple scheduling algorithms
 */
class MessageQueue extends EventEmitter {
  constructor() {
    super();
    this.queues = new Map(); // topic -> queue
    this.consumers = new Map(); // topic -> consumers[]
    this.deadLetterQueue = new Map(); // topic -> failed messages
    this.metrics = new Map(); // topic -> metrics
    this.config = {
      maxRetries: 3,
      retryDelay: 1000, // ms
      maxQueueSize: 10000,
      consumerTimeout: 30000, // 30 seconds
      deadLetterQueueSize: 1000,
    };
    
    // Initialize system topics
    this.initializeTopics();
    
    // Start metrics collection
    this.startMetricsCollection();
    
    logger.info('Message Queue Service initialized');
  }

  /**
   * Initialize default topics
   */
  initializeTopics() {
    const topics = ['chat', 'meditation', 'email', 'system'];
    topics.forEach(topic => {
      this.createTopic(topic);
    });
  }

  /**
   * Create a new topic/queue
   */
  createTopic(topic, options = {}) {
    if (this.queues.has(topic)) {
      logger.warn(`Topic ${topic} already exists`);
      return;
    }

    const queueConfig = {
      algorithm: options.algorithm || 'FIFO', // FIFO, PRIORITY, ROUND_ROBIN
      maxSize: options.maxSize || this.config.maxQueueSize,
      partitions: options.partitions || 1,
      ...options
    };

    this.queues.set(topic, {
      messages: [],
      config: queueConfig,
      partitions: Array(queueConfig.partitions).fill(null).map(() => []),
      currentPartition: 0,
    });

    this.consumers.set(topic, []);
    this.deadLetterQueue.set(topic, []);
    this.metrics.set(topic, {
      messagesProduced: 0,
      messagesConsumed: 0,
      messagesInQueue: 0,
      consumerLag: 0,
      errorRate: 0,
      throughput: 0,
      lastActivity: Date.now(),
    });

    logger.info(`Created topic: ${topic}`, queueConfig);
  }

  /**
   * Publish a message to a topic
   */
  async publish(topic, message, options = {}) {
    try {
      if (!this.queues.has(topic)) {
        throw new Error(`Topic ${topic} does not exist`);
      }

      const queue = this.queues.get(topic);
      const metrics = this.metrics.get(topic);

      // Check queue size limit
      if (queue.messages.length >= queue.config.maxSize) {
        throw new Error(`Queue ${topic} is full`);
      }

      const messageObj = {
        id: this.generateMessageId(),
        topic,
        payload: message,
        timestamp: Date.now(),
        priority: options.priority || 0,
        partition: options.partition || this.selectPartition(topic, message),
        retries: 0,
        maxRetries: options.maxRetries || this.config.maxRetries,
        headers: options.headers || {},
        correlationId: options.correlationId,
      };

      // Add to appropriate queue based on algorithm
      this.addToQueue(topic, messageObj);

      // Update metrics
      metrics.messagesProduced++;
      metrics.messagesInQueue++;
      metrics.lastActivity = Date.now();

      // Emit event for consumers
      this.emit(`message:${topic}`, messageObj);

      logger.debug(`Message published to ${topic}`, {
        messageId: messageObj.id,
        partition: messageObj.partition
      });

      return messageObj.id;
    } catch (error) {
      logger.error(`Failed to publish message to ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to a topic with a consumer
   */
  subscribe(topic, consumerGroup, handler, options = {}) {
    try {
      if (!this.queues.has(topic)) {
        throw new Error(`Topic ${topic} does not exist`);
      }

      const consumer = {
        id: this.generateConsumerId(),
        group: consumerGroup,
        handler,
        options: {
          autoAck: options.autoAck !== false,
          batchSize: options.batchSize || 1,
          timeout: options.timeout || this.config.consumerTimeout,
          ...options
        },
        isActive: true,
        lastActivity: Date.now(),
      };

      const consumers = this.consumers.get(topic);
      consumers.push(consumer);

      // Start consuming messages
      this.startConsumer(topic, consumer);

      logger.info(`Consumer subscribed to ${topic}`, {
        consumerId: consumer.id,
        group: consumerGroup
      });

      return consumer.id;
    } catch (error) {
      logger.error(`Failed to subscribe to ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe a consumer
   */
  unsubscribe(topic, consumerId) {
    try {
      const consumers = this.consumers.get(topic);
      if (!consumers) return;

      const index = consumers.findIndex(c => c.id === consumerId);
      if (index !== -1) {
        consumers[index].isActive = false;
        consumers.splice(index, 1);
        logger.info(`Consumer unsubscribed from ${topic}`, { consumerId });
      }
    } catch (error) {
      logger.error(`Failed to unsubscribe from ${topic}:`, error);
    }
  }

  /**
   * Add message to queue based on scheduling algorithm
   */
  addToQueue(topic, message) {
    const queue = this.queues.get(topic);
    const algorithm = queue.config.algorithm;

    switch (algorithm) {
      case 'PRIORITY':
        this.addToPriorityQueue(queue, message);
        break;
      case 'ROUND_ROBIN':
        this.addToRoundRobinQueue(queue, message);
        break;
      case 'FIFO':
      default:
        queue.messages.push(message);
        break;
    }
  }

  /**
   * Priority queue implementation
   */
  addToPriorityQueue(queue, message) {
    const messages = queue.messages;
    let inserted = false;

    for (let i = 0; i < messages.length; i++) {
      if (message.priority > messages[i].priority) {
        messages.splice(i, 0, message);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      messages.push(message);
    }
  }

  /**
   * Round robin queue implementation
   */
  addToRoundRobinQueue(queue, message) {
    const partition = queue.currentPartition;
    queue.partitions[partition].push(message);
    queue.currentPartition = (queue.currentPartition + 1) % queue.partitions.length;
  }

  /**
   * Select partition for message
   */
  selectPartition(topic, message) {
    const queue = this.queues.get(topic);
    if (queue.config.partitions === 1) return 0;

    // Simple hash-based partitioning
    const hash = this.hashMessage(message);
    return hash % queue.config.partitions;
  }

  /**
   * Start consumer for processing messages
   */
  async startConsumer(topic, consumer) {
    const processMessages = async () => {
      if (!consumer.isActive) return;

      try {
        const messages = this.getMessagesForConsumer(topic, consumer);
        if (messages.length === 0) {
          // No messages, wait and retry
          setTimeout(processMessages, 100);
          return;
        }

        for (const message of messages) {
          await this.processMessage(topic, consumer, message);
        }

        consumer.lastActivity = Date.now();
        setTimeout(processMessages, 10); // Continue processing
      } catch (error) {
        logger.error(`Consumer error in ${topic}:`, error);
        setTimeout(processMessages, 1000); // Retry after delay
      }
    };

    processMessages();
  }

  /**
   * Get messages for a specific consumer
   */
  getMessagesForConsumer(topic, consumer) {
    const queue = this.queues.get(topic);
    const batchSize = consumer.options.batchSize;

    if (queue.config.algorithm === 'ROUND_ROBIN') {
      // Get from all partitions
      const messages = [];
      for (const partition of queue.partitions) {
        if (messages.length >= batchSize) break;
        const message = partition.shift();
        if (message) messages.push(message);
      }
      return messages;
    } else {
      // Get from main queue
      return queue.messages.splice(0, batchSize);
    }
  }

  /**
   * Process a single message
   */
  async processMessage(topic, consumer, message) {
    try {
      const startTime = Date.now();
      
      // Call consumer handler
      await Promise.race([
        consumer.handler(message),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Consumer timeout')), consumer.options.timeout)
        )
      ]);

      // Update metrics
      const metrics = this.metrics.get(topic);
      metrics.messagesConsumed++;
      metrics.messagesInQueue--;
      metrics.throughput = this.calculateThroughput(topic);

      logger.debug(`Message processed successfully`, {
        messageId: message.id,
        topic,
        processingTime: Date.now() - startTime
      });

    } catch (error) {
      logger.error(`Failed to process message ${message.id}:`, error);
      await this.handleMessageFailure(topic, message, error);
    }
  }

  /**
   * Handle message processing failure
   */
  async handleMessageFailure(topic, message, error) {
    message.retries++;
    message.lastError = error.message;

    if (message.retries < message.maxRetries) {
      // Retry message
      setTimeout(() => {
        this.addToQueue(topic, message);
        this.emit(`message:${topic}`, message);
      }, this.config.retryDelay * message.retries);

      logger.warn(`Retrying message ${message.id} (attempt ${message.retries})`);
    } else {
      // Move to dead letter queue
      const dlq = this.deadLetterQueue.get(topic);
      dlq.push({
        ...message,
        failedAt: Date.now(),
        error: error.message
      });

      // Limit DLQ size
      if (dlq.length > this.config.deadLetterQueueSize) {
        dlq.shift();
      }

      // Update error metrics
      const metrics = this.metrics.get(topic);
      metrics.errorRate = this.calculateErrorRate(topic);

      logger.error(`Message ${message.id} moved to dead letter queue after ${message.retries} retries`);
    }
  }

  /**
   * Get queue metrics
   */
  getMetrics(topic = null) {
    if (topic) {
      return this.metrics.get(topic) || null;
    }
    
    const allMetrics = {};
    for (const [topicName, metrics] of this.metrics.entries()) {
      allMetrics[topicName] = { ...metrics };
    }
    return allMetrics;
  }

  /**
   * Get queue health status
   */
  getHealthStatus() {
    const health = {
      status: 'healthy',
      topics: {},
      totalQueues: this.queues.size,
      totalConsumers: 0,
      totalMessages: 0,
      totalDeadLetters: 0,
    };

    for (const [topic, queue] of this.queues.entries()) {
      const metrics = this.metrics.get(topic);
      const consumers = this.consumers.get(topic);
      const dlq = this.deadLetterQueue.get(topic);

      health.topics[topic] = {
        messagesInQueue: queue.messages.length,
        consumers: consumers.length,
        deadLetters: dlq.length,
        errorRate: metrics.errorRate,
        throughput: metrics.throughput,
        lastActivity: metrics.lastActivity,
        status: this.getTopicHealth(topic)
      };

      health.totalConsumers += consumers.length;
      health.totalMessages += queue.messages.length;
      health.totalDeadLetters += dlq.length;
    }

    // Determine overall health
    const unhealthyTopics = Object.values(health.topics).filter(t => t.status !== 'healthy');
    if (unhealthyTopics.length > 0) {
      health.status = 'degraded';
    }

    return health;
  }

  /**
   * Get topic health status
   */
  getTopicHealth(topic) {
    const metrics = this.metrics.get(topic);
    const queue = this.queues.get(topic);
    const consumers = this.consumers.get(topic);

    // Check for issues
    if (consumers.length === 0 && queue.messages.length > 0) {
      return 'no_consumers';
    }
    
    if (metrics.errorRate > 0.1) { // 10% error rate
      return 'high_error_rate';
    }
    
    if (queue.messages.length > queue.config.maxSize * 0.8) {
      return 'queue_full';
    }
    
    if (Date.now() - metrics.lastActivity > 300000) { // 5 minutes
      return 'inactive';
    }

    return 'healthy';
  }

  /**
   * Utility methods
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateConsumerId() {
    return `consumer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  hashMessage(message) {
    const str = JSON.stringify(message);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  calculateThroughput(topic) {
    const metrics = this.metrics.get(topic);
    const timeWindow = 60000; // 1 minute
    const now = Date.now();
    
    // Simple throughput calculation (messages per minute)
    return metrics.messagesConsumed / ((now - (now - timeWindow)) / 60000);
  }

  calculateErrorRate(topic) {
    const dlq = this.deadLetterQueue.get(topic);
    const metrics = this.metrics.get(topic);
    
    if (metrics.messagesProduced === 0) return 0;
    return dlq.length / metrics.messagesProduced;
  }

  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    setInterval(() => {
      for (const [topic, metrics] of this.metrics.entries()) {
        metrics.throughput = this.calculateThroughput(topic);
        metrics.errorRate = this.calculateErrorRate(topic);
      }
    }, 10000); // Update every 10 seconds
  }

  /**
   * Cleanup resources
   */
  async shutdown() {
    logger.info('Shutting down Message Queue Service');
    
    // Stop all consumers
    for (const [topic, consumers] of this.consumers.entries()) {
      consumers.forEach(consumer => {
        consumer.isActive = false;
      });
    }

    // Clear all queues
    this.queues.clear();
    this.consumers.clear();
    this.deadLetterQueue.clear();
    this.metrics.clear();

    this.removeAllListeners();
  }
}

// Export singleton instance
export default new MessageQueue();
