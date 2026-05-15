/**
 * Migration: Migrate family_temple from families table to family_temples junction table
 */

const pool = require('../../config/database');

async function migrateFamilyTemples() {
  console.log('🔄 Starting family-temples migration...');
  
  try {
    // 1. Ensure junction table exists
    const Family = require('../Family');
    await Family.initFamilyTemplesTable();
    
    // 2. Fetch all families with temple_id
    const families = await pool.query('SELECT id, temple_id FROM families WHERE temple_id IS NOT NULL');
    
    console.log(`📊 Found ${families.rows.length} families with primary temples to migrate`);
    
    let migratedCount = 0;
    for (const family of families.rows) {
      try {
        await pool.query(`
          INSERT INTO family_temples (family_id, temple_id, is_primary)
          VALUES ($1, $2, true)
          ON CONFLICT (family_id, temple_id) DO UPDATE SET is_primary = true
        `, [family.id, family.temple_id]);
        migratedCount++;
      } catch (err) {
        console.error(`❌ Failed to migrate family ${family.id}:`, err.message);
      }
    }
    
    console.log(`✅ Migration complete. Migrated ${migratedCount} associations.`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

if (require.main === module) {
  migrateFamilyTemples().then(() => process.exit(0));
}

module.exports = { migrateFamilyTemples };
