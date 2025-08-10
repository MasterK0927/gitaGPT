import logger from '../utils/logger.js';
import { catchAsync } from '../middleware/errorHandler.js';
import database from '../services/database.js';

class UserController {
  /**
   * Get user profile information
   */
  getProfile = catchAsync(async (req, res) => {
    const user = req.user;

    try {
      logger.info('User profile requested', { userId: user.id });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            username: user.username,
            avatarUrl: user.avatar_url,
            createdAt: user.created_at,
            updatedAt: user.updated_at
          }
        }
      });
    } catch (error) {
      logger.error('Failed to get user profile', {
        userId: user.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve user profile'
      });
    }
  });

  /**
   * Update user profile
   */
  updateProfile = catchAsync(async (req, res) => {
    const user = req.user;
    const { name, username } = req.body;

    try {
      const updates = {};
      if (name) updates.name = name;
      if (username) updates.username = username;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid fields to update'
        });
      }

      // Check if username is already taken
      if (username && username !== user.username) {
        const existingUser = await database.getUserByUsername(username);
        if (existingUser && existingUser.id !== user.id) {
          return res.status(400).json({
            success: false,
            error: 'Username is already taken'
          });
        }
      }

      const updatedUser = await database.updateUser(user.clerk_id, updates);

      logger.info('User profile updated', {
        userId: user.id,
        updates: Object.keys(updates)
      });

      res.json({
        success: true,
        data: { user: updatedUser },
        message: 'Profile updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update user profile', {
        userId: user.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update profile'
      });
    }
  });

  /**
   * Request account deletion (soft delete)
   */
  requestAccountDeletion = catchAsync(async (req, res) => {
    const user = req.user;
    const { reason = 'User requested deletion' } = req.body;

    try {
      await database.softDeleteUser(user.id, reason);

      logger.info('User account deletion requested', {
        userId: user.id,
        reason
      });

      res.json({
        success: true,
        message: 'Account deletion scheduled. You have 30 days to restore your account by logging in.',
        data: {
          deletionScheduledAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          restorationPeriod: '30 days'
        }
      });
    } catch (error) {
      logger.error('Failed to delete user account', {
        userId: user.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to process account deletion request'
      });
    }
  });

  /**
   * Restore user account
   */
  restoreAccount = catchAsync(async (req, res) => {
    const user = req.user;

    try {
      await database.restoreUserAccount(user.id);

      logger.info('User account restored', { userId: user.id });

      res.json({
        success: true,
        message: 'Account successfully restored'
      });
    } catch (error) {
      logger.error('Failed to restore user account', {
        userId: user.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to restore account'
      });
    }
  });

  /**
   * Check account deletion status
   */
  getAccountStatus = catchAsync(async (req, res) => {
    const user = req.user;

    try {
      const status = await database.checkUserDeletionStatus(user.clerk_id);

      if (!status) {
        return res.json({
          success: true,
          data: {
            status: 'active',
            deletedAt: null,
            deletionScheduledAt: null,
            canRestore: false
          }
        });
      }

      const canRestore = status.deleted_at && status.deletion_scheduled_at && 
                        new Date(status.deletion_scheduled_at) > new Date();

      res.json({
        success: true,
        data: {
          status: status.deleted_at ? 'deleted' : 'active',
          deletedAt: status.deleted_at,
          deletionScheduledAt: status.deletion_scheduled_at,
          deletionReason: status.deletion_reason,
          canRestore
        }
      });
    } catch (error) {
      logger.error('Failed to get account status', {
        userId: user.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve account status'
      });
    }
  });

  /**
   * Get user statistics
   */
  getStats = catchAsync(async (req, res) => {
    const user = req.user;

    try {
      logger.info('User stats requested', { userId: user.id });

      // Get real-time user statistics
      const stats = await database.getUserStats(user.id);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get user stats', {
        userId: user.id,
        error: error.message
      });

      throw error;
    }
  });
}

export default new UserController();
