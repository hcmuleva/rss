/**
 * =====================================================================
 * Migration 022: Advanced Analytics Metrics
 * Company: emeelan
 * Date: 2026-04-09
 * =====================================================================
 * Adds:
 * 1. Agriculture land tracking per family
 * 2. Enhanced demographic metrics (marital status x gender)
 * 3. Job vs Business metrics
 */

-- =====================================================================
-- 1. ADD AGRICULTURE LAND TO FAMILIES
-- =====================================================================

-- Add agriculture land fields to families table
ALTER TABLE families 
ADD COLUMN IF NOT EXISTS agriculture_land_acres DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS agriculture_land_type VARCHAR(50), -- Irrigated, Rain-fed, Mixed
ADD COLUMN IF NOT EXISTS agriculture_crops TEXT, -- JSON array of crops
ADD COLUMN IF NOT EXISTS agriculture_income_yearly DECIMAL(12, 2);

COMMENT ON COLUMN families.agriculture_land_acres IS 'Total agricultural land owned by family in acres';
COMMENT ON COLUMN families.agriculture_land_type IS 'Type of land: Irrigated, Rain-fed, Mixed';
COMMENT ON COLUMN families.agriculture_crops IS 'Main crops grown (JSON array)';
COMMENT ON COLUMN families.agriculture_income_yearly IS 'Estimated yearly income from agriculture';

-- =====================================================================
-- 2. ENHANCED DEMOGRAPHIC FACT TABLE
-- =====================================================================

-- Drop and recreate demographic summary with enhanced fields
DROP TABLE IF EXISTS fact_demographic_summary CASCADE;

CREATE TABLE fact_demographic_summary (
  id SERIAL PRIMARY KEY,
  temple_id INTEGER REFERENCES temples(id) ON DELETE CASCADE,
  village VARCHAR(100),
  tehsil VARCHAR(100),
  district VARCHAR(100),
  state VARCHAR(100),
  
  -- Totals
  total_members INTEGER DEFAULT 0,
  total_families INTEGER DEFAULT 0,
  
  -- Gender breakdown
  male_count INTEGER DEFAULT 0,
  female_count INTEGER DEFAULT 0,
  other_gender_count INTEGER DEFAULT 0,
  
  -- Marital Status x Gender (6 categories)
  married_male INTEGER DEFAULT 0,
  married_female INTEGER DEFAULT 0,
  bachelor_male INTEGER DEFAULT 0,
  bachelor_female INTEGER DEFAULT 0,
  divorced_male INTEGER DEFAULT 0,
  divorced_female INTEGER DEFAULT 0,
  widowed_male INTEGER DEFAULT 0,
  widowed_female INTEGER DEFAULT 0,
  
  -- Old fields for compatibility
  married_count INTEGER DEFAULT 0,
  bachelor_count INTEGER DEFAULT 0,
  unmarried_count INTEGER DEFAULT 0,
  
  snapshot_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(temple_id, snapshot_date)
);

CREATE INDEX idx_fact_demo_temple ON fact_demographic_summary(temple_id);
CREATE INDEX idx_fact_demo_location ON fact_demographic_summary(village, tehsil, district, state);
CREATE INDEX idx_fact_demo_date ON fact_demographic_summary(snapshot_date);

COMMENT ON TABLE fact_demographic_summary IS 'Enhanced demographic summary with marital status x gender breakdown';

-- =====================================================================
-- 3. AGRICULTURE LAND SUMMARY FACT TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS fact_agriculture_summary (
  id SERIAL PRIMARY KEY,
  temple_id INTEGER REFERENCES temples(id) ON DELETE CASCADE,
  village VARCHAR(100),
  tehsil VARCHAR(100),
  district VARCHAR(100),
  state VARCHAR(100),
  
  -- Family counts
  total_families INTEGER DEFAULT 0,
  families_with_land INTEGER DEFAULT 0,
  families_without_land INTEGER DEFAULT 0,
  
  -- Land metrics
  total_land_acres DECIMAL(12, 2) DEFAULT 0,
  avg_land_per_family DECIMAL(10, 2) DEFAULT 0,
  max_land_acres DECIMAL(10, 2) DEFAULT 0,
  min_land_acres DECIMAL(10, 2) DEFAULT 0,
  
  -- Land types
  irrigated_land_acres DECIMAL(12, 2) DEFAULT 0,
  rainfed_land_acres DECIMAL(12, 2) DEFAULT 0,
  mixed_land_acres DECIMAL(12, 2) DEFAULT 0,
  
  -- Income
  total_agri_income DECIMAL(15, 2) DEFAULT 0,
  avg_income_per_family DECIMAL(12, 2) DEFAULT 0,
  
  snapshot_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(temple_id, snapshot_date)
);

