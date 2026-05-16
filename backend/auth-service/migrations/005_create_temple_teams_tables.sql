/**
 * =====================================================================
 * Migration: Temple Teams Management System
 * Created: 2026-04-06
 * =====================================================================
 * Creates tables for temple teams/groups management:
 * - temple_groups: Main groups (Trustee, Business, Sports, etc.)
 * - temple_group_categories: Categories within groups (Cricket, Football, etc.)
 * - temple_group_members: Members with their roles per category
 * - temple_group_messages: Group messages with Ably integration
 * - temple_group_events: Group events
 * - temple_group_documents: Group documents/attachments
 */

-- =====================================================================
-- 1. Temple Groups Table
-- =====================================================================
CREATE TABLE IF NOT EXISTS temple_groups (
  id SERIAL PRIMARY KEY,
  temple_id INTEGER NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  group_type VARCHAR(50) NOT NULL, -- trustee, business, sports, dance, etc.
  is_public BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_temple_groups_temple_id ON temple_groups(temple_id);
CREATE INDEX idx_temple_groups_group_type ON temple_groups(group_type);

-- =====================================================================
-- 2. Temple Group Categories Table
-- =====================================================================
CREATE TABLE IF NOT EXISTS temple_group_categories (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES temple_groups(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, name)
);

CREATE INDEX idx_temple_group_categories_group_id ON temple_group_categories(group_id);

-- =====================================================================
-- 3. Temple Group Members Table
-- =====================================================================
CREATE TABLE IF NOT EXISTS temple_group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES temple_groups(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES temple_group_categories(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member', -- member, moderator
  category_roles TEXT[], -- Array of roles in category: ['Captain', 'Player']
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, category_id, user_id)
);

CREATE INDEX idx_temple_group_members_group_id ON temple_group_members(group_id);
CREATE INDEX idx_temple_group_members_user_id ON temple_group_members(user_id);
CREATE INDEX idx_temple_group_members_category_id ON temple_group_members(category_id);

-- =====================================================================
-- 4. Temple Group Messages Table
-- =====================================================================
CREATE TABLE IF NOT EXISTS temple_group_messages (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES temple_groups(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES temple_group_categories(id) ON DELETE SET NULL,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  attachments JSONB, -- Array of attachment URLs
  ably_message_id VARCHAR(255), -- Ably message ID for tracking
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_temple_group_messages_group_id ON temple_group_messages(group_id);
CREATE INDEX idx_temple_group_messages_sender_id ON temple_group_messages(sender_id);
CREATE INDEX idx_temple_group_messages_sent_at ON temple_group_messages(sent_at DESC);

-- =====================================================================
-- 5. Temple Group Events Table
-- =====================================================================
CREATE TABLE IF NOT EXISTS temple_group_events (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES temple_groups(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES temple_group_categories(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  location VARCHAR(255),
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_temple_group_events_group_id ON temple_group_events(group_id);
CREATE INDEX idx_temple_group_events_event_date ON temple_group_events(event_date);

-- =====================================================================
-- 6. Temple Group Documents Table
-- =====================================================================
CREATE TABLE IF NOT EXISTS temple_group_documents (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES temple_groups(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES temple_group_categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50),
  file_size INTEGER, -- in bytes
  file_url TEXT NOT NULL,
  uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_temple_group_documents_group_id ON temple_group_documents(group_id);
CREATE INDEX idx_temple_group_documents_uploaded_by ON temple_group_documents(uploaded_by);

-- =====================================================================
-- Insert Default Groups for Temple ID 6 (for testing)
-- =====================================================================
INSERT INTO temple_groups (temple_id, name, description, icon, group_type, is_public, created_at) VALUES
(6, 'Trustee', 'Temple trust board and decision makers', 'shield', 'trustee', false, CURRENT_TIMESTAMP),
(6, 'Business', 'Business owners and entrepreneurs', 'briefcase', 'business', true, CURRENT_TIMESTAMP),
(6, 'Sanskar', 'Cultural and traditional activities', 'book-open', 'sanskar', true, CURRENT_TIMESTAMP),
(6, 'Education', 'Educational initiatives and support', 'award', 'education', true, CURRENT_TIMESTAMP),
(6, 'Agriculture', 'Farmers and agricultural community', 'sprout', 'agriculture', true, CURRENT_TIMESTAMP),
(6, 'Ladies', 'Women empowerment and activities', 'users', 'ladies', true, CURRENT_TIMESTAMP),
(6, 'Dance', 'Dance classes and performances', 'music', 'dance', true, CURRENT_TIMESTAMP),
(6, 'Jobs', 'Job opportunities and career guidance', 'briefcase', 'jobs', true, CURRENT_TIMESTAMP),
(6, 'Cultural Groups', 'Cultural events and programs', 'star', 'cultural', true, CURRENT_TIMESTAMP),
(6, 'Sports Group', 'Sports activities and tournaments', 'activity', 'sports', true, CURRENT_TIMESTAMP),
(6, 'Voting', 'Temple decision voting and polls', 'check-square', 'voting', false, CURRENT_TIMESTAMP),
(6, 'Polling', 'Opinion polls and surveys', 'pie-chart', 'polling', true, CURRENT_TIMESTAMP);

-- =====================================================================
-- Insert Sample Categories
-- =====================================================================
-- Trustee categories (assuming group_id 1)
INSERT INTO temple_group_categories (group_id, name, description, display_order) VALUES
((SELECT id FROM temple_groups WHERE group_type = 'trustee' AND temple_id = 6 LIMIT 1), 'Board Members', 'Main trust board', 1),
((SELECT id FROM temple_groups WHERE group_type = 'trustee' AND temple_id = 6 LIMIT 1), 'Advisors', 'Advisory committee', 2);

-- Sports categories (assuming Sports Group)
INSERT INTO temple_group_categories (group_id, name, description, display_order) VALUES
((SELECT id FROM temple_groups WHERE group_type = 'sports' AND temple_id = 6 LIMIT 1), 'Cricket', 'Cricket team and activities', 1),
((SELECT id FROM temple_groups WHERE group_type = 'sports' AND temple_id = 6 LIMIT 1), 'Football', 'Football team', 2),
((SELECT id FROM temple_groups WHERE group_type = 'sports' AND temple_id = 6 LIMIT 1), 'Basketball', 'Basketball team', 3);

-- Dance categories
INSERT INTO temple_group_categories (group_id, name, description, display_order) VALUES
((SELECT id FROM temple_groups WHERE group_type = 'dance' AND temple_id = 6 LIMIT 1), 'Bharatnatyam', 'Classical Bharatnatyam', 1),
((SELECT id FROM temple_groups WHERE group_type = 'dance' AND temple_id = 6 LIMIT 1), 'Kathak', 'Classical Kathak', 2),
((SELECT id FROM temple_groups WHERE group_type = 'dance' AND temple_id = 6 LIMIT 1), 'Folk Dance', 'Traditional folk dances', 3);

-- Business categories
INSERT INTO temple_group_categories (group_id, name, description, display_order) VALUES
((SELECT id FROM temple_groups WHERE group_type = 'business' AND temple_id = 6 LIMIT 1), 'Retail', 'Retail business owners', 1),
((SELECT id FROM temple_groups WHERE group_type = 'business' AND temple_id = 6 LIMIT 1), 'Manufacturing', 'Manufacturing units', 2),
((SELECT id FROM temple_groups WHERE group_type = 'business' AND temple_id = 6 LIMIT 1), 'Services', 'Service providers', 3);

-- Education categories
INSERT INTO temple_group_categories (group_id, name, description, display_order) VALUES
((SELECT id FROM temple_groups WHERE group_type = 'education' AND temple_id = 6 LIMIT 1), 'Primary', 'Primary education', 1),
((SELECT id FROM temple_groups WHERE group_type = 'education' AND temple_id = 6 LIMIT 1), 'Secondary', 'Secondary education', 2),
((SELECT id FROM temple_groups WHERE group_type = 'education' AND temple_id = 6 LIMIT 1), 'Coaching', 'Competitive exam coaching', 3);

-- Agriculture categories
INSERT INTO temple_group_categories (group_id, name, description, display_order) VALUES
((SELECT id FROM temple_groups WHERE group_type = 'agriculture' AND temple_id = 6 LIMIT 1), 'Crop Farming', 'Crop farmers', 1),
((SELECT id FROM temple_groups WHERE group_type = 'agriculture' AND temple_id = 6 LIMIT 1), 'Dairy', 'Dairy farming', 2),
((SELECT id FROM temple_groups WHERE group_type = 'agriculture' AND temple_id = 6 LIMIT 1), 'Organic', 'Organic farming', 3);

-- Ladies categories
INSERT INTO temple_group_categories (group_id, name, description, display_order) VALUES
((SELECT id FROM temple_groups WHERE group_type = 'ladies' AND temple_id = 6 LIMIT 1), 'Self Help', 'Self help groups', 1),
((SELECT id FROM temple_groups WHERE group_type = 'ladies' AND temple_id = 6 LIMIT 1), 'Skills', 'Skill development', 2),
((SELECT id FROM temple_groups WHERE group_type = 'ladies' AND temple_id = 6 LIMIT 1), 'Health', 'Health awareness', 3);

-- Jobs categories
INSERT INTO temple_group_categories (group_id, name, description, display_order) VALUES
((SELECT id FROM temple_groups WHERE group_type = 'jobs' AND temple_id = 6 LIMIT 1), 'IT & Software', 'Tech jobs', 1),
((SELECT id FROM temple_groups WHERE group_type = 'jobs' AND temple_id = 6 LIMIT 1), 'Government', 'Government jobs', 2),
((SELECT id FROM temple_groups WHERE group_type = 'jobs' AND temple_id = 6 LIMIT 1), 'Private Sector', 'Private companies', 3);

-- Cultural categories
INSERT INTO temple_group_categories (group_id, name, description, display_order) VALUES
((SELECT id FROM temple_groups WHERE group_type = 'cultural' AND temple_id = 6 LIMIT 1), 'Music', 'Music groups', 1),
((SELECT id FROM temple_groups WHERE group_type = 'cultural' AND temple_id = 6 LIMIT 1), 'Drama', 'Drama and theatre', 2),
((SELECT id FROM temple_groups WHERE group_type = 'cultural' AND temple_id = 6 LIMIT 1), 'Art', 'Art and craft', 3);

-- Sanskar categories
INSERT INTO temple_group_categories (group_id, name, description, display_order) VALUES
((SELECT id FROM temple_groups WHERE group_type = 'sanskar' AND temple_id = 6 LIMIT 1), 'Religious', 'Religious ceremonies', 1),
((SELECT id FROM temple_groups WHERE group_type = 'sanskar' AND temple_id = 6 LIMIT 1), 'Cultural', 'Cultural programs', 2);

-- Voting categories
INSERT INTO temple_group_categories (group_id, name, description, display_order) VALUES
((SELECT id FROM temple_groups WHERE group_type = 'voting' AND temple_id = 6 LIMIT 1), 'Temple Management', 'Management decisions', 1),
((SELECT id FROM temple_groups WHERE group_type = 'voting' AND temple_id = 6 LIMIT 1), 'Events', 'Event related voting', 2);

-- Polling categories
INSERT INTO temple_group_categories (group_id, name, description, display_order) VALUES
((SELECT id FROM temple_groups WHERE group_type = 'polling' AND temple_id = 6 LIMIT 1), 'Community Feedback', 'General feedback', 1),
((SELECT id FROM temple_groups WHERE group_type = 'polling' AND temple_id = 6 LIMIT 1), 'Event Planning', 'Event surveys', 2);

-- =====================================================================
-- Comments
-- =====================================================================
COMMENT ON TABLE temple_groups IS 'Temple groups/teams (Trustee, Business, Sports, etc.)';
COMMENT ON TABLE temple_group_categories IS 'Categories within groups (Cricket, Football, etc.)';
COMMENT ON TABLE temple_group_members IS 'Members with their roles per category';
COMMENT ON TABLE temple_group_messages IS 'Group messages with Ably integration';
COMMENT ON TABLE temple_group_events IS 'Group events and activities';
COMMENT ON TABLE temple_group_documents IS 'Group documents and attachments';
