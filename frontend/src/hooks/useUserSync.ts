import { useEffect, useState, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { apiServices } from '../lib/apiClient';

// Use production API client for all environments
const api = apiServices;

interface UserSyncState {
  isSyncing: boolean;
  isSynced: boolean;
  error: string | null;
}

/**
 * Hook to automatically sync user from Clerk to database
 * This ensures users are stored in the database even if webhooks fail
 */
export const useUserSync = () => {
  const { user, isLoaded } = useUser();
  const [syncState, setSyncState] = useState<UserSyncState>({
    isSyncing: false,
    isSynced: false,
    error: null
  });

  // Track which user we've synced to prevent duplicate syncs
  const syncedUserId = useRef<string | null>(null);

  useEffect(() => {
    const syncUser = async () => {
      // Only sync if user is loaded and authenticated
      if (!isLoaded || !user) {
        return;
      }

      // Don't sync if already syncing, synced, or we've already synced this user
      if (syncState.isSyncing || syncState.isSynced || syncedUserId.current === user.id) {
        return;
      }

      syncedUserId.current = user.id;

      setSyncState(prev => ({ ...prev, isSyncing: true, error: null }));

      try {
        const response = await api.auth.syncUser(user.id);

        if (response.data.success) {
          setSyncState({
            isSyncing: false,
            isSynced: true,
            error: null
          });
        } else {
          throw new Error(response.data.error || 'Sync failed');
        }
      } catch (error: any) {
        console.error('❌ User sync failed:', error);
        setSyncState({
          isSyncing: false,
          isSynced: false,
          error: error.message || 'Failed to sync user'
        });
      }
    };

    syncUser();
  }, [user?.id, isLoaded]); // Only depend on user ID and isLoaded to prevent infinite loops

  // Retry function for manual retry
  const retrySync = async () => {
    if (!user) return;

    // Reset tracking and state
    syncedUserId.current = null;
    setSyncState({
      isSyncing: false,
      isSynced: false,
      error: null
    });
  };

  return {
    ...syncState,
    retrySync
  };
};