CREATE INDEX idx_fact_agri_temple ON fact_agriculture_summary(temple_id);
CREATE INDEX idx_fact_agri_location ON fact_agriculture_summary(village, tehsil, district, state);

COMMENT ON TABLE fact_agriculture_summary IS 'Agricultural land ownership and income metrics';

-- =====================================================================
-- 4. JOB VS BUSINESS FACT TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS fact_occupation_summary (
  id SERIAL PRIMARY KEY,
  temple_id INTEGER REFERENCES temples(id) ON DELETE CASCADE,
  village VARCHAR(100),
  tehsil VARCHAR(100),
  district VARCHAR(100),
  state VARCHAR(100),
  
  -- Total counts
  total_working_members INTEGER DEFAULT 0,
  
  -- Job categories
  government_job INTEGER DEFAULT 0,
  private_job INTEGER DEFAULT 0,
  self_employed INTEGER DEFAULT 0,
  
  -- Business categories
  shop_business INTEGER DEFAULT 0,
  trading_business INTEGER DEFAULT 0,
  manufacturing_business INTEGER DEFAULT 0,
  service_business INTEGER DEFAULT 0,
  agriculture_business INTEGER DEFAULT 0,
  other_business INTEGER DEFAULT 0,
  
  -- Aggregates
  total_in_jobs INTEGER DEFAULT 0, -- government + private
  total_in_business INTEGER DEFAULT 0, -- all business types
  
  -- Students and others
  student_count INTEGER DEFAULT 0,
  homemaker_count INTEGER DEFAULT 0,
  retired_count INTEGER DEFAULT 0,
  unemployed_count INTEGER DEFAULT 0,
  
  snapshot_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(temple_id, snapshot_date)
);

CREATE INDEX idx_fact_occup_temple ON fact_occupation_summary(temple_id);
CREATE INDEX idx_fact_occup_location ON fact_occupation_summary(village, tehsil, district, state);

COMMENT ON TABLE fact_occupation_summary IS 'Job vs Business occupation metrics';

-- =====================================================================
-- 5. ETL FUNCTIONS FOR NEW METRICS
-- =====================================================================

