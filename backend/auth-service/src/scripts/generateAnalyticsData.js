/**
 * =====================================================================
 * Analytics Seed Data Generator
 * Company: emeelan
 * =====================================================================
 * Generates realistic Indian temple data for analytics testing
 */

const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

// Load gotras from the actual gotra.json file
const gotraJsonPath = path.join(__dirname, '../../../frontend/src/constants/gotra.json');
let GOTRAS = [];
try {
  const gotraData = JSON.parse(fs.readFileSync(gotraJsonPath, 'utf8'));
  GOTRAS = gotraData.gotras.map(g => g.name);
  console.log(`✅ Loaded ${GOTRAS.length} gotras from gotra.json`);
} catch (error) {
  console.log('⚠️  Could not load gotra.json:', error.message);
  GOTRAS = [
    'Kag', 'Sencha', 'Parmar', 'Pawar', 'Bhayal', 'Muleva', 
    'Rathod', 'Barfa', 'Chouhan', 'Choyal', 'Dewda', 'Septa',
    'Mogrecha', 'Gahlot', 'Solanki', 'Parihar'
  ];
}

const INDIAN_STATES = [
  { state: 'Rajasthan', districts: ['Jaipur', 'Jodhpur', 'Udaipur', 'Ajmer'] },
  { state: 'Gujarat', districts: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'] },
  { state: 'Maharashtra', districts: ['Mumbai', 'Pune', 'Nagpur', 'Nashik'] },
  { state: 'Madhya Pradesh', districts: ['Indore', 'Bhopal', 'Ujjain', 'Gwalior'] },
  { state: 'Uttar Pradesh', districts: ['Lucknow', 'Varanasi', 'Agra', 'Mathura'] }
];

const TEMPLE_NAMES = [
  'Shri Ram Mandir', 'Hanuman Temple', 'Shiva Temple', 'Krishna Temple',
  'Ganesh Mandir', 'Durga Temple', 'Laxmi Narayan Mandir', 'Radha Krishna Temple',
  'Shri Balaji Temple', 'Mahadev Temple'
];

const MALE_FIRST_NAMES = [
  'Rajesh', 'Amit', 'Suresh', 'Ramesh', 'Mahesh', 'Dinesh', 'Vikram', 'Arun',
  'Vijay', 'Ajay', 'Sanjay', 'Prakash', 'Ashok', 'Deepak', 'Rahul', 'Rohan',
  'Arjun', 'Karan', 'Varun', 'Nikhil', 'Ankit', 'Vishal', 'Harsh', 'Dev',
  'Krishna', 'Ram', 'Shyam', 'Mohan', 'Gopal', 'Ravi'
];

const FEMALE_FIRST_NAMES = [
  'Sunita', 'Meera', 'Priya', 'Kavita', 'Rekha', 'Geeta', 'Anita', 'Seema',
  'Radha', 'Sita', 'Savita', 'Deepika', 'Anjali', 'Pooja', 'Neha', 'Ritu',
  'Shreya', 'Divya', 'Sneha', 'Preeti', 'Swati', 'Nisha', 'Pallavi', 'Kiran',
  'Lakshmi', 'Saraswati', 'Parvati', 'Uma', 'Gayatri', 'Kamala'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Agarwal', 'Joshi', 'Mishra', 'Pandey', 'Tripathi',
  'Tiwari', 'Dubey', 'Shukla', 'Singh', 'Kumar', 'Patel', 'Shah', 'Mehta',
  'Desai', 'Jain', 'Saxena', 'Srivastava'
];

const PROFESSIONS = [
  'Government Employee', 'Teacher/Professor', 'Doctor/Medical', 'Engineer',
  'Farmer', 'Business Owner', 'Shopkeeper', 'Private Employee',
  'Software Professional', 'Lawyer', 'Accountant', 'Student',
  'Homemaker', 'Retired'
];

const BUSINESS_TYPES = [
  'Kirana Store (Grocery)', 'Textile/Cloth Business', 'Restaurant/Food',
  'Pharmacy/Medical Store', 'Jewelry Business', 'Real Estate',
  'Electronics Shop', 'Agriculture/Farming', 'Construction'
];

// Helper functions
function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomAge(min, max) {
  return randomInt(min, max);
}

function generateDOB(age) {
  const year = new Date().getFullYear() - age;
  const month = randomInt(1, 12);
  const day = randomInt(1, 28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Keep track of used emails to avoid duplicates
const usedEmails = new Set();
let emailCounter = 0;

function generateEmail(firstName, lastName) {
  emailCounter++;
  const timestamp = Date.now();
  const email = `${firstName.toLowerCase()}_${lastName.toLowerCase()}_${timestamp}${emailCounter}@analytics.emeelan.com`;
  usedEmails.add(email);
  return email;
}

async function generateData() {
  console.log('🚀 Starting Analytics Seed Data Generation...\n');

  try {
    // 1. Insert Gotras
    console.log('📜 Inserting Gotras...');
    for (let i = 0; i < GOTRAS.length; i++) {
      await pool.query(
        `INSERT INTO dim_gotras (gotra_name, lineage, display_order) 
         VALUES ($1, $2, $3) ON CONFLICT (gotra_name) DO NOTHING`,
        [GOTRAS[i], 'Brahmin', i + 1]
      );
    }
    console.log(`✅ Inserted ${GOTRAS.length} gotras\n`);

    // 2. Create Temples with Geographic Data
    console.log('🕌 Creating Temples...');
    const templeIds = [];
    
    for (let i = 0; i < 10; i++) {
      const stateInfo = randomItem(INDIAN_STATES);
      const district = randomItem(stateInfo.districts);
      const templeName = `${randomItem(TEMPLE_NAMES)} - ${district}`;
      const village = `${randomItem(['Ramnagar', 'Shyamnagar', 'Gopalnagar', 'Haripur', 'Vrindavan'])} ${i + 1}`;
      const tehsil = `${district} ${randomItem(['North', 'South', 'East', 'West'])}`;
      
      // Create temple
      const slug = `tpl-${randomInt(1000, 9999)}${i}`;
      const templeResult = await pool.query(
        `INSERT INTO temples (slug, name, address, city, state, pincode, contact_phone, contact_email, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         RETURNING id, pincode`,
        [
          slug,
          templeName,
          village,
          district,
          stateInfo.state,
          `${randomInt(100000, 999999)}`,
          `+91 ${randomInt(70000, 99999)}${randomInt(10000, 99999)}`,
          `contact@${templeName.toLowerCase().replace(/\s+/g, '').substring(0, 20)}.org`
        ]
      );
      
      const templeId = templeResult.rows[0].id;
      const pincode = templeResult.rows[0].pincode;
      templeIds.push(templeId);
      
      // Insert geography data
      await pool.query(
        `INSERT INTO dim_geography (temple_id, temple_name, village, tehsil, district, state, country, pincode)
         VALUES ($1, $2, $3, $4, $5, $6, 'India', $7)`,
        [templeId, templeName, village, tehsil, district, stateInfo.state, pincode]
      );
      
      console.log(`  ✓ Temple ${i + 1}: ${templeName} in ${district}, ${stateInfo.state}`);
    }
    console.log(`✅ Created ${templeIds.length} temples\n`);

    // 3. Create Families and Members
    console.log('👨‍👩‍👧‍👦 Creating Families and Members...');
    let totalFamilies = 0;
    let totalMembers = 0;

    for (const templeId of templeIds) {
      const familiesPerTemple = randomInt(30, 60);
      
      for (let f = 0; f < familiesPerTemple; f++) {
        const gotra = randomItem(GOTRAS);
        const lastName = randomItem(LAST_NAMES);
        const familySize = randomInt(3, 7);
        
        // Create family
        const familySlug = `fam-${randomInt(10000, 99999)}${f}`;
        const familyName = `${lastName} Family`;
        const familyResult = await pool.query(
          `INSERT INTO families (slug, name, temple_id, gotra, created_by, created_at)
           VALUES ($1, $2, $3, $4, 1, CURRENT_TIMESTAMP)
           RETURNING id`,
          [familySlug, familyName, templeId, gotra]
        );
        
        const familyId = familyResult.rows[0].id;
        totalFamilies++;
        
        // Create family members
        const members = [];
        
        // Head of family (Male, 40-65 years)
        const headFirstName = randomItem(MALE_FIRST_NAMES);
        const headAge = randomInt(40, 65);
        const headEmail = generateEmail(headFirstName, lastName);
        
        const headResult = await pool.query(
          `INSERT INTO users (
            first_name, father_name, last_name, dob, gotra, email, password_hash,
            role, is_active, terms_accepted, family_id, temple_id, gender, marital_status, phone
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'user', true, true, $8, $9, 'Male', 'Married', $10)
          RETURNING id`,
          [
            headFirstName, randomItem(MALE_FIRST_NAMES), lastName,
            generateDOB(headAge), gotra, headEmail,
            '$2b$10$dummyHashForSeedData', // Dummy hash
            familyId, templeId,
            `+91 ${randomInt(70000, 99999)}${randomInt(10000, 99999)}`
          ]
        );
        members.push({ id: headResult.rows[0].id, age: headAge, gender: 'Male' });
        totalMembers++;
        
        // Spouse (Female, 35-60 years)
        if (randomInt(1, 10) > 1) { // 90% have spouse
          const spouseAge = headAge - randomInt(-5, 5);
          const spouseFirstName = randomItem(FEMALE_FIRST_NAMES);
          const spouseEmail = generateEmail(spouseFirstName, lastName);
          
          const spouseResult = await pool.query(
            `INSERT INTO users (
              first_name, father_name, last_name, dob, gotra, email, password_hash,
              role, is_active, terms_accepted, family_id, temple_id, gender, marital_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'user', true, true, $8, $9, 'Female', 'Married')
            RETURNING id`,
            [
              spouseFirstName, headFirstName, lastName,
              generateDOB(Math.max(18, spouseAge)), gotra, spouseEmail,
              '$2b$10$dummyHashForSeedData',
              familyId, templeId
            ]
          );
          members.push({ id: spouseResult.rows[0].id, age: spouseAge, gender: 'Female' });
          totalMembers++;
        }
        
        // Children (if any)
        const childrenCount = familySize - 2;
        for (let c = 0; c < childrenCount; c++) {
          const childGender = randomItem(['Male', 'Female']);
          const childAge = randomInt(1, 25);
          const childFirstName = childGender === 'Male' ? randomItem(MALE_FIRST_NAMES) : randomItem(FEMALE_FIRST_NAMES);
          const childEmail = generateEmail(childFirstName, `${lastName}${c + 1}`);
          const maritalStatus = childAge >= 21 && randomInt(1, 10) > 6 ? 'Married' : 'Unmarried';
          
          const childResult = await pool.query(
            `INSERT INTO users (
              first_name, father_name, last_name, dob, gotra, email, password_hash,
              role, is_active, terms_accepted, family_id, temple_id, gender, marital_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'user', true, true, $8, $9, $10, $11)
            RETURNING id`,
            [
              childFirstName, headFirstName, lastName,
              generateDOB(childAge), gotra, childEmail,
              '$2b$10$dummyHashForSeedData',
              familyId, templeId, childGender, maritalStatus
            ]
          );
          members.push({ id: childResult.rows[0].id, age: childAge, gender: childGender });
          totalMembers++;
        }
        
        // Note: Skipping professions and businesses for now
        // These can be added later through the UI or separate script
      }
      
      console.log(`  ✓ Temple ${templeId}: Created ${familiesPerTemple} families`);
    }
    
    console.log(`✅ Created ${totalFamilies} families with ${totalMembers} members\n`);

    // 4. Refresh Analytics Summaries
    console.log('📊 Refreshing Analytics Summaries...');
    await pool.query('SELECT refresh_all_analytics()');
    console.log('✅ Analytics summaries refreshed\n');

    // 5. Show Summary
    console.log('📈 Data Generation Summary:');
    console.log('═══════════════════════════════════════');
    
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM temples WHERE is_active = true) as temples,
        (SELECT COUNT(*) FROM families) as families,
        (SELECT COUNT(*) FROM users) as members,
        (SELECT COUNT(*) FROM dim_gotras) as gotras
    `);
    
    const s = stats.rows[0];
    console.log(`🕌 Temples:      ${s.temples}`);
    console.log(`👨‍👩‍👧‍👦 Families:      ${s.families}`);
    console.log(`👤 Members:      ${s.members}`);
    console.log(`📜 Gotras:       ${s.gotras}`);
    console.log('═══════════════════════════════════════\n');

    console.log('✅ Analytics seed data generation complete!');
    console.log('🎉 Ready to generate reports!\n');

  } catch (error) {
    console.error('❌ Error generating data:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  generateData()
    .then(() => {
      console.log('✨ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { generateData };
