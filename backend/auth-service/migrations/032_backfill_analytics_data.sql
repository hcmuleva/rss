-- =====================================================================
-- Migration 032: Backfill Analytics Data
-- Company: emeelan
-- Date: 2026-04-19
-- =====================================================================
-- Purpose: Populate missing data for analytics system
--   1. Link families to temples (family_temples junction table)
--   2. Extract district from temple addresses
--   3. Backfill temple coordinates from addresses (if available)
--   4. Refresh all materialized views
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. LINK FAMILIES TO TEMPLES
-- =====================================================================

DO $$
DECLARE
  v_before_count INTEGER;
  v_after_count INTEGER;
  v_families_linked INTEGER;
BEGIN
  -- Count existing family-temple links
  SELECT COUNT(*) INTO v_before_count FROM family_temples;
  
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'STEP 1: Linking Families to Temples';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Existing family-temple links: %', v_before_count;
  
  -- Link families to their primary temple
  -- Use temple_id from families table
  
  -- Method 1: Use temple_id from families table
  INSERT INTO family_temples (family_id, temple_id, is_primary, added_at)
  SELECT 
    f.id,
    f.temple_id,
    true,
    COALESCE(f.created_at, NOW())
  FROM families f
  WHERE f.temple_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM family_temples ft 
      WHERE ft.family_id = f.id AND ft.temple_id = f.temple_id
    )
  ON CONFLICT (family_id, temple_id) DO NOTHING;
  
  GET DIAGNOSTICS v_families_linked = ROW_COUNT;
  RAISE NOTICE 'Linked % families using primary_temple_id', v_families_linked;
  
  -- Method 2: Infer from family_members user's temple association
  -- Link families to temples where majority of members belong
  INSERT INTO family_temples (family_id, temple_id, is_primary, added_at)
  SELECT DISTINCT ON (fm.family_id)
    fm.family_id,
    ut.temple_id,
    false,
    NOW()
  FROM family_members fm
  JOIN user_temples ut ON ut.user_id = fm.user_id
  WHERE fm.family_id IS NOT NULL
    AND ut.temple_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM family_temples ft 
      WHERE ft.family_id = fm.family_id AND ft.temple_id = ut.temple_id
    )
  GROUP BY fm.family_id, ut.temple_id
  HAVING COUNT(*) >= 1
  ORDER BY fm.family_id, COUNT(*) DESC
  ON CONFLICT (family_id, temple_id) DO NOTHING;
  
  GET DIAGNOSTICS v_families_linked = ROW_COUNT;
  RAISE NOTICE 'Linked % additional families using user_temples', v_families_linked;
  
  -- Count after
  SELECT COUNT(*) INTO v_after_count FROM family_temples;
  RAISE NOTICE 'Total family-temple links: % (added %)', v_after_count, (v_after_count - v_before_count);
  RAISE NOTICE '';
  
END $$;

-- =====================================================================
-- 2. EXTRACT DISTRICT FROM TEMPLE ADDRESSES
-- =====================================================================

DO $$
DECLARE
  v_before_count INTEGER;
  v_after_count INTEGER;
  v_updated INTEGER := 0;
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'STEP 2: Extracting District from Addresses';
  RAISE NOTICE '==============================================';
  
  -- Count temples with district
  SELECT COUNT(*) INTO v_before_count FROM temples WHERE district IS NOT NULL;
  RAISE NOTICE 'Temples with district before: %', v_before_count;
  
  -- Try to extract district from location field
  -- Assuming format: "Village, District, State" or "Village, District"
  UPDATE temples
  SET district = TRIM(SPLIT_PART(location, ',', -2))
  WHERE district IS NULL
    AND location IS NOT NULL
    AND location LIKE '%,%,%'
    AND TRIM(SPLIT_PART(location, ',', -2)) != ''
    AND TRIM(SPLIT_PART(location, ',', -2)) != location;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % temples with district from 3-part address', v_updated;
  
  -- Try 2-part address format: "District, State"
  UPDATE temples
  SET district = TRIM(SPLIT_PART(location, ',', 1))
  WHERE district IS NULL
    AND location IS NOT NULL
    AND location LIKE '%,%'
    AND TRIM(SPLIT_PART(location, ',', 1)) != ''
    AND LENGTH(TRIM(SPLIT_PART(location, ',', 1))) < 50;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % temples with district from 2-part address', v_updated;
  
  -- Extract from village field if available
  UPDATE temples
  SET district = TRIM(SPLIT_PART(village, ',', -1))
  WHERE district IS NULL
    AND village IS NOT NULL
    AND village LIKE '%,%'
    AND TRIM(SPLIT_PART(village, ',', -1)) != ''
    AND LENGTH(TRIM(SPLIT_PART(village, ',', -1))) < 50;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % temples with district from village field', v_updated;
  
  -- Count after
  SELECT COUNT(*) INTO v_after_count FROM temples WHERE district IS NOT NULL;
  RAISE NOTICE 'Temples with district after: % (added %)', v_after_count, (v_after_count - v_before_count);
  RAISE NOTICE '';
  
