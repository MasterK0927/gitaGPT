import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useClerkAuth } from '../features/auth/hooks/useClerkAuth';
import { toast } from 'sonner';

interface SessionTimeoutConfig {
  timeoutMs: number; // Total session timeout in milliseconds
  warningMs: number; // Warning time before timeout in milliseconds
  onWarning?: () => void;
  onTimeout?: () => void;
  onExtend?: () => void;
}

interface SessionTimeoutState {
  isWarningShown: boolean;
  timeRemaining: number;
  isActive: boolean;
}

const DEFAULT_CONFIG: SessionTimeoutConfig = {
  timeoutMs: 30 * 60 * 1000, // 30 minutes
  warningMs: 5 * 60 * 1000,  // 5 minutes warning
};

export const useSessionTimeout = (config: Partial<SessionTimeoutConfig> = {}) => {
  const finalConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);
  const { signOut, isAuthenticated } = useClerkAuth();

  const [state, setState] = useState<SessionTimeoutState>({
    isWarningShown: false,
    timeRemaining: finalConfig.timeoutMs,
    isActive: false,
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Handle session timeout
  const handleTimeout = useCallback(async () => {
    clearTimers();
    setState(prev => ({ ...prev, isActive: false, isWarningShown: false }));
    
    try {
      await signOut();
      toast.error('Session expired. You have been logged out for security reasons.');
      finalConfig.onTimeout?.();
    } catch (error) {
      console.error('Error during session timeout logout:', error);
    }
  }, [signOut, finalConfig, clearTimers]);

  // Handle warning display
  const handleWarning = useCallback(() => {
    setState(prev => ({ ...prev, isWarningShown: true }));
    finalConfig.onWarning?.();

    // Start countdown timer
    const warningStartTime = Date.now();
    countdownRef.current = setInterval(() => {
      const elapsed = Date.now() - warningStartTime;
      const remaining = finalConfig.warningMs - elapsed;
      
      if (remaining <= 0) {
        handleTimeout();
      } else {
        setState(prev => ({ ...prev, timeRemaining: remaining }));
      }
    }, 1000);
  }, [finalConfig, handleTimeout]);

  // Extend session
  const extendSession = useCallback(() => {
    clearTimers();
    lastActivityRef.current = Date.now();
    setState(prev => ({
      ...prev,
      isWarningShown: false,
      timeRemaining: finalConfig.timeoutMs,
      isActive: true,
    }));

    // Set new warning timeout
    warningTimeoutRef.current = setTimeout(handleWarning, finalConfig.timeoutMs - finalConfig.warningMs);
    
    // Set new session timeout
    timeoutRef.current = setTimeout(handleTimeout, finalConfig.timeoutMs);
    
    finalConfig.onExtend?.();
    toast.success('Session extended successfully');
  }, [finalConfig, handleWarning, handleTimeout, clearTimers]);

  // Reset session timer on activity
  const resetTimer = useCallback(() => {
    if (!isAuthenticated) return;

    const now = Date.now();
    lastActivityRef.current = now;

    // Only reset if not in warning state
    if (!state.isWarningShown) {
      clearTimers();
      
      setState(prev => ({
        ...prev,
        timeRemaining: finalConfig.timeoutMs,
        isActive: true,
      }));

      // Set new warning timeout
      warningTimeoutRef.current = setTimeout(handleWarning, finalConfig.timeoutMs - finalConfig.warningMs);
      
      // Set new session timeout
      timeoutRef.current = setTimeout(handleTimeout, finalConfig.timeoutMs);
    }
  }, [isAuthenticated, state.isWarningShown, finalConfig, handleWarning, handleTimeout, clearTimers]);

  // Start session timer
  const startTimer = useCallback(() => {
    if (!isAuthenticated) return;

    clearTimers();
    lastActivityRef.current = Date.now();
    
    setState(prev => ({
      ...prev,
      isActive: true,
      isWarningShown: false,
      timeRemaining: finalConfig.timeoutMs,
    }));

    // Set warning timeout
    warningTimeoutRef.current = setTimeout(handleWarning, finalConfig.timeoutMs - finalConfig.warningMs);
    
    // Set session timeout
    timeoutRef.current = setTimeout(handleTimeout, finalConfig.timeoutMs);
  }, [isAuthenticated, finalConfig, handleWarning, handleTimeout, clearTimers]);

  // Stop session timer
  const stopTimer = useCallback(() => {
    clearTimers();
    setState(prev => ({
      ...prev,
      isActive: false,
      isWarningShown: false,
      timeRemaining: finalConfig.timeoutMs,
    }));
  }, [finalConfig.timeoutMs, clearTimers]);

  // Activity event listeners
  useEffect(() => {
    if (!isAuthenticated) {
      stopTimer();
      return;
    }

    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
      'focus',
      'keydown',
      'wheel',
    ];

    let activityThrottle: NodeJS.Timeout | null = null;

    const handleActivity = () => {
      // Throttle activity events to avoid excessive timer resets
      if (activityThrottle) return;

      activityThrottle = setTimeout(() => {
        activityThrottle = null;
      }, 1000); // Throttle for 1 second

      resetTimer();
    };

    // Add event listeners with passive option for better performance
    events.forEach(event => {
      document.addEventListener(event, handleActivity, {
        passive: true,
        capture: true
      });
    });

    // Listen for API responses that might indicate session expiration
    const handleApiResponse = (event: CustomEvent) => {
      const { status, code } = event.detail;
      if (status === 401 && code === 'SESSION_EXPIRED') {
        handleTimeout();
      }
    };

    window.addEventListener('api-response', handleApiResponse as EventListener);

    // Start the timer
    startTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      window.removeEventListener('api-response', handleApiResponse as EventListener);
      if (activityThrottle) {
        clearTimeout(activityThrottle);
      }
      stopTimer();
    };
  }, [isAuthenticated, resetTimer, startTimer, stopTimer, handleTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  // Format time remaining for display
  const formatTimeRemaining = useCallback((ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  return useMemo(() => ({
    ...state,
    extendSession,
    resetTimer,
    startTimer,
    stopTimer,
    formatTimeRemaining: (ms?: number) => formatTimeRemaining(ms || state.timeRemaining),
    timeRemainingFormatted: formatTimeRemaining(state.timeRemaining),
  }), [
    state,
    extendSession,
    resetTimer,
    startTimer,
    stopTimer,
    formatTimeRemaining
  ]);
};
