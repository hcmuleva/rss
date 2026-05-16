/**
 * =====================================================================
 * Profile Controller
 * Company: emeelan
 * Description: Handle user profile operations (Basic Info Tab)
 * =====================================================================
 */

const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const User = require('../models/User');

const buildRoleCategory = (role = 'member', occupation = '') => {
  const normalizedRole = String(role || 'member').replace(/[_-]/g, ' ').trim();
  const lowerOccupation = String(occupation || '').toLowerCase();
  if (lowerOccupation.includes('teacher') || lowerOccupation.includes('student')) {
    return `${normalizedRole} (Education)`;
  }
  return `${normalizedRole} (General)`;
};

const ensureProfileGovernanceColumns = async () => {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_private_profile BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id)
  `);
};

const FAMILY_MANAGEMENT_SERVICE_URL =
  process.env.FAMILY_MANAGEMENT_SERVICE_URL ||
  process.env.FAMILY_SERVICE_URL ||
  'http://localhost:4003';

const toNeo4jGender = (gender = '') => {
  const key = String(gender || '').trim().toLowerCase();
  if (key === 'male' || key === 'm') return 'M';
  if (key === 'female' || key === 'f') return 'F';
  if (key === 'other' || key === 'o') return 'O';
  return 'U';
};

const normalizeProfileGender = (gender = '') => {
  const key = String(gender || '').trim().toLowerCase();
  if (key === 'male' || key === 'm') return 'M';
  if (key === 'female' || key === 'f') return 'F';
  if (key === 'other' || key === 'o') return 'O';
  return null;
};

const normalizeMaritalStatus = (status) => {
  const value = String(status || '').trim().toLowerCase();
  if (!value) return 'unmarried';
  if (['married', 'vivahit', 'विवाहित'].includes(value)) return 'married';
  if (['divorced', 'widowed'].includes(value)) return value;
  if (['single', 'unmarried', 'never married', 'अविवाहित'].includes(value)) return 'unmarried';
  return value;
};

const getTargetUserId = async (req) => {
  const raw =
    req.query?.targetUserId ??
    req.body?.targetUserId ??
    req.params?.targetUserId;
  const targetEmail =
    req.query?.targetEmail ??
    req.body?.targetEmail ??
    req.params?.targetEmail;

  if (targetEmail) {
    const emailLookup = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [String(targetEmail).trim()]
    );
    if (emailLookup.rows.length > 0) {
      return Number(emailLookup.rows[0].id);
    }
    return null;
  }

  if (raw === undefined || raw === null || raw === '') {
    return Number(req.user.id);
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const canManageFamilyMemberProfile = async (requesterId, targetUserId) => {
  if (requesterId === targetUserId) return true;

  const relation = await pool.query(
    `
      SELECT 1
      FROM users target
      JOIN users requester ON requester.id = $1
      WHERE target.id = $2
        AND (
          EXISTS (
            SELECT 1
            FROM family_members requester_fm
            JOIN family_members target_fm ON target_fm.user_id = $2
            WHERE requester_fm.user_id = $1
              AND requester_fm.family_id = target_fm.family_id
          )
          OR EXISTS (
            SELECT 1
            FROM user_family_mapping requester_map
            JOIN user_family_mapping target_map ON target_map.user_id = $2
            WHERE requester_map.user_id = $1
              AND requester_map.family_id = target_map.family_id
          )
          OR (
            requester.family_id IS NOT NULL
            AND target.family_id IS NOT NULL
            AND requester.family_id = target.family_id
          )
        )
      LIMIT 1
    `,
    [requesterId, targetUserId]
  );

  return !!relation.rows.length;
};

const slugifyProfession = (value = '') =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';

const ensureProfessionTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profession_master (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(120) UNIQUE NOT NULL,
      name VARCHAR(120) NOT NULL,
      category VARCHAR(50) DEFAULT 'general',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_professions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      profession_id INTEGER NOT NULL REFERENCES profession_master(id) ON DELETE CASCADE,
      role_title VARCHAR(150),
      organization VARCHAR(200),
      domain VARCHAR(120),
      experience_years NUMERIC(5,2),
      education_level VARCHAR(120),
      student_grade VARCHAR(50),
      student_stream VARCHAR(120),
      is_primary BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      details JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_profession_master_slug ON profession_master(slug);
    CREATE INDEX IF NOT EXISTS idx_user_professions_user_id ON user_professions(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_professions_profession_id ON user_professions(profession_id);
    CREATE INDEX IF NOT EXISTS idx_user_professions_active ON user_professions(is_active);
  `);
};

