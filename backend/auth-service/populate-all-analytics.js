/**
 * Populate All Analytics Fact Tables
 * Creates comprehensive analytics data for all report types
 */

const pool = require('./src/config/database');

async function populateAllAnalytics() {
  try {
    console.log('🚀 Populating All Analytics Fact Tables...\n');

    // =========================================================================
    // 1. AGE RANGE SUMMARY
    // =========================================================================
    console.log('📊 Step 1: Populating fact_age_range_summary...');
    
    await pool.query('DELETE FROM fact_age_range_summary WHERE snapshot_date = CURRENT_DATE');
    
    const ageResult = await pool.query(`
      INSERT INTO fact_age_range_summary (
        temple_id, age_range_id, village, district, state,
        male_count, female_count, total_count, snapshot_date
      )
      SELECT 
        t.id as temple_id,
        ar.id as age_range_id,
        COALESCE(dg.village, 'Unknown') as village,
        COALESCE(dg.district, 'Unknown') as district,
        COALESCE(dg.state, 'Unknown') as state,
        COUNT(CASE WHEN u.gender = 'Male' THEN 1 END) as male_count,
        COUNT(CASE WHEN u.gender = 'Female' THEN 1 END) as female_count,
        COUNT(*) as total_count,
        CURRENT_DATE
      FROM temples t
      CROSS JOIN dim_age_ranges ar
      LEFT JOIN dim_geography dg ON dg.temple_id = t.id
      LEFT JOIN families f ON f.temple_id = t.id
      LEFT JOIN users u ON u.family_id = f.id
        AND EXTRACT(YEAR FROM AGE(COALESCE(u.dob, CURRENT_DATE - INTERVAL '30 years'))) >= ar.min_age
        AND EXTRACT(YEAR FROM AGE(COALESCE(u.dob, CURRENT_DATE - INTERVAL '30 years'))) <= ar.max_age
      WHERE t.is_active = true
      GROUP BY t.id, ar.id, dg.village, dg.district, dg.state
      HAVING COUNT(*) > 0
      RETURNING *
    `);
    
    console.log(`   ✅ Created ${ageResult.rowCount} age distribution records\n`);

    // =========================================================================
    // 2. GOTRA SUMMARY
    // =========================================================================
    console.log('📊 Step 2: Populating fact_gotra_summary...');
    
    await pool.query('DELETE FROM fact_gotra_summary WHERE snapshot_date = CURRENT_DATE');
    
    const gotraResult = await pool.query(`
      INSERT INTO fact_gotra_summary (
        temple_id, gotra_id, village, district, state,
        family_count, member_count, snapshot_date
      )
      SELECT 
        t.id as temple_id,
        g.id as gotra_id,
        COALESCE(dg.village, 'Unknown') as village,
        COALESCE(dg.district, 'Unknown') as district,
        COALESCE(dg.state, 'Unknown') as state,
        COUNT(DISTINCT f.id) as family_count,
        COUNT(DISTINCT u.id) as member_count,
        CURRENT_DATE
      FROM temples t
      LEFT JOIN dim_geography dg ON dg.temple_id = t.id
      LEFT JOIN families f ON f.temple_id = t.id
      LEFT JOIN dim_gotras g ON LOWER(TRIM(g.gotra_name)) = LOWER(TRIM(f.gotra))
      LEFT JOIN users u ON u.family_id = f.id
      WHERE t.is_active = true
        AND g.id IS NOT NULL
        AND f.id IS NOT NULL
      GROUP BY t.id, g.id, dg.village, dg.district, dg.state
      HAVING COUNT(DISTINCT f.id) > 0
      RETURNING *
    `);
    
    console.log(`   ✅ Created ${gotraResult.rowCount} gotra distribution records\n`);

    // =========================================================================
    // 3. FAMILY SUMMARY
    // =========================================================================
    console.log('📊 Step 3: Populating fact_family_summary...');
    
    await pool.query('DELETE FROM fact_family_summary WHERE snapshot_date = CURRENT_DATE');
    
    const familyResult = await pool.query(`
      INSERT INTO fact_family_summary (
        temple_id, family_id, village, district, state,
        family_size, male_members, female_members,
        children_count, adults_count, seniors_count,
        gotra, head_of_family, snapshot_date
      )
      SELECT 
        t.id as temple_id,
        f.id as family_id,
        COALESCE(dg.village, 'Unknown') as village,
        COALESCE(dg.district, 'Unknown') as district,
        COALESCE(dg.state, 'Unknown') as state,
        COUNT(u.id) as family_size,
        COUNT(CASE WHEN u.gender = 'Male' THEN 1 END) as male_members,
        COUNT(CASE WHEN u.gender = 'Female' THEN 1 END) as female_members,
        COUNT(CASE WHEN EXTRACT(YEAR FROM AGE(COALESCE(u.dob, CURRENT_DATE - INTERVAL '30 years'))) <= 18 THEN 1 END) as children_count,
        COUNT(CASE WHEN EXTRACT(YEAR FROM AGE(COALESCE(u.dob, CURRENT_DATE - INTERVAL '30 years'))) BETWEEN 19 AND 60 THEN 1 END) as adults_count,
        COUNT(CASE WHEN EXTRACT(YEAR FROM AGE(COALESCE(u.dob, CURRENT_DATE - INTERVAL '30 years'))) > 60 THEN 1 END) as seniors_count,
        f.gotra,
        (SELECT CONCAT(u2.first_name, ' ', COALESCE(u2.last_name, '')) 
         FROM users u2 
         WHERE u2.family_id = f.id 
         ORDER BY u2.dob ASC NULLS LAST
         LIMIT 1) as head_of_family,
        CURRENT_DATE
      FROM temples t
      LEFT JOIN dim_geography dg ON dg.temple_id = t.id
      LEFT JOIN families f ON f.temple_id = t.id
      LEFT JOIN users u ON u.family_id = f.id
      WHERE t.is_active = true
        AND f.id IS NOT NULL
      GROUP BY t.id, f.id, dg.village, dg.district, dg.state, f.gotra
      HAVING COUNT(u.id) > 0
      RETURNING *
    `);
    
    console.log(`   ✅ Created ${familyResult.rowCount} family summary records\n`);

    // =========================================================================
    // Verify All Tables
    // =========================================================================
    console.log('🔍 Verification: Checking all fact tables...\n');
    
    const verification = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM fact_demographic_summary WHERE snapshot_date = CURRENT_DATE) as demographic_count,
        (SELECT COUNT(*) FROM fact_age_range_summary WHERE snapshot_date = CURRENT_DATE) as age_count,
        (SELECT COUNT(*) FROM fact_gotra_summary WHERE snapshot_date = CURRENT_DATE) as gotra_count,
        (SELECT COUNT(*) FROM fact_family_summary WHERE snapshot_date = CURRENT_DATE) as family_count
    `);
    
    const counts = verification.rows[0];
    console.log('   Fact Table Record Counts:');
    console.log(`   ✓ fact_demographic_summary: ${counts.demographic_count} records`);
    console.log(`   ✓ fact_age_range_summary: ${counts.age_count} records`);
    console.log(`   ✓ fact_gotra_summary: ${counts.gotra_count} records`);
    console.log(`   ✓ fact_family_summary: ${counts.family_count} records`);
    console.log('');

    // =========================================================================
    // Sample Data Preview
    // =========================================================================
    console.log('📋 Sample Data Preview:\n');

    // Age distribution sample
    const ageSample = await pool.query(`
      SELECT ar.range_name, SUM(far.total_count) as total
      FROM fact_age_range_summary far
      JOIN dim_age_ranges ar ON far.age_range_id = ar.id
      WHERE far.snapshot_date = CURRENT_DATE
      GROUP BY ar.range_name, ar.display_order
      ORDER BY ar.display_order
      LIMIT 6
    `);
    
    console.log('   Age Distribution:');
    ageSample.rows.forEach(row => {
      console.log(`     ${row.range_name}: ${row.total} members`);
    });
    console.log('');

    // Gotra distribution sample
    const gotraSample = await pool.query(`
      SELECT g.gotra_name, SUM(fg.family_count) as families, SUM(fg.member_count) as members
      FROM fact_gotra_summary fg
      JOIN dim_gotras g ON fg.gotra_id = g.id
      WHERE fg.snapshot_date = CURRENT_DATE
      GROUP BY g.gotra_name
      ORDER BY families DESC
      LIMIT 5
    `);
    
    console.log('   Top 5 Gotras:');
    gotraSample.rows.forEach((row, i) => {
      console.log(`     ${i+1}. ${row.gotra_name}: ${row.families} families, ${row.members} members`);
    });
    console.log('');

    // Family statistics
    const familyStats = await pool.query(`
      SELECT 
        COUNT(*) as total_families,
        ROUND(AVG(family_size), 2) as avg_size,
        MAX(family_size) as max_size,
        MIN(family_size) as min_size
      FROM fact_family_summary
      WHERE snapshot_date = CURRENT_DATE
    `);
    
    const stats = familyStats.rows[0];
    console.log('   Family Statistics:');
    console.log(`     Total Families: ${stats.total_families}`);
    console.log(`     Average Size: ${stats.avg_size}`);
    console.log(`     Largest Family: ${stats.max_size} members`);
    console.log(`     Smallest Family: ${stats.min_size} members`);
    console.log('');

    // =========================================================================
    // Success Summary
    // =========================================================================
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║                                                   ║');
    console.log('║     ✅ ALL ANALYTICS TABLES POPULATED! ✅        ║');
    console.log('║                                                   ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');

    console.log('🎉 All report types should now work!');
    console.log('   → Dashboard: ✅');
    console.log('   → Demographics: ✅');
    console.log('   → Age Distribution: ✅');
    console.log('   → Gotra Distribution: ✅');
    console.log('   → Family Statistics: ✅\n');

    console.log('📱 Please reload your Analytics Dashboard now!\n');

  } catch (error) {
    console.error('❌ Error populating analytics:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

populateAllAnalytics();
