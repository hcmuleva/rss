/**
 * =====================================================================
 * External Family Utilities
 * Company: emeelan
 * =====================================================================
 * Manages auto-creation and management of external member families
 */

const pool = require('../config/database');

/**
 * Ensure external family exists for a temple
 * Auto-creates if it doesn't exist
 * @param {number} templeId - Temple ID
 * @returns {Promise<number>} External family ID
 */
async function ensureExternalFamily(templeId) {
  try {
    // Check if external family already exists
    let result = await pool.query(
      `SELECT id FROM families 
       WHERE temple_id = $1 AND family_type = 'external_members'
       LIMIT 1`,
      [templeId]
    );

    if (result.rows.length > 0) {
      return result.rows[0].id;
    }

    // Get temple name for family name
    const templeResult = await pool.query(
      `SELECT name FROM temples WHERE id = $1`,
      [templeId]
    );

    if (templeResult.rows.length === 0) {
      throw new Error(`Temple with ID ${templeId} not found`);
    }

    const templeName = templeResult.rows[0].name;
    const familyName = `${templeName} - External Members`;
    const slug = `temple-${templeId}-external-members`;

    // Create external family
    result = await pool.query(
      `INSERT INTO families (
        name, slug, temple_id, family_type, 
        description, created_at, active
      ) VALUES ($1, $2, $3, 'external_members', $4, NOW(), true)
      RETURNING id`,
      [
        familyName,
        slug,
        templeId,
        'Community participants and external donors who are not part of traditional families'
      ]
    );

    console.log(`Created external family for temple ${templeId}: ${familyName}`);
    return result.rows[0].id;
  } catch (error) {
    console.error('Error ensuring external family:', error);
    throw error;
  }
}

/**
 * Add user to temple's external family
 * @param {number} templeId - Temple ID
 * @param {number} userId - User ID
 * @returns {Promise<void>}
 */
async function addUserToExternalFamily(templeId, userId) {
  try {
    const externalFamilyId = await ensureExternalFamily(templeId);

    // Check if user is already in this family
    const exists = await pool.query(
      `SELECT id FROM family_members 
       WHERE family_id = $1 AND user_id = $2`,
      [externalFamilyId, userId]
    );

    if (exists.rows.length > 0) {
      return; // Already a member
    }

    // Add user to external family
    await pool.query(
      `INSERT INTO family_members (
        family_id, user_id, relationship, role, created_at
      ) VALUES ($1, $2, 'external', 'member', NOW())`,
      [externalFamilyId, userId]
    );

    console.log(`Added user ${userId} to external family of temple ${templeId}`);
  } catch (error) {
    console.error('Error adding user to external family:', error);
    throw error;
  }
}

/**
 * Check if a family is an external members family
 * @param {number} familyId - Family ID
 * @returns {Promise<boolean>}
 */
async function isExternalFamily(familyId) {
  const result = await pool.query(
    `SELECT family_type FROM families WHERE id = $1`,
    [familyId]
  );
  return result.rows.length > 0 && result.rows[0].family_type === 'external_members';
}

module.exports = {
  ensureExternalFamily,
  addUserToExternalFamily,
  isExternalFamily
};
