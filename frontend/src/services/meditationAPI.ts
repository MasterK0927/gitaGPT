import { apiClient, useApiClient } from '../lib/apiClient';
import { useAuth } from '@clerk/clerk-react';
import {
  MeditationSchedule,
  MeditationSession,
  MeditationType,
  MeditationSound,
  MeditationStats
} from '../shared/types';
import { cacheService, CACHE_TTL, CACHE_PATTERNS } from './cacheService';
import { useAuthStore } from '../features/auth/stores/authStore';

export interface CreateScheduleData {
  title: string;
  description?: string;
  duration_minutes?: number;
  frequency?: 'daily' | 'weekly' | 'custom';
  days_of_week?: number[];
  time_of_day: string;
  timezone?: string;
  is_active?: boolean;
  reminder_enabled?: boolean;
  reminder_minutes_before?: number;
  meditation_type?: string;
  background_sound?: string;
}

export interface UpdateScheduleData extends Partial<CreateScheduleData> {}

export interface CreateScheduleResponse {
  schedule: MeditationSchedule;
  emailStatus: 'pending' | 'queued' | 'failed';
  emailError?: string;
}

export interface CreateSessionData {
  title: string;
  duration_minutes: number;
  meditation_type: string;
  background_sound?: string;
  schedule_id?: string;
  mood_before?: 'calm' | 'anxious' | 'stressed' | 'peaceful' | 'restless' | 'focused';
}

export interface CompleteSessionData {
  rating?: number;
  mood_after?: 'calm' | 'anxious' | 'stressed' | 'peaceful' | 'restless' | 'focused';
  notes?: string;
  completed_at?: string;
}

/**
 * Helper function to get current user ID for cache keys
 */
const getCurrentUserId = (): string => {
  const authStore = useAuthStore.getState();
  return authStore.user?.id || 'anonymous';
};

/**
 * Meditation API Service with Cache-First Strategy
 * Handles all meditation-related API calls with intelligent caching
 */
export const meditationAPI = {
  // Schedules
  async createSchedule(data: CreateScheduleData, getToken?: () => Promise<string | null>): Promise<CreateScheduleResponse> {
    // Ensure authentication token is set
    if (getToken) {
      const token = await getToken();
      if (token) {
        apiClient.setAuthToken(token);
      }
    }

    const response = await apiClient.post('/api/v1/meditation/schedules', data);
    const { schedule, emailStatus, emailError } = response.data.data;

    // Invalidate related cache entries
    const userId = getCurrentUserId();
    cacheService.invalidate([
      CACHE_PATTERNS.MEDITATION_SCHEDULES(userId),
      CACHE_PATTERNS.MEDITATION_STATS(userId)
    ]);

    return {
      schedule,
      emailStatus: emailStatus || 'pending',
      emailError
    };
  },

  async getSchedules(activeOnly = false, forceRefresh = false, getToken?: () => Promise<string | null>): Promise<MeditationSchedule[]> {
    const userId = getCurrentUserId();
    const cacheKey = `${CACHE_PATTERNS.MEDITATION_SCHEDULES(userId)}:${activeOnly}`;

    return cacheService.get(
      cacheKey,
      async () => {
        // Ensure authentication token is set
        if (getToken) {
          const token = await getToken();
          if (token) {
            apiClient.setAuthToken(token);
          }
        }

        const response = await apiClient.get('/api/v1/meditation/schedules', {
          params: { active_only: activeOnly }
        });
        return response.data.data.schedules;
      },
      {
        ttl: CACHE_TTL.MEDITATION_SCHEDULES,
        forceRefresh
      }
    );
  },

  async updateSchedule(scheduleId: string, data: UpdateScheduleData, getToken?: () => Promise<string | null>): Promise<MeditationSchedule> {
    // Ensure authentication token is set
    if (getToken) {
      const token = await getToken();
      if (token) {
        apiClient.setAuthToken(token);
      }
    }

    const response = await apiClient.put(`/api/v1/meditation/schedules/${scheduleId}`, data);
    const schedule = response.data.data.schedule;

    // Invalidate related cache entries
    const userId = getCurrentUserId();
    cacheService.invalidate([
      CACHE_PATTERNS.MEDITATION_SCHEDULES(userId),
      CACHE_PATTERNS.MEDITATION_STATS(userId)
    ]);

    return schedule;
  },

  async deleteSchedule(scheduleId: string, getToken?: () => Promise<string | null>): Promise<void> {
    // Ensure authentication token is set
    if (getToken) {
      const token = await getToken();
      if (token) {
        apiClient.setAuthToken(token);
      }
    }

    await apiClient.delete(`/api/v1/meditation/schedules/${scheduleId}`);

    // Invalidate related cache entries
    const userId = getCurrentUserId();
    cacheService.invalidate([
      CACHE_PATTERNS.MEDITATION_SCHEDULES(userId),
      CACHE_PATTERNS.MEDITATION_STATS(userId)
    ]);
  },

  async resendScheduleEmail(scheduleId: string, getToken?: () => Promise<string | null>): Promise<{ emailStatus: string; message: string }> {
    // Ensure authentication token is set
    if (getToken) {
      const token = await getToken();
      if (token) {
        apiClient.setAuthToken(token);
      }
    }

    const response = await apiClient.post(`/api/v1/meditation/schedules/${scheduleId}/resend-email`);
    return response.data.data;
  },

  // Sessions
  async startSession(data: CreateSessionData): Promise<MeditationSession> {
    const response = await apiClient.post('/api/v1/meditation/sessions', {
      ...data,
      started_at: new Date().toISOString()
    });
    const session = response.data.data.session;

    // Invalidate sessions cache to include new session
    const userId = getCurrentUserId();
    cacheService.invalidate([
      CACHE_PATTERNS.MEDITATION_SESSIONS(userId)
    ]);

    return session;
  },

  async completeSession(sessionId: string, data: CompleteSessionData): Promise<MeditationSession> {
    const response = await apiClient.put(`/api/v1/meditation/sessions/${sessionId}/complete`, {
      ...data,
      completed_at: data.completed_at || new Date().toISOString()
    });
    const session = response.data.data.session;

    // Invalidate related cache entries
    const userId = getCurrentUserId();
    cacheService.invalidate([
      CACHE_PATTERNS.MEDITATION_SESSIONS(userId),
      CACHE_PATTERNS.MEDITATION_STATS(userId)
    ]);

    return session;
  },

  async getSessions(limit = 50, forceRefresh = false, getToken?: () => Promise<string | null>): Promise<MeditationSession[]> {
    const userId = getCurrentUserId();
    const cacheKey = `meditation:sessions:${userId}:limit:${limit}`;

    return cacheService.get(
      cacheKey,
      async () => {
        // Ensure authentication token is set
        if (getToken) {
          const token = await getToken();
          if (token) {
            apiClient.setAuthToken(token);
          }
        }

        const response = await apiClient.get('/api/v1/meditation/sessions', {
          params: { limit }
        });
        return response.data.data.sessions;
      },
      {
        ttl: CACHE_TTL.MEDITATION_SESSIONS,
        forceRefresh
      }
    );
  },

  // Types and Sounds (rarely change, long cache TTL)
  async getTypes(forceRefresh = false): Promise<MeditationType[]> {
    const cacheKey = 'meditation:types:all';

    return cacheService.get(
      cacheKey,
      async () => {
        const response = await apiClient.get('/api/v1/meditation/types');
        return response.data.data.types;
      },
      {
        ttl: CACHE_TTL.MEDITATION_TYPES,
        forceRefresh
      }
    );
  },

  async getSounds(forceRefresh = false): Promise<MeditationSound[]> {
    const cacheKey = 'meditation:sounds:all';

    return cacheService.get(
      cacheKey,
      async () => {
        const response = await apiClient.get('/api/v1/meditation/sounds');
        return response.data.data.sounds;
      },
      {
        ttl: CACHE_TTL.MEDITATION_SOUNDS,
        forceRefresh
      }
    );
  },

  // Stats
  async getStats(forceRefresh = false, getToken?: () => Promise<string | null>): Promise<MeditationStats> {
    const userId = getCurrentUserId();
    const cacheKey = CACHE_PATTERNS.MEDITATION_STATS(userId);

    return cacheService.get(
      cacheKey,
      async () => {
        // Ensure authentication token is set
        if (getToken) {
          const token = await getToken();
          if (token) {
            apiClient.setAuthToken(token);
          }
        }

        const response = await apiClient.get('/api/v1/meditation/stats');
        return response.data.data.stats;
      },
      {
        ttl: CACHE_TTL.MEDITATION_STATS,
        forceRefresh
      }
    );
  },

  // Cache management methods
  async refreshAllData(): Promise<void> {
    const userId = getCurrentUserId();

    // Force refresh all meditation data
    await Promise.all([
      this.getSchedules(false, true),
      this.getSchedules(true, true),
      this.getSessions(50, true),
      this.getStats(true),
      this.getTypes(true),
      this.getSounds(true)
    ]);
  },

  clearCache(): void {
    const userId = getCurrentUserId();
    cacheService.invalidate([
      CACHE_PATTERNS.MEDITATION_USER(userId),
      'meditation:types:*',
      'meditation:sounds:*'
    ]);
  },

  getCacheStats() {
    return cacheService.getStats();
  }
};

