-- GITA AI Database Schema for Supabase
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    clerk_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro', 'enterprise')),
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'inactive', 'cancelled')),
    subscription_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    audio_url TEXT,
    lipsync_data JSONB,
    facial_expression TEXT,
    animation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logs table for backend logging
CREATE TABLE IF NOT EXISTS logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    level TEXT NOT NULL CHECK (level IN ('error', 'warn', 'info', 'debug')),
    message TEXT NOT NULL,
    meta JSONB,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    request_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User stats table for analytics
CREATE TABLE IF NOT EXISTS user_stats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_messages INTEGER DEFAULT 0,
    total_conversations INTEGER DEFAULT 0,
    total_session_time INTEGER DEFAULT 0, -- in seconds
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- System health table for monitoring
CREATE TABLE IF NOT EXISTS system_health (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    service_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'offline')),
    response_time INTEGER, -- in milliseconds
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_request_id ON logs(request_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_system_health_service ON system_health(service_name);
CREATE INDEX IF NOT EXISTS idx_system_health_created_at ON system_health(created_at DESC);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_stats_updated_at BEFORE UPDATE ON user_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update user stats
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update stats when a new message is created
    IF TG_OP = 'INSERT' AND NEW.role = 'user' THEN
        INSERT INTO user_stats (user_id, total_messages, last_active_at)
        SELECT c.user_id, 1, NOW()
        FROM conversations c
        WHERE c.id = NEW.conversation_id
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            total_messages = user_stats.total_messages + 1,
            last_active_at = NOW();
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Trigger to update user stats on message creation
CREATE TRIGGER update_user_stats_on_message AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_user_stats();

-- Function to update conversation stats
CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update conversation count when a new conversation is created
    IF TG_OP = 'INSERT' THEN
        INSERT INTO user_stats (user_id, total_conversations, last_active_at)
        VALUES (NEW.user_id, 1, NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            total_conversations = user_stats.total_conversations + 1,
            last_active_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update user stats on conversation creation
CREATE TRIGGER update_user_stats_on_conversation AFTER INSERT ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_conversation_stats();

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (clerk_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (clerk_id = auth.jwt() ->> 'sub');

-- Users can only see their own conversations
CREATE POLICY "Users can view own conversations" ON conversations
    FOR ALL USING (user_id IN (
        SELECT id FROM users WHERE clerk_id = auth.jwt() ->> 'sub'
    ));

-- Users can only see messages from their conversations
CREATE POLICY "Users can view own messages" ON messages
    FOR ALL USING (conversation_id IN (
        SELECT c.id FROM conversations c
        JOIN users u ON c.user_id = u.id
        WHERE u.clerk_id = auth.jwt() ->> 'sub'
    ));

-- Users can only see their own stats
CREATE POLICY "Users can view own stats" ON user_stats
    FOR ALL USING (user_id IN (
        SELECT id FROM users WHERE clerk_id = auth.jwt() ->> 'sub'
    ));

-- Create a view for user dashboard data
CREATE OR REPLACE VIEW user_dashboard AS
SELECT 
    u.id,
    u.name,
    u.email,
    u.avatar_url,
    u.subscription_plan,
    u.subscription_status,
    u.created_at as user_since,
    COALESCE(s.total_messages, 0) as total_messages,
    COALESCE(s.total_conversations, 0) as total_conversations,
    COALESCE(s.total_session_time, 0) as total_session_time,
    s.last_active_at,
    (
        SELECT COUNT(*) 
        FROM conversations c 
        WHERE c.user_id = u.id 
        AND c.created_at > NOW() - INTERVAL '7 days'
    ) as conversations_this_week,
    (
        SELECT COUNT(*) 
        FROM messages m 
        JOIN conversations c ON m.conversation_id = c.id 
        WHERE c.user_id = u.id 
        AND m.role = 'user'
        AND m.created_at > NOW() - INTERVAL '7 days'
    ) as messages_this_week
FROM users u
LEFT JOIN user_stats s ON u.id = s.user_id;

-- Grant permissions for the service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Insert some sample data (optional)
-- INSERT INTO users (clerk_id, email, name) VALUES 
-- ('user_demo123', 'demo@example.com', 'Demo User');

COMMENT ON TABLE users IS 'User accounts synced with Clerk authentication';
COMMENT ON TABLE conversations IS 'Chat conversations between users and the AI';
COMMENT ON TABLE messages IS 'Individual messages within conversations';
COMMENT ON TABLE logs IS 'Application logs for debugging and monitoring';
COMMENT ON TABLE user_stats IS 'User activity statistics and analytics';
COMMENT ON TABLE system_health IS 'System health monitoring data';
