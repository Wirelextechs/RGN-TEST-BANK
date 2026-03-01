-- SUPABASE FIX FOR DUPLICATING COURSE GROUPS 
-- Dropping the unique constraint allowed the chat API to work, but without it,
-- every single time someone loads the page, a NEW "RGN" group is being created in the database!
-- That is why messages disappear on refresh—you're being put into a brand new empty group every time.

-- 1. REASSIGN ALL MESSAGES IN DUPLICATE GROUPS TO THE OLDEST (PRIMARY) GROUP
-- This prevents the "violates foreign key constraint" error by moving the messages.

WITH FirstCourseGroups AS (
    SELECT DISTINCT ON (course_name) id, course_name
    FROM study_groups
    WHERE group_type = 'course'
    ORDER BY course_name, created_at ASC
)
UPDATE study_group_messages msg
SET group_id = fg.id
FROM study_groups dup
JOIN FirstCourseGroups fg ON dup.course_name = fg.course_name AND dup.id != fg.id
WHERE msg.group_id = dup.id AND dup.group_type = 'course';

WITH FirstSchoolGroups AS (
    SELECT DISTINCT ON (school_name) id, school_name
    FROM study_groups
    WHERE group_type = 'school'
    ORDER BY school_name, created_at ASC
)
UPDATE study_group_messages msg
SET group_id = fg.id
FROM study_groups dup
JOIN FirstSchoolGroups fg ON dup.school_name = fg.school_name AND dup.id != fg.id
WHERE msg.group_id = dup.id AND dup.group_type = 'school';

-- 2. DELETE ALL DUPLICATE STUDY GROUPS EXCEPT THE OLDEST ONE
DELETE FROM study_groups
WHERE id NOT IN (
    SELECT DISTINCT ON (course_name) id
    FROM study_groups
    WHERE group_type = 'course' AND course_name IS NOT NULL
    ORDER BY course_name, created_at ASC
) AND group_type = 'course';

DELETE FROM study_groups
WHERE id NOT IN (
    SELECT DISTINCT ON (school_name) id
    FROM study_groups
    WHERE group_type = 'school' AND school_name IS NOT NULL
    ORDER BY school_name, created_at ASC
) AND group_type = 'school';

-- 3. CREATE A UNIQUE INDEX THAT PREVENTS DUPLICATES *PROPERLY*
-- Instead of making the single column "school_name" unique globally, 
-- we make the COMBINATION of group_type + name completely unique.

-- Drop any accidental specific column uniques just in case
ALTER TABLE study_groups DROP CONSTRAINT IF EXISTS study_groups_school_name_key;
ALTER TABLE study_groups DROP CONSTRAINT IF EXISTS study_groups_course_name_key;

-- Create the correct multi-column unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS unique_school_group ON study_groups (school_name) WHERE group_type = 'school';
CREATE UNIQUE INDEX IF NOT EXISTS unique_course_group ON study_groups (course_name) WHERE group_type = 'course';

-- 4. ENSURE MESSAGES TABLES RLS POLICIES ARE NOT BLOCKING READS
DROP POLICY IF EXISTS "Users can read study group messages" ON study_group_messages;
CREATE POLICY "Users can read study group messages" ON study_group_messages FOR SELECT USING (true); 
