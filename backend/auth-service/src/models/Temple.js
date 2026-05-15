/**
 * =====================================================================
 * Temple Model
 * Company: emeelan
 * =====================================================================
 * Handles temple CRUD operations and user associations
 */

const pool = require('../config/database');
const { nanoid } = require('nanoid');

class Temple {
  /**
   * Initialize temples table
   */
  static async initTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS temples (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        name_hi VARCHAR(255),
        location VARCHAR(255),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        pincode VARCHAR(10),
        contact_email VARCHAR(255),
        contact_phone VARCHAR(20),
        description TEXT,
        description_hi TEXT,
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pool.query(createTableQuery);
    
    // Create indexes (skip if they fail)
    try {
      await pool.query('CREATE INDEX IF NOT EXISTS idx_temples_slug ON temples(slug)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_temples_is_active ON temples(is_active)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_temples_location ON temples(location)');
    } catch (indexError) {
      console.log('ℹ️  Index creation skipped (may already exist)');
    }
    
    console.log('✅ Temples table ready');
  }

  /**
   * Generate unique slug
   */
  static generateSlug() {
    return nanoid(9);
  }

  /**
   * Create new temple
   */
  static async create(templeData) {
    const {
      name,
      name_hi,
      location,
      city,
      state,
      district,
      tehsil,
      village,
      pincode,
      landmark,
      contact_email,
      contact_phone,
      photo_url,
      latitude,
      longitude,
      description,
      description_hi,
      created_by
    } = templeData;

    let slug = this.generateSlug();
    let attempts = 0;

    // Handle slug collision
    while (attempts < 5) {
      try {
        const query = `
          INSERT INTO temples (
            slug, name, name_hi, location, city, state, district, tehsil, village, pincode,
            landmark, contact_email, contact_phone, photo_url, latitude, longitude,
            description, description_hi, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          RETURNING *
        `;

        const values = [
          slug, name, name_hi, location, city, state, district, tehsil, village, pincode,
          landmark, contact_email, contact_phone, photo_url, latitude, longitude,
          description, description_hi, created_by
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
      } catch (error) {
        if (error.code === '23505') { // Unique violation
          slug = this.generateSlug();
          attempts++;
        } else {
          throw error;
        }
      }
    }

    throw new Error('Failed to generate unique slug after 5 attempts');
  }

  /**
   * Find temple by ID
   */
  static async findById(id) {
    const query = `
      SELECT t.*, 
             u.first_name || ' ' || COALESCE(u.father_name, '') as creator_name
      FROM temples t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Find temple by slug
   */
  static async findBySlug(slug) {
    const query = `
      SELECT t.*, 
             u.first_name || ' ' || COALESCE(u.father_name, '') as creator_name
      FROM temples t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.slug = $1
    `;
    const result = await pool.query(query, [slug]);
    return result.rows[0];
  }

  /**
   * Find all temples
   */
  static async findAll(filters = {}) {
    const { is_active = true, location, search, limit = 50, offset = 0 } = filters;

    let query = `
      SELECT t.*, 
             u.first_name || ' ' || COALESCE(u.father_name, '') as creator_name,
             (SELECT COUNT(*) FROM user_temples ut WHERE ut.temple_id = t.id AND ut.is_active = true) as member_count
      FROM temples t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE 1=1
    `;

    const values = [];
    let paramCount = 1;

    if (is_active !== undefined) {
      query += ` AND t.is_active = $${paramCount}`;
      values.push(is_active);
      paramCount++;
    }

    if (location) {
      query += ` AND t.location ILIKE $${paramCount}`;
      values.push(`%${location}%`);
      paramCount++;
    }

    if (search) {
      query += ` AND (t.name ILIKE $${paramCount} OR t.location ILIKE $${paramCount})`;
      values.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY t.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);
    return result.rows;
  }

  /**
   * Update temple
   */
  static async update(id, updateData) {
    const allowedFields = [
      'name', 'name_hi', 'location', 'city', 'state', 'district', 'tehsil', 'village', 'pincode',
      'landmark', 'contact_email', 'contact_phone', 'photo_url', 'latitude', 'longitude',
      'description', 'description_hi', 'is_active'
    ];

    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramCount}`);
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
      UPDATE temples
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Delete temple (soft delete)
   */
  static async delete(id) {
    const query = `
      UPDATE temples
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Get temples for a user
   */
  static async getUserTemples(userId) {
    const query = `
      SELECT t.*, ut.role, ut.assigned_at
      FROM temples t
      INNER JOIN user_temples ut ON t.id = ut.temple_id
      WHERE ut.user_id = $1 AND ut.is_active = true AND t.is_active = true
      ORDER BY ut.assigned_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get temple members
   */
  static async getMembers(templeId) {
    const query = `
      SELECT u.id, u.slug, u.first_name, u.father_name, u.email, u.gotra, u.role,
             ut.role as temple_role, ut.assigned_at, ut.assigned_by
      FROM users u
      INNER JOIN user_temples ut ON u.id = ut.user_id
      WHERE ut.temple_id = $1 AND ut.is_active = true
      ORDER BY ut.assigned_at DESC
    `;
    const result = await pool.query(query, [templeId]);
    return result.rows;
  }

  /**
   * Assign user to temple with admin level
   * admin_level: 'temple', 'village', 'tehsil', 'district'
   */
  static async assignUser(templeId, userId, assignedBy, templeRole = 'member', adminLevel = 'temple') {
    const query = `
      INSERT INTO user_temples (temple_id, user_id, role, assigned_by, admin_level)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (temple_id, user_id) 
      DO UPDATE SET is_active = true, role = EXCLUDED.role, assigned_by = EXCLUDED.assigned_by, admin_level = EXCLUDED.admin_level
      RETURNING *
    `;
    const result = await pool.query(query, [templeId, userId, templeRole, assignedBy, adminLevel]);
    return result.rows[0];
  }

  /**
   * Get temples accessible by user based on hierarchical level
   */
  static async getAccessibleTemples(userId) {
    const query = `
      SELECT DISTINCT t.*, 
             COALESCE(ut.admin_level, 'member') as admin_level,
             COALESCE(ut.role, 'member') as role
      FROM temples t
      LEFT JOIN users u ON u.id = $1
      -- Check for inherited family associations
      LEFT JOIN family_temples ft ON t.id = ft.temple_id AND ft.family_id = u.family_id
      -- Check for direct user associations and hierarchical admin scope
      LEFT JOIN user_temples ut ON ut.user_id = $1 AND ut.is_active = true
      LEFT JOIN temples base ON base.id = ut.temple_id
      WHERE t.is_active = true
        AND (
          -- Direct assignment to this specific temple
          t.id = ut.temple_id 
          OR
          -- Family assignment to this specific temple
          ft.id IS NOT NULL
          OR
          -- Hierarchical access (Admin seeing all temples in their assigned scope)
          (ut.admin_level = 'village' AND t.village = base.village AND t.tehsil = base.tehsil AND t.district = base.district)
          OR
          (ut.admin_level = 'tehsil' AND t.tehsil = base.tehsil AND t.district = base.district)
          OR
          (ut.admin_level = 'district' AND t.district = base.district)
        )
      ORDER BY t.created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get admin statistics by geographical levels
   */
  static async getAdminStats() {
    const query = `
      SELECT 
        ut.admin_level,
        COUNT(DISTINCT ut.user_id) as admin_count,
        COUNT(DISTINCT t.district) as district_count,
        COUNT(DISTINCT t.tehsil) as tehsil_count,
        COUNT(DISTINCT t.village) as village_count
      FROM user_temples ut
      INNER JOIN temples t ON ut.temple_id = t.id
      WHERE ut.is_active = true AND ut.role IN ('admin', 'superadmin')
      GROUP BY ut.admin_level
      ORDER BY 
        CASE ut.admin_level
          WHEN 'district' THEN 1
          WHEN 'tehsil' THEN 2
          WHEN 'village' THEN 3
          WHEN 'temple' THEN 4
        END
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Get geographical hierarchy for a temple
   */
  static async getGeographicalHierarchy(district = null, tehsil = null, village = null) {
    let query = `
      SELECT 
        district,
        COUNT(DISTINCT tehsil) as tehsil_count,
        COUNT(DISTINCT village) as village_count,
        COUNT(*) as temple_count
      FROM temples
      WHERE is_active = true
    `;
    
    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (district) {
      conditions.push(`district = $${paramCount}`);
      values.push(district);
      paramCount++;
    }

    if (tehsil) {
      conditions.push(`tehsil = $${paramCount}`);
      values.push(tehsil);
      paramCount++;
    }

    if (village) {
      conditions.push(`village = $${paramCount}`);
      values.push(village);
      paramCount++;
    }

    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }

    query += ` GROUP BY district ORDER BY district`;

    const result = await pool.query(query, values);
    return result.rows;
  }

  /**
   * Remove user from temple
   */
  static async removeUser(templeId, userId) {
    const query = `
      UPDATE user_temples
      SET is_active = false
      WHERE temple_id = $1 AND user_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [templeId, userId]);
    return result.rows[0];
  }
}

module.exports = Temple;
