import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  MeditationSchedule, 
  MeditationSession, 
  MeditationType, 
  MeditationSound, 
  MeditationStats 
} from '../../../shared/types';
import {
  meditationAPI,
  CreateScheduleData,
  UpdateScheduleData,
  CreateSessionData,
  CompleteSessionData,
  CreateScheduleResponse
} from '../../../services/meditationAPI';
import { toast } from '../../../shared/components/ui/Toast';
import { cacheService } from '../../../services/cacheService';

interface MeditationState {
  // Data
  schedules: MeditationSchedule[];
  sessions: MeditationSession[];
  types: MeditationType[];
  sounds: MeditationSound[];
  stats: MeditationStats | null;
  
  // Current session
  currentSession: MeditationSession | null;
  isSessionActive: boolean;
  sessionStartTime: Date | null;
  sessionElapsedTime: number; // in seconds
  
  // UI State
  isLoading: boolean;
  error: string | null;

  // Filters
  showActiveSchedulesOnly: boolean;

  // Cache state
  lastFetchTime: number | null;
  cacheEnabled: boolean;
}

interface MeditationActions {
  // Schedules
  fetchSchedules: (activeOnly?: boolean, forceRefresh?: boolean, getToken?: () => Promise<string | null>) => Promise<void>;
  createSchedule: (data: CreateScheduleData, getToken?: () => Promise<string | null>) => Promise<MeditationSchedule | null>;
  updateSchedule: (scheduleId: string, data: UpdateScheduleData, skipToast?: boolean, getToken?: () => Promise<string | null>) => Promise<MeditationSchedule | null>;
  deleteSchedule: (scheduleId: string, getToken?: () => Promise<string | null>) => Promise<boolean>;
  toggleScheduleActive: (scheduleId: string, getToken?: () => Promise<string | null>) => Promise<void>;
  resendScheduleEmail: (scheduleId: string, getToken?: () => Promise<string | null>) => Promise<void>;
  
  // Sessions
  fetchSessions: (limit?: number, forceRefresh?: boolean, getToken?: () => Promise<string | null>) => Promise<void>;
  startSession: (data: CreateSessionData) => Promise<MeditationSession | null>;
  completeSession: (sessionId: string, data: CompleteSessionData) => Promise<MeditationSession | null>;
  
  // Current session management
  startCurrentSession: (session: MeditationSession) => void;
  updateSessionTimer: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  endCurrentSession: () => void;
  
  // Data fetching
  fetchTypes: (forceRefresh?: boolean) => Promise<void>;
  fetchSounds: (forceRefresh?: boolean) => Promise<void>;
  fetchStats: (forceRefresh?: boolean, getToken?: () => Promise<string | null>) => Promise<void>;
  
  // UI actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setShowActiveSchedulesOnly: (show: boolean) => void;
  
  // Cache management
  enableCache: () => void;
  disableCache: () => void;
  clearCache: () => void;
  getCacheStats: () => any;
  warmCache: () => Promise<void>;

  // Utility
  refreshAll: () => Promise<void>;
}

type MeditationStore = MeditationState & MeditationActions;

const initialState: MeditationState = {
  schedules: [],
  sessions: [],
  types: [],
  sounds: [],
  stats: null,
  currentSession: null,
  isSessionActive: false,
  sessionStartTime: null,
  sessionElapsedTime: 0,
  isLoading: false,
  error: null,
  showActiveSchedulesOnly: true,
  lastFetchTime: null,
  cacheEnabled: true,
};

