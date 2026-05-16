/**
 * =====================================================================
 * Migration: Create Event Activities Tables (Phase 1 - Teams & Occurrences)
 * Created: 2026-04-08
 * =====================================================================
 * Creates tables for recurring event occurrences and team-based activities
 */

-- =====================================================================
-- 1. Event Occurrences Table
-- =====================================================================
CREATE TABLE IF NOT EXISTS event_occurrences (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  occurrence_time TIME,
  status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, active, completed, cancelled
  actual_start_time TIMESTAMP,
  actual_end_time TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for event_occurrences
CREATE INDEX IF NOT EXISTS idx_event_occurrences_event ON event_occurrences(event_id);
CREATE INDEX IF NOT EXISTS idx_event_occurrences_date ON event_occurrences(occurrence_date);
CREATE INDEX IF NOT EXISTS idx_event_occurrences_status ON event_occurrences(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_occurrences_unique ON event_occurrences(event_id, occurrence_date);

-- Comments
COMMENT ON TABLE event_occurrences IS 'Individual occurrences of recurring events';
COMMENT ON COLUMN event_occurrences.status IS 'Status: scheduled, active, completed, cancelled';

-- =====================================================================
-- 2. Event Teams Table
-- =====================================================================
CREATE TABLE IF NOT EXISTS event_teams (
  id SERIAL PRIMARY KEY,
  occurrence_id INTEGER NOT NULL REFERENCES event_occurrences(id) ON DELETE CASCADE,
  team_name VARCHAR(100) NOT NULL,
  team_photo_url TEXT,
  team_color VARCHAR(20) DEFAULT '#FF6B6B', -- Hex color for UI
  captain_user_id INTEGER REFERENCES users(id),
  max_members INTEGER DEFAULT 6,
  total_score INTEGER DEFAULT 0,
  rank INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for event_teams
CREATE INDEX IF NOT EXISTS idx_event_teams_occurrence ON event_teams(occurrence_id);
CREATE INDEX IF NOT EXISTS idx_event_teams_captain ON event_teams(captain_user_id);
CREATE INDEX IF NOT EXISTS idx_event_teams_rank ON event_teams(rank);

-- Comments
COMMENT ON TABLE event_teams IS 'Teams formed for each event occurrence';
COMMENT ON COLUMN event_teams.team_color IS 'Hex color code for team UI differentiation';

-- =====================================================================
-- 3. Event Team Members Table
-- =====================================================================
CREATE TABLE IF NOT EXISTS event_team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES event_teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member', -- captain, member
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Indexes for event_team_members
CREATE INDEX IF NOT EXISTS idx_team_members_team ON event_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON event_team_members(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_unique ON event_team_members(team_id, user_id);

-- Comments
COMMENT ON TABLE event_team_members IS 'Team roster - members of each team';
COMMENT ON COLUMN event_team_members.role IS 'Role: captain, member';

-- =====================================================================
-- 4. Triggers for updated_at
-- =====================================================================

-- Trigger function for event_occurrences
CREATE OR REPLACE FUNCTION update_event_occurrences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_event_occurrences_updated_at
  BEFORE UPDATE ON event_occurrences
  FOR EACH ROW
  EXECUTE FUNCTION update_event_occurrences_updated_at();

-- Trigger function for event_teams
CREATE OR REPLACE FUNCTION update_event_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_event_teams_updated_at
  BEFORE UPDATE ON event_teams
  FOR EACH ROW
  EXECUTE FUNCTION update_event_teams_updated_at();

-- =====================================================================
-- 5. Helper Functions
-- =====================================================================

-- Function to get team member count
CREATE OR REPLACE FUNCTION get_team_member_count(p_team_id INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM event_team_members
    WHERE team_id = p_team_id AND is_active = true
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check if team is full
CREATE OR REPLACE FUNCTION is_team_full(p_team_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  v_max_members INTEGER;
  v_current_count INTEGER;
BEGIN
  SELECT max_members INTO v_max_members
  FROM event_teams
  WHERE id = p_team_id;
  
  v_current_count := get_team_member_count(p_team_id);
  
  RETURN v_current_count >= v_max_members;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 6. Sample Data (for testing)
-- =====================================================================

-- Create a sample occurrence for existing event (if event 3 exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM events WHERE id = 3) THEN
    INSERT INTO event_occurrences (event_id, occurrence_date, occurrence_time, status)
    VALUES 
      (3, CURRENT_DATE + INTERVAL '7 days', '10:00:00', 'scheduled'),
      (3, CURRENT_DATE + INTERVAL '14 days', '10:00:00', 'scheduled')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

COMMIT;
