import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Plus, X } from 'lucide-react';
import {
  Modal,
  Button,
  Input
} from '../../../shared/components/ui';
import { toast } from '../../../shared/components/ui/Toast';

interface NewConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateConversation: (title: string) => void;
  isLoading?: boolean;
}

export const NewConversationModal: React.FC<NewConversationModalProps> = ({
  open,
  onOpenChange,
  onCreateConversation,
  isLoading = false
}) => {
  const [title, setTitle] = useState('');
  const [useCustomTitle, setUseCustomTitle] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const conversationTitle = useCustomTitle && title.trim()
      ? title.trim()
      : 'New Conversation';

    onCreateConversation(conversationTitle);

    // Reset form
    setTitle('');
    setUseCustomTitle(false);
  };

  const handleClose = () => {
    setTitle('');
    setUseCustomTitle(false);
    onOpenChange(false);
  };

  const handleQuickStart = () => {
    onCreateConversation('New Conversation');
    setTitle('');
    setUseCustomTitle(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleClose}
      title="Start New Conversation"
      description="Choose how you'd like to start your new conversation with GITA AI."
      size="md"
    >

      <div className="space-y-4">
        {/* Quick Start Option */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
            <div>
              <h4 className="font-medium">Quick Start</h4>
              <p className="text-sm text-muted-foreground">
                Start chatting immediately with a default title
              </p>
            </div>
            <Button
              onClick={handleQuickStart}
              disabled={isLoading}
              className="shrink-0"
            >
              <Plus className="w-4 h-4 mr-2" />
              Start Now
            </Button>
          </div>

          {/* Custom Title Option */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Custom Title</h4>
                <p className="text-sm text-muted-foreground">
                  Give your conversation a meaningful name
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUseCustomTitle(!useCustomTitle)}
                className={useCustomTitle ? 'bg-primary/10 text-primary' : ''}
              >
                {useCustomTitle ? 'Cancel' : 'Customize'}
              </Button>
            </div>

            {useCustomTitle && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleSubmit}
                className="space-y-3"
              >
                <div className="space-y-2">
                  <Input
                    id="conversation-title"
                    label="Conversation Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Spiritual Guidance, Life Questions, Daily Wisdom..."
                    maxLength={100}
                    autoFocus
                    helperText={`${title.length}/100 characters`}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    {isLoading ? 'Creating...' : 'Create Conversation'}
                  </Button>
                </div>
              </motion.form>
            )}
          </div>
        </motion.div>

        {/* Suggestions */}
        {!useCustomTitle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="border-t pt-4"
          >
            <h5 className="text-sm font-medium mb-2">Popular conversation topics:</h5>
            <div className="flex flex-wrap gap-2">
              {[
                'Spiritual Guidance',
                'Life Questions',
                'Daily Wisdom',
                'Meditation Help',
                'Personal Growth'
              ].map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTitle(suggestion);
                    setUseCustomTitle(true);
                  }}
                  className="text-xs h-7"
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </Modal>
  );
};
