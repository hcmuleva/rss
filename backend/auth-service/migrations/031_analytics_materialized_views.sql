/**
 * =====================================================================
 * Analytics Materialized Views - Phase 1 Migration
 * Company: emeelan
 * =====================================================================
 * Creates pre-computed views for fast analytics queries
 * 
 * Materialized Views:
 * 1. temple_demographics_mv - Temple-level demographic summary
 * 2. temple_gotra_distribution_mv - Gotra breakdown by temple
 * 3. temple_student_analytics_mv - Student statistics by temple
 * 4. district_analytics_mv - District-level aggregation
 * 5. state_analytics_mv - State-level aggregation
 * 6. national_analytics_mv - National-level summary
 */

-- ============================================================
-- VIEW 1: Temple Demographics Summary
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS temple_demographics_mv AS
SELECT 
  t.id AS temple_id,
  t.name AS temple_name,
  t.district,
  t.state,
  t.village,
  -- Family Statistics
  COUNT(DISTINCT ft.family_id) AS total_families,
  COUNT(DISTINCT CASE WHEN f.is_active = true THEN ft.family_id END) AS active_families,
  COUNT(DISTINCT f.gotra) AS unique_gotras,
  
  -- Member Statistics
  COUNT(DISTINCT fm.user_id) AS total_members,
  SUM(CASE WHEN u.gender = 'male' THEN 1 ELSE 0 END) AS male_count,
  SUM(CASE WHEN u.gender = 'female' THEN 1 ELSE 0 END) AS female_count,
  ROUND(
    CASE 
      WHEN SUM(CASE WHEN u.gender = 'female' THEN 1 ELSE 0 END) > 0 
      THEN SUM(CASE WHEN u.gender = 'male' THEN 1 ELSE 0 END)::DECIMAL / 
           SUM(CASE WHEN u.gender = 'female' THEN 1 ELSE 0 END)
      ELSE NULL 
    END, 
    2
  ) AS gender_ratio,
  
  -- Age Statistics
  ROUND(AVG(EXTRACT(YEAR FROM AGE(u.dob))), 1) AS avg_age,
  MIN(EXTRACT(YEAR FROM AGE(u.dob))) AS min_age,
  MAX(EXTRACT(YEAR FROM AGE(u.dob))) AS max_age,
  
  -- Family Size Statistics
  ROUND(
    COUNT(DISTINCT fm.user_id)::DECIMAL / 
    NULLIF(COUNT(DISTINCT ft.family_id), 0), 
    2
  ) AS avg_family_size,
  
  -- Student Statistics
  SUM(CASE WHEN u.is_student = true THEN 1 ELSE 0 END) AS student_count,
  ROUND(
    SUM(CASE WHEN u.is_student = true THEN 1 ELSE 0 END)::DECIMAL * 100 / 
    NULLIF(COUNT(DISTINCT fm.user_id), 0),
    2
  ) AS student_percentage,
  
  -- Education Statistics
  SUM(CASE WHEN u.education_level = 'Primary' THEN 1 ELSE 0 END) AS primary_education,
  SUM(CASE WHEN u.education_level = 'Secondary' THEN 1 ELSE 0 END) AS secondary_education,
  SUM(CASE WHEN u.education_level = 'Higher Secondary' THEN 1 ELSE 0 END) AS higher_secondary,
  SUM(CASE WHEN u.education_level = 'Graduation' THEN 1 ELSE 0 END) AS graduation,
  SUM(CASE WHEN u.education_level = 'Post-Graduation' THEN 1 ELSE 0 END) AS post_graduation,
  
  -- Marital Status
  SUM(CASE WHEN u.marital_status = 'Married' THEN 1 ELSE 0 END) AS married_count,
  SUM(CASE WHEN u.marital_status = 'Unmarried' THEN 1 ELSE 0 END) AS unmarried_count,
  
  -- Metadata
  NOW() AS last_refreshed
FROM temples t
LEFT JOIN family_temples ft ON t.id = ft.temple_id
LEFT JOIN families f ON ft.family_id = f.id
LEFT JOIN family_members fm ON f.id = fm.family_id
LEFT JOIN users u ON fm.user_id = u.id
GROUP BY t.id, t.name, t.district, t.state, t.village;

-- Create unique index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_temple_demographics_mv_temple 
  ON temple_demographics_mv(temple_id);

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_temple_demographics_mv_district 
  ON temple_demographics_mv(district);
CREATE INDEX IF NOT EXISTS idx_temple_demographics_mv_state 
  ON temple_demographics_mv(state);

COMMENT ON MATERIALIZED VIEW temple_demographics_mv IS 'Pre-computed temple-level demographics for fast dashboard loading';

