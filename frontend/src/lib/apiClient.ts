import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { useAuth } from '@clerk/clerk-react';

// Extend the AxiosRequestConfig to include metadata
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    metadata?: {
      startTime: number;
    };
  }
}

// API endpoints configuration
const API_ENDPOINTS = import.meta.env.DEV
  ? [''] // Use relative URLs in development (Vite proxy handles routing)
  : [
      import.meta.env.VITE_API_BASE_URL || '', // Use empty string for nginx proxy in production
      import.meta.env.VITE_API_BASE_URL_BACKUP || '',
      import.meta.env.VITE_API_BASE_URL_FALLBACK || '',
    ].filter(url => url !== null && url !== undefined); // Keep empty strings for proxy

// Debug logging
console.log('API_ENDPOINTS:', API_ENDPOINTS);
console.log('Environment:', import.meta.env.DEV ? 'development' : 'production');
console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);

// Request retry configuration
interface RetryConfig {
  retries: number;
  retryDelay: number;
  retryCondition?: (error: any) => boolean;
  onRetry?: (retryCount: number, error: any) => void;
}

// Load balancer state
class LoadBalancer {
  private currentEndpointIndex = 0;
  private endpointHealth: Map<string, boolean> = new Map();
  private lastHealthCheck: Map<string, number> = new Map();
  private readonly healthCheckInterval = 30000; // 30 seconds

  constructor() {
    // Initialize all endpoints as healthy
    API_ENDPOINTS.forEach(endpoint => {
      this.endpointHealth.set(endpoint, true);
      this.lastHealthCheck.set(endpoint, 0);
    });
  }

  // Get next healthy endpoint using round-robin
  getNextEndpoint(): string {
    // In development mode with relative URLs, return empty string
    if (import.meta.env.DEV && API_ENDPOINTS[0] === '') {
      return '';
    }

    const healthyEndpoints = API_ENDPOINTS.filter(endpoint =>
      this.endpointHealth.get(endpoint) === true
    );

    if (healthyEndpoints.length === 0) {
      // If no healthy endpoints, try the first one anyway
      console.warn('No healthy endpoints available, using primary endpoint');
      return API_ENDPOINTS[0];
    }

    // Round-robin through healthy endpoints
    const endpoint = healthyEndpoints[this.currentEndpointIndex % healthyEndpoints.length];
    this.currentEndpointIndex++;

    return endpoint;
  }

  // Mark endpoint as unhealthy
  markUnhealthy(endpoint: string) {
    console.warn(`Marking endpoint as unhealthy: ${endpoint}`);
    this.endpointHealth.set(endpoint, false);
    this.lastHealthCheck.set(endpoint, Date.now());
  }

  // Mark endpoint as healthy
  markHealthy(endpoint: string) {
    console.log(`Marking endpoint as healthy: ${endpoint}`);
    this.endpointHealth.set(endpoint, true);
    this.lastHealthCheck.set(endpoint, Date.now());
  }

  // Check if we should retry health check for an endpoint
  shouldRetryHealthCheck(endpoint: string): boolean {
    const lastCheck = this.lastHealthCheck.get(endpoint) || 0;
    return Date.now() - lastCheck > this.healthCheckInterval;
  }

  // Get endpoint health status
  getEndpointHealth(): Record<string, boolean> {
    const health: Record<string, boolean> = {};
    API_ENDPOINTS.forEach(endpoint => {
      health[endpoint] = this.endpointHealth.get(endpoint) || false;
    });
    return health;
  }
}

// Global load balancer instance
const loadBalancer = new LoadBalancer();

// Enhanced API client class
class ApiClient {
  private axiosInstance: AxiosInstance;
  private defaultRetryConfig: RetryConfig = {
    retries: 3,
    retryDelay: 1000,
    retryCondition: (error) => {
      // Retry on network errors or 5xx server errors
      return !error.response || (error.response.status >= 500);
    },
    onRetry: (retryCount, error) => {
      console.log(`Retrying request (attempt ${retryCount}):`, error.message);
    },
  };

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 30000, // 30 seconds - increased for chat responses
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '2.0.0',
        'X-Client-Platform': 'web',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // Add request timestamp for performance monitoring
        config.metadata = { startTime: Date.now() };
        
