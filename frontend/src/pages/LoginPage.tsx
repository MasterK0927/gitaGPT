import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { ROUTES } from '../shared/constants';
import { RobustAuthForm } from '../components/auth/RobustAuthForm';
import { AuthenticationLoadingScreen } from '../components/auth/AuthenticationLoadingScreen';
import { useSafeClerk } from '../hooks/useSafeClerk';

export const LoginPage: React.FC = () => {
  const { isSignedIn, isLoaded } = useSafeClerk();

  // Redirect if already signed in
  if (isLoaded && isSignedIn) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  // Show loading while Clerk is loading
  if (!isLoaded) {
    return <AuthenticationLoadingScreen />;
  }

  return (
    <div className="space-y-4 md:space-y-6 px-3 md:px-0">
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome back
        </h1>
        <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
          Sign in to continue your spiritual journey with Krishna AI
        </p>
      </div>

      <RobustAuthForm type="login" />

      <div className="text-center">
        <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
          >
            Create one here
          </Link>
        </p>
      </div>
    </div>
  );
};