const normalizeProfessionInput = (professions, fallbackOccupation) => {
  const fromFallback =
    !Array.isArray(professions) && typeof fallbackOccupation === 'string'
      ? fallbackOccupation
          .split(/[,\s]+/)
          .map((v) => v.trim())
          .filter(Boolean)
          .map((name, index) => ({ name, isPrimary: index === 0 }))
      : [];

  const rawItems = Array.isArray(professions) ? professions : fromFallback;
  const normalized = rawItems
    .map((item, index) => {
      if (typeof item === 'string') {
        const name = item.trim();
        if (!name) return null;
        return { name, category: name.toLowerCase().includes('student') ? 'student' : 'general', isPrimary: index === 0 };
      }
      if (!item || typeof item !== 'object') return null;
      const name = String(item.name || item.profession || item.label || '').trim();
      if (!name) return null;
      return {
        name,
        category: String(item.category || (name.toLowerCase().includes('student') ? 'student' : 'general')).toLowerCase(),
        roleTitle: item.roleTitle || item.role_title || null,
        organization: item.organization || null,
        domain: item.domain || null,
        experienceYears: item.experienceYears ?? item.experience_years ?? null,
        educationLevel: item.educationLevel || item.education_level || null,
        studentGrade: item.studentGrade || item.student_grade || null,
        studentStream: item.studentStream || item.student_stream || null,
        isPrimary: Boolean(item.isPrimary ?? item.is_primary ?? index === 0),
        details: item.details && typeof item.details === 'object' ? item.details : {},
      };
    })
    .filter(Boolean);

  const seen = new Set();
  return normalized.filter((item) => {
    const key = `${item.name.toLowerCase()}|${String(item.roleTitle || '').toLowerCase()}|${String(item.organization || '').toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const upsertProfessionMaster = async (name, category = 'general') => {
  const slug = slugifyProfession(name);
  const result = await pool.query(
    `
      INSERT INTO profession_master (slug, name, category, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (slug)
      DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `,
    [slug, name, category]
  );
  return Number(result.rows[0].id);
};

const syncUserProfessions = async (userId, professions = []) => {
  await pool.query('DELETE FROM user_professions WHERE user_id = $1', [userId]);
  for (const profession of professions) {
    const professionId = await upsertProfessionMaster(profession.name, profession.category || 'general');
    await pool.query(
      `
        INSERT INTO user_professions (
          user_id, profession_id, role_title, organization, domain, experience_years,
          education_level, student_grade, student_stream, is_primary, is_active, details
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, true, $11::jsonb
        )
      `,
      [
        userId,
        professionId,
        profession.roleTitle || null,
        profession.organization || null,
        profession.domain || null,
        profession.experienceYears != null ? Number(profession.experienceYears) : null,
        profession.educationLevel || null,
        profession.studentGrade || null,
        profession.studentStream || null,
        Boolean(profession.isPrimary),
        JSON.stringify(profession.details || {}),
      ]
    );
  }
};

const getUserProfessions = async (userId) => {
  const result = await pool.query(
    `
      SELECT
        up.id,
        pm.id as "professionId",
        pm.slug,
        pm.name,
        pm.category,
        up.role_title as "roleTitle",
        up.organization,
        up.domain,
        up.experience_years as "experienceYears",
        up.education_level as "educationLevel",
        up.student_grade as "studentGrade",
        up.student_stream as "studentStream",
        up.is_primary as "isPrimary",
        up.details
      FROM user_professions up
      JOIN profession_master pm ON pm.id = up.profession_id
      WHERE up.user_id = $1 AND up.is_active = true
      ORDER BY up.is_primary DESC, pm.name ASC
    `,
    [userId]
  );
  return result.rows;
};

/**
 * @route   GET /api/profile/basic
 * @desc    Get user basic profile
 * @access  Private
 */
exports.getBasicProfile = async (req, res) => {
  try {
    await ensureProfileGovernanceColumns();
    await ensureProfessionTables();
    const requesterId = Number(req.user.id);
    const userId = await getTargetUserId(req);
    if (!userId) {
      return res.status(404).json({
        success: false,
        error: 'Target profile not found',
      });
    }

    const canView = await canManageFamilyMemberProfile(requesterId, userId);
    if (!canView) {
      return res.status(403).json({
        success: false,
        error: 'You are not allowed to view this profile',
      });
    }

    const query = `
      SELECT 
        id,
        first_name as "firstName",
        middle_name as "middleName",
        last_name as "lastName",
        email,
        phone,
        dob as "dateOfBirth",
        gender,
        gotra,
        occupation,
        marital_status as "maritalStatus",
        husband_name as "husbandName",
        district_code as "districtCode",
        seervi_card_id as "seerviCardId",
        is_private_profile as "isPrivateProfile",
        role,
        profile_photo_url as "profilePhotoUrl",
        updated_at as "updatedAt"
      FROM users
      WHERE id = $1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const professions = await getUserProfessions(userId);

    res.status(200).json({
      success: true,
      data: {
        userId: result.rows[0].id,
        firstName: result.rows[0].firstName,
        middleName: result.rows[0].middleName,
        lastName: result.rows[0].lastName,
        email: result.rows[0].email,
        phone: result.rows[0].phone,
        dateOfBirth: result.rows[0].dateOfBirth,
        gender: result.rows[0].gender,
        gotra: result.rows[0].gotra,
        occupation: result.rows[0].occupation,
        maritalStatus: result.rows[0].maritalStatus,
        husbandName: result.rows[0].husbandName,
        districtCode: result.rows[0].districtCode || '00',
        seerviCardId: result.rows[0].seerviCardId || null,
        isPrivateProfile: Boolean(result.rows[0].isPrivateProfile),
        role: result.rows[0].role,
        roleCategoryLabel: buildRoleCategory(result.rows[0].role, result.rows[0].occupation),
        professions,
        profilePhotoUrl: result.rows[0].profilePhotoUrl,
        updatedAt: result.rows[0].updatedAt,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   PUT /api/profile/basic
 * @desc    Update user basic profile
 * @access  Private
 */
exports.updateBasicProfile = async (req, res) => {
  try {
    await ensureProfileGovernanceColumns();
    await ensureProfessionTables();
    const requesterId = Number(req.user.id);
    const userId = await getTargetUserId(req);
    if (!userId) {
      return res.status(404).json({
        success: false,
        error: 'Target profile not found',
      });
    }
    const {
      firstName,
      middleName,
      lastName,
      email,
      phone,
      dateOfBirth,
      gender,
      gotra,
      occupation,
      maritalStatus,
      husbandName,
      districtCode,
      isPrivateProfile,
      professions,
    } = req.body;
    const normalizedGender = normalizeProfileGender(gender);
    const normalizedMaritalStatus = normalizeMaritalStatus(maritalStatus);
    const normalizedProfessions = normalizeProfessionInput(professions, occupation);
    const derivedOccupation = normalizedProfessions.length
      ? normalizedProfessions.map((p) => p.name).join(', ').slice(0, 100)
      : occupation || null;

    const canEdit = await canManageFamilyMemberProfile(requesterId, userId);
    if (!canEdit) {
      return res.status(403).json({
        success: false,
        error: 'You are not allowed to edit this profile',
      });
    }

    // Validation - only firstName, email, and dateOfBirth are truly required
    if (!firstName || !email || !dateOfBirth) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: {
          field: 'required',
          message: 'firstName, email, and dateOfBirth are required',
        },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: {
          field: 'email',
          message: 'Invalid email format',
        },
      });
    }

    // Validate gender
    if (!normalizedGender) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: {
          field: 'gender',
          message: 'Gender must be Male/Female/Other or M/F/O',
        },
      });
    }

    // Check if email is already taken by another user
    const emailCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email.toLowerCase(), userId]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Email already taken',
      });
    }

    // Update profile
    const query = `
      UPDATE users
      SET 
        first_name = $1,
        middle_name = $2,
        last_name = $3,
        email = $4,
        phone = $5,
        dob = $6,
        gender = $7,
        gotra = $8,
        occupation = $9,
        marital_status = $10,
        husband_name = $11,
        district_code = COALESCE($12, district_code),
        is_private_profile = COALESCE($13, is_private_profile),
        created_by = COALESCE(created_by, $14),
        updated_by = $14,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $15
      RETURNING 
        id,
        first_name as "firstName",
        middle_name as "middleName",
        last_name as "lastName",
        email,
        phone,
        dob as "dateOfBirth",
        gender,
        gotra,
        occupation,
        marital_status as "maritalStatus",
        husband_name as "husbandName",
        district_code as "districtCode",
        seervi_card_id as "seerviCardId",
        is_private_profile as "isPrivateProfile",
        role,
        profile_photo_url as "profilePhotoUrl",
        updated_at as "updatedAt"
    `;

    const values = [
      firstName,
      middleName || null,
      lastName,
      email.toLowerCase(),
      phone,
      dateOfBirth,
      normalizedGender,
      gotra || null,
      derivedOccupation,
      normalizedMaritalStatus || null,
      husbandName || null,
      districtCode ? String(districtCode).replace(/\D/g, '').padStart(2, '0').slice(-2) : null,
      typeof isPrivateProfile === 'boolean' ? isPrivateProfile : null,
      requesterId,
      userId,
    ];

    const result = await pool.query(query, values);

    if (districtCode || !result.rows[0].seerviCardId) {
      const nextDistrictCode = districtCode || result.rows[0].districtCode || '00';
      await User.assignSeerviCardId(userId, nextDistrictCode);

      const refresh = await pool.query(
        `SELECT
          id,
          first_name as "firstName",
          middle_name as "middleName",
          last_name as "lastName",
          email,
          phone,
          dob as "dateOfBirth",
          gender,
          gotra,
          occupation,
          marital_status as "maritalStatus",
          husband_name as "husbandName",
          district_code as "districtCode",
          seervi_card_id as "seerviCardId",
          is_private_profile as "isPrivateProfile",
          role,
          profile_photo_url as "profilePhotoUrl",
          updated_at as "updatedAt"
        FROM users
        WHERE id = $1`,
        [userId]
      );
      result.rows[0] = refresh.rows[0];
    }

    if (Array.isArray(professions)) {
      await syncUserProfessions(userId, normalizedProfessions);
    }
    const persistedProfessions = await getUserProfessions(userId);

    try {
      await pool.query(
        `UPDATE gathjod_profiles
         SET first_name = $1,
             father_name = COALESCE($2, father_name),
             gotra = COALESCE($3, gotra),
             gender = COALESCE($4, gender),
             date_of_birth = COALESCE($5, date_of_birth),
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id::text = $6::text`,
        [
          firstName,
          lastName || null,
          gotra || null,
          toNeo4jGender(normalizedGender),
          dateOfBirth || null,
          String(userId),
        ]
      );
    } catch (gathjodSyncError) {
      console.warn('⚠️ Failed to sync gathjod profile fields:', gathjodSyncError.message);
    }

    try {
      const syncSource = await pool.query(
        `SELECT neo4j_person_id, profile_photo_url
         FROM users
         WHERE id = $1`,
        [userId]
      );
      const neo4jPersonId = syncSource.rows[0]?.neo4j_person_id;
      if (neo4jPersonId) {
        await axios.put(
          `${FAMILY_MANAGEMENT_SERVICE_URL}/api/members/${encodeURIComponent(neo4jPersonId)}`,
          {
            firstName,
            fatherName: lastName || null,
            dateOfBirth,
            gotra: gotra || null,
            email: email.toLowerCase(),
            gender: toNeo4jGender(normalizedGender),
            phone: phone || null,
            occupation: derivedOccupation || null,
            maritalStatus: normalizedMaritalStatus || null,
            photo: syncSource.rows[0]?.profile_photo_url || null,
          }
        );
      }
    } catch (familySyncError) {
      console.warn('⚠️ Failed to sync updated profile to family-tree source:', familySyncError.message);
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        userId: result.rows[0].id,
        firstName: result.rows[0].firstName,
        middleName: result.rows[0].middleName,
        lastName: result.rows[0].lastName,
        email: result.rows[0].email,
        phone: result.rows[0].phone,
        dateOfBirth: result.rows[0].dateOfBirth,
        gender: result.rows[0].gender,
        gotra: result.rows[0].gotra,
        occupation: result.rows[0].occupation,
        professions: persistedProfessions,
        maritalStatus: result.rows[0].maritalStatus,
        husbandName: result.rows[0].husbandName,
        districtCode: result.rows[0].districtCode || '00',
        seerviCardId: result.rows[0].seerviCardId || null,
        isPrivateProfile: Boolean(result.rows[0].isPrivateProfile),
        role: result.rows[0].role,
        roleCategoryLabel: buildRoleCategory(result.rows[0].role, result.rows[0].occupation),
        profilePhotoUrl: result.rows[0].profilePhotoUrl,
        updatedAt: result.rows[0].updatedAt,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   GET /api/profile/professions/aggregation
 * @desc    Profession aggregation with optional student breakdown
 * @access  Private
 */
exports.getProfessionAggregation = async (req, res) => {
  try {
    await ensureProfessionTables();
    const result = await pool.query(
      `
        SELECT
          pm.id,
          pm.slug,
          pm.name,
          pm.category,
          COUNT(DISTINCT up.user_id)::integer as "userCount",
          COALESCE(
            (
              SELECT jsonb_object_agg(sg.student_grade, sg.cnt)
              FROM (
                SELECT student_grade, COUNT(DISTINCT user_id)::integer as cnt
                FROM user_professions
                WHERE profession_id = pm.id
                  AND is_active = true
                  AND student_grade IS NOT NULL
                  AND TRIM(student_grade) <> ''
                GROUP BY student_grade
              ) sg
            ),
            '{}'::jsonb
          ) as "studentGradeCounts",
          COALESCE(
            (
              SELECT jsonb_object_agg(ss.student_stream, ss.cnt)
              FROM (
                SELECT student_stream, COUNT(DISTINCT user_id)::integer as cnt
                FROM user_professions
                WHERE profession_id = pm.id
                  AND is_active = true
                  AND student_stream IS NOT NULL
                  AND TRIM(student_stream) <> ''
                GROUP BY student_stream
              ) ss
            ),
            '{}'::jsonb
          ) as "studentStreamCounts"
        FROM profession_master pm
        JOIN user_professions up ON up.profession_id = pm.id AND up.is_active = true
        WHERE pm.is_active = true
        GROUP BY pm.id, pm.slug, pm.name, pm.category
        ORDER BY "userCount" DESC, pm.name ASC
      `
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get profession aggregation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profession aggregation',
    });
  }
};

