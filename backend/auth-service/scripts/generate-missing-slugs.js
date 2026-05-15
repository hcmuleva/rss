/**
 * =====================================================================
 * Generate Missing Slugs Script
 * Company: emeelan
 * Description: Generate slug IDs for all existing users without one
 * Phase 1: Slug ID Migration
 * =====================================================================
 */

const pool = require('../src/config/database');
const { customAlphabet } = require('nanoid');

// Same slug generation as User model
function generateSlug() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  const nanoid = customAlphabet(alphabet, 9);
  return nanoid();
}

async function generateMissingSlugs() {
  console.log('🔄 Starting slug generation for existing users...\n');

  try {
    // Find users without slugs
    const query = `SELECT id, email, first_name, slug FROM users WHERE slug = '' OR slug IS NULL`;
    const result = await pool.query(query);

    if (result.rows.length === 0) {
      console.log('✅ All users already have slugs!');
      return;
    }

    console.log(`📊 Found ${result.rows.length} users without slugs\n`);

    let successCount = 0;
    let errorCount = 0;

    // Generate slug for each user
    for (const user of result.rows) {
      try {
        const slug = generateSlug();
        
        await pool.query(
          'UPDATE users SET slug = $1 WHERE id = $2',
          [slug, user.id]
        );

        console.log(`✅ Generated slug for user ${user.id} (${user.email}): ${slug}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Error generating slug for user ${user.id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total: ${result.rows.length}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the script
generateMissingSlugs()
  .then(() => {
    console.log('\n🎉 Slug generation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Slug generation failed:', error);
    process.exit(1);
  });