        // Set base URL to next available endpoint
        config.baseURL = loadBalancer.getNextEndpoint();
        
        console.log(`Making request to: ${config.baseURL}${config.url}`);
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        // Mark endpoint as healthy on successful response
        if (response.config.baseURL) {
          loadBalancer.markHealthy(response.config.baseURL);
        }

        // Log performance metrics
        const duration = Date.now() - (response.config.metadata?.startTime || 0);
        if (duration > 2000) {
          console.warn(`Slow API response: ${response.config.url} took ${duration}ms`);
        }

        return response;
      },
      (error) => {
        // Mark endpoint as unhealthy on certain errors
        if (error.config?.baseURL && this.shouldMarkUnhealthy(error)) {
          loadBalancer.markUnhealthy(error.config.baseURL);
        }

        // Handle session expiration and authentication errors
        if (error.response?.status === 401) {
          const errorData = error.response.data;

          if (errorData?.code === 'SESSION_EXPIRED') {
            console.warn('Session expired - triggering logout');

            // Dispatch a custom event for session expiration
            window.dispatchEvent(new CustomEvent('session-expired', {
              detail: {
                message: errorData.message || 'Your session has expired. Please log in again.',
                automatic: true,
                timestamp: errorData.timestamp,
                sessionAge: errorData.sessionAge,
                maxSessionAge: errorData.maxSessionAge
              }
            }));
          } else if (errorData?.code === 'AUTH_REQUIRED') {
            console.warn('Authentication required - redirecting to login');

            // Dispatch auth required event
            window.dispatchEvent(new CustomEvent('auth-required', {
              detail: {
                message: errorData.message || 'Authentication required',
                timestamp: errorData.timestamp
              }
            }));
          } else {
            console.warn('Authentication failed - token may be expired');
          }
        }

        // Dispatch API response event for session monitoring
        window.dispatchEvent(new CustomEvent('api-response', {
          detail: {
            status: error.response?.status,
            code: error.response?.data?.code,
            url: error.config?.url,
            timestamp: new Date().toISOString()
          }
        }));

        return Promise.reject(error);
      }
    );
  }

  private shouldMarkUnhealthy(error: any): boolean {
    // Mark as unhealthy for network errors or 5xx errors
    return !error.response || 
           error.code === 'ECONNREFUSED' || 
           error.code === 'ENOTFOUND' ||
           (error.response.status >= 500);
  }

  // Enhanced request method with retry logic
  async request<T = any>(
    config: AxiosRequestConfig,
    retryConfig: Partial<RetryConfig> = {}
  ): Promise<AxiosResponse<T>> {
    const finalRetryConfig = { ...this.defaultRetryConfig, ...retryConfig };
    let lastError: any;

    for (let attempt = 0; attempt <= finalRetryConfig.retries; attempt++) {
      try {
        const response = await this.axiosInstance.request<T>(config);
        return response;
      } catch (error) {
        lastError = error;

        // Don't retry on last attempt
        if (attempt === finalRetryConfig.retries) {
          break;
        }

        // Check if we should retry
        if (!finalRetryConfig.retryCondition?.(error)) {
          break;
        }

        // Call retry callback
        finalRetryConfig.onRetry?.(attempt + 1, error);

        // Wait before retrying with exponential backoff
        const delay = finalRetryConfig.retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));

        // Update config to use next endpoint for retry
        config.baseURL = loadBalancer.getNextEndpoint();
      }
    }

    throw lastError;
  }

  // Convenience methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  // Health check method
  async healthCheck(): Promise<Record<string, boolean>> {
    const healthStatus: Record<string, boolean> = {};

    await Promise.allSettled(
      API_ENDPOINTS.map(async (endpoint) => {
        try {
          const response = await axios.get(`${endpoint}/api/health`, { timeout: 5000 });
          healthStatus[endpoint] = response.status === 200;
          loadBalancer.markHealthy(endpoint);
        } catch (error) {
          healthStatus[endpoint] = false;
          loadBalancer.markUnhealthy(endpoint);
        }
      })
    );

    return healthStatus;
  }

  // Get load balancer status
  getLoadBalancerStatus() {
    return {
      endpoints: API_ENDPOINTS,
      health: loadBalancer.getEndpointHealth(),
      currentIndex: loadBalancer['currentEndpointIndex'],
    };
  }

  // Set authentication token
  setAuthToken(token: string) {
    this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  // Remove authentication token
  removeAuthToken() {
    delete this.axiosInstance.defaults.headers.common['Authorization'];
  }
}