/**
 * @route   GET /api/profile/professions/:professionSlug/members
 * @desc    Drill-down users for a profession
 * @access  Private
 */
exports.getProfessionMembers = async (req, res) => {
  try {
    await ensureProfessionTables();
    const { professionSlug } = req.params;
    const result = await pool.query(
      `
        SELECT
          u.id as "userId",
          u.first_name as "firstName",
          u.last_name as "lastName",
          u.email,
          u.profile_photo_url as "profilePhotoUrl",
          pm.id as "professionId",
          pm.slug,
          pm.name,
          pm.category,
          up.role_title as "roleTitle",
          up.organization,
          up.domain,
          up.experience_years as "experienceYears",
          up.education_level as "educationLevel",
          up.student_grade as "studentGrade",
          up.student_stream as "studentStream",
          up.details
        FROM user_professions up
        JOIN profession_master pm ON pm.id = up.profession_id
        JOIN users u ON u.id = up.user_id
        WHERE pm.slug = $1
          AND pm.is_active = true
          AND up.is_active = true
          AND u.is_active = true
        ORDER BY u.first_name ASC, u.last_name ASC
      `,
      [professionSlug]
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get profession members error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profession members',
    });
  }
};

/**
 * @route   POST /api/profile/photo
 * @desc    Upload profile photo
 * @access  Private
 */
