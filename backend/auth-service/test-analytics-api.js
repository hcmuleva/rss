/**
 * Test Analytics API
 * Run with: node test-analytics-api.js
 */

const http = require('http');

// Get a valid token from localStorage or create a test one
const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6InRlbXBsZV9hZG1pbiIsImlhdCI6MTYxNjIzOTAyMn0.test';

function testEndpoint(path, description) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${testToken}`
      }
    };

    console.log(`\n🧪 Testing: ${description}`);
    console.log(`   URL: http://localhost:4000${path}`);

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`   Status: ${res.statusCode}`);
        
        try {
          const json = JSON.parse(data);
          console.log(`   Success: ${json.success}`);
          
          if (json.success) {
            console.log(`   ✅ Data received!`);
            if (json.data) {
              if (json.data.summary) {
                console.log(`      - Total Members: ${json.data.summary.total_members}`);
                console.log(`      - Total Families: ${json.data.summary.total_families}`);
              } else if (Array.isArray(json.data)) {
                console.log(`      - Records: ${json.data.length}`);
              }
            }
          } else {
            console.log(`   ❌ Error: ${json.message}`);
          }
        } catch (e) {
          console.log(`   ❌ Invalid JSON response`);
          console.log(`   Response: ${data.substring(0, 200)}`);
        }
        
        resolve();
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ Connection Error: ${error.message}`);
      console.log(`   💡 Is the backend server running on port 4000?`);
      resolve();
    });

    req.end();
  });
}

async function runTests() {
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║      ANALYTICS API DIAGNOSTIC TEST               ║');
  console.log('╚═══════════════════════════════════════════════════╝');

  // Test health endpoint first
  await testEndpoint('/health', 'Health Check (No Auth)');

  // Test analytics endpoints
  await testEndpoint('/api/analytics/dashboard', 'Dashboard Summary');
  await testEndpoint('/api/analytics/demographic', 'Demographic Report');
  await testEndpoint('/api/analytics/age-distribution', 'Age Distribution');
  await testEndpoint('/api/analytics/gotras', 'Gotra Distribution');
  await testEndpoint('/api/analytics/temples', 'Temples List');
  await testEndpoint('/api/analytics/geography/state', 'Geographic Hierarchy - States');

  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║      DIAGNOSTIC COMPLETE                          ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');

  console.log('📝 TROUBLESHOOTING TIPS:\n');
  console.log('If you see "Connection Error":');
  console.log('  → Start backend: cd sp_v2/backend/auth-service && npm start\n');
  
  console.log('If you see "Not authorized":');
  console.log('  → Login to the app first');
  console.log('  → Open browser console');
  console.log('  → Copy the token from localStorage.getItem("emeelan_access_token")');
  console.log('  → Replace testToken in this script\n');
  
  console.log('If you see "Route not found":');
  console.log('  → Restart the backend server');
  console.log('  → The analytics routes might not be loaded\n');

  console.log('Frontend Debugging:');
  console.log('  1. Open http://localhost:3000');
  console.log('  2. Login as temple_admin');
  console.log('  3. Go to Temple Admin → Reports');
  console.log('  4. Open DevTools → Console');
  console.log('  5. Look for API errors (red text)\n');
}

runTests();
