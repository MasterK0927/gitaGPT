import OpenAI from 'openai';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { ExternalAPIError, ValidationError } from '../utils/errors.js';

/**
 * OpenAI service for handling AI interactions
 */
class OpenAIService {
  constructor() {
    this._client = null;
    this.systemPrompt = `
      You are Krishna from Mahabharata, and you're here to selflessly help and answer any question or dilemma of anyone who comes to you.
      Analyze the person's question below and identify the base emotion and the root for this emotion, and then frame your answer by summarizing how the verses below apply to their situation and be empathetic in your answer.
      You will always reply with a JSON array of messages. With a maximum of 3 messages.
      Each message has a text, facialExpression, and animation property.
      The different facial expressions are: smile, sad, angry, surprised, funnyFace, and default.
      The different animations are: Agree_Gesture, Alert, Casual_Walk, Idle, Running and Slow_Orc_Walk.
    `;
  }

  /**
   * Get OpenAI client instance (lazy initialization)
   */
  get client() {
    if (!this._client) {
      if (!config.openaiApiKey) {
        throw new ExternalAPIError('OpenAI', 'API key not configured');
      }

      this._client = new OpenAI({
        apiKey: config.openaiApiKey,
      });
    }
    return this._client;
  }

  /**
   * Generate chat completion
   */
  async generateChatCompletion(userMessage) {
    try {
      if (!userMessage || typeof userMessage !== 'string') {
        throw new ValidationError('User message is required and must be a string');
      }

      logger.info('Generating chat completion', { messageLength: userMessage.length });

      // Add timeout to OpenAI request
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OpenAI request timeout')), config.openaiConfig.timeout);
      });

      const completion = await Promise.race([
        this.client.chat.completions.create({
          model: config.openaiConfig.model,
          max_tokens: config.openaiConfig.maxTokens,
          temperature: config.openaiConfig.temperature,
          response_format: {
            type: "json_object",
          },
          messages: [
            {
              role: "system",
              content: this.systemPrompt,
            },
            {
              role: "user",
              content: userMessage,
            },
          ],
        }),
        timeoutPromise
      ]);

      const response = completion.choices[0].message.content;
      logger.info('Chat completion generated successfully', {
        tokensUsed: completion.usage?.total_tokens
      });

