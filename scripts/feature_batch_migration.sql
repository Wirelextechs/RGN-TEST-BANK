-- ===============================================
-- RGN TEST BANK - Feature Batch Migration
-- Run this entire script in Supabase SQL Editor
-- ===============================================

-- 1. Add new columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS device_session_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ;

-- 2. reply_to column (if not already added)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES messages(id);

-- 3. Add message_type and media_url to messages for rich media
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT;

-- 4. Direct Messages table (Student <-> Admin 1-on-1)
CREATE TABLE IF NOT EXISTS direct_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID REFERENCES profiles(id) NOT NULL,
    receiver_id UUID REFERENCES profiles(id) NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    media_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Study Groups table (one per school)
CREATE TABLE IF NOT EXISTS study_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Study Group Messages
CREATE TABLE IF NOT EXISTS study_group_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES study_groups(id) NOT NULL,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    media_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Polls table
CREATE TABLE IF NOT EXISTS polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]',
    created_by UUID REFERENCES profiles(id) NOT NULL,
    lesson_id UUID,
    group_id UUID REFERENCES study_groups(id),
    chat_type TEXT DEFAULT 'main',
    is_closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Poll Votes
CREATE TABLE IF NOT EXISTS poll_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID REFERENCES polls(id) NOT NULL,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    option_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(poll_id, user_id)
);

-- 9. Payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'GHS',
    reference TEXT UNIQUE NOT NULL,
    paystack_reference TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ
);

-- 10. Platform Settings table (key-value store)
CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO platform_settings (key, value) VALUES
    ('paywall_enabled', 'false'),
    ('premium_price', '50'),
    ('sms_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- 11. Enable RLS on new tables
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- 12. RLS Policies
-- Direct messages: sender or receiver can read
CREATE POLICY "Users can read own direct messages" ON direct_messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send direct messages" ON direct_messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update own direct messages" ON direct_messages
    FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Study groups: all authenticated can read
CREATE POLICY "Authenticated users can read study groups" ON study_groups
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage study groups" ON study_groups
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Study group messages: all authenticated
CREATE POLICY "Users can read study group messages" ON study_group_messages
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can send study group messages" ON study_group_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Polls: all authenticated can read
CREATE POLICY "Users can read polls" ON polls
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create polls" ON polls
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Poll votes: all authenticated can read
CREATE POLICY "Users can read poll votes" ON poll_votes
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can vote" ON poll_votes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Payments: users see own, admins see all
CREATE POLICY "Users can read own payments" ON payments
    FOR SELECT USING (auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "System can insert payments" ON payments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Platform settings: all can read, admins can update
CREATE POLICY "All can read settings" ON platform_settings
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can update settings" ON platform_settings
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 13. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_receiver ON direct_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_dm_created ON direct_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_sgm_group ON study_group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_sgm_created ON study_group_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_polls_lesson ON polls(lesson_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_school ON profiles(school);
CREATE INDEX IF NOT EXISTS idx_profiles_device ON profiles(device_session_id);

-- 14. Enable realtime on new tables
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE study_group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE polls;
ALTER PUBLICATION supabase_realtime ADD TABLE poll_votes;

-- Done!