-- ============================================================
-- VIEW 2: Gotra Distribution by Temple
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS temple_gotra_distribution_mv AS
SELECT 
  t.id AS temple_id,
  t.name AS temple_name,
  t.district,
  t.state,
  f.gotra,
  COUNT(DISTINCT f.id) AS family_count,
  COUNT(DISTINCT fm.user_id) AS member_count,
  ROUND(
    COUNT(DISTINCT f.id)::DECIMAL * 100 / 
    SUM(COUNT(DISTINCT f.id)) OVER (PARTITION BY t.id),
    2
  ) AS percentage_of_temple_families,
  NOW() AS last_refreshed
FROM temples t
JOIN family_temples ft ON t.id = ft.temple_id
JOIN families f ON ft.family_id = f.id
LEFT JOIN family_members fm ON f.id = fm.family_id
WHERE f.gotra IS NOT NULL AND f.gotra != ''
GROUP BY t.id, t.name, t.district, t.state, f.gotra
ORDER BY t.id, family_count DESC;

CREATE INDEX IF NOT EXISTS idx_gotra_distribution_temple 
  ON temple_gotra_distribution_mv(temple_id);
CREATE INDEX IF NOT EXISTS idx_gotra_distribution_gotra 
  ON temple_gotra_distribution_mv(gotra);
CREATE INDEX IF NOT EXISTS idx_gotra_distribution_district 
  ON temple_gotra_distribution_mv(district);

COMMENT ON MATERIALIZED VIEW temple_gotra_distribution_mv IS 'Gotra-wise family and member distribution by temple';

-- ============================================================
-- VIEW 3: Student Analytics by Temple
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS temple_student_analytics_mv AS
SELECT 
  t.id AS temple_id,
  t.name AS temple_name,
  t.district,
  t.state,
  u.student_grade,
  u.gender,
  COUNT(*) AS student_count,
  ROUND(AVG(EXTRACT(YEAR FROM AGE(u.dob))), 1) AS avg_age,
  MIN(EXTRACT(YEAR FROM AGE(u.dob))) AS min_age,
  MAX(EXTRACT(YEAR FROM AGE(u.dob))) AS max_age,
  NOW() AS last_refreshed
FROM temples t
JOIN family_temples ft ON t.id = ft.temple_id
JOIN families f ON ft.family_id = f.id
JOIN family_members fm ON f.id = fm.family_id
JOIN users u ON fm.user_id = u.id
WHERE u.is_student = true AND u.student_grade IS NOT NULL
GROUP BY t.id, t.name, t.district, t.state, u.student_grade, u.gender
ORDER BY t.id, 
  CASE u.student_grade
    WHEN 'Grade 1' THEN 1
    WHEN 'Grade 2' THEN 2
    WHEN 'Grade 3' THEN 3
    WHEN 'Grade 4' THEN 4
    WHEN 'Grade 5' THEN 5
    WHEN 'Grade 6' THEN 6
    WHEN 'Grade 7' THEN 7
    WHEN 'Grade 8' THEN 8
    WHEN 'Grade 9' THEN 9
    WHEN 'Grade 10' THEN 10
    WHEN 'Grade 11' THEN 11
    WHEN 'Grade 12' THEN 12
    WHEN 'College' THEN 13
    WHEN 'Post-Grad' THEN 14
    ELSE 15
  END;

CREATE INDEX IF NOT EXISTS idx_student_analytics_temple 
  ON temple_student_analytics_mv(temple_id);
CREATE INDEX IF NOT EXISTS idx_student_analytics_grade 
  ON temple_student_analytics_mv(student_grade);
CREATE INDEX IF NOT EXISTS idx_student_analytics_district 
  ON temple_student_analytics_mv(district);

COMMENT ON MATERIALIZED VIEW temple_student_analytics_mv IS 'Student distribution by grade, gender, and temple';

-- ============================================================
-- VIEW 4: District-Level Analytics
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS district_analytics_mv AS
SELECT 
  t.district,
  t.state,
  COUNT(DISTINCT t.id) AS temple_count,
  COUNT(DISTINCT ft.family_id) AS total_families,
  COUNT(DISTINCT fm.user_id) AS total_members,
  SUM(CASE WHEN u.gender = 'male' THEN 1 ELSE 0 END) AS male_count,
  SUM(CASE WHEN u.gender = 'female' THEN 1 ELSE 0 END) AS female_count,
  ROUND(AVG(EXTRACT(YEAR FROM AGE(u.dob))), 1) AS avg_age,
  SUM(CASE WHEN u.is_student = true THEN 1 ELSE 0 END) AS student_count,
  COUNT(DISTINCT f.gotra) AS unique_gotras,
  ROUND(
    COUNT(DISTINCT fm.user_id)::DECIMAL / 
    NULLIF(COUNT(DISTINCT ft.family_id), 0),
    2
  ) AS avg_family_size,
  NOW() AS last_refreshed
