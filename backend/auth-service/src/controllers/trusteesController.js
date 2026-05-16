/**
 * =====================================================================
 * Trustees Controller
 * Company: emeelan
 * =====================================================================
 * Handles temple trustees/board members operations
 */

const pool = require('../config/database');

/**
 * @route   GET /api/trustees?temple_id=X&search=...&ageMin=...&ageMax=...&gender=...&source=...
 * @desc    Get all trustees for a temple with filters
 * @access  Private
 */
exports.getAllTrustees = async (req, res) => {
  try {
    const { temple_id, search, ageMin, ageMax, gender, source, sortBy, sortOrder } = req.query;

    if (!temple_id) {
      return res.status(400).json({
        success: false,
        error: 'temple_id is required'
      });
    }

    // Build dynamic WHERE clause
    let whereConditions = ['t.temple_id = $1', 't.is_active = true'];
    let queryParams = [temple_id];
    let paramIndex = 2;

    // Search filter (mobile or email)
    if (search && search.trim()) {
      whereConditions.push(`(t.phone ILIKE $${paramIndex} OR t.email ILIKE $${paramIndex})`);
      queryParams.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // Age range filter (requires join with users table)
    if (ageMin || ageMax) {
      if (ageMin) {
        whereConditions.push(`EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.dob)) >= $${paramIndex}`);
        queryParams.push(parseInt(ageMin));
        paramIndex++;
      }
      if (ageMax) {
        whereConditions.push(`EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.dob)) <= $${paramIndex}`);
        queryParams.push(parseInt(ageMax));
        paramIndex++;
      }
    }

    // Gender filter
    if (gender && gender !== 'all') {
      whereConditions.push(`u.gender = $${paramIndex}`);
      queryParams.push(gender);
      paramIndex++;
    }

    // Source filter (temple member vs external)
    if (source && source !== 'all') {
      if (source === 'temple') {
        whereConditions.push('t.user_id IS NOT NULL');
      } else if (source === 'external') {
        whereConditions.push('t.user_id IS NULL');
      }
    }

    const query = `
      SELECT 
        t.id,
        t.user_id as "userId",
        t.name,
        t.father_name as "fatherName",
        t.husband_name as "husbandName",
        t.designation,
        t.photo_url as "photoUrl",
        t.phone,
        t.email,
        t.amount,
        t.contribution_date as "contributionDate",
        t.native_address as "nativeAddress",
        t.native_village as "nativeVillage",
        t.native_district as "nativeDistrict",
        t.native_state as "nativeState",
        t.native_pincode as "nativePincode",
        t.current_address as "currentAddress",
        t.current_city as "currentCity",
        t.current_state as "currentState",
        t.current_pincode as "currentPincode",
        t.about_text as "aboutText",
        t.achievements,
        t.youtube_video_id as "youtubeVideoId",
        t.display_order as "displayOrder",
        t.created_at as "createdAt",
        u.gender,
        u.dob as "dateOfBirth",
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.dob)) as age,
        CASE 
          WHEN t.user_id IS NOT NULL THEN 'temple'
          ELSE 'external'
        END as source
      FROM temple_trustees t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ${getSortClause(sortBy, sortOrder)}
    `;

    function getSortClause(sortBy, sortOrder) {
      const order = sortOrder === 'desc' ? 'DESC' : 'ASC';
      switch(sortBy) {
        case 'amount':
          return `t.amount ${order}, t.id`;
        case 'date':
          return `t.contribution_date ${order}, t.id`;
        default:
          return 't.display_order, t.id';
      }
    }

    const result = await pool.query(query, queryParams);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching trustees:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch trustees'
    });
  }
};

/**
 * @route   GET /api/trustees/:id
 * @desc    Get single trustee details
 * @access  Private
 */
