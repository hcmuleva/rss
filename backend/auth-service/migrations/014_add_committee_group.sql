/**
 * =====================================================================
 * Migration: Add Committee Group
 * Created: 2026-04-08
 * =====================================================================
 * Adds Committee group to temple_groups table for all temples
 */

-- Add Committee group for existing temples
INSERT INTO temple_groups (temple_id, name, description, icon, group_type, is_public, created_at)
SELECT 
  id as temple_id,
  'Committee' as name,
  'Temple management committee and executive board' as description,
  'users' as icon,
  'committee' as group_type,
  false as is_public,
  CURRENT_TIMESTAMP as created_at
FROM temples
WHERE NOT EXISTS (
  SELECT 1 FROM temple_groups 
  WHERE temple_groups.temple_id = temples.id 
  AND temple_groups.group_type = 'committee'
);

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_temple_groups_committee ON temple_groups(group_type) WHERE group_type = 'committee';
