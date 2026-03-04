-- Create topic_mastery table for the expansion cycle (R30, R60, R120)
CREATE TABLE IF NOT EXISTS public.topic_mastery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    current_interval INTEGER NOT NULL DEFAULT 0, -- Days: 0 (new), 30 (R30), 60 (R60)...
    status TEXT NOT NULL DEFAULT 'Learning', -- 'Learning', 'Reviewing', 'Mastered', 'Needs Focus'
    last_score INTEGER,
    last_reviewed_at TIMESTAMPTZ DEFAULT NOW(),
    next_review_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, topic)
);

-- Enable RLS
ALTER TABLE public.topic_mastery ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own topic mastery
CREATE POLICY "Users can manage their own topic mastery"
    ON public.topic_mastery FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);