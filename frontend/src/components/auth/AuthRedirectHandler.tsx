import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';

/**
 * Component to handle authentication redirects
 * This ensures users are redirected to dashboard after successful authentication
 */
export const AuthRedirectHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSignedIn, isLoaded, user } = useUser();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn && user && !hasRedirected.current) {
        // Check if we're on a login/register page and redirect to dashboard
        if (location.pathname === '/login' || location.pathname === '/register') {
          console.log('User authenticated, redirecting from auth page to dashboard');
          hasRedirected.current = true;
          navigate('/dashboard', { replace: true });
          return;
        }

        // Check if we're on the root page and redirect to dashboard
        if (location.pathname === '/') {
          console.log('Authenticated user on root, redirecting to dashboard');
          hasRedirected.current = true;
          navigate('/dashboard', { replace: true });
          return;
        }
      }

      // Reset redirect flag when user signs out
      if (!isSignedIn) {
        hasRedirected.current = false;
      }
    }
  }, [isLoaded, isSignedIn, user, location.pathname, navigate]);

  return <>{children}</>;
};

export default AuthRedirectHandler;