-- Function to refresh demographic summary with enhanced fields
CREATE OR REPLACE FUNCTION refresh_demographic_summary_enhanced(p_temple_id INTEGER DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  DELETE FROM fact_demographic_summary 
  WHERE snapshot_date = CURRENT_DATE 
    AND (p_temple_id IS NULL OR temple_id = p_temple_id);
  
  INSERT INTO fact_demographic_summary (
    temple_id, village, tehsil, district, state,
    total_members, total_families,
    male_count, female_count, other_gender_count,
    married_male, married_female,
    bachelor_male, bachelor_female,
    divorced_male, divorced_female,
    widowed_male, widowed_female,
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
    
    -- Gender
    COUNT(DISTINCT CASE WHEN u.gender = 'Male' THEN u.id END) as male_count,
    COUNT(DISTINCT CASE WHEN u.gender = 'Female' THEN u.id END) as female_count,
    COUNT(DISTINCT CASE WHEN u.gender NOT IN ('Male', 'Female') OR u.gender IS NULL THEN u.id END) as other_gender_count,
    
    -- Marital Status x Gender
    COUNT(DISTINCT CASE WHEN u.marital_status = 'Married' AND u.gender = 'Male' THEN u.id END) as married_male,
    COUNT(DISTINCT CASE WHEN u.marital_status = 'Married' AND u.gender = 'Female' THEN u.id END) as married_female,
    COUNT(DISTINCT CASE WHEN u.marital_status IN ('Unmarried', 'Single') AND u.gender = 'Male' THEN u.id END) as bachelor_male,
    COUNT(DISTINCT CASE WHEN u.marital_status IN ('Unmarried', 'Single') AND u.gender = 'Female' THEN u.id END) as bachelor_female,
    COUNT(DISTINCT CASE WHEN u.marital_status = 'Divorced' AND u.gender = 'Male' THEN u.id END) as divorced_male,
    COUNT(DISTINCT CASE WHEN u.marital_status = 'Divorced' AND u.gender = 'Female' THEN u.id END) as divorced_female,
    COUNT(DISTINCT CASE WHEN u.marital_status = 'Widowed' AND u.gender = 'Male' THEN u.id END) as widowed_male,
    COUNT(DISTINCT CASE WHEN u.marital_status = 'Widowed' AND u.gender = 'Female' THEN u.id END) as widowed_female,
    
    -- Old fields for compatibility
    COUNT(DISTINCT CASE WHEN u.marital_status = 'Married' THEN u.id END) as married_count,
    COUNT(DISTINCT CASE WHEN u.marital_status IN ('Unmarried', 'Single') THEN u.id END) as bachelor_count,
    COUNT(DISTINCT CASE WHEN u.marital_status IS NULL OR u.marital_status = '' THEN u.id END) as unmarried_count
    
  FROM temples t
  LEFT JOIN dim_geography dg ON dg.temple_id = t.id
  LEFT JOIN families f ON f.temple_id = t.id
  LEFT JOIN users u ON u.family_id = f.id
  WHERE t.is_active = true
    AND (p_temple_id IS NULL OR t.id = p_temple_id)
  GROUP BY t.id, dg.village, dg.tehsil, dg.district, dg.state;
  
  RAISE NOTICE 'Enhanced demographic summary refreshed';
END;
$$ LANGUAGE plpgsql;

-- Function to refresh agriculture summary
CREATE OR REPLACE FUNCTION refresh_agriculture_summary(p_temple_id INTEGER DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  DELETE FROM fact_agriculture_summary 
  WHERE snapshot_date = CURRENT_DATE 
    AND (p_temple_id IS NULL OR temple_id = p_temple_id);
  
  INSERT INTO fact_agriculture_summary (
    temple_id, village, tehsil, district, state,
    total_families, families_with_land, families_without_land,
    total_land_acres, avg_land_per_family, max_land_acres, min_land_acres,
    irrigated_land_acres, rainfed_land_acres, mixed_land_acres,
    total_agri_income, avg_income_per_family
  )
  SELECT 
    t.id as temple_id,
    COALESCE(dg.village, 'Unknown') as village,
    COALESCE(dg.tehsil, 'Unknown') as tehsil,
    COALESCE(dg.district, 'Unknown') as district,
    COALESCE(dg.state, 'Unknown') as state,
    
    COUNT(f.id) as total_families,
    COUNT(CASE WHEN f.agriculture_land_acres > 0 THEN 1 END) as families_with_land,
    COUNT(CASE WHEN COALESCE(f.agriculture_land_acres, 0) = 0 THEN 1 END) as families_without_land,
    
    COALESCE(SUM(f.agriculture_land_acres), 0) as total_land_acres,
    COALESCE(AVG(NULLIF(f.agriculture_land_acres, 0)), 0) as avg_land_per_family,
    COALESCE(MAX(f.agriculture_land_acres), 0) as max_land_acres,
    COALESCE(MIN(NULLIF(f.agriculture_land_acres, 0)), 0) as min_land_acres,
    
    COALESCE(SUM(CASE WHEN f.agriculture_land_type = 'Irrigated' THEN f.agriculture_land_acres ELSE 0 END), 0) as irrigated_land_acres,
    COALESCE(SUM(CASE WHEN f.agriculture_land_type = 'Rain-fed' THEN f.agriculture_land_acres ELSE 0 END), 0) as rainfed_land_acres,
    COALESCE(SUM(CASE WHEN f.agriculture_land_type = 'Mixed' THEN f.agriculture_land_acres ELSE 0 END), 0) as mixed_land_acres,
    
    COALESCE(SUM(f.agriculture_income_yearly), 0) as total_agri_income,
    COALESCE(AVG(NULLIF(f.agriculture_income_yearly, 0)), 0) as avg_income_per_family
    
  FROM temples t
  LEFT JOIN dim_geography dg ON dg.temple_id = t.id
  LEFT JOIN families f ON f.temple_id = t.id
  WHERE t.is_active = true
    AND (p_temple_id IS NULL OR t.id = p_temple_id)
  GROUP BY t.id, dg.village, dg.tehsil, dg.district, dg.state
  HAVING COUNT(f.id) > 0;
  
  RAISE NOTICE 'Agriculture summary refreshed';
END;
$$ LANGUAGE plpgsql;

-- Function to refresh occupation summary
CREATE OR REPLACE FUNCTION refresh_occupation_summary(p_temple_id INTEGER DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  DELETE FROM fact_occupation_summary 
  WHERE snapshot_date = CURRENT_DATE 
    AND (p_temple_id IS NULL OR temple_id = p_temple_id);
  
  INSERT INTO fact_occupation_summary (
    temple_id, village, tehsil, district, state,
    total_working_members,
    government_job, private_job, self_employed,
    shop_business, trading_business, manufacturing_business, 
    service_business, agriculture_business, other_business,
    total_in_jobs, total_in_business,
    student_count, homemaker_count, retired_count, unemployed_count
  )
  SELECT 
    t.id as temple_id,
    COALESCE(dg.village, 'Unknown') as village,
    COALESCE(dg.tehsil, 'Unknown') as tehsil,
    COALESCE(dg.district, 'Unknown') as district,
    COALESCE(dg.state, 'Unknown') as state,
    
    COUNT(DISTINCT CASE WHEN u.professions IS NOT NULL AND array_length(u.professions, 1) > 0 THEN u.id END) as total_working_members,
    
    -- Jobs
    COUNT(DISTINCT CASE WHEN 'Government Employee' = ANY(u.professions) THEN u.id END) as government_job,
    COUNT(DISTINCT CASE WHEN 'Private Employee' = ANY(u.professions) THEN u.id END) as private_job,
    COUNT(DISTINCT CASE WHEN 'Self-Employed' = ANY(u.professions) THEN u.id END) as self_employed,
    
    -- Business types
    COUNT(DISTINCT CASE WHEN 'Shopkeeper' = ANY(u.professions) THEN u.id END) as shop_business,
    COUNT(DISTINCT CASE WHEN 'Trading/Business' = ANY(u.professions) THEN u.id END) as trading_business,
    COUNT(DISTINCT CASE WHEN 'Manufacturing' = ANY(u.professions) THEN u.id END) as manufacturing_business,
    COUNT(DISTINCT CASE WHEN 'Service Provider' = ANY(u.professions) THEN u.id END) as service_business,
    COUNT(DISTINCT CASE WHEN 'Farmer' = ANY(u.professions) OR 'Agriculture' = ANY(u.professions) THEN u.id END) as agriculture_business,
    COUNT(DISTINCT CASE WHEN 'Business Owner' = ANY(u.professions) THEN u.id END) as other_business,
    
    -- Aggregates
    COUNT(DISTINCT CASE WHEN 'Government Employee' = ANY(u.professions) OR 'Private Employee' = ANY(u.professions) THEN u.id END) as total_in_jobs,
    COUNT(DISTINCT CASE WHEN 'Shopkeeper' = ANY(u.professions) OR 'Business Owner' = ANY(u.professions) OR 'Trading/Business' = ANY(u.professions) THEN u.id END) as total_in_business,
    
    -- Other categories
    COUNT(DISTINCT CASE WHEN 'Student' = ANY(u.professions) THEN u.id END) as student_count,
    COUNT(DISTINCT CASE WHEN 'Homemaker' = ANY(u.professions) THEN u.id END) as homemaker_count,
    COUNT(DISTINCT CASE WHEN 'Retired' = ANY(u.professions) THEN u.id END) as retired_count,
    COUNT(DISTINCT CASE WHEN 'Unemployed' = ANY(u.professions) THEN u.id END) as unemployed_count
    
  FROM temples t
  LEFT JOIN dim_geography dg ON dg.temple_id = t.id
  LEFT JOIN families f ON f.temple_id = t.id
  LEFT JOIN users u ON u.family_id = f.id
  WHERE t.is_active = true
    AND (p_temple_id IS NULL OR t.id = p_temple_id)
  GROUP BY t.id, dg.village, dg.tehsil, dg.district, dg.state;
  
  RAISE NOTICE 'Occupation summary refreshed';
END;
$$ LANGUAGE plpgsql;

-- Update main refresh function
CREATE OR REPLACE FUNCTION refresh_all_analytics(p_temple_id INTEGER DEFAULT NULL)
RETURNS TEXT AS $$
BEGIN
  PERFORM refresh_demographic_summary_enhanced(p_temple_id);
  PERFORM refresh_agriculture_summary(p_temple_id);
  PERFORM refresh_occupation_summary(p_temple_id);
  
  RETURN 'All analytics refreshed successfully for temple_id: ' || COALESCE(p_temple_id::TEXT, 'ALL');
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- End of Migration 022
-- =====================================================================
