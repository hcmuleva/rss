/**
 * =====================================================================
 * Migration: Add photo_url to temple_groups
 * Created: 2026-04-08
 * =====================================================================
 * Adds photo/image support for each group/tab
 */

-- Add photo_url column
ALTER TABLE temple_groups 
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add comment
COMMENT ON COLUMN temple_groups.photo_url IS 'Group representative photo/image URL';

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_temple_groups_photo ON temple_groups(photo_url) WHERE photo_url IS NOT NULL;

COMMIT;
