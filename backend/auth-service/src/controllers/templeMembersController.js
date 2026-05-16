/**
 * =====================================================================
 * Temple Members Controller
 * Company: emeelan
 * =====================================================================
 * Manages temple membership (user_temples table)
 */

const pool = require('../config/database');

/**
 * @route   GET /api/temple-members/search-global
 * @desc    Global search for users by phone or email (across all temples)
 * @access  Private (admin only)
 */
exports.searchGlobalUsers = async (req, res) => {
  try {
    const { query } = req.query;

    console.log('🔍 Global user search - Query:', query);

    if (!query || query.trim().length < 3) {
      console.log('❌ Query too short or empty');
      return res.status(200).json({
        success: true,
        data: [],
        message: 'Enter phone or email (min 3 characters)'
      });
    }

    const searchTerm = query.trim();
    console.log('🔍 Searching for:', searchTerm);

    const result = await pool.query(
      `SELECT 
        u.id,
        u.first_name || ' ' || COALESCE(u.middle_name, '') || ' ' || COALESCE(u.last_name, '') as name,
        u.first_name,
        u.last_name,
        u.phone,
        u.email,
        u.dob,
        COALESCE(u.profile_photo_url, to_jsonb(u)->>'photo_url') as photo_url,
        COALESCE(to_jsonb(u)->'professions', '[]'::jsonb) as professions,
        COALESCE(
          (SELECT json_agg(json_build_object('temple_id', ut.temple_id, 'temple_name', t.name, 'member_type', COALESCE(to_jsonb(ut)->>'member_type', 'society_member')))
           FROM user_temples ut
           JOIN temples t ON t.id = ut.temple_id
           WHERE ut.user_id = u.id AND ut.is_active = true),
          '[]'::json
        ) as temples
      FROM users u
      WHERE (u.phone ILIKE $1 OR u.email ILIKE $1)
        AND u.is_active = true
      ORDER BY u.first_name, u.last_name
      LIMIT 20`,
      [`%${searchTerm}%`]
    );

    console.log(`✅ Found ${result.rows.length} user(s)`);
    if (result.rows.length > 0) {
      console.log('Users:', result.rows.map(r => ({ id: r.id, name: r.name, email: r.email, phone: r.phone })));
    }

    return res.status(200).json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        name: row.name.trim(),
        firstName: row.first_name,
        lastName: row.last_name,
        phone: row.phone,
        email: row.email,
        dob: row.dob,
        photoUrl: row.photo_url,
        professions: row.professions || [],
        temples: row.temples || []
      }))
    });
  } catch (error) {
    console.error('❌ Error in global user search:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search users'
    });
  }
};

/**
 * @route   POST /api/temple-members/add-to-temple
 * @desc    Add user to temple as member
 * @access  Private (admin only)
 */
exports.addMemberToTemple = async (req, res) => {
  try {
    const { temple_id, templeId, user_id, userId, member_type, memberType, role } = req.body;

    const templeIdValue = temple_id || templeId;
    const userIdValue = user_id || userId;
    const memberTypeValue = member_type || memberType || 'society_member';

    if (!templeIdValue || !userIdValue) {
      return res.status(400).json({
        success: false,
        error: 'templeId and userId are required'
      });
    }

    // Check if already a member
    const existing = await pool.query(
      `SELECT id, is_active FROM user_temples 
       WHERE user_id = $1 AND temple_id = $2`,
      [userIdValue, templeIdValue]
    );

    if (existing.rows.length > 0) {
      // Reactivate if inactive
      if (!existing.rows[0].is_active) {
        await pool.query(
          `UPDATE user_temples 
           SET is_active = true, member_type = $1, role = $2, assigned_at = NOW()
           WHERE user_id = $3 AND temple_id = $4`,
          [memberTypeValue, role || 'member', userIdValue, templeIdValue]
        );

        return res.status(200).json({
          success: true,
          message: 'Member reactivated in temple'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'User is already a member of this temple'
      });
    }

    // Add new member
    const result = await pool.query(
      `INSERT INTO user_temples (user_id, temple_id, member_type, role, assigned_by, assigned_at, is_active)
       VALUES ($1, $2, $3, $4, $5, NOW(), true)
       RETURNING id`,
      [userIdValue, templeIdValue, memberTypeValue, role || 'member', req.user?.id]
    );

    return res.status(201).json({
      success: true,
      data: { id: result.rows[0].id },
      message: 'Member added to temple successfully'
    });
  } catch (error) {
    console.error('Error adding member to temple:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add member to temple'
    });
  }
};

/**
 * @route   GET /api/temple-members
 * @desc    Get all members of a temple (for dropdown selection)
 * @access  Private (admin only)
 */
