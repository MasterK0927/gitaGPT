/**
 * Custom error classes for better error handling
 */

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Validation error class
 */
export class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 400);
    this.field = field;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      field: this.field,
    };
  }
}

/**
 * Authentication error class
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
  }
}

/**
 * Authorization error class
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
  }
}

/**
 * Not found error class
 */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

/**
 * Rate limit error class
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429);
  }
}

/**
 * External API error class
 */
export class ExternalAPIError extends AppError {
  constructor(service, message, originalError = null) {
    super(`${service} API error: ${message}`, 502);
    this.service = service;
    this.originalError = originalError;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      service: this.service,
      originalError: this.originalError?.message,
    };
  }
}

/**
 * File processing error class
 */
export class FileProcessingError extends AppError {
  constructor(operation, filename, originalError = null) {
    super(`Failed to ${operation} file: ${filename}`, 500);
    this.operation = operation;
    this.filename = filename;
    this.originalError = originalError;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      operation: this.operation,
      filename: this.filename,
      originalError: this.originalError?.message,
    };
  }
}

/**
 * Audio processing error class
 */
export class AudioProcessingError extends AppError {
  constructor(operation, details = null) {
    super(`Audio processing failed: ${operation}`, 500);
    this.operation = operation;
    this.details = details;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      operation: this.operation,
      details: this.details,
    };
  }
}

/**
 * Configuration error class
 */
export class ConfigurationError extends AppError {
  constructor(setting, message) {
    super(`Configuration error for ${setting}: ${message}`, 500, false);
    this.setting = setting;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      setting: this.setting,
    };
  }
}
