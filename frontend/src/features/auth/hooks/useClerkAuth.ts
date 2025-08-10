import { useUser, useAuth, useClerk } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';

export interface ClerkUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
  lastSignInAt?: string;
}

export const useClerkAuth = () => {
  const { user, isLoaded: userLoaded, isSignedIn } = useUser();
  const { getToken, signOut: clerkSignOut } = useAuth();
  const { openSignIn, openSignUp } = useClerk();
  const [isLoading, setIsLoading] = useState(true);

  const {
    setUser,
    clearAuth,
    user: storeUser,
    isAuthenticated: storeIsAuthenticated
  } = useAuthStore();

  // Convert Clerk user to our user format
  const convertClerkUser = (clerkUser: any): any => {
    if (!clerkUser) return null;

    return {
      id: clerkUser.id,
      email: clerkUser.emailAddresses?.[0]?.emailAddress || '',
      name: clerkUser.fullName || `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
      avatarUrl: clerkUser.imageUrl,
      createdAt: clerkUser.createdAt ? new Date(clerkUser.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: clerkUser.updatedAt ? new Date(clerkUser.updatedAt).toISOString() : new Date().toISOString(),
      lastSignInAt: clerkUser.lastSignInAt ? new Date(clerkUser.lastSignInAt).toISOString() : undefined,
      subscription: {
        plan: 'free',
        status: 'active',
      },
    };
  };

  // Sync Clerk user with our store
  useEffect(() => {
    if (userLoaded) {
      setIsLoading(false);

      if (isSignedIn && user) {
        const convertedUser = convertClerkUser(user);
        if (convertedUser) {
          setUser(convertedUser);
        }
      } else {
        clearAuth();
      }
    }
  }, [userLoaded, isSignedIn, user, setUser, clearAuth]);

  // Get authentication token
  const getAuthToken = async (): Promise<string | null> => {
    try {
      if (!isSignedIn) return null;
      return await getToken();
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  };

  // Sign in function
  const signIn = async () => {
    try {
      openSignIn();
      return { success: true };
    } catch (error) {
      console.error('Sign in error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sign in failed'
      };
    }
  };

  // Sign up function
  const signUp = async () => {
    try {
      openSignUp();
      return { success: true };
    } catch (error) {
      console.error('Sign up error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sign up failed'
      };
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      await clerkSignOut();
      clearAuth();
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sign out failed'
      };
    }
  };

  // Update profile function
  const updateProfile = async (updates: Partial<ClerkUser>) => {
    try {
      if (!user) throw new Error('No user found');

      // Update Clerk user
      const updateData: any = {};
      if (updates.name) {
        const nameParts = updates.name.split(' ');
        updateData.firstName = nameParts[0] || '';
        updateData.lastName = nameParts.slice(1).join(' ') || '';
      }

      await user.update(updateData);

      // Update our store
      const updatedUser = convertClerkUser(user);
      if (updatedUser) {
        setUser({ ...updatedUser, ...updates });
      }

      return { success: true };
    } catch (error) {
      console.error('Profile update error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Profile update failed'
      };
    }
  };

  // Check if user has specific permissions
  const hasPermission = (_permission: string): boolean => {
    return isSignedIn || false;
  };

  // Get user subscription status
  const getSubscriptionStatus = () => {
    return {
      plan: 'free',
      status: 'active',
      expiresAt: null,
    };
  };

  return {
    // User data
    user: storeUser,
    isAuthenticated: storeIsAuthenticated,
    isLoading,

    // Authentication methods
    signIn,
    signUp,
    signOut,
    updateProfile,

    // Utility methods
    getAuthToken,
    hasPermission,
    getSubscriptionStatus,

    // Clerk-specific
    clerkUser: user,
    isClerkLoaded: userLoaded,
    openSignIn,
    openSignUp,
  };
};
