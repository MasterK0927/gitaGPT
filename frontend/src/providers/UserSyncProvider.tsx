import React, { useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useUserSync } from '../hooks/useUserSync';

interface UserSyncProviderProps {
  children: React.ReactNode;
}

/**
 * Provider that automatically syncs authenticated users to the database
 * This ensures users are stored even if Clerk webhooks fail
 */
export const UserSyncProvider: React.FC<UserSyncProviderProps> = ({ children }) => {
  const { user, isLoaded } = useUser();
  const { isSyncing, isSynced, error } = useUserSync();

  // Track sync status for logging (no toasts to avoid render warnings)
  useEffect(() => {
    if (!isLoaded || !user) {
      return;
    }

    if (error) {
      console.error('❌ User sync error:', error);
      // Could add error reporting service here instead of toast
    } else if (isSynced) {
      // Could add analytics tracking here instead of toast
    }
  }, [error, isSynced, user, isLoaded]);

  // Show loading state while syncing (optional)
  if (isLoaded && user && isSyncing) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Setting up your account...</p>
          <p className="text-xs text-muted-foreground mt-2">Syncing user data...</p>
        </div>
      </div>
    );
  }

  // Show error state if sync failed (optional)
  if (isLoaded && user && error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold mb-2">Setup Issue</h2>
          <p className="text-muted-foreground mb-4">
            There was an issue setting up your account. The app will still work, but some features may be limited.
          </p>
          <p className="text-xs text-muted-foreground">
            Error: {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
