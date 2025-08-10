import { createClient } from '@supabase/supabase-js';
import logger from './logger.js';

class DatabaseService {
  constructor() {
    this.supabase = null;
    this.isConnected = false;
  }

  async initialize() {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration missing');
      }

      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      // Test connection
      const { data, error } = await this.supabase
        .from('users')
        .select('count')
        .limit(1);

      if (error && error.code !== 'PGRST116') { // PGRST116 is "table not found" which is ok during setup
        throw error;
      }

      this.isConnected = true;
      logger.info('Database service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize database service:', error);
      this.isConnected = false;
      return false;
    }
  }

  // User operations
  async createUser(userData) {
    try {
      logger.info('🔄 DB Operation: Creating user', {
        operation: 'INSERT',
        table: 'users',
        clerkId: userData.clerkId,
        email: userData.email,
        username: userData.username
      });

      const { data, error } = await this.supabase
        .from('users')
        .insert([{
          clerk_id: userData.clerkId,
          email: userData.email,
          name: userData.name,
          username: userData.username,
          avatar_url: userData.avatarUrl,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      logger.info('✅ DB Operation: User created successfully', {
        operation: 'INSERT',
        table: 'users',
        userId: data.id,
        clerkId: userData.clerkId,
        email: userData.email
      });

      return data;
    } catch (error) {
      logger.error('❌ DB Operation: Failed to create user', {
        operation: 'INSERT',
        table: 'users',
        clerkId: userData.clerkId,
        error: error.message
      });
      throw error;
    }
  }

  async getUserByClerkId(clerkId) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('clerk_id', clerkId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      logger.error('Error fetching user:', error);
      return null;
    }
  }



  async updateUser(clerkId, updates) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('clerk_id', clerkId)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) throw error;
      logger.info(`User updated: ${clerkId}`);
      return data;
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  async softDeleteUser(userId, reason = 'User requested deletion') {
    try {
      const { data, error } = await this.supabase
        .rpc('soft_delete_user', {
          user_id: userId,
          reason: reason
        });

      if (error) throw error;

      logger.info('User account soft deleted', { userId, reason });
      return data;
    } catch (error) {
      logger.error('Error soft deleting user:', error);
      throw error;
    }
  }

  async restoreUserAccount(userId) {
    try {
      const { data, error } = await this.supabase
        .rpc('restore_user_account', {
          user_id: userId
        });

      if (error) throw error;

      logger.info('User account restored', { userId });
      return data;
    } catch (error) {
      logger.error('Error restoring user account:', error);
      throw error;
    }
  }

  async checkUserDeletionStatus(clerkId) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('id, deleted_at, deletion_scheduled_at, deletion_reason')
        .eq('clerk_id', clerkId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      logger.error('Error checking user deletion status:', error);
      return null;
    }
  }

  async getUserByUsername(username) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .is('deleted_at', null)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      logger.error('Error fetching user by username:', error);
      return null;
    }
  }

  // Conversation operations
  async createConversation(userId, title = 'New Conversation') {
    try {
      logger.info('🔄 DB Operation: Creating conversation', {
        operation: 'INSERT',
        table: 'conversations',
        userId,
        title
      });

      const { data, error } = await this.supabase
        .from('conversations')
        .insert([{
          user_id: userId,
          title,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      logger.info('✅ DB Operation: Conversation created successfully', {
        operation: 'INSERT',
        table: 'conversations',
        conversationId: data.id,
        userId,
        title
      });

      return data;
    } catch (error) {
      logger.error('❌ DB Operation: Failed to create conversation', {
        operation: 'INSERT',
        table: 'conversations',
        userId,
        title,
        error: error.message
      });
      throw error;
    }
  }

  async getConversations(userId, limit = 50) {
    try {
      logger.info(`Fetching conversations for user: ${userId}`);

      // Use the new function to get conversations with proper message counts
      const { data: conversations, error } = await this.supabase
        .rpc('get_user_conversations', {
          p_user_id: userId,
          p_limit: limit
        });

      if (error) {
        logger.warn('New function not available, falling back to direct query:', error.message);

        // Fallback to direct query with manual aggregation
        const { data: directConversations, error: directError } = await this.supabase
          .from('conversations')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(limit);

        if (directError) throw directError;

        // Enhance with message counts manually
        const enhancedConversations = await Promise.all(
          (directConversations || []).map(async (conv) => {
            // Get user message count
            const { count: userMessageCount } = await this.supabase
              .from('user_messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', conv.id);

            // Get user message IDs first, then count AI responses
            const { data: userMessageIds } = await this.supabase
              .from('user_messages')
              .select('id')
              .eq('conversation_id', conv.id);

            let aiResponseCount = 0;
            if (userMessageIds && userMessageIds.length > 0) {
              const messageIds = userMessageIds.map(um => um.id);
              const { count } = await this.supabase
                .from('ai_responses')
                .select('*', { count: 'exact', head: true })
                .in('user_message_id', messageIds);
              aiResponseCount = count || 0;
            }

            // Get first user message for preview
            const { data: firstUserMessage } = await this.supabase
              .from('user_messages')
              .select('content')
              .eq('conversation_id', conv.id)
              .order('created_at', { ascending: true })
              .limit(1)
              .single();

            return {
              ...conv,
              user_message_count: userMessageCount || 0,
              ai_response_count: aiResponseCount,
              total_message_count: (userMessageCount || 0) + aiResponseCount,
              first_user_message: firstUserMessage?.content || null,
              preview_text: firstUserMessage?.content?.substring(0, 100) || 'No preview available',
              last_message_at: conv.updated_at
            };
          })
        );

        return enhancedConversations;
      }

      logger.info(`Found ${conversations?.length || 0} conversations for user ${userId}`);
      return conversations || [];
    } catch (error) {
      logger.error('Error fetching conversations:', error);
      return [];
    }
  }

  async getConversationWithMessages(conversationId, userId) {
    try {
      logger.info(`Fetching conversation details: ${conversationId} for user: ${userId}`);

      // Get conversation details
      const { data: conversation, error: convError } = await this.supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();

      if (convError || !conversation) {
        logger.error('Conversation not found:', convError?.message);
        return null;
      }

      logger.info(`Conversation found: ${conversation.title}`);

      // Get user messages first
      const { data: userMessages, error: umError } = await this.supabase
        .from('user_messages')
        .select('id, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (umError) {
        logger.error('Error fetching user messages:', umError);
        return null;
      }

      logger.info(`Found ${userMessages?.length || 0} user messages`);

      // Build hierarchical threaded structure for frontend
      const threads = [];
      let totalMessages = 0;

      for (const userMessage of userMessages || []) {
        // Get AI responses for this user message separately
        const { data: aiResponses, error: arError } = await this.supabase
          .from('ai_responses')
          .select('id, content, audio_url, lipsync_data, facial_expression, animation, response_order, created_at')
          .eq('user_message_id', userMessage.id)
          .order('response_order', { ascending: true });

        if (arError) {
          logger.error(`Error fetching AI responses for user message ${userMessage.id}:`, arError);
          continue;
        }

        logger.info(`User message ${userMessage.id}: found ${aiResponses?.length || 0} AI responses`);

        const thread = {
          userMessage: {
            id: userMessage.id,
            role: 'user',
            content: userMessage.content,
            created_at: userMessage.created_at
          },
          aiResponses: (aiResponses || []).map(aiResponse => ({
            id: aiResponse.id,
            role: 'assistant',
            content: aiResponse.content,
            audio_url: aiResponse.audio_url,
            lipsync_data: aiResponse.lipsync_data,
            facial_expression: aiResponse.facial_expression,
            animation: aiResponse.animation,
            created_at: aiResponse.created_at,
            response_order: aiResponse.response_order
          }))
        };

        threads.push(thread);
        totalMessages += 1 + (aiResponses?.length || 0); // 1 user message + N AI responses

        logger.info(`Thread ${threads.length}: 1 user message + ${aiResponses?.length || 0} AI responses`);
      }

      // Also provide flat message array for backward compatibility with existing frontend
      const messages = [];
      threads.forEach(thread => {
        // Add user message
        messages.push(thread.userMessage);
        // Add all AI responses for this user message
        thread.aiResponses.forEach(aiResponse => {
          messages.push(aiResponse);
        });
      });

      logger.info(`Built hierarchical conversation: ${threads.length} threads, ${totalMessages} total messages`);
      logger.info('Thread breakdown:', threads.map((t, i) => ({
        thread: i + 1,
        userMessage: t.userMessage.content.substring(0, 50) + '...',
        aiResponseCount: t.aiResponses.length,
        aiResponses: t.aiResponses.map(r => r.content.substring(0, 30) + '...')
      })));

      return {
        ...conversation,
        threads: threads,        // New hierarchical format
        messages: messages       // Flat format for backward compatibility
      };
    } catch (error) {
      logger.error('Error fetching conversation with messages:', error);
      return null;
    }
  }

  async deleteConversation(conversationId, userId) {
    try {
      logger.info(`Deleting conversation: ${conversationId} for user: ${userId}`);

      // Verify conversation belongs to user
      const { data: conversation, error: convError } = await this.supabase
        .from('conversations')
        .select('id, user_id')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();

      if (convError || !conversation) {
        logger.warn('Conversation not found or access denied', { conversationId, userId });
        return null;
      }

      // Delete AI responses first (cascade from user_messages)
      const { data: userMessages } = await this.supabase
        .from('user_messages')
        .select('id')
        .eq('conversation_id', conversationId);

      if (userMessages && userMessages.length > 0) {
        const userMessageIds = userMessages.map(um => um.id);

        // Delete AI responses
        const { error: arError } = await this.supabase
          .from('ai_responses')
          .delete()
          .in('user_message_id', userMessageIds);

        if (arError) {
          logger.error('Error deleting AI responses:', arError);
        } else {
          logger.info(`Deleted AI responses for ${userMessageIds.length} user messages`);
        }
      }

      // Delete user messages
      const { error: umError } = await this.supabase
        .from('user_messages')
        .delete()
        .eq('conversation_id', conversationId);

      if (umError) {
        logger.error('Error deleting user messages:', umError);
      } else {
        logger.info('Deleted user messages for conversation');
      }

      // Delete old messages (for backward compatibility)
      const { error: msgError } = await this.supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);

      if (msgError) {
        logger.warn('Error deleting old messages (may not exist):', msgError.message);
      }

      // Finally delete the conversation
      const { data, error } = await this.supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      logger.info('Conversation completely deleted', { conversationId, userId });
      return data;
    } catch (error) {
      logger.error('Error deleting conversation:', error);
      throw error;
    }
  }

  // New Message operations for redesigned schema
  async createUserMessage(conversationId, content) {
    try {
      const { data, error } = await this.supabase
        .from('user_messages')
        .insert([{
          conversation_id: conversationId,
          content: content,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      logger.info(`User message created in conversation: ${conversationId}`);
      return data;
    } catch (error) {
      logger.error('Error creating user message:', error);
      throw error;
    }
  }

  async createAIResponse(userMessageId, responseData) {
    try {
      const { data, error } = await this.supabase
        .from('ai_responses')
        .insert([{
          user_message_id: userMessageId,
          content: responseData.content,
          audio_url: responseData.audioUrl,
          lipsync_data: responseData.lipsyncData,
          facial_expression: responseData.facialExpression,
          animation: responseData.animation,
          processing_mode: responseData.processingMode || 'standard',
          response_order: responseData.responseOrder || 1,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      logger.info(`AI response created for user message: ${userMessageId}`);
      return data;
    } catch (error) {
      logger.error('Error creating AI response:', error);
      throw error;
    }
  }

  // Legacy method for backward compatibility (will be removed)
  async createMessage(conversationId, messageData) {
    if (messageData.role === 'user') {
      return this.createUserMessage(conversationId, messageData.content);
    } else {
      // For AI messages, we need the user message ID
      // This is a temporary fallback - should be updated in controllers
      logger.warn('Legacy createMessage called for AI response - this should be updated');
      throw new Error('AI responses must be created with createAIResponse and user_message_id');
    }
  }

  async getMessages(conversationId, limit = 100) {
    try {
      const { data, error } = await this.supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching messages:', error);
      return [];
    }
  }

  // Alias for consistency with ConversationContextService
  async getConversationMessages(conversationId, limit = 100) {
    return this.getMessages(conversationId, limit);
  }

  // Logging operations
  async createLog(logData) {
    try {
      // Validate userId - only use if it's a valid UUID format
      let userId = null;
      if (logData.userId) {
        // Check if it's a valid UUID format (8-4-4-4-12 characters)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(logData.userId)) {
          userId = logData.userId;
        }
        // If it's a Clerk ID (starts with user_), try to find the database user
        else if (logData.userId.startsWith('user_')) {
          try {
            const user = await this.getUserByClerkId(logData.userId);
            userId = user?.id || null;
          } catch (error) {
            // Ignore lookup errors, just log without user_id
            userId = null;
          }
        }
      }

      const { data, error } = await this.supabase
        .from('logs')
        .insert([{
          level: logData.level,
          message: logData.message,
          meta: logData.meta,
          user_id: userId,
          request_id: logData.requestId,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      // Don't log errors for logging operations to avoid recursion
      console.error('Error creating log:', error);
      return null;
    }
  }

  async getLogs(filters = {}, limit = 100) {
    try {
      let query = this.supabase
        .from('logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (filters.level) {
        query = query.eq('level', filters.level);
      }

      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching logs:', error);
      return [];
    }
  }

  // Cleanup operations
  async cleanupOldLogs(retentionDays = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { error } = await this.supabase
        .from('logs')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) throw error;
      logger.info(`Cleaned up logs older than ${retentionDays} days`);
    } catch (error) {
      logger.error('Error cleaning up logs:', error);
    }
  }

  // Clear all logs (development only)
  async clearLogs() {
    try {
      logger.info('🔄 DB Operation: Clearing all logs', {
        operation: 'DELETE',
        table: 'logs'
      });

      const { count, error } = await this.supabase
        .from('logs')
        .delete()
        .neq('id', 0); // Delete all records

      if (error) throw error;

      logger.info('✅ DB Operation: All logs cleared', {
        operation: 'DELETE',
        table: 'logs',
        deletedCount: count || 0
      });

      return count || 0;
    } catch (error) {
      logger.error('❌ DB Operation: Failed to clear logs', {
        operation: 'DELETE',
        table: 'logs',
        error: error.message
      });
      throw error;
    }
  }

  // Debug function to inspect database contents
  async debugUserConversations(userId) {
    try {
      logger.info(`🔍 Debug: Inspecting database for user ${userId}`);

      // Check if user exists
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      logger.info(`🔍 Debug: User lookup result:`, {
        found: !!user,
        error: userError?.message,
        user: user ? { id: user.id, email: user.email, name: user.name } : null
      });

      // Check all conversations in database
      const { data: allConversations, error: allError } = await this.supabase
        .from('conversations')
        .select('id, user_id, title, created_at')
        .limit(20);

      logger.info(`🔍 Debug: All conversations in database:`, {
        total: allConversations?.length || 0,
        conversations: allConversations?.map(c => ({
          id: c.id.substring(0, 8) + '...',
          user_id: c.user_id.substring(0, 8) + '...',
          title: c.title,
          matches_user: c.user_id === userId
        })) || []
      });

      // Check conversations for this specific user
      const { data: userConversations, error: userConvError } = await this.supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId);

      logger.info(`🔍 Debug: User-specific conversations:`, {
        count: userConversations?.length || 0,
        error: userConvError?.message,
        conversations: userConversations?.map(c => ({
          id: c.id.substring(0, 8) + '...',
          title: c.title,
          created_at: c.created_at
        })) || []
      });

      return {
        user: user ? { id: user.id, email: user.email, name: user.name } : null,
        totalConversations: allConversations?.length || 0,
        userConversations: userConversations?.length || 0,
        allConversations: allConversations || [],
        userSpecificConversations: userConversations || []
      };
    } catch (error) {
      logger.error('🔍 Debug: Error inspecting database:', error);
      return { error: error.message };
    }
  }

  // Migrate conversations from development user to real user
  async migrateConversationsToUser(fromUserId, toUserId) {
    try {
      logger.info(`🔄 Migrating conversations from ${fromUserId} to ${toUserId}`);

      // Update conversations to belong to the real user
      const { data: updatedConversations, error } = await this.supabase
        .from('conversations')
        .update({ user_id: toUserId, updated_at: new Date().toISOString() })
        .eq('user_id', fromUserId)
        .select();

      if (error) throw error;

      logger.info(`✅ Migrated ${updatedConversations?.length || 0} conversations to user ${toUserId}`);

      return {
        success: true,
        migratedCount: updatedConversations?.length || 0,
        conversations: updatedConversations
      };
    } catch (error) {
      logger.error('❌ Error migrating conversations:', error);
      return { success: false, error: error.message };
    }
  }

  // Clean up development/sample data
  async cleanupDevelopmentData() {
    try {
      logger.info('Cleaning up development data...');

      // Remove development users and their conversations
      const { data: devUsers } = await this.supabase
        .from('users')
        .select('id')
        .or('email.eq.dev@example.com,name.eq.Development User,username.eq.dev_user');

      if (devUsers && devUsers.length > 0) {
        const devUserIds = devUsers.map(u => u.id);

        // Delete messages from dev user conversations
        const { data: devConversations } = await this.supabase
          .from('conversations')
          .select('id')
          .in('user_id', devUserIds);

        if (devConversations && devConversations.length > 0) {
          const devConversationIds = devConversations.map(c => c.id);

          await this.supabase
            .from('messages')
            .delete()
            .in('conversation_id', devConversationIds);
        }

        // Delete dev user conversations
        await this.supabase
          .from('conversations')
          .delete()
          .in('user_id', devUserIds);

        // Delete dev users
        await this.supabase
          .from('users')
          .delete()
          .in('id', devUserIds);

        logger.info(`Cleaned up ${devUserIds.length} development users and their data`);
      }

      return { cleaned: true, devUsersRemoved: devUsers?.length || 0 };
    } catch (error) {
      logger.error('Error cleaning up development data:', error);
      return { cleaned: false, error: error.message };
    }
  }

  async getUserStats(userId) {
    try {
      // Get conversation count and total messages
      const { data: conversations, error: convError } = await this.supabase
        .from('conversations')
        .select('id, created_at')
        .eq('user_id', userId);

      if (convError) throw convError;

      const totalConversations = conversations?.length || 0;

      // Get total message count from user_messages and ai_responses
      let totalMessages = 0;
      let lastActiveAt = null;

      if (totalConversations > 0) {
        // Get user messages count
        const { data: userMessages, error: umError } = await this.supabase
          .from('user_messages')
          .select('id, created_at')
          .in('conversation_id', conversations.map(c => c.id));

        if (umError) throw umError;

        // Get AI responses count
        const { data: aiResponses, error: arError } = await this.supabase
          .from('ai_responses')
          .select('id, created_at')
          .in('user_message_id', (userMessages || []).map(um => um.id));

        if (arError) throw arError;

        totalMessages = (userMessages?.length || 0) + (aiResponses?.length || 0);

        // Find last active time
        const allDates = [
          ...(conversations || []).map(c => c.created_at),
          ...(userMessages || []).map(um => um.created_at),
          ...(aiResponses || []).map(ar => ar.created_at)
        ].filter(Boolean);

        if (allDates.length > 0) {
          lastActiveAt = allDates.sort((a, b) => new Date(b) - new Date(a))[0];
        }
      }

      // Calculate estimated time spent (rough estimate based on messages and conversations)
      // Assume average 2 minutes per message exchange (user + AI response)
      const estimatedTimeMinutes = Math.floor(totalMessages * 1.5); // 1.5 minutes per message
      const timeSpentHours = estimatedTimeMinutes >= 60
        ? `${Math.floor(estimatedTimeMinutes / 60)}h ${estimatedTimeMinutes % 60}m`
        : `${estimatedTimeMinutes}m`;

      // Calculate insights gained (based on conversation depth and AI responses)
      // More sophisticated calculation: longer conversations = more insights
      let totalInsights = 0;
      if (totalConversations > 0) {
        // Base insights: 1 per conversation + bonus for message depth
        totalInsights = totalConversations;

        // Bonus insights for conversations with multiple exchanges
        const avgMessagesPerConv = totalMessages / totalConversations;
        if (avgMessagesPerConv > 4) {
          totalInsights += Math.floor(avgMessagesPerConv / 2); // Bonus for deeper conversations
        }

        // Additional insights for active users (more than 10 total messages)
        if (totalMessages > 10) {
          totalInsights += Math.floor(totalMessages / 10); // 1 insight per 10 messages
        }
      }

      const stats = {
        totalConversations,
        totalMessages,
        averageMessagesPerConversation: totalConversations > 0
          ? Math.round((totalMessages / totalConversations) * 10) / 10
          : 0,
        lastActiveAt,
        timeSpentMinutes: estimatedTimeMinutes,
        timeSpentFormatted: timeSpentHours,
        insightsGained: totalInsights
      };

      logger.info(`User stats retrieved for ${userId}:`, stats);
      return stats;
    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw error;
    }
  }

  // Meditation Schedules
  async createMeditationSchedule(userId, scheduleData) {
    try {
      // Validate schedule before creation
      await this.validateScheduleCreation(userId, scheduleData);

      const { data, error } = await this.supabase
        .from('meditation_schedules')
        .insert({
          user_id: userId,
          title: scheduleData.title,
          description: scheduleData.description,
          duration_minutes: scheduleData.duration_minutes || 10,
          frequency: scheduleData.frequency || 'daily',
          days_of_week: scheduleData.days_of_week || [1,2,3,4,5,6,7],
          time_of_day: scheduleData.time_of_day,
          timezone: scheduleData.timezone || 'UTC',
          is_active: scheduleData.is_active !== false,
          reminder_enabled: scheduleData.reminder_enabled !== false,
          reminder_minutes_before: scheduleData.reminder_minutes_before || 10,
          meditation_type: scheduleData.meditation_type || 'mindfulness',
          background_sound: scheduleData.background_sound || 'silence',
          email_status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      logger.info(`Meditation schedule created: ${data.id} for user: ${userId}`);
      return data;
    } catch (error) {
      logger.error('Error creating meditation schedule:', error);
      throw error;
    }
  }

  async validateScheduleCreation(userId, scheduleData) {
    // 1. Check maximum schedules limit
    const { data: existingSchedules, error: countError } = await this.supabase
      .from('meditation_schedules')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (countError) throw countError;

    if (existingSchedules && existingSchedules.length >= 10) {
      throw new Error('Maximum number of active schedules (10) reached. Please pause or delete existing schedules.');
    }

    // 2. Validate reminder time vs duration
    const reminderMinutes = scheduleData.reminder_minutes_before || 10;
    const durationMinutes = scheduleData.duration_minutes || 10;

    if (reminderMinutes > durationMinutes) {
      throw new Error('Reminder time cannot be greater than the meditation duration.');
    }

    // 3. Check for time conflicts
    await this.checkScheduleTimeConflicts(userId, scheduleData);
  }

  async checkScheduleTimeConflicts(userId, scheduleData, excludeScheduleId = null) {
    const { data: existingSchedules, error } = await this.supabase
      .from('meditation_schedules')
      .select('id, time_of_day, duration_minutes, days_of_week, timezone')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw error;

    if (!existingSchedules || existingSchedules.length === 0) return;

    const newSchedule = {
      time_of_day: scheduleData.time_of_day,
      duration_minutes: scheduleData.duration_minutes || 10,
      days_of_week: scheduleData.days_of_week || [1,2,3,4,5,6,7],
      timezone: scheduleData.timezone || 'UTC'
    };

    for (const existing of existingSchedules) {
      // Skip if this is the same schedule being updated
      if (excludeScheduleId && existing.id === excludeScheduleId) continue;

      // Check if schedules have overlapping days
      const overlappingDays = newSchedule.days_of_week.filter(day =>
        existing.days_of_week.includes(day)
      );

      if (overlappingDays.length === 0) continue;

      // Check for time conflicts on overlapping days
      const conflict = this.checkTimeOverlap(
        newSchedule.time_of_day,
        newSchedule.duration_minutes,
        existing.time_of_day,
        existing.duration_minutes
      );

      if (conflict) {
        const conflictDays = overlappingDays.map(day => {
          const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
          return dayNames[day - 1];
        }).join(', ');

        throw new Error(
          `Schedule conflicts with existing meditation on ${conflictDays} at ${existing.time_of_day}. ` +
          `Please choose a different time or adjust the duration.`
        );
      }
    }
  }

  checkTimeOverlap(time1, duration1, time2, duration2) {
    // Convert time strings to minutes since midnight
    const timeToMinutes = (timeStr) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const start1 = timeToMinutes(time1);
    const end1 = start1 + duration1;
    const start2 = timeToMinutes(time2);
    const end2 = start2 + duration2;

    // Check if time ranges overlap
    return (start1 < end2 && start2 < end1);
  }

  async getUserMeditationSchedules(userId, activeOnly = false) {
    try {
      let query = this.supabase
        .from('meditation_schedules')
        .select('*')
        .eq('user_id', userId)
        .order('time_of_day', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) throw error;

      logger.info(`Retrieved ${data.length} meditation schedules for user: ${userId}`);
      return data;
    } catch (error) {
      logger.error('Error getting user meditation schedules:', error);
      throw error;
    }
  }

  async getMeditationSchedule(scheduleId, userId) {
    try {
      const { data, error } = await this.supabase
        .from('meditation_schedules')
        .select('*')
        .eq('id', scheduleId)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        throw error;
      }

      logger.info(`Retrieved meditation schedule: ${scheduleId} for user: ${userId}`);
      return data;
    } catch (error) {
      logger.error('Error fetching meditation schedule:', error);
      throw error;
    }
  }

  async updateMeditationSchedule(scheduleId, userId, updates) {
    try {
      // If updating schedule details that could cause conflicts, validate
      if (updates.time_of_day || updates.duration_minutes || updates.days_of_week) {
        // Get current schedule data
        const { data: currentSchedule } = await this.supabase
          .from('meditation_schedules')
          .select('*')
          .eq('id', scheduleId)
          .eq('user_id', userId)
          .single();

        if (currentSchedule) {
          const updatedScheduleData = { ...currentSchedule, ...updates };
          await this.checkScheduleTimeConflicts(userId, updatedScheduleData, scheduleId);
        }
      }

      const { data, error } = await this.supabase
        .from('meditation_schedules')
        .update(updates)
        .eq('id', scheduleId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      logger.info(`Meditation schedule updated: ${scheduleId}`);
      return data;
    } catch (error) {
      logger.error('Error updating meditation schedule:', error);
      throw error;
    }
  }

  async updateScheduleEmailStatus(scheduleId, emailStatus, emailError = null) {
    try {
      const updates = { email_status: emailStatus };
      if (emailError) {
        updates.email_error = emailError;
      }

      const { data, error } = await this.supabase
        .from('meditation_schedules')
        .update(updates)
        .eq('id', scheduleId)
        .select()
        .single();

      if (error) throw error;

      logger.info(`Schedule email status updated: ${scheduleId} -> ${emailStatus}`);
      return data;
    } catch (error) {
      logger.error('Error updating schedule email status:', error);
      throw error;
    }
  }

  async deleteMeditationSchedule(scheduleId, userId) {
    try {
      const { error } = await this.supabase
        .from('meditation_schedules')
        .delete()
        .eq('id', scheduleId)
        .eq('user_id', userId);

      if (error) throw error;

      logger.info(`Meditation schedule deleted: ${scheduleId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting meditation schedule:', error);
      throw error;
    }
  }

  // Meditation Sessions
  async createMeditationSession(userId, sessionData) {
    try {
      const { data, error } = await this.supabase
        .from('meditation_sessions')
        .insert({
          user_id: userId,
          schedule_id: sessionData.schedule_id,
          title: sessionData.title,
          duration_minutes: sessionData.duration_minutes,
          meditation_type: sessionData.meditation_type,
          background_sound: sessionData.background_sound,
          started_at: sessionData.started_at || new Date().toISOString(),
          mood_before: sessionData.mood_before
        })
        .select()
        .single();

      if (error) throw error;

      logger.info(`Meditation session created: ${data.id} for user: ${userId}`);
      return data;
    } catch (error) {
      logger.error('Error creating meditation session:', error);
      throw error;
    }
  }

  async completeMeditationSession(sessionId, userId, completionData) {
    try {
      const { data, error } = await this.supabase
        .from('meditation_sessions')
        .update({
          completed_at: completionData.completed_at || new Date().toISOString(),
          is_completed: true,
          notes: completionData.notes,
          mood_after: completionData.mood_after,
          rating: completionData.rating
        })
        .eq('id', sessionId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      logger.info(`Meditation session completed: ${sessionId}`);
      return data;
    } catch (error) {
      logger.error('Error completing meditation session:', error);
      throw error;
    }
  }

  async getUserMeditationSessions(userId, limit = 50) {
    try {
      const { data, error } = await this.supabase
        .from('meditation_sessions')
        .select(`
          *,
          meditation_schedules (
            title,
            meditation_type
          )
        `)
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      logger.info(`Retrieved ${data.length} meditation sessions for user: ${userId}`);
      return data;
    } catch (error) {
      logger.error('Error getting user meditation sessions:', error);
      throw error;
    }
  }

  // Meditation Types and Sounds
  async getMeditationTypes() {
    try {
      const { data, error } = await this.supabase
        .from('meditation_types')
        .select('*')
        .order('name');

      if (error) throw error;

      return data;
    } catch (error) {
      logger.error('Error getting meditation types:', error);
      throw error;
    }
  }

  async getMeditationSounds() {
    try {
      const { data, error } = await this.supabase
        .from('meditation_sounds')
        .select('*')
        .order('name');

      if (error) throw error;

      return data;
    } catch (error) {
      logger.error('Error getting meditation sounds:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('count')
        .limit(1);

      return { healthy: !error, error: error?.message };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

export default new DatabaseService();
