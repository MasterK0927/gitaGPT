import React from 'react';
import { useUser } from '@clerk/clerk-react';
import { Navigate, Link } from 'react-router-dom';
import { ROUTES } from '../shared/constants';
import { RobustAuthForm } from '../components/auth/RobustAuthForm';
import { AuthenticationLoadingScreen } from '../components/auth/AuthenticationLoadingScreen';

export const RegisterPage: React.FC = () => {
  const { isSignedIn, isLoaded } = useUser();

  // Redirect if already signed in
  if (isLoaded && isSignedIn) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  // Show loading while Clerk is loading
  if (!isLoaded) {
    return <AuthenticationLoadingScreen />;
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Create your account
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Join thousands of users on their spiritual journey with Krishna AI
        </p>
      </div>

      <RobustAuthForm type="register" />

      <div className="text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
          >
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
};
