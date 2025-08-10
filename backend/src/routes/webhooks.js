import express from 'express';
import { Webhook } from 'svix';
import database from '../services/database.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Clerk webhook handler
router.post('/clerk', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
    
    if (!WEBHOOK_SECRET) {
      logger.error('Clerk webhook secret not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Get headers
    const svix_id = req.headers['svix-id'];
    const svix_timestamp = req.headers['svix-timestamp'];
    const svix_signature = req.headers['svix-signature'];

    // Verify webhook
    const wh = new Webhook(WEBHOOK_SECRET);
    let evt;

    try {
      evt = wh.verify(req.body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      });
    } catch (err) {
      logger.error('Webhook verification failed', { error: err.message });
      return res.status(400).json({ error: 'Webhook verification failed' });
    }

    // Handle different event types
    const { type, data } = evt;
    
    logger.info('Clerk webhook received', { 
      type, 
      userId: data.id,
      email: data.email_addresses?.[0]?.email_address 
    });

    switch (type) {
      case 'user.created':
        await handleUserCreated(data);
        break;
        
      case 'user.updated':
        await handleUserUpdated(data);
        break;
        
      case 'user.deleted':
        await handleUserDeleted(data);
        break;
        
      case 'session.created':
        await handleSessionCreated(data);
        break;
        
      default:
        logger.info('Unhandled webhook event type', { type });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Webhook handler error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Handle user creation
async function handleUserCreated(userData) {
  try {
    const user = await database.createUser({
      clerkId: userData.id,
      email: userData.email_addresses?.[0]?.email_address,
      name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'User',
      username: userData.username,
      avatarUrl: userData.image_url,
    });

    logger.info('User created via webhook', {
      userId: user.id,
      clerkId: userData.id,
      email: user.email
    });

    // Initialize user stats
    await database.supabase
      .from('user_stats')
      .insert({
        user_id: user.id,
        total_messages: 0,
        total_conversations: 0,
        total_session_time: 0,
        last_active_at: new Date().toISOString()
      });

  } catch (error) {
    // User might already exist, that's okay
    if (error.code === '23505') { // Unique constraint violation
      logger.info('User already exists', { clerkId: userData.id });
    } else {
      logger.error('Failed to create user via webhook', {
        clerkId: userData.id,
        error: error.message
      });
    }
  }
}

// Handle user updates
async function handleUserUpdated(userData) {
  try {
    await database.updateUser(userData.id, {
      email: userData.email_addresses?.[0]?.email_address,
      name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'User',
      username: userData.username,
      avatarUrl: userData.image_url,
    });

    logger.info('User updated via webhook', {
      clerkId: userData.id,
      email: userData.email_addresses?.[0]?.email_address
    });
  } catch (error) {
    logger.error('Failed to update user via webhook', {
      clerkId: userData.id,
      error: error.message
    });
  }
}

// Handle user deletion
async function handleUserDeleted(userData) {
  try {
    // Soft delete - mark as deleted but keep data for analytics
    await database.updateUser(userData.id, {
      deleted_at: new Date().toISOString()
    });

    logger.info('User deleted via webhook', {
      clerkId: userData.id
    });
  } catch (error) {
    logger.error('Failed to delete user via webhook', {
      clerkId: userData.id,
      error: error.message
    });
  }
}

// Handle session creation (user login)
async function handleSessionCreated(sessionData) {
  try {
    const userId = sessionData.user_id;
    
    // Update last active timestamp
    const user = await database.getUserByClerkId(userId);
    if (user) {
      await database.supabase
        .from('user_stats')
        .upsert({
          user_id: user.id,
          last_active_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });
    }

    logger.info('User session created', {
      clerkId: userId,
      sessionId: sessionData.id
    });
  } catch (error) {
    logger.error('Failed to handle session creation', {
      sessionId: sessionData.id,
      error: error.message
    });
  }
}

export default router;
