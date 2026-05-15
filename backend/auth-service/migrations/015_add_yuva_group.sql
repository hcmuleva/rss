/**
 * =====================================================================
 * Migration: Add Yuva (Youth) Group
 * Created: 2026-04-08
 * =====================================================================
 * Adds Yuva group to temple_groups table for all temples
 * Yuva uses same structure as Committee (President, Secretary, etc.)
 */

-- Add Yuva group for existing temples
INSERT INTO temple_groups (temple_id, name, description, icon, group_type, is_public, created_at)
SELECT 
  id as temple_id,
  'Yuva' as name,
  'Youth organization and leadership development' as description,
  'users' as icon,
  'yuva' as group_type,
  true as is_public,
  CURRENT_TIMESTAMP as created_at
FROM temples
WHERE NOT EXISTS (
  SELECT 1 FROM temple_groups 
  WHERE temple_groups.temple_id = temples.id 
  AND temple_groups.group_type = 'yuva'
);

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_temple_groups_yuva ON temple_groups(group_type) WHERE group_type = 'yuva';
