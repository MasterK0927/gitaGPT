import express from 'express';
import { body, param, query } from 'express-validator';
import { requireAuth, syncUser } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/security.js';
import MeditationController from '../controllers/MeditationController.js';

const router = express.Router();

// All meditation routes require authentication
router.use(requireAuth);
router.use(syncUser);

/**
 * @route POST /api/v1/meditation/schedules
 * @desc Create a new meditation schedule
 * @access Private
 */
router.post(
  '/schedules',
  [
    body('title')
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ max: 255 })
      .withMessage('Title must be less than 255 characters'),
    body('duration_minutes')
      .optional()
      .isInt({ min: 1, max: 180 })
      .withMessage('Duration must be between 1 and 180 minutes'),
    body('frequency')
      .optional()
      .isIn(['daily', 'weekly', 'custom'])
      .withMessage('Frequency must be daily, weekly, or custom'),
    body('time_of_day')
      .notEmpty()
      .withMessage('Time of day is required')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Time must be in HH:MM format'),
    body('days_of_week')
      .optional()
      .isArray()
      .withMessage('Days of week must be an array'),
    body('days_of_week.*')
      .optional()
      .isInt({ min: 1, max: 7 })
      .withMessage('Days must be between 1 (Monday) and 7 (Sunday)'),
    body('reminder_minutes_before')
      .optional()
      .isInt({ min: 0, max: 60 })
      .withMessage('Reminder must be between 0 and 60 minutes before')
  ],
  handleValidationErrors,
  MeditationController.createSchedule
);

/**
 * @route GET /api/v1/meditation/schedules
 * @desc Get user's meditation schedules
 * @access Private
 */
router.get(
  '/schedules',
  [
    query('active_only')
      .optional()
      .isBoolean()
      .withMessage('active_only must be a boolean')
  ],
  handleValidationErrors,
  MeditationController.getSchedules
);

/**
 * @route PUT /api/v1/meditation/schedules/:scheduleId
 * @desc Update a meditation schedule
 * @access Private
 */
router.put(
  '/schedules/:scheduleId',
  [
    param('scheduleId')
      .isUUID()
      .withMessage('Schedule ID must be a valid UUID'),
    body('title')
      .optional()
      .isLength({ max: 255 })
      .withMessage('Title must be less than 255 characters'),
    body('duration_minutes')
      .optional()
      .isInt({ min: 1, max: 180 })
      .withMessage('Duration must be between 1 and 180 minutes'),
    body('frequency')
      .optional()
      .isIn(['daily', 'weekly', 'custom'])
      .withMessage('Frequency must be daily, weekly, or custom'),
    body('time_of_day')
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Time must be in HH:MM format'),
    body('is_active')
      .optional()
      .isBoolean()
      .withMessage('is_active must be a boolean'),
    body('reminder_enabled')
      .optional()
      .isBoolean()
      .withMessage('reminder_enabled must be a boolean')
  ],
  handleValidationErrors,
  MeditationController.updateSchedule
);

/**
 * @route DELETE /api/v1/meditation/schedules/:scheduleId
 * @desc Delete a meditation schedule
 * @access Private
 */
router.delete(
  '/schedules/:scheduleId',
  [
    param('scheduleId')
      .isUUID()
      .withMessage('Schedule ID must be a valid UUID')
  ],
  handleValidationErrors,
  MeditationController.deleteSchedule
);

/**
 * @route POST /api/v1/meditation/schedules/:scheduleId/resend-email
 * @desc Resend email notification for a meditation schedule
 * @access Private
 */
router.post(
  '/schedules/:scheduleId/resend-email',
  [
    param('scheduleId')
      .isUUID()
      .withMessage('Schedule ID must be a valid UUID')
  ],
  handleValidationErrors,
  MeditationController.resendScheduleEmail
);

/**
 * @route POST /api/v1/meditation/sessions
 * @desc Start a new meditation session
 * @access Private
 */
router.post(
  '/sessions',
  [
    body('title')
      .notEmpty()
      .withMessage('Title is required'),
    body('duration_minutes')
      .isInt({ min: 1, max: 180 })
      .withMessage('Duration must be between 1 and 180 minutes'),
    body('meditation_type')
      .notEmpty()
      .withMessage('Meditation type is required'),
    body('schedule_id')
      .optional()
      .isUUID()
      .withMessage('Schedule ID must be a valid UUID'),
    body('mood_before')
      .optional()
      .isIn(['calm', 'anxious', 'stressed', 'peaceful', 'restless', 'focused'])
      .withMessage('Invalid mood value')
  ],
  handleValidationErrors,
  MeditationController.startSession
);

/**
 * @route PUT /api/v1/meditation/sessions/:sessionId/complete
 * @desc Complete a meditation session
 * @access Private
 */
router.put(
  '/sessions/:sessionId/complete',
  [
    param('sessionId')
      .isUUID()
      .withMessage('Session ID must be a valid UUID'),
    body('rating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    body('mood_after')
      .optional()
      .isIn(['calm', 'anxious', 'stressed', 'peaceful', 'restless', 'focused'])
      .withMessage('Invalid mood value'),
    body('notes')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Notes must be less than 1000 characters')
  ],
  handleValidationErrors,
  MeditationController.completeSession
);

/**
 * @route GET /api/v1/meditation/sessions
 * @desc Get user's meditation sessions
 * @access Private
 */
router.get(
  '/sessions',
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  handleValidationErrors,
  MeditationController.getSessions
);

/**
 * @route GET /api/v1/meditation/types
 * @desc Get available meditation types
 * @access Private
 */
router.get('/types', MeditationController.getTypes);

/**
 * @route GET /api/v1/meditation/sounds
 * @desc Get available meditation sounds
 * @access Private
 */
router.get('/sounds', MeditationController.getSounds);

/**
 * @route GET /api/v1/meditation/stats
 * @desc Get user's meditation statistics
 * @access Private
 */
router.get('/stats', MeditationController.getStats);

export default router;
