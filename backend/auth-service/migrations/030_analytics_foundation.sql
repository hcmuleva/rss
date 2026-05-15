/**
 * =====================================================================
 * Analytics Foundation - Phase 1 Migration
 * Company: emeelan
 * =====================================================================
 * Creates analytics infrastructure for temple-family insights
 * 
 * Changes:
 * 1. Add demographic fields to users table
 * 2. Add geographic fields to temples table
 * 3. Add activity tracking to families table
 * 4. Create analytics fact tables
 * 5. Create materialized views
 * 6. Add performance indexes
 */

-- ============================================================
-- STEP 1: Enhance Users Table with Demographics
-- ============================================================

ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS is_student BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS student_grade VARCHAR(20),
  ADD COLUMN IF NOT EXISTS education_level VARCHAR(50),
  ADD COLUMN IF NOT EXISTS occupation VARCHAR(100),
  ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20);

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_users_student ON users(is_student) WHERE is_student = true;
CREATE INDEX IF NOT EXISTS idx_users_education ON users(education_level) WHERE education_level IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_occupation ON users(occupation) WHERE occupation IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_marital ON users(marital_status) WHERE marital_status IS NOT NULL;

COMMENT ON COLUMN users.is_student IS 'Indicates if user is currently a student';
COMMENT ON COLUMN users.student_grade IS 'Grade level: Grade 1-12, College, Post-Grad';
COMMENT ON COLUMN users.education_level IS 'Highest education: Primary, Secondary, Graduation, etc.';
COMMENT ON COLUMN users.occupation IS 'Current occupation or profession';
COMMENT ON COLUMN users.marital_status IS 'Marital status: Single, Married, Divorced, Widowed';

-- ============================================================
-- STEP 2: Enhance Temples Table with Geographic Data
-- ============================================================

