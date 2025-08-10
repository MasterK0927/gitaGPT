import { useUser, useAuth, useClerk } from '@clerk/clerk-react';

// Safe wrapper for Clerk hooks that handles cases where Clerk is not available
export const useSafeClerk = () => {
  try {
    const { user, isLoaded, isSignedIn } = useUser();
    const { getToken } = useAuth();
    const { signOut } = useClerk();

    return {
      user,
      isLoaded,
      isSignedIn,
      getToken,
      signOut,
      isClerkAvailable: true,
    };
  } catch (error) {
    // If Clerk hooks fail (e.g., not within ClerkProvider), return mock values
    console.warn('Clerk hooks not available, using mock values:', error);

    return {
      user: null,
      isLoaded: true,
      isSignedIn: false,
      getToken: () => Promise.resolve(null),
      signOut: () => Promise.resolve(),
      isClerkAvailable: false,
    };
  }
};

export default useSafeClerk;
