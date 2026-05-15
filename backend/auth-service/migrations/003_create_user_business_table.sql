/**
 * =====================================================================
 * Migration: Create user_business Table
 * Date: 2026-04-06
 * Description: Create table for storing user business records
 * =====================================================================
 */

-- Create user_business table
CREATE TABLE IF NOT EXISTS user_business (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Common fields
    business_type VARCHAR(50) NOT NULL,
    business_category VARCHAR(100) NOT NULL,
    business_name VARCHAR(200) NOT NULL,
    description TEXT,
    industry VARCHAR(100),
    established INTEGER,
    registration_number VARCHAR(100),
    gst_number VARCHAR(15),
    address VARCHAR(300),
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(6),
    phone VARCHAR(15),
    email VARCHAR(100),
    website VARCHAR(200),
    number_of_employees VARCHAR(50),
    annual_turnover VARCHAR(50),
    ownership_type VARCHAR(50),
    ownership_percentage INTEGER CHECK (ownership_percentage >= 0 AND ownership_percentage <= 100),
    is_active BOOLEAN DEFAULT true,
    
    -- Agriculture-specific fields
    total_land DECIMAL(10,2),
    land_unit VARCHAR(50),
    land_type VARCHAR(50),
    land_location TEXT,
    
    -- Education-specific fields
    education_type VARCHAR(100),
    courses_offered TEXT,
    medium_of_instruction VARCHAR(100),
    total_students VARCHAR(50),
    affiliated_to VARCHAR(200),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_business_user_id ON user_business(user_id);
CREATE INDEX IF NOT EXISTS idx_user_business_type ON user_business(business_type);
CREATE INDEX IF NOT EXISTS idx_user_business_active ON user_business(is_active);

-- Add column comments
COMMENT ON TABLE user_business IS 'Stores user business/occupation records';
COMMENT ON COLUMN user_business.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN user_business.business_type IS 'Type of business: Manufacturing, Agriculture, Education, etc.';
COMMENT ON COLUMN user_business.business_category IS 'Category within business type';
COMMENT ON COLUMN user_business.business_name IS 'Registered business name';
COMMENT ON COLUMN user_business.total_land IS 'Total land area (for Agriculture)';
COMMENT ON COLUMN user_business.land_unit IS 'Unit: Acre, Bigha, Hectare (for Agriculture)';
COMMENT ON COLUMN user_business.education_type IS 'Type of education (for Education businesses)';
COMMENT ON COLUMN user_business.courses_offered IS 'Courses offered (for Education businesses)';

-- Verify table created
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_business'
ORDER BY ordinal_position;
