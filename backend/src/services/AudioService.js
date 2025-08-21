import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { AudioProcessingError, FileProcessingError } from '../utils/errors.js';

/**
 * Audio processing service
 */
class AudioService {
  constructor() {
    this.audioDir = config.audioConfig.outputDir;
    this.rhubarbPath = config.ffmpegConfig.rhubarbPath;
    this.ffmpegTimeout = config.ffmpegConfig.ffmpegTimeout;
    
    this.ensureAudioDirectory();
  }

  /**
   * Ensure audio directory exists
   */
  async ensureAudioDirectory() {
    try {
      await fs.access(this.audioDir);
    } catch (error) {
      logger.info('Creating audio directory', { path: this.audioDir });
      await fs.mkdir(this.audioDir, { recursive: true });
    }
  }

  /**
   * Save audio buffer to file
   */
  async saveAudioFile(buffer, filename) {
    try {
      if (!Buffer.isBuffer(buffer)) {
        throw new Error('Invalid buffer provided');
      }

      const filePath = path.join(this.audioDir, filename);
      await fs.writeFile(filePath, buffer);
      
      logger.info('Audio file saved', { filename, size: buffer.length });
      return filePath;
    } catch (error) {
      logger.error('Failed to save audio file', { 
        filename, 
        error: error.message 
      });
      throw new FileProcessingError('save', filename, error);
    }
  }

  /**
   * Convert MP3 to WAV using FFmpeg
   */
  async convertMp3ToWav(inputFile, outputFile) {
    return new Promise((resolve, reject) => {
      const inputPath = path.join(this.audioDir, inputFile);
      const outputPath = path.join(this.audioDir, outputFile);
      
      const command = `ffmpeg -y -i "${inputPath}" "${outputPath}"`;
      
      logger.info('Converting MP3 to WAV', { inputFile, outputFile });
      
      const startTime = Date.now();
      
      exec(command, { timeout: this.ffmpegTimeout }, (error, stdout, stderr) => {
        const duration = Date.now() - startTime;
        
        if (error) {
          logger.error('FFmpeg conversion failed', { 
            error: error.message,
            stderr,
            inputFile,
            outputFile,
            duration 
          });
          reject(new AudioProcessingError('MP3 to WAV conversion', error.message));
          return;
        }
        
        logger.info('FFmpeg conversion completed', { 
          inputFile, 
          outputFile, 
          duration 
        });
        resolve(outputPath);
      });
    });
  }

  /**
   * Generate lip sync data using Rhubarb
   */
  async generateLipSync(audioFile, outputFile) {
    return new Promise((resolve, reject) => {
      const audioPath = path.join(this.audioDir, audioFile);
      const outputPath = path.join(this.audioDir, outputFile);
      
      // Use cross-platform path handling
      const rhubarbCommand = process.platform === 'win32'
        ? `.\\${this.rhubarbPath}`
        : './bin/rhubarb.exe'; // Use the Linux-compatible path
      
      const command = `"${rhubarbCommand}" -f json -o "${outputPath}" "${audioPath}" -r phonetic`;
      
      logger.info('Generating lip sync data', { audioFile, outputFile });
      
      const startTime = Date.now();
      
      exec(command, { timeout: this.ffmpegTimeout }, (error, stdout, stderr) => {
        const duration = Date.now() - startTime;
        
        if (error) {
          logger.error('Rhubarb lip sync failed', { 
            error: error.message,
            stderr,
            audioFile,
            outputFile,
            duration 
          });
          reject(new AudioProcessingError('Lip sync generation', error.message));
          return;
        }
        
        logger.info('Lip sync generation completed', { 
          audioFile, 
          outputFile, 
          duration 
        });
        resolve(outputPath);
      });
    });
  }

