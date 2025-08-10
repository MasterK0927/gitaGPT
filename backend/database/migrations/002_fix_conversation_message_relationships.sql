-- Migration: Fix Conversation-Message Relationships
-- This migration ensures all messages are properly linked to conversations
-- and fixes any data integrity issues

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ANALYZE CURRENT DATA INTEGRITY
-- Check for orphaned messages (messages without valid conversation_id)
DO $$
DECLARE
    orphaned_count INTEGER;
    total_messages INTEGER;
    total_conversations INTEGER;
BEGIN
    -- Count orphaned messages
    SELECT COUNT(*) INTO orphaned_count
    FROM messages m
    LEFT JOIN conversations c ON m.conversation_id = c.id
    WHERE c.id IS NULL;
    
    -- Count total messages and conversations
    SELECT COUNT(*) INTO total_messages FROM messages;
    SELECT COUNT(*) INTO total_conversations FROM conversations;
    
    RAISE NOTICE 'DATA INTEGRITY ANALYSIS:';
    RAISE NOTICE '- Total conversations: %', total_conversations;
    RAISE NOTICE '- Total messages: %', total_messages;
    RAISE NOTICE '- Orphaned messages: %', orphaned_count;
    
    IF orphaned_count > 0 THEN
        RAISE NOTICE 'WARNING: Found % orphaned messages that need to be fixed!', orphaned_count;
    ELSE
        RAISE NOTICE 'SUCCESS: No orphaned messages found.';
    END IF;
END $$;

-- 2. CREATE TEMPORARY TABLE TO TRACK PROBLEMATIC DATA
CREATE TEMP TABLE IF NOT EXISTS orphaned_messages AS
SELECT 
    m.id as message_id,
    m.conversation_id as invalid_conversation_id,
    m.content,
    m.role,
    m.created_at,
    -- Try to find the user who might own this message
    (SELECT u.id FROM users u ORDER BY u.created_at LIMIT 1) as fallback_user_id
FROM messages m
LEFT JOIN conversations c ON m.conversation_id = c.id
WHERE c.id IS NULL;

-- 3. FIX ORPHANED MESSAGES
-- For each orphaned message, create a conversation or assign to existing one
DO $$
DECLARE
    orphaned_msg RECORD;
    new_conversation_id UUID;
    fallback_user_id UUID;
BEGIN
    -- Get a fallback user (first user in the system)
    SELECT id INTO fallback_user_id FROM users ORDER BY created_at LIMIT 1;
    
    IF fallback_user_id IS NULL THEN
        RAISE EXCEPTION 'No users found in the system. Cannot fix orphaned messages.';
    END IF;
    
    -- Process each orphaned message
    FOR orphaned_msg IN SELECT * FROM orphaned_messages LOOP
        -- Create a new conversation for this orphaned message
        INSERT INTO conversations (id, user_id, title, created_at, updated_at)
        VALUES (
            uuid_generate_v4(),
            fallback_user_id,
            'Recovered Chat',
            orphaned_msg.created_at,
            orphaned_msg.created_at
        )
        RETURNING id INTO new_conversation_id;
        
        -- Update the orphaned message to point to the new conversation
        UPDATE messages 
        SET conversation_id = new_conversation_id
        WHERE id = orphaned_msg.message_id;
        
        RAISE NOTICE 'Fixed orphaned message % by creating conversation %', 
                     orphaned_msg.message_id, new_conversation_id;
    END LOOP;
    
    RAISE NOTICE 'Completed fixing orphaned messages.';
END $$;

-- 4. ADD ENHANCED INDEXES FOR BETTER PERFORMANCE
-- Drop existing indexes if they exist (to recreate them)
DROP INDEX IF EXISTS idx_messages_conversation_id;
DROP INDEX IF EXISTS idx_messages_conversation_created;
DROP INDEX IF EXISTS idx_messages_role_conversation;

-- Create optimized indexes
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_role_conversation ON messages(conversation_id, role, created_at);

-- Index for conversations
DROP INDEX IF EXISTS idx_conversations_user_updated;
CREATE INDEX idx_conversations_user_updated ON conversations(user_id, updated_at DESC);

