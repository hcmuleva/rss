/**
 * =====================================================================
 * User Model
 * Company: emeelan
 * =====================================================================
 */

const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const { customAlphabet } = require('nanoid');

class User {
  static COUNTRY_CODE = 'IN';
  static STATE_CODE = 'MP';

  static normalizeDistrictCode(districtCode) {
    const digits = String(districtCode || '').replace(/\D/g, '');
    return digits ? digits.padStart(2, '0').slice(-2) : '00';
  }

  static buildSeerviCardId(districtCode, suffixNumber) {
    const district = this.normalizeDistrictCode(districtCode);
    const suffix = String(Math.abs(Number(suffixNumber || 0)) % 10000).padStart(4, '0');
    return `${this.COUNTRY_CODE}-${this.STATE_CODE}-${district}${suffix}`;
  }

  static async generateUniqueSeerviCardId(userId, districtCode) {
    const district = this.normalizeDistrictCode(districtCode);

    for (let attempt = 0; attempt < 10000; attempt++) {
      const candidate = this.buildSeerviCardId(district, userId + attempt);
      const exists = await pool.query('SELECT 1 FROM users WHERE seervi_card_id = $1 LIMIT 1', [
        candidate,
      ]);

      if (exists.rows.length === 0) {
        return candidate;
      }
    }

    throw new Error('Unable to generate unique Seervi card id');
  }

