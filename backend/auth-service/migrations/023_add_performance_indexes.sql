/**
 * Migration 023: Add Performance Indexes
 * Purpose: Optimize queries for 1M+ records with filtering, sorting, pagination
 */

-- =====================================================
-- DROP INDEXES (for rollback)
-- =====================================================

-- DROP INDEX IF EXISTS idx_members_state;
-- DROP INDEX IF EXISTS idx_members_district;
-- DROP INDEX IF EXISTS idx_members_tehsil;
-- DROP INDEX IF EXISTS idx_members_gotra_id;
-- DROP INDEX IF EXISTS idx_members_age;
-- DROP INDEX IF EXISTS idx_members_gender;
-- DROP INDEX IF EXISTS idx_members_marital_status;
-- DROP INDEX IF EXISTS idx_members_name;
-- DROP INDEX IF EXISTS idx_members_phone;
-- DROP INDEX IF EXISTS idx_members_state_district;
-- DROP INDEX IF EXISTS idx_members_state_gotra;
-- DROP INDEX IF EXISTS idx_families_state;
-- DROP INDEX IF EXISTS idx_families_district;
-- DROP INDEX IF EXISTS idx_families_head_member_id;

-- =====================================================
-- USERS TABLE INDEXES (members data)
-- =====================================================

-- Single column indexes for common filters
CREATE INDEX IF NOT EXISTS idx_users_gender ON users(gender);
CREATE INDEX IF NOT EXISTS idx_users_marital_status ON users(marital_status);
CREATE INDEX IF NOT EXISTS idx_users_first_name ON users(first_name);
CREATE INDEX IF NOT EXISTS idx_users_gotra ON users(gotra);
CREATE INDEX IF NOT EXISTS idx_users_dob ON users(dob);
CREATE INDEX IF NOT EXISTS idx_users_temple_id ON users(temple_id);

-- Index for phone search
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Index for family relationship (IMPORTANT for JOINs)
CREATE INDEX IF NOT EXISTS idx_users_family_id ON users(family_id);

-- Composite indexes
CREATE INDEX IF NOT EXISTS idx_users_temple_gender ON users(temple_id, gender);
CREATE INDEX IF NOT EXISTS idx_users_gotra_gender ON users(gotra, gender);

-- =====================================================
-- FAMILIES TABLE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_families_state ON families(state);
CREATE INDEX IF NOT EXISTS idx_families_district ON families(district);
CREATE INDEX IF NOT EXISTS idx_families_tehsil ON families(tehsil);
CREATE INDEX IF NOT EXISTS idx_families_village ON families(village);
CREATE INDEX IF NOT EXISTS idx_families_gotra ON families(gotra);
CREATE INDEX IF NOT EXISTS idx_families_temple_id ON families(temple_id);

-- Agriculture-related indexes
CREATE INDEX IF NOT EXISTS idx_families_agri_land ON families(agriculture_land_acres) WHERE agriculture_land_acres > 0;
CREATE INDEX IF NOT EXISTS idx_families_agri_income ON families(agriculture_income_yearly) WHERE agriculture_income_yearly > 0;

-- Composite indexes
CREATE INDEX IF NOT EXISTS idx_families_state_district ON families(state, district);
CREATE INDEX IF NOT EXISTS idx_families_state_gotra ON families(state, gotra);

-- =====================================================
-- ANALYTICS FACT TABLE INDEXES
-- =====================================================

-- Demographic summary indexes
CREATE INDEX IF NOT EXISTS idx_fact_demographic_temple ON fact_demographic_summary(temple_id);
CREATE INDEX IF NOT EXISTS idx_fact_demographic_state ON fact_demographic_summary(state);
CREATE INDEX IF NOT EXISTS idx_fact_demographic_district ON fact_demographic_summary(district);
CREATE INDEX IF NOT EXISTS idx_fact_demographic_date ON fact_demographic_summary(snapshot_date);

-- Gotra summary indexes
CREATE INDEX IF NOT EXISTS idx_fact_gotra_temple ON fact_gotra_summary(temple_id);
CREATE INDEX IF NOT EXISTS idx_fact_gotra_gotra_id ON fact_gotra_summary(gotra_id);
CREATE INDEX IF NOT EXISTS idx_fact_gotra_date ON fact_gotra_summary(snapshot_date);

-- Age distribution indexes
CREATE INDEX IF NOT EXISTS idx_fact_age_temple ON fact_age_range_summary(temple_id);
CREATE INDEX IF NOT EXISTS idx_fact_age_range ON fact_age_range_summary(age_range_id);
CREATE INDEX IF NOT EXISTS idx_fact_age_date ON fact_age_range_summary(snapshot_date);

-- Agriculture summary indexes
CREATE INDEX IF NOT EXISTS idx_fact_agri_temple ON fact_agriculture_summary(temple_id);
CREATE INDEX IF NOT EXISTS idx_fact_agri_state ON fact_agriculture_summary(state);
CREATE INDEX IF NOT EXISTS idx_fact_agri_date ON fact_agriculture_summary(snapshot_date);

-- Occupation summary indexes
CREATE INDEX IF NOT EXISTS idx_fact_occ_temple ON fact_occupation_summary(temple_id);
CREATE INDEX IF NOT EXISTS idx_fact_occ_state ON fact_occupation_summary(state);
CREATE INDEX IF NOT EXISTS idx_fact_occ_date ON fact_occupation_summary(snapshot_date);

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  index_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE tablename IN ('users', 'families', 'fact_demographic_summary', 
                     'fact_gotra_summary', 'fact_age_range_summary',
                     'fact_agriculture_summary', 'fact_occupation_summary')
    AND indexname LIKE 'idx_%';
  
  RAISE NOTICE '✅ Created % performance indexes', index_count;
  
  IF index_count >= 20 THEN
    RAISE NOTICE '✅ All indexes created successfully!';
  ELSE
    RAISE WARNING '⚠️ Expected at least 20 indexes, found %', index_count;
  END IF;
END $$;

-- =====================================================
-- ANALYZE TABLES
-- =====================================================

ANALYZE users;
ANALYZE families;
ANALYZE fact_demographic_summary;
ANALYZE fact_gotra_summary;
ANALYZE fact_age_range_summary;
ANALYZE fact_agriculture_summary;
ANALYZE fact_occupation_summary;

COMMENT ON INDEX idx_users_family_id IS 'Performance index for JOIN with families table';
COMMENT ON INDEX idx_families_state IS 'Performance index for state filtering';
COMMENT ON INDEX idx_families_district IS 'Performance index for district filtering';
COMMENT ON INDEX idx_families_state_district IS 'Composite index for state+district filtering';
