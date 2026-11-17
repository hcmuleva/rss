const { Pool } = require('G:/Emeelan/rss/rss/backend/auth-service/node_modules/pg');
const bcrypt = require('G:/Emeelan/rss/rss/backend/auth-service/node_modules/bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'rss_new',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function seedData() {
  const client = await pool.connect();
  try {
    console.log('=== SEEDING COMPREHENSIVE RSS DATA ===\n');
    await client.query('BEGIN');

    const versionId = 1; // Default active version
    const defaultPassword = 'welcome';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    console.log('✅ Generated bcrypt hash for password "welcome"');

    // 1. Defined list of Users across levels
    const membersToCreate = [
      {
        mobile: '9826000001',
        name: 'Mahesh Sharma',
        father: 'Radheshyam Sharma',
        role: 'admin',
        pad: 'प्रांत संयोजक',
        category: 'संस्कृति',
        subcategory: 'धार्मिक संगठन',
        nodeId: 2, // मालवा (Prant)
        village: 'इंदौर',
        district: 'Indore',
        tehsil: 'Indore'
      },
      {
        mobile: '9826000002',
        name: 'Vikram Verma',
        father: 'Omkar Verma',
        role: 'admin',
        pad: 'प्रांत सह-संयोजक',
        category: 'निधी',
        subcategory: 'उद्योगपति',
        nodeId: 2, // मालवा (Prant)
        village: 'इंदौर',
        district: 'Indore',
        tehsil: 'Indore'
      },
      {
        mobile: '9826000003',
        name: 'Anand Joshi',
        father: 'Purushottam Joshi',
        role: 'admin',
        pad: 'संभाग प्रमुख',
        category: 'विधी',
        subcategory: 'दिवानी',
        nodeId: 3, // इन्दौर (Sambhag)
        village: 'इंदौर',
        district: 'Indore',
        tehsil: 'Indore'
      },
      {
        mobile: '9826000004',
        name: 'Sunita Patidar',
        father: 'Jagdish Patidar',
        role: 'user',
        pad: 'मातृशक्ति संयोजिका',
        category: 'मातृशक्ति T-8',
        subcategory: 'सामाजिक क्षेत्र',
        nodeId: 3, // इन्दौर (Sambhag)
        village: 'इंदौर',
        district: 'Indore',
        tehsil: 'Indore'
      },
      {
        mobile: '9826000005',
        name: 'Rajesh Rathore',
        father: 'Mansingh Rathore',
        role: 'admin',
        pad: 'विभाग संयोजक',
        category: 'परियोजना',
        subcategory: 'क्रियान्वित परियोजना',
        nodeId: 4, // धार (Vibhag)
        village: 'धार',
        district: 'Dhar',
        tehsil: 'Dhar'
      },
      {
        mobile: '9826000006',
        name: 'Pawan Gehlot',
        father: 'Ramlal Gehlot',
        role: 'user',
        pad: 'विभाग सह-संयोजक',
        category: 'संस्कृति',
        subcategory: 'पुजारी पुरोहित',
        nodeId: 4, // धार (Vibhag)
        village: 'धार',
        district: 'Dhar',
        tehsil: 'Dhar'
      },
      {
        mobile: '9826000007',
        name: 'Dharmendra Chouhan',
        father: 'Shyamsingh Chouhan',
        role: 'admin',
        pad: 'जिला संयोजक',
        category: 'निधी',
        subcategory: 'व्यवसायी',
        nodeId: 5, // धार (Jila)
        village: 'धार नगर',
        district: 'Dhar',
        tehsil: 'Dhar'
      },
      {
        mobile: '9826000008',
        name: 'Anita Solanki',
        father: 'Mohan Solanki',
        role: 'user',
        pad: 'जिला टोली सदस्य',
        category: 'मातृशक्ति T-8',
        subcategory: 'धार्मिक क्षेत्र',
        nodeId: 5, // धार (Jila)
        village: 'धार नगर',
        district: 'Dhar',
        tehsil: 'Dhar'
      },
      {
        mobile: '9826000009',
        name: 'Gopal Mukati',
        father: 'Devkaran Mukati',
        role: 'user',
        pad: 'खंड संयोजक',
        category: 'संस्कृति',
        subcategory: 'भजनमण्डली',
        nodeId: 6, // धार (Khand)
        village: 'तिरसा',
        district: 'Dhar',
        tehsil: 'Dhar'
      },
      {
        mobile: '9826000010',
        name: 'Kailash Solanki',
        father: 'Bhawarsingh Solanki',
        role: 'admin',
        pad: 'खंड प्रमुख',
        category: 'निधी',
        subcategory: 'कृषक',
        nodeId: 9, // राजगढ (Khand)
        village: 'राजगढ़',
        district: 'Dhar',
        tehsil: 'Sardarpur'
      },
      {
        mobile: '9826000011',
        name: 'Dinesh Yadav',
        father: 'Ghelaram Yadav',
        role: 'user',
        pad: 'मंडल संयोजक',
        category: 'संस्कृति',
        subcategory: 'सुन्दरकाण्ड',
        nodeId: 7, // धार (Mandal)
        village: 'धार ग्रामीण',
        district: 'Dhar',
        tehsil: 'Dhar'
      },
      {
        mobile: '9826000012',
        name: 'Rohit Bairagi',
        father: 'Laldas Bairagi',
        role: 'user',
        pad: 'मंडल प्रमुख',
        category: 'विधी',
        subcategory: 'राजस्व',
        nodeId: 10, // रिंगनोद (Mandal)
        village: 'रिंगनोद',
        district: 'Dhar',
        tehsil: 'Sardarpur'
      },
      {
        mobile: '9826000013',
        name: 'Mohan Patel',
        father: 'Kanhaiyalal Patel',
        role: 'user',
        pad: 'ग्राम पालक',
        category: 'संस्कृति',
        subcategory: 'साधु संत',
        nodeId: 11, // रिंगनोद (Gram)
        village: 'रिंगनोद',
        district: 'Dhar',
        tehsil: 'Sardarpur'
      },
      {
        mobile: '9826000014',
        name: 'Kamlesh Thakur',
        father: 'Pratap Thakur',
        role: 'user',
        pad: 'ग्राम टोली प्रमुख',
        category: 'निधी',
        subcategory: 'कृषक',
        nodeId: 11, // रिंगनोद (Gram)
        village: 'रिंगनोद',
        district: 'Dhar',
        tehsil: 'Sardarpur'
      }
    ];

    console.log('1. Inserting/Updating Users & Karyakarini Members...');
    const userMap = new Map(); // mobile -> user_id

    for (const m of membersToCreate) {
      const email = `${m.mobile}@emeelan.com`;
      const slug = `u${m.mobile.slice(-6)}`;

      // Insert or Update user
      const userRes = await client.query(
        `INSERT INTO users (
           slug, first_name, father_name, dob, gotra, email, password_hash,
           role, phone, village, district, tehsil, state, is_active
         ) VALUES ($1, $2, $3, '1990-01-01', 'Muleva', $4, $5, $6, $7, $8, $9, $10, 'Madhya Pradesh', true)
         ON CONFLICT (email) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           phone = EXCLUDED.phone,
           first_name = EXCLUDED.first_name,
           role = EXCLUDED.role,
           village = EXCLUDED.village,
           district = EXCLUDED.district,
           tehsil = EXCLUDED.tehsil
         RETURNING id, first_name, email, phone, role`,
        [slug, m.name, m.father, email, passwordHash, m.role, m.mobile, m.village, m.district, m.tehsil]
      );

      const userId = userRes.rows[0].id;
      userMap.set(m.mobile, userId);

      // Clean existing membership in this node/version to avoid duplicate conflict
      await client.query(
        `DELETE FROM karyakarini_members WHERE user_id = $1 AND node_id = $2 AND version_id = $3`,
        [userId, m.nodeId, versionId]
      );

      // Insert karyakarini_member
      await client.query(
        `INSERT INTO karyakarini_members (
           version_id, node_id, user_id, name, mobile, pad,
           category, subcategory, categories, subcategories,
           start_date, end_date, address_village, address_tehsil,
           address_district, address_state, is_active
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8,
           $9::jsonb, $10::jsonb,
           '2026-01-01', '2027-12-31', $11, $12, $13, 'Madhya Pradesh', true
         )`,
        [
          versionId, m.nodeId, userId, m.name, m.mobile, m.pad,
          m.category, m.subcategory,
          JSON.stringify([m.category]), JSON.stringify([m.subcategory]),
          m.village, m.tehsil, m.district
        ]
      );

      // If admin, grant admin scope for their node
      if (m.role === 'admin') {
        await client.query(
          `INSERT INTO karyakarini_admin_scopes (user_id, node_id, version_id, is_active)
           VALUES ($1, $2, $3, true)
           ON CONFLICT DO NOTHING`,
          [userId, m.nodeId, versionId]
        );
      }
    }
    console.log(`✅ ${membersToCreate.length} Users & Karyakarini Members created across all levels!`);

    // 2. Insert Category Activities (Karya)
    console.log('\n2. Creating Category Activities (Karya)...');
    const activitiesToCreate = [
      {
        nodeId: 2, // Prant
        title: 'मालवा प्रांत संस्कृति संगम एवं भजनमण्डली महाधिवेशन',
        description: 'समस्त संभागों के साधु-संतों, पुजारियों एवं भजन मंडलियों का संयुक्त वार्षिक सम्मेलन।',
        category: 'संस्कृति',
        subcategory: 'भजनमण्डली',
        date: '2026-11-25',
        venue: 'इंदौर प्रांत सभागार',
        userMobile: '9826000001'
      },
      {
        nodeId: 3, // Sambhag
        title: 'संभाग स्तरीय विधिक परामर्श एवं जागरूकता शिविर',
        description: 'संभाग के सभी जिलों के प्रमुख अधिवक्ताओं और विधि आयाम कार्यकर्ताओं की विशेष कार्यशाला।',
        category: 'विधी',
        subcategory: 'दिवानी',
        date: '2026-11-28',
        venue: 'इंदौर विधि भवन',
        userMobile: '9826000003'
      },
      {
        nodeId: 4, // Vibhag
        title: 'धार विभाग ग्राम विकास एवं जल संरक्षण परियोजना समीक्षा',
        description: 'विभाग में चल रही समस्त जल संरक्षण एवं सिलाई प्रशिक्षण परियोजनाओं की प्रगति रिपोर्ट।',
        category: 'परियोजना',
        subcategory: 'क्रियान्वित परियोजना',
        date: '2026-12-01',
        venue: 'धार विभाग केंद्र',
        userMobile: '9826000005'
      },
      {
        nodeId: 5, // Jila
        title: 'धार जिला निधि समर्पण अभियान एवं कृषक गोष्ठी',
        description: 'जिले के कृषकों और व्यवसायियों के साथ निधि समर्पण व स्वावलंबन संवाद।',
        category: 'निधी',
        subcategory: 'कृषक',
        date: '2026-12-05',
        venue: 'धार कृषि मंडी सभागार',
        userMobile: '9826000007'
      },
      {
        nodeId: 6, // Khand (Dhar)
        title: 'धार खंड अखण्ड सुन्दरकाण्ड पाठ व समरसता भोज',
        description: 'धार खंड के सभी मंडलों में सुन्दरकाण्ड पाठ एवं जनसंपर्क अभियान।',
        category: 'संस्कृति',
        subcategory: 'सुन्दरकाण्ड',
        date: '2026-12-10',
        venue: 'धार खंड मंदिर प्रांगण',
        userMobile: '9826000009'
      },
      {
        nodeId: 9, // Khand (Rajgarh)
        title: 'राजगढ़ खंड युवा कौशल एवं मातृशक्ति कार्यशाला',
        description: 'मातृशक्ति स्वावलंबन और महिला सिलाई प्रशिक्षण केंद्र का उद्घाटन।',
        category: 'मातृशक्ति T-8',
        subcategory: 'सामाजिक क्षेत्र',
        date: '2026-12-12',
        venue: 'राजगढ़ सामुदायिक भवन',
        userMobile: '9826000010'
      },
      {
        nodeId: 10, // Mandal (Ringnod)
        title: 'रिंगनोद मंडल धार्मिक संगठन समन्वय एवं स्वच्छता प्रभात फेरी',
        description: 'मंडल के सभी गांवों में प्रभात फेरी एवं मंदिर स्वच्छता अभियान।',
        category: 'संस्कृति',
        subcategory: 'धार्मिक संगठन',
        date: '2026-12-15',
        venue: 'रिंगनोद मुख्य चौराहा',
        userMobile: '9826000012'
      },
      {
        nodeId: 11, // Gram (Ringnod)
        title: 'रिंगनोद ग्राम सत्संग, संस्कार केंद्र एवं परिवार मिलन',
        description: 'ग्राम के प्रत्येक परिवार में नैतिक संस्कार, पर्यावरण संरक्षण व गोसेवा संकल्प।',
        category: 'संस्कृति',
        subcategory: 'साधु संत',
        date: '2026-12-18',
        venue: 'रिंगनोद माताजी मंदिर',
        userMobile: '9826000013'
      }
    ];

    for (const act of activitiesToCreate) {
      const submitterId = userMap.get(act.userMobile) || 1;
      await client.query(
        `INSERT INTO karyakarini_category_activities (
           version_id, node_id, category, subcategory, title, description,
           attachments, male_count, female_count, children_count, from_date, to_date, status, submitted_by, is_active
         ) VALUES ($1, $2, $3, $4, $5, $6, '[]'::jsonb, 25, 15, 5, $7, $8, 'open', $9, true)`,
        [
          versionId, act.nodeId, act.category, act.subcategory,
          act.title, act.description, act.date, act.date, submitterId
        ]
      );
    }
    console.log(`✅ ${activitiesToCreate.length} Category Activities created across Prant, Sambhag, Vibhag, Jila, Khand, Mandal, Gram!`);

    // 3. Insert Predefined Activity Assignments
    console.log('\n3. Creating Official Activity Assignments (धर्मरक्षा सूत्र, भारतमाता पूजन, संत यात्रा)...');
    const officialAssignments = [
      {
        nodeId: 2,
        activityName: 'भारतमाता पूजन',
        desc: 'मालवा प्रांत के प्रत्येक जिले में भारतमाता पूजन उत्सव का समन्वय।',
        assigneeMobile: '9826000001' // Mahesh Sharma
      },
      {
        nodeId: 3,
        activityName: 'धर्मरक्षा दिवस',
        desc: 'इन्दौर संभाग में धर्मरक्षा दिवस संगोष्ठी और युवा संवाद।',
        assigneeMobile: '9826000003' // Anand Joshi
      },
      {
        nodeId: 5,
        activityName: 'धर्मरक्षा सूत्र',
        desc: 'धार जिले के प्रत्येक खंड में रक्षासूत्र वितरण एवं जागरण।',
        assigneeMobile: '9826000007' // Dharmendra Chouhan
      },
      {
        nodeId: 6,
        activityName: 'संत यात्रा',
        desc: 'धार खंड के ग्रामीण क्षेत्रों में पूज्य संतों की चरण पादुका यात्रा का स्वागत।',
        assigneeMobile: '9826000009' // Gopal Mukati
      },
      {
        nodeId: 10,
        activityName: 'भारतमाता पूजन',
        desc: 'रिंगनोद मंडल के सभी विद्यालयों व चौपालों पर भारतमाता चित्र पूजन।',
        assigneeMobile: '9826000012' // Rohit Bairagi
      },
      {
        nodeId: 11,
        activityName: 'धर्मरक्षा सूत्र',
        desc: 'रिंगनोद ग्राम में घर-घर धर्मरक्षा सूत्र बंधन एवं संकल्प पत्र भरवाना।',
        assigneeMobile: '9826000013' // Mohan Patel
      }
    ];

    for (const oa of officialAssignments) {
      const assignedUser = userMap.get(oa.assigneeMobile);
      if (assignedUser) {
        await client.query(
          `INSERT INTO karyakarini_activity_assignments (
             version_id, node_id, activity_name, description, assigned_user_id, assigned_by, is_active
           ) VALUES ($1, $2, $3, $4, $5, 1, true)`,
          [versionId, oa.nodeId, oa.activityName, oa.desc, assignedUser]
        );
      }
    }
    console.log(`✅ ${officialAssignments.length} Official Activity Assignments created!`);

    // 4. Insert Karyakarini Tasks
    console.log('\n4. Creating Actionable Tasks for Karyakartas...');
    const tasksToCreate = [
      {
        nodeId: 2,
        title: 'प्रांत कार्यशाला का निमंत्रण पत्र वितरण',
        desc: 'सभी संभाग प्रमुखों को वार्षिक कार्यशाला की विवरण पत्रिका प्रेषित करें।',
        taskDate: '2026-11-20',
        dueDate: '2026-11-24',
        userMobile: '9826000002',
        status: 'open'
      },
      {
        nodeId: 3,
        title: 'संभाग स्तरीय विधि प्रकोष्ठ की बैठक तय करना',
        desc: 'संभाग के वरिष्ठ अधिवक्ताओं से चर्चा कर बैठक का स्थान निश्चित करें।',
        taskDate: '2026-11-21',
        dueDate: '2026-11-26',
        userMobile: '9826000003',
        status: 'in_progress'
      },
      {
        nodeId: 5,
        title: 'धार जिले के समस्त खंडों का प्रवास कार्यक्रम',
        desc: 'धार, राजगढ, बदनावर खंडों में दो-दो दिन का संगठनात्मक प्रवास पूर्ण करें।',
        taskDate: '2026-11-22',
        dueDate: '2026-11-30',
        userMobile: '9826000007',
        status: 'open'
      },
      {
        nodeId: 9,
        title: 'राजगढ खंड के मंडलों की कार्यकारिणी सूची अद्यतन करना',
        desc: 'रिंगनोद, गुमानपुरा, बडोदीया मंडलों के नवीन दायित्वधारियों की सूची दर्ज करें।',
        taskDate: '2026-11-23',
        dueDate: '2026-12-02',
        userMobile: '9826000010',
        status: 'open'
      },
      {
        nodeId: 11,
        title: 'रिंगनोद ग्राम परिवार सूची व संपर्क अभियान',
        desc: 'रिंगनोद ग्राम के सभी 120 परिवारों की संपर्क डायरी तैयार करें।',
        taskDate: '2026-11-24',
        dueDate: '2026-12-05',
        userMobile: '9826000013',
        status: 'in_progress'
      }
    ];

    for (const t of tasksToCreate) {
      const assignedUser = userMap.get(t.userMobile);
      await client.query(
        `INSERT INTO karyakarini_tasks (
           node_id, version_id, title, description, task_date, due_date,
           status, assigned_user_id, created_by, is_active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, true)`,
        [t.nodeId, versionId, t.title, t.desc, t.taskDate, t.dueDate, t.status, assignedUser]
      );
    }
    console.log(`✅ ${tasksToCreate.length} Specific Tasks created and assigned!`);

    // 5. Insert Meetings (Karyakram) & Invites
    console.log('\n5. Creating Karyakram (Meetings & Programs) across levels...');
    const meetingsToCreate = [
      {
        nodeId: 2, // Prant
        title: 'मालवा प्रांत कार्यकारिणी त्रैमासिक योजना बैठक',
        desc: 'आगामी 3 माह के कार्यक्रमों की योजना, कार्यकर्ता प्रवास व आयाम कार्यों की समीक्षा।',
        date: '2026-11-29',
        time: '10:00:00',
        venue: 'मालवा प्रांत कार्यालय, इंदौर',
        type: 'offline',
        invites: ['9826000001', '9826000002', '9826000003', '9826000005', '9826000007']
      },
      {
        nodeId: 3, // Sambhag
        title: 'इन्दौर संभाग समन्वय एवं आयाम बैठक',
        desc: 'संभाग के सभी विभागों के आयाम प्रमुखों की संयुक्त कार्यशाला।',
        date: '2026-12-02',
        time: '11:00:00',
        venue: 'इंदौर संभाग भवन',
        type: 'offline',
        invites: ['9826000003', '9826000004', '9826000005']
      },
      {
        nodeId: 4, // Vibhag
        title: 'धार विभाग कार्यकारिणी मासिक समीक्षा बैठक',
        desc: 'धार, कुक्षी व आलिराजपुर जिलों की मासिक प्रगति समीक्षा।',
        date: '2026-12-06',
        time: '14:00:00',
        venue: 'धार विभाग कार्यालय',
        type: 'offline',
        invites: ['9826000005', '9826000006', '9826000007']
      },
      {
        nodeId: 5, // Jila
        title: 'धार जिला कार्यकर्ता विस्तारक अभ्यास वर्ग',
        desc: 'जिले के सभी खंड संयोजकों एवं सह संयोजकों का एक दिवसीय अभ्यास वर्ग।',
        date: '2026-12-08',
        time: '09:30:00',
        venue: 'धार जिला संघ कार्यालय',
        type: 'offline',
        invites: ['9826000007', '9826000008', '9826000009', '9826000010']
      },
      {
        nodeId: 9, // Khand (Rajgarh)
        title: 'राजगढ खंड मासिक मंडल समन्वय बैठक',
        desc: 'राजगढ खंड के सभी मंडलों की मासिक बैठक व आगामी कार्यक्रम रूपरेखा।',
        date: '2026-12-14',
        time: '11:30:00',
        venue: 'राजगढ़ विद्या मंदिर प्रांगण',
        type: 'offline',
        invites: ['9826000010', '9826000012']
      },
      {
        nodeId: 10, // Mandal (Ringnod)
        title: 'रिंगनोद मंडल ग्राम पालक व टोली बैठक',
        desc: 'रिंगनोद, कंजरोटा, मालपुरीया ग्रामों के ग्राम पालकों की बैठक।',
        date: '2026-12-16',
        time: '15:00:00',
        venue: 'रिंगनोद पंचायत भवन',
        type: 'offline',
        invites: ['9826000012', '9826000013', '9826000014']
      },
      {
        nodeId: 11, // Gram (Ringnod)
        title: 'रिंगनोद ग्राम साप्ताहिक सत्संग एवं प्रभात शाखा मिलन',
        desc: 'ग्राम के युवाओं और प्रमुख नागरिकों की साप्ताहिक बैठक।',
        date: '2026-12-20',
        time: '07:00:00',
        venue: 'रिंगनोद हनुमान मंदिर',
        type: 'offline',
        invites: ['9826000013', '9826000014']
      }
    ];

    for (const m of meetingsToCreate) {
      const meetRes = await client.query(
        `INSERT INTO karyakarini_meetings (
           node_id, version_id, title, description, meeting_date,
           created_by, is_active
         ) VALUES ($1, $2, $3, $4, $5, 1, true)
         RETURNING id`,
        [m.nodeId, versionId, m.title, m.desc, m.date]
      );
      const meetingId = meetRes.rows[0].id;

      for (const invMobile of m.invites) {
        const invUserId = userMap.get(invMobile);
        if (invUserId) {
          await client.query(
            `INSERT INTO karyakarini_meeting_invites (
               meeting_id, version_id, invited_user_id, invited_node_id, invitation_status, invited_by, is_active
             ) VALUES ($1, $2, $3, $4, 'pending', 1, true)`,
            [meetingId, versionId, invUserId, m.nodeId]
          );

          await client.query(
            `INSERT INTO karyakarini_meeting_attendees (
               meeting_id, user_id, attendance_status, attendee_type
             ) VALUES ($1, $2, 'present', 'member')`,
            [meetingId, invUserId]
          );

          // Create notification for user
          await client.query(
            `INSERT INTO karyakarini_notifications (
               user_id, version_id, category, type, title, message, is_read
             ) VALUES ($1, $2, 'invitations', 'meeting-invitation', $3, $4, false)`,
            [
              invUserId, versionId, 'बैठक आमंत्रण',
              `${m.title} • दिनांक: ${m.date}`
            ]
          );
        }
      }
    }
    console.log(`✅ ${meetingsToCreate.length} Karyakram (Meetings) created with Invitations & Attendees!`);

    await client.query('COMMIT');
    console.log('\n🎉 ALL SEED DATA COMMITTED SUCCESSFULLY TO DATABASE "rss_new"! 🎉');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed with error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedData().catch(err => {
  console.error(err);
  process.exit(1);
});
