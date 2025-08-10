import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatMessage, ChatSession, BackendStatus } from '../../../shared/types';
import { healthAPI } from '../../../services/apiService';
import { apiClient } from '../../../lib/apiClient';
import { cacheService, CACHE_TTL, CACHE_PATTERNS } from '../../../services/cacheService';

interface ChatState {
  messages: ChatMessage[];
  currentMessage: ChatMessage | null;
  sessions: ChatSession[];
  currentSessionId: string | null;
  conversationId: string | null; // Add persistent conversation ID
  isLoading: boolean;
  error: string | null;
  backendStatus: BackendStatus['status'];
  audioEnabled: boolean;
  showLogs: boolean;
  hasLoadedInitialHistory: boolean;
  lastAuthenticatedUserId: string | null;
}

interface ChatActions {
  sendMessage: (text: string, getToken?: () => Promise<string | null>) => Promise<void>;
  clearMessages: () => void;
  setCurrentMessage: (message: ChatMessage | null) => void;
  onMessagePlayed: () => void;
  setAudioEnabled: (enabled: boolean) => void;
  setShowLogs: (show: boolean) => void;
  checkBackendHealth: () => Promise<void>;
  createNewSession: () => void;
  loadSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  setError: (error: string | null) => void;
  startNewConversation: () => void;
  createNewConversation: (title: string, getToken?: () => Promise<string | null>) => Promise<void>;
  loadConversation: (conversationId: string, forceRefresh?: boolean, getToken?: () => Promise<string | null>) => Promise<void>;
  clearConversationData: (conversationId?: string) => void;
  initializeForUser: (userId: string) => Promise<void>;
  loadInitialChatHistory: (getToken?: () => Promise<string | null>) => Promise<void>;
}

type ChatStore = ChatState & ChatActions;