  static async assignSeerviCardId(userId, districtCode) {
    const cardId = await this.generateUniqueSeerviCardId(userId, districtCode);
    await pool.query(
      `UPDATE users
       SET district_code = $1,
           seervi_card_id = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [this.normalizeDistrictCode(districtCode), cardId, userId]
    );
    return cardId;
  }

  /**
   * Generate unique slug for user
   * Using URL-safe characters (no confusing chars like 0/O, 1/l/I)
   */
  static generateSlug() {
    // Custom alphabet: no confusing characters
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
    const nanoid = customAlphabet(alphabet, 9); // 9 chars = 121 trillion combinations
    return nanoid();
  }

  /**
   * Create users table if not exists
   */
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        father_name VARCHAR(100) NOT NULL,
        dob DATE NOT NULL,
        gotra VARCHAR(50) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        gender VARCHAR(10),
        marital_status VARCHAR(20),
        husband_name VARCHAR(100),
        occupation VARCHAR(100),
        profile_photo_url TEXT,
        district_code VARCHAR(2) DEFAULT '00',
        seervi_card_id VARCHAR(20) UNIQUE,
        assignment_level VARCHAR(30) DEFAULT 'village',
        state VARCHAR(100),
        district VARCHAR(100),
        tehsil VARCHAR(100),
        village VARCHAR(150),
        is_active BOOLEAN DEFAULT true,
        terms_accepted BOOLEAN DEFAULT false,
        terms_accepted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        phone VARCHAR(20)
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_gotra ON users(gotra);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    `;

    try {
      await pool.query(query);
      console.log('✅ Users table ready');
      
      // Add slug column if it doesn't exist (for new installations)
      await this.ensureSlugColumn();
      await this.ensureSeerviColumns();
    } catch (error) {
      console.error('❌ Error creating users table:', error);
      throw error;
    }
  }

  /**
   * Ensure slug column exists (for migrations)
   */
  static async ensureSlugColumn() {
    try {
      // Check if slug column exists
      const checkQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='users' AND column_name='slug';
      `;
      
      const result = await pool.query(checkQuery);
      
      if (result.rows.length === 0) {
        console.log('🔄 Running slug migration...');
        const { addSlugColumn } = require('../migrations/add-slug-column');
        await addSlugColumn();
      }
      
      // Generate slugs for existing users without slugs
      await this.generateMissingSlugs();
    } catch (error) {
      console.log('⚠️ Slug column check skipped (table might not exist yet)');
    }
  }

  /**
   * Generate slugs for existing users that don't have one
   */
  static async generateMissingSlugs() {
    try {
      const query = `SELECT id FROM users WHERE slug = '' OR slug IS NULL`;
      const result = await pool.query(query);
      
      if (result.rows.length > 0) {
        console.log(`🔄 Generating slugs for ${result.rows.length} existing users...`);
        
        for (const row of result.rows) {
          const slug = this.generateSlug();
          await pool.query('UPDATE users SET slug = $1 WHERE id = $2', [slug, row.id]);
        }
        
        console.log(`✅ Generated ${result.rows.length} slugs`);
      }
    } catch (error) {
      console.log('⚠️ Could not generate missing slugs (table might not exist yet)');
    }
  }

  static async ensureSeerviColumns() {
    const alterQuery = `
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS gender VARCHAR(10),
      ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20),
      ADD COLUMN IF NOT EXISTS husband_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS occupation VARCHAR(100),
      ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
      ADD COLUMN IF NOT EXISTS district_code VARCHAR(2) DEFAULT '00',
      ADD COLUMN IF NOT EXISTS seervi_card_id VARCHAR(20),
      ADD COLUMN IF NOT EXISTS assignment_level VARCHAR(30) DEFAULT 'village',
      ADD COLUMN IF NOT EXISTS state VARCHAR(100),
      ADD COLUMN IF NOT EXISTS district VARCHAR(100),
      ADD COLUMN IF NOT EXISTS tehsil VARCHAR(100),
      ADD COLUMN IF NOT EXISTS village VARCHAR(150),
      ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
    `;

    await pool.query(alterQuery);
    await pool.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_seervi_card_id ON users(seervi_card_id) WHERE seervi_card_id IS NOT NULL'
    );
    await this.backfillSeerviCardIds();
  }

  static async backfillSeerviCardIds() {
    const result = await pool.query(
      `SELECT id, district_code
       FROM users
       WHERE seervi_card_id IS NULL OR seervi_card_id = ''`
    );

    for (const row of result.rows) {
      await this.assignSeerviCardId(row.id, row.district_code);
    }
  }

  /**
   * Create a new user
   */
  static async create(userData) {
    const {
      firstName,
      fatherName,
      dob,
      gotra,
      email,
      password,
      role = 'user',
      gender = null,
      maritalStatus = null,
      husbandName = null,
      districtCode = '00',
      assignmentLevel = 'village',
      state = null,
      district = null,
      tehsil = null,
      village = null,
      phone = null,
    } = userData;

    // Generate unique slug
    const slug = this.generateSlug();

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const query = `
      INSERT INTO users (
        slug, first_name, father_name, dob, gotra, email, password_hash, role, gender,
        marital_status, husband_name, district_code, terms_accepted, terms_accepted_at,
        assignment_level, state, district, tehsil, village, phone
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, $14, $15, $16, $17, $18, $19)
      RETURNING id, slug, first_name, father_name, dob, gotra, email, role, gender, marital_status, husband_name, district_code, seervi_card_id, 
                assignment_level, state, district, tehsil, village, phone, created_at
    `;

    const values = [
      slug,
      firstName,
      fatherName,
      dob,
      gotra,
      email.toLowerCase(),
      passwordHash,
      role,
      gender,
      maritalStatus,
      husbandName,
      this.normalizeDistrictCode(districtCode),
      true,
      assignmentLevel,
      state,
      district,
      tehsil,
      village,
      phone,
    ];

    try {
      const result = await pool.query(query, values);
      const user = result.rows[0];
      if (!user.seervi_card_id) {
        user.seervi_card_id = await this.assignSeerviCardId(user.id, user.district_code);
      }
      return user;
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        if (error.constraint === 'users_email_key') {
          throw new Error('Email already exists');
        } else if (error.constraint === 'users_slug_key') {
          // Extremely rare: slug collision, retry with new slug
          console.warn('⚠️ Slug collision detected, retrying...');
          return this.create(userData);
        }
      }
      throw error;
    }
  }

  /**
   * Find user by email
   */
  static async findByEmail(email) {
    const query = `
      SELECT id, slug, first_name, father_name, dob, gotra, email, password_hash, 
             role, gender, marital_status, husband_name, occupation, profile_photo_url,
             district_code, seervi_card_id,
             assignment_level, state, district, tehsil, village,
             is_active, created_at, last_login, phone
      FROM users
      WHERE email = $1
    `;

    const result = await pool.query(query, [email.toLowerCase()]);
    return result.rows[0];
  }

  /**
   * Find user by login identifier (email, phone, seervi card, slug, or numeric id)
   */
  static async findByIdentifier(identifier) {
    const raw = String(identifier || '').trim();
    if (!raw) return null;

    const query = `
      SELECT id, slug, first_name, father_name, dob, gotra, email, password_hash, 
             role, gender, marital_status, husband_name, occupation, profile_photo_url,
             district_code, seervi_card_id,
             assignment_level, state, district, tehsil, village,
             is_active, created_at, last_login, phone
      FROM users
      WHERE LOWER(email) = LOWER($1)
         OR phone = $1
         OR LOWER(seervi_card_id) = LOWER($1)
         OR LOWER(slug) = LOWER($1)
         OR CAST(id AS TEXT) = $1
      LIMIT 1
    `;

    const result = await pool.query(query, [raw]);
    return result.rows[0] || null;
  }

  /**
   * Find user by ID (internal use - fast)
   */
  static async findById(id) {
    const query = `
      SELECT id, slug, first_name, father_name, dob, gotra, email, 
             role, gender, marital_status, husband_name, occupation, profile_photo_url,
             district_code, seervi_card_id,
             assignment_level, state, district, tehsil, village,
             is_active, created_at, last_login
      FROM users
      WHERE id = $1
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Find user by Slug (public API - secure)
   */
  static async findBySlug(slug) {
    const query = `
      SELECT id, slug, first_name, father_name, dob, gotra, email, 
             role, gender, marital_status, husband_name, occupation, profile_photo_url,
             district_code, seervi_card_id,
             assignment_level, state, district, tehsil, village,
             is_active, created_at, last_login
      FROM users
      WHERE slug = $1
    `;

    const result = await pool.query(query, [slug]);
    return result.rows[0];
  }

  /**
   * Verify password
   */
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Update last login
   */
  static async updateLastLogin(userId) {
    const query = `
      UPDATE users
      SET last_login = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    await pool.query(query, [userId]);
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId, updates) {
    const { firstName, fatherName, dob, gotra } = updates;

    const query = `
      UPDATE users
      SET first_name = $1, father_name = $2, dob = $3, gotra = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING id, slug, first_name, father_name, dob, gotra, email, role, district_code, seervi_card_id, 
                assignment_level, state, district, tehsil, village, phone
    `;

    const result = await pool.query(query, [firstName, fatherName, dob, gotra, userId]);
    return result.rows[0];
  }

  /**
   * Get all users (admin only)
   */
  static async findAll(filters = {}) {
    const { state, district, tehsil, village, role } = filters;
    const values = [];
    const conditions = [];
    let paramIndex = 1;

    if (state) {
      conditions.push(`state = $${paramIndex++}`);
      values.push(state);
    }
    if (district) {
      conditions.push(`district = $${paramIndex++}`);
      values.push(district);
    }
    if (tehsil) {
      conditions.push(`tehsil = $${paramIndex++}`);
      values.push(tehsil);
    }
    if (village) {
      conditions.push(`village = $${paramIndex++}`);
      values.push(village);
    }
    if (role) {
      conditions.push(`role = $${paramIndex++}`);
      values.push(role);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT id, slug, first_name, father_name, dob, gotra, email, role, 
             gender, marital_status, husband_name, occupation, district_code, seervi_card_id,
             assignment_level, state, district, tehsil, village,
             is_active, created_at, last_login
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, values);
    return result.rows;
  }

  /**
   * Update user role (superadmin only)
   */
  static async updateRole(userId, newRole) {
    const query = `
      UPDATE users
      SET role = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, slug, first_name, father_name, email, role
    `;

    const result = await pool.query(query, [newRole, userId]);
    return result.rows[0];
  }

  /**
   * Seed superadmin user
   */
  static async seedSuperAdmin() {
    try {
      const superAdminConfig = {
        firstName: process.env.SUPERADMIN_FIRST_NAME || 'Harish',
        fatherName: process.env.SUPERADMIN_FATHER_NAME || 'Muleva',
        dob: process.env.SUPERADMIN_DOB || '1990-01-01',
        gotra: process.env.SUPERADMIN_GOTRA || 'Muleva',
        email: process.env.SUPERADMIN_EMAIL || 'harish@emeelan.com',
        password: process.env.SUPERADMIN_PASSWORD || 'welcome',
      };

      // Check if superadmin exists
      const existing = await this.findByEmail(superAdminConfig.email);
      if (existing) {
        if (existing.role !== 'superadmin') {
          await this.updateRole(existing.id, 'superadmin');
          console.log(`✅ Existing user promoted to SuperAdmin: ${superAdminConfig.email}`);
        } else {
          console.log('✅ SuperAdmin already exists');
        }
        return existing;
      }

      // Create superadmin
      const superAdmin = await this.create({
        ...superAdminConfig,
        role: 'superadmin',
      });

      console.log(`✅ SuperAdmin user created: ${superAdminConfig.email}`);
      return superAdmin;
    } catch (error) {
      console.error('❌ Error seeding superadmin:', error);
      throw error;
    }
  }
}

module.exports = User;