exports.getTempleMembers = async (req, res) => {
  try {
    const { temple_id } = req.query;

    if (!temple_id) {
      return res.status(400).json({
        success: false,
        error: 'temple_id is required'
      });
    }

    const result = await pool.query(
      `WITH temple_users AS (
        -- Primary source: explicit user-temple assignments
        SELECT 
          u.id,
          u.first_name,
          u.last_name,
          u.phone,
          u.email,
          u.dob,
          u.gender,
          COALESCE(to_jsonb(u)->'professions', '[]'::jsonb) as professions,
          COALESCE(u.profile_photo_url, to_jsonb(u)->>'photo_url') as photo_url,
          COALESCE(f.gotra, '') as gotra,
          COALESCE(to_jsonb(ut)->>'member_type', 'society_member') as member_type,
          ut.role,
          COALESCE(f.name, 'No Family') as family_name,
          1 as source_priority
        FROM user_temples ut
        JOIN users u ON u.id = ut.user_id
        LEFT JOIN family_members fm ON fm.user_id = u.id
        LEFT JOIN families f ON f.id = fm.family_id
        WHERE ut.temple_id = $1 
          AND ut.is_active = true
          AND u.is_active = true

        UNION ALL

        -- Fallback source: users linked via family in this temple (for legacy data)
        SELECT
          u.id,
          u.first_name,
          u.last_name,
          u.phone,
          u.email,
          u.dob,
          u.gender,
          COALESCE(to_jsonb(u)->'professions', '[]'::jsonb) as professions,
          COALESCE(u.profile_photo_url, to_jsonb(u)->>'photo_url') as photo_url,
          COALESCE(f.gotra, '') as gotra,
          'society_member' as member_type,
          'member' as role,
          COALESCE(f.name, 'No Family') as family_name,
          2 as source_priority
        FROM users u
        JOIN family_members fm ON fm.user_id = u.id
        JOIN families f ON f.id = fm.family_id
        WHERE f.temple_id = $1
          AND COALESCE((to_jsonb(f)->>'is_active')::boolean, true) = true
          AND u.is_active = true
      )
      SELECT DISTINCT ON (id)
        id,
        first_name || ' ' || COALESCE(last_name, '') as name,
        first_name,
        last_name,
        phone,
        email,
        dob,
        gender,
        professions,
        photo_url,
        gotra,
        member_type,
        role,
        family_name
      FROM temple_users
      ORDER BY id, source_priority, first_name, last_name`,
      [temple_id]
    );

    return res.status(200).json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        name: row.name.trim(),
        firstName: row.first_name,
        lastName: row.last_name,
        phone: row.phone,
        email: row.email,
        dob: row.dob,
        gender: row.gender,
        professions: row.professions || [],
        photoUrl: row.photo_url,
        gotra: row.gotra || '',
        memberType: row.member_type,
        role: row.role,
        familyName: row.family_name
      }))
    });
  } catch (error) {
    console.error('Error fetching temple members:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch temple members'
    });
  }
};

/**
 * @route   DELETE /api/temple-members/:userId
 * @desc    Remove member from temple
 * @access  Private (admin only)
 */
exports.removeMemberFromTemple = async (req, res) => {
  try {
    const { userId } = req.params;
    const { temple_id, templeId } = req.query;

    const templeIdValue = temple_id || templeId;

    if (!templeIdValue) {
      return res.status(400).json({
        success: false,
        error: 'temple_id is required'
      });
    }

    // Soft delete (set is_active = false)
    await pool.query(
      `UPDATE user_temples 
       SET is_active = false 
       WHERE user_id = $1 AND temple_id = $2`,
      [userId, templeIdValue]
    );

    return res.status(200).json({
      success: true,
      message: 'Member removed from temple'
    });
  } catch (error) {
    console.error('Error removing member:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to remove member'
    });
  }
};

/**
 * @route   PUT /api/temple-members/:userId
 * @desc    Update member in temple (role/member_type)
 * @access  Private (admin only)
 */
exports.updateMemberInTemple = async (req, res) => {
  try {
    const { userId } = req.params;
    const { temple_id, templeId, role, member_type, memberType, is_active } = req.body;

    const templeIdValue = temple_id || templeId;
    const memberTypeValue = member_type || memberType;

    if (!templeIdValue) {
      return res.status(400).json({
        success: false,
        error: 'templeId is required'
      });
    }

    // Check if member exists
    const existing = await pool.query(
      `SELECT id FROM user_temples WHERE user_id = $1 AND temple_id = $2`,
      [userId, templeIdValue]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Member not found in this temple'
      });
    }

    const query = `
      UPDATE user_temples
      SET
        role = COALESCE($3, role),
        member_type = COALESCE($4, member_type),
        is_active = COALESCE($5, is_active),
        assigned_at = CASE WHEN $5 = true AND is_active = false THEN NOW() ELSE assigned_at END
      WHERE user_id = $1 AND temple_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [
      userId,
      templeIdValue,
      role,
      memberTypeValue,
      is_active
    ]);

    return res.status(200).json({
      success: true,
      message: 'Member updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating member:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update member'
    });
  }
};

module.exports = exports;
