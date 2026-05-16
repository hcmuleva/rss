/**
 * =====================================================================
 * Migration: Add Profile Fields to Users Table
 * Date: 2026-04-06
 * Description: Add missing fields required for profile management
 * =====================================================================
 */

-- Add missing profile fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(15);
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Update father_name column comment
COMMENT ON COLUMN users.father_name IS 'Father name (will be mapped to last_name in profile APIs)';
COMMENT ON COLUMN users.last_name IS 'Last name / Surname';
COMMENT ON COLUMN users.middle_name IS 'Middle name (optional)';
COMMENT ON COLUMN users.phone IS 'Contact phone number';
COMMENT ON COLUMN users.gender IS 'Gender: Male, Female, Other';
COMMENT ON COLUMN users.marital_status IS 'Marital Status: Single, Married, Divorced, Widowed';
COMMENT ON COLUMN users.profile_photo_url IS 'Profile photo URL (S3 or local storage)';

-- Verify columns added
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN (
    'middle_name', 
    'last_name', 
    'phone', 
    'gender', 
    'marital_status', 
    'profile_photo_url'
  )
ORDER BY column_name;
