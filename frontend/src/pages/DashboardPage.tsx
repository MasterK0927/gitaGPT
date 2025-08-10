import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  BarChart3,
  Clock,
  Sparkles,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '../shared/components/ui';
import { useAuthStore } from '../features/auth/stores/authStore';
import { ROUTES } from '../shared/constants';
import { EnhancedChatHistory } from '../features/chat/components/EnhancedChatHistory';
import { useRealTimeStats } from '../hooks/useRealTimeStats';
import { useGitaQuotes } from '../hooks/useGitaQuotes';
import { NewConversationModal } from '../features/chat/components/NewConversationModal';
import { useChatStore } from '../features/chat/stores/chatStore';
import { toast } from '../shared/components/ui/Toast';
import { useSafeClerk } from '../hooks/useSafeClerk';
import { ScheduleMeditationModal } from '../features/meditation/components/ScheduleMeditationModal';

const StatCard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  loading?: boolean;
}> = ({ title, value, icon, trend, trendUp, loading = false }) => (
  <Card className={loading ? 'animate-pulse' : ''}>
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {loading ? (
            <div className="h-8 bg-muted rounded w-16 animate-pulse mt-1"></div>
          ) : (
            <p className="text-2xl font-bold">{value}</p>
          )}
          {trend && !loading && (
            <p className={`text-xs ${trendUp ? 'text-green-600' : 'text-red-600'} flex items-center gap-1 mt-1`}>
              <TrendingUp className="w-3 h-3" />
              {trend}
            </p>
          )}
          {loading && (
            <div className="h-3 bg-muted rounded w-24 animate-pulse mt-2"></div>
          )}
        </div>
        <div className="text-muted-foreground">
          {loading ? (
            <div className="w-6 h-6 bg-muted rounded animate-pulse"></div>
          ) : (
            icon
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const { user: clerkUser, getToken, isClerkAvailable } = useSafeClerk(); // Get Clerk user safely
  const { createNewConversation, isLoading: chatLoading } = useChatStore();
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [showMeditationModal, setShowMeditationModal] = useState(false);

  const {
    totalConversations,
    totalMessages,
    averageMessagesPerConversation,
    lastActiveAt,
    timeSpentFormatted,
    insightsGained,
    loading: statsLoading,
    refreshStats
  } = useRealTimeStats(30000); // Refresh every 30 seconds

  const {
    quote: gitaQuote,
    loading: quoteLoading,
    refreshQuote
  } = useGitaQuotes(true, 300000); // Auto-refresh every 5 minutes

  const navigate = useNavigate();

  const handleCreateConversation = async (title: string) => {
    try {
      await createNewConversation(title, getToken);
      setShowNewConversationModal(false);

      // Navigate to chat page
      navigate('/chat');

      toast.success({
        title: 'New conversation created',
        description: `Started "${title}" conversation.`,
      });
    } catch (error) {
      toast.error({
        title: 'Failed to create conversation',
        description: 'Please try again.',
      });
    }
  };

  const stats = [
    {
      title: 'Total Conversations',
      value: statsLoading ? '...' : totalConversations.toString(),
      icon: <MessageSquare className="w-6 h-6" />,
      trend: lastActiveAt ? `Last active ${new Date(lastActiveAt).toLocaleDateString()}` : 'No activity yet',
      trendUp: totalConversations > 0,
    },
    {
      title: 'Messages Sent',
      value: statsLoading ? '...' : totalMessages.toString(),
      icon: <BarChart3 className="w-6 h-6" />,
      trend: `${averageMessagesPerConversation} avg per conversation`,
      trendUp: totalMessages > 0,
    },
    {
      title: 'Time Spent',
      value: statsLoading ? '...' : timeSpentFormatted,
      icon: <Clock className="w-6 h-6" />,
      trend: totalMessages > 0 ? 'Based on conversation activity' : 'Start chatting to track time',
      trendUp: totalMessages > 0,
    },
    {
      title: 'Insights Gained',
      value: statsLoading ? '...' : insightsGained.toString(),
      icon: <Sparkles className="w-6 h-6" />,
      trend: totalConversations > 0 ? 'From meaningful conversations' : 'Engage in conversations for insights',
      trendUp: insightsGained > 0,
    },
  ];

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Welcome Header - Responsive */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl md:text-3xl font-bold">
              Welcome back, {clerkUser?.username || clerkUser?.firstName || user?.name || 'User'}!
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Here's what's happening with your spiritual journey today.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshStats}
            disabled={statsLoading}
            className="flex items-center gap-1 md:gap-2 text-sm h-8 md:h-9 px-3 flex-shrink-0"
          >
            <TrendingUp className={`w-3 h-3 md:w-4 md:h-4 ${statsLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{statsLoading ? 'Updating...' : 'Refresh Stats'}</span>
            <span className="sm:hidden">Refresh</span>
          </Button>
        </div>
      </motion.div>

      {/* Stats Grid - Responsive */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6"
      >
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} loading={statsLoading} />
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link to={ROUTES.ANALYTICS}>
                <Button className="w-full justify-start" variant="outline">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  View Analytics
                </Button>
              </Link>
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => setShowMeditationModal(true)}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Meditation
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Enhanced Chat History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <EnhancedChatHistory
            limit={20}
            pageSize={2}
            showPagination={true}
          />
          <div className="mt-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-200 rounded-md dark:border-purple-800">
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowNewConversationModal(true)}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Start New Conversation
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Daily Wisdom */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Daily Wisdom
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshQuote}
              disabled={quoteLoading}
              className="h-8 w-8 p-0 text-purple-500 hover:text-purple-600"
            >
              <TrendingUp className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {quoteLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-2/3"></div>
              </div>
            ) : gitaQuote ? (
              <div className="space-y-4">
                <blockquote className="text-lg italic text-muted-foreground leading-relaxed">
                  "{gitaQuote.english}"
                </blockquote>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    — Bhagavad Gita {gitaQuote.verse}
                  </p>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                    {gitaQuote.category}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                  <strong>Meaning:</strong> {gitaQuote.meaning}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Unable to load wisdom quote at this time.
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* New Conversation Modal */}
      <NewConversationModal
        open={showNewConversationModal}
        onOpenChange={setShowNewConversationModal}
        onCreateConversation={handleCreateConversation}
        isLoading={chatLoading}
      />

      {/* Schedule Meditation Modal */}
      <ScheduleMeditationModal
        open={showMeditationModal}
        onOpenChange={setShowMeditationModal}
      />
    </div>
  );
};