END $$;

-- =====================================================================
-- 3. REFRESH FACT TABLES
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'STEP 3: Refreshing Fact Tables';
  RAISE NOTICE '==============================================';
  
  -- Refresh family temple facts
  PERFORM refresh_family_temple_facts();
  RAISE NOTICE 'Refreshed family_temple_facts';
  
  -- Refresh member demographics
  PERFORM refresh_member_demographics();
  RAISE NOTICE 'Refreshed member_demographics';
  RAISE NOTICE '';
  
END $$;

-- =====================================================================
-- 4. REFRESH ALL MATERIALIZED VIEWS
-- =====================================================================

DO $$
DECLARE
  v_start_time TIMESTAMP;
  v_end_time TIMESTAMP;
  v_duration INTERVAL;
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'STEP 4: Refreshing Materialized Views';
  RAISE NOTICE '==============================================';
  
  v_start_time := clock_timestamp();
  
  -- Refresh all analytics views
  PERFORM refresh_all_analytics_views();
  
  v_end_time := clock_timestamp();
  v_duration := v_end_time - v_start_time;
  
  RAISE NOTICE 'All materialized views refreshed in %', v_duration;
  RAISE NOTICE '';
  
END $$;

-- =====================================================================
-- 5. VERIFICATION QUERIES
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'STEP 5: Verification';
  RAISE NOTICE '==============================================';
END $$;

-- Check family-temple links
SELECT 
  'Family-Temple Links' AS metric,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE is_primary = true) AS primary_links,
  COUNT(DISTINCT family_id) AS families_linked,
  COUNT(DISTINCT temple_id) AS temples_linked
FROM family_temples;

-- Check temple district coverage
SELECT 
  'Temple Districts' AS metric,
  COUNT(*) AS total_temples,
  COUNT(*) FILTER (WHERE district IS NOT NULL) AS with_district,
  COUNT(*) FILTER (WHERE district IS NULL) AS missing_district,
  ROUND(100.0 * COUNT(*) FILTER (WHERE district IS NOT NULL) / COUNT(*), 1) AS coverage_pct
FROM temples;

-- Check materialized view data
SELECT 
  'Temple Demographics' AS view_name,
  COUNT(*) AS temples,
  SUM(total_families::int) AS total_families,
  SUM(total_members::int) AS total_members,
  SUM(student_count::int) AS total_students
FROM temple_demographics_mv;

-- Check state analytics
SELECT 
  state,
  temple_count,
  total_families,
  total_members,
  student_count
FROM state_analytics_mv
ORDER BY total_members DESC;

-- Check top temples by members
SELECT 
  temple_name,
  state,
  district,
  total_families,
  total_members,
  student_count
FROM temple_demographics_mv
WHERE total_members > 0
ORDER BY total_members DESC
LIMIT 10;

-- Check gotra distribution
SELECT 
  temple_id,
  COUNT(*) AS gotra_count,
  SUM(family_count::int) AS total_families
FROM temple_gotra_distribution_mv
GROUP BY temple_id
HAVING SUM(family_count::int) > 0
ORDER BY SUM(family_count::int) DESC
LIMIT 10;

-- Check student analytics
SELECT 
  student_grade,
  SUM(student_count::int) AS total_students,
  ROUND(AVG(avg_age::numeric), 1) AS avg_age
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

-- =====================================================================
-- COMPLETION MESSAGE
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Analytics Data Backfill Complete';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Review verification queries above';
  RAISE NOTICE '  2. Test analytics API endpoints';
  RAISE NOTICE '  3. Manually update missing district data if needed';
  RAISE NOTICE '  4. Consider adding temple coordinates (lat/long)';
  RAISE NOTICE '==============================================';
  RAISE NOTICE '';
END $$;

COMMIT;
