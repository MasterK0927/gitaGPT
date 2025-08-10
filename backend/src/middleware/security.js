import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { body, validationResult } from 'express-validator';
import config from '../config/index.js';
import { ValidationError, RateLimitError } from '../utils/errors.js';
import logger from '../utils/logger.js';

/**
 * Rate limiting middleware
 */
export const rateLimiter = rateLimit({
  windowMs: config.securityConfig.rateLimitWindowMs,
  max: config.securityConfig.rateLimitMaxRequests,
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again later.',
      type: 'RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: 'draft-7',
  legacyHeaders: true,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
    });

    const error = new RateLimitError();
    res.status(error.statusCode).json({
      success: false,
      error: error.toJSON(),
    });
  },
});

/**
 * CORS configuration
 */
export const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = config.securityConfig.corsOrigin.split(',');
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request', { origin, allowedOrigins });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

/**
 * Security headers middleware
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

/**
 * Input validation middleware
 */
export const validateChatInput = [
  body('message')
    .optional()
    .isString()
    .withMessage('Message must be a string')
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be between 1 and 2000 characters')
    .trim()
    .escape()
    .customSanitizer(value => {
      // Remove potentially dangerous patterns
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/data:text\/html/gi, '');
    }),
  body('conversationId')
    .optional()
    .custom((value) => {
      // Allow null, undefined, or valid UUID
      if (value === null || value === undefined || value === '') {
        return true;
      }
      // Check if it's a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(value)) {
        throw new Error('Conversation ID must be a valid UUID or null');
      }
      return true;
    }),
  body('audioEnabled')
    .optional()
    .isBoolean()
    .withMessage('Audio enabled must be a boolean'),
];

/**
 * Validate user registration input
 */
export const validateUserRegistration = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Email too long'),
  body('name')
    .isString()
    .withMessage('Name must be a string')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .trim()
    .escape(),
  body('username')
    .optional()
    .isString()
    .withMessage('Username must be a string')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens')
    .trim(),
];

/**
 * Validate meditation schedule input
 */
export const validateMeditationSchedule = [
  body('title')
    .isString()
    .withMessage('Title must be a string')
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters')
    .trim()
    .escape(),
  body('duration_minutes')
    .isInt({ min: 1, max: 120 })
    .withMessage('Duration must be between 1 and 120 minutes'),
  body('frequency')
    .isIn(['daily', 'weekly', 'custom'])
    .withMessage('Frequency must be daily, weekly, or custom'),
  body('time_of_day')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Time must be in HH:MM format'),
  body('timezone')
    .optional()
    .isString()
    .withMessage('Timezone must be a string')
    .isLength({ max: 50 })
    .withMessage('Timezone too long'),
];

/**
 * Handle validation errors
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value,
    }));

    logger.warn('Validation failed', {
      errors: errorMessages,
      ip: req.ip,
      url: req.url,
      method: req.method,
      body: req.body,
      headers: {
        'content-type': req.get('content-type'),
        'user-agent': req.get('user-agent')
      }
    });

    const error = new ValidationError('Invalid input data');
    return res.status(error.statusCode).json({
      success: false,
      error: {
        ...error.toJSON(),
        details: errorMessages,
      },
    });
  }

  next();
};

/**
 * Sanitize request data
 */
export const sanitizeInput = (req, _res, next) => {
  // Remove any potentially dangerous characters
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  next();
};

/**
 * SQL injection prevention middleware
 */
export const preventSQLInjection = (req, res, next) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /('|(\\')|(;)|(\\)|(\/\*)|(--)|(\*\/))/gi,
    /((\%27)|(\')|(\\x27))/gi,
    /((\%3D)|(=))/gi,
    /((\%3B)|(;))/gi,
  ];

  const checkForSQLInjection = (obj) => {
    if (typeof obj === 'string') {
      return sqlPatterns.some(pattern => pattern.test(obj));
    }
    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(value => checkForSQLInjection(value));
    }
    return false;
  };

  if (checkForSQLInjection(req.body) || checkForSQLInjection(req.query) || checkForSQLInjection(req.params)) {
    logger.warn('Potential SQL injection attempt detected', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method,
      body: req.body,
      query: req.query,
      params: req.params,
    });

    return res.status(400).json({
      success: false,
      error: {
        message: 'Invalid input detected',
        type: 'SECURITY_VIOLATION',
      },
    });
  }

  next();
};

/**
 * Recursively sanitize object properties
 */
const sanitizeObject = (obj) => {
  // Handle arrays separately to preserve array structure
  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (typeof item === 'string') {
        return item
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      } else if (typeof item === 'object' && item !== null) {
        return sanitizeObject(item);
      } else {
        return item;
      }
    });
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Remove script tags and other potentially dangerous content
      sanitized[key] = value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

/**
 * Request size limiter
 */
export const requestSizeLimiter = (req, res, next) => {
  const contentLength = req.get('content-length');
  const maxSize = parseInt(config.securityConfig.requestSizeLimit.replace(/\D/g, '')) * 1024 * 1024; // Convert to bytes
  
  if (contentLength && parseInt(contentLength) > maxSize) {
    logger.warn('Request size exceeded', { 
      contentLength, 
      maxSize, 
      ip: req.ip 
    });
    
    return res.status(413).json({
      success: false,
      error: {
        message: 'Request entity too large',
        maxSize: config.securityConfig.requestSizeLimit,
      },
    });
  }
  
  next();
};
