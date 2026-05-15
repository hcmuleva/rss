/**
 * =====================================================================
 * Migration: Add family_type to families table
 * Created: 2026-04-08
 * =====================================================================
 * Adds family_type column to distinguish regular families from external members
 */

-- Add family_type column
ALTER TABLE families 
ADD COLUMN IF NOT EXISTS family_type VARCHAR(20) DEFAULT 'regular';

-- Add check constraint
ALTER TABLE families
ADD CONSTRAINT families_family_type_check 
CHECK (family_type IN ('regular', 'external_members'));

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_families_type ON families(family_type);

-- Add comment
COMMENT ON COLUMN families.family_type IS 'Type of family: regular (traditional families) or external_members (community participants not in family structure)';

-- Update existing families to be regular
UPDATE families 
SET family_type = 'regular' 
WHERE family_type IS NULL;

COMMIT;
