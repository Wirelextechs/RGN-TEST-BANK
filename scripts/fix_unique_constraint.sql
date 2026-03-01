-- SUPABASE FIX FOR UNIQUE CONSTRAINT BLOCKING COURSE GROUPS

-- The database is throwing:
-- "duplicate key value violates unique constraint 'study_groups_school_name_key'"
-- This means that the `school_name` column accidentally has a UNIQUE constraint on it,
-- meaning no two groups can have the same school name, and our fallback "Global Course Group"
-- is crashing because it already exists for another course.

-- 1. Drop the unique constraint on school_name
ALTER TABLE study_groups DROP CONSTRAINT IF EXISTS study_groups_school_name_key;

-- 2. Drop the unique constraint on course_name (just in case it also exists)
ALTER TABLE study_groups DROP CONSTRAINT IF EXISTS study_groups_course_name_key;

-- 3. To prevent duplicate pairs (e.g. multiple "University of Ghana" school groups),
-- we should ensure a unique constraint only exists on the COMBINATION of name and type.
-- But for now, dropping the strict single-column unique constraints will fix the API crash.
