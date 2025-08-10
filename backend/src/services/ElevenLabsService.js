import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { ExternalAPIError, ValidationError } from '../utils/errors.js';

/**
 * ElevenLabs service for text-to-speech generation
 */
class ElevenLabsService {
  constructor() {
    this._client = null;
    this.defaultVoiceId = 'pNInz6obpgDQGcFmaJgB'; // Adam voice
  }

  /**
   * Get ElevenLabs client instance (lazy initialization)
   */
  get client() {
    if (!this._client) {
      if (!config.elevenLabsApiKey) {
        throw new ExternalAPIError('ElevenLabs', 'API key not configured');
      }

      this._client = new ElevenLabsClient({
        apiKey: config.elevenLabsApiKey,
      });
    }
    return this._client;
  }

  /**
   * Check if ElevenLabs is available
   */
  isAvailable() {
    return !!config.elevenLabsApiKey;
  }

  /**
   * Generate speech using ElevenLabs TTS
   */
  async generateSpeech(text, options = {}) {
    try {
      if (!text || typeof text !== 'string') {
        throw new ValidationError('Text is required and must be a string');
      }

      logger.info('Generating speech with ElevenLabs', { textLength: text.length });

      const voiceId = options.voiceId || this.defaultVoiceId;

      const audioStream = await this.client.textToSpeech.convert(voiceId, {
        text: text,
        modelId: options.model || 'eleven_multilingual_v2',
        voiceSettings: {
          stability: options.stability || 0.5,
          similarityBoost: options.similarityBoost || 0.5,
          style: options.style || 0.0,
          useSpeakerBoost: options.useSpeakerBoost !== undefined ? options.useSpeakerBoost : true,
        },
      });

      // Convert stream to buffer
      const chunks = [];
      for await (const chunk of audioStream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      logger.info('ElevenLabs speech generated successfully', { bufferSize: buffer.length });

      return buffer;
    } catch (error) {
      logger.error('Failed to generate speech with ElevenLabs', {
        error: error.message,
        text: text?.substring(0, 100)
      });

      if (error.message.includes('quota') || error.message.includes('credits')) {
        throw new ExternalAPIError('ElevenLabs', 'API quota exceeded or insufficient credits', error);
      } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
        throw new ExternalAPIError('ElevenLabs', 'Invalid API key', error);
      } else if (error.message.includes('429')) {
        throw new ExternalAPIError('ElevenLabs', 'Rate limit exceeded', error);
      }

      throw new ExternalAPIError('ElevenLabs TTS', error.message, error);
    }
  }

  /**
   * Get available voices
   */
  async getVoices() {
    try {
      const voices = await this.client.voices.search();

      logger.info('Retrieved ElevenLabs voices', { count: voices.voices?.length || 0 });

      return voices.voices || [];
    } catch (error) {
      logger.error('Failed to get ElevenLabs voices', { error: error.message });
      throw new ExternalAPIError('ElevenLabs', error.message, error);
    }
  }

  /**
   * Get voice by name
   */
  async getVoiceByName(name) {
    try {
      const voices = await this.getVoices();
      const voice = voices.find(v => v.name.toLowerCase() === name.toLowerCase());
      
      if (!voice) {
        throw new Error(`Voice "${name}" not found`);
      }
      
      return voice;
    } catch (error) {
      logger.error('Failed to find voice by name', { name, error: error.message });
      throw error;
    }
  }

  /**
   * Validate API key
   */
  async validateApiKey() {
    try {
      await this.getVoices();
      return true;
    } catch (error) {
      logger.error('ElevenLabs API key validation failed', { error: error.message });
      return false;
    }
  }

  /**
   * Get recommended voices for different use cases
   */
  getRecommendedVoices() {
    return {
      // Pre-made voices (free tier)
      adam: 'pNInz6obpgDQGcFmaJgB',
      antoni: 'ErXwobaYiN019PkySvjV',
      arnold: 'VR6AewLTigWG4xSOukaG',
      bella: 'EXAVITQu4vr4xnSDxMaL',
      domi: 'AZnzlk1XvdvUeBnXmlld',
      elli: 'MF3mGyEYCl7XYWbV9V6O',
      josh: 'TxGEqnHWrfWFTfGW9XjX',
      rachel: '21m00Tcm4TlvDq8ikWAM',
      sam: 'yoZ06aMxZJJ28mfd3POQ',
    };
  }

  /**
   * Get usage statistics
   */
  async getUsage() {
    try {
      const user = await this.client.users.getSubscription();

      return {
        characterCount: user.character_count || 0,
        characterLimit: user.character_limit || 0,
        canExtendCharacterLimit: user.can_extend_character_limit || false,
        nextCharacterCountResetUnix: user.next_character_count_reset_unix || 0,
      };
    } catch (error) {
      logger.error('Failed to get ElevenLabs usage', { error: error.message });
      throw new ExternalAPIError('ElevenLabs', error.message, error);
    }
  }
}

export default new ElevenLabsService();
