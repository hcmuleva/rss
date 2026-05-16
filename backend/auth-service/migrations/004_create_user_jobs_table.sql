/**
 * =====================================================================
 * Migration: Create user_jobs Table
 * Date: 2026-04-06
 * Description: Create table for storing user job/employment records
 * =====================================================================
 */

-- Create user_jobs table
CREATE TABLE IF NOT EXISTS user_jobs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sector VARCHAR(50) NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    industry VARCHAR(100) NOT NULL,
    employment_type VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN DEFAULT false,
    location VARCHAR(200),
    description TEXT,
    salary_range VARCHAR(50),
    achievements TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_end_date CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_jobs_user_id ON user_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_jobs_sector ON user_jobs(sector);
CREATE INDEX IF NOT EXISTS idx_user_jobs_current ON user_jobs(is_current);

-- Add column comments
COMMENT ON TABLE user_jobs IS 'Stores user job/employment history records';
COMMENT ON COLUMN user_jobs.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN user_jobs.sector IS 'Employment sector: Government, Private, etc.';
COMMENT ON COLUMN user_jobs.company_name IS 'Company/Organization name';
COMMENT ON COLUMN user_jobs.designation IS 'Job title/position';
COMMENT ON COLUMN user_jobs.department IS 'Department/Division';
COMMENT ON COLUMN user_jobs.industry IS 'Industry sector';
COMMENT ON COLUMN user_jobs.employment_type IS 'Full-time, Part-time, Contract, etc.';
COMMENT ON COLUMN user_jobs.start_date IS 'Start date (YYYY-MM format)';
COMMENT ON COLUMN user_jobs.end_date IS 'End date (YYYY-MM format), NULL if current';
COMMENT ON COLUMN user_jobs.is_current IS 'Currently working flag';
COMMENT ON COLUMN user_jobs.location IS 'Job location (City, State)';
COMMENT ON COLUMN user_jobs.description IS 'Job responsibilities';
COMMENT ON COLUMN user_jobs.salary_range IS 'Salary range';
COMMENT ON COLUMN user_jobs.achievements IS 'Key achievements';

-- Verify table created
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_jobs'
ORDER BY ordinal_position;