// Global API client instance
export const apiClient = new ApiClient();

// Hook for authenticated API client
export const useApiClient = () => {
  const { getToken } = useAuth();

  const getAuthenticatedClient = async () => {
    try {
      const token = await getToken();
      if (token) {
        apiClient.setAuthToken(token);
      }
    } catch (error) {
      console.error('Failed to get auth token:', error);
    }
    return apiClient;
  };

  return {
    apiClient,
    getAuthenticatedClient,
  };
};

// API service functions
export const apiServices = {
  // Chat services
  chat: {
    sendMessage: (message: string, conversationId?: string) => {
      console.log('Sending chat message:', { message: message.substring(0, 50) + '...', conversationId });
      return apiClient.post('/api/v1/chat', { message, conversationId });
    },

    getConversations: () => {
      return apiClient.get('/api/v1/chat/conversations');
    },

    getMessages: (conversationId: string) => {
      return apiClient.get(`/api/v1/chat/conversations/${conversationId}/messages`);
    },

    getConversationDetails: (conversationId: string) => {
      return apiClient.get(`/api/v1/chat/conversations/${conversationId}/details`);
    },

    createConversation: (title?: string) => {
      return apiClient.post('/api/v1/chat/conversations', { title });
    },

    deleteConversation: (conversationId: string) => {
      return apiClient.delete(`/api/v1/chat/conversations/${conversationId}`);
    },

    getVoices: () => {
      return apiClient.get('/api/v1/chat/voices');
    },
  },

  // Auth services
  auth: {
    checkUsername: (username: string) => {
      return apiClient.post('/api/v1/auth/check-username', { username });
    },

    getUsernameSuggestions: (params: { email?: string; name?: string; base?: string }) => {
      const searchParams = new URLSearchParams();
      if (params.email) searchParams.append('email', params.email);
      if (params.name) searchParams.append('name', params.name);
      if (params.base) searchParams.append('base', params.base);

      return apiClient.get(`/api/v1/auth/username-suggestions?${searchParams.toString()}`);
    },

    syncUser: (clerkUserId: string) => {
      return apiClient.post('/api/v1/auth/sync-user', { clerkUserId });
    },
  },

  // User services
  user: {
    getProfile: () => {
      return apiClient.get('/api/v1/user/profile');
    },

    updateProfile: (data: any) => {
      return apiClient.put('/api/v1/user/profile', data);
    },

    getStats: () => {
      return apiClient.get('/api/v1/user/stats');
    },

    getPreferences: () => {
      return apiClient.get('/api/v1/user/preferences');
    },

    updatePreferences: (data: any) => {
      return apiClient.put('/api/v1/user/preferences', data);
    },
  },

  // Gita services
  gita: {
    getQuotes: () => {
      return apiClient.get('/api/v1/gita/quotes');
    },

    getRandomQuote: () => {
      return apiClient.get('/api/v1/gita/quotes/random');
    },

    searchQuotes: (query: string) => {
      return apiClient.get(`/api/v1/gita/quotes/search?q=${encodeURIComponent(query)}`);
    },

    getCategories: () => {
      return apiClient.get('/api/v1/gita/categories');
    },

    getTags: () => {
      return apiClient.get('/api/v1/gita/tags');
    },
  },

  // Meditation services
  meditation: {
    getSessions: () => {
      return apiClient.get('/api/v1/meditation/sessions');
    },

    createSession: (data: any) => {
      return apiClient.post('/api/v1/meditation/sessions', data);
    },

    getProgress: () => {
      return apiClient.get('/api/v1/meditation/progress');
    },
  },

  // System services
  system: {
    getHealth: () => {
      return apiClient.get('/api/v1/health');
    },

    getDetailedHealth: () => {
      return apiClient.get('/api/v1/health/detailed');
    },

    getTTSHealth: () => {
      return apiClient.get('/api/v1/health/tts');
    },

    ping: () => {
      return apiClient.get('/ping');
    },
  },
};

export default apiClient;
