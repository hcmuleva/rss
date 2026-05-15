/**
 * =====================================================================
 * Migration: Create Event Participants and Documents Tables (Phase 3)
 * Created: 2026-04-08
 * =====================================================================
 * Creates tables for event registration, attendance tracking, and document upload
 */

-- =====================================================================
-- 1. Event Participants Table
-- =====================================================================
CREATE TABLE IF NOT EXISTS event_participants (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Registration
  registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'registered', -- 'registered', 'confirmed', 'cancelled', 'waitlist'
  
  -- Attendance
  attended BOOLEAN DEFAULT false,
  attendance_marked_at TIMESTAMP,
  attendance_marked_by INTEGER REFERENCES users(id),
  
  -- Role in Event
  role VARCHAR(50) DEFAULT 'participant', -- 'participant', 'volunteer', 'organizer', 'speaker'
  
  -- Additional Info
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(event_id, user_id)
);

-- Indexes for event_participants
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_user ON event_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_status ON event_participants(status);
CREATE INDEX IF NOT EXISTS idx_event_participants_attended ON event_participants(attended);

-- Comments
COMMENT ON TABLE event_participants IS 'Event registration and attendance tracking';
COMMENT ON COLUMN event_participants.status IS 'Registration status: registered, confirmed, cancelled, waitlist';
COMMENT ON COLUMN event_participants.role IS 'Role in event: participant, volunteer, organizer, speaker';

-- =====================================================================
-- 2. Event Documents Table (for resolutions, minutes, reports)
-- =====================================================================
CREATE TABLE IF NOT EXISTS event_documents (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  
  -- Document Info
  document_type VARCHAR(50) NOT NULL, -- 'resolution', 'minutes', 'report', 'attachment', 'photo', 'video'
  title VARCHAR(200) NOT NULL,
  description TEXT,
  
  -- File Details
  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_size BIGINT,
  file_type VARCHAR(100), -- MIME type
  
  -- Metadata
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Display
  display_order INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for event_documents
CREATE INDEX IF NOT EXISTS idx_event_documents_event ON event_documents(event_id);
CREATE INDEX IF NOT EXISTS idx_event_documents_type ON event_documents(document_type);

-- Comments
COMMENT ON TABLE event_documents IS 'Event-related documents, resolutions, and attachments';
COMMENT ON COLUMN event_documents.document_type IS 'Type: resolution, minutes, report, attachment, photo, video';

-- =====================================================================
-- 3. Triggers for updated_at
-- =====================================================================
CREATE OR REPLACE FUNCTION update_event_participants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_event_participants_updated_at
  BEFORE UPDATE ON event_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_event_participants_updated_at();

COMMIT;
