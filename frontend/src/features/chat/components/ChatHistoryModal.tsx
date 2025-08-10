import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  User,
  Bot,
  Clock,
  Trash2,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { Modal, Button } from '../../../shared/components/ui';
import { formatRelativeTime } from '../../../shared/utils';
import { useApiClient } from '../../../lib/apiClient';
import { toast } from '../../../shared/components/ui/Toast';
import { useChatStore } from '../stores/chatStore';
import { ROUTES } from '../../../shared/constants';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  facial_expression?: string;
  animation?: string;
}

interface Thread {
  userMessage: Message;
  aiResponses: Message[];
}

interface Conversation {
  id: string;
  title: string;
  preview_text: string;
  message_count: number;
  last_message_at: string;
  created_at: string;
  messages: Message[];
  threads?: Thread[]; // New hierarchical format from backend
}

interface ChatHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  onConversationDeleted?: (conversationId: string) => void;
}

export const ChatHistoryModal: React.FC<ChatHistoryModalProps> = ({
  open,
  onOpenChange,
  conversationId,
  onConversationDeleted
}) => {
  const navigate = useNavigate();
  const { getAuthenticatedClient } = useApiClient();
  const { clearConversationData } = useChatStore();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (open && conversationId) {
      fetchConversationDetails();
    }
  }, [open, conversationId]);

  const fetchConversationDetails = async () => {
    if (!conversationId) return;

    setLoading(true);
    try {
      const client = await getAuthenticatedClient();
      const response = await client.get(`/api/v1/chat/conversations/${conversationId}/details`);
      if (response.data.success) {
        const conversation = response.data.data.conversation;

        // Calculate real-time message count from threads
        let totalMessageCount = 0;
        if (conversation.threads && conversation.threads.length > 0) {
          conversation.threads.forEach((thread: any) => {
            totalMessageCount += 1; // User message
            totalMessageCount += thread.aiResponses?.length || 0; // AI responses
          });
        } else if (conversation.messages) {
          totalMessageCount = conversation.messages.length;
        }

        // Update conversation with real-time message count
        const updatedConversation = {
          ...conversation,
          message_count: totalMessageCount
        };

        setConversation(updatedConversation);
      } else {
        toast.error({ title: 'Failed to load conversation details' });
      }
    } catch (error) {
      console.error('Error fetching conversation details:', error);
      toast.error({ title: 'Failed to load conversation details' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!conversationId) return;

    setDeleting(true);
    try {
      const client = await getAuthenticatedClient();
      const response = await client.delete(`/api/v1/chat/conversations/${conversationId}`);
      if (response.data.success) {

        // Clear local state
        setConversation(null);

        // Clear chat store data for this conversation
        clearConversationData(conversationId);

        // Notify parent component to update conversation list
        onConversationDeleted?.(conversationId);

        // Close modal
        onOpenChange(false);

        // Clear any cached data in browser
        if ('caches' in window) {
          caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => {
              if (cacheName.includes('conversation') || cacheName.includes('chat')) {
                caches.delete(cacheName);
              }
            });
          });
        }

        toast.success({
          title: 'Conversation deleted successfully',
          description: 'All messages and data have been permanently removed'
        });
      } else {
        toast.error({ title: 'Failed to delete conversation' });
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error({
        title: 'Failed to delete conversation',
        description: 'Please try again or contact support if the issue persists'
      });
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleOpenInChat = async () => {
    if (!conversationId) return;

    try {
      // Close the modal first
      onOpenChange(false);

      // Navigate to chat page with the conversation ID
      navigate(`${ROUTES.CHAT}?conversation=${conversationId}`);

      // Use setTimeout to avoid setState during render
      setTimeout(() => {
        toast.success({
          title: 'Opening conversation',
          description: 'Loading conversation in chat interface...'
        });
      }, 0);
    } catch (error) {
      console.error('Error opening conversation:', error);
      // Use setTimeout to avoid setState during render
      setTimeout(() => {
        toast.error({
          title: 'Failed to open conversation',
          description: 'Please try again'
        });
      }, 0);
    }
  };

  const groupMessagesByThread = (messages: Message[]) => {
    const threads: { userMessage: Message; aiResponses: Message[] }[] = [];
    let currentThread: { userMessage: Message; aiResponses: Message[] } | null = null;

    messages.forEach((message) => {

      if (message.role === 'user') {
        // If we have a current thread, save it before starting a new one
        if (currentThread) {
          threads.push(currentThread);
        }
        // Start new thread with this user message
        currentThread = { userMessage: message, aiResponses: [] };
      } else if (message.role === 'assistant') {
        if (currentThread) {
          // Add AI response to current thread
          currentThread.aiResponses.push(message);
        } else {
          // Orphaned AI response - create a thread for it (shouldn't happen with new schema)
          currentThread = {
            userMessage: {
              id: 'orphaned',
              role: 'user',
              content: '[Previous message]',
              created_at: message.created_at
            } as Message,
            aiResponses: [message]
          };
        }
      }
    });

    // Don't forget the last thread
    if (currentThread) {
      threads.push(currentThread);
    }

    return threads;
  };

  if (!conversation && !loading) {
    return null;
  }

  // Use hierarchical threads from backend if available, otherwise group messages
  const threads = conversation
    ? (conversation.threads || groupMessagesByThread(conversation.messages || []))
    : [];

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={conversation?.title || 'Chat Details'}
        size="lg"
        className="max-h-[80vh] overflow-hidden flex flex-col"
      >
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Header Info */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-medium">{conversation?.title || 'Loading...'}</h3>
                <p className="text-sm text-muted-foreground">
                  {conversation && (
                    <>
                      {conversation.message_count} messages • Created {formatRelativeTime(conversation.created_at)}
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenInChat}
                className="text-primary hover:text-primary/80 hover:bg-primary/10"
                disabled={!conversationId}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Open in Chat
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                disabled={deleting}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : threads.length > 0 ? (
              <AnimatePresence>
                {threads.map((thread, threadIndex) => (
                  <motion.div
                    key={threadIndex}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: threadIndex * 0.1 }}
                    className="space-y-3"
                  >
                    {/* User Message */}
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">You</span>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(thread.userMessage.created_at)}
                          </span>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-sm leading-relaxed break-words">
                            {thread.userMessage.content}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* AI Responses */}
                    {thread.aiResponses.map((response, responseIndex) => (
                      <motion.div
                        key={response.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (threadIndex * 0.1) + (responseIndex * 0.05) }}
                        className="flex items-start gap-3 ml-4"
                      >
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">Krishna</span>
                            <span className="text-xs text-muted-foreground">
                              {formatRelativeTime(response.created_at)}
                            </span>
                          </div>
                          <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                            <p className="text-sm leading-relaxed break-words">
                              {response.content}
                            </p>
                            {(response.facial_expression || response.animation) && (
                              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {response.facial_expression && (
                                  <span>Expression: {response.facial_expression}</span>
                                )}
                                {response.animation && (
                                  <span>Animation: {response.animation}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                ))}
              </AnimatePresence>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No messages in this conversation</p>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Conversation"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">
                Are you sure you want to delete this conversation?
              </p>
              <p className="text-xs text-red-600 mt-1">
                This action cannot be undone. All messages in this conversation will be permanently deleted.
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConversation}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Conversation'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
