-- Add email status columns to meditation_schedules table
ALTER TABLE meditation_schedules 
ADD COLUMN IF NOT EXISTS email_status VARCHAR(20) DEFAULT 'pending' CHECK (email_status IN ('pending', 'queued', 'sent', 'failed'));

ALTER TABLE meditation_schedules 
ADD COLUMN IF NOT EXISTS email_error TEXT;

-- Create index for email status queries
CREATE INDEX IF NOT EXISTS idx_meditation_schedules_email_status ON meditation_schedules(email_status);

-- Update existing records to have 'sent' status (assuming they were created before this feature)
UPDATE meditation_schedules 
SET email_status = 'sent' 
WHERE email_status IS NULL OR email_status = 'pending';