exports.getTrusteeById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        id,
        name,
        father_name as "fatherName",
        husband_name as "husbandName",
        designation,
        photo_url as "photoUrl",
        phone,
        email,
        amount,
        contribution_date as "contributionDate",
        contribution_for as "contributionFor",
        native_address as "nativeAddress",
        native_village as "nativeVillage",
        native_district as "nativeDistrict",
        native_state as "nativeState",
        native_pincode as "nativePincode",
        current_address as "currentAddress",
        current_city as "currentCity",
        current_state as "currentState",
        current_pincode as "currentPincode",
        about_text as "aboutText",
        achievements,
        youtube_video_id as "youtubeVideoId",
        created_at as "createdAt"
      FROM temple_trustees
      WHERE id = $1 AND is_active = true
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Trustee not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching trustee:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch trustee'
    });
  }
};

/**
 * @route   POST /api/trustees
 * @desc    Create new trustee
 * @access  Private (admin only)
 */
exports.createTrustee = async (req, res) => {
  try {
    // Accept both camelCase (from frontend) and snake_case (from database)
    const {
      temple_id,
      templeId,
      user_id,
      userId,
      name,
      father_name,
      fatherName,
      husband_name,
      husbandName,
      designation,
      photo_url,
      photoUrl,
      phone,
      email,
      amount,
      contribution_date,
      contributionDate,
      contribution_for,
      contributionFor,
      native_address,
      nativeAddress,
      native_village,
      nativeVillage,
      native_district,
      nativeDistrict,
      native_state,
      nativeState,
      native_pincode,
      nativePincode,
      current_address,
      currentAddress,
      current_city,
      currentCity,
      current_state,
      currentState,
      current_pincode,
      currentPincode,
      about_text,
      aboutText,
      achievements,
      youtube_video_id,
      youtubeVideoId,
      display_order,
      displayOrder
    } = req.body;

    // Normalize to snake_case for database
    const templeIdValue = temple_id || templeId;
    const userIdValue = user_id || userId;
    const fatherNameValue = father_name || fatherName;
    const husbandNameValue = husband_name || husbandName;
    const photoUrlValue = photo_url || photoUrl;
    const contributionDateValue = contribution_date || contributionDate;
    const contributionForValue = contribution_for || contributionFor;
    const nativeAddressValue = native_address || nativeAddress;
    const nativeVillageValue = native_village || nativeVillage;
    const nativeDistrictValue = native_district || nativeDistrict;
    const nativeStateValue = native_state || nativeState;
    const nativePincodeValue = native_pincode || nativePincode;
    const currentAddressValue = current_address || currentAddress;
    const currentCityValue = current_city || currentCity;
    const currentStateValue = current_state || currentState;
    const currentPincodeValue = current_pincode || currentPincode;
    const aboutTextValue = about_text || aboutText;
    const youtubeVideoIdValue = youtube_video_id || youtubeVideoId;
    const displayOrderValue = display_order || displayOrder;

    if (!templeIdValue || !name) {
      return res.status(400).json({
        success: false,
        error: 'templeId and name are required'
      });
    }

    const query = `
      INSERT INTO temple_trustees (
        temple_id, user_id, name, father_name, husband_name, designation,
        photo_url, phone, email, amount, contribution_date, contribution_for,
        native_address, native_village, native_district, native_state, native_pincode,
        current_address, current_city, current_state, current_pincode,
        about_text, achievements, youtube_video_id, display_order, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22::jsonb, $23, $24, $25, $26
      )
      RETURNING id, name, designation
    `;

    const values = [
      templeIdValue, userIdValue, name, fatherNameValue, husbandNameValue, designation,
      photoUrlValue, phone, email, amount, contributionDateValue, contributionForValue,
      nativeAddressValue, nativeVillageValue, nativeDistrictValue, nativeStateValue, nativePincodeValue,
      currentAddressValue, currentCityValue, currentStateValue, currentPincodeValue,
      aboutTextValue, JSON.stringify(achievements || []), youtubeVideoIdValue, displayOrderValue || 0, req.user?.id
    ];

    const result = await pool.query(query, values);

    return res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Trustee created successfully'
    });
  } catch (error) {
    console.error('Error creating trustee:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create trustee'
    });
  }
};

