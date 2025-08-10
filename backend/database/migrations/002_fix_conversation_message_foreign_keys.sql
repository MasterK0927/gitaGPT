-- Migration: Fix Conversation-Message Foreign Key Relationships
-- This migration diagnoses and fixes the relationship between conversations and messages

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DIAGNOSTIC: Check current data relationships
DO $$
DECLARE
    total_users INTEGER;
    total_conversations INTEGER;
    total_messages INTEGER;
    orphaned_messages INTEGER;
    conversations_without_messages INTEGER;
    messages_per_conversation RECORD;
BEGIN
    -- Count totals
    SELECT COUNT(*) INTO total_users FROM users;
    SELECT COUNT(*) INTO total_conversations FROM conversations;
    SELECT COUNT(*) INTO total_messages FROM messages;
    
    -- Count orphaned messages (messages with conversation_id that doesn't exist)
    SELECT COUNT(*) INTO orphaned_messages
    FROM messages m
    LEFT JOIN conversations c ON m.conversation_id = c.id
    WHERE c.id IS NULL;
    
    -- Count conversations without messages
    SELECT COUNT(*) INTO conversations_without_messages
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE m.id IS NULL;
    
    RAISE NOTICE '=== CURRENT DATABASE STATE ===';
    RAISE NOTICE 'Users: %', total_users;
    RAISE NOTICE 'Conversations: %', total_conversations;
    RAISE NOTICE 'Messages: %', total_messages;
    RAISE NOTICE 'Orphaned messages (bad conversation_id): %', orphaned_messages;
    RAISE NOTICE 'Empty conversations: %', conversations_without_messages;
    
    -- Show message distribution per conversation
    RAISE NOTICE '=== MESSAGES PER CONVERSATION ===';
    FOR messages_per_conversation IN
        SELECT 
            c.id,
            c.title,
            c.user_id,
            COUNT(m.id) as message_count,
            u.email as user_email
        FROM conversations c
        LEFT JOIN messages m ON c.id = m.conversation_id
        LEFT JOIN users u ON c.user_id = u.id
        GROUP BY c.id, c.title, c.user_id, u.email
        ORDER BY COUNT(m.id) DESC
    LOOP
        RAISE NOTICE 'Conversation % (%) - User: % - Messages: %', 
            SUBSTRING(messages_per_conversation.id::text, 1, 8),
            messages_per_conversation.title,
            messages_per_conversation.user_email,
            messages_per_conversation.message_count;
    END LOOP;
END $$;

-- 2. SHOW SAMPLE DATA FOR DEBUGGING
DO $$
DECLARE
    sample_record RECORD;
BEGIN
    RAISE NOTICE '=== SAMPLE CONVERSATIONS WITH MESSAGES ===';
    
    FOR sample_record IN
        SELECT 
            c.id as conv_id,
            c.title,
            c.user_id,
            u.email,
            m.id as msg_id,
            m.role,
            LEFT(m.content, 50) as content_preview,
            m.created_at as msg_created
        FROM conversations c
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN messages m ON c.id = m.conversation_id
        ORDER BY c.created_at DESC, m.created_at ASC
        LIMIT 10
    LOOP
        IF sample_record.msg_id IS NOT NULL THEN
            RAISE NOTICE 'Conv: % | User: % | Msg: % | Role: % | Content: %...', 
                SUBSTRING(sample_record.conv_id::text, 1, 8),
                sample_record.email,
                SUBSTRING(sample_record.msg_id::text, 1, 8),
                sample_record.role,
                sample_record.content_preview;
        ELSE
            RAISE NOTICE 'Conv: % | User: % | NO MESSAGES',
                SUBSTRING(sample_record.conv_id::text, 1, 8),
                sample_record.email;
        END IF;
    END LOOP;
END $$;

-- 3. FIX ORPHANED MESSAGES
-- Create conversations for any orphaned messages
DO $$
DECLARE
    orphaned_msg RECORD;
    new_conversation_id UUID;
    fallback_user_id UUID;
    fixed_count INTEGER := 0;
BEGIN
    -- Get the first user as fallback
    SELECT id INTO fallback_user_id FROM users ORDER BY created_at LIMIT 1;
    
    IF fallback_user_id IS NULL THEN
        RAISE EXCEPTION 'No users found! Cannot fix orphaned messages.';
    END IF;
    
    -- Process orphaned messages
    FOR orphaned_msg IN
        SELECT m.*
        FROM messages m
        LEFT JOIN conversations c ON m.conversation_id = c.id
        WHERE c.id IS NULL
    LOOP
        -- Create a new conversation for this orphaned message
        INSERT INTO conversations (user_id, title, created_at, updated_at)
        VALUES (
            fallback_user_id,
            'Recovered Chat',
            orphaned_msg.created_at,
            orphaned_msg.created_at
        )
        RETURNING id INTO new_conversation_id;
        
        -- Update the message to point to the new conversation
        UPDATE messages 
        SET conversation_id = new_conversation_id
        WHERE id = orphaned_msg.id;
        
        fixed_count := fixed_count + 1;
        
        RAISE NOTICE 'Fixed orphaned message % by creating conversation %',
            SUBSTRING(orphaned_msg.id::text, 1, 8),
            SUBSTRING(new_conversation_id::text, 1, 8);
    END LOOP;
    
    RAISE NOTICE 'Fixed % orphaned messages', fixed_count;
END $$;

-- 4. ENSURE PROPER FOREIGN KEY CONSTRAINTS
-- Drop and recreate the foreign key constraint to ensure it's properly enforced
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_conversation_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_conversation_id_fkey 
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

-- 5. CREATE OPTIMIZED INDEXES
DROP INDEX IF EXISTS idx_messages_conversation_id_ordered;
DROP INDEX IF EXISTS idx_conversations_user_recent;

CREATE INDEX idx_messages_conversation_id_ordered ON messages(conversation_id, created_at ASC);
CREATE INDEX idx_conversations_user_recent ON conversations(user_id, updated_at DESC);

-- 6. CREATE HELPER FUNCTION FOR DEBUGGING
CREATE OR REPLACE FUNCTION debug_conversation_messages(p_conversation_id UUID)
RETURNS TABLE(
    conversation_id UUID,
    conversation_title TEXT,
    user_email TEXT,
    message_id UUID,
    message_role TEXT,
    message_content TEXT,
    message_created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as conversation_id,
        c.title as conversation_title,
        u.email as user_email,
        m.id as message_id,
        m.role as message_role,
        m.content as message_content,
        m.created_at as message_created_at
    FROM conversations c
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE c.id = p_conversation_id
    ORDER BY m.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- 7. CREATE FUNCTION TO GET ALL MESSAGES FOR A CONVERSATION
CREATE OR REPLACE FUNCTION get_conversation_messages(
    p_conversation_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    conversation_id UUID,
    content TEXT,
    role TEXT,
    audio_url TEXT,
    lipsync_data JSONB,
    facial_expression TEXT,
    animation TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    -- Verify conversation belongs to user (if user_id provided)
    IF p_user_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM conversations 
            WHERE id = p_conversation_id AND user_id = p_user_id
        ) THEN
            RAISE EXCEPTION 'Conversation % not found or does not belong to user %', 
                p_conversation_id, p_user_id;
        END IF;
    END IF;
    
    -- Return messages in chronological order
    RETURN QUERY
    SELECT 
        m.id,
        m.conversation_id,
        m.content,
        m.role,
        m.audio_url,
        m.lipsync_data,
        m.facial_expression,
        m.animation,
        m.created_at
    FROM messages m
    WHERE m.conversation_id = p_conversation_id
    ORDER BY m.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- 8. FINAL VERIFICATION
DO $$
DECLARE
    total_conversations INTEGER;
    total_messages INTEGER;
    orphaned_messages INTEGER;
    avg_messages_per_conv NUMERIC;
BEGIN
    SELECT COUNT(*) INTO total_conversations FROM conversations;
    SELECT COUNT(*) INTO total_messages FROM messages;
    
    SELECT COUNT(*) INTO orphaned_messages
    FROM messages m
    LEFT JOIN conversations c ON m.conversation_id = c.id
    WHERE c.id IS NULL;
    
    SELECT ROUND(AVG(msg_count), 2) INTO avg_messages_per_conv
    FROM (
        SELECT COUNT(m.id) as msg_count
        FROM conversations c
        LEFT JOIN messages m ON c.id = m.conversation_id
        GROUP BY c.id
    ) sub;
    
    RAISE NOTICE '=== FINAL VERIFICATION ===';
    RAISE NOTICE 'Total conversations: %', total_conversations;
    RAISE NOTICE 'Total messages: %', total_messages;
    RAISE NOTICE 'Orphaned messages: %', orphaned_messages;
    RAISE NOTICE 'Average messages per conversation: %', avg_messages_per_conv;
    
    IF orphaned_messages = 0 THEN
        RAISE NOTICE 'SUCCESS: All messages are properly linked to conversations!';
    ELSE
        RAISE EXCEPTION 'FAILED: Still have % orphaned messages!', orphaned_messages;
    END IF;
END $$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION debug_conversation_messages(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_conversation_messages(UUID, UUID) TO service_role;

RAISE NOTICE 'Migration completed: Conversation-Message relationships fixed!';