  /**
   * Process complete audio pipeline
   */
  async processAudio(audioBuffer, messageIndex) {
    try {
      const mp3Filename = `message_${messageIndex}.mp3`;
      const wavFilename = `message_${messageIndex}.wav`;
      const jsonFilename = `message_${messageIndex}.json`;

      // Save MP3 file
      await this.saveAudioFile(audioBuffer, mp3Filename);

      // Convert to WAV
      await this.convertMp3ToWav(mp3Filename, wavFilename);

      // Try to generate lip sync, but don't fail if Rhubarb is not available
      let lipSyncGenerated = false;
      try {
        await this.generateLipSync(wavFilename, jsonFilename);
        lipSyncGenerated = true;
        logger.info('Lip sync generation successful', { messageIndex });
      } catch (lipSyncError) {
        logger.warn('Lip sync generation failed, continuing without it', {
          messageIndex,
          error: lipSyncError.message
        });
        // Create empty lip sync data
        await this.createEmptyLipSync(jsonFilename);
      }

      logger.info('Audio processing pipeline completed', {
        messageIndex,
        files: [mp3Filename, wavFilename, jsonFilename],
        lipSyncGenerated
      });

      return {
        mp3File: mp3Filename,
        wavFile: wavFilename,
        lipSyncFile: jsonFilename,
      };
    } catch (error) {
      logger.error('Audio processing pipeline failed', {
        messageIndex,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Optimized audio processing with faster settings
   */
  async processAudioOptimized(audioBuffer, messageIndex, requestId) {
    try {
      const timestamp = Date.now();
      const mp3Filename = `msg_${timestamp}_${messageIndex}.mp3`;
      const wavFilename = `msg_${timestamp}_${messageIndex}.wav`;
      const jsonFilename = `msg_${timestamp}_${messageIndex}.json`;

      logger.info(`🔧 [${requestId}] Starting optimized audio processing...`);

      // Save MP3 file
      const saveStart = Date.now();
      await this.saveAudioFile(audioBuffer, mp3Filename);
      logger.info(`💾 [${requestId}] MP3 saved in ${Date.now() - saveStart}ms`);

      // Use faster FFmpeg conversion with optimized settings
      const convertStart = Date.now();
      await this.convertMp3ToWavOptimized(mp3Filename, wavFilename);
      logger.info(`🔄 [${requestId}] WAV conversion in ${Date.now() - convertStart}ms`);

      // Try optimized lip sync generation with timeout
      let lipSyncGenerated = false;
      const lipSyncStart = Date.now();
      try {
        await this.generateLipSyncOptimized(wavFilename, jsonFilename, requestId);
        lipSyncGenerated = true;
        logger.info(`[${requestId}] Lip sync generated in ${Date.now() - lipSyncStart}ms`);
      } catch (lipSyncError) {
        logger.warn(`⚠️ [${requestId}] Lip sync failed in ${Date.now() - lipSyncStart}ms, using fallback`, {
          error: lipSyncError.message
        });
        // Create minimal lip sync data
        await this.createMinimalLipSync(jsonFilename);
      }

      return {
        mp3File: mp3Filename,
        wavFile: wavFilename,
        lipSyncFile: jsonFilename,
        lipSyncGenerated
      };
    } catch (error) {
      logger.error(`❌ [${requestId}] Optimized audio processing failed`, {
        messageIndex,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create empty lip sync data when Rhubarb is not available
   */
  async createEmptyLipSync(filename) {
    const emptyLipSync = {
      metadata: {
        soundFile: "",
        duration: 0
      },
      mouthCues: []
    };

    const filePath = path.join(this.audioDir, filename);
    await fs.writeFile(filePath, JSON.stringify(emptyLipSync, null, 2));
    logger.info('Created empty lip sync file', { filename });
  }

  /**
   * Read audio file as base64
   */
  async readAudioAsBase64(filename) {
    try {
      const filePath = path.join(this.audioDir, filename);
      const data = await fs.readFile(filePath);
      return data.toString('base64');
    } catch (error) {
      logger.error('Failed to read audio file', { 
        filename, 
        error: error.message 
      });
      throw new FileProcessingError('read', filename, error);
    }
  }

  /**
   * Read lip sync JSON data
   */
  async readLipSyncData(filename) {
    try {
      const filePath = path.join(this.audioDir, filename);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to read lip sync data', { 
        filename, 
        error: error.message 
      });
      throw new FileProcessingError('read', filename, error);
    }
  }

  /**
   * Clean up old audio files
   */
  async cleanupOldFiles() {
    try {
      const files = await fs.readdir(this.audioDir);
      const maxFiles = config.audioConfig.maxFiles;
      
      if (files.length <= maxFiles) {
        return;
      }

      // Sort files by modification time
      const fileStats = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(this.audioDir, file);
          const stats = await fs.stat(filePath);
          return { file, mtime: stats.mtime };
        })
      );

      fileStats.sort((a, b) => a.mtime - b.mtime);
      
      // Remove oldest files
      const filesToRemove = fileStats.slice(0, files.length - maxFiles);
      
      await Promise.all(
        filesToRemove.map(async ({ file }) => {
          const filePath = path.join(this.audioDir, file);
          await fs.unlink(filePath);
          logger.info('Removed old audio file', { file });
        })
      );

      logger.info('Audio cleanup completed', { 
        removedCount: filesToRemove.length 
      });
    } catch (error) {
      logger.error('Audio cleanup failed', { error: error.message });
    }
  }

  /**
   * Get audio file info
   */
  async getFileInfo(filename) {
    try {
      const filePath = path.join(this.audioDir, filename);
      const stats = await fs.stat(filePath);
      
      return {
        filename,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        exists: true,
      };
    } catch (error) {
      return {
        filename,
        exists: false,
        error: error.message,
      };
    }
  }
  /**
   * Optimized FFmpeg conversion with faster settings
   */
  async convertMp3ToWavOptimized(inputFile, outputFile) {
    return new Promise((resolve, reject) => {
      const inputPath = path.join(this.audioDir, inputFile);
      const outputPath = path.join(this.audioDir, outputFile);

      // Optimized FFmpeg command with faster settings
      const command = `ffmpeg -y -i "${inputPath}" -ar 22050 -ac 1 -f wav "${outputPath}"`;

      const startTime = Date.now();

      exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
        const duration = Date.now() - startTime;

        if (error) {
          logger.error('Optimized FFmpeg conversion failed', {
            error: error.message,
            stderr,
            inputFile,
            outputFile,
            duration
          });
          reject(new AudioProcessingError(`FFmpeg conversion failed: ${error.message}`));
        } else {
          logger.info('Optimized FFmpeg conversion successful', {
            inputFile,
            outputFile,
            duration
          });
          resolve();
        }
      });
    });
  }

  /**
   * Optimized lip sync generation with timeout
   */
  async generateLipSyncOptimized(audioFile, outputFile, requestId) {
    return new Promise((resolve, reject) => {
      const audioPath = path.join(this.audioDir, audioFile);
      const outputPath = path.join(this.audioDir, outputFile);

      // Use simpler Rhubarb command for speed
      const rhubarbCommand = process.platform === 'win32'
        ? `.\\${this.rhubarbPath}`
        : './bin/rhubarb.exe';

      const command = `"${rhubarbCommand}" -f json -o "${outputPath}" "${audioPath}"`;

      const startTime = Date.now();

      // Shorter timeout for optimized processing
      exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
        const duration = Date.now() - startTime;

        if (error) {
          logger.warn(`⚠️ [${requestId}] Optimized Rhubarb failed in ${duration}ms`, {
            error: error.message,
            stderr: stderr?.substring(0, 200)
          });
          reject(new AudioProcessingError(`Rhubarb lip sync failed: ${error.message}`));
        } else {
          logger.info(`✅ [${requestId}] Optimized Rhubarb completed in ${duration}ms`);
          resolve();
        }
      });
    });
  }

  /**
   * Create minimal lip sync data for fast processing
   */
  async createMinimalLipSync(filename) {
    const minimalLipSync = {
      metadata: {
        soundFile: filename.replace('.json', '.wav'),
        duration: 0.5
      },
      mouthCues: [
        { start: 0.0, end: 0.5, value: 'A' }
      ]
    };

    const filePath = path.join(this.audioDir, filename);
    await fs.writeFile(filePath, JSON.stringify(minimalLipSync, null, 2));

    logger.info('Created minimal lip sync data', { filename });
  }
}

export default new AudioService();
