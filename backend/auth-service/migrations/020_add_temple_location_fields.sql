/**
 * =====================================================================
 * Migration: Add Temple Location Fields
 * Created: 2026-04-10
 * =====================================================================
 * Adds district, tehsil, village, and photo fields to temples table
 */

-- Add district, tehsil, village columns
ALTER TABLE temples 
ADD COLUMN IF NOT EXISTS district VARCHAR(100),
ADD COLUMN IF NOT EXISTS tehsil VARCHAR(100),
ADD COLUMN IF NOT EXISTS village VARCHAR(100),
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS landmark TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_temples_district ON temples(district);
CREATE INDEX IF NOT EXISTS idx_temples_tehsil ON temples(tehsil);
CREATE INDEX IF NOT EXISTS idx_temples_village ON temples(village);

-- Add comments
COMMENT ON COLUMN temples.district IS 'District where temple is located';
COMMENT ON COLUMN temples.tehsil IS 'Tehsil/Taluka where temple is located';
COMMENT ON COLUMN temples.village IS 'Village where temple is located';
COMMENT ON COLUMN temples.photo_url IS 'S3 URL of temple photo';
COMMENT ON COLUMN temples.latitude IS 'Latitude coordinate';
COMMENT ON COLUMN temples.longitude IS 'Longitude coordinate';
COMMENT ON COLUMN temples.landmark IS 'Landmark for temple location';

SELECT '✅ Added district, tehsil, village, photo_url, latitude, longitude, landmark columns to temples' AS status;