FROM temples t
LEFT JOIN family_temples ft ON t.id = ft.temple_id
LEFT JOIN families f ON ft.family_id = f.id
LEFT JOIN family_members fm ON f.id = fm.family_id
LEFT JOIN users u ON fm.user_id = u.id
WHERE t.district IS NOT NULL
GROUP BY t.district, t.state
ORDER BY total_members DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_district_analytics_mv_district 
  ON district_analytics_mv(district, state);
CREATE INDEX IF NOT EXISTS idx_district_analytics_mv_state 
  ON district_analytics_mv(state);

COMMENT ON MATERIALIZED VIEW district_analytics_mv IS 'District-level aggregated analytics';

-- ============================================================
-- VIEW 5: State-Level Analytics
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS state_analytics_mv AS
SELECT 
  t.state,
  COUNT(DISTINCT t.id) AS temple_count,
  COUNT(DISTINCT t.district) AS district_count,
  COUNT(DISTINCT ft.family_id) AS total_families,
  COUNT(DISTINCT fm.user_id) AS total_members,
  SUM(CASE WHEN u.gender = 'male' THEN 1 ELSE 0 END) AS male_count,
  SUM(CASE WHEN u.gender = 'female' THEN 1 ELSE 0 END) AS female_count,
  ROUND(AVG(EXTRACT(YEAR FROM AGE(u.dob))), 1) AS avg_age,
  SUM(CASE WHEN u.is_student = true THEN 1 ELSE 0 END) AS student_count,
  COUNT(DISTINCT f.gotra) AS unique_gotras,
  ROUND(
    COUNT(DISTINCT fm.user_id)::DECIMAL / 
    NULLIF(COUNT(DISTINCT ft.family_id), 0),
    2
  ) AS avg_family_size,
  NOW() AS last_refreshed
FROM temples t
LEFT JOIN family_temples ft ON t.id = ft.temple_id
LEFT JOIN families f ON ft.family_id = f.id
LEFT JOIN family_members fm ON f.id = fm.family_id
LEFT JOIN users u ON fm.user_id = u.id
WHERE t.state IS NOT NULL
GROUP BY t.state
ORDER BY total_members DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_state_analytics_mv_state 
  ON state_analytics_mv(state);

COMMENT ON MATERIALIZED VIEW state_analytics_mv IS 'State-level aggregated analytics';

-- ============================================================
-- VIEW 6: National Analytics Summary
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS national_analytics_mv AS
SELECT 
  'India' AS country,
  COUNT(DISTINCT t.id) AS temple_count,
  COUNT(DISTINCT t.state) AS state_count,
  COUNT(DISTINCT t.district) AS district_count,
  COUNT(DISTINCT ft.family_id) AS total_families,
  COUNT(DISTINCT fm.user_id) AS total_members,
  SUM(CASE WHEN u.gender = 'male' THEN 1 ELSE 0 END) AS male_count,
  SUM(CASE WHEN u.gender = 'female' THEN 1 ELSE 0 END) AS female_count,
  ROUND(AVG(EXTRACT(YEAR FROM AGE(u.dob))), 1) AS avg_age,
  SUM(CASE WHEN u.is_student = true THEN 1 ELSE 0 END) AS student_count,
  COUNT(DISTINCT f.gotra) AS unique_gotras,
  ROUND(
    COUNT(DISTINCT fm.user_id)::DECIMAL / 
    NULLIF(COUNT(DISTINCT ft.family_id), 0),
    2
  ) AS avg_family_size,
  -- Top 5 States by families
  (
    SELECT jsonb_agg(jsonb_build_object(
      'state', state,
      'families', family_count
    ))
    FROM (
      SELECT t2.state, COUNT(DISTINCT ft2.family_id) AS family_count
      FROM temples t2
      LEFT JOIN family_temples ft2 ON t2.id = ft2.temple_id
      WHERE t2.state IS NOT NULL
      GROUP BY t2.state
      ORDER BY family_count DESC
      LIMIT 5
    ) top_states
  ) AS top_states,
  -- Top 5 Gotras
  (
    SELECT jsonb_agg(jsonb_build_object(
      'gotra', gotra,
      'families', family_count
    ))
    FROM (
      SELECT f2.gotra, COUNT(DISTINCT f2.id) AS family_count
      FROM families f2
      WHERE f2.gotra IS NOT NULL AND f2.gotra != ''
      GROUP BY f2.gotra
      ORDER BY family_count DESC
      LIMIT 5
    ) top_gotras
  ) AS top_gotras,
  NOW() AS last_refreshed
