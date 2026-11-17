require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'rss_new',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function resetPasswords() {
  const password = 'welcome';
  const hash = await bcrypt.hash(password, 10);
  
  console.log('Generated hash for password "welcome"');
  
  // Update all users with this password
  const users = [
    'harish@emeelan.com',
    'superadmin@rss.com',
    'rmm@a.com',
    'mrm@a.com',
    'aang@a.com',
    'aang1@a.com',
    'aang2@a.com',
    'aang3@a.com'
  ];
  
  for (const email of users) {
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING email',
      [hash, email]
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Updated password for:', email);
    } else {
      console.log('⚠️ User not found:', email);
    }
  }
  
  // Update family_id if column exists
  try {
    const colCheck = await pool.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='family_id'"
    );
    if (colCheck.rows.length > 0) {
      await pool.query("UPDATE users SET family_id = 3 WHERE email = 'harish@emeelan.com'");
      await pool.query("UPDATE users SET family_id = 6 WHERE email IN ('rmm@a.com', 'mrm@a.com')");
      await pool.query("UPDATE users SET family_id = 7 WHERE email IN ('aang@a.com', 'aang1@a.com', 'aang2@a.com', 'aang3@a.com')");
      console.log('✅ Updated family_id for all users');
    }
  } catch (err) {
    console.log('⚠️ Skipping family_id update (not present in this schema)');
  }
  
  await pool.end();
  console.log('\n✅ All passwords reset to: welcome');
  console.log('✅ All family_id values updated');
}

resetPasswords().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
