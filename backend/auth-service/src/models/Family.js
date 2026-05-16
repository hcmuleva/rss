/**
 * =====================================================================
 * Family Model
 * Company: emeelan
 * =====================================================================
 * Handles family CRUD operations and temple associations
 */

const pool = require('../config/database');
const { nanoid } = require('nanoid');

class Family {
  /**
   * Initialize families table
   */
  static async initTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS families (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        name_hi VARCHAR(255),
        temple_id INTEGER REFERENCES temples(id) ON DELETE SET NULL,
        gotra VARCHAR(100),
        ancestral_village VARCHAR(255),
        description TEXT,
        description_hi TEXT,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_families_slug ON families(slug);
      CREATE INDEX IF NOT EXISTS idx_families_temple ON families(temple_id);
      CREATE INDEX IF NOT EXISTS idx_families_gotra ON families(gotra);
    `;

    await pool.query(createTableQuery);
    console.log('✅ Families table ready');
  }

  /**
   * Initialize family_temples junction table
   */
  static async initFamilyTemplesTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS family_temples (
        id SERIAL PRIMARY KEY,
        family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
        temple_id INTEGER NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
        is_primary BOOLEAN DEFAULT false,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(family_id, temple_id)
      );

      CREATE INDEX IF NOT EXISTS idx_family_temples_family ON family_temples(family_id);
      CREATE INDEX IF NOT EXISTS idx_family_temples_temple ON family_temples(temple_id);
    `;

    await pool.query(createTableQuery);
    console.log('✅ Family-Temples junction table ready');
  }

  /**
   * Initialize family_members table
   */
  static async initFamilyMembersTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS family_members (
        id SERIAL PRIMARY KEY,
        family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        relation_to_head VARCHAR(100),
        is_head BOOLEAN DEFAULT false,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(family_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_family_members_family ON family_members(family_id);
      CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id);
    `;

    await pool.query(createTableQuery);
    console.log('✅ Family-Members table ready');
  }

  /**
   * Initialize family_heads table for multi-head support
   */
  static async initFamilyHeadsTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS family_heads (
        id SERIAL PRIMARY KEY,
        family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
        family_member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
        is_primary BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(family_id, family_member_id)
      );

      CREATE INDEX IF NOT EXISTS idx_family_heads_family ON family_heads(family_id);
      CREATE INDEX IF NOT EXISTS idx_family_heads_member ON family_heads(family_member_id);
    `;

    await pool.query(createTableQuery);
    console.log('✅ Family-Heads table ready');
  }

  /**
   * Generate unique slug
   */
  static generateSlug() {
    return nanoid(9);
  }

  /**
   * Create new family
   */
  static async create(familyData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const {
        name,
        name_hi,
        temple_id,
        gotra,
        ancestral_village,
        village,
        tehsil,
        district,
        state,
        country,
        pincode,
        latitude,
        longitude,
        description,
        description_hi,
        created_by
      } = familyData;

      let slug = `fam-${this.generateSlug()}`;
      let attempts = 0;

      // Create family
      let family;
      while (attempts < 5) {
        try {
          const query = `
            INSERT INTO families (
              slug, name, name_hi, temple_id, gotra, 
              ancestral_village, village, tehsil, district, state, country,
              pincode, latitude, longitude, description, description_hi, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING *
          `;

          const values = [
            slug, name, name_hi, temple_id, gotra,
            ancestral_village, village, tehsil, district, state, country,
            pincode, latitude, longitude, description, description_hi, created_by
          ];

          const result = await client.query(query, values);
          family = result.rows[0];
          break;
        } catch (error) {
          if (error.code === '23505') { // Unique violation
            slug = this.generateSlug();
            attempts++;
          } else {
            throw error;
          }
        }
      }

      if (!family) {
        throw new Error('Failed to generate unique slug after 5 attempts');
      }

      await client.query('COMMIT');
      return family;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find family by ID
   */
  static async findById(id) {
    const query = `
      SELECT f.*, 
             t.name as primary_temple_name,
             u.first_name || ' ' || COALESCE(u.father_name, '') as creator_name,
             (SELECT COUNT(*) FROM family_members fm WHERE fm.family_id = f.id) as member_count
      FROM families f
      LEFT JOIN temples t ON f.temple_id = t.id
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.id = $1
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length > 0) {
      // Get all temples for this family
      const templesQuery = `
        SELECT t.id, t.slug, t.name, t.location, ft.is_primary
        FROM temples t
        INNER JOIN family_temples ft ON t.id = ft.temple_id
        WHERE ft.family_id = $1
        ORDER BY ft.is_primary DESC
      `;
      const templesResult = await pool.query(templesQuery, [id]);
      result.rows[0].temples = templesResult.rows;
    }
    
    return result.rows[0];
  }

  /**
   * Find family by slug
   */
  static async findBySlug(slug) {
    const query = `
      SELECT f.*, 
             t.name as primary_temple_name,
             u.first_name || ' ' || COALESCE(u.father_name, '') as creator_name,
             (SELECT COUNT(*) FROM family_members fm WHERE fm.family_id = f.id) as member_count
      FROM families f
      LEFT JOIN temples t ON f.temple_id = t.id
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.slug = $1
    `;
    const result = await pool.query(query, [slug]);
    
    if (result.rows.length > 0) {
      // Get all temples for this family
      const templesQuery = `
        SELECT t.id, t.slug, t.name, t.location, ft.is_primary
        FROM temples t
        INNER JOIN family_temples ft ON t.id = ft.temple_id
        WHERE ft.family_id = $1
        ORDER BY ft.is_primary DESC
      `;
      const templesResult = await pool.query(templesQuery, [result.rows[0].id]);
      result.rows[0].temples = templesResult.rows;
    }
    
    return result.rows[0];
  }

  /**
   * Find families by temple
   */
  static async findByTemple(templeId, limit = 50, offset = 0) {
    const query = `
      SELECT DISTINCT f.*, 
             t.name as primary_temple_name,
             u.first_name || ' ' || COALESCE(u.father_name, '') as creator_name,
             (SELECT COUNT(*) FROM family_members fm WHERE fm.family_id = f.id) as member_count
      FROM families f
      LEFT JOIN temples t ON f.temple_id = t.id
      LEFT JOIN users u ON f.created_by = u.id
      INNER JOIN family_temples ft ON f.id = ft.family_id
      WHERE ft.temple_id = $1
      ORDER BY f.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [templeId, limit, offset]);
    return result.rows;
  }

