const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'seervi',
  user: 'postgres',
  password: 'password'
});

async function resetPasswords() {
  const password = 'welcome';
  const hash = await bcrypt.hash(password, 10);
  
  console.log('Generated hash for password "welcome"');
  
  // Update all users with this password
  const users = [
    'harish@emeelan.com',
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
  
  // Also ensure family_id is set
  await pool.query("UPDATE users SET family_id = 3 WHERE email = 'harish@emeelan.com'");
  await pool.query("UPDATE users SET family_id = 6 WHERE email IN ('rmm@a.com', 'mrm@a.com')");
  await pool.query("UPDATE users SET family_id = 7 WHERE email IN ('aang@a.com', 'aang1@a.com', 'aang2@a.com', 'aang3@a.com')");
  
  console.log('✅ Updated family_id for all users');
  
  await pool.end();
  console.log('\n✅ All passwords reset to: welcome');
  console.log('✅ All family_id values updated');
}

resetPasswords().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