const initialState: ChatState = {
  messages: [],
  currentMessage: null,
  sessions: [],
  currentSessionId: null,
  conversationId: null,
  isLoading: false,
  error: null,
  backendStatus: 'offline',
  audioEnabled: false,
  showLogs: false,
  hasLoadedInitialHistory: false,
  lastAuthenticatedUserId: null,
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      sendMessage: async (text: string, getToken?: () => Promise<string | null>) => {
        const startTime = Date.now();
        const requestId = `chat_${startTime}`;

        console.log(`🚀 [${requestId}] Starting chat message`, {
          messageLength: text.length,
          timestamp: new Date().toISOString()
        });

        // Immediately add user message to chat history
        const userMessage: ChatMessage = {
          id: `user-${startTime}`, // Consistent with loadConversation format
          text: text,
          timestamp: new Date().toISOString(),
          isError: false
        };

        // Add user message immediately
        const currentMessages = get().messages;
        set({
          messages: [...currentMessages, userMessage],
          isLoading: true,
          error: null
        });

        try {
          // Get authentication token if provided
          console.log(`🔐 [${requestId}] Getting authentication token...`);
          let token = null;
          if (getToken) {
            const tokenStart = Date.now();
            token = await getToken();
            console.log(`✅ [${requestId}] Token obtained in ${Date.now() - tokenStart}ms`);
          } else {
            console.log(`⚠️ [${requestId}] No token getter provided`);
          }

          // Make authenticated request to chat API
          console.log(`📡 [${requestId}] Sending request to /api/v1/chat...`);
          console.log(`🔗 [${requestId}] Request details:`, {
            url: '/api/v1/chat',
            method: 'POST',
            hasToken: !!token,
            message: text.substring(0, 50) + '...'
          });
          const requestStart = Date.now();

          // Set authentication token if available
          if (token) {
            apiClient.setAuthToken(token);
          }

          // Add typing indicator for AI response
          const typingMessage: ChatMessage = {
            id: `ai-typing-${startTime}`, // Consistent with AI message format
            text: 'GITA AI is thinking...',
            timestamp: new Date().toISOString(),
            isError: false,
            isTyping: true,
            facialExpression: 'thinking',
            animation: 'Idle'
          };

          // Add typing indicator
          const messagesWithTyping = [...get().messages, typingMessage];
          set({ messages: messagesWithTyping });

          // Get current conversation ID (let backend create if needed)
          const currentConversationId = get().conversationId;

          // Use main chat endpoint
          const response = await apiClient.post('/api/v1/chat', {
            message: text,
            conversationId: currentConversationId // Can be null for new conversations
          });

          const requestTime = Date.now() - requestStart;
          console.log(`📡 [${requestId}] Request completed in ${requestTime}ms`, {
            status: response.status,
            statusText: response.statusText
          });

          console.log(`📥 [${requestId}] Processing response...`);
          const parseStart = Date.now();
          const data = response.data; // Axios automatically parses JSON
          const parseTime = Date.now() - parseStart;

          console.log(`✅ [${requestId}] Response parsed in ${parseTime}ms`, {
            hasData: !!data,
            hasDataData: !!(data && data.data),
            hasMessages: !!(data && data.data && data.data.messages),
            messageCount: data?.data?.messages?.length || 0,
            responseStructure: Object.keys(data || {})
          });

          // Handle the correct response format: data.data.messages
          if (data && data.data && data.data.messages) {
            // Remove typing indicator and add actual AI responses
            const currentMessages = get().messages;
            const messagesWithoutTyping = currentMessages.filter(msg => !msg.isTyping);

            // Ensure AI messages have proper IDs for consistent grouping
            const aiMessagesWithProperIds = data.data.messages.map((msg: ChatMessage, index: number) => ({
              ...msg,
              id: msg.id && msg.id.startsWith('ai-') ? msg.id : `ai-${startTime}-${index}`
            }));

            const newMessages = [...messagesWithoutTyping, ...aiMessagesWithProperIds];
            const totalTime = Date.now() - startTime;

            // Store the conversation ID returned by the backend
            if (data.data.conversationId && data.data.conversationId !== get().conversationId) {
              console.log(`💾 [${requestId}] Updating conversation ID:`, {
                old: get().conversationId,
                new: data.data.conversationId
              });
              set({ conversationId: data.data.conversationId });
            }

            console.log(`🎉 [${requestId}] Chat completed successfully in ${totalTime}ms`, {
              newMessageCount: data.data.messages.length,
              totalMessages: newMessages.length,
              conversationId: data.data.conversationId,
              service: data.service || 'unknown',
              mode: data.mode || 'unknown'
            });

            set({
              messages: newMessages,
              backendStatus: 'healthy',
              isLoading: false
            });
          } else {
            console.error(`❌ [${requestId}] Invalid response format`, {
              data,
              expectedStructure: 'data.data.messages',
              actualStructure: data ? Object.keys(data) : 'null'
            });
            throw new Error('Invalid response format from server');
          }
        } catch (error) {
          const totalTime = Date.now() - startTime;
          console.error(`❌ [${requestId}] Chat request failed after ${totalTime}ms:`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : undefined,
            totalTime
          });

          const errorMessage = error instanceof Error ? error.message : 'Failed to send message';

          // Remove typing indicator and add fallback message
          const currentMessages = get().messages;
          const messagesWithoutTyping = currentMessages.filter(msg => !msg.isTyping);

          const fallbackMessage: ChatMessage = {
            id: `ai-error-${Date.now()}`, // Consistent AI message ID
            text: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
            audio: undefined,
            lipsync: undefined,
            facialExpression: "sad",
            animation: "Alert",
            isError: true,
            timestamp: new Date().toISOString(),
          };

          console.log(`🔄 [${requestId}] Adding fallback message`);

          set({
            messages: [...messagesWithoutTyping, fallbackMessage],
            backendStatus: 'unhealthy',
            error: errorMessage,
            isLoading: false
          });
        }
      },

      clearMessages: () => set({ messages: [], currentMessage: null, conversationId: null }),

      setCurrentMessage: (message) => set({ currentMessage: message }),

      onMessagePlayed: () => {
        const messages = get().messages;
        if (messages.length > 0) {
          set({ messages: messages.slice(1) });
        }
      },

      setAudioEnabled: (audioEnabled) => set({ audioEnabled }),

      setShowLogs: (showLogs) => set({ showLogs }),

      checkBackendHealth: async () => {
        try {
          const data = await healthAPI.getHealth();
          set({ backendStatus: data?.status || 'healthy' });
        } catch (error) {
          console.warn('Health check failed:', error);
          set({ backendStatus: 'offline' });
        }
      },

      createNewSession: () => {
        const newSession: ChatSession = {
          id: Date.now().toString(),
          title: 'New Chat',
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          userId: 'current-user', // Replace with actual user ID
        };
        
        set({ 
          sessions: [newSession, ...get().sessions],
          currentSessionId: newSession.id,
          messages: [],
          currentMessage: null 
        });
      },

      loadSession: (sessionId) => {
        const session = get().sessions.find(s => s.id === sessionId);
        if (session) {
          set({ 
            currentSessionId: sessionId,
            messages: session.messages,
            currentMessage: null 
          });
        }
      },

      deleteSession: (sessionId) => {
        const sessions = get().sessions.filter(s => s.id !== sessionId);
        set({ sessions });
        
        if (get().currentSessionId === sessionId) {
          if (sessions.length > 0) {
            get().loadSession(sessions[0].id);
          } else {
            get().createNewSession();
          }
        }
      },

      setError: (error) => set({ error }),

      startNewConversation: () => {
        set({
          conversationId: null,
          messages: [],
          currentMessage: null,
          error: null
        });
      },

      createNewConversation: async (title: string, getToken?: () => Promise<string | null>) => {
        try {
          set({ isLoading: true, error: null });

          console.log('🆕 Creating new conversation with title:', title);

          // Get authentication token if provided
          if (getToken) {
            const token = await getToken();
            if (token) {
              apiClient.setAuthToken(token);
              console.log('✅ Auth token set for conversation creation');
            } else {
              console.warn('⚠️ No auth token received for conversation creation');
            }
          } else {
            console.warn('⚠️ No token getter provided for conversation creation');
          }

          // Create conversation via authenticated API
          const response = await apiClient.post('/api/v1/chat/conversations', {
            title: title
          });

          if (response.data.success && response.data.data.conversation) {
            const newConversationId = response.data.data.conversation.id;

            console.log('✅ New conversation created:', {
              id: newConversationId,
              title: title
            });

            // Set the new conversation as current
            set({
              conversationId: newConversationId,
              messages: [],
              currentMessage: null,
              error: null,
              isLoading: false
            });

            return;
          } else {
            throw new Error('Failed to create conversation');
          }
        } catch (error) {
          console.error('❌ Failed to create conversation:', error);
          set({
            error: 'Failed to create new conversation. Please try again.',
            isLoading: false
          });
          throw error;
        }
      },

      loadConversation: async (conversationId: string, forceRefresh = false, getToken?: () => Promise<string | null>) => {
        try {
          set({ isLoading: true, error: null });

          console.log('🔍 Loading conversation:', conversationId);

          // Get authentication token if provided
          if (getToken) {
            const token = await getToken();
            if (token) {
              apiClient.setAuthToken(token);
              console.log('✅ Auth token set for conversation loading');
            } else {
              console.warn('⚠️ No auth token received for conversation loading');
            }
          } else {
            console.warn('⚠️ No token getter provided for conversation loading');
          }

          // Cache-first strategy for conversation loading
          const cacheKey = `chat:conversation:${conversationId}:details`;

          const conversationData = await cacheService.get(
            cacheKey,
            async () => {
              // Use the existing apiClient - it should already have the auth token set
              const response = await apiClient.get(`/api/v1/chat/conversations/${conversationId}/details`);
              return response.data;
            },
            {
              ttl: CACHE_TTL.CONVERSATIONS,
              forceRefresh
            }
          );

          console.log('📡 API Response:', {
            success: conversationData?.success,
            hasConversation: !!conversationData?.conversation,
            hasData: !!conversationData?.data,
            responseKeys: Object.keys(conversationData || {}),
            fullResponse: conversationData
          });

          // Check different possible response structures
          const conversation = conversationData?.data?.conversation || conversationData?.conversation;

          if (conversationData?.success && conversation) {

            // Convert conversation messages to chat store format
            const messages: ChatMessage[] = [];

            if (conversation.threads && conversation.threads.length > 0) {
              // Use hierarchical thread format
              conversation.threads.forEach((thread: any, threadIndex: number) => {
                // Add user message
                messages.push({
                  id: `user-${threadIndex}-${thread.userMessage.id}`,
                  text: thread.userMessage.content,
                  timestamp: thread.userMessage.created_at,
                  isError: false
                });

                // Add AI responses
                thread.aiResponses.forEach((response: any, responseIndex: number) => {
                  messages.push({
                    id: `ai-${threadIndex}-${responseIndex}-${response.id}`,
                    text: response.content,
                    timestamp: response.created_at,
                    isError: false,
                    audio: response.audio_url ? response.audio_url.replace('data:audio/mp3;base64,', '') : undefined,
                    facialExpression: response.facial_expression,
                    animation: response.animation
                  });
                });
              });
            } else if (conversation.messages && conversation.messages.length > 0) {
              // Use flat message format as fallback
              conversation.messages.forEach((msg: any, index: number) => {
                messages.push({
                  id: `msg-${index}-${msg.id}`,
                  text: msg.content,
                  timestamp: msg.created_at,
                  isError: false,
                  audio: msg.audio_url ? msg.audio_url.replace('data:audio/mp3;base64,', '') : undefined,
                  facialExpression: msg.facial_expression,
                  animation: msg.animation
                });
              });
            }

            set({
              conversationId,
              messages,
              currentMessage: null,
              isLoading: false,
              error: null
            });

            console.log('✅ Loaded conversation:', conversationId, 'with', messages.length, 'messages');
          } else {
            console.error('❌ Invalid response structure:', {
              success: conversationData?.success,
              hasConversation: !!conversation,
              responseData: conversationData
            });
            throw new Error('Failed to load conversation - invalid response structure');
          }
        } catch (error: any) {
          console.error('❌ Error loading conversation:', {
            conversationId,
            error: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            responseData: error.response?.data,
            fullError: error
          });
          set({
            isLoading: false,
            error: `Failed to load conversation: ${error.response?.data?.error || error.message}`
          });
        }
      },

      clearConversationData: (conversationId?: string) => {
        const state = get();

        // If specific conversation ID provided, only clear if it matches current conversation
        if (conversationId && state.conversationId !== conversationId) {
          return;
        }

        // Clear current conversation data
        set({
          conversationId: null,
          messages: [],
          currentMessage: null,
          error: null
        });

        console.log('🧹 Chat store cleared for conversation:', conversationId || 'all');
      },

      /**
       * Initialize chat store for a specific user
       */
      initializeForUser: async (userId: string) => {
        const { lastAuthenticatedUserId, hasLoadedInitialHistory } = get();

        // Check if this is a new user or first time initialization
        if (lastAuthenticatedUserId !== userId) {
          console.log('🔄 Initializing chat store for new user:', userId);

          // Clear previous user's data
          set({
            messages: [],
            sessions: [],
            currentSessionId: null,
            conversationId: null,
            hasLoadedInitialHistory: false,
            lastAuthenticatedUserId: userId,
            error: null
          });

          // Load initial chat history for the new user
          // Note: getToken is not available in this context, but the apiClient should already be authenticated
          await get().loadInitialChatHistory();
        } else if (!hasLoadedInitialHistory) {
          console.log('🔄 Loading initial chat history for existing user:', userId);
          // Note: getToken is not available in this context, but the apiClient should already be authenticated
          await get().loadInitialChatHistory();
        }
      },

      /**
       * Load initial chat history using cache-first strategy
       */
      loadInitialChatHistory: async (getToken?: () => Promise<string | null>) => {
        const { hasLoadedInitialHistory } = get();

        if (hasLoadedInitialHistory) {
          console.log('📚 Chat history already loaded, skipping...');
          return;
        }

        try {
          set({ isLoading: true, error: null });
          console.log('📚 Loading initial chat history...');

          // Get authentication token if provided
          if (getToken) {
            const token = await getToken();
            if (token) {
              apiClient.setAuthToken(token);
              console.log('✅ Auth token set for initial chat history loading');
            } else {
              console.warn('⚠️ No auth token received for initial chat history loading');
            }
          } else {
            console.warn('⚠️ No token getter provided for initial chat history loading');
          }

          // Use cache-first strategy for chat history
          const cacheKey = 'chat:conversations:initial:limit:10';

          const conversationsData = await cacheService.get(
            cacheKey,
            async () => {
              const response = await apiClient.get('/api/v1/chat/conversations?limit=10');
              return response.data;
            },
            {
              ttl: CACHE_TTL.CHAT_HISTORY,
              forceRefresh: false
            }
          );

          if (conversationsData?.success && conversationsData?.data?.conversations) {
            const conversations = conversationsData.data.conversations;
            console.log('✅ Initial chat history loaded:', conversations.length, 'conversations');

            // Store conversations as sessions for compatibility
            set({
              sessions: conversations,
              hasLoadedInitialHistory: true,
              isLoading: false
            });
          } else {
            console.log('📭 No chat history found');
            set({
              hasLoadedInitialHistory: true,
              isLoading: false
            });
          }
        } catch (error) {
          console.error('❌ Failed to load initial chat history:', error);
          set({
            error: 'Failed to load chat history',
            hasLoadedInitialHistory: true, // Mark as attempted to avoid infinite retries
            isLoading: false
          });
        }
      },
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
        audioEnabled: state.audioEnabled,
        showLogs: state.showLogs,
      }),
    }
  )
);
