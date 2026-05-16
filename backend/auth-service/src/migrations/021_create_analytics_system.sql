/**
 * =====================================================================
 * Migration 021: Temple Analytics & Reporting System
 * Company: emeelan
 * Date: 2026-04-09
 * =====================================================================
 * Creates data warehouse style tables for comprehensive temple analytics
 * Two-dimensional drill-down: Demographics × Geography
 */

-- =====================================================================
-- DIMENSION TABLES
-- =====================================================================

-- Dimension: Geography (Temple Locations)
CREATE TABLE IF NOT EXISTS dim_geography (
  id SERIAL PRIMARY KEY,
  temple_id INTEGER REFERENCES temples(id) ON DELETE CASCADE,
  temple_name VARCHAR(200),
  village VARCHAR(100),
  tehsil VARCHAR(100),
  district VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'India',
  pincode VARCHAR(10),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dim_geo_temple ON dim_geography(temple_id);
CREATE INDEX idx_dim_geo_location ON dim_geography(village, tehsil, district, state);

COMMENT ON TABLE dim_geography IS 'Geographic hierarchy for temple locations';

-- Dimension: Age Ranges
CREATE TABLE IF NOT EXISTS dim_age_ranges (
  id SERIAL PRIMARY KEY,
  range_name VARCHAR(20) NOT NULL UNIQUE,
  min_age INTEGER NOT NULL,
  max_age INTEGER,
  display_order INTEGER
);

INSERT INTO dim_age_ranges (range_name, min_age, max_age, display_order) VALUES
  ('Children (0-12)', 0, 12, 1),
  ('Teenagers (13-18)', 13, 18, 2),
  ('Young Adults (19-30)', 19, 30, 3),
  ('Adults (31-45)', 31, 45, 4),
  ('Middle Age (46-60)', 46, 60, 5),
  ('Senior (61+)', 61, 999, 6)
ON CONFLICT (range_name) DO NOTHING;

COMMENT ON TABLE dim_age_ranges IS 'Age range categories for demographic analysis';

-- Dimension: Professions
CREATE TABLE IF NOT EXISTS dim_professions (
  id SERIAL PRIMARY KEY,
  profession_name VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(50),
  display_order INTEGER
);

INSERT INTO dim_professions (profession_name, category, display_order) VALUES
  ('Government Employee', 'Government', 1),
  ('Teacher/Professor', 'Education', 2),
  ('Doctor/Medical', 'Healthcare', 3),
  ('Engineer', 'Technical', 4),
  ('Farmer', 'Agriculture', 5),
  ('Business Owner', 'Self-Employed', 6),
  ('Shopkeeper', 'Self-Employed', 7),
  ('Private Employee', 'Private', 8),
  ('Software Professional', 'IT', 9),
  ('Lawyer', 'Legal', 10),
  ('Accountant', 'Finance', 11),
  ('Artist/Craftsman', 'Arts', 12),
  ('Driver', 'Transport', 13),
  ('Laborer', 'Labor', 14),
  ('Student', 'Education', 15),
  ('Homemaker', 'Domestic', 16),
  ('Retired', 'Other', 17),
  ('Unemployed', 'Other', 18)
ON CONFLICT (profession_name) DO NOTHING;

COMMENT ON TABLE dim_professions IS 'Profession categories with Indian context';

-- Dimension: Business Types
CREATE TABLE IF NOT EXISTS dim_business_types (
  id SERIAL PRIMARY KEY,
  business_type VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(50),
  display_order INTEGER
);

INSERT INTO dim_business_types (business_type, category, display_order) VALUES
  ('Kirana Store (Grocery)', 'Retail', 1),
  ('Textile/Cloth Business', 'Retail', 2),
  ('Restaurant/Food', 'Hospitality', 3),
  ('Pharmacy/Medical Store', 'Healthcare', 4),
  ('Jewelry Business', 'Retail', 5),
  ('Real Estate', 'Real Estate', 6),
  ('Transport/Logistics', 'Transport', 7),
  ('Electronics Shop', 'Retail', 8),
  ('Agriculture/Farming', 'Agriculture', 9),
  ('Construction', 'Construction', 10),
  ('IT/Software Company', 'IT', 11),
  ('Manufacturing', 'Manufacturing', 12),
  ('Trading/Export-Import', 'Trading', 13),
  ('Education/Coaching', 'Education', 14),
  ('Hotel/Lodging', 'Hospitality', 15)
ON CONFLICT (business_type) DO NOTHING;

COMMENT ON TABLE dim_business_types IS 'Business type categories for Indian context';

-- Dimension: Gotras
CREATE TABLE IF NOT EXISTS dim_gotras (
  id SERIAL PRIMARY KEY,
  gotra_name VARCHAR(100) NOT NULL UNIQUE,
  lineage VARCHAR(100),
  display_order INTEGER
);

-- Will be populated from gotra.json
COMMENT ON TABLE dim_gotras IS 'Gotra (lineage) categories for Hindu families';

-- =====================================================================
-- FACT TABLES (Pre-Aggregated Summaries)
-- =====================================================================

-- Fact: Demographic Summary
CREATE TABLE IF NOT EXISTS fact_demographic_summary (
  id SERIAL PRIMARY KEY,
  temple_id INTEGER REFERENCES temples(id) ON DELETE CASCADE,
  village VARCHAR(100),
  tehsil VARCHAR(100),
  district VARCHAR(100),
  state VARCHAR(100),
  
  -- Totals
  total_members INTEGER DEFAULT 0,
  total_families INTEGER DEFAULT 0,
  
  -- Gender
  male_count INTEGER DEFAULT 0,
  female_count INTEGER DEFAULT 0,
  other_gender_count INTEGER DEFAULT 0,
  
  -- Marital Status
  married_count INTEGER DEFAULT 0,
  bachelor_count INTEGER DEFAULT 0,
  unmarried_count INTEGER DEFAULT 0,
  
  -- Metadata
  snapshot_date DATE DEFAULT CURRENT_DATE,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(temple_id, snapshot_date)
);

CREATE INDEX idx_fact_demo_temple ON fact_demographic_summary(temple_id);
CREATE INDEX idx_fact_demo_location ON fact_demographic_summary(village, tehsil, district, state);
CREATE INDEX idx_fact_demo_date ON fact_demographic_summary(snapshot_date);

COMMENT ON TABLE fact_demographic_summary IS 'Pre-aggregated demographic statistics by temple and location';

-- Fact: Age Range Summary
CREATE TABLE IF NOT EXISTS fact_age_range_summary (
  id SERIAL PRIMARY KEY,
  temple_id INTEGER REFERENCES temples(id) ON DELETE CASCADE,
  age_range_id INTEGER REFERENCES dim_age_ranges(id),
  village VARCHAR(100),
  tehsil VARCHAR(100),
  district VARCHAR(100),
  state VARCHAR(100),
  
  male_count INTEGER DEFAULT 0,
  female_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  
  snapshot_date DATE DEFAULT CURRENT_DATE,
  
  UNIQUE(temple_id, age_range_id, snapshot_date)
);

CREATE INDEX idx_fact_age_temple ON fact_age_range_summary(temple_id);
CREATE INDEX idx_fact_age_range ON fact_age_range_summary(age_range_id);

COMMENT ON TABLE fact_age_range_summary IS 'Age distribution summary by temple';

-- Fact: Profession Summary
CREATE TABLE IF NOT EXISTS fact_profession_summary (
  id SERIAL PRIMARY KEY,
  temple_id INTEGER REFERENCES temples(id) ON DELETE CASCADE,
  profession_id INTEGER REFERENCES dim_professions(id),
  village VARCHAR(100),
  tehsil VARCHAR(100),
  district VARCHAR(100),
  state VARCHAR(100),
  
  member_count INTEGER DEFAULT 0,
  male_count INTEGER DEFAULT 0,
  female_count INTEGER DEFAULT 0,
  
  snapshot_date DATE DEFAULT CURRENT_DATE,
  
  UNIQUE(temple_id, profession_id, snapshot_date)
);

CREATE INDEX idx_fact_prof_temple ON fact_profession_summary(temple_id);
CREATE INDEX idx_fact_prof_profession ON fact_profession_summary(profession_id);

COMMENT ON TABLE fact_profession_summary IS 'Profession distribution by temple';

-- Fact: Business Summary
CREATE TABLE IF NOT EXISTS fact_business_summary (
  id SERIAL PRIMARY KEY,
  temple_id INTEGER REFERENCES temples(id) ON DELETE CASCADE,
  business_type_id INTEGER REFERENCES dim_business_types(id),
  village VARCHAR(100),
  tehsil VARCHAR(100),
  district VARCHAR(100),
  state VARCHAR(100),
  
  business_count INTEGER DEFAULT 0,
  owner_count INTEGER DEFAULT 0,
  
  snapshot_date DATE DEFAULT CURRENT_DATE,
  
  UNIQUE(temple_id, business_type_id, snapshot_date)
);

CREATE INDEX idx_fact_bus_temple ON fact_business_summary(temple_id);
CREATE INDEX idx_fact_bus_type ON fact_business_summary(business_type_id);

COMMENT ON TABLE fact_business_summary IS 'Business type distribution by temple';

-- Fact: Gotra Summary
CREATE TABLE IF NOT EXISTS fact_gotra_summary (
  id SERIAL PRIMARY KEY,
  temple_id INTEGER REFERENCES temples(id) ON DELETE CASCADE,
  gotra_id INTEGER REFERENCES dim_gotras(id),
  village VARCHAR(100),
  tehsil VARCHAR(100),
  district VARCHAR(100),
  state VARCHAR(100),
  
  family_count INTEGER DEFAULT 0,
  member_count INTEGER DEFAULT 0,
  
  snapshot_date DATE DEFAULT CURRENT_DATE,
  
  UNIQUE(temple_id, gotra_id, snapshot_date)
);

CREATE INDEX idx_fact_gotra_temple ON fact_gotra_summary(temple_id);
CREATE INDEX idx_fact_gotra_gotra ON fact_gotra_summary(gotra_id);

COMMENT ON TABLE fact_gotra_summary IS 'Gotra distribution by temple';

-- Fact: Family Summary
CREATE TABLE IF NOT EXISTS fact_family_summary (
  id SERIAL PRIMARY KEY,
  temple_id INTEGER REFERENCES temples(id) ON DELETE CASCADE,
  family_id INTEGER REFERENCES families(id),
  village VARCHAR(100),
  tehsil VARCHAR(100),
  district VARCHAR(100),
  state VARCHAR(100),
  
  family_size INTEGER DEFAULT 0,
  male_members INTEGER DEFAULT 0,
  female_members INTEGER DEFAULT 0,
  children_count INTEGER DEFAULT 0,
  adults_count INTEGER DEFAULT 0,
  seniors_count INTEGER DEFAULT 0,
  
  gotra VARCHAR(100),
  head_of_family VARCHAR(200),
  
  snapshot_date DATE DEFAULT CURRENT_DATE,
  
  UNIQUE(family_id, snapshot_date)
);

CREATE INDEX idx_fact_family_temple ON fact_family_summary(temple_id);
CREATE INDEX idx_fact_family_family ON fact_family_summary(family_id);
CREATE INDEX idx_fact_family_gotra ON fact_family_summary(gotra);

COMMENT ON TABLE fact_family_summary IS 'Family composition statistics';

-- Fact: Migration Summary
CREATE TABLE IF NOT EXISTS fact_migration_summary (
  id SERIAL PRIMARY KEY,
  temple_id INTEGER REFERENCES temples(id) ON DELETE CASCADE,
  village VARCHAR(100),
  tehsil VARCHAR(100),
  district VARCHAR(100),
  state VARCHAR(100),
  
  -- Members living outside temple area
  migrated_count INTEGER DEFAULT 0,
  
  -- Migration reasons
  business_migration INTEGER DEFAULT 0,
  education_migration INTEGER DEFAULT 0,
  employment_migration INTEGER DEFAULT 0,
  marriage_migration INTEGER DEFAULT 0,
  other_migration INTEGER DEFAULT 0,
  
  -- Migration destinations (JSON array of top locations)
  top_destinations JSONB DEFAULT '[]',
  
  snapshot_date DATE DEFAULT CURRENT_DATE,
  
  UNIQUE(temple_id, snapshot_date)
);

CREATE INDEX idx_fact_migration_temple ON fact_migration_summary(temple_id);

COMMENT ON TABLE fact_migration_summary IS 'Member migration statistics';

-- =====================================================================
-- ETL HELPER FUNCTIONS
-- =====================================================================

-- Function to refresh demographic summary
CREATE OR REPLACE FUNCTION refresh_demographic_summary(p_temple_id INTEGER DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  DELETE FROM fact_demographic_summary 
  WHERE snapshot_date = CURRENT_DATE 
    AND (p_temple_id IS NULL OR temple_id = p_temple_id);
  
  INSERT INTO fact_demographic_summary (
    temple_id, village, tehsil, district, state,
    total_members, total_families,
    male_count, female_count, other_gender_count,
    married_count, bachelor_count, unmarried_count
  )
  SELECT 
    t.id as temple_id,
    COALESCE(dg.village, 'Unknown') as village,
    COALESCE(dg.tehsil, 'Unknown') as tehsil,
    COALESCE(dg.district, 'Unknown') as district,
    COALESCE(dg.state, 'Unknown') as state,
    COUNT(DISTINCT u.id) as total_members,
    COUNT(DISTINCT f.id) as total_families,
    COUNT(DISTINCT CASE WHEN u.gender = 'Male' THEN u.id END) as male_count,
    COUNT(DISTINCT CASE WHEN u.gender = 'Female' THEN u.id END) as female_count,
    COUNT(DISTINCT CASE WHEN u.gender NOT IN ('Male', 'Female') THEN u.id END) as other_gender_count,
    COUNT(DISTINCT CASE WHEN u.marital_status = 'Married' THEN u.id END) as married_count,
    COUNT(DISTINCT CASE WHEN u.marital_status = 'Unmarried' THEN u.id END) as bachelor_count,
    COUNT(DISTINCT CASE WHEN u.marital_status IS NULL THEN u.id END) as unmarried_count
  FROM temples t
  LEFT JOIN dim_geography dg ON dg.temple_id = t.id
  LEFT JOIN families f ON f.temple_id = t.id
  LEFT JOIN users u ON u.family_id = f.id
  WHERE t.is_active = true
    AND (p_temple_id IS NULL OR t.id = p_temple_id)
  GROUP BY t.id, dg.village, dg.tehsil, dg.district, dg.state;
  
  RAISE NOTICE 'Demographic summary refreshed for temple_id: %', COALESCE(p_temple_id::TEXT, 'ALL');
END;
$$ LANGUAGE plpgsql;

-- Function to refresh all analytics summaries
CREATE OR REPLACE FUNCTION refresh_all_analytics(p_temple_id INTEGER DEFAULT NULL)
RETURNS TEXT AS $$
BEGIN
  PERFORM refresh_demographic_summary(p_temple_id);
  
  RETURN 'Analytics refreshed successfully for temple_id: ' || COALESCE(p_temple_id::TEXT, 'ALL');
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- Initial Geography Data (sync from temples table)
-- =====================================================================
INSERT INTO dim_geography (temple_id, temple_name, village, tehsil, district, state, pincode)
SELECT 
  id,
  name,
  address as village,
  'Unknown' as tehsil,
  'Unknown' as district,
  'Unknown' as state,
  NULL as pincode
FROM temples
WHERE id NOT IN (SELECT temple_id FROM dim_geography WHERE temple_id IS NOT NULL)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- End of Migration 021
-- =====================================================================
