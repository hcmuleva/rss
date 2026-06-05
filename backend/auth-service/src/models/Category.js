const pool = require('../config/database');

const DEFAULT_CATEGORIES = [
  'संस्कृति प्रमुख',
  'निधी प्रमुख',
  'विधी प्रमुख',
  'प्रलेखन प्रमुख',
  'परियोजना प्रमुख',
  'मातृशक्ति T-8',
  'वंशावली प्रमुख',
  'पुर्णकालिक',
];

class Category {
  static async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_active
       ON categories (lower(name)) WHERE is_active = true`
    );
  }

  static async seedDefaults() {
    const existing = await pool.query(`SELECT COUNT(*)::int AS total FROM categories`);
    if (Number(existing.rows[0]?.total || 0) > 0) return;
    for (const name of DEFAULT_CATEGORIES) {
      await pool.query(
        `INSERT INTO categories (name) VALUES ($1) ON CONFLICT DO NOTHING`,
        [name]
      );
    }
  }

  static async list({ includeInactive = false } = {}) {
    const result = await pool.query(
      `SELECT id, name, is_active, created_by, created_at, updated_at
       FROM categories
       WHERE ($1::boolean = true OR is_active = true)
       ORDER BY is_active DESC, name ASC`,
      [Boolean(includeInactive)]
    );
    return result.rows;
  }

  static async findById(id) {
    const safeId = Number(id);
    if (!Number.isFinite(safeId) || safeId <= 0) return null;
    const result = await pool.query(
      `SELECT id, name, is_active, created_by, created_at, updated_at
       FROM categories WHERE id = $1`,
      [safeId]
    );
    return result.rows[0] || null;
  }

  static async create({ name, createdBy }) {
    const safeName = String(name || '').trim();
    if (!safeName) throw new Error('Category name is required');

    const duplicate = await pool.query(
      `SELECT id FROM categories WHERE lower(name) = lower($1) AND is_active = true LIMIT 1`,
      [safeName]
    );
    if (duplicate.rows[0]) throw new Error('Category already exists');

    const result = await pool.query(
      `INSERT INTO categories (name, created_by)
       VALUES ($1, $2)
       RETURNING id, name, is_active, created_by, created_at, updated_at`,
      [safeName, createdBy || null]
    );
    return result.rows[0];
  }

  static async update({ id, name }) {
    const safeId = Number(id);
    const safeName = String(name || '').trim();
    if (!Number.isFinite(safeId) || safeId <= 0) throw new Error('Invalid category id');
    if (!safeName) throw new Error('Category name is required');

    const duplicate = await pool.query(
      `SELECT id FROM categories WHERE lower(name) = lower($1) AND is_active = true AND id <> $2 LIMIT 1`,
      [safeName, safeId]
    );
    if (duplicate.rows[0]) throw new Error('Category already exists');

    const result = await pool.query(
      `UPDATE categories
       SET name = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, is_active, created_by, created_at, updated_at`,
      [safeName, safeId]
    );
    if (!result.rows[0]) throw new Error('Category not found');
    return result.rows[0];
  }

  static async deactivate({ id }) {
    const safeId = Number(id);
    if (!Number.isFinite(safeId) || safeId <= 0) throw new Error('Invalid category id');
    const result = await pool.query(
      `UPDATE categories
       SET is_active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, is_active, created_by, created_at, updated_at`,
      [safeId]
    );
    if (!result.rows[0]) throw new Error('Category not found');
    return result.rows[0];
  }

  static async reactivate({ id }) {
    const safeId = Number(id);
    if (!Number.isFinite(safeId) || safeId <= 0) throw new Error('Invalid category id');
    const result = await pool.query(
      `UPDATE categories
       SET is_active = true, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, is_active, created_by, created_at, updated_at`,
      [safeId]
    );
    if (!result.rows[0]) throw new Error('Category not found');
    return result.rows[0];
  }
}

module.exports = Category;
