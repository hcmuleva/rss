/**
 * =====================================================================
 * Migration: Create user_education Table
 * Date: 2026-04-06
 * Description: Create table for storing user education records
 * =====================================================================
 */

-- Create user_education table
CREATE TABLE IF NOT EXISTS user_education (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    degree VARCHAR(100) NOT NULL,
    field_of_study VARCHAR(100) NOT NULL,
    institution VARCHAR(200) NOT NULL,
    university VARCHAR(200),
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN DEFAULT false,
    grade VARCHAR(20),
    achievements TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_end_date CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_education_user_id ON user_education(user_id);
CREATE INDEX IF NOT EXISTS idx_user_education_degree ON user_education(degree);

-- Add column comments
COMMENT ON TABLE user_education IS 'Stores user education records';
COMMENT ON COLUMN user_education.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN user_education.degree IS 'Degree/Qualification name';
COMMENT ON COLUMN user_education.field_of_study IS 'Major/Specialization';
COMMENT ON COLUMN user_education.institution IS 'School/College name';
COMMENT ON COLUMN user_education.university IS 'University/Board name';
COMMENT ON COLUMN user_education.start_date IS 'Start date (YYYY-MM format)';
COMMENT ON COLUMN user_education.end_date IS 'End date (YYYY-MM format), NULL if current';
COMMENT ON COLUMN user_education.is_current IS 'Currently studying flag';
COMMENT ON COLUMN user_education.grade IS 'GPA/Percentage/Grade';
COMMENT ON COLUMN user_education.achievements IS 'Awards, honors, achievements';

-- Verify table created
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_education'
ORDER BY ordinal_position;
