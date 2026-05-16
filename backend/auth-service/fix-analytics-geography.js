/**
 * Fix Analytics Geography Data
 * Updates dim_geography with proper state/city data from temples table
 */

const pool = require('./src/config/database');

async function fixGeography() {
  try {
    console.log('🔧 Fixing Analytics Geography Data...\n');

    // Step 1: Update dim_geography with data from temples table
    console.log('📍 Step 1: Updating dim_geography from temples table...');
    const updateResult = await pool.query(`
      UPDATE dim_geography dg
      SET 
        state = COALESCE(t.state, 'Unknown'),
        district = COALESCE(t.city, 'Unknown'),
        village = COALESCE(t.location, t.address, 'Unknown'),
        temple_name = t.name,
        updated_at = CURRENT_TIMESTAMP
      FROM temples t
      WHERE dg.temple_id = t.id
    `);
    console.log(`   ✅ Updated ${updateResult.rowCount} geography records\n`);

    // Step 2: Verify the updates
    console.log('🔍 Step 2: Verifying geography data...');
    const verifyResult = await pool.query(`
      SELECT DISTINCT state, COUNT(*) as temple_count
      FROM dim_geography
      WHERE state != 'Unknown'
      GROUP BY state
      ORDER BY state
    `);
    
    console.log('   States in dim_geography:');
    verifyResult.rows.forEach(row => {
      console.log(`     - ${row.state}: ${row.temple_count} temples`);
    });
    console.log('');

    // Step 3: Refresh analytics summaries
    console.log('📊 Step 3: Refreshing analytics summaries...');
    await pool.query('SELECT refresh_all_analytics(NULL)');
    console.log('   ✅ Analytics summaries refreshed\n');

    // Step 4: Verify fact table now has proper states
    console.log('🔍 Step 4: Verifying fact_demographic_summary...');
    const factResult = await pool.query(`
      SELECT DISTINCT state, SUM(total_members) as members, SUM(total_families) as families
      FROM fact_demographic_summary
      WHERE snapshot_date = CURRENT_DATE
        AND state != 'Unknown'
      GROUP BY state
      ORDER BY state
    `);

    console.log('   States in fact_demographic_summary:');
    factResult.rows.forEach(row => {
      console.log(`     - ${row.state}: ${row.members} members, ${row.families} families`);
    });
    console.log('');

    // Summary
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║                                                   ║');
    console.log('║      ✅ GEOGRAPHY DATA FIXED SUCCESSFULLY!       ║');
    console.log('║                                                   ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');

    console.log('🎉 Filters should now work correctly!');
    console.log('   → Go to Analytics Dashboard');
    console.log('   → Select a state from dropdown');
    console.log('   → You should now see data!\n');

  } catch (error) {
    console.error('❌ Error fixing geography:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

fixGeography();
