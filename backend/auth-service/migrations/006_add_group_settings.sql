/**
 * =====================================================================
 * Migration: Add Group Settings
 * Created: 2026-04-07
 * =====================================================================
 * Adds enabled_tabs column to temple_groups to control which tabs
 * (members, messages, events, documents) are visible for each group
 */

-- Add enabled_tabs column (JSON array of enabled tab names)
ALTER TABLE temple_groups 
ADD COLUMN IF NOT EXISTS enabled_tabs JSONB DEFAULT '["members", "messages", "events", "documents"]'::jsonb;

-- Add comment
COMMENT ON COLUMN temple_groups.enabled_tabs IS 'Array of enabled tabs: ["members", "messages", "events", "documents"]';

-- Update existing groups to have all tabs enabled by default
UPDATE temple_groups 
SET enabled_tabs = '["members", "messages", "events", "documents"]'::jsonb 
WHERE enabled_tabs IS NULL;

-- Example: Disable some tabs for specific groups
-- For example, Voting group might only need members and messages
UPDATE temple_groups 
SET enabled_tabs = '["members", "messages"]'::jsonb 
WHERE group_type = 'voting';

-- Polling group might need all except messages
UPDATE temple_groups 
SET enabled_tabs = '["members", "events", "documents"]'::jsonb 
WHERE group_type = 'polling';

-- Verify the changes
SELECT 
  id,
  name,
  group_type,
  enabled_tabs
FROM temple_groups
ORDER BY temple_id, id;

COMMIT;
