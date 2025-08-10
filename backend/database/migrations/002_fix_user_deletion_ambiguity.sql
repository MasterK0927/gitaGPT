-- Migration: Fix ambiguous column reference in user deletion functions
-- Date: 2025-07-22
-- Description: Fix the "column reference user_id is ambiguous" error in soft_delete_user function

-- Fix the existing function by adding table aliases to resolve ambiguity
CREATE OR REPLACE FUNCTION soft_delete_user(user_id UUID, reason TEXT DEFAULT 'User requested deletion')
RETURNS BOOLEAN AS $$
BEGIN
    -- Mark user for deletion (use table alias to avoid ambiguity)
    UPDATE users u
    SET
        deleted_at = NOW(),
        deletion_scheduled_at = NOW() + INTERVAL '30 days',
        deletion_reason = reason,
        updated_at = NOW()
    WHERE u.id = user_id AND u.deleted_at IS NULL;

    -- Soft delete all user's conversations (use table alias to avoid ambiguity)
    UPDATE conversations c
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE c.user_id = user_id AND c.deleted_at IS NULL;

    RETURN FOUND;
END;
$$ language 'plpgsql';

-- Fix the restore function with table aliases
CREATE OR REPLACE FUNCTION restore_user_account(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Restore user account (use table alias to avoid ambiguity)
    UPDATE users u
    SET
        deleted_at = NULL,
        deletion_scheduled_at = NULL,
        deletion_reason = NULL,
        updated_at = NOW()
    WHERE u.id = user_id AND u.deleted_at IS NOT NULL;

    -- Restore user's conversations (use table alias to avoid ambiguity)
    UPDATE conversations c
    SET deleted_at = NULL, updated_at = NOW()
    WHERE c.user_id = user_id AND c.deleted_at IS NOT NULL;

    RETURN FOUND;
END;
$$ language 'plpgsql';

-- Grant permissions (functions keep same signature)
GRANT EXECUTE ON FUNCTION soft_delete_user(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION restore_user_account(UUID) TO service_role;
