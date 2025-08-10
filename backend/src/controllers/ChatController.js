import OpenAIService from '../services/OpenAIService.js';
import FallbackChatService from '../services/FallbackChatService.js';
import ConversationContextService from '../services/ConversationContextService.js';
import TTSService from '../services/TTSService.js';
import AudioService from '../services/AudioService.js';
import logger from '../utils/logger.js';
import { ValidationError, ExternalAPIError } from '../utils/errors.js';
import { catchAsync } from '../middleware/errorHandler.js';
import database from '../services/database.js';
import cache from '../services/cache.js';

/**
 * Chat controller for handling chat-related requests
 */
class ChatController {
  /**
   * Handle chat requests
   */
  chat = catchAsync(async (req, res) => {
    const startTime = Date.now();
    const { message: userMessage, conversationId } = req.body;
    const requestId = req.headers['x-request-id'] || Date.now().toString();
    const user = req.user; // From syncUser middleware

    logger.info(`🚀 [${requestId}] Chat request received`, {
      requestId,
      hasMessage: !!userMessage,
      messageLength: userMessage?.length || 0,
      ip: req.ip,
      userId: user?.id,
      conversationId,
      hasUser: !!user,
      authUserId: req.auth?.userId,
      body: req.body,
      headers: {
        'content-type': req.get('content-type'),
        'authorization': req.get('authorization') ? 'Bearer [REDACTED]' : 'None'
      }
    });

    // Check if user exists
    if (!user) {
      logger.error(`❌ [${requestId}] No user found in request`, {
        authUserId: req.auth?.userId,
        hasAuth: !!req.auth
      });
      return res.status(400).json({
        success: false,
        error: 'User not found. Please ensure you are authenticated.',
        requestId
      });
    }

    // Handle initial greeting (no message)
    if (!userMessage) {
      const introMessages = await this.getIntroMessages();
      return res.json({
        success: true,
        data: { messages: introMessages },
        requestId,
      });
    }

    // Validate API keys
    if (!OpenAIService.client.apiKey || OpenAIService.client.apiKey === '-') {
      const apiKeyMessages = await this.getApiKeyMessages();
      return res.json({
        success: true,
        data: { messages: apiKeyMessages },
        requestId,
      });
    }

    try {
      // Get or create conversation (non-blocking for development)
      logger.info(`💾 [${requestId}] Getting/creating conversation...`);
      const dbStart = Date.now();
      let currentUserMessageId = null; // Will store the user message ID for AI responses

      let currentConversationId = conversationId;

      // Create/get conversation in database
      if (!currentConversationId) {
        // No conversation ID provided - create new conversation
        const conversation = await database.createConversation(user.id, 'New Chat');
        currentConversationId = conversation.id;
        logger.info(`✅ [${requestId}] Created new conversation in ${Date.now() - dbStart}ms`, {
          conversationId: currentConversationId
        });
      } else {
        // Conversation ID provided - verify it exists and belongs to user
        const existingConversations = await database.getConversations(user.id, 1000);
        const existingConversation = existingConversations.find(c => c.id === currentConversationId);

        if (!existingConversation) {
          // Conversation doesn't exist or doesn't belong to user - create new one
          logger.info(`⚠️ [${requestId}] Conversation ${currentConversationId} not found, creating new one`);
          const conversation = await database.createConversation(user.id, 'New Chat');
          currentConversationId = conversation.id;
          logger.info(`✅ [${requestId}] Created new conversation in ${Date.now() - dbStart}ms`, {
            conversationId: currentConversationId
          });
        } else {
          logger.info(`✅ [${requestId}] Using existing conversation in ${Date.now() - dbStart}ms`, {
            conversationId: currentConversationId
          });
        }
      }

      // Get conversation context (cache-first)
      logger.info(`🗄️ [${requestId}] Loading conversation context...`);
      const contextStart = Date.now();
      const conversationContext = await ConversationContextService.getConversationContext(
        currentConversationId,
        requestId
      );
      logger.info(`✅ [${requestId}] Context loaded in ${Date.now() - contextStart}ms`, {
        contextMessageCount: conversationContext.length
      });

      // Add user message to context immediately
      await ConversationContextService.addMessageToContext(
        currentConversationId,
        { role: 'user', content: userMessage },
        requestId
      );

      // Generate AI response with context and fallback
      logger.info(`🤖 [${requestId}] Generating AI response with context...`);
      const aiStart = Date.now();
      let messages;
      let aiService = 'openai';

      try {
        // Use context-aware generation
        messages = await OpenAIService.generateChatCompletionWithContext(
          userMessage,
          conversationContext
        );
        logger.info(`✅ [${requestId}] OpenAI response generated in ${Date.now() - aiStart}ms`);
      } catch (error) {
        const errorType = error.message.includes('timeout') ? 'timeout' :
                         error.message.includes('quota') || error.message.includes('429') ? 'quota' : 'other';

        logger.warn(`⚠️ [${requestId}] OpenAI failed (${errorType}), using fallback service`, {
          error: error.message,
          errorType,
          fallbackTime: Date.now() - aiStart
        });

        // Use fallback service with context
        aiService = 'fallback';
        messages = await FallbackChatService.generateChatCompletion(userMessage, {
          context: conversationContext,
          contextAware: true,
          allowMultipleResponses: true // Allow multiple responses even in context-aware mode
        });
        logger.info(`✅ [${requestId}] Fallback response generated in ${Date.now() - aiStart}ms`);
      }

      const aiTime = Date.now() - aiStart;
      logger.info(`🎯 [${requestId}] AI response completed using ${aiService} in ${aiTime}ms`, {
        messageCount: messages.length,
        service: aiService
      });

      // Add AI messages to context
      for (const message of messages) {
        await ConversationContextService.addMessageToContext(
          currentConversationId,
          {
            role: 'assistant',
            content: message.text,
            facialExpression: message.facialExpression,
            animation: message.animation
          },
          requestId
        );
      }

      // Save user message to database (non-blocking)
      logger.info(`💾 [${requestId}] Saving user message to database...`);
      const saveStart = Date.now();
      try {
        const userMessageRecord = await database.createUserMessage(currentConversationId, userMessage);
        currentUserMessageId = userMessageRecord.id;
        logger.info(`✅ [${requestId}] User message saved in ${Date.now() - saveStart}ms`, {
          userMessageId: currentUserMessageId
        });
      } catch (dbError) {
        logger.warn(`⚠️ [${requestId}] Failed to save user message to database`, {
          error: dbError.message,
          conversationId: currentConversationId
        });
        // Continue processing even if database save fails
      }

      // Cache user message for quick access (non-blocking)
      logger.info(`🗄️ [${requestId}] Caching user message...`);
      const cacheStart = Date.now();
      try {
        const cacheKey = `conversation:${currentConversationId}:messages`;
        await cache.lpush(cacheKey, JSON.stringify({
          content: userMessage,
          role: 'user',
          timestamp: new Date().toISOString()
        }));
        await cache.expire(cacheKey, 3600); // 1 hour expiry
        logger.info(`✅ [${requestId}] User message cached in ${Date.now() - cacheStart}ms`);
      } catch (cacheError) {
        logger.warn(`⚠️ [${requestId}] Failed to cache user message`, {
          error: cacheError.message
        });
        // Continue processing even if cache fails
      }
      
      // Process messages with optimized audio pipeline
      logger.info(`🎵 [${requestId}] Starting optimized audio processing for ${messages.length} messages...`);
      const audioProcessingStart = Date.now();

      // Check if we should use lightweight audio processing
      const lightweightMode = req.query.lightweight === 'true' || messages.length > 2;

      const processedMessages = await Promise.all(
        messages.map(async (message, index) => {
          const messageStart = Date.now();
          logger.info(`🎵 [${requestId}] Processing message ${index + 1}/${messages.length}...`);

          try {
            // Check cache for TTS first
            const ttsCache = await this.checkTTSCache(message.text);
            let audioBuffer;
            let ttsTime = 0;

            if (ttsCache) {
              logger.info(`🗄️ [${requestId}] Using cached TTS for message ${index + 1}`);
              audioBuffer = Buffer.from(ttsCache, 'base64');
            } else {
              // Generate speech using unified TTS service with timeout
              logger.info(`🗣️ [${requestId}] Generating TTS for message ${index + 1}...`);
              const ttsStart = Date.now();

              try {
                // Add timeout to TTS generation (10 seconds max)
                const ttsTimeout = new Promise((_, reject) => {
                  setTimeout(() => reject(new Error('TTS timeout')), 10000);
                });

                audioBuffer = await Promise.race([
                  TTSService.generateSpeech(message.text),
                  ttsTimeout
                ]);

                ttsTime = Date.now() - ttsStart;

                // Cache the TTS result
                if (audioBuffer) {
                  await this.cacheTTSResult(message.text, audioBuffer.toString('base64'));
                }

                logger.info(`✅ [${requestId}] TTS generated for message ${index + 1} in ${ttsTime}ms`, {
                  bufferSize: audioBuffer ? audioBuffer.length : 0,
                  textLength: message.text.length,
                  hasAudio: !!audioBuffer
                });
              } catch (ttsError) {
                ttsTime = Date.now() - ttsStart;
                logger.warn(`⚠️ [${requestId}] TTS failed for message ${index + 1} in ${ttsTime}ms, continuing without audio`, {
                  error: ttsError.message,
                  textLength: message.text.length,
                  errorType: ttsError.name || 'TTSError'
                });
                audioBuffer = null; // Continue without audio - this is expected and OK
              }
            }

            // For lightweight mode, skip complex audio processing
            if (lightweightMode) {
              logger.info(`⚡ [${requestId}] Using lightweight mode for message ${index + 1}`);
              const messageTime = Date.now() - messageStart;

              return {
                ...message,
                audio: audioBuffer ? audioBuffer.toString('base64') : null,
                lipsync: null, // Skip lip sync in lightweight mode
                audioError: null, // Don't show error for missing audio - it's optional
                processingMode: 'lightweight'
              };
            }

            // Full audio processing pipeline
            if (!audioBuffer) {
              logger.warn(`⚠️ [${requestId}] No audio buffer for message ${index + 1}, skipping audio processing`);
              return {
                ...message,
                audio: null,
                lipsync: null,
                audioError: 'TTS service unavailable',
                processingMode: 'no-audio'
              };
            }

            logger.info(`🔧 [${requestId}] Processing full audio pipeline for message ${index + 1}...`);
            const pipelineStart = Date.now();

            // Use optimized audio processing
            const audioFiles = await AudioService.processAudioOptimized(audioBuffer, index, requestId);
            const pipelineTime = Date.now() - pipelineStart;

            logger.info(`✅ [${requestId}] Audio pipeline completed for message ${index + 1} in ${pipelineTime}ms`);

            // Read processed files
            logger.info(`📖 [${requestId}] Reading processed files for message ${index + 1}...`);
            const readStart = Date.now();
            const [audioBase64, lipSyncData] = await Promise.all([
              AudioService.readAudioAsBase64(audioFiles.mp3File),
              AudioService.readLipSyncData(audioFiles.lipSyncFile),
            ]);
            const readTime = Date.now() - readStart;

            const messageTime = Date.now() - messageStart;
            logger.info(`✅ [${requestId}] Message ${index + 1} fully processed in ${messageTime}ms`, {
              messageIndex: index,
              audioSize: audioBase64.length,
              hasLipSync: !!lipSyncData,
              breakdown: {
                tts: ttsTime,
                pipeline: pipelineTime,
                fileRead: readTime
              }
            });

            return {
              ...message,
              audio: audioBase64,
              lipsync: lipSyncData,
              processingMode: 'full'
            };
          } catch (error) {
            logger.error(`❌ [${requestId}] Failed to process message ${index + 1} audio`, {
              messageIndex: index,
              error: error.message,
              stack: error.stack
            });

            // Simplified fallback - just return TTS audio with timeout
            try {
              const fallbackTimeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Fallback TTS timeout')), 5000); // 5 second timeout
              });

              const audioBuffer = await Promise.race([
                TTSService.generateSpeech(message.text),
                fallbackTimeout
              ]);

              logger.warn(`🔄 [${requestId}] Using simplified fallback for message ${index + 1}`);

              return {
                ...message,
                audio: audioBuffer ? audioBuffer.toString('base64') : null,
                lipsync: null,
                audioError: null, // Don't show TTS errors - audio is optional
                processingMode: 'fallback'
              };
            } catch (fallbackError) {
              logger.error(`❌ [${requestId}] Complete audio failure for message ${index + 1}`, {
                messageIndex: index,
                error: fallbackError.message
              });

              return {
                ...message,
                audio: null,
                lipsync: null,
                audioError: 'Audio processing completely failed',
                processingMode: 'failed'
              };
            }
          }
        })
      );

      const totalAudioTime = Date.now() - audioProcessingStart;
      logger.info(`✅ [${requestId}] All audio processing completed in ${totalAudioTime}ms`);

      // Save AI responses to database and cache (non-blocking)
      logger.info(`💾 [${requestId}] Saving ${processedMessages.length} AI responses to database and cache...`);
      const saveResponsesStart = Date.now();
      let saveResponsesTime = 0;
      let successfulSaves = 0;
      let failedSaves = 0;

      try {
        for (let i = 0; i < processedMessages.length; i++) {
          const message = processedMessages[i];
          const responseOrder = i + 1; // Start from 1 for first response, increment for each subsequent response

          // Save AI response to database (requires user message ID) - with individual error handling
          if (currentUserMessageId) {
            try {
              await database.createAIResponse(currentUserMessageId, {
                content: message.text,
                audioUrl: message.audio ? `data:audio/mp3;base64,${message.audio}` : null,
                lipsyncData: message.lipsync,
                facialExpression: message.facialExpression,
                animation: message.animation,
                processingMode: message.processingMode || 'standard',
                responseOrder: responseOrder // Properly increment response order for multiple responses
              });

              logger.info(`💾 [${requestId}] Saved AI response ${responseOrder}/${processedMessages.length} for user message: ${currentUserMessageId}`);
              successfulSaves++;
            } catch (dbError) {
              logger.error(`❌ [${requestId}] Failed to save AI response ${responseOrder}/${processedMessages.length}`, {
                error: dbError.message,
                userMessageId: currentUserMessageId,
                responseOrder,
                content: message.text.substring(0, 100) + '...'
              });
              failedSaves++;
              // Continue with next response even if this one fails
            }
          } else {
            logger.warn(`⚠️ [${requestId}] Cannot save AI response - no user message ID`);
          }

          // Cache AI message - also with individual error handling
          try {
            await cache.lpush(cacheKey, JSON.stringify({
              content: message.text,
              role: 'assistant',
              audio: message.audio,
              lipsync: message.lipsync,
              facialExpression: message.facialExpression,
              animation: message.animation,
              timestamp: new Date().toISOString()
            }));
          } catch (cacheError) {
            logger.warn(`⚠️ [${requestId}] Failed to cache AI response ${responseOrder}`, {
              error: cacheError.message
            });
            // Continue even if caching fails
          }
        }

        saveResponsesTime = Date.now() - saveResponsesStart;
        logger.info(`✅ [${requestId}] AI responses saved in ${saveResponsesTime}ms`, {
          total: processedMessages.length,
          successful: successfulSaves,
          failed: failedSaves
        });
      } catch (saveError) {
        saveResponsesTime = Date.now() - saveResponsesStart;
        logger.warn(`⚠️ [${requestId}] Failed to save AI responses in ${saveResponsesTime}ms`, {
          error: saveError.message,
          conversationId: currentConversationId,
          total: processedMessages.length,
          successful: successfulSaves,
          failed: failedSaves
        });
        // Continue processing even if save fails
      }

      // Clean up old files in background
      AudioService.cleanupOldFiles().catch(error => {
        logger.warn(`🧹 [${requestId}] Background cleanup failed`, { error: error.message });
      });

      const totalTime = Date.now() - startTime;
      logger.info(`🎉 [${requestId}] Chat request completed successfully in ${totalTime}ms`, {
        requestId,
        messageCount: processedMessages.length,
        conversationId: currentConversationId,
        userId: user.id,
        breakdown: {
          aiGeneration: aiTime,
          audioProcessing: totalAudioTime,
          saveResponses: saveResponsesTime,
          total: totalTime
        }
      });

      res.json({
        success: true,
        data: {
          messages: processedMessages,
          conversationId: currentConversationId
        },
        requestId,
      });

    } catch (error) {
      const totalTime = Date.now() - startTime;
      logger.error(`❌ [${requestId}] Chat request failed after ${totalTime}ms`, {
        requestId,
        error: error.message,
        stack: error.stack,
        userMessage: userMessage?.substring(0, 100),
        userId: user?.id,
        conversationId
      });

      // If it's a timeout error, try to generate a response with ElevenLabs audio
      if (error.message.includes('timeout')) {
        const fallbackMessages = await this.getFallbackMessagesWithAudio(userMessage);
        res.json({
          success: true,
          data: { messages: fallbackMessages },
          requestId,
          warning: 'OpenAI request timed out, using fallback response with ElevenLabs audio',
        });
      } else if (error.message.includes('quota') || error.message.includes('429')) {
        // If it's a quota error, try to generate a response with ElevenLabs audio
        const fallbackMessages = await this.getFallbackMessagesWithAudio(userMessage);
        res.json({
          success: true,
          data: { messages: fallbackMessages },
          requestId,
          warning: 'Using fallback response with ElevenLabs audio due to OpenAI quota exceeded',
        });
      } else {
        // Return fallback response for other errors
        const fallbackMessages = await this.getFallbackMessages();
        res.json({
          success: true,
          data: { messages: fallbackMessages },
          requestId,
          warning: 'Using fallback response due to processing error',
        });
      }
    }
  });

  /**
   * Get introduction messages
   */
  async getIntroMessages() {
    try {
      const [intro0Audio, intro0LipSync, intro1Audio, intro1LipSync] = await Promise.all([
        AudioService.readAudioAsBase64('intro_0.wav').catch(() => null),
        AudioService.readLipSyncData('intro_0.json').catch(() => null),
        AudioService.readAudioAsBase64('intro_1.wav').catch(() => null),
        AudioService.readLipSyncData('intro_1.json').catch(() => null),
      ]);

      return [
        {
          text: "Devotee, Radhe Radhe! I am your Bhagwat Gita based Advice giver. Ask me anything.",
          audio: intro0Audio,
          lipsync: intro0LipSync,
          facialExpression: "smile",
          animation: "Alert",
        },
        {
          text: "I can help you with your problems and give you advice based on the teachings of the Bhagwat Gita.",
          audio: intro1Audio,
          lipsync: intro1LipSync,
          facialExpression: "default",
          animation: "Idle",
        },
      ];
    } catch (error) {
      logger.error('Failed to load intro messages', { error: error.message });
      return this.getBasicIntroMessages();
    }
  }

  /**
   * Get API key warning messages
   */
  async getApiKeyMessages() {
    try {
      const [api0Audio, api0LipSync, api1Audio, api1LipSync] = await Promise.all([
        AudioService.readAudioAsBase64('api_0.wav').catch(() => null),
        AudioService.readLipSyncData('api_0.json').catch(() => null),
        AudioService.readAudioAsBase64('api_1.wav').catch(() => null),
        AudioService.readLipSyncData('api_1.json').catch(() => null),
      ]);

      return [
        {
          text: "Please my dear, don't forget to add your API keys!",
          audio: api0Audio,
          lipsync: api0LipSync,
          facialExpression: "angry",
          animation: "Agree_Gesture",
        },
        {
          text: "Include your OpenAI API key in the .env file to enable all features.",
          audio: api1Audio,
          lipsync: api1LipSync,
          facialExpression: "smile",
          animation: "Alert",
        },
      ];
    } catch (error) {
      logger.error('Failed to load API key messages', { error: error.message });
      return this.getBasicApiKeyMessages();
    }
  }

  /**
   * Get fallback messages when processing fails
   */
  async getFallbackMessages() {
    return [
      {
        text: "I apologize, but I'm experiencing some technical difficulties right now. Please try again in a moment.",
        audio: null,
        lipsync: null,
        facialExpression: "sad",
        animation: "Alert",
      },
    ];
  }

  /**
   * Get basic intro messages without audio
   */
  getBasicIntroMessages() {
    return [
      {
        text: "Devotee, Radhe Radhe! I am your Bhagwat Gita based Advice giver. Ask me anything.",
        audio: null,
        lipsync: null,
        facialExpression: "smile",
        animation: "Alert",
      },
      {
        text: "I can help you with your problems and give you advice based on the teachings of the Bhagwat Gita.",
        audio: null,
        lipsync: null,
        facialExpression: "default",
        animation: "Idle",
      },
    ];
  }

  /**
   * Get basic API key messages without audio
   */
  getBasicApiKeyMessages() {
    return [
      {
        text: "Please configure your OpenAI API key in the .env file to enable all features.",
        audio: null,
        lipsync: null,
        facialExpression: "sad",
        animation: "Alert",
      },
    ];
  }

  /**
   * Get fallback messages with ElevenLabs audio when OpenAI quota exceeded
   */
  async getFallbackMessagesWithAudio(userMessage) {
    const fallbackText = `Namaste! I am Krishna, your spiritual guide. I understand you asked: "${userMessage}". While I cannot provide the full AI response due to OpenAI limitations, I can still speak to you using ElevenLabs. Please add credits to your OpenAI account for complete functionality.`;

    try {
      // Try to generate audio with ElevenLabs
      const audioBuffer = await TTSService.generateSpeech(fallbackText, { provider: 'elevenlabs' });
      const audioBase64 = audioBuffer ? audioBuffer.toString('base64') : null;

      logger.info('Generated fallback audio with ElevenLabs', { textLength: fallbackText.length });

      return [
        {
          text: fallbackText,
          audio: audioBase64,
          lipsync: null,
          facialExpression: "smile",
          animation: "Alert",
        },
      ];
    } catch (audioError) {
      logger.warn('Failed to generate fallback audio', { error: audioError.message });

      return [
        {
          text: fallbackText,
          audio: null,
          lipsync: null,
          facialExpression: "sad",
          animation: "Alert",
        },
      ];
    }
  }

  /**
   * Get user's conversations
   */
  getConversations = catchAsync(async (req, res) => {
    const user = req.user;
    const { limit = 50 } = req.query;

    try {
      const conversations = await database.getConversations(user.id, parseInt(limit));

      logger.info('Conversations retrieved', {
        userId: user.id,
        count: conversations.length
      });

      res.json({
        success: true,
        data: { conversations },
      });
    } catch (error) {
      logger.error('Failed to get conversations', {
        userId: user.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve conversations'
      });
    }
  });

  /**
   * Get messages for a conversation
   */
  getMessages = catchAsync(async (req, res) => {
    const user = req.user;
    const { id: conversationId } = req.params;
    const { limit = 100 } = req.query;

    try {
      // Check if conversation belongs to user
      const conversations = await database.getConversations(user.id, 1);
      const conversation = conversations.find(c => c.id === conversationId);

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      // Try to get from cache first
      const cacheKey = `conversation:${conversationId}:messages`;
      const cachedMessages = await cache.lrange(cacheKey, 0, parseInt(limit) - 1);

      if (cachedMessages && cachedMessages.length > 0) {
        const messages = cachedMessages.map(msg => JSON.parse(msg));
        logger.info('Messages retrieved from cache', {
          conversationId,
          count: messages.length
        });

        return res.json({
          success: true,
          data: { messages },
          source: 'cache'
        });
      }

      // Get from database if not in cache
      const messages = await database.getMessages(conversationId, parseInt(limit));

      // Cache the messages for future requests
      if (messages.length > 0) {
        const pipeline = cache.pipeline();
        messages.forEach(msg => {
          pipeline.lpush(cacheKey, JSON.stringify({
            content: msg.content,
            role: msg.role,
            audio: msg.audio_url,
            lipsync: msg.lipsync_data,
            facialExpression: msg.facial_expression,
            animation: msg.animation,
            timestamp: msg.created_at
          }));
        });
        pipeline.expire(cacheKey, 3600); // 1 hour expiry
        await pipeline.exec();
      }

      logger.info('Messages retrieved from database', {
        conversationId,
        count: messages.length
      });

      res.json({
        success: true,
        data: { messages },
        source: 'database'
      });
    } catch (error) {
      logger.error('Failed to get messages', {
        conversationId,
        userId: user.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve messages'
      });
    }
  });

  /**
   * Get conversation with messages for modal display
   */
  getConversationDetails = catchAsync(async (req, res) => {
    const user = req.user;
    const { id: conversationId } = req.params;

    try {
      const conversation = await database.getConversationWithMessages(conversationId, user.id);

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      logger.info('Conversation details retrieved', {
        conversationId,
        userId: user.id,
        messageCount: conversation.messages.length
      });

      res.json({
        success: true,
        data: { conversation }
      });
    } catch (error) {
      logger.error('Failed to get conversation details', {
        userId: user.id,
        conversationId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve conversation details'
      });
    }
  });

  /**
   * Delete a conversation (soft delete)
   */
  deleteConversation = catchAsync(async (req, res) => {
    const user = req.user;
    const { id: conversationId } = req.params;

    try {
      const deletedConversation = await database.deleteConversation(conversationId, user.id);

      if (!deletedConversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      // Clear all related cache entries
      const cacheKeys = [
        `conversation:${conversationId}:messages`,
        `conversation:${conversationId}:details`,
        `user:${user.id}:conversations`,
        `conversations:${user.id}:*`
      ];

      for (const key of cacheKeys) {
        try {
          await cache.del(key);
        } catch (cacheError) {
          logger.warn('Failed to clear cache key:', { key, error: cacheError.message });
        }
      }

      // Clear pattern-based cache keys
      try {
        const keys = await cache.keys(`*${conversationId}*`);
        if (keys.length > 0) {
          await cache.del(...keys);
          logger.info(`Cleared ${keys.length} cache keys for conversation`);
        }
      } catch (cacheError) {
        logger.warn('Failed to clear pattern-based cache:', cacheError.message);
      }

      logger.info('Conversation deleted', {
        conversationId,
        userId: user.id
      });

      res.json({
        success: true,
        message: 'Conversation deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete conversation', {
        userId: user.id,
        conversationId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to delete conversation'
      });
    }
  });

  /**
   * Create a new conversation
   */
  createConversation = catchAsync(async (req, res) => {
    const user = req.user;
    const { title = 'New Conversation' } = req.body;

    try {
      const conversation = await database.createConversation(user.id, title);

      logger.info('Conversation created', {
        conversationId: conversation.id,
        userId: user.id,
        title
      });

      res.json({
        success: true,
        data: { conversation },
      });
    } catch (error) {
      logger.error('Failed to create conversation', {
        userId: user.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to create conversation'
      });
    }
  });
  /**
   * Save messages in background (for fast mode)
   */
  async saveMessagesInBackground(conversationId, userMessage, aiMessages, requestId) {
    try {
      logger.info(`🔄 [${requestId}] Starting background save...`);

      // Save user message
      await database.createMessage(conversationId, {
        content: userMessage,
        role: 'user'
      });

      // Save AI messages
      for (const message of aiMessages) {
        await database.createMessage(conversationId, {
          content: message.text,
          role: 'assistant',
          audioUrl: null,
          lipsyncData: null,
          facialExpression: message.facialExpression,
          animation: message.animation
        });
      }

      // Cache messages
      const cacheKey = `conversation:${conversationId}:messages`;
      await cache.lpush(cacheKey, JSON.stringify({
        content: userMessage,
        role: 'user',
        timestamp: new Date().toISOString()
      }));

      for (const message of aiMessages) {
        await cache.lpush(cacheKey, JSON.stringify({
          content: message.text,
          role: 'assistant',
          facialExpression: message.facialExpression,
          animation: message.animation,
          timestamp: new Date().toISOString()
        }));
      }

      await cache.expire(cacheKey, 3600);
      logger.info(`✅ [${requestId}] Background save completed`);
    } catch (error) {
      logger.error(`❌ [${requestId}] Background save failed`, {
        error: error.message,
        conversationId
      });
    }
  }

  /**
   * Check TTS cache
   */
  async checkTTSCache(text) {
    try {
      const cacheKey = `tts:${Buffer.from(text).toString('base64').substring(0, 50)}`;
      return await cache.get(cacheKey);
    } catch (error) {
      logger.warn('TTS cache check failed', { error: error.message });
      return null;
    }
  }

  /**
   * Cache TTS result
   */
  async cacheTTSResult(text, audioBase64) {
    try {
      const cacheKey = `tts:${Buffer.from(text).toString('base64').substring(0, 50)}`;
      await cache.set(cacheKey, audioBase64, 3600); // Cache for 1 hour
    } catch (error) {
      logger.warn('TTS cache save failed', { error: error.message });
    }
  }
}

export default new ChatController();
