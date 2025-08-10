import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import config from '../config/index.js';

/**
 * Global error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    error = handleValidationError(err);
  } else if (err.name === 'CastError') {
    error = handleCastError(err);
  } else if (err.code === 11000) {
    error = handleDuplicateFieldError(err);
  } else if (err.name === 'JsonWebTokenError') {
    error = handleJWTError(err);
  } else if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError(err);
  } else if (err.code === 'ENOENT') {
    error = handleFileNotFoundError(err);
  } else if (err.code === 'EACCES') {
    error = handleFilePermissionError(err);
  }

  // Ensure error is an AppError instance
  if (!(error instanceof AppError)) {
    error = new AppError(
      config.isProduction ? 'Something went wrong' : err.message,
      err.statusCode || 500
    );
  }

  // Send error response
  res.status(error.statusCode).json({
    success: false,
    error: {
      message: error.message,
      ...(config.isDevelopment && { stack: err.stack }),
      timestamp: error.timestamp || new Date().toISOString(),
    },
  });
};

/**
 * Handle validation errors
 */
const handleValidationError = (err) => {
  const message = Object.values(err.errors).map(val => val.message).join(', ');
  return new AppError(message, 400);
};

/**
 * Handle cast errors
 */
const handleCastError = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

/**
 * Handle duplicate field errors
 */
const handleDuplicateFieldError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const message = `Duplicate field value: ${field}`;
  return new AppError(message, 400);
};

/**
 * Handle JWT errors
 */
const handleJWTError = () => {
  return new AppError('Invalid token', 401);
};

/**
 * Handle JWT expired errors
 */
const handleJWTExpiredError = () => {
  return new AppError('Token expired', 401);
};

/**
 * Handle file not found errors
 */
const handleFileNotFoundError = (err) => {
  return new AppError(`File not found: ${err.path}`, 404);
};

/**
 * Handle file permission errors
 */
const handleFilePermissionError = (err) => {
  return new AppError(`Permission denied: ${err.path}`, 403);
};

/**
 * Catch async errors
 */
export const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle 404 errors
 */
export const notFound = (req, res, next) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtException = () => {
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
    console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    process.exit(1);
  });
};

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejection = (server) => {
  process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection', { error: err.message, stack: err.stack });
    console.log('UNHANDLED REJECTION! 💥 Shutting down...');
    server.close(() => {
      process.exit(1);
    });
  });
};
