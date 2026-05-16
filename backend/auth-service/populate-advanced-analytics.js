/**
 * Populate Advanced Analytics Data
 * - Agriculture land for families
 * - Refresh all enhanced metrics
 */

const pool = require('./src/config/database');

// Agriculture data generators
const LAND_TYPES = ['Irrigated', 'Rain-fed', 'Mixed'];
const CROPS = [
  ['Wheat', 'Rice'],
  ['Cotton', 'Soybean'],
  ['Sugarcane'],
  ['Wheat', 'Mustard'],
  ['Rice', 'Pulses'],
  ['Vegetables', 'Fruits'],
  ['Cotton'],
  ['Groundnut', 'Maize']
];

function randomLandAcres() {
  // 40% have no land, 60% have 0.5-20 acres
  if (Math.random() < 0.4) return 0;
  
  const rand = Math.random();
  if (rand < 0.3) return parseFloat((Math.random() * 2 + 0.5).toFixed(2)); // Small: 0.5-2.5 acres
  if (rand < 0.7) return parseFloat((Math.random() * 5 + 2.5).toFixed(2)); // Medium: 2.5-7.5 acres
  return parseFloat((Math.random() * 12.5 + 7.5).toFixed(2)); // Large: 7.5-20 acres
}

function randomLandType() {
  const rand = Math.random();
  if (rand < 0.5) return 'Irrigated';
  if (rand < 0.8) return 'Rain-fed';
  return 'Mixed';
}

function randomCrops() {
  return JSON.stringify(CROPS[Math.floor(Math.random() * CROPS.length)]);
}

function calculateIncome(acres, type) {
  if (acres === 0) return 0;
  
  let incomePerAcre = 30000; // Base income
  if (type === 'Irrigated') incomePerAcre = 50000;
  if (type === 'Rain-fed') incomePerAcre = 25000;
  if (type === 'Mixed') incomePerAcre = 37500;
  
  return parseFloat((acres * incomePerAcre).toFixed(2));
}

