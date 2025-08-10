import React, { createContext, useContext, useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { SessionTimeoutModal } from '../components/SessionTimeoutModal';
import { useClerkAuth } from '../features/auth/hooks/useClerkAuth';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../shared/constants';
import { storage, STORAGE_KEYS } from '../shared/utils';

interface SessionTimeoutContextType {
  isWarningShown: boolean;
  timeRemaining: number;
  isActive: boolean;
  extendSession: () => void;
  resetTimer: () => void;
  formatTimeRemaining: (ms?: number) => string;
}

const SessionTimeoutContext = createContext<SessionTimeoutContextType | null>(null);

interface SessionTimeoutProviderProps {
  children: React.ReactNode;
}

export const SessionTimeoutProvider: React.FC<SessionTimeoutProviderProps> = ({ children }) => {
  const { signOut, isAuthenticated } = useClerkAuth();
  const navigate = useNavigate();

  // Simple state without complex hooks
  const [isWarningShown, setIsWarningShown] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isActive, setIsActive] = useState(false);

  // Refs to avoid re-renders
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Get timeout configuration from environment or use defaults
  const TIMEOUT_MS = parseInt(import.meta.env.VITE_SESSION_TIMEOUT_MS || '1800000'); // 30 minutes
  const WARNING_MS = parseInt(import.meta.env.VITE_SESSION_WARNING_MS || '300000'); // 5 minutes

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
  const handleSessionTimeout = useCallback(async () => {
    try {
      clearTimers();
      setIsWarningShown(false);
      setIsActive(false);

      // Clear all stored data
      storage.remove(STORAGE_KEYS.AUTH_TOKEN);
      storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
      storage.remove(STORAGE_KEYS.USER_DATA);

      // Clear any cached data
      localStorage.clear();
      sessionStorage.clear();

      // Sign out from Clerk
      await signOut();

      // Navigate to login page
      navigate(ROUTES.LOGIN, {
        replace: true,
        state: {
          message: 'Your session has expired. Please log in again.',
          type: 'session_expired'
        }
      });
    } catch (error) {
      console.error('Error during session timeout:', error);
      navigate(ROUTES.LOGIN, { replace: true });
    }
  }, [signOut, navigate, clearTimers]);

  // Start warning countdown
  const startWarningCountdown = useCallback(() => {
    setIsWarningShown(true);
    setTimeRemaining(WARNING_MS);

    countdownRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1000;
        if (newTime <= 0) {
          handleSessionTimeout();
          return 0;
        }
        return newTime;
      });
    }, 1000);
  }, [WARNING_MS, handleSessionTimeout]);

  // Start session timer
  const startTimer = useCallback(() => {
    clearTimers();
    setIsActive(true);
    setIsWarningShown(false);
    lastActivityRef.current = Date.now();

    // Set warning timer
    warningTimeoutRef.current = setTimeout(() => {
      startWarningCountdown();
    }, TIMEOUT_MS - WARNING_MS);

    // Set timeout timer
    timeoutRef.current = setTimeout(() => {
      handleSessionTimeout();
    }, TIMEOUT_MS);
  }, [TIMEOUT_MS, WARNING_MS, clearTimers, startWarningCountdown, handleSessionTimeout]);

  // Reset timer on activity
  const resetTimer = useCallback(() => {
    if (isAuthenticated && !isWarningShown) {
      startTimer();
    }
  }, [isAuthenticated, isWarningShown, startTimer]);

  // Extend session
  const handleExtendSession = useCallback(() => {
    clearTimers();
    setIsWarningShown(false);
    startTimer();
  }, [clearTimers, startTimer]);

  // Handle logout now
  const handleLogoutNow = useCallback(async () => {
    try {
      clearTimers();
      await signOut();
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (error) {
      console.error('Error during manual logout:', error);
      navigate(ROUTES.LOGIN, { replace: true });
    }
  }, [signOut, navigate, clearTimers]);

  // Format time remaining
  const formatTimeRemaining = useCallback((ms?: number): string => {
    const time = ms || timeRemaining;
    const minutes = Math.floor(time / 60000);
    const seconds = Math.floor((time % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [timeRemaining]);

  // Activity event listeners
  useEffect(() => {
    if (!isAuthenticated) {
      clearTimers();
      setIsActive(false);
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
      if (activityThrottle) return;

      activityThrottle = setTimeout(() => {
        activityThrottle = null;
      }, 1000);

      resetTimer();
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, {
        passive: true,
        capture: true
      });
    });

    // Start the timer
    startTimer();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      if (activityThrottle) {
        clearTimeout(activityThrottle);
      }
      clearTimers();
    };
  }, [isAuthenticated, resetTimer, startTimer, clearTimers]);

  // Listen for session expiration events from API client
  useEffect(() => {
    const handleSessionExpired = (event: CustomEvent) => {
      console.log('Session expired event received:', event.detail);
      handleSessionTimeout();
    };

    window.addEventListener('session-expired', handleSessionExpired as EventListener);

    return () => {
      window.removeEventListener('session-expired', handleSessionExpired as EventListener);
    };
  }, [handleSessionTimeout]);

  // Provide context value
  const contextValue: SessionTimeoutContextType = useMemo(() => ({
    isWarningShown,
    timeRemaining,
    isActive,
    extendSession: handleExtendSession,
    resetTimer,
    formatTimeRemaining,
  }), [
    isWarningShown,
    timeRemaining,
    isActive,
    handleExtendSession,
    resetTimer,
    formatTimeRemaining
  ]);

  return (
    <SessionTimeoutContext.Provider value={contextValue}>
      {children}

      {/* Session Timeout Warning Modal */}
      {isAuthenticated && (
        <SessionTimeoutModal
          isOpen={isWarningShown}
          timeRemaining={timeRemaining}
          onExtendSession={handleExtendSession}
          onLogout={handleLogoutNow}
          formatTimeRemaining={formatTimeRemaining}
        />
      )}
    </SessionTimeoutContext.Provider>
  );
};

// Hook to use session timeout context
export const useSessionTimeoutContext = (): SessionTimeoutContextType => {
  const context = useContext(SessionTimeoutContext);
  if (!context) {
    throw new Error('useSessionTimeoutContext must be used within a SessionTimeoutProvider');
  }
  return context;
};
