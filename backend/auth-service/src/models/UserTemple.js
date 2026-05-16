/**
 * =====================================================================
 * UserTemple Junction Model
 * Company: emeelan
 * =====================================================================
 * Handles many-to-many relationship between users and temples
 */

const pool = require('../config/database');

class UserTemple {
  /**
   * Initialize user_temples junction table
   */
  static async initTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS user_temples (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        temple_id INTEGER NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
        member_type VARCHAR(50) DEFAULT 'society_member',
        role VARCHAR(50) DEFAULT 'member',
        admin_level VARCHAR(50) DEFAULT 'temple',
        assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        UNIQUE(user_id, temple_id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_temples_user ON user_temples(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_temples_temple ON user_temples(temple_id);
      CREATE INDEX IF NOT EXISTS idx_user_temples_active ON user_temples(is_active);
    `;

    await pool.query(createTableQuery);
    await pool.query(`ALTER TABLE IF EXISTS user_temples ADD COLUMN IF NOT EXISTS member_type VARCHAR(50) DEFAULT 'society_member'`);
    await pool.query(`ALTER TABLE IF EXISTS user_temples ADD COLUMN IF NOT EXISTS admin_level VARCHAR(50) DEFAULT 'temple'`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_temples_admin_level ON user_temples(admin_level)`);
    await pool.query(`ALTER TABLE IF EXISTS user_temples ALTER COLUMN member_type SET DEFAULT 'society_member'`);
    console.log('✅ User-Temples junction table ready');
  }

  /**
   * Check if user belongs to temple
   */
  static async userBelongsToTemple(userId, templeId) {
    const query = `
      SELECT * FROM user_temples
      WHERE user_id = $1 AND temple_id = $2 AND is_active = true
    `;
    const result = await pool.query(query, [userId, templeId]);
    return result.rows.length > 0;
  }

  /**
   * Get user's role in temple
   */
  static async getUserTempleRole(userId, templeId) {
    const query = `
      SELECT role FROM user_temples
      WHERE user_id = $1 AND temple_id = $2 AND is_active = true
    `;
    const result = await pool.query(query, [userId, templeId]);
    return result.rows[0]?.role || null;
  }
}

module.exports = UserTemple;