  /**
   * Add member to family
   */
  static async addMember(familyId, userId, relationToHead, isHead = false) {
    const query = `
      INSERT INTO family_members (family_id, user_id, relation_to_head, is_head)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (family_id, user_id) 
      DO UPDATE SET relation_to_head = EXCLUDED.relation_to_head, is_head = EXCLUDED.is_head
      RETURNING *
    `;
    const result = await pool.query(query, [familyId, userId, relationToHead, isHead]);
    return result.rows[0];
  }

  /**
   * Get family members
   */
  static async getMembers(familyId) {
    const query = `
      SELECT u.id, u.slug, u.first_name, u.father_name, u.email, u.gotra, u.dob, u.gender,
             u.is_private_profile,
             fm.relation_to_head, fm.relationship_to_head, fm.is_head, fm.joined_at, fm.photo
      FROM users u
      INNER JOIN family_members fm ON u.id = fm.user_id
      WHERE fm.family_id = $1
      ORDER BY fm.is_head DESC, fm.joined_at ASC
    `;
    const result = await pool.query(query, [familyId]);
    return result.rows;
  }

  /**
   * Update family
   */
  static async update(id, updateData) {
    const allowedFields = [
      'name', 'family_name', 'name_hi', 'temple_id', 'gotra', 
      'ancestral_village', 'village', 'tehsil', 'district', 'state', 'pincode',
      'head_of_family_name', 'phone', 'email',
      'description', 'description_hi'
    ];

    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        const actualKey = key === 'family_name' ? 'name' : key;
        updates.push(`${actualKey} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE families
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Associate family with temple
   */
  static async addTemple(familyId, templeId, isPrimary = false) {
    const query = `
      INSERT INTO family_temples (family_id, temple_id, is_primary)
      VALUES ($1, $2, $3)
      ON CONFLICT (family_id, temple_id) 
      DO UPDATE SET is_primary = EXCLUDED.is_primary
      RETURNING *
    `;
    const result = await pool.query(query, [familyId, templeId, isPrimary]);
    return result.rows[0];
  }

  /**
   * Remove temple association
   */
  static async removeTemple(familyId, templeId) {
    const query = `
      DELETE FROM family_temples
      WHERE family_id = $1 AND temple_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [familyId, templeId]);
    return result.rows[0];
  }

  /**
   * Get head members for a family
   */
  static async getHeads(familyId) {
    const query = `
      SELECT
        fh.id,
        fh.family_id,
        fh.family_member_id,
        fh.is_primary,
        fm.user_id,
        fm.phone,
        fm.photo as photo_url,
        fm.is_head_of_family,
        fm.relationship_to_head,
        u.first_name,
        u.father_name,
        u.gender,
        u.email,
        u.gotra
      FROM family_heads fh
      INNER JOIN family_members fm ON fh.family_member_id = fm.id
      LEFT JOIN users u ON fm.user_id = u.id
      WHERE fh.family_id = $1
      ORDER BY fh.is_primary DESC, fh.id ASC
    `;
    const result = await pool.query(query, [familyId]);
    return result.rows;
  }

  /**
   * Replace all heads for a family
   */
  static async setHeads(familyId, familyMemberIds = [], primaryFamilyMemberId = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const normalizedIds = Array.from(
        new Set(
          (Array.isArray(familyMemberIds) ? familyMemberIds : [])
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0)
        )
      );

      if (normalizedIds.length === 0) {
        await client.query('DELETE FROM family_heads WHERE family_id = $1', [familyId]);
        await client.query('UPDATE family_members SET is_head_of_family = false WHERE family_id = $1', [familyId]);
        await client.query('COMMIT');
        return [];
      }

      const memberCheckQuery = `
        SELECT id
        FROM family_members
        WHERE family_id = $1 AND id = ANY($2::int[])
      `;
      const checkResult = await client.query(memberCheckQuery, [familyId, normalizedIds]);
      const validIds = checkResult.rows.map((row) => Number(row.id));
      if (validIds.length !== normalizedIds.length) {
        throw new Error('One or more head members do not belong to this family');
      }

      const primaryId = Number(primaryFamilyMemberId) || validIds[0];

      await client.query('DELETE FROM family_heads WHERE family_id = $1', [familyId]);
      await client.query('UPDATE family_members SET is_head_of_family = false WHERE family_id = $1', [familyId]);

      for (const memberId of validIds) {
        await client.query(
          `INSERT INTO family_heads (family_id, family_member_id, is_primary)
           VALUES ($1, $2, $3)`,
          [familyId, memberId, memberId === primaryId]
        );
      }

      await client.query(
        `UPDATE family_members
         SET is_head_of_family = true
         WHERE family_id = $1 AND id = ANY($2::int[])`,
        [familyId, validIds]
      );

      await client.query('COMMIT');
      return this.getHeads(familyId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Family;
