import logger from '../utils/logger.js';
import { catchAsync } from '../middleware/errorHandler.js';
import database from '../services/database.js';
import messageQueue from '../services/messageQueue.js';

class MeditationController {
  /**
   * Create a new meditation schedule
   */
  createSchedule = catchAsync(async (req, res) => {
    const user = req.user;
    const scheduleData = req.body;

    try {
      // Debug: Log the received data
      logger.info('Creating meditation schedule', {
        userId: user.id,
        title: scheduleData.title,
        scheduleData: JSON.stringify(scheduleData, null, 2),
        daysOfWeek: scheduleData.days_of_week,
        daysOfWeekType: typeof scheduleData.days_of_week,
        daysOfWeekIsArray: Array.isArray(scheduleData.days_of_week)
      });

      logger.info('Step 1: About to create schedule in database');
      const schedule = await database.createMeditationSchedule(user.id, scheduleData);
      logger.info('Step 2: Schedule created successfully', { scheduleId: schedule.id });

      // Queue email sending task and track status
      let emailStatus = 'pending';
      let emailError = null;

      logger.info('Step 3: About to queue email');
      try {
        await messageQueue.publish('email', {
          type: 'meditation_schedule_created',
          userEmail: user.email,
          userName: user.name || user.username || 'User',
          schedule: schedule
        }, {
          priority: 5, // Medium priority
          correlationId: `schedule_${schedule.id}`,
          headers: {
            userId: user.id,
            scheduleId: schedule.id
          }
        });
        emailStatus = 'queued';
        logger.info(`Step 4: Email queued for meditation schedule: ${schedule.id}`);

        // Update email status in database
        logger.info('Step 5: About to update email status to queued');
        await database.updateScheduleEmailStatus(schedule.id, 'queued');
        logger.info('Step 6: Email status updated to queued');
      } catch (emailErr) {
        emailStatus = 'failed';
        emailError = emailErr.message;
        logger.error(`Step 4-ERROR: Failed to queue email for schedule ${schedule.id}:`, emailErr);

        // Update email status in database
        try {
          await database.updateScheduleEmailStatus(schedule.id, 'failed', emailErr.message);
          logger.info('Step 5-ERROR: Email status updated to failed');
        } catch (updateErr) {
          logger.error('Step 5-ERROR: Failed to update email status:', updateErr);
        }
      }

      logger.info(`Step 7: Meditation schedule created: ${schedule.id} for user: ${user.id}`);

      logger.info('Step 8: About to send response');
      res.status(201).json({
        success: true,
        data: {
          schedule,
          emailStatus,
          emailError
        }
      });
      logger.info('Step 9: Response sent successfully');
    } catch (error) {
      logger.error('Failed to create meditation schedule', {
        userId: user.id,
        error: error.message
      });
      throw error;
    }
  });

  /**
   * Get user's meditation schedules
   */
  getSchedules = catchAsync(async (req, res) => {
    const user = req.user;
    const { active_only } = req.query;

    try {
      logger.info('Getting meditation schedules', { 
        userId: user.id,
        activeOnly: active_only === 'true'
      });

      const schedules = await database.getUserMeditationSchedules(
        user.id, 
        active_only === 'true'
      );

      res.json({
        success: true,
        data: { 
          schedules,
          total: schedules.length
        }
      });
    } catch (error) {
      logger.error('Failed to get meditation schedules', {
        userId: user.id,
        error: error.message
      });
      throw error;
    }
  });

  /**
   * Update a meditation schedule
   */
  updateSchedule = catchAsync(async (req, res) => {
    const user = req.user;
    const { scheduleId } = req.params;
    const updates = req.body;

    try {
      logger.info('Updating meditation schedule', { 
        userId: user.id,
        scheduleId 
      });

      const schedule = await database.updateMeditationSchedule(
        scheduleId, 
        user.id, 
        updates
      );

      res.json({
        success: true,
        data: { schedule }
      });
    } catch (error) {
      logger.error('Failed to update meditation schedule', {
        userId: user.id,
        scheduleId,
        error: error.message
      });
      throw error;
    }
  });

