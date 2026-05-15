/**
 * =====================================================================
 * Family Member Auth Controller
 * Company: emeelan
 * =====================================================================
 * Allows logged-in users to update email/password for their family members
 * (parents, siblings, children only)
 */

const bcrypt = require('bcrypt');
const pool = require('../config/database');
const axios = require('axios');

const FAMILY_SERVICE_URL = process.env.FAMILY_SERVICE_URL || 'http://localhost:4003';

/**
 * Get family tree members WITHOUT user accounts
 * These are tree nodes that can be activated
 */
exports.getTreeMembersWithoutAccounts = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT 
        fm.id,
        fm.neo4j_person_id,
        fm.relationship_to_head,
        fm.relationship_with_neo4j_id,
        f.name as family_name,
        f.id as family_id
      FROM family_members fm
      JOIN families f ON fm.family_id = f.id
      WHERE fm.family_id = (
        SELECT family_id FROM family_members WHERE user_id = $1
      )
      AND fm.user_id IS NULL
      ORDER BY 
        CASE fm.relationship_to_head
          WHEN 'father' THEN 1
          WHEN 'mother' THEN 2
          WHEN 'brother' THEN 3
          WHEN 'sister' THEN 4
          WHEN 'son' THEN 5
          WHEN 'daughter' THEN 6
          WHEN 'spouse' THEN 7
          ELSE 8
        END,
        fm.id;
    `;

    const result = await pool.query(query, [userId]);
    
    console.log(`Found ${result.rows.length} tree members without accounts for user ${userId}`);

    // Fetch person details from Neo4j for each member
    const membersWithDetails = await Promise.all(
      result.rows.map(async (member) => {
        if (member.neo4j_person_id) {
          try {
            const url = `${FAMILY_SERVICE_URL}/api/families/person/${member.neo4j_person_id}`;
            console.log(`Fetching person details from: ${url}`);
            
            const response = await axios.get(url);
            
            console.log(`Response for ${member.neo4j_person_id}:`, response.data);
            
            if (response.data.success) {
              return {
                ...member,
                first_name: response.data.data.firstName,
                father_name: response.data.data.fatherName,
                gender: response.data.data.gender,
                dob: response.data.data.dob,
                marital_status: response.data.data.maritalStatus
              };
            }
          } catch (error) {
            console.error(`Failed to fetch details for ${member.neo4j_person_id}:`, {
              url: `${FAMILY_SERVICE_URL}/api/families/person/${member.neo4j_person_id}`,
              error: error.response?.data || error.message,
              stack: error.stack
            });
          }
        }
        return member;
      })
    );

    res.json({
      success: true,
      data: membersWithDetails,
      message: `Found ${result.rows.length} family tree members without accounts`
    });
  } catch (error) {
    console.error('Error fetching tree members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tree members',
      error: error.message
    });
  }
};

/**
 * Get family members that current user can manage
 * (parents, siblings, children)
 */
exports.getManageableFamilyMembers = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's family tree relationships
    // First, get all members in the same family (excluding self)
    const query = `
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.father_name,
        u.dob,
        u.is_private_profile,
        fm.relationship_to_head,
        fm.neo4j_person_id,
        f.name as family_name
      FROM users u
      JOIN family_members fm ON u.id = fm.user_id
      JOIN families f ON fm.family_id = f.id
      WHERE fm.family_id = (
        SELECT family_id FROM family_members WHERE user_id = $1
      )
      AND u.id != $1
      ORDER BY 
        CASE fm.relationship_to_head
          WHEN 'father' THEN 1
          WHEN 'mother' THEN 2
          WHEN 'sibling' THEN 3
          WHEN 'child' THEN 4
          WHEN 'head' THEN 5
          ELSE 6
        END,
        u.first_name;
    `;

    const result = await pool.query(query, [userId]);
    
    console.log(`Found ${result.rows.length} family members for user ${userId}`);

    res.json({
      success: true,
      data: result.rows,
      message: `Found ${result.rows.length} manageable family members`
    });
  } catch (error) {
    console.error('Error fetching manageable family members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch family members',
      error: error.message
    });
  }
};

/**
 * Resolve user IDs by email list (for family-tree members with app accounts)
 */
exports.resolveUserIdsByEmails = async (req, res) => {
  try {
    const emails = Array.isArray(req.body?.emails) ? req.body.emails : [];
    const normalized = emails
      .map((e) => String(e || '').trim().toLowerCase())
      .filter(Boolean);

    if (!normalized.length) {
      return res.json({ success: true, data: [] });
    }

    const result = await pool.query(
      `SELECT id, email FROM users WHERE LOWER(email) = ANY($1::text[])`,
      [normalized]
    );

    res.json({
      success: true,
      data: result.rows.map((r) => ({ id: r.id, email: r.email })),
    });
  } catch (error) {
    console.error('Error resolving user ids by emails:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve users',
      error: error.message,
    });
  }
};

/**
 * Update email for a family member
 */
exports.updateFamilyMemberEmail = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.id;
    const { familyMemberId, newEmail } = req.body;

    if (!familyMemberId || !newEmail) {
      return res.status(400).json({
        success: false,
        message: 'Family member ID and new email are required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    await client.query('BEGIN');

    // Verify user has permission to update this family member
    const permissionCheck = await client.query(`
      SELECT 
        u1.id as requester_id,
        u2.id as target_id,
        u2.email as current_email,
        fm1.family_id,
        fm2.relationship_to_head
      FROM users u1
      JOIN family_members fm1 ON u1.id = fm1.user_id
      JOIN family_members fm2 ON fm1.family_id = fm2.family_id
      JOIN users u2 ON fm2.user_id = u2.id
      WHERE u1.id = $1 
        AND u2.id = $2
        AND fm2.relationship_to_head IN ('father', 'mother', 'sibling', 'child')
    `, [userId, familyMemberId]);

    if (permissionCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this family member'
      });
    }

    // Check if new email already exists
    const emailExists = await client.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [newEmail, familyMemberId]
    );

    if (emailExists.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    const currentEmail = permissionCheck.rows[0].current_email;

    // Update email
    const updateResult = await client.query(
      `UPDATE users 
       SET email = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING id, email, first_name`,
      [newEmail, familyMemberId]
    );

    // Log the change
    await client.query(
      `INSERT INTO user_credentials_log (
        user_id, 
        family_member_id, 
        action, 
        old_value, 
        new_value, 
        changed_by
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        familyMemberId,
        familyMemberId,
        'email_update',
        currentEmail,
        newEmail,
        userId
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      data: updateResult.rows[0],
      message: 'Email updated successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating family member email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update email',
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * Update password for a family member
 */
exports.updateFamilyMemberPassword = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.id;
    const { familyMemberId, newPassword } = req.body;

    if (!familyMemberId || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Family member ID and new password are required'
      });
    }

    // Password validation
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    await client.query('BEGIN');

    // Verify user has permission to update this family member
    const permissionCheck = await client.query(`
      SELECT 
        u1.id as requester_id,
        u2.id as target_id,
        u2.first_name,
        fm1.family_id,
        fm2.relationship_to_head
      FROM users u1
      JOIN family_members fm1 ON u1.id = fm1.user_id
      JOIN family_members fm2 ON fm1.family_id = fm2.family_id
      JOIN users u2 ON fm2.user_id = u2.id
      WHERE u1.id = $1 
        AND u2.id = $2
        AND fm2.relationship_to_head IN ('father', 'mother', 'sibling', 'child')
    `, [userId, familyMemberId]);

    if (permissionCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this family member'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    const updateResult = await client.query(
      `UPDATE users 
       SET password_hash = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING id, email, first_name`,
      [hashedPassword, familyMemberId]
    );

    // Log the change
    await client.query(
      `INSERT INTO user_credentials_log (
        user_id, 
        family_member_id, 
        action, 
        old_value, 
        new_value, 
        changed_by
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        familyMemberId,
        familyMemberId,
        'password_update',
        'hidden',
        'hidden',
        userId
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      data: updateResult.rows[0],
      message: 'Password updated successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating family member password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update password',
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * Bulk update email and password for a family member
 */
exports.updateFamilyMemberCredentials = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.id;
    const { familyMemberId, newEmail, newPassword } = req.body;

    if (!familyMemberId) {
      return res.status(400).json({
        success: false,
        message: 'Family member ID is required'
      });
    }

    if (!newEmail && !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'At least email or password must be provided'
      });
    }

    // Validate email if provided
    if (newEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }
    }

    // Validate password if provided
    if (newPassword && newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    await client.query('BEGIN');

    // Verify permission
    const permissionCheck = await client.query(`
      SELECT 
        u1.id as requester_id,
        u2.id as target_id,
        u2.email as current_email,
        u2.first_name,
        fm1.family_id,
        fm2.relationship_to_head
      FROM users u1
      JOIN family_members fm1 ON u1.id = fm1.user_id
      JOIN family_members fm2 ON fm1.family_id = fm2.family_id
      JOIN users u2 ON fm2.user_id = u2.id
      WHERE u1.id = $1 
        AND u2.id = $2
        AND fm2.relationship_to_head IN ('father', 'mother', 'sibling', 'child')
    `, [userId, familyMemberId]);

    if (permissionCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this family member'
      });
    }

    const currentEmail = permissionCheck.rows[0].current_email;
    const updates = [];
    const params = [];
    let paramCounter = 1;

    // Check if new email already exists
    if (newEmail && newEmail !== currentEmail) {
      const emailExists = await client.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [newEmail, familyMemberId]
      );

      if (emailExists.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }

      updates.push(`email = $${paramCounter}`);
      params.push(newEmail);
      paramCounter++;
    }

    if (newPassword) {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      updates.push(`password_hash = $${paramCounter}`);
      params.push(hashedPassword);
      paramCounter++;
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'No changes to update'
      });
    }

    updates.push(`updated_at = NOW()`);
    params.push(familyMemberId);

    // Update user
    const updateQuery = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCounter}
      RETURNING id, email, first_name
    `;

    const updateResult = await client.query(updateQuery, params);

    // Log changes
    if (newEmail) {
      await client.query(
        `INSERT INTO user_credentials_log (
          user_id, family_member_id, action, old_value, new_value, changed_by
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [familyMemberId, familyMemberId, 'email_update', currentEmail, newEmail, userId]
      );
    }

    if (newPassword) {
      await client.query(
        `INSERT INTO user_credentials_log (
          user_id, family_member_id, action, old_value, new_value, changed_by
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [familyMemberId, familyMemberId, 'password_update', 'hidden', 'hidden', userId]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      data: updateResult.rows[0],
      message: 'Credentials updated successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating family member credentials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update credentials',
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * Create user account for a family tree member
 */
exports.createAccountForFamilyMember = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.id;
    const { familyMemberId, email, password, requirePasswordChange } = req.body;

    // Validation
    if (!familyMemberId || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Family member ID, email, and password are required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    await client.query('BEGIN');

    // 1. Get family_member record and verify permissions
    const memberQuery = await client.query(`
      SELECT fm.*, f.name as family_name
      FROM family_members fm
      JOIN families f ON fm.family_id = f.id
      WHERE fm.id = $1 
        AND fm.family_id = (
          SELECT family_id FROM family_members WHERE user_id = $2
        )
        AND fm.user_id IS NULL
    `, [familyMemberId, userId]);

    if (memberQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Family member not found, not in your family, or already has an account'
      });
    }

    const member = memberQuery.rows[0];

    // 2. Check email doesn't already exist
    const emailCheck = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (emailCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Email already in use by another account'
      });
    }

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Create user account
    const userResult = await client.query(`
      INSERT INTO users (
        email,
        password_hash,
        first_name,
        father_name,
        gender,
        dob,
        marital_status,
        family_id,
        neo4j_person_id,
        must_change_password,
        account_created_by,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING id, email, first_name, father_name
    `, [
      email,
      hashedPassword,
      member.first_name || 'User',
      member.father_name,
      member.gender,
      member.dob,
      member.marital_status || 'unmarried',
      member.family_id || null,
      member.neo4j_person_id || null,
      requirePasswordChange !== false,
      userId
    ]);

    const newUser = userResult.rows[0];

    // 5. Link user_id to family_member record
    await client.query(
      'UPDATE family_members SET user_id = $1 WHERE id = $2',
      [newUser.id, familyMemberId]
    );

    // 6. Log the action in audit trail
    await client.query(`
      INSERT INTO user_credentials_log (
        user_id,
        family_member_id,
        action,
        new_value,
        changed_by,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      newUser.id,
      familyMemberId,
      'account_created',
      JSON.stringify({ 
        email,
        requirePasswordChange: requirePasswordChange !== false,
        created_for: member.first_name 
      }),
      userId
    ]);

    await client.query('COMMIT');

    console.log(`Account created: ${email} for family member ${member.first_name} by user ${userId}`);

    res.json({
      success: true,
      data: {
        user: newUser,
        message: requirePasswordChange !== false 
          ? 'Account created. User must change password on first login.'
          : 'Account created successfully.'
      },
      message: 'Account created successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating account:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create account',
      error: error.message
    });
  } finally {
    client.release();
  }
};
