import { useState, useEffect } from 'react';
import { useApiClient } from '../lib/apiClient';

interface DashboardStats {
  totalConversations: number;
  totalMessages: number;
  averageMessagesPerConversation: number;
  lastActiveAt: string | null;
  timeSpentMinutes: number;
  timeSpentFormatted: string;
  insightsGained: number;
  loading: boolean;
  error: string | null;
}

export const useRealTimeStats = (refreshInterval: number = 30000) => {
  const { getAuthenticatedClient } = useApiClient();
  const [stats, setStats] = useState<DashboardStats>({
    totalConversations: 0,
    totalMessages: 0,
    averageMessagesPerConversation: 0,
    lastActiveAt: null,
    timeSpentMinutes: 0,
    timeSpentFormatted: '0m',
    insightsGained: 0,
    loading: true,
    error: null
  });

  const fetchStats = async () => {
    try {
      const client = await getAuthenticatedClient();
      const response = await client.get('/api/v1/user/stats');

      if (response.data.success) {
        const data = response.data.data;
        
        // Calculate real-time stats
        const totalConversations = data.totalConversations || 0;
        const totalMessages = data.totalMessages || 0;
        const averageMessagesPerConversation = totalConversations > 0 
          ? Math.round((totalMessages / totalConversations) * 10) / 10 
          : 0;

        setStats({
          totalConversations,
          totalMessages,
          averageMessagesPerConversation,
          lastActiveAt: data.lastActiveAt || null,
          timeSpentMinutes: data.timeSpentMinutes || 0,
          timeSpentFormatted: data.timeSpentFormatted || '0m',
          insightsGained: data.insightsGained || 0,
          loading: false,
          error: null
        });
      } else {
        setStats(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to fetch stats'
        }));
      }
    } catch (error) {
      console.error('Error fetching real-time stats:', error);
      setStats(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to fetch stats'
      }));
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchStats();

    // Set up interval for real-time updates
    const interval = setInterval(fetchStats, refreshInterval);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Manual refresh function
  const refreshStats = () => {
    setStats(prev => ({ ...prev, loading: true }));
    fetchStats();
  };

  return {
    ...stats,
    refreshStats
  };
};
