import express from 'express';
import UserController from '../controllers/UserController.js';
import { requireAuth, syncUser } from '../middleware/auth.js';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/security.js';

const router = express.Router();

/**
 * @route GET /api/v1/user/profile
 * @desc Get user profile information
 * @access Private
 */
router.get(
  '/profile',
  requireAuth,
  syncUser,
  UserController.getProfile
);

/**
 * @route PUT /api/v1/user/profile
 * @desc Update user profile
 * @access Private
 */
router.put(
  '/profile',
  requireAuth,
  syncUser,
  [
    body('name')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be between 1 and 100 characters'),
    body('username')
      .optional()
      .isLength({ min: 3, max: 30 })
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores')
  ],
  handleValidationErrors,
  UserController.updateProfile
);

/**
 * @route GET /api/v1/user/stats
 * @desc Get user statistics
 * @access Private
 */
router.get(
  '/stats',
  requireAuth,
  syncUser,
  UserController.getStats
);

/**
 * @route GET /api/v1/user/account-status
 * @desc Get account deletion status
 * @access Private
 */
router.get(
  '/account-status',
  requireAuth,
  syncUser,
  UserController.getAccountStatus
);

/**
 * @route POST /api/v1/user/delete-account
 * @desc Request account deletion (soft delete)
 * @access Private
 */
router.post(
  '/delete-account',
  requireAuth,
  syncUser,
  [
    body('reason')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Reason must be less than 500 characters')
  ],
  handleValidationErrors,
  UserController.requestAccountDeletion
);

/**
 * @route POST /api/v1/user/restore-account
 * @desc Restore user account
 * @access Private
 */
router.post(
  '/restore-account',
  requireAuth,
  syncUser,
  UserController.restoreAccount
);

export default router;
