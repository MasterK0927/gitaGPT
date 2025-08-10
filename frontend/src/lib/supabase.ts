import { createClient } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Disable Supabase auth since we're using Clerk
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'X-Client-Info': 'gita-ai-frontend',
    },
  },
});

// Database types (generated from Supabase)
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          clerk_id: string;
          email: string;
          name: string;
          avatar_url?: string;
          subscription_plan: 'free' | 'pro' | 'enterprise';
          subscription_status: 'active' | 'inactive' | 'cancelled';
          subscription_expires_at?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clerk_id: string;
          email: string;
          name: string;
          avatar_url?: string;
          subscription_plan?: 'free' | 'pro' | 'enterprise';
          subscription_status?: 'active' | 'inactive' | 'cancelled';
          subscription_expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clerk_id?: string;
          email?: string;
          name?: string;
          avatar_url?: string;
          subscription_plan?: 'free' | 'pro' | 'enterprise';
          subscription_status?: 'active' | 'inactive' | 'cancelled';
          subscription_expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          content: string;
          role: 'user' | 'assistant';
          audio_url?: string;
          lipsync_data?: any;
          facial_expression?: string;
          animation?: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          content: string;
          role: 'user' | 'assistant';
          audio_url?: string;
          lipsync_data?: any;
          facial_expression?: string;
          animation?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          content?: string;
          role?: 'user' | 'assistant';
          audio_url?: string;
          lipsync_data?: any;
          facial_expression?: string;
          animation?: string;
          created_at?: string;
        };
      };
      logs: {
        Row: {
          id: string;
          level: 'error' | 'warn' | 'info' | 'debug';
          message: string;
          meta?: any;
          user_id?: string;
          request_id?: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          level: 'error' | 'warn' | 'info' | 'debug';
          message: string;
          meta?: any;
          user_id?: string;
          request_id?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          level?: 'error' | 'warn' | 'info' | 'debug';
          message?: string;
          meta?: any;
          user_id?: string;
          request_id?: string;
          created_at?: string;
        };
      };
      user_stats: {
        Row: {
          id: string;
          user_id: string;
          total_messages: number;
          total_conversations: number;
          total_session_time: number;
          last_active_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          total_messages?: number;
          total_conversations?: number;
          total_session_time?: number;
          last_active_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          total_messages?: number;
          total_conversations?: number;
          total_session_time?: number;
          last_active_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      user_dashboard: {
        Row: {
          id: string;
          name: string;
          email: string;
          avatar_url?: string;
          subscription_plan: string;
          subscription_status: string;
          user_since: string;
          total_messages: number;
          total_conversations: number;
          total_session_time: number;
          last_active_at?: string;
          conversations_this_week: number;
          messages_this_week: number;
        };
      };
    };
  };
}

// Typed Supabase client
export type SupabaseClient = typeof supabase;

// Hook to get authenticated Supabase client
export const useSupabaseClient = () => {
  const { getToken } = useAuth();

  const getAuthenticatedClient = async () => {
    const token = await getToken({ template: 'supabase' });
    
    if (token) {
      // Set the JWT token for RLS
      supabase.auth.setSession({
        access_token: token,
        refresh_token: '',
      } as any);
    }
    
    return supabase;
  };

  return {
    supabase,
    getAuthenticatedClient,
  };
};

// Helper functions for common operations
export const supabaseHelpers = {
  // User operations
  async createUser(userData: Database['public']['Tables']['users']['Insert']) {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getUserByClerkId(clerkId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', clerkId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async updateUser(clerkId: string, updates: Database['public']['Tables']['users']['Update']) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('clerk_id', clerkId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Conversation operations
  async getConversations(userId: string) {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        messages(count)
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async createConversation(userId: string, title: string = 'New Conversation') {
    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: userId, title })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Message operations
  async getMessages(conversationId: string) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async createMessage(messageData: Database['public']['Tables']['messages']['Insert']) {
    const { data, error } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Real-time subscriptions
  subscribeToConversations(userId: string, callback: (payload: any) => void) {
    return supabase
      .channel('conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  },

  subscribeToMessages(conversationId: string, callback: (payload: any) => void) {
    return supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        callback
      )
      .subscribe();
  },
};