export const useMeditationStore = create<MeditationStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Schedules
      fetchSchedules: async (activeOnly = false, forceRefresh = false, getToken?: () => Promise<string | null>) => {
        const { cacheEnabled } = get();

        try {
          set({ isLoading: true, error: null });

          const schedules = await meditationAPI.getSchedules(
            activeOnly,
            forceRefresh || !cacheEnabled,
            getToken
          );

          set({
            schedules,
            isLoading: false,
            lastFetchTime: Date.now()
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch schedules';
          set({ error: errorMessage, isLoading: false });
          toast.error({ title: 'Error', description: errorMessage });
        }
      },

      createSchedule: async (data: CreateScheduleData, getToken?: () => Promise<string | null>) => {
        try {
          set({ isLoading: true, error: null });

          // Set auth token if provided
          if (getToken) {
            try {
              const token = await getToken();
              if (token) {
                // Import apiClient and set token
                const { apiClient } = await import('../../../lib/apiClient');
                apiClient.setAuthToken(token);
              } else {
              }
            } catch (authError) {
              console.error('Failed to set auth token:', authError);
              throw new Error('Authentication failed');
            }
          } else {
          }

          // Ensure days_of_week is properly formatted
          const scheduleData = {
            ...data,
            days_of_week: Array.isArray(data.days_of_week) ? data.days_of_week : []
          };


          const result = await meditationAPI.createSchedule(scheduleData);

          set(state => ({
            schedules: [...state.schedules, result.schedule],
            isLoading: false
          }));

          // Show schedule creation success
          toast.success({
            title: 'Schedule Created',
            description: `"${result.schedule.title}" has been scheduled successfully`
          });

          // Show email status toast
          if (result.emailStatus === 'queued') {
            toast.info({
              title: 'Email Notification Queued',
              description: 'Calendar invite and schedule details are being sent to your email'
            });
          } else if (result.emailStatus === 'failed') {
            toast.warning({
              title: 'Email Notification Failed',
              description: 'Schedule created but email notification could not be sent'
            });
          }

          // Refresh schedules after a short delay to show updated email status
          setTimeout(() => {
            get().fetchSchedules(false, true, getToken); // Force refresh
          }, 3000); // Wait 3 seconds for email to be processed

          return result.schedule;
        } catch (error: any) {
          console.error('Create schedule error:', error);
          console.error('Error response:', error.response?.data);
          console.error('Error status:', error.response?.status);

          let errorMessage = 'Failed to create schedule';
          let isValidationError = false;

          // Handle different error response formats
          if (error.response?.data?.error) {
            if (typeof error.response.data.error === 'string') {
              errorMessage = error.response.data.error;
            } else if (typeof error.response.data.error === 'object') {
              errorMessage = error.response.data.error.message || 'Validation error occurred';
            }
          } else if (error.response?.data?.message) {
            errorMessage = error.response.data.message;
          } else if (error.message) {
            errorMessage = error.message;
          }

          // Check if it's a validation error (400 status)
          if (error.response?.status === 400) {
            isValidationError = true;

            // Handle express-validator errors
            if (error.response?.data?.error?.details) {
              const validationErrors = error.response.data.error.details;
              errorMessage = `Validation failed: ${validationErrors.map((e: any) => e.message || e.toString()).join(', ')}`;
            }
          }

          // Ensure errorMessage is always a string
          if (typeof errorMessage !== 'string') {
            errorMessage = 'An error occurred while creating the schedule';
          }

          set({ error: errorMessage, isLoading: false });

          // Show different toast types based on error type
          if (isValidationError) {
            toast.warning({
              title: 'Validation Error',
              description: errorMessage,
              duration: 6000 // Longer duration for validation errors
            });
          } else {
            toast.error({ title: 'Error', description: errorMessage });
          }

          return null;
        }
      },

      updateSchedule: async (scheduleId: string, data: UpdateScheduleData, skipToast = false, getToken?: () => Promise<string | null>) => {
        try {
          set({ isLoading: true, error: null });
          const updatedSchedule = await meditationAPI.updateSchedule(scheduleId, data, getToken);

          set(state => ({
            schedules: state.schedules.map(s =>
              s.id === scheduleId ? updatedSchedule : s
            ),
            isLoading: false
          }));

          if (!skipToast) {
            toast.success({
              title: 'Schedule Updated',
              description: 'Your meditation schedule has been updated'
            });
          }

          return updatedSchedule;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update schedule';
          set({ error: errorMessage, isLoading: false });
          toast.error({ title: 'Error', description: errorMessage });
          return null;
        }
      },

      deleteSchedule: async (scheduleId: string, getToken?: () => Promise<string | null>) => {
        try {
          set({ isLoading: true, error: null });
          await meditationAPI.deleteSchedule(scheduleId, getToken);
          
          set(state => ({
            schedules: state.schedules.filter(s => s.id !== scheduleId),
            isLoading: false
          }));
          
          toast.success({ 
            title: 'Schedule Deleted', 
            description: 'Meditation schedule has been removed' 
          });
          
          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to delete schedule';
          set({ error: errorMessage, isLoading: false });
          toast.error({ title: 'Error', description: errorMessage });
          return false;
        }
      },

      toggleScheduleActive: async (scheduleId: string, getToken?: () => Promise<string | null>) => {
        const schedule = get().schedules.find(s => s.id === scheduleId);
        if (!schedule) {
          console.error('Schedule not found:', scheduleId);
          return;
        }

        const newActiveState = !schedule.is_active;
        const action = newActiveState ? 'resumed' : 'paused';


        try {
          const updatedSchedule = await get().updateSchedule(scheduleId, { is_active: newActiveState }, true, getToken);

          if (updatedSchedule) {

            // Show custom toast message
            toast.success({
              title: `Schedule ${action.charAt(0).toUpperCase() + action.slice(1)}`,
              description: `"${schedule.title}" has been ${action}${newActiveState ? '' : '. Enable "Show All" to see paused schedules.'}`
            });
          }
        } catch (error) {
          console.error('Error toggling schedule:', error);
          // Error handling is already done in updateSchedule
        }
      },

      resendScheduleEmail: async (scheduleId: string, getToken?: () => Promise<string | null>) => {
        const schedule = get().schedules.find(s => s.id === scheduleId);
        if (!schedule) return;

        try {
          set({ isLoading: true, error: null });

          const result = await meditationAPI.resendScheduleEmail(scheduleId, getToken);

          // Update the schedule's email status optimistically
          set(state => ({
            schedules: state.schedules.map(s =>
              s.id === scheduleId
                ? { ...s, email_status: result.emailStatus as any, email_error: undefined }
                : s
            ),
            isLoading: false
          }));

          if (result.emailStatus === 'queued') {
            toast.success({
              title: 'Email Queued',
              description: `Email notification for "${schedule.title}" has been queued for resending`
            });
          } else {
            toast.warning({
              title: 'Email Failed',
              description: result.message || 'Failed to queue email notification'
            });
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to resend email';
          set({ error: errorMessage, isLoading: false });
          toast.error({ title: 'Error', description: errorMessage });
        }
      },

      // Sessions
      fetchSessions: async (limit = 50, forceRefresh = false, getToken?: () => Promise<string | null>) => {
        const { cacheEnabled } = get();

        try {
          set({ isLoading: true, error: null });

          const sessions = await meditationAPI.getSessions(
            limit,
            forceRefresh || !cacheEnabled,
            getToken
          );

          set({
            sessions,
            isLoading: false,
            lastFetchTime: Date.now()
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch sessions';
          set({ error: errorMessage, isLoading: false });
          toast.error({ title: 'Error', description: errorMessage });
        }
      },

      startSession: async (data: CreateSessionData) => {
        try {
          set({ isLoading: true, error: null });
          const session = await meditationAPI.startSession(data);
          
          set(state => ({
            sessions: [session, ...state.sessions],
            currentSession: session,
            isSessionActive: true,
            sessionStartTime: new Date(),
            sessionElapsedTime: 0,
            isLoading: false
          }));
          
          return session;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to start session';
          set({ error: errorMessage, isLoading: false });
          toast.error({ title: 'Error', description: errorMessage });
          return null;
        }
      },

      completeSession: async (sessionId: string, data: CompleteSessionData) => {
        try {
          set({ isLoading: true, error: null });
          const completedSession = await meditationAPI.completeSession(sessionId, data);
          
          set(state => ({
            sessions: state.sessions.map(s => 
              s.id === sessionId ? completedSession : s
            ),
            currentSession: null,
            isSessionActive: false,
            sessionStartTime: null,
            sessionElapsedTime: 0,
            isLoading: false
          }));
          
          toast.success({ 
            title: 'Session Completed', 
            description: 'Great job on completing your meditation!' 
          });
          
          // Refresh stats after completing a session
          get().fetchStats();
          
          return completedSession;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to complete session';
          set({ error: errorMessage, isLoading: false });
          toast.error({ title: 'Error', description: errorMessage });
          return null;
        }
      },

      // Current session management
      startCurrentSession: (session: MeditationSession) => {
        set({
          currentSession: session,
          isSessionActive: true,
          sessionStartTime: new Date(),
          sessionElapsedTime: 0
        });
      },

      updateSessionTimer: () => {
        const { sessionStartTime, isSessionActive } = get();
        if (!sessionStartTime || !isSessionActive) return;

        const elapsed = Math.floor((Date.now() - sessionStartTime.getTime()) / 1000);
        set({ sessionElapsedTime: elapsed });
      },

      pauseSession: () => {
        set({ isSessionActive: false });
      },

      resumeSession: () => {
        set({ isSessionActive: true });
      },

      endCurrentSession: () => {
        set({
          currentSession: null,
          isSessionActive: false,
          sessionStartTime: null,
          sessionElapsedTime: 0
        });
      },

      // Data fetching
      fetchTypes: async (forceRefresh = false) => {
        const { cacheEnabled } = get();

        try {
          const types = await meditationAPI.getTypes(forceRefresh || !cacheEnabled);
          set({ types });
        } catch (error) {
          console.error('Failed to fetch meditation types:', error);
        }
      },

      fetchSounds: async (forceRefresh = false) => {
        const { cacheEnabled } = get();

        try {
          const sounds = await meditationAPI.getSounds(forceRefresh || !cacheEnabled);
          set({ sounds });
        } catch (error) {
          console.error('Failed to fetch meditation sounds:', error);
        }
      },

      fetchStats: async (forceRefresh = false, getToken?: () => Promise<string | null>) => {
        const { cacheEnabled } = get();

        try {
          set({ isLoading: true, error: null });
          const stats = await meditationAPI.getStats(forceRefresh || !cacheEnabled, getToken);
          set({ stats, isLoading: false });
        } catch (error: any) {
          console.error('Failed to fetch meditation stats:', error);
          console.error('Error details:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            headers: error.response?.headers
          });

          let errorMessage = 'Failed to fetch meditation stats';

          if (error.response?.status === 401) {
            errorMessage = 'Authentication required. Please sign in again.';
          } else if (error.response?.data?.error?.message) {
            errorMessage = error.response.data.error.message;
          } else if (error.message) {
            errorMessage = error.message;
          }

          set({ error: errorMessage, isLoading: false });

          // Show toast for authentication errors
          if (error.response?.status === 401) {
            toast.error({
              title: 'Authentication Error',
              description: 'Please sign in again to access meditation stats'
            });
          }
        }
      },

      // Cache management
      enableCache: () => set({ cacheEnabled: true }),
      disableCache: () => set({ cacheEnabled: false }),
      clearCache: () => {
        meditationAPI.clearCache();
        set({ lastFetchTime: null });
      },
      getCacheStats: () => meditationAPI.getCacheStats(),

      warmCache: async () => {
        const { fetchSchedules, fetchSessions, fetchTypes, fetchSounds, fetchStats } = get();

        try {
          set({ isLoading: true });

          // Warm cache with critical data
          await cacheService.warmCache([
            {
              key: 'meditation:types:all',
              fetchFunction: () => meditationAPI.getTypes(true),
              priority: 10, // Highest priority
            },
            {
              key: 'meditation:sounds:all',
              fetchFunction: () => meditationAPI.getSounds(true),
              priority: 9,
            },
            {
              key: 'meditation:schedules:active',
              fetchFunction: () => meditationAPI.getSchedules(true, true),
              priority: 8,
            },
            {
              key: 'meditation:stats',
              fetchFunction: () => meditationAPI.getStats(true),
              priority: 7,
            },
            {
              key: 'meditation:sessions:recent',
              fetchFunction: () => meditationAPI.getSessions(20, true),
              priority: 6,
            }
          ]);

          // Update store with warmed data
          await Promise.all([
            fetchTypes(),
            fetchSounds(),
            fetchSchedules(true),
            fetchStats(),
            fetchSessions(20)
          ]);

          set({ isLoading: false, lastFetchTime: Date.now() });

          toast.success({
            title: 'Cache Warmed',
            description: 'Meditation data has been preloaded for faster access'
          });
        } catch (error) {
          set({ isLoading: false });
          console.error('Failed to warm cache:', error);
        }
      },

      // UI actions
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setError: (error: string | null) => set({ error }),
      clearError: () => set({ error: null }),
      setShowActiveSchedulesOnly: (show: boolean) => set({ showActiveSchedulesOnly: show }),

      // Utility
      refreshAll: async (forceRefresh = false) => {
        const { fetchSchedules, fetchSessions, fetchTypes, fetchSounds, fetchStats, showActiveSchedulesOnly } = get();

        try {
          set({ isLoading: true, error: null });

          await Promise.all([
            fetchSchedules(showActiveSchedulesOnly, forceRefresh),
            fetchSessions(50, forceRefresh),
            fetchTypes(forceRefresh),
            fetchSounds(forceRefresh),
            fetchStats(forceRefresh)
          ]);

          set({ isLoading: false, lastFetchTime: Date.now() });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to refresh data';
          set({ error: errorMessage, isLoading: false });
          toast.error({ title: 'Error', description: errorMessage });
        }
      }
    }),
    {
      name: 'meditation-store',
      partialize: (state) => ({
        // Only persist non-sensitive data
        showActiveSchedulesOnly: state.showActiveSchedulesOnly,
        // Don't persist current session data for security
      }),
    }
  )
);
