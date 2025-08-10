import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Menu } from 'lucide-react';
import { ModernExperience } from '../features/avatar/components/ModernExperience';
import { ModernChatInterface } from '../features/chat/components/ModernChatInterface';
import { ResizablePanel } from '../shared/components/ui/ResizablePanel';
import { Button } from '../shared/components/ui';
import { cn } from '../shared/utils';

export const ChatPage: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [showChat, setShowChat] = useState(true); // Default to true for better UX

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Always show chat by default now
      setShowChat(true);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="chat-container flex flex-col md:flex-row bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
      {/* Mobile Chat Toggle Button - Positioned to avoid status monitor */}
      {isMobile && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="chat-toggle-mobile absolute"
        >
          <Button
            onClick={() => setShowChat(!showChat)}
            size="sm"
            className="shadow-lg"
            variant={showChat ? "secondary" : "default"}
          >
            {showChat ? (
              <X className="w-4 h-4" />
            ) : (
              <>
                <MessageSquare className="w-4 h-4 mr-2" />
                Chat
              </>
            )}
          </Button>
        </motion.div>
      )}

      {/* 3D Scene */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className={cn(
          "relative transition-all duration-300",
          isMobile
            ? showChat
              ? "h-1/2"
              : "flex-1"
            : "flex-1"
        )}
      >
        <ModernExperience className="w-full h-full" />
      </motion.div>

      {/* Chat Interface - Responsive */}
      <AnimatePresence>
        {(showChat || !isMobile) && (
          <motion.div
            initial={isMobile ? { opacity: 0, y: "100%" } : { opacity: 0, x: 300 }}
            animate={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, x: 0 }}
            exit={isMobile ? { opacity: 0, y: "100%" } : { opacity: 0, x: 300 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className={cn(
              "bg-background/95 backdrop-blur-sm",
              isMobile
                ? "fixed bottom-0 left-0 right-0 h-1/2 border-t rounded-t-xl z-40"
                : "border-l flex-shrink-0"
            )}
            style={!isMobile ? { width: 'min(400px, 35vw)' } : undefined}
          >
            {isMobile ? (
              // Mobile: Full-width chat with proper padding to avoid status monitor
              <div className="mobile-chat-container h-full flex flex-col">
                <ModernChatInterface className="h-full flex flex-col" />
              </div>
            ) : (
              // Desktop: Responsive width panel
              <div className="h-full w-full chat-panel-desktop lg:chat-panel-large flex flex-col">
                <ModernChatInterface className="h-full flex flex-col" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
