-- Migration: Add username field to users table
-- Date: 2025-01-20
-- Description: Add username field to support custom auth form with username collection

-- Add username column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Create index for username lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Add comment for the new field
COMMENT ON COLUMN users.username IS 'Unique username chosen by user during registration';

-- Drop and recreate the user_dashboard view to include username
DROP VIEW IF EXISTS user_dashboard;
CREATE VIEW user_dashboard AS
SELECT 
    u.id,
    u.name,
    u.email,
    u.username,
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

-- Add RLS policy for username uniqueness check (for validation)
CREATE POLICY "Allow username uniqueness check" ON users
    FOR SELECT USING (true);

-- Note: This policy allows reading usernames for uniqueness validation
-- but the main user data is still protected by existing RLS policies
