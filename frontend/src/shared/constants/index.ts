export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    REGISTER: '/api/v1/auth/register',
    LOGOUT: '/api/v1/auth/logout',
    REFRESH: '/api/v1/auth/refresh',
    PROFILE: '/api/v1/auth/profile',
    SYNC_USER: '/api/v1/auth/sync-user',
    CHECK_USERNAME: '/api/v1/auth/check-username',
  },
  CHAT: {
    SEND: '/api/v1/chat',
    CONVERSATIONS: '/api/v1/chat/conversations',
    MESSAGES: '/api/v1/chat/conversations',
    VOICES: '/api/v1/chat/voices',
  },
  USER: {
    PROFILE: '/api/v1/user/profile',
    STATS: '/api/v1/user/stats',
    PREFERENCES: '/api/v1/user/preferences',
  },
  GITA: {
    QUOTES: '/api/v1/gita/quotes',
    RANDOM_QUOTE: '/api/v1/gita/quotes/random',
    SEARCH_QUOTES: '/api/v1/gita/quotes/search',
    CATEGORIES: '/api/v1/gita/categories',
    TAGS: '/api/v1/gita/tags',
  },
  MEDITATION: {
    SESSIONS: '/api/v1/meditation/sessions',
    PROGRESS: '/api/v1/meditation/progress',
  },
  HEALTH: {
    BASIC: '/api/v1/health',
    DETAILED: '/api/v1/health/detailed',
    TTS: '/api/v1/health/tts',
    SYSTEM: '/api/health',
  },
  PING: '/ping',
} as const;

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  CHAT: '/chat',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  ANALYTICS: '/analytics',
  MEDITATION: '/meditation',
} as const;

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  SETTINGS: 'app_settings',
  CHAT_HISTORY: 'chat_history',
  THEME: 'theme',
} as const;

export const FACIAL_EXPRESSIONS = [
  'default',
  'happy',
  'sad',
  'thinking',
  'excited',
] as const;

export const AVATAR_ENVIRONMENTS = [
  'sunset',
  'dawn',
  'night',
  'forest',
  'studio',
] as const;

export const THEMES = ['light', 'dark', 'system'] as const;

export const SUBSCRIPTION_PLANS = {
  FREE: {
    name: 'Free',
    messagesPerDay: 50,
    features: ['Basic chat', 'Standard avatar', 'Limited history'],
  },
  PRO: {
    name: 'Pro',
    messagesPerDay: 500,
    features: ['Unlimited chat', 'Premium avatars', 'Full history', 'Analytics'],
  },
  ENTERPRISE: {
    name: 'Enterprise',
    messagesPerDay: -1, // unlimited
    features: ['Everything in Pro', 'Custom avatars', 'API access', 'Priority support'],
  },
} as const;

import { AppSettings } from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  audioEnabled: false,
  showLogs: false,
  autoSave: true,
  notifications: {
    enabled: true,
    sound: true,
    desktop: false,
  },
  avatar: {
    model: 'default',
    environment: 'sunset',
    lighting: 'auto',
  },
};
