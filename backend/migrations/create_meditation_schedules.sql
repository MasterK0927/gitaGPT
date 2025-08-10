-- Create meditation schedules table
CREATE TABLE IF NOT EXISTS meditation_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 10,
    frequency VARCHAR(50) NOT NULL DEFAULT 'daily', -- daily, weekly, custom
    days_of_week INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6,7], -- 1=Monday, 7=Sunday
    time_of_day TIME NOT NULL,
    timezone VARCHAR(100) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT true,
    reminder_enabled BOOLEAN DEFAULT true,
    reminder_minutes_before INTEGER DEFAULT 10,
    meditation_type VARCHAR(100) DEFAULT 'mindfulness', -- mindfulness, breathing, guided, etc.
    background_sound VARCHAR(100), -- nature, silence, bells, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create meditation sessions table (for tracking completed sessions)
CREATE TABLE IF NOT EXISTS meditation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES meditation_schedules(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    meditation_type VARCHAR(100) NOT NULL,
    background_sound VARCHAR(100),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    is_completed BOOLEAN DEFAULT false,
    notes TEXT,
    mood_before VARCHAR(50), -- calm, anxious, stressed, peaceful, etc.
    mood_after VARCHAR(50),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 1-5 stars
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_meditation_schedules_user_id ON meditation_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_meditation_schedules_active ON meditation_schedules(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_meditation_schedules_time ON meditation_schedules(time_of_day);
CREATE INDEX IF NOT EXISTS idx_meditation_sessions_user_id ON meditation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_meditation_sessions_schedule_id ON meditation_sessions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_meditation_sessions_date ON meditation_sessions(started_at);

-- Create updated_at trigger for meditation_schedules
CREATE OR REPLACE FUNCTION update_meditation_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_meditation_schedules_updated_at
    BEFORE UPDATE ON meditation_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_meditation_schedules_updated_at();

-- Insert some default meditation types and sounds (optional)
CREATE TABLE IF NOT EXISTS meditation_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    default_duration INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meditation_sounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default meditation types
INSERT INTO meditation_types (name, description, default_duration) VALUES
('Mindfulness', 'Focus on present moment awareness', 15),
('Breathing', 'Concentrate on breath patterns', 10),
('Body Scan', 'Progressive relaxation through body awareness', 20),
('Loving Kindness', 'Cultivate compassion and goodwill', 15),
('Walking', 'Mindful movement meditation', 10),
('Mantra', 'Repetition of sacred sounds or phrases', 12),
('Visualization', 'Guided imagery and mental visualization', 18)
ON CONFLICT (name) DO NOTHING;

-- Insert default background sounds
INSERT INTO meditation_sounds (name, description) VALUES
('Silence', 'Complete silence for focused meditation'),
('Nature Sounds', 'Gentle sounds of nature - birds, water, wind'),
('Tibetan Bells', 'Traditional meditation bells'),
('Ocean Waves', 'Calming ocean wave sounds'),
('Rain', 'Gentle rainfall sounds'),
('Forest', 'Peaceful forest ambiance'),
('White Noise', 'Consistent background noise for focus')
ON CONFLICT (name) DO NOTHING;
