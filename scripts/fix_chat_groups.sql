-- Fix study_groups allowing course_name without school_name
ALTER TABLE study_groups ALTER COLUMN school_name DROP NOT NULL;

-- Direct Messages RLS for UPDATE and DELETE
DROP POLICY IF EXISTS "Users can update own direct messages" ON direct_messages;
CREATE POLICY "Users can update own direct messages" ON direct_messages 
FOR UPDATE USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users and staff can delete direct messages" ON direct_messages;
CREATE POLICY "Users and staff can delete direct messages" ON direct_messages 
FOR DELETE USING (auth.uid() = sender_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ta')));

-- Study group messages RLS for UPDATE and DELETE
DROP POLICY IF EXISTS "Users can update own study group messages" ON study_group_messages;
CREATE POLICY "Users can update own study group messages" ON study_group_messages 
FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users and staff can delete study group messages" ON study_group_messages;
CREATE POLICY "Users and staff can delete study group messages" ON study_group_messages 
FOR DELETE USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ta')));
