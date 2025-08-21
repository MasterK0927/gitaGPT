import { ClerkExpressRequireAuth, ClerkExpressWithAuth } from '@clerk/clerk-sdk-node';
import database from '../services/database.js';
import logger from '../services/logger.js';
import config from '../config/index.js';

// Authentication with session validation
const requireAuth = ClerkExpressRequireAuth({
  onError: (error) => {
    logger.security('Authentication failed', null, { error: error.message });

    // Check if it's a token expiration error
    if (error.message?.includes('expired') || error.message?.includes('invalid') || error.message?.includes('jwt')) {
      return {
        status: 401,
        message: 'Session expired. Please log in again.',
        code: 'SESSION_EXPIRED',
        timestamp: new Date().toISOString()
      };
    }

    return {
      status: 401,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED',
      timestamp: new Date().toISOString()
    };
  }
});

// Middleware to optionally check authentication with session validation
const withAuth = ClerkExpressWithAuth({
  onError: (error) => {
    logger.security('Authentication error', null, { error: error.message });
  }
});

// Session validation middleware
const validateSession = async (req, res, next) => {
  try {
    if (req.auth && req.auth.userId) {
      // Check if the session is still valid
      const sessionAge = req.auth.sessionClaims?.iat ?
        Date.now() - (req.auth.sessionClaims.iat * 1000) : 0;

      const maxSessionAge = config.securityConfig.jwtExpirationMs;

      if (sessionAge > maxSessionAge) {
        logger.security('Session expired', req.auth.userId, {
          sessionAge,
          maxSessionAge,
          endpoint: req.path,
          timestamp: new Date().toISOString()
        });

        return res.status(401).json({
          success: false,
          error: 'Session expired. Please log in again.',
          code: 'SESSION_EXPIRED',
          timestamp: new Date().toISOString(),
          sessionAge,
          maxSessionAge
        });
      }

      // Add session info to response headers for frontend monitoring
      res.set({
        'X-Session-Age': sessionAge,
        'X-Session-Max-Age': maxSessionAge,
        'X-Session-Remaining': Math.max(0, maxSessionAge - sessionAge)
      });
    }

    next();
  } catch (error) {
    logger.errorWithContext(error, {
      userId: req.auth?.userId,
      endpoint: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: 'Session validation failed',
      timestamp: new Date().toISOString()
    });
  }
};

// Middleware to sync user with database
const syncUser = async (req, res, next) => {
  try {
    if (req.auth && req.auth.userId) {
      const clerkId = req.auth.userId;

      // Check if user exists in our database
      let user = await database.getUserByClerkId(clerkId);
      
      if (!user) {
        // Get user data from Clerk
        const { clerkClient } = await import('@clerk/clerk-sdk-node');
        const clerkUser = await clerkClient.users.getUser(clerkId);
        
        // Create user in our database
        user = await database.createUser({
          clerkId: clerkId,
          email: clerkUser.emailAddresses[0]?.emailAddress,
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
          username: clerkUser.username,
          avatarUrl: clerkUser.imageUrl,
        });
        
        logger.user(user.id, 'New user created', { email: user.email, clerkId });
      }
      
      // Attach user to request
      req.user = user;
      
      // Log user activity
      logger.user(user.id, 'User authenticated', {
        email: user.email,
        endpoint: req.path,
        clerkId
      });
    }
    
    next();
  } catch (error) {
    logger.errorWithContext(error, {
      userId: req.auth?.userId,
      endpoint: req.path,
      method: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to sync user data'
    });
  }
};

// Rate limiting middleware
import rateLimit from 'express-rate-limit';
import cache from '../services/cache.js';

const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // limit each IP to 100 requests per windowMs
    message = 'Too many requests from this IP, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: message
    },
    skipSuccessfulRequests,
    skipFailedRequests,
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise IP
      return req.auth?.userId || req.ip;
    },
    store: {
      // Custom store using Redis
      async incr(key) {
        const result = await cache.checkRateLimit(key, max, Math.floor(windowMs / 1000));
        return {
          totalHits: result.current,
          resetTime: new Date(Date.now() + windowMs)
        };
      },
      async decrement(_key) {
        // Redis handles expiration automatically
      },
      async resetKey(key) {
        await cache.del(`rate_limit:${key}`);
      }
    },
    onLimitReached: (req, _res, _options) => {
      const identifier = req.auth?.userId || req.ip;
      logger.security('Rate limit exceeded', req.auth?.userId, {
        identifier,
        endpoint: req.path,
        method: req.method
      });
    }
  });
};

// Different rate limits for different endpoints
const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later.'
});

const apiRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 API calls per 15 minutes
  message: 'Too many API requests, please try again later.'
});

const chatRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'development' ? 100 : 10, // More lenient in development
  message: 'Too many chat messages, please slow down.'
});

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  
  req.requestId = requestId;
  
  // Log request
  logger.request(requestId, req.auth?.userId, `${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.method === 'POST' ? req.body : undefined
  });
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.api(req.method, req.path, res.statusCode, duration, req.auth?.userId, {
      requestId,
      ip: req.ip
    });
  });
  
  next();
};

// Error handling middleware
const errorHandler = (error, req, res, _next) => {
  const requestId = req.requestId;
  const userId = req.auth?.userId;
  
  logger.errorWithContext(error, {
    requestId,
    userId,
    endpoint: req.path,
    method: req.method,
    ip: req.ip
  });
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    success: false,
    error: isDevelopment ? error.message : 'Internal server error',
    requestId: isDevelopment ? requestId : undefined
  });
};

export {
  requireAuth,
  withAuth,
  validateSession,
  syncUser,
  authRateLimit,
  apiRateLimit,
  chatRateLimit,
  requestLogger,
  errorHandler,
  createRateLimiter
};
