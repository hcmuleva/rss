-- Migration 013: Add notes column to temple_group_members
-- Date: 2026-04-08
-- Purpose: Allow adding optional notes when adding members to groups

ALTER TABLE temple_group_members ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN temple_group_members.notes IS 'Optional notes about the member participation in the group';
