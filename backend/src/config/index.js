import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

/**
 * Application configuration
 */
class Config {
  constructor() {
    this.validateRequiredEnvVars();
  }

  // Server Configuration
  get port() {
    return parseInt(process.env.PORT, 10) || 3000;
  }

  get nodeEnv() {
    return process.env.NODE_ENV || 'development';
  }

  get isDevelopment() {
    return this.nodeEnv === 'development';
  }

  get isProduction() {
    return this.nodeEnv === 'production';
  }

  // API Keys
  get openaiApiKey() {
    return process.env.OPENAI_API_KEY;
  }

  get elevenLabsApiKey() {
    return process.env.ELEVEN_LABS_API_KEY;
  }

  get geminiApiKey() {
    return process.env.GEMINI_API_KEY;
  }

  // Audio Configuration
  get audioConfig() {
    return {
      outputDir: path.resolve('audios'),
      maxFiles: parseInt(process.env.MAX_AUDIO_FILES, 10) || 10,
      formats: ['mp3', 'wav'],
      ttsModel: process.env.TTS_MODEL || 'tts-1',
      ttsVoice: process.env.TTS_VOICE || 'alloy',
      ttsSpeed: parseFloat(process.env.TTS_SPEED) || 0.9,
      ttsInstructions: process.env.TTS_INSTRUCTIONS || 'Speak in a warm, friendly, and spiritual tone as Krishna, the divine guide from the Bhagavad Gita.',
      ttsResponseFormat: process.env.TTS_RESPONSE_FORMAT || 'mp3',
    };
  }

  // OpenAI Configuration
  get openaiConfig() {
    return {
      model: process.env.OPENAI_MODEL,
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS, 10) || 1000,
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.6,
      timeout: parseInt(process.env.OPENAI_TIMEOUT, 10) || 15000, // 15 seconds timeout
    };
  }

  // ElevenLabs Configuration
  get elevenLabsConfig() {
    return {
      voiceId: process.env.ELEVEN_LABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB', // Adam voice
      model: process.env.ELEVEN_LABS_MODEL || 'eleven_monolingual_v1',
      stability: parseFloat(process.env.ELEVEN_LABS_STABILITY) || 0.5,
      similarityBoost: parseFloat(process.env.ELEVEN_LABS_SIMILARITY_BOOST) || 0.5,
      style: parseFloat(process.env.ELEVEN_LABS_STYLE) || 0.0,
      useSpeakerBoost: process.env.ELEVEN_LABS_SPEAKER_BOOST !== 'false',
    };
  }

  // Gemini Configuration
  get geminiConfig() {
    return {
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      ttsModel: process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts',
      maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS, 10) || 1000,
      temperature: parseFloat(process.env.GEMINI_TEMPERATURE) || 0.7,
      timeout: parseInt(process.env.GEMINI_TIMEOUT, 10) || 20000, // 20 seconds timeout
      ttsVoice: process.env.GEMINI_TTS_VOICE || 'Kore',
    };
  }

  // Logging Configuration
  get logConfig() {
    return {
      level: process.env.LOG_LEVEL || 'info',
      maxLogs: parseInt(process.env.MAX_LOGS, 10) || 5,
      format: process.env.LOG_FORMAT || 'combined',
    };
  }

  // Security Configuration
  get securityConfig() {
    return {
      rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
      rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
      corsOrigin: process.env.CORS_ORIGIN || '*',
      requestSizeLimit: process.env.REQUEST_SIZE_LIMIT || '10mb',
      sessionTimeoutMs: parseInt(process.env.SESSION_TIMEOUT_MS, 10) || 30 * 60 * 1000, // 30 minutes
      sessionWarningMs: parseInt(process.env.SESSION_WARNING_MS, 10) || 5 * 60 * 1000, // 5 minutes
      jwtExpirationMs: parseInt(process.env.JWT_EXPIRATION_MS, 10) || 60 * 60 * 1000, // 1 hour
    };
  }

  // FFmpeg Configuration
  get ffmpegConfig() {
    return {
      rhubarbPath: process.env.RHUBARB_PATH || './bin/rhubarb.exe',
      ffmpegTimeout: parseInt(process.env.FFMPEG_TIMEOUT, 10) || 30000, // 30 seconds
    };
  }

  /**
   * Validate required environment variables
   */
  validateRequiredEnvVars() {
    const critical = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
    const optional = ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'ELEVENLABS_API_KEY', 'CLERK_SECRET_KEY'];

    const missingCritical = critical.filter(key => !process.env[key]);
    const missingOptional = optional.filter(key => !process.env[key]);

    if (missingCritical.length > 0) {
      console.error(`❌ Critical environment variables missing: ${missingCritical.join(', ')}`);
      console.error('Application may not start properly without these variables.');
    }

    if (missingOptional.length > 0) {
      console.warn(`⚠️ Optional environment variables missing: ${missingOptional.join(', ')}`);
      console.warn('Some features may not work properly without these variables.');
    }

    // Log available services
    console.log('🔧 Service Configuration:');
    console.log(`  Database: ${process.env.SUPABASE_URL ? '✅ Configured' : '❌ Missing'}`);
    console.log(`  OpenAI: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    console.log(`  Gemini: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    console.log(`  ElevenLabs: ${process.env.ELEVENLABS_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    console.log(`  Clerk: ${process.env.CLERK_SECRET_KEY ? '✅ Configured' : '❌ Missing'}`);
    console.log(`  Redis: ${process.env.REDIS_URL ? '✅ Configured' : '❌ Missing'}`);
  }

  /**
   * Get all configuration as an object
   */
  getAll() {
    return {
      port: this.port,
      nodeEnv: this.nodeEnv,
      isDevelopment: this.isDevelopment,
      isProduction: this.isProduction,
      audio: this.audioConfig,
      openai: this.openaiConfig,
      elevenLabs: this.elevenLabsConfig,
      logging: this.logConfig,
      security: this.securityConfig,
      ffmpeg: this.ffmpegConfig,
    };
  }
}

export default new Config();
