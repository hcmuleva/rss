const User = require('./src/models/User');
const pool = require('./src/config/database');
const bcrypt = require('bcrypt');

const test = async () => {
  const email = 'rajendra.prant@example.com';
  const password = 'welcome';
  
  const user = await User.findByEmail(email);
  if (!user) {
    console.log('User not found');
    process.exit(1);  
  }
  
  console.log('Found user:', user.email);
  console.log('Password hash in DB:', user.password_hash);
  
  const isValid = await User.verifyPassword(password, user.password_hash);
  console.log('Password is valid:', isValid);
  
  process.exit(0);
};

test();