      return this.parseResponse(response);
    } catch (error) {
      logger.error('Failed to generate chat completion', {
        error: error.message,
        userMessage: userMessage?.substring(0, 100)
      });

      if (error.code === 'insufficient_quota') {
        throw new ExternalAPIError('OpenAI', 'API quota exceeded');
      } else if (error.code === 'invalid_api_key') {
        throw new ExternalAPIError('OpenAI', 'Invalid API key');
      } else if (error.code === 'rate_limit_exceeded') {
        throw new ExternalAPIError('OpenAI', 'Rate limit exceeded');
      }

      throw new ExternalAPIError('OpenAI', error.message, error);
    }
  }

  /**
   * Generate chat completion with conversation context
   */
  async generateChatCompletionWithContext(userMessage, conversationContext = []) {
    try {
      if (!userMessage || typeof userMessage !== 'string') {
        throw new ValidationError('User message is required and must be a string');
      }

      logger.info('Generating context-aware chat completion', {
        messageLength: userMessage.length,
        contextLength: conversationContext.length
      });

      // Build messages array with context
      const messages = [
        {
          role: "system",
          content: this.systemPrompt,
        }
      ];

      // Add conversation context (limit to recent messages to avoid token limits)
      const recentContext = conversationContext.slice(-10); // Last 10 messages
      recentContext.forEach(msg => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      });

      // Add current user message
      messages.push({
        role: "user",
        content: userMessage,
      });

      // Add timeout to OpenAI request
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OpenAI request timeout')), config.openaiConfig.timeout);
      });

      const completion = await Promise.race([
        this.client.chat.completions.create({
          model: config.openaiConfig.model,
          max_tokens: config.openaiConfig.maxTokens,
          temperature: config.openaiConfig.temperature,
          response_format: {
            type: "json_object",
          },
          messages,
        }),
        timeoutPromise
      ]);

      const response = completion.choices[0].message.content;
      logger.info('Context-aware chat completion generated successfully', {
        tokensUsed: completion.usage?.total_tokens,
        contextMessages: recentContext.length
      });

      return this.parseResponse(response);
    } catch (error) {
      logger.error('Failed to generate context-aware chat completion', {
        error: error.message,
        userMessage: userMessage?.substring(0, 100),
        contextLength: conversationContext.length
      });

      if (error.code === 'insufficient_quota') {
        throw new ExternalAPIError('OpenAI', 'API quota exceeded');
      } else if (error.code === 'invalid_api_key') {
        throw new ExternalAPIError('OpenAI', 'Invalid API key');
      } else if (error.code === 'rate_limit_exceeded') {
        throw new ExternalAPIError('OpenAI', 'Rate limit exceeded');
      }

      throw new ExternalAPIError('OpenAI', error.message, error);
    }
  }

  /**
   * Generate text-to-speech audio
   */
  async generateSpeech(text, options = {}) {
    try {
      if (!text || typeof text !== 'string') {
        throw new ValidationError('Text is required and must be a string');
      }

      const audioConfig = config.audioConfig;
      
      logger.info('Generating speech with OpenAI TTS', { textLength: text.length });

      // Add timeout to OpenAI TTS request
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OpenAI TTS request timeout')), config.openaiConfig.timeout);
      });

      const speechOptions = {
        model: options.model || audioConfig.ttsModel,
        voice: options.voice || audioConfig.ttsVoice,
        input: text,
        speed: options.speed || audioConfig.ttsSpeed,
      };

      // Add instructions for gpt-4o-mini-tts model
      if (speechOptions.model === 'gpt-4o-mini-tts') {
        speechOptions.instructions = options.instructions || audioConfig.ttsInstructions;
        speechOptions.response_format = options.response_format || audioConfig.ttsResponseFormat;
      }

      const mp3 = await Promise.race([
        this.client.audio.speech.create(speechOptions),
        timeoutPromise
      ]);

      const buffer = Buffer.from(await mp3.arrayBuffer());
      
      logger.info('OpenAI TTS speech generated successfully', { bufferSize: buffer.length });

      return buffer;
    } catch (error) {
      logger.error('Failed to generate speech with OpenAI TTS', {
        error: error.message,
        text: text?.substring(0, 100)
      });

      if (error.code === 'insufficient_quota' || error.status === 429) {
        throw new ExternalAPIError('OpenAI', 'Quota exceeded', error);
      }

      if (error.message === 'OpenAI TTS request timeout') {
        throw new ExternalAPIError('OpenAI', 'TTS request timeout', error);
      }

      throw new ExternalAPIError('OpenAI TTS', error.message, error);
    }
  }

  /**
   * Parse OpenAI response
   */
  parseResponse(response) {
    try {
      let messages = JSON.parse(response);
      
      // Handle different response formats
      if (messages.messages) {
        messages = messages.messages;
      }

      // Validate response structure
      if (!Array.isArray(messages)) {
        throw new Error('Response must be an array of messages');
      }

      // Validate each message
      messages.forEach((message, index) => {
        if (!message.text || typeof message.text !== 'string') {
          throw new Error(`Message ${index} must have a text property`);
        }
        if (!message.facialExpression) {
          message.facialExpression = 'default';
        }
        if (!message.animation) {
          message.animation = 'Idle';
        }
      });

      // Limit to maximum 3 messages
      if (messages.length > 3) {
        messages = messages.slice(0, 3);
        logger.warn('Truncated response to 3 messages');
      }

      return messages;
    } catch (error) {
      logger.error('Failed to parse OpenAI response', { 
        error: error.message,
        response: response?.substring(0, 200) 
      });

      // Return fallback response
      return [{
        text: "I apologize, but I'm having trouble processing your request right now. Please try again.",
        facialExpression: "sad",
        animation: "Alert"
      }];
    }
  }

  /**
   * Get available models
   */
  async getModels() {
    try {
      const models = await this.client.models.list();
      return models.data.filter(model => 
        model.id.includes('gpt') || model.id.includes('tts')
      );
    } catch (error) {
      logger.error('Failed to get models', { error: error.message });
      throw new ExternalAPIError('OpenAI', error.message, error);
    }
  }

  /**
   * Check API key validity
   */
  async validateApiKey() {
    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      logger.error('API key validation failed', { error: error.message });
      return false;
    }
  }
}

export default new OpenAIService();