FROM temples t
LEFT JOIN family_temples ft ON t.id = ft.temple_id
LEFT JOIN families f ON ft.family_id = f.id
LEFT JOIN family_members fm ON f.id = fm.family_id
LEFT JOIN users u ON fm.user_id = u.id;

COMMENT ON MATERIALIZED VIEW national_analytics_mv IS 'National-level summary analytics with top rankings';

-- ============================================================
-- VIEW 7: Age Distribution by Temple
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS temple_age_distribution_mv AS
SELECT 
  t.id AS temple_id,
  t.name AS temple_name,
  get_age_group(u.dob) AS age_group,
  u.gender,
  COUNT(*) AS member_count,
  ROUND(AVG(EXTRACT(YEAR FROM AGE(u.dob))), 1) AS avg_age_in_group,
  NOW() AS last_refreshed
FROM temples t
JOIN family_temples ft ON t.id = ft.temple_id
JOIN families f ON ft.family_id = f.id
JOIN family_members fm ON f.id = fm.family_id
JOIN users u ON fm.user_id = u.id
WHERE u.dob IS NOT NULL
GROUP BY t.id, t.name, get_age_group(u.dob), u.gender
ORDER BY t.id, 
  CASE get_age_group(u.dob)
    WHEN '0-10' THEN 1
    WHEN '11-20' THEN 2
    WHEN '21-30' THEN 3
    WHEN '31-50' THEN 4
    WHEN '51-70' THEN 5
    WHEN '70+' THEN 6
  END;

CREATE INDEX IF NOT EXISTS idx_age_distribution_temple 
  ON temple_age_distribution_mv(temple_id);
CREATE INDEX IF NOT EXISTS idx_age_distribution_group 
  ON temple_age_distribution_mv(age_group);

COMMENT ON MATERIALIZED VIEW temple_age_distribution_mv IS 'Age group distribution by gender for each temple';

-- ============================================================
-- Refresh Function for All Materialized Views
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_all_analytics_views()
RETURNS TABLE(view_name TEXT, rows_refreshed BIGINT, duration_ms BIGINT) AS $$
DECLARE
  start_time TIMESTAMP;
  end_time TIMESTAMP;
BEGIN
  -- Temple Demographics
  start_time := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY temple_demographics_mv;
  end_time := clock_timestamp();
  view_name := 'temple_demographics_mv';
  rows_refreshed := (SELECT COUNT(*) FROM temple_demographics_mv);
  duration_ms := EXTRACT(MILLISECOND FROM (end_time - start_time));
  RETURN NEXT;
  
  -- Gotra Distribution
  start_time := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY temple_gotra_distribution_mv;
  end_time := clock_timestamp();
  view_name := 'temple_gotra_distribution_mv';
  rows_refreshed := (SELECT COUNT(*) FROM temple_gotra_distribution_mv);
  duration_ms := EXTRACT(MILLISECOND FROM (end_time - start_time));
  RETURN NEXT;
  
  -- Student Analytics
  start_time := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY temple_student_analytics_mv;
  end_time := clock_timestamp();
  view_name := 'temple_student_analytics_mv';
  rows_refreshed := (SELECT COUNT(*) FROM temple_student_analytics_mv);
  duration_ms := EXTRACT(MILLISECOND FROM (end_time - start_time));
  RETURN NEXT;
  
  -- District Analytics
  start_time := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY district_analytics_mv;
  end_time := clock_timestamp();
  view_name := 'district_analytics_mv';
  rows_refreshed := (SELECT COUNT(*) FROM district_analytics_mv);
  duration_ms := EXTRACT(MILLISECOND FROM (end_time - start_time));
  RETURN NEXT;
  
  -- State Analytics
  start_time := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY state_analytics_mv;
  end_time := clock_timestamp();
  view_name := 'state_analytics_mv';
  rows_refreshed := (SELECT COUNT(*) FROM state_analytics_mv);
  duration_ms := EXTRACT(MILLISECOND FROM (end_time - start_time));
  RETURN NEXT;
  
  -- National Analytics
  start_time := clock_timestamp();
  REFRESH MATERIALIZED VIEW national_analytics_mv;
  end_time := clock_timestamp();
  view_name := 'national_analytics_mv';
  rows_refreshed := (SELECT COUNT(*) FROM national_analytics_mv);
  duration_ms := EXTRACT(MILLISECOND FROM (end_time - start_time));
  RETURN NEXT;
  
  -- Age Distribution
  start_time := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY temple_age_distribution_mv;
  end_time := clock_timestamp();
  view_name := 'temple_age_distribution_mv';
  rows_refreshed := (SELECT COUNT(*) FROM temple_age_distribution_mv);
  duration_ms := EXTRACT(MILLISECOND FROM (end_time - start_time));
  RETURN NEXT;
  
  RAISE NOTICE 'All analytics views refreshed successfully';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_all_analytics_views() IS 'Refresh all materialized views and return performance metrics';