/**
 * @route   GET /api/trustees/search-members
 * @desc    3-tier search for trustee members
 * @access  Private (admin only)
 */
exports.searchMembersForTrustee = async (req, res) => {
  try {
    const { temple_id, query } = req.query;

    if (!temple_id) {
      return res.status(400).json({
        success: false,
        error: 'temple_id is required'
      });
    }

    // Validate search query
    if (!query || query.trim().length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          templeMembers: [],
          crossTempleMembers: [],
          canCreateNew: false,
          message: 'Enter name (min 3 chars) or phone/email to search'
        }
      });
    }

    const searchTerm = query.trim();
    const isPhoneOrEmail = /^[+\d]{10,}$/.test(searchTerm) || /@/.test(searchTerm);
    const isNameSearch = searchTerm.length >= 3 && !isPhoneOrEmail;

    const results = {
      templeMembers: [],
      crossTempleMembers: [],
      canCreateNew: false,
      searchType: isPhoneOrEmail ? 'contact' : 'name'
    };

    // TIER 1: Search temple members (both family members AND direct temple members)
    if (isNameSearch || isPhoneOrEmail) {
      const templeMembersQuery = `
        WITH temple_family_members AS (
          -- Users in families belonging to this temple
          SELECT DISTINCT
            u.id,
            TRIM(u.first_name || ' ' || COALESCE(u.middle_name, '') || ' ' || COALESCE(u.last_name, '')) as name,
            u.first_name,
            u.last_name,
            u.phone,
            u.email,
            u.dob,
            f.name as family_name,
            f.id as family_id,
            f.temple_id as family_temple_id,
            'temple_family' as member_type
          FROM users u
          INNER JOIN family_members fm ON fm.user_id = u.id
          INNER JOIN families f ON f.id = fm.family_id
          WHERE f.temple_id = $1 
            AND (f.family_type = 'regular' OR f.family_type IS NULL)
            AND (f.active = true OR f.active IS NULL)
        ),
        direct_temple_members AS (
          -- Users directly linked to temple (but family from other temple or no family)
          SELECT DISTINCT
            u.id,
            TRIM(u.first_name || ' ' || COALESCE(u.middle_name, '') || ' ' || COALESCE(u.last_name, '')) as name,
            u.first_name,
            u.last_name,
            u.phone,
            u.email,
            u.dob,
            COALESCE(f.name, 'No Family') as family_name,
            f.id as family_id,
            COALESCE(f.temple_id, 0) as family_temple_id,
            'direct_member' as member_type
          FROM users u
          INNER JOIN user_temples ut ON ut.user_id = u.id
          LEFT JOIN family_members fm ON fm.user_id = u.id
          LEFT JOIN families f ON f.id = fm.family_id
          WHERE ut.temple_id = $1
            AND ut.is_active = true
            AND (f.temple_id IS NULL OR f.temple_id != $1)  -- Family from other temple or no family
        )
        SELECT * FROM (
          SELECT * FROM temple_family_members
          UNION
          SELECT * FROM direct_temple_members
        ) combined
        WHERE (
          ${isPhoneOrEmail ? 
            '(phone = $2 OR email = $2)' : 
            '(first_name ILIKE $2 OR COALESCE(last_name, \'\') ILIKE $2 OR name ILIKE $2)'
          }
        )
        ORDER BY 
          CASE member_type 
            WHEN 'temple_family' THEN 1 
            WHEN 'direct_member' THEN 2 
          END,
          name
        LIMIT 20
      `;

      const templeMembersResult = await pool.query(
        templeMembersQuery,
        [temple_id, isPhoneOrEmail ? searchTerm : `%${searchTerm}%`]
      );

      results.templeMembers = templeMembersResult.rows.map(row => {
        const isFromThisTempleFamiy = row.family_temple_id === parseInt(temple_id);
        return {
          id: row.id,
          name: row.name.trim(),
          firstName: row.first_name,
          lastName: row.last_name,
          phone: row.phone,
          email: row.email,
          dob: row.dob,
          familyName: row.family_name,
          familyId: row.family_id,
          memberType: row.member_type,
          source: 'temple',
          badge: isFromThisTempleFamiy ? 'Temple Family Member' : 'Temple Member (Other Family)'
        };
      });
    }

    // TIER 2: Search cross-temple users (only if phone/email search)
    if (isPhoneOrEmail) {
      const crossTempleQuery = `
        SELECT DISTINCT ON (u.id)
          u.id,
          TRIM(u.first_name || ' ' || COALESCE(u.middle_name, '') || ' ' || COALESCE(u.last_name, '')) as name,
          u.first_name,
          u.last_name,
          u.phone,
          u.email,
          u.dob,
          t.name as temple_name,
          t.id as temple_id,
          f.name as family_name,
          'cross-temple' as source
        FROM users u
        INNER JOIN family_members fm ON fm.user_id = u.id
        INNER JOIN families f ON f.id = fm.family_id
        INNER JOIN temples t ON t.id = f.temple_id
        WHERE f.temple_id != $1
          AND (u.phone = $2 OR u.email = $2)
        ORDER BY u.id, u.first_name, u.last_name
        LIMIT 10
      `;

      const crossTempleResult = await pool.query(crossTempleQuery, [temple_id, searchTerm]);

      results.crossTempleMembers = crossTempleResult.rows.map(row => ({
        id: row.id,
        name: row.name.trim(),
        firstName: row.first_name,
        lastName: row.last_name,
        phone: row.phone,
        email: row.email,
        dob: row.dob,
        templeName: row.temple_name,
        templeId: row.temple_id,
        familyName: row.family_name,
        source: 'cross-temple',
        badge: `From: ${row.temple_name}`
      }));
    }

    // TIER 3: Check if user exists at all (for new external user creation)
    if (isPhoneOrEmail) {
      const totalFound = results.templeMembers.length + results.crossTempleMembers.length;
      
      if (totalFound === 0) {
        // Check if user exists in system at all
        const userExistsQuery = `
          SELECT id FROM users WHERE phone = $1 OR email = $1
        `;
        const userExists = await pool.query(userExistsQuery, [searchTerm]);

        results.canCreateNew = userExists.rows.length === 0;
        if (results.canCreateNew) {
          results.message = 'No user found. You can create a new external member.';
        } else {
          results.message = 'User exists but not linked to any temple.';
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Error searching members for trustee:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search members'
    });
  }
};

/**
 * @route   POST /api/trustees/:id/photo
 * @desc    Upload trustee photo
 * @access  Private (admin only)
 */
exports.uploadTrusteePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No photo file provided'
      });
    }

    // Check if trustee exists
    const trusteeCheck = await pool.query(
      'SELECT id FROM temple_trustees WHERE id = $1',
      [id]
    );

    if (trusteeCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Trustee not found'
      });
    }

    const { uploadProfilePhoto } = require('../config/s3');
    const photoUrl = await uploadProfilePhoto(
      req.file.buffer,
      `trustee-${id}`,
      req.file.mimetype
    );

    // Update trustee photo_url in database
    const updateQuery = `
      UPDATE temple_trustees
      SET photo_url = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, photo_url as "photoUrl"
    `;

    const result = await pool.query(updateQuery, [photoUrl, id]);

    return res.status(200).json({
      success: true,
      photoUrl: result.rows[0].photoUrl,
      message: 'Photo uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading trustee photo:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload photo'
    });
  }
};

// Already exported using exports.functionName above, no need for module.exports
