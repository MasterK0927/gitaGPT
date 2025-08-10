import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { ExternalAPIError, ValidationError } from '../utils/errors.js';

/**
 * Google Gemini service for chat completion and text-to-speech
 */
class GeminiService {
  constructor() {
    this._client = null;
    this._ttsClient = null; // New TTS client
    this.systemPrompt = `You are Krishna, the divine guide from the Bhagavad Gita. You provide spiritual wisdom and guidance based on the teachings of the Bhagavad Gita.

Your responses should be:
- Warm, compassionate, and spiritually uplifting
- Based on the teachings and philosophy of the Bhagavad Gita
- Practical and applicable to modern life
- Encouraging and supportive

Always respond in JSON format with an array of messages. Each message should have:
- text: The spoken content
- facialExpression: One of "smile", "sad", "angry", "surprised", "funnyFace", or "default"
- animation: One of "Agree_Gesture", "Alert", "Casual_Walk", "Idle", "Running", or "Slow_Orc_Walk"

Example response format:
{
  "messages": [
    {
      "text": "Namaste! I am Krishna, your divine guide...",
      "facialExpression": "smile",
      "animation": "Agree_Gesture"
    }
  ]
}

Keep responses concise but meaningful. Limit to maximum 3 messages.`;
  }

  /**
   * Get Gemini client instance (lazy initialization)
   */
  get client() {
    if (!this._client) {
      if (!config.geminiApiKey) {
        throw new ExternalAPIError('Gemini', 'API key not configured');
      }

      this._client = new GoogleGenerativeAI(config.geminiApiKey);
    }
    return this._client;
  }

  /**
   * Get Gemini TTS client instance (lazy initialization)
   */
  get ttsClient() {
    if (!this._ttsClient) {
      if (!config.geminiApiKey) {
        throw new ExternalAPIError('Gemini TTS', 'API key not configured');
      }

      this._ttsClient = new GoogleGenerativeAI(config.geminiApiKey);
    }

    return this._ttsClient;
  }

  /**
   * Check if Gemini is available
   */
  isAvailable() {
    return !!config.geminiApiKey;
  }

  /**
   * Check if Gemini TTS is available
   * Currently, Gemini TTS is not available in the standard API
   */
  isTTSAvailable() {
    // Gemini TTS is currently not available in the standard API
    // Return false to disable TTS for Gemini
    return false;
  }

  /**
   * Generate chat completion using Gemini
   */
  async generateChatCompletion(userMessage) {
    try {
      if (!userMessage || typeof userMessage !== 'string') {
        throw new ValidationError('User message is required and must be a string');
      }

      logger.info('Generating chat completion with Gemini', { messageLength: userMessage.length });

      // Add timeout to Gemini request
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Gemini request timeout')), config.geminiConfig.timeout);
      });

      const model = this.client.getGenerativeModel({ 
        model: config.geminiConfig.model,
        generationConfig: {
          maxOutputTokens: config.geminiConfig.maxTokens,
          temperature: config.geminiConfig.temperature,
        }
      });

      const prompt = `${this.systemPrompt}\n\nUser: ${userMessage}\n\nKrishna:`;

      const result = await Promise.race([
        model.generateContent(prompt),
        timeoutPromise
      ]);

      const response = result.response.text();
      logger.info('Gemini chat completion generated successfully');

