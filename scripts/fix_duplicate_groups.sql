-- SUPABASE FIX FOR DUPLICATING COURSE GROUPS 
-- Dropping the unique constraint allowed the chat API to work, but without it,
-- every single time someone loads the page, a NEW "RGN" group is being created in the database!
-- That is why messages disappear on refresh—you're being put into a brand new empty group every time.

-- 1. DELETE ALL DUPLICATE STUDY GROUPS KEEPING ONLY THE OLDEST ONE FOR EACH COURSE
DELETE FROM study_groups a USING (
    SELECT MIN(created_at) as first_created, course_name
    FROM study_groups
    WHERE group_type = 'course'
    GROUP BY course_name
    HAVING COUNT(*) > 1
) b
WHERE a.course_name = b.course_name 
  AND a.group_type = 'course'
  AND a.created_at > b.first_created;

DELETE FROM study_groups a USING (
    SELECT MIN(created_at) as first_created, school_name
    FROM study_groups
    WHERE group_type = 'school'
    GROUP BY school_name
    HAVING COUNT(*) > 1
) b
WHERE a.school_name = b.school_name 
  AND a.group_type = 'school'
  AND a.created_at > b.first_created;


-- 2. CREATE A UNIQUE INDEX THAT PREVENTS DUPLICATES *PROPERLY*
-- Instead of making the single column "school_name" unique globally, 
-- we make the COMBINATION of group_type + name completely unique.

-- Drop any accidental specific column uniques just in case
ALTER TABLE study_groups DROP CONSTRAINT IF EXISTS study_groups_school_name_key;
ALTER TABLE study_groups DROP CONSTRAINT IF EXISTS study_groups_course_name_key;

-- Create the correct multi-column unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS unique_school_group ON study_groups (school_name) WHERE group_type = 'school';
CREATE UNIQUE INDEX IF NOT EXISTS unique_course_group ON study_groups (course_name) WHERE group_type = 'course';

-- 3. ENSURE MESSAGES TABLES RLS POLICIES ARE NOT BLOCKING READS
DROP POLICY IF EXISTS "Users can read study group messages" ON study_group_messages;
CREATE POLICY "Users can read study group messages" ON study_group_messages FOR SELECT USING (true); 
