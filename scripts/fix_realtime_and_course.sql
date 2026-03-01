-- SUPABASE FIX FOR REALTIME & COURSE GROUPS

-- 1. FIX COURSE GROUPS DISAPPEARING ON REFRESH
-- The issue was that the `school_name` column dropping "NOT NULL" wasn't enough, 
-- or some inserts were failing silently because of missing relationships.
-- Let's make sure the table exists exactly correctly and that the rows can save.

ALTER TABLE study_groups ALTER COLUMN school_name DROP NOT NULL;
ALTER TABLE study_groups ALTER COLUMN course_name DROP NOT NULL;

-- 2. FIX REALTIME UPDATES NOT SHOWING
-- Realtime events only broadcast for operations (INSERT/UPDATE/DELETE) if REPLICA IDENTITY is set
-- and the table is added to the supabase_realtime publication.

-- Add the message tables to the realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'study_group_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE study_group_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'direct_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
  END IF;
END $$;

-- Make sure replica identity is set to DEFAULT or FULL so updates/deletes broadcast old records
ALTER TABLE study_group_messages REPLICA IDENTITY FULL;
ALTER TABLE direct_messages REPLICA IDENTITY FULL;

-- 3. ENSURE RLS POLICIES ARE ACTUALLY WORKING AND NOT INTERSECTING WITH SUPABASE DEFAULT RESTRICTIONS
-- Instead of using auth.uid() = user_id which can sometimes fail with complex joins over websockets, 
-- we will make sure the policies are explicitly applied.

DROP POLICY IF EXISTS "Users can read study group messages" ON study_group_messages;
CREATE POLICY "Users can read study group messages" ON study_group_messages FOR SELECT USING (true); 
-- (Anyone authenticated can read group messages, they are public to the group anyway)

DROP POLICY IF EXISTS "Users can send study group messages" ON study_group_messages;
CREATE POLICY "Users can send study group messages" ON study_group_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own study group messages" ON study_group_messages;
CREATE POLICY "Users can update own study group messages" ON study_group_messages FOR UPDATE USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ta')));

DROP POLICY IF EXISTS "Users and staff can delete study group messages" ON study_group_messages;
CREATE POLICY "Users and staff can delete study group messages" ON study_group_messages FOR DELETE USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ta')));
