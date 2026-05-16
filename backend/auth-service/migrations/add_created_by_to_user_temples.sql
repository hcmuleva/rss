-- Migration: Add created_by column to user_temples table for contribution tracking
-- Date: 2026-04-11
-- Purpose: Track who assigned admins to temples

-- Add created_by column to user_temples
ALTER TABLE user_temples 
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_user_temples_created_by ON user_temples(created_by);

-- Add comment
COMMENT ON COLUMN user_temples.created_by IS 'User who created this admin assignment (for contribution tracking)';

-- Update existing records to set created_by to the user who assigned (if admin_level is temple)
-- For now, set to NULL for existing records (can be updated later if needed)
UPDATE user_temples 
SET created_by = NULL 
WHERE created_by IS NULL;

-- Add indexes for contribution queries
CREATE INDEX IF NOT EXISTS idx_temples_created_by ON temples(created_by);
CREATE INDEX IF NOT EXISTS idx_families_created_by ON families(created_by);
CREATE INDEX IF NOT EXISTS idx_family_members_created_by ON family_members(created_by);

-- Verify indexes
SELECT 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename IN ('user_temples', 'temples', 'families', 'family_members')
  AND indexname LIKE '%created_by%'
ORDER BY tablename, indexname;
