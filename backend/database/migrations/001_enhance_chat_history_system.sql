-- Migration: Enhance Chat History System
-- Date: 2025-01-22
-- Description: Add username support, soft delete functionality, and enhanced chat history features

-- Add username column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Add soft delete columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_reason TEXT NULL;

-- Add preview text to conversations for better history display
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS preview_text TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;

-- Add soft delete to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- Create index for username lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;

-- Create index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_deletion_scheduled ON users(deletion_scheduled_at) WHERE deletion_scheduled_at IS NOT NULL;

-- Create index for conversation preview and sorting
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at ON conversations(deleted_at) WHERE deleted_at IS NOT NULL;

-- Function to update conversation metadata when messages are added
CREATE OR REPLACE FUNCTION update_conversation_metadata()
RETURNS TRIGGER AS $$
BEGIN
    -- Update conversation metadata when a message is added
    IF TG_OP = 'INSERT' THEN
        UPDATE conversations 
        SET 
            message_count = COALESCE(message_count, 0) + 1,
            last_message_at = NEW.created_at,
            preview_text = CASE 
                WHEN NEW.role = 'user' THEN LEFT(NEW.content, 100)
                ELSE COALESCE(preview_text, LEFT(NEW.content, 100))
            END,
            updated_at = NOW()
        WHERE id = NEW.conversation_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Create trigger for conversation metadata updates
DROP TRIGGER IF EXISTS update_conversation_metadata_trigger ON messages;
CREATE TRIGGER update_conversation_metadata_trigger 
    AFTER INSERT ON messages
    FOR EACH ROW 
    EXECUTE FUNCTION update_conversation_metadata();

-- Function to handle user soft delete
CREATE OR REPLACE FUNCTION soft_delete_user(user_id UUID, reason TEXT DEFAULT 'User requested deletion')
RETURNS BOOLEAN AS $$
BEGIN
    -- Mark user for deletion
    UPDATE users 
    SET 
        deleted_at = NOW(),
        deletion_scheduled_at = NOW() + INTERVAL '30 days',
        deletion_reason = reason,
        updated_at = NOW()
    WHERE id = user_id AND deleted_at IS NULL;
    
    -- Soft delete all user's conversations
    UPDATE conversations 
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE user_id = user_id AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$ language 'plpgsql';

-- Function to restore user account
CREATE OR REPLACE FUNCTION restore_user_account(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Restore user account
    UPDATE users 
    SET 
        deleted_at = NULL,
        deletion_scheduled_at = NULL,
        deletion_reason = NULL,
        updated_at = NOW()
    WHERE id = user_id AND deleted_at IS NOT NULL;
    
    -- Restore user's conversations
    UPDATE conversations 
    SET deleted_at = NULL, updated_at = NOW()
    WHERE user_id = user_id AND deleted_at IS NOT NULL;
    
    RETURN FOUND;
END;
$$ language 'plpgsql';

-- Function to hard delete users scheduled for deletion
CREATE OR REPLACE FUNCTION cleanup_deleted_users()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    user_record RECORD;
BEGIN
    -- Find users scheduled for hard deletion
    FOR user_record IN 
        SELECT id FROM users 
        WHERE deletion_scheduled_at IS NOT NULL 
        AND deletion_scheduled_at <= NOW()
        AND deleted_at IS NOT NULL
    LOOP
        -- Hard delete user (cascades to conversations and messages)
        DELETE FROM users WHERE id = user_record.id;
        deleted_count := deleted_count + 1;
    END LOOP;
    
    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Update RLS policies to handle soft deletes
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (
        clerk_id = auth.jwt() ->> 'sub' 
        AND deleted_at IS NULL
    );

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (
        clerk_id = auth.jwt() ->> 'sub' 
        AND deleted_at IS NULL
    );

-- Update conversation policies to handle soft deletes
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
CREATE POLICY "Users can view own conversations" ON conversations
    FOR ALL USING (
        user_id IN (
            SELECT id FROM users 
            WHERE clerk_id = auth.jwt() ->> 'sub' 
            AND deleted_at IS NULL
        )
        AND deleted_at IS NULL
    );

-- Create view for enhanced conversation history
CREATE OR REPLACE VIEW conversation_history AS
SELECT 
    c.id,
    c.user_id,
    c.title,
    c.preview_text,
    c.message_count,
    c.last_message_at,
    c.created_at,
    c.updated_at,
    u.username,
    u.name as user_name,
    -- Get the first user message for better preview
    (
        SELECT content 
        FROM messages m 
        WHERE m.conversation_id = c.id 
        AND m.role = 'user' 
        ORDER BY m.created_at ASC 
        LIMIT 1
    ) as first_user_message,
    -- Get the latest message timestamp
    (
        SELECT MAX(created_at) 
        FROM messages m 
        WHERE m.conversation_id = c.id
    ) as actual_last_message_at
FROM conversations c
JOIN users u ON c.user_id = u.id
WHERE c.deleted_at IS NULL 
AND u.deleted_at IS NULL;

-- Grant permissions
GRANT EXECUTE ON FUNCTION soft_delete_user(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION restore_user_account(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_deleted_users() TO service_role;
GRANT SELECT ON conversation_history TO service_role;

-- Update existing conversations to have preview text from their first message
UPDATE conversations 
SET preview_text = (
    SELECT LEFT(content, 100)
    FROM messages 
    WHERE conversation_id = conversations.id 
    AND role = 'user'
    ORDER BY created_at ASC 
    LIMIT 1
)
WHERE preview_text IS NULL;

-- Update message counts for existing conversations
UPDATE conversations 
SET message_count = (
    SELECT COUNT(*) 
    FROM messages 
    WHERE conversation_id = conversations.id
)
WHERE message_count = 0 OR message_count IS NULL;

-- Update last_message_at for existing conversations
UPDATE conversations 
SET last_message_at = (
    SELECT MAX(created_at) 
    FROM messages 
    WHERE conversation_id = conversations.id
)
WHERE last_message_at IS NULL;

COMMENT ON COLUMN users.username IS 'Unique username for user identification';
COMMENT ON COLUMN users.deleted_at IS 'Timestamp when user account was soft deleted';
COMMENT ON COLUMN users.deletion_scheduled_at IS 'Timestamp when user account will be hard deleted';
COMMENT ON COLUMN users.deletion_reason IS 'Reason for account deletion';
COMMENT ON COLUMN conversations.preview_text IS 'Preview text for conversation history display';
COMMENT ON COLUMN conversations.message_count IS 'Cached count of messages in conversation';
COMMENT ON COLUMN conversations.last_message_at IS 'Timestamp of the last message in conversation';
COMMENT ON VIEW conversation_history IS 'Enhanced view for conversation history with user details and metadata';
