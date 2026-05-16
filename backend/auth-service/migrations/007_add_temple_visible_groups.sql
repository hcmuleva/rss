/**
 * =====================================================================
 * Migration: Add Temple Visible Groups Settings
 * Created: 2026-04-07
 * =====================================================================
 * Allows each temple to control which groups are visible
 * E.g., Siwai Mandir can hide Dance and Business groups
 */

-- Add visible_groups column to temples table
ALTER TABLE temples 
ADD COLUMN IF NOT EXISTS visible_groups JSONB DEFAULT '["trustee", "business", "sanskar", "education", "agriculture", "ladies", "dance", "jobs", "cultural", "sports", "voting", "polling"]'::jsonb;

-- Add comment
COMMENT ON COLUMN temples.visible_groups IS 'Array of visible group types: ["trustee", "business", "sports", etc.]';

-- Update existing temples to have all groups visible by default
UPDATE temples 
SET visible_groups = '["trustee", "business", "sanskar", "education", "agriculture", "ladies", "dance", "jobs", "cultural", "sports", "voting", "polling"]'::jsonb 
WHERE visible_groups IS NULL;

-- Example: Siwai Mataji Mandir might only want specific groups
-- UPDATE temples 
-- SET visible_groups = '["trustee", "sports", "sanskar", "ladies", "voting"]'::jsonb 
-- WHERE id = 3;

-- Verify the changes
SELECT 
  id,
  name,
  visible_groups
FROM temples
ORDER BY id;

COMMIT;
