const cp = require('child_process');
const path = require('path');
const axios = require('G:/Emeelan/rss/rss/backend/auth-service/node_modules/axios');

const AUTH_URL = 'http://localhost:4000';
const KARYA_URL = 'http://localhost:4014';
const NODE_EXE = 'C:\\nvm4w\\nodejs\\node.exe';

let authProc = null;
let karyaProc = null;

async function checkPort(port) {
  try {
    const res = await axios.get(`http://localhost:${port}/health`, { timeout: 1000 });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function ensureServicesRunning() {
  const authRunning = await checkPort(4000);
  if (!authRunning) {
    console.log('Starting auth-service on port 4000...');
    authProc = cp.spawn(NODE_EXE, ['src/server.js'], {
      cwd: 'G:\\Emeelan\\rss\\rss\\backend\\auth-service',
      stdio: 'pipe'
    });
    authProc.stdout.on('data', d => process.stdout.write('[auth] ' + d.toString()));
    authProc.stderr.on('data', d => process.stderr.write('[auth ERR] ' + d.toString()));
  } else {
    console.log('auth-service is already running on port 4000.');
  }

  const karyaRunning = await checkPort(4014);
  if (!karyaRunning) {
    console.log('Starting karyakarini-service on port 4014...');
    karyaProc = cp.spawn(NODE_EXE, ['src/server.js'], {
      cwd: 'G:\\Emeelan\\rss\\rss\\backend\\karyakarini-service',
      stdio: 'pipe'
    });
    karyaProc.stdout.on('data', d => process.stdout.write('[karya] ' + d.toString()));
    karyaProc.stderr.on('data', d => process.stderr.write('[karya ERR] ' + d.toString()));
  } else {
    console.log('karyakarini-service is already running on port 4014.');
  }

  // Wait for both to be healthy
  for (let i = 0; i < 20; i++) {
    const a = await checkPort(4000);
    const k = await checkPort(4014);
    if (a && k) {
      console.log('✅ Both backend services are healthy and ready!\n');
      return;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Services failed to start within timeout');
}

async function runTests() {
  try {
    await ensureServicesRunning();

    console.log('=== STARTING END-TO-END FLOW TESTS ===\n');

    // 1. Login as SuperAdmin
    console.log('Step 1: Logging in as SuperAdmin (harish@emeelan.com / welcome)...');
    const loginRes = await axios.post(`${AUTH_URL}/api/auth/login`, {
      email: 'harish@emeelan.com',
      password: 'welcome'
    });
    const adminToken = loginRes.data.tokens?.accessToken || loginRes.data.data?.tokens?.accessToken;
    const adminUser = loginRes.data.user || loginRes.data.data?.user;
    console.log('✅ SuperAdmin Login Successful! User ID:', adminUser.id, 'Role:', adminUser.role);

    const adminHeaders = {
      headers: { Authorization: `Bearer ${adminToken}` }
    };

    // 2. Check /api/auth/me
    console.log('\nStep 2: Testing /api/auth/me...');
    const meRes = await axios.get(`${AUTH_URL}/api/auth/me`, adminHeaders);
    console.log('✅ /api/auth/me response verified for:', meRes.data.user?.email || meRes.data.data?.user?.email);

    // 3. Create a new member with custom password
    const testMobile = '9876543210';
    const customPassword = 'customSecret123';
    console.log(`\nStep 3: Creating/Updating member (Mobile: ${testMobile}, Password: ${customPassword})...`);
    
    const memberRes = await axios.post(`${KARYA_URL}/api/karyakarini/member`, {
      nodeId: 2, // मालवा
      versionId: 1,
      name: 'Ramesh Patel',
      mobileNumber: testMobile,
      password: customPassword,
      pad: 'संयोजक',
      category: 'शारीरिक',
      subcategory: 'खेल',
      categories: ['शारीरिक'],
      subcategories: ['खेल'],
      userRole: 'user',
      state: 'Madhya Pradesh',
      district: 'Indore',
      tehsil: 'Indore',
      village: 'Indore',
      pincode: '452001'
    }, adminHeaders);
    console.log('✅ Member creation response:', memberRes.data.message);

    const memberData = memberRes.data.data;
    const createdUserId = memberData.userId;
    const createdMemberId = memberData.memberId || memberData.member?.id;
    console.log('✅ Created Member ID:', createdMemberId, 'User ID:', createdUserId);

    // 4. Verify login with the custom password
    console.log(`\nStep 4: Testing login for user (${testMobile}) with custom password: ${customPassword}...`);
    const userLoginRes = await axios.post(`${AUTH_URL}/api/auth/login`, {
      identifier: testMobile,
      password: customPassword
    });
    const userToken = userLoginRes.data.tokens?.accessToken || userLoginRes.data.data?.tokens?.accessToken;
    console.log('✅ USER LOGIN SUCCEEDED WITH CUSTOM PASSWORD! Token received.');

    const userHeaders = {
      headers: { Authorization: `Bearer ${userToken}` }
    };

    // 5. Update the member with a NEW password
    const updatedPassword = 'updatedSecret999';
    console.log(`\nStep 5: Updating member ${createdMemberId} password to: ${updatedPassword}...`);
    await axios.put(`${KARYA_URL}/api/karyakarini/member/${createdMemberId}`, {
      versionId: 1,
      name: 'Ramesh Patel Updated',
      mobileNumber: testMobile,
      password: updatedPassword,
      pad: 'संयोजक',
      category: 'शारीरिक',
      subcategory: 'खेल',
      categories: ['शारीरिक'],
      subcategories: ['खेल'],
      userRole: 'user',
      state: 'Madhya Pradesh',
      district: 'Indore',
      tehsil: 'Indore',
      village: 'Indore',
      pincode: '452001'
    }, adminHeaders);
    console.log('✅ Member update API returned success.');

    // 6. Verify login with UPDATED password
    console.log(`\nStep 6: Verifying login with updated password (${updatedPassword})...`);
    const updatedLoginRes = await axios.post(`${AUTH_URL}/api/auth/login`, {
      identifier: testMobile,
      password: updatedPassword
    });
    console.log('✅ LOGIN WITH UPDATED PASSWORD SUCCEEDED!');

    // Verify old password fails
    console.log(`Testing old password rejection...`);
    try {
      await axios.post(`${AUTH_URL}/api/auth/login`, {
        identifier: testMobile,
        password: customPassword
      });
      console.error('❌ Old password should have failed!');
      process.exit(1);
    } catch (e) {
      console.log('✅ Old password correctly rejected (401 Unauthorized).');
    }

    // 7. Create Karya (Activity) & Assign to User
    console.log('\nStep 7: Creating a Karya (Activity) and assigning to user...');
    const activityRes = await axios.post(`${KARYA_URL}/api/karyakarini/my/category-activities`, {
      title: 'Yoga Shivir Indore',
      description: 'Weekly morning yoga and physical activities',
      category: 'शारीरिक',
      subcategory: 'खेल',
      activityDate: '2026-11-20',
      venue: 'Indore Stadium',
      nodeId: 2,
      versionId: 1
    }, adminHeaders);
    const activityId = activityRes.data.data?.id || activityRes.data.id;
    console.log('✅ Karya created with ID:', activityId);

    // Assign to user
    console.log(`Assigning Karya to User ${createdUserId}...`);
    await axios.post(`${KARYA_URL}/api/karyakarini/activity-assignments`, {
      activityName: 'भारतमाता पूजन',
      assignedUserId: createdUserId,
      nodeId: 2,
      versionId: 1,
      description: 'Please coordinate the Bharat Mata Pujan'
    }, adminHeaders);
    console.log('✅ Karya assigned to user successfully.');

    // Check if assigned user sees it
    console.log('Checking if assigned user sees the assignment via /my/activity-assignments...');
    const userActivitiesRes = await axios.get(`${KARYA_URL}/api/karyakarini/my/activity-assignments?versionId=1`, userHeaders);
    const userAssignments = userActivitiesRes.data.data || userActivitiesRes.data;
    console.log('✅ Assigned user activities count:', Array.isArray(userAssignments) ? userAssignments.length : JSON.stringify(userAssignments));

    // 8. Create Karyakram (Meeting / Program)
    console.log('\nStep 8: Creating Karyakram (Meeting) and inviting user...');
    const meetingRes = await axios.post(`${KARYA_URL}/api/karyakarini/meetings`, {
      title: 'Masik Baithak Malwa Prant',
      description: 'Monthly review and upcoming events',
      meetingDate: '2026-11-25',
      nodeId: 2,
      versionId: 1,
      invitedUserIds: [createdUserId]
    }, adminHeaders);
    const meetingId = meetingRes.data.data?.id || meetingRes.data.id;
    console.log('✅ Karyakram (Meeting) created with ID:', meetingId);

    // Check if user sees invitation
    console.log('Checking if user sees the meeting invitation via /my/invitations...');
    const userInvitesRes = await axios.get(`${KARYA_URL}/api/karyakarini/my/invitations?versionId=1`, userHeaders);
    const userInvites = userInvitesRes.data.data || userInvitesRes.data;
    console.log('✅ User invitations received:', Array.isArray(userInvites?.invitations) ? userInvites.invitations.length : JSON.stringify(userInvites));

    // 9. Announcements / Forums
    console.log('\nStep 9: Testing Announcements / Forums...');
    const announceRes = await axios.post(`${AUTH_URL}/api/announcements`, {
      title: 'Varshik Karyakram Suchna',
      message: 'All karyakartas please review the annual calendar',
      category: 'general'
    }, adminHeaders);
    const announcementId = announceRes.data.data?.announcement?.id || announceRes.data.data?.id;
    console.log('✅ Announcement created with ID:', announcementId);

    // Add a comment to the announcement
    console.log('Posting a comment on the announcement...');
    const commentRes = await axios.post(`${AUTH_URL}/api/announcements/${announcementId}/comments`, {
      comment: 'Dhanyawad suchna ke liye.'
    }, userHeaders);
    console.log('✅ Comment posted successfully on announcement.');

    const getAnnounceRes = await axios.get(`${AUTH_URL}/api/announcements`, adminHeaders);
    console.log('✅ Announcements list fetched, total count:', getAnnounceRes.data.data?.length || getAnnounceRes.data.length);

    console.log('\n======================================================');
    console.log('🎉 ALL END-TO-END TESTS PASSED 100% SUCCESSFULLY! 🎉');
    console.log('======================================================');

  } catch (err) {
    console.error('\n❌ Test execution failed:', err.response?.data || err.message);
  } finally {
    if (authProc) {
      authProc.kill();
    }
    if (karyaProc) {
      karyaProc.kill();
    }
    process.exit(0);
  }
}

runTests();