/**
 * Utility functions for meditation
 */
export const meditationUtils = {
  /**
   * Format duration in minutes to human readable string
   */
  formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${remainingMinutes}m`;
  },

  /**
   * Format time string (HH:MM) to 12-hour format
   */
  formatTime(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  },

  /**
   * Get day names from day numbers
   */
  getDayNames(dayNumbers: number[]): string[] {
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return dayNumbers.map(day => dayNames[day - 1]);
  },

  /**
   * Get next scheduled time for a meditation schedule
   */
  getNextScheduledTime(schedule: MeditationSchedule): Date | null {
    if (!schedule.is_active) return null;

    const now = new Date();
    const [hours, minutes] = schedule.time_of_day.split(':').map(Number);

    // Find the next occurrence
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(now.getDate() + i);
      checkDate.setHours(hours, minutes, 0, 0);

      // If it's today, check if the time hasn't passed yet
      if (i === 0 && checkDate <= now) {
        continue;
      }

      // Check if this day is in the schedule
      const dayOfWeek = checkDate.getDay() === 0 ? 7 : checkDate.getDay(); // Convert Sunday from 0 to 7
      if (schedule.days_of_week.includes(dayOfWeek)) {
        return checkDate;
      }
    }

    return null;
  },

  /**
   * Check if a schedule should trigger today
   */
  shouldTriggerToday(schedule: MeditationSchedule): boolean {
    if (!schedule.is_active) return false;

    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
    
    return schedule.days_of_week.includes(dayOfWeek);
  },

  /**
   * Get mood emoji
   */
  getMoodEmoji(mood: string): string {
    const moodEmojis: Record<string, string> = {
      calm: '😌',
      anxious: '😰',
      stressed: '😤',
      peaceful: '☮️',
      restless: '😣',
      focused: '🎯'
    };
    return moodEmojis[mood] || '😐';
  },

  /**
   * Get rating stars
   */
  getRatingStars(rating: number): string {
    return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  }
};
