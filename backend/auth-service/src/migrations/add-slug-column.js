/**
 * =====================================================================
 * Migration: Add Slug Column to Users Table
 * Company: emeelan
 * =====================================================================
 */

const pool = require('../config/database');
const { customAlphabet } = require('nanoid');

// Generate unique slug
function generateSlug() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  const nanoid = customAlphabet(alphabet, 9);
  return nanoid();
}

async function addSlugColumn() {
  try {
    console.log('🔄 Starting slug column migration...');

    // Check if slug column already exists
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='slug';
    `;
    
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Slug column already exists');
      return;
    }

    // Step 1: Add slug column (nullable first)
    console.log('📝 Adding slug column...');
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS slug VARCHAR(12);
    `);
    console.log('✅ Slug column added');

    // Step 2: Generate slugs for existing users
    console.log('🔄 Generating slugs for existing users...');
    const users = await pool.query('SELECT id FROM users WHERE slug IS NULL');
    
    for (const user of users.rows) {
      const slug = generateSlug();
      await pool.query('UPDATE users SET slug = $1 WHERE id = $2', [slug, user.id]);
    }
    console.log(`✅ Generated ${users.rows.length} slugs`);

    // Step 3: Make slug NOT NULL
    console.log('📝 Making slug column NOT NULL...');
    await pool.query(`
      ALTER TABLE users 
      ALTER COLUMN slug SET NOT NULL;
    `);
    console.log('✅ Slug column set to NOT NULL');

    // Step 4: Add UNIQUE constraint
    console.log('📝 Adding UNIQUE constraint on slug...');
    await pool.query(`
      ALTER TABLE users 
      ADD CONSTRAINT users_slug_key UNIQUE (slug);
    `);
    console.log('✅ UNIQUE constraint added');

    // Step 5: Create index on slug
    console.log('📝 Creating index on slug...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_slug ON users(slug);
    `);
    console.log('✅ Index created');

    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  addSlugColumn()
    .then(() => {
      console.log('✅ Migration finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration error:', error);
      process.exit(1);
    });
}

module.exports = { addSlugColumn };
