import express from 'express';
import { clerkClient } from '@clerk/clerk-sdk-node';
import logger from '../utils/logger.js';
import rateLimit from 'express-rate-limit';
import database from '../services/database.js';

const router = express.Router();

// Check Clerk configuration on startup
if (!process.env.CLERK_SECRET_KEY) {
  logger.error('CLERK_SECRET_KEY not configured - authentication will not work');
  console.error('❌ CLERK_SECRET_KEY not configured - authentication will not work');
} else {
  logger.info('✅ Clerk authentication configured');
  console.log('✅ Clerk authentication configured');
}

// Simple in-memory rate limiting for auth endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
router.use(authRateLimit);

// Simple test endpoint
router.get('/test', (_req, res) => {
  console.log('🧪 Auth test endpoint hit');
  res.json({
    success: true,
    message: 'Auth routes are working!',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/v1/auth/check-username
 * Check if username is available in Clerk
 */
router.post('/check-username', async (req, res) => {
  try {
    console.log('🔍 Username check endpoint hit:', req.body);

    const { username } = req.body;

    if (!username) {
      console.log('❌ No username provided');
      return res.status(400).json({
        success: false,
        error: 'Username is required'
      });
    }

    console.log('✅ Username provided:', username);

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!usernameRegex.test(username)) {
      console.log('❌ Invalid username format:', username);
      return res.json({
        success: true,
        available: false,
        reason: 'invalid_format',
        message: 'Username must be 3-20 characters and contain only letters, numbers, underscores, and hyphens'
      });
    }

    // Check reserved usernames
    const reservedUsernames = [
      'admin', 'administrator', 'root', 'api', 'www', 'mail', 'ftp',
      'support', 'help', 'info', 'contact', 'about', 'terms', 'privacy',
      'login', 'register', 'signup', 'signin', 'logout', 'profile',
      'settings', 'dashboard', 'user', 'users', 'account', 'accounts',
      'system', 'service', 'services', 'test', 'demo', 'example',
      'null', 'undefined', 'true', 'false', 'gitagpt', 'gita', 'gpt'
    ];

    if (reservedUsernames.includes(username.toLowerCase())) {
      console.log('❌ Reserved username:', username);
      return res.json({
        success: true,
        available: false,
        reason: 'reserved',
        message: 'This username is reserved and cannot be used'
      });
    }

    console.log('🔍 Checking with Clerk API...');

    // Check with Clerk API
    try {
      const users = await clerkClient.users.getUserList({
        username: [username],
        limit: 1
      });

      const isAvailable = users.length === 0;

      console.log('✅ Clerk check complete:', { username, available: isAvailable, userCount: users.length });

      logger.info('✅ Username availability checked', {
        operation: 'USERNAME_CHECK',
        username,
        available: isAvailable,
        source: 'clerk'
      });

      res.json({
        success: true,
        available: isAvailable,
        reason: isAvailable ? null : 'taken',
        message: isAvailable ? 'Username is available' : 'Username is already taken'
      });

    } catch (clerkError) {
      console.error('❌ Clerk API error:', clerkError);

      logger.error('❌ Clerk API error during username check', {
        operation: 'USERNAME_CHECK',
        username,
        error: clerkError.message,
        source: 'clerk'
      });

      // If Clerk API fails, we'll assume it's available but warn
      res.json({
        success: true,
        available: true,
        reason: 'api_error',
        message: 'Unable to verify availability, but username appears valid'
      });
    }



  } catch (error) {
    console.error('❌ Username check failed:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to check username availability'
    });
  }
});

/**
 * GET /api/v1/auth/username-suggestions
 * Get username suggestions based on email or name
 */
router.get('/username-suggestions', async (req, res) => {
  try {
    const { email, name, base } = req.query;

    if (!email && !name && !base) {
      return res.status(400).json({
        success: false,
        error: 'Email, name, or base username is required'
      });
    }

    logger.info('🔍 Generating username suggestions', {
      operation: 'USERNAME_SUGGESTIONS',
      email: email ? '***@***' : null,
      name: name ? '***' : null,
      base
    });

    const suggestions = [];
    let baseUsername = '';

    // Generate base from email, name, or provided base
    if (base) {
      baseUsername = base.toLowerCase().replace(/[^a-z0-9]/g, '');
    } else if (email) {
      baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    } else if (name) {
      baseUsername = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    // Ensure minimum length
    if (baseUsername.length < 3) {
      baseUsername = baseUsername + 'user';
    }

    // Generate variations
    const variations = [
      baseUsername,
      baseUsername + Math.floor(Math.random() * 100),
      baseUsername + Math.floor(Math.random() * 1000),
      baseUsername + '_' + Math.floor(Math.random() * 100),
      baseUsername + new Date().getFullYear().toString().slice(-2),
      'user_' + baseUsername,
      baseUsername + '_dev',
      baseUsername + '_' + Math.random().toString(36).substring(2, 5)
    ];

    // Check availability for each variation
    for (const variation of variations) {
      if (suggestions.length >= 5) break; // Limit to 5 suggestions

      try {
        const users = await clerkClient.users.getUserList({
          username: [variation],
          limit: 1
        });

        if (users.length === 0) {
          suggestions.push(variation);
        }
      } catch (clerkError) {
        // If Clerk API fails, still include the suggestion
        suggestions.push(variation);
      }
    }

    logger.info('✅ Username suggestions generated', {
      operation: 'USERNAME_SUGGESTIONS',
      count: suggestions.length,
      baseUsername
    });

    res.json({
      success: true,
      suggestions,
      base: baseUsername
    });

  } catch (error) {
    logger.error('❌ Username suggestions failed', {
      operation: 'USERNAME_SUGGESTIONS',
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to generate username suggestions'
    });
  }
});

/**
 * POST /api/v1/auth/sync-user
 * Manually sync user from Clerk to database (fallback for webhook issues)
 */
router.post('/sync-user', async (req, res) => {
  try {
    const { clerkUserId, username, email, name, provider, avatarUrl } = req.body;

    if (!clerkUserId && !username) {
      return res.status(400).json({
        success: false,
        error: 'Clerk user ID or username is required'
      });
    }

    console.log('🔄 Syncing user from Clerk:', { clerkUserId, username });

    // Check if Clerk is properly configured
    if (!process.env.CLERK_SECRET_KEY) {
      logger.error('CLERK_SECRET_KEY not configured');
      return res.status(500).json({
        success: false,
        error: 'Authentication service not properly configured'
      });
    }

    // Get user data from Clerk
    let clerkUser;
    try {
      if (clerkUserId) {
        console.log('🔍 Fetching user from Clerk by ID:', clerkUserId);
        // Try to get user by ID first
        clerkUser = await clerkClient.users.getUser(clerkUserId);
        console.log('✅ User found in Clerk:', { id: clerkUser.id, email: clerkUser.emailAddresses[0]?.emailAddress });
      } else if (username) {
        console.log('🔍 Fetching user from Clerk by username:', username);
        // If no user ID, try to find by username
        const users = await clerkClient.users.getUserList({
          username: [username],
          limit: 1
        });

        if (users.length === 0) {
          console.log('❌ User not found in Clerk by username:', username);
          return res.status(404).json({
            success: false,
            error: `User with username '${username}' not found in Clerk`
          });
        }

        clerkUser = users[0];
      }

      console.log('✅ Retrieved user from Clerk:', {
        id: clerkUser.id,
        email: clerkUser.emailAddresses?.[0]?.emailAddress,
        username: clerkUser.username
      });

      // Check if user already exists in database
      const existingUser = await database.getUserByClerkId(clerkUserId);

      if (existingUser) {
        console.log('✅ User already exists in database:', existingUser.id);
        return res.json({
          success: true,
          user: existingUser,
          message: 'User already synced'
        });
      }

      // Create user in database
      const userData = {
        clerkId: clerkUser.id,
        email: email || clerkUser.emailAddresses?.[0]?.emailAddress,
        name: name || `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
        username: username || clerkUser.username,
        avatarUrl: avatarUrl || clerkUser.imageUrl,
        provider: provider || 'clerk'
      };

      console.log('🔄 Creating user in database:', userData);

      const newUser = await database.createUser(userData);

      console.log('✅ User created in database:', newUser.id);

      // Initialize user stats
      try {
        await database.supabase
          .from('user_stats')
          .insert({
            user_id: newUser.id,
            total_messages: 0,
            total_conversations: 0,
            total_session_time: 0,
            last_active_at: new Date().toISOString()
          });

        console.log('✅ User stats initialized');
      } catch (statsError) {
        console.warn('⚠️ Failed to initialize user stats:', statsError.message);
      }

      res.json({
        success: true,
        user: newUser,
        message: 'User synced successfully'
      });

    } catch (clerkError) {
      console.error('❌ Failed to get user from Clerk:', {
        message: clerkError.message,
        status: clerkError.status,
        clerkUserId,
        username,
        stack: clerkError.stack
      });

      logger.error('❌ Clerk API error during user sync', {
        operation: 'USER_SYNC',
        clerkUserId,
        username,
        error: clerkError.message,
        statusCode: clerkError.status,
        stack: clerkError.stack
      });

      // Handle specific Clerk error types
      if (clerkError.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'User not found in Clerk',
          details: `User with ${clerkUserId ? 'ID' : 'username'} '${clerkUserId || username}' does not exist`
        });
      }

      if (clerkError.status === 401 || clerkError.status === 403) {
        return res.status(500).json({
          success: false,
          error: 'Authentication service configuration error',
          details: 'Invalid or missing Clerk API credentials'
        });
      }

      // Generic error for other cases
      return res.status(500).json({
        success: false,
        error: 'Failed to sync user with authentication service',
        details: clerkError.message
      });
    }

  } catch (error) {
    console.error('❌ User sync failed:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to sync user'
    });
  }
});

export default router;
