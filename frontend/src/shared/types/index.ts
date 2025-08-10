export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
  subscription?: {
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'inactive' | 'cancelled';
    expiresAt?: string;
  };
}

export interface ChatMessage {
  id: string;
  text: string;
  audio?: string;
  lipsync?: any;
  facialExpression?: string;
  animation?: string;
  isError?: boolean;
  isTyping?: boolean;
  timestamp: string;
  userId?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface BackendStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  timestamp: string;
  services?: {
    database: 'up' | 'down';
    ai: 'up' | 'down';
    audio: 'up' | 'down';
  };
}

export interface UserStats {
  totalMessages: number;
  totalSessions: number;
  averageSessionLength: number;
  favoriteExpressions: string[];
  usageByDay: Array<{
    date: string;
    messages: number;
  }>;
}

// Meditation Types
export interface MeditationSchedule {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  duration_minutes: number;
  frequency: 'daily' | 'weekly' | 'custom';
  days_of_week: number[]; // 1=Monday, 7=Sunday
  time_of_day: string; // HH:MM format
  timezone: string;
  is_active: boolean;
  reminder_enabled: boolean;
  reminder_minutes_before: number;
  meditation_type: string;
  background_sound?: string;
  email_status?: 'pending' | 'queued' | 'sent' | 'failed';
  email_error?: string;
  created_at: string;
  updated_at: string;
}

export interface MeditationSession {
  id: string;
  user_id: string;
  schedule_id?: string;
  title: string;
  duration_minutes: number;
  meditation_type: string;
  background_sound?: string;
  started_at: string;
  completed_at?: string;
  is_completed: boolean;
  notes?: string;
  mood_before?: 'calm' | 'anxious' | 'stressed' | 'peaceful' | 'restless' | 'focused';
  mood_after?: 'calm' | 'anxious' | 'stressed' | 'peaceful' | 'restless' | 'focused';
  rating?: number; // 1-5 stars
  created_at: string;
}

export interface MeditationType {
  id: string;
  name: string;
  description?: string;
  default_duration: number;
  created_at: string;
}

export interface MeditationSound {
  id: string;
  name: string;
  description?: string;
  file_url?: string;
  created_at: string;
}

export interface MeditationStats {
  totalSessions: number;
  totalMinutes: number;
  averageRating: number;
  currentStreak: number;
  activeSchedules: number;
  lastSessionAt?: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  audioEnabled: boolean;
  showLogs: boolean;
  autoSave: boolean;
  notifications: {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
  };
  avatar: {
    model: string;
    environment: string;
    lighting: 'auto' | 'bright' | 'dim';
  };
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}
