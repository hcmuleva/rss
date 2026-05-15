/**
 * =====================================================================
 * Migration: Add contribution_for column to temple_trustees
 * Created: 2026-04-08
 * =====================================================================
 * Adds a field to track what the contribution was for (purpose/reference)
 */

-- Add contribution_for column
ALTER TABLE temple_trustees 
ADD COLUMN IF NOT EXISTS contribution_for VARCHAR(500);

-- Add comment
COMMENT ON COLUMN temple_trustees.contribution_for IS 'Purpose or reference for the contribution/donation';

-- Update existing records with a default value (optional)
UPDATE temple_trustees 
SET contribution_for = 'General Temple Development' 
WHERE contribution_for IS NULL AND amount > 0;

COMMIT;