exports.uploadProfilePhotoHandler = async (req, res) => {
  try {
    await ensureProfileGovernanceColumns();
    const requesterId = Number(req.user.id);
    const userId = await getTargetUserId(req);
    if (!userId) {
      return res.status(404).json({
        success: false,
        error: 'Target profile not found',
      });
    }
    const canEdit = await canManageFamilyMemberProfile(requesterId, userId);
    if (!canEdit) {
      return res.status(403).json({
        success: false,
        error: 'You are not allowed to edit this profile',
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    // Upload to S3
    const { uploadProfilePhoto } = require('../config/s3');
    const photoUrl = await uploadProfilePhoto(
      req.file.buffer,
      userId,
      req.file.mimetype
    );

    // Update database
    await pool.query(
      'UPDATE users SET profile_photo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [photoUrl, userId]
    );

    res.status(200).json({
      success: true,
      message: 'Profile photo uploaded successfully',
      data: {
        profilePhotoUrl: photoUrl,
      },
    });
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload profile photo',
    });
  }
};

/**
 * @route   DELETE /api/profile/photo
 * @desc    Delete profile photo
 * @access  Private
 */
exports.deleteProfilePhoto = async (req, res) => {
  try {
    await ensureProfileGovernanceColumns();
    const requesterId = Number(req.user.id);
    const userId = await getTargetUserId(req);
    if (!userId) {
      return res.status(404).json({
        success: false,
        error: 'Target profile not found',
      });
    }
    const canEdit = await canManageFamilyMemberProfile(requesterId, userId);
    if (!canEdit) {
      return res.status(403).json({
        success: false,
        error: 'You are not allowed to edit this profile',
      });
    }

    // Get current photo URL to delete from S3
    const result = await pool.query(
      'SELECT profile_photo_url FROM users WHERE id = $1',
      [userId]
    );

    const photoUrl = result.rows[0]?.profile_photo_url;

    // Delete from S3 if exists
    if (photoUrl) {
      const { deleteProfilePhoto: deleteFromS3 } = require('../config/s3');
      await deleteFromS3(photoUrl);
    }

    // Update database
    await pool.query(
      'UPDATE users SET profile_photo_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );

    res.status(200).json({
      success: true,
      message: 'Profile photo removed successfully',
    });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   POST /api/profile/change-password
 * @desc    Change user password
 * @access  Private
 */
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: {
          field: 'passwords',
          message: 'All password fields are required',
        },
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: {
          field: 'confirmPassword',
          message: 'New passwords do not match',
        },
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: {
          field: 'newPassword',
          message: 'Password must be at least 8 characters',
        },
      });
    }

    // Get current password hash
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(
      currentPassword,
      userResult.rows[0].password_hash
    );

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect',
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, userId]
    );

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   GET /api/profile/check-email?email=test@example.com
 * @desc    Check if email is available
 * @access  Private
 */