async function populateAdvancedAnalytics() {
  try {
    console.log('🚀 Populating Advanced Analytics Data...\n');

    // =========================================================================
    // 1. POPULATE AGRICULTURE DATA FOR FAMILIES
    // =========================================================================
    console.log('🌾 Step 1: Adding agriculture land data to families...');
    
    const families = await pool.query('SELECT id FROM families ORDER BY id');
    console.log(`   Found ${families.rows.length} families\n`);
    
    let familiesUpdated = 0;
    let totalLandAdded = 0;
    
    for (const family of families.rows) {
      const acres = randomLandAcres();
      const landType = randomLandType();
      const crops = randomCrops();
      const income = calculateIncome(acres, landType);
      
      await pool.query(`
        UPDATE families 
        SET 
          agriculture_land_acres = $1,
          agriculture_land_type = $2,
          agriculture_crops = $3,
          agriculture_income_yearly = $4
        WHERE id = $5
      `, [acres, acres > 0 ? landType : null, acres > 0 ? crops : null, income, family.id]);
      
      familiesUpdated++;
      totalLandAdded += acres;
      
      if (familiesUpdated % 50 === 0) {
        console.log(`   Processed ${familiesUpdated}/${families.rows.length} families...`);
      }
    }
    
    console.log(`   ✅ Updated ${familiesUpdated} families`);
    console.log(`   📊 Total land: ${totalLandAdded.toFixed(2)} acres\n`);

    // =========================================================================
    // 2. REFRESH ALL ANALYTICS WITH NEW FUNCTIONS
    // =========================================================================
    console.log('📊 Step 2: Refreshing all analytics summaries...\n');
    
    console.log('   → Refreshing enhanced demographic summary...');
    await pool.query('SELECT refresh_demographic_summary_enhanced(NULL)');
    console.log('   ✅ Demographic summary refreshed\n');
    
    console.log('   → Refreshing agriculture summary...');
    await pool.query('SELECT refresh_agriculture_summary(NULL)');
    console.log('   ✅ Agriculture summary refreshed\n');
    
    console.log('   → Refreshing occupation summary...');
    await pool.query('SELECT refresh_occupation_summary(NULL)');
    console.log('   ✅ Occupation summary refreshed\n');

    // =========================================================================
    // 3. VERIFY NEW DATA
    // =========================================================================
    console.log('🔍 Step 3: Verifying new analytics data...\n');
    
    // Check demographic enhancement
    const demoResult = await pool.query(`
      SELECT 
        SUM(total_members) as total_members,
        SUM(married_male) as married_male,
        SUM(married_female) as married_female,
        SUM(bachelor_male) as bachelor_male,
        SUM(bachelor_female) as bachelor_female,
        SUM(divorced_male) as divorced_male,
        SUM(divorced_female) as divorced_female
      FROM fact_demographic_summary
      WHERE snapshot_date = CURRENT_DATE
    `);
    
    console.log('   Enhanced Demographics:');
    const demo = demoResult.rows[0];
    console.log(`     Total Members: ${demo.total_members}`);
    console.log(`     Married Male: ${demo.married_male}, Married Female: ${demo.married_female}`);
    console.log(`     Bachelor Male: ${demo.bachelor_male}, Bachelor Female: ${demo.bachelor_female}`);
    console.log(`     Divorced Male: ${demo.divorced_male}, Divorced Female: ${demo.divorced_female}\n`);
    
    // Check agriculture summary
    const agriResult = await pool.query(`
      SELECT 
        SUM(total_families) as total_families,
        SUM(families_with_land) as families_with_land,
        SUM(total_land_acres) as total_land_acres,
        ROUND(AVG(avg_land_per_family), 2) as avg_land_per_family,
        SUM(total_agri_income) as total_agri_income
      FROM fact_agriculture_summary
      WHERE snapshot_date = CURRENT_DATE
    `);
    
    console.log('   Agriculture Metrics:');
    const agri = agriResult.rows[0];
    console.log(`     Total Families: ${agri.total_families}`);
    console.log(`     Families with Land: ${agri.families_with_land} (${Math.round(agri.families_with_land/agri.total_families*100)}%)`);
    console.log(`     Total Land: ${parseFloat(agri.total_land_acres).toFixed(2)} acres`);
    console.log(`     Avg Land/Family: ${agri.avg_land_per_family} acres`);
    console.log(`     Total Annual Income: ₹${parseFloat(agri.total_agri_income).toLocaleString('en-IN')}\n`);
    
    // Check occupation summary
    const occResult = await pool.query(`
      SELECT 
        SUM(total_in_jobs) as total_in_jobs,
        SUM(total_in_business) as total_in_business,
        SUM(government_job) as government_job,
        SUM(private_job) as private_job,
        SUM(shop_business) as shop_business,
        SUM(student_count) as student_count,
        SUM(homemaker_count) as homemaker_count
      FROM fact_occupation_summary
      WHERE snapshot_date = CURRENT_DATE
    `);
    
    console.log('   Occupation Metrics:');
    const occ = occResult.rows[0];
    console.log(`     Total in Jobs: ${occ.total_in_jobs}`);
    console.log(`       - Government: ${occ.government_job}`);
    console.log(`       - Private: ${occ.private_job}`);
    console.log(`     Total in Business: ${occ.total_in_business}`);
    console.log(`       - Shop/Trade: ${occ.shop_business}`);
    console.log(`     Students: ${occ.student_count}`);
    console.log(`     Homemakers: ${occ.homemaker_count}\n`);

    // =========================================================================
    // Sample State-wise Data
    // =========================================================================
    console.log('📋 Sample State-wise Breakdown:\n');
    
    const stateData = await pool.query(`
      SELECT 
        state,
        total_families,
        families_with_land,
        ROUND(total_land_acres, 2) as total_land_acres,
        ROUND(avg_land_per_family, 2) as avg_land_per_family
      FROM fact_agriculture_summary
      WHERE snapshot_date = CURRENT_DATE
        AND state != 'Unknown'
      ORDER BY total_land_acres DESC
      LIMIT 5
    `);
    
    console.log('   Top States by Agricultural Land:');
    stateData.rows.forEach((row, i) => {
      console.log(`     ${i+1}. ${row.state}:`);
      console.log(`        ${row.families_with_land}/${row.total_families} families with land`);
      console.log(`        Total: ${row.total_land_acres} acres (Avg: ${row.avg_land_per_family} acres/family)\n`);
    });

    // =========================================================================
    // Success Summary
    // =========================================================================
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║                                                   ║');
    console.log('║   ✅ ADVANCED ANALYTICS READY! ✅                ║');
    console.log('║                                                   ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');

    console.log('🎉 New Metrics Available:');
    console.log('   1. Agriculture Land per Family ✅');
    console.log('      - Total land, avg per family');
    console.log('      - Land types (Irrigated/Rain-fed)');
    console.log('      - Yearly income estimates');
    console.log('');
    console.log('   2. Enhanced Demographics ✅');
    console.log('      - Married Male/Female');
    console.log('      - Bachelor Male/Female');
    console.log('      - Divorced Male/Female');
    console.log('      - Widowed Male/Female');
    console.log('');
    console.log('   3. Job vs Business ✅');
    console.log('      - Government/Private jobs');
    console.log('      - Shop/Trading/Manufacturing');
    console.log('      - Students, Homemakers, Retired');
    console.log('');
    console.log('   4. Tehsil Level Filtering ✅');
    console.log('      - State → District → Tehsil → Village');
    console.log('');
    console.log('📱 Next: Update frontend to display new metrics!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

populateAdvancedAnalytics();
