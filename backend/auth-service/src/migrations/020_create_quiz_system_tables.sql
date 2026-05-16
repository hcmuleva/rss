/**
 * =====================================================================
 * Migration 020: Quiz System Tables
 * Company: emeelan
 * Date: 2026-04-09
 * =====================================================================
 * Creates tables for quiz builder and gameplay:
 * - event_activities (quizzes, games, videos)
 * - quiz_categories (GK, Hindu Dharma, etc.)
 * - quiz_questions (with multimedia support)
 * - video_shares (YouTube videos for quiz prep)
 */

-- =====================================================================
-- Table: event_activities
-- Purpose: Activities within event occurrences (quizzes, games, etc.)
-- =====================================================================
CREATE TABLE IF NOT EXISTS event_activities (
  id SERIAL PRIMARY KEY,
  occurrence_id INTEGER NOT NULL REFERENCES event_occurrences(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, -- 'quiz', 'game', 'discussion', 'video_share'
  title VARCHAR(200) NOT NULL,
  description TEXT,
  sequence_order INTEGER DEFAULT 0,
  duration_minutes INTEGER,
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'ready', 'active', 'completed'
  config JSONB DEFAULT '{}', -- Flexible config for different activity types
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_activities_occurrence ON event_activities(occurrence_id);
CREATE INDEX idx_activities_type ON event_activities(activity_type);
CREATE INDEX idx_activities_status ON event_activities(status);

COMMENT ON TABLE event_activities IS 'Activities within event occurrences (quizzes, games, discussions)';
COMMENT ON COLUMN event_activities.config IS 'JSON config: {scoring:{positive:10,negative:-2}, timer:{enabled:true,seconds:30}}';

-- =====================================================================
-- Table: quiz_categories
-- Purpose: Categories for quiz questions (GK, Hindu Dharma, etc.)
-- =====================================================================
CREATE TABLE IF NOT EXISTS quiz_categories (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES event_activities(id) ON DELETE CASCADE,
  category_name VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(50), -- Icon name for UI (e.g., 'book', 'globe', 'brain')
  color VARCHAR(20), -- Category color for UI
  question_count INTEGER DEFAULT 0, -- Cached count
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_quiz_categories_activity ON quiz_categories(activity_id);
CREATE INDEX idx_quiz_categories_order ON quiz_categories(display_order);

COMMENT ON TABLE quiz_categories IS 'Quiz categories like GK, Hindu Dharma, Do You Know, etc.';

-- =====================================================================
-- Table: quiz_questions
-- Purpose: Quiz questions with multimedia and scoring support
-- =====================================================================
CREATE TABLE IF NOT EXISTS quiz_questions (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES quiz_categories(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(20) DEFAULT 'mcq', -- 'mcq', 'true_false', 'text'
  
  -- Options for MCQ
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  correct_option VARCHAR(1), -- 'A', 'B', 'C', 'D'
  
  -- For true/false
  correct_answer BOOLEAN,
  
  -- Marking scheme
  positive_marks INTEGER DEFAULT 10,
  negative_marks INTEGER DEFAULT -2,
  
  -- Timer
  time_limit_seconds INTEGER DEFAULT 30,
  
  -- Media
  image_url TEXT,
  video_url TEXT, -- YouTube URL
  youtube_video_id VARCHAR(20),
  video_start_time INTEGER, -- Seconds to start from
  video_end_time INTEGER, -- Seconds to end at
  
  -- Explanation
  explanation TEXT,
  reference_text TEXT,
  reference_url TEXT,
  
  -- Metadata
  difficulty VARCHAR(20) DEFAULT 'medium', -- 'easy', 'medium', 'hard'
  display_order INTEGER DEFAULT 0,
  tags TEXT[], -- Array of tags for filtering
  
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_quiz_questions_category ON quiz_questions(category_id);
CREATE INDEX idx_quiz_questions_type ON quiz_questions(question_type);
CREATE INDEX idx_quiz_questions_difficulty ON quiz_questions(difficulty);
CREATE INDEX idx_quiz_questions_order ON quiz_questions(display_order);

COMMENT ON TABLE quiz_questions IS 'Quiz questions with multimedia support and flexible answer types';
COMMENT ON COLUMN quiz_questions.youtube_video_id IS 'Extracted from YouTube URL for embedding';

-- =====================================================================
-- Table: video_shares
-- Purpose: YouTube videos shared before event for quiz preparation
-- =====================================================================
CREATE TABLE IF NOT EXISTS video_shares (
  id SERIAL PRIMARY KEY,
  occurrence_id INTEGER NOT NULL REFERENCES event_occurrences(id) ON DELETE CASCADE,
  youtube_video_id VARCHAR(20) NOT NULL,
  video_url TEXT NOT NULL,
  title VARCHAR(200),
  description TEXT,
  thumbnail_url TEXT,
  duration INTEGER, -- Total duration in seconds
  
  shared_by INTEGER REFERENCES users(id),
  shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- For quiz prep
  watch_before_date DATE,
  question_count INTEGER DEFAULT 0, -- How many quiz questions from this video
  category VARCHAR(100), -- Category hint (optional)
  
  notes TEXT, -- Moderator notes
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_video_shares_occurrence ON video_shares(occurrence_id);
CREATE INDEX idx_video_shares_youtube ON video_shares(youtube_video_id);
CREATE INDEX idx_video_shares_date ON video_shares(watch_before_date);

COMMENT ON TABLE video_shares IS 'YouTube videos shared before events for quiz preparation';
COMMENT ON COLUMN video_shares.watch_before_date IS 'Date by which teams should watch the video';

-- =====================================================================
-- Helper Function: Update question count in categories
-- =====================================================================
CREATE OR REPLACE FUNCTION update_category_question_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE quiz_categories 
    SET question_count = (
      SELECT COUNT(*) 
      FROM quiz_questions 
      WHERE category_id = NEW.category_id AND is_active = true
    )
    WHERE id = NEW.category_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE quiz_categories 
    SET question_count = (
      SELECT COUNT(*) 
      FROM quiz_questions 
      WHERE category_id = OLD.category_id AND is_active = true
    )
    WHERE id = OLD.category_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_question_count
AFTER INSERT OR UPDATE OR DELETE ON quiz_questions
FOR EACH ROW EXECUTE FUNCTION update_category_question_count();

-- =====================================================================
-- Sample Data: Create sample quiz activity
-- =====================================================================
INSERT INTO event_activities (occurrence_id, activity_type, title, description, duration_minutes, status, created_by)
VALUES 
  (1, 'quiz', 'Weekly Dharma Quiz', 'Test your knowledge of Hindu Dharma, General Knowledge, and more!', 60, 'draft', 1);

-- Sample Categories
INSERT INTO quiz_categories (activity_id, category_name, description, display_order, icon, color)
VALUES 
  (1, 'General Knowledge', 'Questions on world affairs, science, history', 1, 'globe', '#3B82F6'),
  (1, 'Hindu Dharma', 'Questions on Hindu scriptures, traditions, philosophy', 2, 'book-open', '#F97316'),
  (1, 'Do You Know?', 'Fun facts and trivia from shared videos', 3, 'help-circle', '#10B981');

-- Sample Questions
INSERT INTO quiz_questions (category_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_option, positive_marks, negative_marks, time_limit_seconds, difficulty, display_order)
VALUES 
  -- General Knowledge
  (1, 'Which planet is known as the Red Planet?', 'mcq', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'B', 10, -2, 30, 'easy', 1),
  (1, 'Who wrote the Indian National Anthem?', 'mcq', 'Rabindranath Tagore', 'Bankim Chandra', 'Subhash Bose', 'Mahatma Gandhi', 'A', 10, -2, 30, 'medium', 2),
  
  -- Hindu Dharma
  (2, 'How many Vedas are there in Hindu scriptures?', 'mcq', 'Two', 'Three', 'Four', 'Five', 'C', 10, -2, 30, 'easy', 1),
  (2, 'Which god is known as the destroyer in the Hindu trinity?', 'mcq', 'Brahma', 'Vishnu', 'Shiva', 'Indra', 'C', 10, -2, 30, 'easy', 2),
  
  -- Do You Know
  (3, 'True or False: Honey never spoils and can last for thousands of years.', 'true_false', NULL, NULL, NULL, NULL, NULL, 10, -2, 20, 'easy', 1);

UPDATE quiz_questions SET correct_answer = true WHERE id = 5;

-- Sample YouTube Video Share
INSERT INTO video_shares (occurrence_id, youtube_video_id, video_url, title, watch_before_date, question_count, category, shared_by)
VALUES 
  (1, 'dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Introduction to Hindu Philosophy', '2026-04-15', 5, 'Hindu Dharma', 1);

-- =====================================================================
-- End of Migration 020
-- =====================================================================