      return this.parseResponse(response);
    } catch (error) {
      logger.error('Failed to generate chat completion with Gemini', {
        error: error.message,
        userMessage: userMessage?.substring(0, 100)
      });

      if (error.message === 'Gemini request timeout') {
        throw new ExternalAPIError('Gemini', 'Request timeout', error);
      }

      throw new ExternalAPIError('Gemini', error.message, error);
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

      logger.info('Generating context-aware chat completion with Gemini', { 
        messageLength: userMessage.length,
        contextLength: conversationContext.length 
      });

      // Build conversation history
      let conversationHistory = this.systemPrompt + '\n\n';
      
      // Add recent context (limit to avoid token limits)
      const recentContext = conversationContext.slice(-8); // Last 8 messages
      recentContext.forEach(msg => {
        if (msg.role === 'user') {
          conversationHistory += `User: ${msg.content}\n`;
        } else if (msg.role === 'assistant') {
          conversationHistory += `Krishna: ${msg.content}\n`;
        }
      });

      // Add current user message
      conversationHistory += `User: ${userMessage}\n\nKrishna:`;

      // Add timeout to Gemini request
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Gemini request timeout')), config.geminiConfig.timeout);
      });

      const model = this.client.getGenerativeModel({ 
        model: config.geminiConfig.model,
        generationConfig: {
          maxOutputTokens: config.geminiConfig.maxTokens,
          temperature: config.geminiConfig.temperature,
        }
      });

      const result = await Promise.race([
        model.generateContent(conversationHistory),
        timeoutPromise
      ]);

      const response = result.response.text();
      logger.info('Context-aware Gemini chat completion generated successfully', {
        contextMessages: recentContext.length
      });

      return this.parseResponse(response);
    } catch (error) {
      logger.error('Failed to generate context-aware chat completion with Gemini', {
        error: error.message,
        userMessage: userMessage?.substring(0, 100),
        contextLength: conversationContext.length
      });

      if (error.message === 'Gemini request timeout') {
        throw new ExternalAPIError('Gemini', 'Request timeout', error);
      }

      throw new ExternalAPIError('Gemini', error.message, error);
    }
  }

  /**
   * Generate text-to-speech audio using Gemini TTS
   * Note: Gemini TTS is currently not available in the standard API
   */
  async generateSpeech(text, options = {}) {
    try {
      if (!text || typeof text !== 'string') {
        throw new ValidationError('Text is required and must be a string');
      }

      logger.info('Generating speech with Gemini TTS (new package)', { textLength: text.length });

      // Check if TTS is available
      if (!this.isTTSAvailable()) {
        logger.warn('Gemini TTS not available, returning null');
        return null;
      }

      // Gemini TTS is currently not available in the standard API
      // Return null to allow fallback to other providers
      logger.warn('Gemini TTS not implemented in standard API, returning null');
      return null;

    } catch (error) {
      logger.error('Failed to generate speech with Gemini TTS', {
        error: error.message,
        text: text?.substring(0, 100)
      });

      // Don't throw error, just return null to allow fallback to other providers
      logger.warn('Gemini TTS failed, returning null for fallback');
      return null;
    }
  }

  /**
   * Parse Gemini response
   */
  parseResponse(response) {
    try {
      // Clean response by removing markdown code blocks
      let cleanResponse = response.trim();

      // Remove markdown JSON code blocks if present
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Try to parse as JSON first
      let parsed;
      try {
        parsed = JSON.parse(cleanResponse);
      } catch (jsonError) {
        // If not JSON, create a structured response
        parsed = {
          messages: [{
            text: cleanResponse.trim(),
            facialExpression: "smile",
            animation: "Agree_Gesture"
          }]
        };
      }

      let messages = parsed.messages || [parsed];

      // Ensure each message has required fields
      messages = messages.map(msg => ({
        text: msg.text || msg.content || 'I apologize, but I cannot provide a response right now.',
        facialExpression: msg.facialExpression || "smile",
        animation: msg.animation || "Agree_Gesture"
      }));

      // Limit to maximum 3 messages
      if (messages.length > 3) {
        messages = messages.slice(0, 3);
        logger.warn('Truncated Gemini response to 3 messages');
      }

      return messages;
    } catch (error) {
      logger.error('Failed to parse Gemini response', { 
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
   * Validate API key
   */
  async validateApiKey() {
    try {
      const model = this.client.getGenerativeModel({ model: 'gemini-pro' });
      await model.generateContent('Hello');
      return true;
    } catch (error) {
      logger.error('Gemini API key validation failed', { error: error.message });
      return false;
    }
  }
}

export default new GeminiService();