-- ============================================================
-- Initial Refresh
-- ============================================================

SELECT * FROM refresh_all_analytics_views();

-- ============================================================
-- Verification Queries
-- ============================================================

SELECT 
  'temple_demographics_mv' AS view_name,
  COUNT(*) AS row_count,
  MAX(last_refreshed) AS last_refreshed
FROM temple_demographics_mv

UNION ALL

SELECT 
  'temple_gotra_distribution_mv',
  COUNT(*),
  MAX(last_refreshed)
FROM temple_gotra_distribution_mv

UNION ALL

SELECT 
  'temple_student_analytics_mv',
  COUNT(*),
  MAX(last_refreshed)
FROM temple_student_analytics_mv

UNION ALL

SELECT 
  'district_analytics_mv',
  COUNT(*),
  MAX(last_refreshed)
FROM district_analytics_mv

UNION ALL

SELECT 
  'state_analytics_mv',
  COUNT(*),
  MAX(last_refreshed)
FROM state_analytics_mv

UNION ALL

SELECT 
  'national_analytics_mv',
  COUNT(*),
  MAX(last_refreshed)
FROM national_analytics_mv

UNION ALL

SELECT 
  'temple_age_distribution_mv',
  COUNT(*),
  MAX(last_refreshed)
FROM temple_age_distribution_mv;

-- ============================================================
-- Sample Analytics Queries (for testing)
-- ============================================================

-- Top 10 temples by family count
SELECT temple_name, district, state, total_families, total_members, avg_family_size
FROM temple_demographics_mv
ORDER BY total_families DESC
LIMIT 10;

-- Top 10 gotras nationwide
SELECT gotra, SUM(family_count) AS total_families, SUM(member_count) AS total_members
FROM temple_gotra_distribution_mv
GROUP BY gotra
ORDER BY total_families DESC
LIMIT 10;

-- Student distribution summary
SELECT student_grade, SUM(student_count) AS total_students
FROM temple_student_analytics_mv
GROUP BY student_grade
ORDER BY 
  CASE student_grade
    WHEN 'Grade 1' THEN 1 WHEN 'Grade 2' THEN 2 WHEN 'Grade 3' THEN 3
    WHEN 'Grade 4' THEN 4 WHEN 'Grade 5' THEN 5 WHEN 'Grade 6' THEN 6
    WHEN 'Grade 7' THEN 7 WHEN 'Grade 8' THEN 8 WHEN 'Grade 9' THEN 9
    WHEN 'Grade 10' THEN 10 WHEN 'Grade 11' THEN 11 WHEN 'Grade 12' THEN 12
    WHEN 'College' THEN 13 WHEN 'Post-Grad' THEN 14 ELSE 15
  END;

-- State comparison
SELECT state, temple_count, district_count, total_families, total_members, avg_family_size
FROM state_analytics_mv
ORDER BY total_members DESC;

-- National summary
SELECT * FROM national_analytics_mv;

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Materialized Views Migration Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Views created: 7';
  RAISE NOTICE '  1. temple_demographics_mv';
  RAISE NOTICE '  2. temple_gotra_distribution_mv';
  RAISE NOTICE '  3. temple_student_analytics_mv';
  RAISE NOTICE '  4. district_analytics_mv';
  RAISE NOTICE '  5. state_analytics_mv';
  RAISE NOTICE '  6. national_analytics_mv';
  RAISE NOTICE '  7. temple_age_distribution_mv';
  RAISE NOTICE '';
  RAISE NOTICE 'Refresh function created:';
  RAISE NOTICE '  - refresh_all_analytics_views()';
  RAISE NOTICE '';
  RAISE NOTICE 'Schedule nightly refresh:';
  RAISE NOTICE '  - Add cron job to run refresh_all_analytics_views()';
  RAISE NOTICE '  - Recommended time: 2:00 AM daily';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Test sample queries above';
  RAISE NOTICE '  2. Create analytics API service';
  RAISE NOTICE '  3. Build frontend dashboards';
  RAISE NOTICE '========================================';
END $$;
