-- Migration: Redesign Conversation Schema for Proper Message Threading
-- New hierarchy: user → conversation → user_message → ai_responses[]

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BACKUP EXISTING DATA
CREATE TABLE IF NOT EXISTS backup_conversations AS SELECT * FROM conversations;
CREATE TABLE IF NOT EXISTS backup_messages AS SELECT * FROM messages;

RAISE NOTICE 'Backed up existing data to backup_conversations and backup_messages';

-- 2. CREATE NEW SCHEMA

-- Users table (unchanged)
-- conversations table (unchanged - just holds conversation metadata)

-- User Messages table - each user input creates one record
CREATE TABLE IF NOT EXISTS user_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Responses table - multiple AI responses per user message
CREATE TABLE IF NOT EXISTS ai_responses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_message_id UUID NOT NULL REFERENCES user_messages(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    audio_url TEXT,
    lipsync_data JSONB,
    facial_expression TEXT,
    animation TEXT,
    processing_mode TEXT DEFAULT 'standard',
    response_order INTEGER DEFAULT 1, -- For multiple responses to same user message
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CREATE INDEXES
CREATE INDEX idx_user_messages_conversation ON user_messages(conversation_id, created_at);
CREATE INDEX idx_ai_responses_user_message ON ai_responses(user_message_id, response_order);
CREATE INDEX idx_conversations_user_updated ON conversations(user_id, updated_at DESC);

-- 4. MIGRATE EXISTING DATA
DO $$
DECLARE
    conv_record RECORD;
    msg_record RECORD;
    current_user_message_id UUID;
    message_count INTEGER := 0;
    user_message_count INTEGER := 0;
    ai_response_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting data migration...';
    
    -- Process each conversation
    FOR conv_record IN SELECT * FROM conversations ORDER BY created_at LOOP
        RAISE NOTICE 'Processing conversation: % (%)', conv_record.id, conv_record.title;
        
        current_user_message_id := NULL;
        
        -- Process messages in chronological order
        FOR msg_record IN 
            SELECT * FROM messages 
            WHERE conversation_id = conv_record.id 
            ORDER BY created_at ASC 
        LOOP
            message_count := message_count + 1;
            
            IF msg_record.role = 'user' THEN
                -- Create new user message
                INSERT INTO user_messages (id, conversation_id, content, created_at, updated_at)
                VALUES (
                    uuid_generate_v4(),
                    conv_record.id,
                    msg_record.content,
                    msg_record.created_at,
                    msg_record.created_at
                )
                RETURNING id INTO current_user_message_id;
                
                user_message_count := user_message_count + 1;
                RAISE NOTICE '  Created user message: %', current_user_message_id;
                
            ELSIF msg_record.role = 'assistant' AND current_user_message_id IS NOT NULL THEN
                -- Create AI response linked to the current user message
                INSERT INTO ai_responses (
                    user_message_id,
                    content,
                    audio_url,
                    lipsync_data,
                    facial_expression,
                    animation,
                    response_order,
                    created_at
                )
                VALUES (
                    current_user_message_id,
                    msg_record.content,
                    msg_record.audio_url,
                    msg_record.lipsync_data,
                    msg_record.facial_expression,
                    msg_record.animation,
                    1, -- First response
                    msg_record.created_at
                );
                
                ai_response_count := ai_response_count + 1;
                RAISE NOTICE '  Created AI response for user message: %', current_user_message_id;
                
            ELSE
                RAISE NOTICE '  Skipping orphaned assistant message: %', msg_record.id;
            END IF;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Migration completed:';
    RAISE NOTICE '- Processed messages: %', message_count;
    RAISE NOTICE '- Created user messages: %', user_message_count;
    RAISE NOTICE '- Created AI responses: %', ai_response_count;
END $$;

-- 5. CREATE VIEWS FOR EASY QUERYING

-- View: Conversation with message counts
CREATE OR REPLACE VIEW conversation_summary AS
SELECT 
    c.id,
    c.user_id,
    c.title,
    c.created_at,
    c.updated_at,
    u.email as user_email,
    u.name as user_name,
    COUNT(DISTINCT um.id) as user_message_count,
    COUNT(ar.id) as ai_response_count,
    COUNT(DISTINCT um.id) + COUNT(ar.id) as total_message_count,
    MAX(GREATEST(um.created_at, ar.created_at)) as last_message_at,
    (SELECT um2.content FROM user_messages um2 WHERE um2.conversation_id = c.id ORDER BY um2.created_at LIMIT 1) as first_user_message
FROM conversations c
LEFT JOIN users u ON c.user_id = u.id
LEFT JOIN user_messages um ON c.id = um.conversation_id
LEFT JOIN ai_responses ar ON um.id = ar.user_message_id
GROUP BY c.id, c.user_id, c.title, c.created_at, c.updated_at, u.email, u.name;

-- View: Full conversation thread
CREATE OR REPLACE VIEW conversation_thread AS
SELECT 
    c.id as conversation_id,
    c.title as conversation_title,
    c.user_id,
    um.id as user_message_id,
    um.content as user_message_content,
    um.created_at as user_message_created_at,
    ar.id as ai_response_id,
    ar.content as ai_response_content,
    ar.audio_url,
    ar.lipsync_data,
    ar.facial_expression,
    ar.animation,
    ar.response_order,
    ar.created_at as ai_response_created_at
FROM conversations c
LEFT JOIN user_messages um ON c.id = um.conversation_id
LEFT JOIN ai_responses ar ON um.id = ar.user_message_id
ORDER BY c.id, um.created_at, ar.response_order;

-- 6. CREATE FUNCTIONS FOR API

-- Function: Get conversation with threaded messages
CREATE OR REPLACE FUNCTION get_conversation_thread(
    p_conversation_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
    conversation_id UUID,
    conversation_title TEXT,
    user_message_id UUID,
    user_message_content TEXT,
    user_message_created_at TIMESTAMPTZ,
    ai_responses JSONB
) AS $$
BEGIN
    -- Verify conversation belongs to user
    IF p_user_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM conversations WHERE id = p_conversation_id AND user_id = p_user_id) THEN
            RAISE EXCEPTION 'Conversation not found or access denied';
        END IF;
    END IF;
    
    RETURN QUERY
    SELECT 
        c.id as conversation_id,
        c.title as conversation_title,
        um.id as user_message_id,
        um.content as user_message_content,
        um.created_at as user_message_created_at,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', ar.id,
                    'content', ar.content,
                    'audio_url', ar.audio_url,
                    'lipsync_data', ar.lipsync_data,
                    'facial_expression', ar.facial_expression,
                    'animation', ar.animation,
                    'response_order', ar.response_order,
                    'created_at', ar.created_at
                ) ORDER BY ar.response_order
            ) FILTER (WHERE ar.id IS NOT NULL),
            '[]'::jsonb
        ) as ai_responses
    FROM conversations c
    LEFT JOIN user_messages um ON c.id = um.conversation_id
    LEFT JOIN ai_responses ar ON um.id = ar.user_message_id
    WHERE c.id = p_conversation_id
    GROUP BY c.id, c.title, um.id, um.content, um.created_at
    ORDER BY um.created_at;
