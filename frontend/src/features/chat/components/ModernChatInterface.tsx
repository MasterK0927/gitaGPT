import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  MessageSquare,
  Clock,
  User,
  Plus,
  Bot,
  RefreshCw
} from 'lucide-react';
import { Button, Input, Card, CardContent } from '../../../shared/components/ui';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../../auth/stores/authStore';
import { toast } from '../../../shared/components/ui/Toast';
import { useAuth } from '@clerk/clerk-react';
import { ChatMessage } from '../../../shared/types';
import { cn, formatRelativeTime } from '../../../shared/utils';
import { NewConversationModal } from './NewConversationModal';
import { useVoiceInput } from '../../../hooks/useVoiceInput';
import { cacheWarmingService } from '../../../services/cacheWarmingService';
import { getResponsivePlaceholder } from '../../../shared/utils/responsive';

interface ChatInterfaceProps {
  className?: string;
}

export const ModernChatInterface: React.FC<ChatInterfaceProps> = ({ className }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);
  const lastUserId = useRef<string | null>(null);
  const { user } = useAuthStore();
  const { getToken } = useAuth();
  const {
    sendMessage,
    isLoading,
    error,
    backendStatus,
    audioEnabled,
    setAudioEnabled,
    currentMessage,
    messages,
    checkBackendHealth,
    createNewConversation,
    loadConversation,
    initializeForUser
  } = useChatStore();

  const [searchParams, setSearchParams] = useSearchParams();
  const [inputValue, setInputValue] = useState('');
  const [showHistory, setShowHistory] = useState(true);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);

  // Voice input functionality
  const {
    isListening,
    transcript,
    interimTranscript,
    error: voiceError,
    isSupported: isVoiceSupported,
    startListening,
    stopListening,
    resetTranscript
  } = useVoiceInput({
    language: 'en-US',
    continuous: false,
    interimResults: true
  });

  // Initialize chat data when user is authenticated
  useEffect(() => {
    const initializeChatData = async () => {
      // Only initialize if user is authenticated
      if (!user?.id) {
        return;
      }

      // Check if this is a new user or we haven't initialized yet
      if (hasInitialized.current && lastUserId.current === user.id) {
        return;
      }

      try {

        // Initialize chat store with user-specific data
        await initializeForUser(user.id);

        // Warm cache for better performance (run in background)
        cacheWarmingService.warmCache(user.id).catch(error => {
          console.warn('Cache warming failed:', error);
        });

        hasInitialized.current = true;
        lastUserId.current = user.id;
      } catch (error) {
        console.error('❌ Chat initialization failed:', error);
      }
    };

    // Reset initialization flag when user changes
    if (user?.id !== lastUserId.current) {
      hasInitialized.current = false;
    }

    initializeChatData();
  }, [user?.id, initializeForUser]);

  // Check backend health on component mount and set up periodic checks
  useEffect(() => {
    // Initial health check
    checkBackendHealth();

    // Set up periodic health checks every 30 seconds
    const healthCheckInterval = setInterval(() => {
      checkBackendHealth();
    }, 30000);

    // Cleanup interval on unmount
    return () => clearInterval(healthCheckInterval);
  }, [checkBackendHealth]);

  // Handle loading conversation from URL parameters
  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (conversationId && user?.id) {

      // Load the conversation (the chat store will handle authentication)
      const loadFromUrl = async () => {
        try {
          await loadConversation(conversationId, false, getToken);

          // Remove the conversation parameter from URL after loading
          setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.delete('conversation');
            return newParams;
          });
        } catch (error) {
          console.error('Failed to load conversation from URL:', error);
        }
      };

      loadFromUrl();
    }
  }, [searchParams, loadConversation, setSearchParams, user?.id]);

  // Handle voice input transcript
  useEffect(() => {
    if (transcript) {
      setInputValue(prev => prev + transcript);
      resetTranscript();
    }
  }, [transcript, resetTranscript]);

  // Handle voice input errors
  useEffect(() => {
    if (voiceError) {
      toast.error({
        title: 'Voice Input Error',
        description: voiceError,
      });
    }
  }, [voiceError]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (historyRef.current && messages.length > 0) {
      const scrollContainer = historyRef.current;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages.length, currentMessage]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const message = inputValue.trim();
    setInputValue('');

    try {
      // Auto-expand chat history when sending a message
      if (!showHistory) {
        setShowHistory(true);
      }

      await sendMessage(message, getToken);
    } catch (error) {
      toast.error({
        title: 'Failed to send message',
        description: 'Please check your connection and try again.',
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled);
    toast.info({
      title: audioEnabled ? 'Audio disabled' : 'Audio enabled',
      description: audioEnabled
        ? 'Voice responses are now muted'
        : 'Voice responses are now enabled',
    });
  };

  const handleNewConversation = () => {
    setShowNewConversationModal(true);
  };

  const handleCreateConversation = async (title: string) => {
    try {
      await createNewConversation(title, getToken);
      setShowNewConversationModal(false);
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

  const getStatusColor = () => {
    switch (backendStatus) {
      case 'healthy': return 'text-green-500';
      case 'degraded': return 'text-yellow-500';
      case 'unhealthy': return 'text-red-500';
      case 'offline': return 'text-red-600';
      default: return 'text-gray-500';
    }
  };

  const getStatusText = () => {
    switch (backendStatus) {
      case 'healthy': return '● Online';
      case 'degraded': return '◐ Degraded';
      case 'unhealthy': return '● Issues';
      case 'offline': return '● Offline';
      default: return '◯ Unknown';
    }
  };

  return (
    <div className={cn('flex flex-col h-full overflow-hidden', className)}>
      {/* Header - Responsive */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between p-3 md:p-4 border-b bg-card/50 backdrop-blur-sm flex-shrink-0"
      >
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-3 h-3 md:w-4 md:h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-sm md:text-base truncate">GITA AI Chat</h2>
            <p className="text-xs md:text-sm text-muted-foreground truncate">
              Welcome, {user?.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={checkBackendHealth}
            title="Refresh backend status"
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <div className={cn('text-sm flex items-center gap-1', getStatusColor())}>
            <div className="w-2 h-2 rounded-full bg-current" />
            {getStatusText()}
          </div>
        </div>
      </motion.div>

      {/* Controls - Responsive */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center justify-between p-2 md:p-4 border-b bg-muted/30 flex-shrink-0"
      >
        <div className="flex items-center gap-1 md:gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAudio}
            title={audioEnabled ? 'Disable Audio' : 'Enable Audio'}
            className="h-8 px-2 md:px-3"
          >
            {audioEnabled ? <Volume2 className="w-3 h-3 md:w-4 md:h-4" /> : <VolumeX className="w-3 h-3 md:w-4 md:h-4" />}
            <span className="ml-1 md:ml-2 hidden sm:inline text-xs md:text-sm">
              {audioEnabled ? 'Audio On' : 'Audio Off'}
            </span>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHistory(!showHistory)}
          className={cn("h-8 px-2 md:px-3", showHistory && "bg-primary/10 text-primary")}
        >
          <Clock className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
          <span className="text-xs md:text-sm">History</span>
        </Button>
      </motion.div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {/* Chat History Panel - Responsive */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-b bg-muted/20"
            >
              <div className="p-2 md:p-4">
                <div className="flex items-center justify-between mb-2 md:mb-3">
                  <h3 className="text-xs md:text-sm font-medium">Current Conversation</h3>
                  <div className="flex items-center gap-1 md:gap-2">
                    <span className="text-xs text-muted-foreground">
                      {Math.ceil(messages.length / 2)} exchanges
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNewConversation}
                      className="h-5 md:h-6 px-1 md:px-2 text-xs"
                    >
                      <Plus className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5 md:mr-1" />
                      <span className="hidden sm:inline">New Chat</span>
                      <span className="sm:hidden">New</span>
                    </Button>
                  </div>
                </div>

                {/* Responsive History Container */}
                <div
                  ref={historyRef}
                  className="space-y-4 chat-history-mobile sm:max-h-[35vh] lg:max-h-[40vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
                >
                  {messages.length > 0 ? (
                    // Group messages into user-assistant pairs
                    (() => {
                      // Group messages properly: each user message followed by all its AI responses
                      const exchanges: Array<{ user: ChatMessage, assistants: ChatMessage[] }> = [];
                      let currentExchange: { user: ChatMessage, assistants: ChatMessage[] } | null = null;

                      messages.forEach((message) => {
                        // Determine if this is a user message based on ID pattern
                        // The loadConversation function prefixes user messages with 'user-' and AI messages with 'ai-'
                        const isUserMessage = message.id && message.id.startsWith('user-');

                        if (isUserMessage) {
                          // Start a new exchange
                          if (currentExchange) {
                            exchanges.push(currentExchange);
                          }
                          currentExchange = {
                            user: message,
                            assistants: []
                          };
                        } else {
                          // This is an AI message, add it to current exchange
                          if (currentExchange) {
                            currentExchange.assistants.push(message);
                          }
                        }
                      });

                      // Don't forget the last exchange
                      if (currentExchange) {
                        exchanges.push(currentExchange);
                      }



                      return exchanges.slice(-5).map((exchange, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="space-y-2"
                        >
                          {/* User Message - Responsive */}
                          <div className="flex items-start gap-1.5 md:gap-2">
                            <div className="w-5 h-5 md:w-6 md:h-6 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="w-2.5 h-2.5 md:w-3 md:h-3 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="bg-primary/10 rounded-lg p-1.5 md:p-2">
                                <p className="chat-message text-xs md:text-sm text-foreground whitespace-pre-wrap break-words">
                                  {exchange.user.text}
                                </p>
                              </div>
                              <span className="text-xs text-muted-foreground mt-0.5 md:mt-1 block">
                                {formatRelativeTime(exchange.user.timestamp || new Date().toISOString())}
                              </span>
                            </div>
                          </div>

                          {/* Assistant Responses - Responsive */}
                          {exchange.assistants && exchange.assistants.map((assistant, assistantIndex) => (
                            <div key={assistantIndex} className="flex items-start gap-1.5 md:gap-2 ml-2 md:ml-4 mt-1.5 md:mt-2">
                              <div className="w-5 h-5 md:w-6 md:h-6 bg-gradient-to-br from-orange-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                                <Bot className="w-2.5 h-2.5 md:w-3 md:h-3 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="bg-muted/50 rounded-lg p-1.5 md:p-2">
                                  {assistant.isTyping ? (
                                    <div className="flex items-center gap-1.5 md:gap-2">
                                      <div className="flex space-x-0.5 md:space-x-1">
                                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-primary rounded-full animate-bounce"></div>
                                      </div>
                                      <span className="text-xs md:text-sm text-muted-foreground italic">
                                        {assistant.text}
                                      </span>
                                    </div>
                                  ) : (
                                    <p className="chat-message text-xs md:text-sm text-foreground whitespace-pre-wrap break-words">
                                      {assistant.text}
                                    </p>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground mt-1 block">
                                  {formatRelativeTime(assistant.timestamp || new Date().toISOString())}
                                </span>
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      ));
                    })()
                  ) : (
                    <div className="text-center py-8">
                      <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No messages yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Start a conversation to see your chat history
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Display */}
        {
          error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 border-b"
            >
              <Card className="bg-destructive/10 border-destructive/20">
                <CardContent className="p-3">
                  <p className="text-sm text-destructive">{error}</p>
                </CardContent>
              </Card>
            </motion.div>
          )
        }

        {/* Current Message Display */}
        {
          currentMessage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 border-b bg-primary/5"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">GITA AI</p>
                  <p className="text-sm">{currentMessage.text}</p>
                  {currentMessage.audio && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Volume2 className="w-3 h-3" />
                      Playing audio response...
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )
        }

        {/* Loading/Typing Indicator - Only show if no typing messages exist */}
        {
          isLoading && !currentMessage && !messages.some(msg => msg.isTyping) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 border-b bg-primary/5"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">GITA AI</p>
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                    </div>
                    <span className="text-sm text-muted-foreground italic">
                      Thinking...
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )
        }
      </div>

      {/* Chat Input - Responsive - Fixed at bottom */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="chat-input-container p-2 md:p-4 flex-shrink-0"
      >
        <div className="flex gap-1.5 md:gap-2">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={inputValue + (interimTranscript ? ` ${interimTranscript}` : '')}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isListening
                  ? 'Listening... Speak now'
                  : backendStatus === 'offline'
                    ? 'Backend offline...'
                    : isLoading
                      ? 'Sending...'
                      : getResponsivePlaceholder(
                        'Ask me anything...',
                        'Ask me anything about life, spirituality, or the Bhagavad Gita...'
                      )
              }
              disabled={isLoading || backendStatus === 'offline'}
              className={`chat-input pr-10 md:pr-12 text-sm md:text-base h-9 md:h-10 ${isListening ? 'ring-2 ring-red-500 ring-opacity-50' : ''
                }`}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0.5 md:right-1 top-0.5 md:top-1 h-7 w-7 md:h-8 md:w-8"
              onClick={() => isListening ? stopListening() : startListening()}
              disabled={isLoading || !isVoiceSupported}
              title={!isVoiceSupported ? 'Voice input not supported in this browser' : isListening ? 'Stop listening' : 'Start voice input'}
            >
              {isListening ? (
                <Mic className="w-3 h-3 md:w-4 md:h-4 text-red-500 animate-pulse" />
              ) : (
                <MicOff className={`w-3 h-3 md:w-4 md:h-4 ${!isVoiceSupported ? 'text-gray-400' : ''}`} />
              )}
            </Button>
          </div>

          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading || backendStatus === 'offline'}
            loading={isLoading}
            className="chat-button touch-target px-3 md:px-6 h-9 md:h-10"
            size="sm"
          >
            <Send className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Send</span>
          </Button>
        </div>
      </motion.div>

      {/* New Conversation Modal */}
      <NewConversationModal
        open={showNewConversationModal}
        onOpenChange={setShowNewConversationModal}
        onCreateConversation={handleCreateConversation}
        isLoading={isLoading}
      />
    </div >
  );
};
