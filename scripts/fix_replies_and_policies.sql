-- 1. Ensure course groups can be created by dropping the NOT NULL constraint
ALTER TABLE study_groups ALTER COLUMN school_name DROP NOT NULL;

-- 2. Add reply_to columns
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES direct_messages(id) ON DELETE SET NULL;
ALTER TABLE study_group_messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES study_group_messages(id) ON DELETE SET NULL;

-- 3. Reset and recreate robust RLS policies for direct_messages
DROP POLICY IF EXISTS "Users can read own direct messages" ON direct_messages;
CREATE POLICY "Users can read own direct messages" ON direct_messages 
FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send direct messages" ON direct_messages;
CREATE POLICY "Users can send direct messages" ON direct_messages 
FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update own direct messages" ON direct_messages;
CREATE POLICY "Users can update own direct messages" ON direct_messages 
FOR UPDATE USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users and staff can delete direct messages" ON direct_messages;
CREATE POLICY "Users and staff can delete direct messages" ON direct_messages 
FOR DELETE USING (auth.uid() = sender_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ta')));

-- 4. Reset and recreate robust RLS policies for study_group_messages
DROP POLICY IF EXISTS "Users can read study group messages" ON study_group_messages;
CREATE POLICY "Users can read study group messages" ON study_group_messages 
FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can send study group messages" ON study_group_messages;
CREATE POLICY "Users can send study group messages" ON study_group_messages 
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own study group messages" ON study_group_messages;
CREATE POLICY "Users can update own study group messages" ON study_group_messages 
FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users and staff can delete study group messages" ON study_group_messages;
CREATE POLICY "Users and staff can delete study group messages" ON study_group_messages 
FOR DELETE USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ta')));