-- 5. CREATE HELPER FUNCTION TO GET CONVERSATION WITH MESSAGES
CREATE OR REPLACE FUNCTION get_conversation_with_messages(
    p_conversation_id UUID,
    p_user_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
    conversation_id UUID,
    conversation_title TEXT,
    conversation_created_at TIMESTAMPTZ,
    conversation_updated_at TIMESTAMPTZ,
    message_id UUID,
    message_content TEXT,
    message_role TEXT,
    message_audio_url TEXT,
    message_lipsync_data JSONB,
    message_facial_expression TEXT,
    message_animation TEXT,
    message_created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as conversation_id,
        c.title as conversation_title,
        c.created_at as conversation_created_at,
        c.updated_at as conversation_updated_at,
        m.id as message_id,
        m.content as message_content,
        m.role as message_role,
        m.audio_url as message_audio_url,
        m.lipsync_data as message_lipsync_data,
        m.facial_expression as message_facial_expression,
        m.animation as message_animation,
        m.created_at as message_created_at
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE c.id = p_conversation_id
    AND (p_user_id IS NULL OR c.user_id = p_user_id)
    ORDER BY m.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 6. CREATE FUNCTION TO GET CONVERSATION STATISTICS
CREATE OR REPLACE FUNCTION get_conversation_stats(p_conversation_id UUID)
RETURNS TABLE(
    conversation_id UUID,
    total_messages INTEGER,
    user_messages INTEGER,
    assistant_messages INTEGER,
    first_message_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p_conversation_id as conversation_id,
        COUNT(*)::INTEGER as total_messages,
        COUNT(CASE WHEN role = 'user' THEN 1 END)::INTEGER as user_messages,
        COUNT(CASE WHEN role = 'assistant' THEN 1 END)::INTEGER as assistant_messages,
        MIN(created_at) as first_message_at,
        MAX(created_at) as last_message_at
    FROM messages
    WHERE conversation_id = p_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- 7. CREATE TRIGGER TO UPDATE CONVERSATION TIMESTAMP
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON messages;

-- Create trigger
CREATE TRIGGER trigger_update_conversation_timestamp
    AFTER INSERT OR UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- 8. FINAL DATA INTEGRITY CHECK
DO $$
DECLARE
    orphaned_count INTEGER;
    total_messages INTEGER;
    conversations_with_messages INTEGER;
    conversations_without_messages INTEGER;
BEGIN
    -- Check for orphaned messages again
    SELECT COUNT(*) INTO orphaned_count
    FROM messages m
    LEFT JOIN conversations c ON m.conversation_id = c.id
    WHERE c.id IS NULL;
    
    -- Count total messages
    SELECT COUNT(*) INTO total_messages FROM messages;
    
    -- Count conversations with and without messages
    SELECT COUNT(*) INTO conversations_with_messages
    FROM conversations c
    WHERE EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id);
    
    SELECT COUNT(*) INTO conversations_without_messages
    FROM conversations c
    WHERE NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id);
    
    RAISE NOTICE 'FINAL DATA INTEGRITY CHECK:';
    RAISE NOTICE '- Total messages: %', total_messages;
    RAISE NOTICE '- Orphaned messages: %', orphaned_count;
    RAISE NOTICE '- Conversations with messages: %', conversations_with_messages;
    RAISE NOTICE '- Empty conversations: %', conversations_without_messages;
    
    IF orphaned_count = 0 THEN
        RAISE NOTICE 'SUCCESS: All messages are properly linked to conversations!';
    ELSE
        RAISE EXCEPTION 'FAILED: Still have % orphaned messages after migration!', orphaned_count;
    END IF;
END $$;

-- 9. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION get_conversation_with_messages(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_conversation_stats(UUID) TO service_role;

-- 10. ADD COMMENTS
COMMENT ON FUNCTION get_conversation_with_messages IS 'Retrieves a conversation with all its messages in chronological order';
COMMENT ON FUNCTION get_conversation_stats IS 'Returns statistics for a conversation including message counts and timestamps';
COMMENT ON TRIGGER trigger_update_conversation_timestamp ON messages IS 'Automatically updates conversation timestamp when messages are added/updated';

RAISE NOTICE 'Migration 002_fix_conversation_message_relationships completed successfully!';
