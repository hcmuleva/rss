-- =====================================================================
-- Migration 033: Sync Users to Family Members
-- Company: emeelan
-- Date: 2026-04-19
-- =====================================================================
-- Purpose: Populate family_members table from users.family_id
-- Issue: 2,360 users have family_id but only 47 family_members records
-- Impact: Analytics show only 55 members instead of 2,360+
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v_before_count INTEGER;
  v_after_count INTEGER;
  v_users_synced INTEGER;
  v_users_with_family INTEGER;
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Syncing Users to Family Members';
  RAISE NOTICE '==============================================';
  RAISE NOTICE '';
  
  -- Count before
  SELECT COUNT(*) INTO v_before_count FROM family_members;
  SELECT COUNT(*) INTO v_users_with_family FROM users WHERE family_id IS NOT NULL;
  
  RAISE NOTICE 'Current state:';
  RAISE NOTICE '  family_members records: %', v_before_count;
  RAISE NOTICE '  users with family_id: %', v_users_with_family;
  RAISE NOTICE '';
  
  -- Insert users into family_members if not already there
  INSERT INTO family_members (
    family_id,
    user_id,
    relation_to_head,
    is_head,
    is_head_of_family,
    joined_at,
    occupation,
    phone,
    email,
    photo,
    marital_status,
    is_alive,
    active
  )
  SELECT 
    u.family_id,
    u.id,
    CASE 
      WHEN u.role = 'admin' THEN 'Head'
      WHEN u.gender = 'Male' THEN 'Member'
      WHEN u.gender = 'Female' THEN 'Member'
      ELSE 'Member'
    END AS relation_to_head,
    false AS is_head,  -- We'll set this separately
    false AS is_head_of_family,
    COALESCE(u.created_at, NOW()) AS joined_at,
    u.occupation,
    u.phone,
    u.email,
    u.profile_photo_url,
    u.marital_status,
    true AS is_alive,
    COALESCE(u.is_active, true) AS active
  FROM users u
  WHERE u.family_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM family_members fm 
      WHERE fm.user_id = u.id AND fm.family_id = u.family_id
    )
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_users_synced = ROW_COUNT;
  
  -- Count after
  SELECT COUNT(*) INTO v_after_count FROM family_members;
  
  RAISE NOTICE 'Sync complete:';
  RAISE NOTICE '  Users synced: %', v_users_synced;
  RAISE NOTICE '  family_members before: %', v_before_count;
  RAISE NOTICE '  family_members after: %', v_after_count;
  RAISE NOTICE '  Net increase: %', (v_after_count - v_before_count);
  RAISE NOTICE '';
  
END $$;

-- =====================================================================
-- Update Family Head Designation
-- =====================================================================

DO $$
DECLARE
  v_heads_set INTEGER := 0;
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Setting Family Heads';
  RAISE NOTICE '==============================================';
  RAISE NOTICE '';
  
  -- For each family, set the oldest male member as head
  WITH family_heads AS (
    SELECT DISTINCT ON (fm.family_id)
      fm.id AS member_id,
      fm.family_id
    FROM family_members fm
    JOIN users u ON u.id = fm.user_id
    WHERE fm.active = true
      AND u.is_active = true
    ORDER BY 
      fm.family_id,
      u.gender DESC,  -- Males first
      u.dob ASC,      -- Oldest first
      fm.joined_at ASC
  )
  UPDATE family_members fm
  SET 
    is_head = true,
    is_head_of_family = true,
    relation_to_head = 'Self'
  FROM family_heads fh
  WHERE fm.id = fh.member_id;
  
  GET DIAGNOSTICS v_heads_set = ROW_COUNT;
  
  RAISE NOTICE 'Family heads set: %', v_heads_set;
  RAISE NOTICE '';
  
END $$;

-- =====================================================================
-- Refresh Analytics
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Refreshing Analytics';
  RAISE NOTICE '==============================================';
  RAISE NOTICE '';
  
  -- Refresh family temple facts
  PERFORM refresh_family_temple_facts();
  RAISE NOTICE '✓ Refreshed family_temple_facts';
  
  -- Refresh member demographics
  PERFORM refresh_member_demographics();
  RAISE NOTICE '✓ Refreshed member_demographics';
  
  -- Refresh all materialized views
  PERFORM refresh_all_analytics_views();
  RAISE NOTICE '✓ Refreshed all materialized views';
  RAISE NOTICE '';
  
END $$;

-- =====================================================================
-- Verification Queries
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Verification Results';
  RAISE NOTICE '==============================================';
  RAISE NOTICE '';
END $$;

-- Family members summary
SELECT 
  'Family Members' AS metric,
  COUNT(*) AS total_members,
  COUNT(DISTINCT family_id) AS families_with_members,
  COUNT(DISTINCT user_id) AS unique_users,
  COUNT(*) FILTER (WHERE is_head_of_family = true) AS family_heads
FROM family_members;

-- Temple demographics summary
SELECT 
  'Temple Demographics' AS metric,
  SUM(total_families::int) AS total_families,
  SUM(total_members::int) AS total_members,
  SUM(male_count::int) AS male_count,
  SUM(female_count::int) AS female_count,
  SUM(student_count::int) AS student_count
FROM temple_demographics_mv;

-- State analytics summary
SELECT 
  state,
  temple_count,
  total_families,
  total_members,
  male_count,
  female_count,
  student_count,
  unique_gotras
FROM state_analytics_mv
ORDER BY total_members DESC;

-- Top 10 temples by members
SELECT 
  temple_name,
  state,
  district,
  total_families,
  total_members,
  male_count,
  female_count,
  student_count,
  ROUND(avg_family_size, 1) AS avg_family_size
FROM temple_demographics_mv
WHERE total_members > 0
ORDER BY total_members DESC
LIMIT 10;

-- National summary
SELECT 
  'National Summary' AS level,
  temple_count,
  state_count,
  total_families,
  total_members,
  male_count,
  female_count,
  student_count,
  unique_gotras,
  ROUND(avg_family_size, 1) AS avg_family_size
FROM national_analytics_mv;

-- Student distribution
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

-- Gotra distribution (top 10)
SELECT 
  gotra,
  SUM(family_count::int) AS total_families,
  SUM(member_count::int) AS total_members
FROM temple_gotra_distribution_mv
GROUP BY gotra
ORDER BY SUM(family_count::int) DESC
LIMIT 10;

-- =====================================================================
-- Completion Message
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'User-to-Family Sync Complete!';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Review verification queries above';
  RAISE NOTICE '  2. Test analytics API with real data';
  RAISE NOTICE '  3. Verify temple demographics show correct numbers';
  RAISE NOTICE '  4. Build frontend dashboards';
  RAISE NOTICE '==============================================';
  RAISE NOTICE '';
END $$;

COMMIT;
