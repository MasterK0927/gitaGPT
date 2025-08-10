/**
 * API Service for GitaGPT Frontend
 * Centralized API communication with the backend
 */

const API_BASE_URL = '/api/v1';

// Type definitions
interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error?: {
    message: string;
    code?: string;
  };
}

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

interface ChatMessage {
  message: string;
}

interface Voice {
  id: string;
  name: string;
  language: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  source?: string;
}

interface LogStats {
  total: number;
  byLevel: Record<string, number>;
  recent: LogEntry[];
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'offline';
  timestamp: string;
  services?: Record<string, boolean>;
}

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

interface UserStats {
  totalMessages: number;
  totalSessions: number;
  averageSessionLength: number;
  favoriteExpressions: string[];
  usageByDay: Array<{
    date: string;
    messages: number;
  }>;
}

/**
 * Generic API request handler
 */
async function apiRequest<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultOptions: RequestOptions = {
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': Date.now().toString(),
    },
  };

  const requestOptions: RequestOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message ||
        `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const responseData = await response.json();

    if (!responseData.success) {
      throw new Error(responseData.error?.message || 'Request failed');
    }

    // Handle both response formats:
    // 1. { success: true, data: {...} } - wrapped format
    // 2. { success: true, status: "healthy", ... } - direct format
    if (responseData.data !== undefined) {
      return responseData.data as T;
    } else {
      // For direct format, return the response without the success field
      const { success, ...actualData } = responseData;
      return actualData as T;
    }
  } catch (error) {
    console.error(`API request failed: ${endpoint}`, error);
    throw error;
  }
}

/**
 * Chat API
 */
export const chatAPI = {
  /**
   * Send a chat message with processing mode options
   */
  async sendMessage(message: string, options: {
    fast?: boolean;
    lightweight?: boolean;
    skipAudio?: boolean;
  } = {}): Promise<any> {
    const { fast = true, lightweight = false, skipAudio = false } = options;

    const url = new URL('/chat', window.location.origin);
    if (fast) url.searchParams.set('fast', 'true');
    if (lightweight) url.searchParams.set('lightweight', 'true');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': `chat_${Date.now()}`,
    };

    if (skipAudio) headers['X-Fast-Mode'] = 'true';

    return apiRequest(url.pathname + url.search, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message }),
    });
  },

  /**
   * Send a chat message with full audio processing
   */
  async sendMessageWithAudio(message: string): Promise<any> {
    return this.sendMessage(message, { fast: false, lightweight: false });
  },

  /**
   * Send a chat message in fast mode (text only)
   */
  async sendMessageFast(message: string): Promise<any> {
    return this.sendMessage(message, { fast: true, skipAudio: true });
  },

  /**
   * Get available voices (legacy compatibility)
   */
  async getVoices(): Promise<Voice[]> {
    return apiRequest<Voice[]>('/chat/voices');
  },
};

/**
 * Logs API
 */
export const logsAPI = {
  /**
   * Get recent logs
   */
  async getLogs(limit: number = 10): Promise<LogEntry[]> {
    return apiRequest<LogEntry[]>(`/logs?limit=${limit}`);
  },

  /**
   * Clear logs
   */
  async clearLogs(): Promise<void> {
    return apiRequest<void>('/logs', {
      method: 'DELETE',
    });
  },

  /**
   * Get log statistics
   */
  async getLogStats(): Promise<LogStats> {
    return apiRequest<LogStats>('/logs/stats');
  },
};

/**
 * Health API
 */
export const healthAPI = {
  /**
   * Basic health check
   */
  async getHealth(): Promise<HealthStatus> {
    return apiRequest<HealthStatus>('/health');
  },

  /**
   * Detailed health check
   */
  async getDetailedHealth(): Promise<HealthStatus> {
    return apiRequest<HealthStatus>('/health/detailed');
  },
};



/**
 * Utility function to check if backend is reachable
 */
export async function checkBackendConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Note: timeout is not a standard fetch option, consider using AbortController
    });

    return response.ok;
  } catch (error) {
    console.warn('Backend connection check failed:', error);
    return false;
  }
}

/**
 * Get API base URL for external use
 */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

/**
 * Error types for better error handling
 */
export const API_ERRORS = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
} as const;

export type ApiErrorType = typeof API_ERRORS[keyof typeof API_ERRORS];

interface ParsedApiError {
  type: ApiErrorType;
  message: string;
}





/**
 * Parse API error and return error type
 */
export function parseApiError(error: Error): ParsedApiError {
  if (!error.message) {
    return { type: API_ERRORS.NETWORK_ERROR, message: 'Network error occurred' };
  }

  const message = error.message.toLowerCase();

  if (message.includes('rate limit') || message.includes('too many requests')) {
    return { type: API_ERRORS.RATE_LIMIT_ERROR, message: error.message };
  }

  if (message.includes('validation') || message.includes('invalid input')) {
    return { type: API_ERRORS.VALIDATION_ERROR, message: error.message };
  }

  if (message.includes('401') || message.includes('unauthorized')) {
    return { type: API_ERRORS.AUTHENTICATION_ERROR, message: error.message };
  }

  if (message.includes('5') && message.includes('server')) {
    return { type: API_ERRORS.SERVER_ERROR, message: error.message };
  }

  return { type: API_ERRORS.NETWORK_ERROR, message: error.message };
}
