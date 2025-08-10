import OpenAIService from './OpenAIService.js';
import ElevenLabsService from './ElevenLabsService.js';
import GeminiService from './GeminiService.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { ExternalAPIError } from '../utils/errors.js';

/**
 * Unified Text-to-Speech service that handles multiple TTS providers
 */
class TTSService {
  constructor() {
    this.providers = {
      openai: OpenAIService,
      elevenlabs: ElevenLabsService,
      gemini: GeminiService, // Enabled: Using Google Cloud TTS
    };

    this.preferredOrder = ['gemini', 'openai', 'elevenlabs']; // Prefer Gemini first
  }

  /**
   * Get available TTS providers
   */
  getAvailableProviders() {
    const available = [];

    if (config.geminiApiKey) {
      available.push('gemini');
    }

    if (config.openaiApiKey) {
      available.push('openai');
    }

    if (config.elevenLabsApiKey) {
      available.push('elevenlabs');
    }

    return available;
  }

  /**
   * Get the best available provider
   */
  getBestProvider() {
    const available = this.getAvailableProviders();
    
    // Return the first available provider in preferred order
    for (const provider of this.preferredOrder) {
      if (available.includes(provider)) {
        return provider;
      }
    }
    
    return null;
  }

  /**
   * Generate speech using the best available provider
   */
  async generateSpeech(text, options = {}) {
    const availableProviders = this.getAvailableProviders();

    if (availableProviders.length === 0) {
      throw new ExternalAPIError('TTS', 'No TTS providers configured');
    }

    // Try providers in order of preference
    const providersToTry = options.provider 
      ? [options.provider] 
      : this.preferredOrder.filter(p => availableProviders.includes(p));

    let lastError = null;

    for (const providerName of providersToTry) {
      try {
        logger.info(`Attempting TTS with ${providerName}`, { textLength: text.length });
        
        const provider = this.providers[providerName];
        const audioBuffer = await this.generateWithProvider(provider, providerName, text, options);

        // Handle null result (TTS disabled/unavailable)
        if (audioBuffer === null) {
          logger.info(`TTS provider ${providerName} returned null (disabled/unavailable)`, { textLength: text.length });
          continue; // Try next provider instead of returning null immediately
        }

        logger.info(`TTS successful with ${providerName}`, { bufferSize: audioBuffer.length });
        return audioBuffer;
        
      } catch (error) {
        logger.warn(`TTS failed with ${providerName}`, { 
          error: error.message,
          provider: providerName 
        });
        
        lastError = error;
        
        // If it's a timeout error, try next provider immediately
        if (this.isTimeoutError(error)) {
          logger.warn(`${providerName} timeout, trying next provider immediately`);
          continue;
        }

        // If it's a quota/rate limit error, try next provider
        if (this.isQuotaError(error)) {
          logger.info(`${providerName} quota exceeded, trying next provider`);
          continue;
        }

        // If it's a configuration error, try next provider
        if (this.isConfigError(error)) {
          logger.info(`${providerName} configuration error, trying next provider`);
          continue;
        }
        
        // For other errors, still try next provider but log as warning
        logger.warn(`${providerName} error, trying next provider`, { error: error.message });
      }
    }

    // All providers failed
    throw new ExternalAPIError(
      'TTS', 
      `All TTS providers failed. Last error: ${lastError?.message}`,
      lastError
    );
  }

