/**
 * =====================================================================
 * Jodhpur District Hierarchical Seed Data
 * Company: emeelan
 * =====================================================================
 * Creates comprehensive test data for hierarchical temple admin system:
 * - 1 District: Jodhpur
 * - 3 Tehsils: Jodhpur City, Bilara, Phalodi
 * - 6 Villages (2 per tehsil)
 * - 6 Temples (1 per village)
 * - 18 Families (3 per village, named as Gotra-Family)
 * - Multiple members per family
 * - Hierarchical admin assignments
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'seerviportal',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Gotras from the system
const GOTRAS = [
  'Kag', 'Sencha', 'Parmar', 'Pawar', 'Bhayal', 'Hambad',
  'Sindarha', 'Muleva', 'Rathod', 'Barfa', 'Chouhan', 'Choyal',
  'Dewda', 'Septa', 'Mogrecha', 'Chaanwdia', 'Aaglecha', 'Gahlot'
];

// Family surnames (will be combined with Gotra)
const FAMILY_NAMES = [
  'Rathore', 'Sharma', 'Patel', 'Singh', 'Mehta', 'Joshi',
  'Verma', 'Kumar', 'Desai', 'Shah', 'Gupta', 'Reddy',
  'Nair', 'Pillai', 'Rao', 'Iyer', 'Menon', 'Agarwal'
];

// Male first names
const MALE_NAMES = [
  'Rajesh', 'Mahesh', 'Suresh', 'Ramesh', 'Dinesh', 'Mukesh',
  'Vijay', 'Ajay', 'Sanjay', 'Manoj', 'Anil', 'Sunil',
  'Rakesh', 'Naresh', 'Jagdish', 'Harish', 'Girish', 'Ashok'
];

// Female first names
const FEMALE_NAMES = [
  'Sunita', 'Geeta', 'Seema', 'Rekha', 'Meena', 'Radha',
  'Sita', 'Gita', 'Anita', 'Kavita', 'Savita', 'Nita',
  'Preeti', 'Bharti', 'Aarti', 'Shakti', 'Kriti', 'Shruti'
];

// District and Tehsil structure
const JODHPUR_STRUCTURE = {
  district: 'Jodhpur',
  state: 'Rajasthan',
  tehsils: [
    {
      name: 'Jodhpur City',
      villages: [
        { name: 'Jodhpur', pincode: '342001', templeName: 'Jodhpur Main Temple' },
        { name: 'Mandore', pincode: '342007', templeName: 'Mandore Heritage Temple' }
      ]
    },
    {
      name: 'Bilara',
      villages: [
        { name: 'Bilara', pincode: '342602', templeName: 'Bilara Samaj Temple' },
        { name: 'Kakelao', pincode: '342604', templeName: 'Kakelao Community Temple' }
      ]
    },
    {
      name: 'Phalodi',
      villages: [
        { name: 'Phalodi', pincode: '342301', templeName: 'Phalodi Seervi Temple' },
        { name: 'Lohawat', pincode: '342308', templeName: 'Lohawat Dharma Temple' }
      ]
    }
  ]
};

/**
 * Generate random phone number
 */
function generatePhone() {
  return '+91' + Math.floor(7000000000 + Math.random() * 2999999999);
}

/**
 * Generate random email
 */
function generateEmail(firstName, familyName) {
  const sanitized = firstName.toLowerCase() + '.' + familyName.toLowerCase().replace(/[^a-z]/g, '');
  return `${sanitized}@seervi.org`;
}

/**
 * Create a user
 */