ALTER TABLE temples
  ADD COLUMN IF NOT EXISTS district VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state VARCHAR(100),
  ADD COLUMN IF NOT EXISTS country VARCHAR(50) DEFAULT 'India',
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Create geographic indexes
CREATE INDEX IF NOT EXISTS idx_temples_district ON temples(district) WHERE district IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_temples_state ON temples(state) WHERE state IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_temples_country ON temples(country);
CREATE INDEX IF NOT EXISTS idx_temples_coordinates ON temples(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMENT ON COLUMN temples.district IS 'District name for geographic aggregation';
COMMENT ON COLUMN temples.state IS 'State name for regional analytics';
COMMENT ON COLUMN temples.latitude IS 'Geographic latitude for mapping';
COMMENT ON COLUMN temples.longitude IS 'Geographic longitude for mapping';

-- ============================================================
-- STEP 3: Enhance Families Table with Activity Tracking
-- ============================================================

ALTER TABLE families
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create activity index
CREATE INDEX IF NOT EXISTS idx_families_activity ON families(is_active, last_activity_at) WHERE is_active = true;

COMMENT ON COLUMN families.last_activity_at IS 'Last time any family member was added/updated';
COMMENT ON COLUMN families.is_active IS 'Active if has activity in last 90 days';

-- ============================================================
-- STEP 4: Create Analytics Fact Table
-- ============================================================

CREATE TABLE IF NOT EXISTS family_temple_facts (
  id SERIAL PRIMARY KEY,
  temple_id INTEGER REFERENCES temples(id) ON DELETE CASCADE,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  district VARCHAR(100),
  state VARCHAR(100),
  gotra VARCHAR(100),
  member_count INTEGER DEFAULT 0,
  male_count INTEGER DEFAULT 0,
  female_count INTEGER DEFAULT 0,
  student_count INTEGER DEFAULT 0,
  avg_age DECIMAL(5, 2),
  assigned_date DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(temple_id, family_id)
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_ftf_temple ON family_temple_facts(temple_id);
CREATE INDEX IF NOT EXISTS idx_ftf_family ON family_temple_facts(family_id);
CREATE INDEX IF NOT EXISTS idx_ftf_district ON family_temple_facts(district);
CREATE INDEX IF NOT EXISTS idx_ftf_state ON family_temple_facts(state);
CREATE INDEX IF NOT EXISTS idx_ftf_gotra ON family_temple_facts(gotra);
CREATE INDEX IF NOT EXISTS idx_ftf_active ON family_temple_facts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ftf_date ON family_temple_facts(assigned_date);

COMMENT ON TABLE family_temple_facts IS 'Pre-aggregated facts for fast analytics queries';
COMMENT ON COLUMN family_temple_facts.member_count IS 'Total members in this family';
COMMENT ON COLUMN family_temple_facts.avg_age IS 'Average age of family members';

-- ============================================================
-- STEP 5: Create Member Demographics Dimension Table
-- ============================================================

CREATE TABLE IF NOT EXISTS member_demographics (
  id SERIAL PRIMARY KEY,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  temple_id INTEGER, -- Denormalized for performance
  age_group VARCHAR(20), -- '0-10', '11-20', '21-30', '31-50', '51-70', '70+'
  gender VARCHAR(10),
  education_level VARCHAR(50),
  occupation VARCHAR(100),
  marital_status VARCHAR(20),
  is_student BOOLEAN DEFAULT false,
  student_grade VARCHAR(20),
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(family_id, user_id)
);

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_md_family ON member_demographics(family_id);
CREATE INDEX IF NOT EXISTS idx_md_user ON member_demographics(user_id);
CREATE INDEX IF NOT EXISTS idx_md_temple ON member_demographics(temple_id);
CREATE INDEX IF NOT EXISTS idx_md_age_group ON member_demographics(age_group);
CREATE INDEX IF NOT EXISTS idx_md_gender ON member_demographics(gender);
CREATE INDEX IF NOT EXISTS idx_md_education ON member_demographics(education_level);
CREATE INDEX IF NOT EXISTS idx_md_occupation ON member_demographics(occupation);
CREATE INDEX IF NOT EXISTS idx_md_student ON member_demographics(is_student) WHERE is_student = true;

COMMENT ON TABLE member_demographics IS 'Denormalized member data for fast demographic queries';

-- ============================================================
-- STEP 6: Create Analytics Cache Table
-- ============================================================

CREATE TABLE IF NOT EXISTS analytics_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(255) UNIQUE NOT NULL,
  data JSONB NOT NULL,
  filters JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  hit_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_analytics_cache_key ON analytics_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_expires ON analytics_cache(expires_at);

COMMENT ON TABLE analytics_cache IS 'Redis-alternative cache for analytics results';

-- Auto-cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM analytics_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STEP 7: Create User Subscriptions Table (if not exists)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  temple_id INTEGER REFERENCES temples(id) ON DELETE SET NULL,
  subscription_type VARCHAR(50) NOT NULL, -- 'free', 'basic', 'pro', 'enterprise'
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  features JSONB DEFAULT '{"analytics": true}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_temple ON user_subscriptions(temple_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active ON user_subscriptions(is_active, end_date);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_type ON user_subscriptions(subscription_type);

COMMENT ON TABLE user_subscriptions IS 'User subscription plans for analytics access';
COMMENT ON COLUMN user_subscriptions.subscription_type IS 'Subscription tier: free, basic, pro, enterprise';
COMMENT ON COLUMN user_subscriptions.features IS 'JSON object with enabled features';

-- ============================================================
-- STEP 8: Create Analytics Access Log Table
-- ============================================================

CREATE TABLE IF NOT EXISTS analytics_access_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  temple_id INTEGER,
  endpoint VARCHAR(255),
  filters JSONB,
  response_time_ms INTEGER,
  accessed_at TIMESTAMP DEFAULT NOW()
);

-- Partitioned by month for performance (create partitions as needed)
CREATE INDEX IF NOT EXISTS idx_analytics_log_user ON analytics_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_log_temple ON analytics_access_log(temple_id);
CREATE INDEX IF NOT EXISTS idx_analytics_log_date ON analytics_access_log(accessed_at);
CREATE INDEX IF NOT EXISTS idx_analytics_log_endpoint ON analytics_access_log(endpoint);

COMMENT ON TABLE analytics_access_log IS 'Audit log for analytics API access';

-- ============================================================
-- STEP 9: Create Helper Functions
-- ============================================================

-- Function to calculate age group from date of birth
CREATE OR REPLACE FUNCTION get_age_group(dob DATE)
RETURNS VARCHAR(20) AS $$
DECLARE
  age INTEGER;
BEGIN
  age := EXTRACT(YEAR FROM AGE(dob));
  
  RETURN CASE
    WHEN age <= 10 THEN '0-10'
    WHEN age <= 20 THEN '11-20'
    WHEN age <= 30 THEN '21-30'
    WHEN age <= 50 THEN '31-50'
    WHEN age <= 70 THEN '51-70'
    ELSE '70+'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to refresh family temple facts
CREATE OR REPLACE FUNCTION refresh_family_temple_facts()
RETURNS void AS $$
BEGIN
  TRUNCATE family_temple_facts;
  
  INSERT INTO family_temple_facts (
    temple_id,
    family_id,
    district,
    state,
    gotra,
    member_count,
    male_count,
    female_count,
    student_count,
    avg_age,
    assigned_date,
    is_active
  )
  SELECT 
    ft.temple_id,
    f.id AS family_id,
    t.district,
    t.state,
    f.gotra,
    COUNT(DISTINCT fm.user_id) AS member_count,
    SUM(CASE WHEN u.gender = 'male' THEN 1 ELSE 0 END) AS male_count,
    SUM(CASE WHEN u.gender = 'female' THEN 1 ELSE 0 END) AS female_count,
    SUM(CASE WHEN u.is_student = true THEN 1 ELSE 0 END) AS student_count,
    AVG(EXTRACT(YEAR FROM AGE(u.dob))) AS avg_age,
    ft.added_at::DATE AS assigned_date,
    f.is_active
  FROM family_temples ft
  JOIN families f ON ft.family_id = f.id
  JOIN temples t ON ft.temple_id = t.id
  LEFT JOIN family_members fm ON f.id = fm.family_id
  LEFT JOIN users u ON fm.user_id = u.id
  GROUP BY ft.temple_id, f.id, t.district, t.state, f.gotra, ft.added_at, f.is_active;
  
  RAISE NOTICE 'Family temple facts refreshed: % rows', (SELECT COUNT(*) FROM family_temple_facts);
END;
$$ LANGUAGE plpgsql;

-- Function to refresh member demographics
CREATE OR REPLACE FUNCTION refresh_member_demographics()
RETURNS void AS $$
BEGIN
  TRUNCATE member_demographics;
  
  INSERT INTO member_demographics (
    family_id,
    user_id,
    temple_id,
    age_group,
    gender,
    education_level,
    occupation,
    marital_status,
    is_student,
    student_grade
  )
  SELECT 
    fm.family_id,
    u.id AS user_id,
    ft.temple_id,
    get_age_group(u.dob) AS age_group,
    u.gender,
    u.education_level,
    u.occupation,
    u.marital_status,
    u.is_student,
    u.student_grade
  FROM users u
  JOIN family_members fm ON u.id = fm.user_id
  LEFT JOIN family_temples ft ON fm.family_id = ft.family_id AND ft.is_primary = true;
  
  RAISE NOTICE 'Member demographics refreshed: % rows', (SELECT COUNT(*) FROM member_demographics);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STEP 10: Initial Data Population
-- ============================================================

-- Identify students based on age (5-25 years old)
UPDATE users
SET is_student = true
WHERE EXTRACT(YEAR FROM AGE(dob)) BETWEEN 5 AND 25
  AND is_student IS DISTINCT FROM true;

-- Assign student grades based on age
UPDATE users
SET student_grade = CASE 
  WHEN EXTRACT(YEAR FROM AGE(dob)) = 6 THEN 'Grade 1'
  WHEN EXTRACT(YEAR FROM AGE(dob)) = 7 THEN 'Grade 2'
  WHEN EXTRACT(YEAR FROM AGE(dob)) = 8 THEN 'Grade 3'
  WHEN EXTRACT(YEAR FROM AGE(dob)) = 9 THEN 'Grade 4'
  WHEN EXTRACT(YEAR FROM AGE(dob)) = 10 THEN 'Grade 5'
  WHEN EXTRACT(YEAR FROM AGE(dob)) = 11 THEN 'Grade 6'
  WHEN EXTRACT(YEAR FROM AGE(dob)) = 12 THEN 'Grade 7'
  WHEN EXTRACT(YEAR FROM AGE(dob)) = 13 THEN 'Grade 8'
  WHEN EXTRACT(YEAR FROM AGE(dob)) = 14 THEN 'Grade 9'
  WHEN EXTRACT(YEAR FROM AGE(dob)) = 15 THEN 'Grade 10'
  WHEN EXTRACT(YEAR FROM AGE(dob)) = 16 THEN 'Grade 11'
  WHEN EXTRACT(YEAR FROM AGE(dob)) = 17 THEN 'Grade 12'
  WHEN EXTRACT(YEAR FROM AGE(dob)) BETWEEN 18 AND 22 THEN 'College'
  WHEN EXTRACT(YEAR FROM AGE(dob)) BETWEEN 23 AND 25 THEN 'Post-Grad'
END
WHERE is_student = true AND student_grade IS NULL;

-- Update family activity dates
UPDATE families f
SET last_activity_at = COALESCE(
  (SELECT MAX(fm.joined_at) FROM family_members fm WHERE fm.family_id = f.id),
  f.created_at
)
WHERE last_activity_at IS NULL;

-- Mark families as inactive if no activity in 90 days
UPDATE families
SET is_active = false
WHERE last_activity_at < NOW() - INTERVAL '90 days'
  AND is_active = true;

-- Populate initial fact tables
SELECT refresh_family_temple_facts();
SELECT refresh_member_demographics();

-- ============================================================
-- STEP 11: Create Triggers for Auto-Update
-- ============================================================

-- Trigger to update last_activity_at when member added
CREATE OR REPLACE FUNCTION update_family_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE families
  SET last_activity_at = NOW(),
      is_active = true
  WHERE id = NEW.family_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_family_member_activity
  AFTER INSERT OR UPDATE ON family_members
  FOR EACH ROW
  EXECUTE FUNCTION update_family_activity();

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check demographic data coverage
SELECT 
  'Users' AS table_name,
  COUNT(*) AS total,
  SUM(CASE WHEN education_level IS NOT NULL THEN 1 ELSE 0 END) AS with_education,
  SUM(CASE WHEN occupation IS NOT NULL THEN 1 ELSE 0 END) AS with_occupation,
  SUM(CASE WHEN is_student = true THEN 1 ELSE 0 END) AS students,
  SUM(CASE WHEN student_grade IS NOT NULL THEN 1 ELSE 0 END) AS with_grade
FROM users;

-- Check temple geographic data
SELECT 
  'Temples' AS table_name,
  COUNT(*) AS total,
  SUM(CASE WHEN district IS NOT NULL THEN 1 ELSE 0 END) AS with_district,
  SUM(CASE WHEN state IS NOT NULL THEN 1 ELSE 0 END) AS with_state,
  SUM(CASE WHEN latitude IS NOT NULL THEN 1 ELSE 0 END) AS with_coordinates
FROM temples;

-- Check fact table population
SELECT 
  'Fact Tables' AS table_name,
  (SELECT COUNT(*) FROM family_temple_facts) AS family_temple_facts,
  (SELECT COUNT(*) FROM member_demographics) AS member_demographics;

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Analytics Foundation Migration Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables created: 5';
  RAISE NOTICE '  - family_temple_facts';
  RAISE NOTICE '  - member_demographics';
  RAISE NOTICE '  - analytics_cache';
  RAISE NOTICE '  - user_subscriptions';
  RAISE NOTICE '  - analytics_access_log';
  RAISE NOTICE '';
  RAISE NOTICE 'Columns added:';
  RAISE NOTICE '  - users: 5 demographic fields';
  RAISE NOTICE '  - temples: 5 geographic fields';
  RAISE NOTICE '  - families: 2 activity fields';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions created: 4';
  RAISE NOTICE '  - get_age_group()';
  RAISE NOTICE '  - refresh_family_temple_facts()';
  RAISE NOTICE '  - refresh_member_demographics()';
  RAISE NOTICE '  - cleanup_expired_cache()';
  RAISE NOTICE '';
  RAISE NOTICE 'Triggers created: 1';
  RAISE NOTICE '  - Auto-update family activity';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Review verification queries above';
  RAISE NOTICE '  2. Backfill temple district/state data';
  RAISE NOTICE '  3. Create materialized views (next migration)';
  RAISE NOTICE '  4. Schedule nightly fact table refresh';
  RAISE NOTICE '========================================';
END $$;