  /**
   * Generate speech with a specific provider
   */
  async generateWithProvider(provider, providerName, text, options) {
    switch (providerName) {
      case 'openai':
        return await provider.generateSpeech(text, {
          model: options.model || config.audioConfig.ttsModel,
          voice: options.voice || config.audioConfig.ttsVoice,
          speed: options.speed || config.audioConfig.ttsSpeed,
          instructions: options.instructions || config.audioConfig.ttsInstructions,
          response_format: options.response_format || config.audioConfig.ttsResponseFormat,
        });
        
      case 'elevenlabs':
        return await provider.generateSpeech(text, {
          voiceId: options.voiceId || config.elevenLabsConfig.voiceId,
          model: options.model || config.elevenLabsConfig.model,
          stability: options.stability || config.elevenLabsConfig.stability,
          similarityBoost: options.similarityBoost || config.elevenLabsConfig.similarityBoost,
          style: options.style || config.elevenLabsConfig.style,
          useSpeakerBoost: options.useSpeakerBoost !== undefined
            ? options.useSpeakerBoost
            : config.elevenLabsConfig.useSpeakerBoost,
        });

      case 'gemini':
        return await provider.generateSpeech(text, {
          languageCode: options.languageCode || 'en-US',
          voiceName: options.voiceName || 'en-US-Neural2-A',
          gender: options.gender || 'MALE',
          speakingRate: options.speakingRate || 0.9,
          pitch: options.pitch || -2.0,
          volumeGain: options.volumeGain || 0.0,
        });

      default:
        throw new Error(`Unknown TTS provider: ${providerName}`);
    }
  }

  /**
   * Check if error is related to timeout
   */
  isTimeoutError(error) {
    const message = error.message.toLowerCase();
    return message.includes('timeout') ||
           message.includes('timed out') ||
           message.includes('request timeout');
  }

  /**
   * Check if error is related to quota/credits
   */
  isQuotaError(error) {
    const message = error.message.toLowerCase();
    return message.includes('quota') ||
           message.includes('credits') ||
           message.includes('429') ||
           message.includes('rate limit');
  }

  /**
   * Check if error is related to configuration
   */
  isConfigError(error) {
    const message = error.message.toLowerCase();
    return message.includes('api key') || 
           message.includes('unauthorized') || 
           message.includes('401') ||
           message.includes('not configured');
  }

  /**
   * Get provider status
   */
  async getProviderStatus() {
    const status = {};
    
    for (const providerName of Object.keys(this.providers)) {
      const provider = this.providers[providerName];
      
      try {
        if (providerName === 'openai' && !config.openaiApiKey) {
          status[providerName] = { available: false, reason: 'API key not configured' };
          continue;
        }
        
        if (providerName === 'elevenlabs' && !config.elevenLabsApiKey) {
          status[providerName] = { available: false, reason: 'API key not configured' };
          continue;
        }

        // Test the provider
        const isValid = await provider.validateApiKey();
        status[providerName] = { 
          available: isValid, 
          reason: isValid ? 'Available' : 'API key validation failed' 
        };
        
      } catch (error) {
        status[providerName] = { 
          available: false, 
          reason: error.message 
        };
      }
    }
    
    return status;
  }

  /**
   * Get recommended settings for each provider
   */
  getProviderSettings() {
    return {
      openai: {
        models: ['tts-1', 'tts-1-hd'],
        voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
        speedRange: [0.25, 4.0],
        defaultSpeed: 0.9,
      },
      elevenlabs: {
        models: ['eleven_monolingual_v1', 'eleven_multilingual_v1', 'eleven_multilingual_v2'],
        stabilityRange: [0.0, 1.0],
        similarityBoostRange: [0.0, 1.0],
        styleRange: [0.0, 1.0],
        defaultStability: 0.5,
        defaultSimilarityBoost: 0.5,
        defaultStyle: 0.0,
      },
    };
  }

  /**
   * Get usage statistics for all providers
   */
  async getUsageStats() {
    const stats = {};
    
    try {
      if (config.elevenLabsApiKey) {
        stats.elevenlabs = await ElevenLabsService.getUsage();
      }
    } catch (error) {
      logger.warn('Failed to get ElevenLabs usage stats', { error: error.message });
    }
    
    // OpenAI doesn't provide usage stats through API
    stats.openai = { 
      available: !!config.openaiApiKey,
      note: 'Usage stats not available through API' 
    };
    
    return stats;
  }
}

export default new TTSService();
