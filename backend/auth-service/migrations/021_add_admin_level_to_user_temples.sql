-- =====================================================================
-- Migration: Add admin_level column to user_temples table
-- Company: emeelan
-- Date: 2024-04-11
-- =====================================================================

-- Add admin_level column to user_temples table
ALTER TABLE user_temples 
ADD COLUMN IF NOT EXISTS admin_level VARCHAR(50) DEFAULT 'temple';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_temples_admin_level ON user_temples(admin_level);

-- Add comment to column
COMMENT ON COLUMN user_temples.admin_level IS 'Admin hierarchy level: temple, village, tehsil, district';

-- Update existing records to have 'temple' as default admin_level
UPDATE user_temples 
SET admin_level = 'temple' 
WHERE admin_level IS NULL;
