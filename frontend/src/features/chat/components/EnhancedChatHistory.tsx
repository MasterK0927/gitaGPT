import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Clock,
  User,
  MoreVertical,
  Trash2,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button, Card, CardContent } from '../../../shared/components/ui';
import { formatRelativeTime, cn } from '../../../shared/utils';
import { useApiClient } from '../../../lib/apiClient';
import { toast } from '../../../shared/components/ui/Toast';
import { ChatHistoryModal } from './ChatHistoryModal';
import { cacheService, CACHE_TTL, CACHE_PATTERNS } from '../../../services/cacheService';

interface ConversationSummary {
  id: string;
  title: string;
  preview_text: string;
  message_count?: number; // Legacy field
  total_message_count: number; // Real field from backend
  user_message_count: number;
  ai_response_count: number;
  last_message_at: string;
  created_at: string;
  username: string;
  user_name: string;
  first_user_message: string;
  actual_last_message_at: string;
}

interface EnhancedChatHistoryProps {
  className?: string;
  limit?: number;
  showHeader?: boolean;
  pageSize?: number;
  showPagination?: boolean;
}

export const EnhancedChatHistory: React.FC<EnhancedChatHistoryProps> = ({
  className,
  limit = 20,
  showHeader = true,
  pageSize = 4,
  showPagination = true
}) => {
  const { getAuthenticatedClient } = useApiClient();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    fetchConversations();
  }, [limit]);

  const fetchConversations = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const cacheKey = `chat:conversations:limit:${limit}`;

      const conversationsData = await cacheService.get(
        cacheKey,
        async () => {
          const client = await getAuthenticatedClient();
          const response = await client.get(`/api/v1/chat/conversations?limit=${limit}`);
          return response.data;
        },
        {
          ttl: CACHE_TTL.CHAT_HISTORY,
          forceRefresh
        }
      );

      if (conversationsData.success) {
        setConversations(conversationsData.data.conversations);
      } else {
        // Use setTimeout to avoid setState during render
        setTimeout(() => {
          toast.error({ title: 'Failed to load chat history' });
        }, 0);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      // Use setTimeout to avoid setState during render
      setTimeout(() => {
        toast.error({ title: 'Failed to load chat history' });
      }, 0);
    } finally {
      setLoading(false);
    }
  };

  const handleConversationClick = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setModalOpen(true);
  };

  const handleConversationDeleted = async (conversationId: string) => {

    // Remove from local state immediately for responsive UI
    setConversations(prev => prev.filter(conv => conv.id !== conversationId));

    // Invalidate related cache entries
    cacheService.invalidate([
      `chat:conversations:*`,
      `chat:conversation:${conversationId}:*`
    ]);

    // Refresh data from server to ensure consistency
    try {
      await fetchConversations(true); // Force refresh
    } catch (error) {
      console.error('⚠️ Failed to refresh conversations after deletion:', error);
      // Don't show error toast here as the deletion was successful
    }

    // Clear any browser storage related to this conversation
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes(conversationId) || key.includes('conversation'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Also clear sessionStorage
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.includes(conversationId) || key.includes('conversation'))) {
          sessionStorage.removeItem(key);
        }
      }

    } catch (storageError) {
      console.warn('Failed to clear browser storage:', storageError);
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(conversations.length / pageSize);
  const startIndex = currentPage * pageSize;
  const endIndex = startIndex + pageSize;
  const currentConversations = conversations.slice(startIndex, endIndex);

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const getPreviewText = (conversation: ConversationSummary) => {
    return conversation.first_user_message || conversation.preview_text || 'No preview available';
  };

  const getDisplayTitle = (conversation: ConversationSummary) => {
    if (conversation.title && conversation.title !== 'New Conversation') {
      return conversation.title;
    }
    const preview = getPreviewText(conversation);
    return preview.length > 50 ? `${preview.substring(0, 50)}...` : preview;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 md:gap-2">
            <MessageSquare className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            <h3 className="text-base md:text-lg font-semibold">Chat History</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchConversations(true)}
            disabled={loading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={cn('w-3 h-3 md:w-4 md:h-4', loading && 'animate-spin')} />
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                    <div className="h-3 bg-muted rounded w-1/4"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : conversations.length > 0 ? (
          <AnimatePresence>
            {currentConversations.map((conversation, index) => (
              <motion.div
                key={conversation.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className="hover:shadow-md transition-all duration-200 cursor-pointer hover:border-primary/20"
                  onClick={() => handleConversationClick(conversation.id)}
                >
                  <CardContent className="p-2 md:p-4">
                    <div className="space-y-2 md:space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-xs md:text-sm truncate">
                            {getDisplayTitle(conversation)}
                          </h4>
                          <div className="flex items-center gap-1 md:gap-2 mt-0.5 md:mt-1">
                            <User className="w-2.5 h-2.5 md:w-3 md:h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground truncate">
                              {conversation.username || conversation.user_name}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 md:gap-1 text-xs text-muted-foreground flex-shrink-0">
                          <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" />
                          <span className="text-xs">
                            {formatRelativeTime(conversation.actual_last_message_at || conversation.last_message_at)}
                          </span>
                        </div>
                      </div>

                      {/* Preview */}
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                          {getPreviewText(conversation)}
                        </p>

                        {/* Stats */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{conversation.total_message_count || conversation.message_count || 0} messages</span>
                            <span>Created {formatRelativeTime(conversation.created_at)}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConversationClick(conversation.id);
                            }}
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="font-medium mb-2">No conversations yet</h4>
              <p className="text-sm text-muted-foreground">
                Start a conversation with Krishna to see your chat history here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pagination Controls */}
      {showPagination && conversations.length > pageSize && (
        <div className="flex items-center justify-between mt-4 px-2">
          <div className="text-xs text-muted-foreground">
            Showing {startIndex + 1}-{Math.min(endIndex, conversations.length)} of {conversations.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPrevPage}
              disabled={currentPage === 0}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              {currentPage + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextPage}
              disabled={currentPage >= totalPages - 1}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Chat History Modal */}
      <ChatHistoryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        conversationId={selectedConversationId}
        onConversationDeleted={handleConversationDeleted}
      />
    </div>
  );
};