exports.checkEmailAvailability = async (req, res) => {
  try {
    const { email } = req.query;
    const userId = req.user.id;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email parameter is required',
      });
    }

    // Check if email exists for another user
    const result = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email.toLowerCase(), userId]
    );

    const available = result.rows.length === 0;

    res.status(200).json({
      success: true,
      available,
      message: available ? 'Email is available' : 'Email is already taken',
    });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   GET /api/profile/resolve-member
 * @desc    Resolve user account by neo4j person ID or email
 * @access  Private
 */
exports.resolveMemberUser = async (req, res) => {
  try {
    const personId = String(req.query.personId || '').trim();
    const email = String(req.query.email || '').trim().toLowerCase();

    if (!personId && !email) {
      return res.status(400).json({
        success: false,
        error: 'personId or email is required',
      });
    }

    const result = await pool.query(
      `
        SELECT id, slug, first_name as "firstName", email, neo4j_person_id as "neo4jPersonId"
        FROM users
        WHERE is_active = true
          AND (
            ($1 <> '' AND neo4j_person_id = $1)
            OR ($2 <> '' AND LOWER(email) = $2)
          )
        ORDER BY id DESC
        LIMIT 1
      `,
      [personId, email]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        userId: result.rows[0].id,
        slug: result.rows[0].slug,
        firstName: result.rows[0].firstName,
        email: result.rows[0].email,
        neo4jPersonId: result.rows[0].neo4jPersonId,
      },
    });
  } catch (error) {
    console.error('Resolve member user error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   GET /api/profile/by-slug/:slug
 * @desc    Get user profile by slug (Phase 1: Slug ID migration)
 * @access  Public
 */
exports.getUserBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({
        success: false,
        error: 'Slug parameter is required',
      });
    }

    const query = `
      SELECT 
        id,
        slug,
        first_name as "firstName",
        father_name as "fatherName",
        email,
        gotra,
        role,
        husband_name as "husbandName",
        marital_status as "maritalStatus",
        occupation,
        district_code as "districtCode",
        seervi_card_id as "seerviCardId",
        is_active as "isActive",
        family_id as "familyId",
        neo4j_person_id as "neo4jPersonId",
        created_at as "createdAt"
      FROM users
      WHERE slug = $1 AND is_active = true
    `;

    const result = await pool.query(query, [slug]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = result.rows[0];

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          slug: user.slug,
          firstName: user.firstName,
          fatherName: user.fatherName,
          email: user.email,
          gotra: user.gotra,
          role: user.role,
          husbandName: user.husbandName || null,
          maritalStatus: user.maritalStatus || null,
          occupation: user.occupation || null,
          districtCode: user.districtCode || '00',
          seerviCardId: user.seerviCardId || null,
          roleCategoryLabel: buildRoleCategory(user.role, user.occupation),
          isActive: user.isActive,
          familyId: user.familyId,
          neo4jPersonId: user.neo4jPersonId,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Get user by slug error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

module.exports = exports;
