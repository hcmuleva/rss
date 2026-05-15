/**
 * =====================================================================
 * Migration: Add member_type to user_temples
 * Created: 2026-04-08
 * =====================================================================
 * Tracks whether user is from society or external to temple
 */

-- Add member_type column
ALTER TABLE user_temples 
ADD COLUMN IF NOT EXISTS member_type VARCHAR(30) DEFAULT 'society_member';

-- Add check constraint
ALTER TABLE user_temples
ADD CONSTRAINT user_temples_member_type_check 
CHECK (member_type IN ('society_member', 'external_to_temple'));

-- Add comment
COMMENT ON COLUMN user_temples.member_type IS 'Type of member: society_member (from Seervi society) or external_to_temple (external participant)';

-- Update existing records to be society members by default
UPDATE user_temples 
SET member_type = 'society_member' 
WHERE member_type IS NULL;

COMMIT;
