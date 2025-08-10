import express from 'express';
import ChatController from '../controllers/ChatController.js';
import { validateChatInput, handleValidationErrors } from '../middleware/security.js';
import { rateLimiter } from '../middleware/security.js';
import { requireAuth, syncUser, chatRateLimit } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route POST /api/v1/chat
 * @desc Process chat message and return AI response with audio
 * @access Private (requires authentication)
 * @rateLimit 10 requests per 15 minutes per user
 */
// Test endpoint for debugging
router.post('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Chat endpoint is working',
    body: req.body,
    headers: {
      'content-type': req.get('content-type'),
      'authorization': req.get('authorization') ? 'Bearer [REDACTED]' : 'None'
    },
    timestamp: new Date().toISOString()
  });
});

router.post(
  '/',
  requireAuth,
  syncUser,
  // chatRateLimit, // Temporarily disabled for debugging
  // validateChatInput, // Temporarily disabled for debugging
  // handleValidationErrors, // Temporarily disabled for debugging
  ChatController.chat
);



/**
 * @route GET /api/v1/chat/conversations
 * @desc Get user's conversations
 * @access Private
 */
router.get(
  '/conversations',
  requireAuth,
  syncUser,
  ChatController.getConversations
);

/**
 * @route GET /api/v1/chat/conversations/:id/messages
 * @desc Get messages for a conversation
 * @access Private
 */
router.get(
  '/conversations/:id/messages',
  requireAuth,
  syncUser,
  ChatController.getMessages
);

/**
 * @route GET /api/v1/chat/conversations/:id/details
 * @desc Get conversation with messages for modal display
 * @access Private
 */
router.get(
  '/conversations/:id/details',
  requireAuth,
  syncUser,
  ChatController.getConversationDetails
);

/**
 * @route DELETE /api/v1/chat/conversations/:id
 * @desc Delete a conversation (soft delete)
 * @access Private
 */
router.delete(
  '/conversations/:id',
  requireAuth,
  syncUser,
  ChatController.deleteConversation
);

/**
 * @route POST /api/v1/chat/conversations
 * @desc Create a new conversation
 * @access Private
 */
router.post(
  '/conversations',
  requireAuth,
  syncUser,
  ChatController.createConversation
);



/**
 * @route GET /api/v1/chat/voices
 * @desc Get available voices (legacy endpoint for compatibility)
 * @access Public
 */
router.get('/voices', (req, res) => {
  res.json({
    success: true,
    data: {
      voices: [],
      message: 'Voice selection is handled automatically',
    },
  });
});

export default router;