async function createUser(firstName, fatherName, gotra, role = 'user', phone = null, email = null) {
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const query = `
    INSERT INTO users (
      first_name, father_name, gotra, role, phone, email, 
      password, is_active, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
    RETURNING id, first_name, gotra, role
  `;

  const values = [
    firstName,
    fatherName,
    gotra,
    role,
    phone || generatePhone(),
    email || generateEmail(firstName, gotra),
    hashedPassword
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Create a temple
 */
async function createTemple(templeData, createdBy) {
  const { name, district, tehsil, village, city, pincode } = templeData;
  
  const query = `
    INSERT INTO temples (
      slug, name, name_hi, location, address,
      city, state, district, tehsil, village, pincode,
      contact_email, contact_phone,
      is_active, created_by, created_at
    )
    VALUES (
      substring(md5(random()::text), 1, 9),
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13, NOW()
    )
    RETURNING id, slug, name, district, tehsil, village
  `;

  const values = [
    name,
    name + ' मंदिर', // Hindi name
    village,
    `Main Street, ${village}`,
    city,
    'Rajasthan',
    district,
    tehsil,
    village,
    pincode,
    `contact@${village.toLowerCase()}.seervi.org`,
    generatePhone(),
    createdBy
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Assign user to temple with admin level
 */
async function assignUserToTemple(userId, templeId, role, adminLevel, assignedBy) {
  const query = `
    INSERT INTO user_temples (
      user_id, temple_id, role, admin_level, assigned_by, assigned_at, is_active
    )
    VALUES ($1, $2, $3, $4, $5, NOW(), true)
    ON CONFLICT (user_id, temple_id) 
    DO UPDATE SET role = EXCLUDED.role, admin_level = EXCLUDED.admin_level
    RETURNING id, user_id, temple_id, role, admin_level
  `;

  const result = await pool.query(query, [userId, templeId, role, adminLevel, assignedBy]);
  return result.rows[0];
}

/**
 * Main seed function
 */
async function seedJodhpurHierarchy() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('\n🌱 Starting Jodhpur District Hierarchical Seed...\n');

    // Step 1: Create SuperAdmin
    console.log('👑 Creating SuperAdmin...');
    const superAdmin = await createUser(
      'SuperAdmin',
      'System',
      'Admin',
      'superadmin',
      '+919999999999',
      'superadmin@seervi.org'
    );
    console.log(`✅ SuperAdmin created: ${superAdmin.first_name} (ID: ${superAdmin.id})\n`);

    // Step 2: Create District Admin
    console.log('🏙️ Creating District Admin for Jodhpur...');
    const districtAdmin = await createUser(
      'Mahesh',
      'Kumar',
      'Rathod',
      'admin',
      '+919876543210',
      'mahesh.jodhpur@seervi.org'
    );
    console.log(`✅ District Admin created: ${districtAdmin.first_name} (ID: ${districtAdmin.id})\n`);

    let gotraIndex = 0;
    let familyIndex = 0;
    let maleNameIndex = 0;
    let femaleNameIndex = 0;

    const allTemples = [];
    const allFamilies = [];
    const tehsilAdmins = [];

    // Step 3: Iterate through structure
    console.log('🏗️ Creating Hierarchical Structure...\n');

    for (const tehsil of JODHPUR_STRUCTURE.tehsils) {
      console.log(`📍 Tehsil: ${tehsil.name}`);
      
      // Create Tehsil Admin
      const tehsilAdmin = await createUser(
        MALE_NAMES[maleNameIndex++ % MALE_NAMES.length],
        'Singh',
        GOTRAS[gotraIndex++ % GOTRAS.length],
        'admin',
        generatePhone(),
        null
      );
      tehsilAdmins.push({ admin: tehsilAdmin, tehsil: tehsil.name });
      console.log(`  👤 Tehsil Admin: ${tehsilAdmin.first_name} ${tehsilAdmin.gotra}`);

      for (const village of tehsil.villages) {
        console.log(`  🏡 Village: ${village.name}`);

        // Create Village Admin
        const villageAdmin = await createUser(
          MALE_NAMES[maleNameIndex++ % MALE_NAMES.length],
          'Sharma',
          GOTRAS[gotraIndex++ % GOTRAS.length],
          'admin',
          generatePhone(),
          null
        );
        console.log(`    👤 Village Admin: ${villageAdmin.first_name} ${villageAdmin.gotra}`);

        // Create Temple
        const temple = await createTemple({
          name: village.templeName,
          district: JODHPUR_STRUCTURE.district,
          tehsil: tehsil.name,
          village: village.name,
          city: village.name,
          pincode: village.pincode
        }, superAdmin.id);
        
        allTemples.push({ temple, tehsil: tehsil.name, village: village.name });
        console.log(`    🏛️ Temple: ${temple.name} (ID: ${temple.id})`);

        // Assign Temple Admin
        const templeAdmin = await createUser(
          MALE_NAMES[maleNameIndex++ % MALE_NAMES.length],
          'Patel',
          GOTRAS[gotraIndex++ % GOTRAS.length],
          'admin',
          generatePhone(),
          null
        );
        await assignUserToTemple(templeAdmin.id, temple.id, 'admin', 'temple', superAdmin.id);
        console.log(`    👤 Temple Admin: ${templeAdmin.first_name} ${templeAdmin.gotra}`);

        // Assign hierarchical admins
        await assignUserToTemple(villageAdmin.id, temple.id, 'admin', 'village', superAdmin.id);
        await assignUserToTemple(tehsilAdmin.id, temple.id, 'admin', 'tehsil', superAdmin.id);

        // Create 3 Families per village
        for (let f = 0; f < 3; f++) {
          const gotra = GOTRAS[gotraIndex++ % GOTRAS.length];
          const familyName = FAMILY_NAMES[familyIndex++ % FAMILY_NAMES.length];
          const familyFullName = `${gotra}-${familyName}`;

          console.log(`      👨‍👩‍👧‍👦 Family: ${familyFullName}`);

          // Create Family Head (Male)
          const familyHead = await createUser(
            MALE_NAMES[maleNameIndex++ % MALE_NAMES.length],
            MALE_NAMES[(maleNameIndex + 5) % MALE_NAMES.length], // Father's name
            gotra,
            'user',
            generatePhone(),
            null
          );

          // Assign family head to temple
          await assignUserToTemple(familyHead.id, temple.id, 'member', 'temple', templeAdmin.id);

          // Create Spouse (Female)
          const spouse = await createUser(
            FEMALE_NAMES[femaleNameIndex++ % FEMALE_NAMES.length],
            familyHead.first_name, // Husband's name as father name
            gotra,
            'user',
            generatePhone(),
            null
          );
          await assignUserToTemple(spouse.id, temple.id, 'member', 'temple', templeAdmin.id);

          // Create 2 Children
          for (let c = 0; c < 2; c++) {
            const isChild1Male = c === 0;
            const childName = isChild1Male 
              ? MALE_NAMES[maleNameIndex++ % MALE_NAMES.length]
              : FEMALE_NAMES[femaleNameIndex++ % FEMALE_NAMES.length];
            
            const child = await createUser(
              childName,
              familyHead.first_name,
              gotra,
              'user',
              generatePhone(),
              null
            );
            await assignUserToTemple(child.id, temple.id, 'member', 'temple', templeAdmin.id);
          }

          allFamilies.push({
            name: familyFullName,
            gotra: gotra,
            head: familyHead,
            temple: temple,
            village: village.name,
            tehsil: tehsil.name
          });

          console.log(`        ✅ Family created with 4 members`);
        }
      }
      console.log('');
    }

    // Step 4: Assign District Admin to first temple in district
    console.log('🔗 Assigning District Admin...');
    if (allTemples.length > 0) {
      await assignUserToTemple(
        districtAdmin.id,
        allTemples[0].temple.id,
        'admin',
        'district',
        superAdmin.id
      );
      console.log(`✅ District Admin assigned to ${allTemples[0].temple.name}\n`);
    }

    await client.query('COMMIT');

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ JODHPUR DISTRICT SEED DATA COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:\n');
    console.log(`🏙️ District: ${JODHPUR_STRUCTURE.district}`);
    console.log(`📍 Tehsils: ${JODHPUR_STRUCTURE.tehsils.length}`);
    console.log(`🏡 Villages: ${allTemples.length}`);
    console.log(`🏛️ Temples: ${allTemples.length}`);
    console.log(`👨‍👩‍👧‍👦 Families: ${allFamilies.length}`);
    console.log(`👥 Total Members: ~${allFamilies.length * 4} (4 per family)`);
    
    console.log('\n👑 Admin Hierarchy:\n');
    console.log(`  SuperAdmin: ${superAdmin.first_name} (${superAdmin.email})`);
    console.log(`  District Admin: ${districtAdmin.first_name} ${districtAdmin.gotra} (Jodhpur District)`);
    console.log(`  Tehsil Admins: ${tehsilAdmins.length}`);
    tehsilAdmins.forEach(ta => {
      console.log(`    - ${ta.admin.first_name} ${ta.admin.gotra} (${ta.tehsil})`);
    });
    console.log(`  Village Admins: ${allTemples.length}`);
    console.log(`  Temple Admins: ${allTemples.length}`);

    console.log('\n📍 Geographical Structure:\n');
    JODHPUR_STRUCTURE.tehsils.forEach(tehsil => {
      console.log(`  ${tehsil.name}:`);
      tehsil.villages.forEach(village => {
        const familiesInVillage = allFamilies.filter(f => f.village === village.name);
        console.log(`    └─ ${village.name}: ${familiesInVillage.length} families`);
        familiesInVillage.forEach(f => {
          console.log(`       • ${f.name} (${f.gotra})`);
        });
      });
    });

    console.log('\n🔑 Login Credentials:\n');
    console.log('  All users password: password123');
    console.log(`  SuperAdmin: ${superAdmin.email}`);
    console.log(`  District Admin: ${districtAdmin.email}`);
    
    console.log('\n🧪 Test Hierarchical Access:\n');
    console.log('  1. Login as District Admin - should see ALL temples in Jodhpur');
    console.log('  2. Login as Tehsil Admin - should see temples in their tehsil');
    console.log('  3. Login as Village Admin - should see temples in their village');
    console.log('  4. Login as Temple Admin - should see only their temple');

    console.log('\n🌐 API Test:\n');
    console.log(`  GET /api/accessible-temples/${districtAdmin.id} (District Admin)`);
    console.log(`  GET /api/admin-stats (SuperAdmin)`);
    console.log(`  GET /api/geographical-hierarchy?district=Jodhpur`);

    console.log('\n' + '='.repeat(60) + '\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error seeding data:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Clear existing data (optional)
 */
async function clearExistingData() {
  console.log('🗑️  Clearing existing data...\n');
  
  try {
    await pool.query('DELETE FROM user_temples WHERE id > 0');
    await pool.query('DELETE FROM temples WHERE id > 0');
    await pool.query('DELETE FROM users WHERE role != \'superadmin\' OR email != \'admin@seervi.org\'');
    console.log('✅ Existing data cleared\n');
  } catch (error) {
    console.error('⚠️  Error clearing data:', error.message);
    console.log('Continuing with seed...\n');
  }
}

/**
 * Run the seed
 */
async function run() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🌱 JODHPUR DISTRICT HIERARCHICAL SEED');
    console.log('='.repeat(60) + '\n');

    // Optional: Clear existing data
    const args = process.argv.slice(2);
    if (args.includes('--clear')) {
      await clearExistingData();
    }

    await seedJodhpurHierarchy();

    console.log('✅ Seed completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  run();
}

module.exports = { seedJodhpurHierarchy };
