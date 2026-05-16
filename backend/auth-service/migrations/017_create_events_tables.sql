/**
 * =====================================================================
 * Migration: Create Events Tables (Phase 1)
 * Created: 2026-04-08
 * =====================================================================
 * Creates core tables for Events Management System
 */

-- =====================================================================
-- 1. Events Table
-- =====================================================================
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  temple_id INTEGER NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES temple_groups(id) ON DELETE CASCADE,
  
  -- Basic Info
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  
  -- Date & Time
  event_date DATE NOT NULL,
  event_time TIME,
  end_date DATE,
  end_time TIME,
  
  -- Location
  location TEXT,
  venue_name VARCHAR(200),
  
  -- Capacity & Registration
  capacity INTEGER,
  registration_required BOOLEAN DEFAULT false,
  registration_deadline TIMESTAMP,
  
  -- Organizer
  organizer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  organizer_name VARCHAR(200),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(100),
  
  -- Visibility
  is_public BOOLEAN DEFAULT true,
  visibility VARCHAR(20) DEFAULT 'temple', -- 'temple', 'global', 'team', 'public'
  
  -- Recurrence
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern VARCHAR(20), -- 'daily', 'weekly', 'monthly', 'custom'
  recurrence_end_date DATE,
  custom_recurrence JSONB,
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'published', 'cancelled', 'completed'
  
  -- Cover Image
  cover_image_url TEXT,
  
  -- Metadata
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for events table
CREATE INDEX IF NOT EXISTS idx_events_temple ON events(temple_id);
CREATE INDEX IF NOT EXISTS idx_events_group ON events(group_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_visibility ON events(visibility);
CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_id);

-- Comments
COMMENT ON TABLE events IS 'Core events table for temple team events';
COMMENT ON COLUMN events.visibility IS 'Controls who can see the event: temple, global, team, public';
COMMENT ON COLUMN events.status IS 'Event lifecycle: draft, published, cancelled, completed';

-- =====================================================================
-- 2. Event Categories Table
-- =====================================================================
CREATE TABLE IF NOT EXISTS event_categories (
  id SERIAL PRIMARY KEY,
  temple_id INTEGER NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7), -- Hex color for UI
  icon VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(temple_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_categories_temple ON event_categories(temple_id);

-- Comments
COMMENT ON TABLE event_categories IS 'Custom event categories defined by temple admin';

-- =====================================================================
-- 3. Event Settings Table
-- =====================================================================
CREATE TABLE IF NOT EXISTS event_settings (
  id SERIAL PRIMARY KEY,
  temple_id INTEGER NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
  visible_event_types JSONB DEFAULT '["sanskar", "education", "sports", "dance", "cultural", "committee", "ladies", "yuva"]'::jsonb,
  allow_member_create_events BOOLEAN DEFAULT false,
  require_admin_approval BOOLEAN DEFAULT true,
  default_visibility VARCHAR(20) DEFAULT 'temple',
  enable_registration BOOLEAN DEFAULT true,
  enable_attendance BOOLEAN DEFAULT true,
  enable_media_upload BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(temple_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_settings_temple ON event_settings(temple_id);

-- Comments
COMMENT ON TABLE event_settings IS 'Temple-specific event system configuration';
COMMENT ON COLUMN event_settings.visible_event_types IS 'Array of group types that show in Events navigation';

-- =====================================================================
-- Insert Default Categories
-- =====================================================================
-- Will be inserted via API when temples first access Events

-- =====================================================================
-- Triggers for updated_at
-- =====================================================================
CREATE OR REPLACE FUNCTION update_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_events_updated_at();

CREATE TRIGGER trigger_event_settings_updated_at
  BEFORE UPDATE ON event_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_events_updated_at();

COMMIT;
