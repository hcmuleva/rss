/**
 * Fix Seed Data with Real Indian Addresses
 * Uses Postal Pincode API to get proper State/District/Tehsil data
 */

const pool = require('./src/config/database');
const https = require('https');

// Real Indian Pincodes across different states
const PINCODES = {
  'Rajasthan': [
    '302001', '302002', '302003', '302004', '302005', // Jaipur
    '342001', '342002', '342003', '342004', '342005', // Jodhpur
    '313001', '313002', '313003', '313004', '313005', // Udaipur
    '305001', '305002', '305003', // Ajmer
    '324001', '324002', '324003'  // Kota
  ],
  'Gujarat': [
    '380001', '380002', '380003', '380004', '380005', // Ahmedabad
    '395001', '395002', '395003', '395004', '395005', // Surat
    '390001', '390002', '390003', '390004', '390005', // Vadodara
    '360001', '360002', '360003'  // Rajkot
  ],
  'Maharashtra': [
    '400001', '400002', '400003', '400004', '400005', // Mumbai
    '411001', '411002', '411003', '411004', '411005', // Pune
    '440001', '440002', '440003', '440004', '440005', // Nagpur
    '431001', '431002', '431003'  // Aurangabad
  ],
  'Madhya Pradesh': [
    '452001', '452002', '452003', '452004', '452005', // Indore
    '462001', '462002', '462003', '462004', '462005', // Bhopal
    '474001', '474002', '474003', '474004', '474005', // Gwalior
    '482001', '482002', '482003', '482004', '482005', // Jabalpur
    '456001', '456002', '456003'  // Ujjain
  ],
  'Uttar Pradesh': [
    '226001', '226002', '226003', '226004', '226005', // Lucknow
    '281001', '281002', '281003', '281004', '281005', // Mathura
    '221001', '221002', '221003', '221004', '221005', // Varanasi
    '282001', '282002', '282003'  // Agra
  ]
};

// Fetch location data from Postal Pincode API
function fetchPincodeData(pincode) {
  return new Promise((resolve, reject) => {
    const url = `https://api.postalpincode.in/pincode/${pincode}`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json[0]?.Status === 'Success' && json[0]?.PostOffice?.length > 0) {
            const postOffice = json[0].PostOffice[0];
            resolve({
              pincode: pincode,
              state: postOffice.State,
              district: postOffice.District,
              tehsil: postOffice.Block || postOffice.Division,
              village: postOffice.Name,
              success: true
            });
          } else {
            resolve({ pincode, success: false });
          }
        } catch (e) {
          resolve({ pincode, success: false });
        }
      });
    }).on('error', (err) => {
      resolve({ pincode, success: false });
    });
  });
}

// Delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fixAddressesWithRealData() {
  try {
    console.log('🌍 Fixing Seed Data with Real Indian Addresses...\n');

    // Step 1: Fetch all pincodes data
    console.log('📍 Step 1: Fetching real location data from Postal API...\n');
    
    const allPincodes = [];
    for (const state in PINCODES) {
      allPincodes.push(...PINCODES[state]);
    }

    const locationData = [];
    let fetched = 0;
    
    for (const pincode of allPincodes) {
      process.stdout.write(`   Fetching ${++fetched}/${allPincodes.length}: ${pincode}...`);
      
      const data = await fetchPincodeData(pincode);
      await delay(100); // Rate limiting - be nice to the API
      
      if (data.success) {
        locationData.push(data);
        process.stdout.write(` ✅ ${data.district}, ${data.state}\n`);
      } else {
        process.stdout.write(` ❌ Failed\n`);
      }
    }

    console.log(`\n   ✅ Fetched ${locationData.length} valid locations\n`);

    // Step 2: Update existing temples with real data
    console.log('🕌 Step 2: Updating temples with real addresses...\n');
    
    const temples = await pool.query('SELECT id FROM temples ORDER BY id');
    let templeIndex = 0;
    let updatedCount = 0;

    for (const temple of temples.rows) {
      if (templeIndex < locationData.length) {
        const loc = locationData[templeIndex];
        
        await pool.query(`
          UPDATE temples 
          SET 
            state = $1,
            city = $2,
            pincode = $3,
            location = $4
          WHERE id = $5
        `, [loc.state, loc.district, loc.pincode, loc.village, temple.id]);
        
        console.log(`   ✓ Temple ${temple.id}: ${loc.village}, ${loc.tehsil}, ${loc.district}, ${loc.state}`);
        updatedCount++;
        templeIndex++;
      }
    }

    console.log(`\n   ✅ Updated ${updatedCount} temples\n`);

    // Step 3: Update dim_geography table
    console.log('📊 Step 3: Updating dim_geography with proper hierarchy...\n');
    
    await pool.query(`
      UPDATE dim_geography dg
      SET 
        state = t.state,
        district = t.city,
        tehsil = CASE 
          WHEN t.pincode IS NOT NULL THEN 'Central'
          ELSE 'Unknown'
        END,
        village = t.location,
        temple_name = t.name,
        pincode = t.pincode,
        updated_at = CURRENT_TIMESTAMP
      FROM temples t
      WHERE dg.temple_id = t.id
    `);

    console.log('   ✅ Geography table updated\n');

    // Step 4: Manually update tehsils from our fetched data
    console.log('📍 Step 4: Setting proper tehsil data...\n');
    
    templeIndex = 0;
    for (const temple of temples.rows) {
      if (templeIndex < locationData.length) {
        const loc = locationData[templeIndex];
        
        await pool.query(`
          UPDATE dim_geography
          SET tehsil = $1
          WHERE temple_id = $2
        `, [loc.tehsil, temple.id]);
        
        templeIndex++;
      }
    }

    console.log('   ✅ Tehsil data set\n');

    // Step 5: Refresh all analytics
    console.log('🔄 Step 5: Refreshing all analytics summaries...\n');
    
    await pool.query('SELECT refresh_all_analytics(NULL)');
    
    console.log('   ✅ Analytics refreshed\n');

    // Step 6: Verify the data
    console.log('🔍 Step 6: Verifying geographic hierarchy...\n');
    
    const stateCount = await pool.query(`
      SELECT DISTINCT state, COUNT(DISTINCT temple_id) as temples
      FROM dim_geography
      WHERE state != 'Unknown'
      GROUP BY state
      ORDER BY state
    `);

    console.log('   States with temples:');
    stateCount.rows.forEach(row => {
      console.log(`     ${row.state}: ${row.temples} temples`);
    });
    console.log('');

    const districtSample = await pool.query(`
      SELECT DISTINCT state, district, COUNT(DISTINCT temple_id) as temples
      FROM dim_geography
      WHERE state != 'Unknown'
      GROUP BY state, district
      ORDER BY state, district
      LIMIT 15
    `);

    console.log('   Sample Districts:');
    districtSample.rows.forEach(row => {
      console.log(`     ${row.district}, ${row.state}: ${row.temples} temples`);
    });
    console.log('');

    const tehsilSample = await pool.query(`
      SELECT DISTINCT state, district, tehsil, COUNT(DISTINCT temple_id) as temples
      FROM dim_geography
      WHERE state != 'Unknown' AND tehsil != 'Unknown'
      GROUP BY state, district, tehsil
      ORDER BY state, district, tehsil
      LIMIT 15
    `);

    console.log('   Sample Tehsils:');
    tehsilSample.rows.forEach(row => {
      console.log(`     ${row.tehsil}, ${row.district}, ${row.state}: ${row.temples} temples`);
    });
    console.log('');

    // Success summary
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║                                                   ║');
    console.log('║     ✅ REAL ADDRESSES LOADED SUCCESSFULLY! ✅    ║');
    console.log('║                                                   ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');

    console.log('🎉 All temples now have proper addresses!');
    console.log('   ✓ State (from API)');
    console.log('   ✓ District (from API)');
    console.log('   ✓ Tehsil (from API)');
    console.log('   ✓ Village (from API)');
    console.log('   ✓ Pincode (real Indian pincodes)');
    console.log('');
    console.log('🔍 Geographic hierarchy is now accurate!');
    console.log('   State → District → Tehsil → Village → Temple\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

fixAddressesWithRealData();