END;
$$ LANGUAGE plpgsql;

-- Function: Get user conversations with summary
CREATE OR REPLACE FUNCTION get_user_conversations(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
    id UUID,
    title TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    user_message_count BIGINT,
    ai_response_count BIGINT,
    total_message_count BIGINT,
    last_message_at TIMESTAMPTZ,
    first_user_message TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM conversation_summary
    WHERE user_id = p_user_id
    ORDER BY updated_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 7. CREATE TRIGGERS

-- Update conversation timestamp when user message is added
CREATE OR REPLACE FUNCTION update_conversation_on_user_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update conversation timestamp when AI response is added
CREATE OR REPLACE FUNCTION update_conversation_on_ai_response()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET updated_at = NOW()
    WHERE id = (SELECT conversation_id FROM user_messages WHERE id = NEW.user_message_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_update_conversation_on_user_message ON user_messages;
DROP TRIGGER IF EXISTS trigger_update_conversation_on_ai_response ON ai_responses;

CREATE TRIGGER trigger_update_conversation_on_user_message
    AFTER INSERT OR UPDATE ON user_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_on_user_message();

CREATE TRIGGER trigger_update_conversation_on_ai_response
    AFTER INSERT OR UPDATE ON ai_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_on_ai_response();

-- 8. GRANT PERMISSIONS
GRANT SELECT ON conversation_summary TO service_role;
GRANT SELECT ON conversation_thread TO service_role;
GRANT EXECUTE ON FUNCTION get_conversation_thread(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_user_conversations(UUID, INTEGER) TO service_role;

-- 9. ADD COMMENTS
COMMENT ON TABLE user_messages IS 'Individual user inputs in conversations';
COMMENT ON TABLE ai_responses IS 'AI responses to user messages (can be multiple per user message)';
COMMENT ON VIEW conversation_summary IS 'Conversation metadata with message counts';
COMMENT ON VIEW conversation_thread IS 'Full conversation with threaded messages';

RAISE NOTICE 'Schema redesign completed successfully!';
RAISE NOTICE 'New tables: user_messages, ai_responses';
RAISE NOTICE 'New views: conversation_summary, conversation_thread';
RAISE NOTICE 'New functions: get_conversation_thread, get_user_conversations';
