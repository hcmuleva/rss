-- Migration 012: Add photo_url and professions to users table
-- Date: 2026-04-08
-- Purpose: Support photo upload and multiple professions for members

-- Add photo_url column
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500);

-- Add professions column (array of text)
ALTER TABLE users ADD COLUMN IF NOT EXISTS professions TEXT[];

-- Create index for better search performance
CREATE INDEX IF NOT EXISTS idx_users_professions ON users USING GIN (professions);

-- Add comment
COMMENT ON COLUMN users.photo_url IS 'URL to user profile photo (S3 or CDN)';
COMMENT ON COLUMN users.professions IS 'Array of user professions (e.g., ["Doctor", "Businessman"])';
