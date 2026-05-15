const User = require('./src/models/User');
const pool = require('./src/config/database');

const seedRBAC = async () => {
  try {
    console.log('🌱 Seeding RBAC data...');
    
    // Ensure tables and columns exist
    await User.createTable();

    // 1. Prant Admin (MP)
    await User.create({
      firstName: 'Rajendra',
      fatherName: 'Prant',
      dob: '1980-01-01',
      gotra: 'Muleva',
      email: 'rajendra.prant@example.com',
      password: 'welcome',
      role: 'admin',
      assignmentLevel: 'prant',
      state: 'Madhya Pradesh',
    }).catch(e => console.log('Prant Admin might already exist:', e.message));

    // 2. Jila Admin (Barwani)
    await User.create({
      firstName: 'Dinesh',
      fatherName: 'Jila',
      dob: '1985-05-15',
      gotra: 'Seervi',
      email: 'dinesh.jila@example.com',
      password: 'welcome',
      role: 'admin',
      assignmentLevel: 'jila',
      state: 'Madhya Pradesh',
      district: 'Barwani',
    }).catch(e => console.log('Jila Admin might already exist:', e.message));

    // 3. Tehsil Admin (Rajpur)
    await User.create({
      firstName: 'Suresh',
      fatherName: 'Tehsil',
      dob: '1990-10-10',
      gotra: 'Kag',
      email: 'suresh.tehsil@example.com',
      password: 'welcome',
      role: 'admin',
      assignmentLevel: 'tehsil',
      state: 'Madhya Pradesh',
      district: 'Barwani',
      tehsil: 'Rajpur',
    }).catch(e => console.log('Tehsil Admin might already exist:', e.message));

    // 4. Village Admin (Anjad)
    await User.create({
      firstName: 'Mahesh',
      fatherName: 'Village',
      dob: '1995-12-25',
      gotra: 'Leva',
      email: 'mahesh.village@example.com',
      password: 'welcome',
      role: 'admin',
      assignmentLevel: 'village',
      state: 'Madhya Pradesh',
      district: 'Barwani',
      tehsil: 'Rajpur',
      village: 'Anjad',
    }).catch(e => console.log('Village Admin might already exist:', e.message));

    // 5. Regular User (Barwani)
    await User.create({
      firstName: 'Ramesh',
      fatherName: 'User',
      dob: '2000-01-01',
      gotra: 'Gehlot',
      email: 'ramesh.user@example.com',
      password: 'welcome',
      role: 'user',
      assignmentLevel: 'village',
      state: 'Madhya Pradesh',
      district: 'Barwani',
      tehsil: 'Rajpur',
      village: 'Anjad',
    }).catch(e => console.log('Regular User might already exist:', e.message));

    console.log('✅ RBAC Seeding completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ RBAC Seeding failed:', error);
    process.exit(1);
  }
};

seedRBAC();