  /**
   * Delete a meditation schedule
   */
  deleteSchedule = catchAsync(async (req, res) => {
    const user = req.user;
    const { scheduleId } = req.params;

    try {
      logger.info('Deleting meditation schedule', { 
        userId: user.id,
        scheduleId 
      });

      await database.deleteMeditationSchedule(scheduleId, user.id);

      res.json({
        success: true,
        message: 'Meditation schedule deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete meditation schedule', {
        userId: user.id,
        scheduleId,
        error: error.message
      });
      throw error;
    }
  });

  /**
   * Resend email notification for a meditation schedule
   */
  resendScheduleEmail = catchAsync(async (req, res) => {
    const { scheduleId } = req.params;
    const user = req.user;

    try {
      // Get the schedule
      const schedule = await database.getMeditationSchedule(scheduleId, user.id);
      if (!schedule) {
        return res.status(404).json({
          success: false,
          error: { message: 'Schedule not found' }
        });
      }

      // Reset email status to pending
      await database.updateScheduleEmailStatus(scheduleId, 'pending');

      // Queue email sending task
      let emailStatus = 'pending';
      let emailError = null;

      try {
        await messageQueue.publish('email', {
          type: 'meditation_schedule_created',
          userEmail: user.email,
          userName: user.name || user.username || 'User',
          schedule: schedule
        }, {
          priority: 5,
          correlationId: `schedule_resend_${schedule.id}`,
          headers: {
            userId: user.id,
            scheduleId: schedule.id,
            isResend: true
          }
        });
        emailStatus = 'queued';

        // Update email status in database
        await database.updateScheduleEmailStatus(schedule.id, 'queued');
        logger.info(`Email resend queued for schedule: ${schedule.id}`);
      } catch (emailErr) {
        emailStatus = 'failed';
        emailError = emailErr.message;

        // Update email status in database
        await database.updateScheduleEmailStatus(schedule.id, 'failed', emailErr.message);
        logger.error(`Failed to queue email resend for schedule ${schedule.id}:`, emailErr);
      }

      res.json({
        success: true,
        data: {
          emailStatus,
          emailError,
          message: emailStatus === 'queued'
            ? 'Email notification has been queued for resending'
            : 'Failed to queue email notification'
        }
      });
    } catch (error) {
      logger.error('Failed to resend schedule email', {
        scheduleId,
        userId: user.id,
        error: error.message
      });
      throw error;
    }
  });

  /**
   * Start a meditation session
   */
  startSession = catchAsync(async (req, res) => {
    const user = req.user;
    const sessionData = req.body;

    try {
      logger.info('Starting meditation session', { 
        userId: user.id,
        title: sessionData.title 
      });

      const session = await database.createMeditationSession(user.id, sessionData);

      res.status(201).json({
        success: true,
        data: { session }
      });
    } catch (error) {
      logger.error('Failed to start meditation session', {
        userId: user.id,
        error: error.message
      });
      throw error;
    }
  });

  /**
   * Complete a meditation session
   */
  completeSession = catchAsync(async (req, res) => {
    const user = req.user;
    const { sessionId } = req.params;
    const completionData = req.body;

    try {
      logger.info('Completing meditation session', { 
        userId: user.id,
        sessionId 
      });

      const session = await database.completeMeditationSession(
        sessionId, 
        user.id, 
        completionData
      );

      res.json({
        success: true,
        data: { session }
      });
    } catch (error) {
      logger.error('Failed to complete meditation session', {
        userId: user.id,
        sessionId,
        error: error.message
      });
      throw error;
    }
  });

  /**
   * Get user's meditation sessions
   */
  getSessions = catchAsync(async (req, res) => {
    const user = req.user;
    const { limit } = req.query;

    try {
      logger.info('Getting meditation sessions', { 
        userId: user.id,
        limit: limit || 50
      });

      const sessions = await database.getUserMeditationSessions(
        user.id, 
        parseInt(limit) || 50
      );

      res.json({
        success: true,
        data: { 
          sessions,
          total: sessions.length
        }
      });
    } catch (error) {
      logger.error('Failed to get meditation sessions', {
        userId: user.id,
        error: error.message
      });
      throw error;
    }
  });

  /**
   * Get meditation types
   */
  getTypes = catchAsync(async (req, res) => {
    try {
      logger.info('Getting meditation types');

      const types = await database.getMeditationTypes();

      res.json({
        success: true,
        data: { 
          types,
          total: types.length
        }
      });
    } catch (error) {
      logger.error('Failed to get meditation types', {
        error: error.message
      });
      throw error;
    }
  });

  /**
   * Get meditation sounds
   */
  getSounds = catchAsync(async (req, res) => {
    try {
      logger.info('Getting meditation sounds');

      const sounds = await database.getMeditationSounds();

      res.json({
        success: true,
        data: { 
          sounds,
          total: sounds.length
        }
      });
    } catch (error) {
      logger.error('Failed to get meditation sounds', {
        error: error.message
      });
      throw error;
    }
  });

  /**
   * Get meditation statistics for user
   */
  getStats = catchAsync(async (req, res) => {
    const user = req.user;

    try {
      logger.info('Getting meditation stats', {
        userId: user?.id,
        userExists: !!user,
        authHeader: req.headers.authorization ? 'present' : 'missing'
      });

      if (!user) {
        logger.error('No user found in request for stats endpoint');
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' }
        });
      }

      // Get recent sessions for stats calculation
      const sessions = await database.getUserMeditationSessions(user.id, 100);
      const schedules = await database.getUserMeditationSchedules(user.id, true);

      // Calculate stats
      const completedSessions = sessions.filter(s => s.is_completed);
      const totalMinutes = completedSessions.reduce((sum, s) => sum + s.duration_minutes, 0);
      const averageRating = completedSessions.length > 0 
        ? completedSessions.reduce((sum, s) => sum + (s.rating || 0), 0) / completedSessions.length
        : 0;

      // Calculate streak (consecutive days with meditation)
      const today = new Date();
      let streak = 0;
      for (let i = 0; i < 30; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const dateStr = checkDate.toISOString().split('T')[0];
        
        const hasSessionOnDate = completedSessions.some(s => 
          s.started_at.split('T')[0] === dateStr
        );
        
        if (hasSessionOnDate) {
          streak++;
        } else if (i > 0) {
          break; // Break streak if no session found (but not on first day)
        }
      }

      const stats = {
        totalSessions: completedSessions.length,
        totalMinutes,
        averageRating: Math.round(averageRating * 10) / 10,
        currentStreak: streak,
        activeSchedules: schedules.length,
        lastSessionAt: completedSessions.length > 0 ? completedSessions[0].started_at : null
      };

      res.json({
        success: true,
        data: { stats }
      });
    } catch (error) {
      logger.error('Failed to get meditation stats', {
        userId: user.id,
        error: error.message
      });
      throw error;
    }
  });


}

export default new MeditationController();
