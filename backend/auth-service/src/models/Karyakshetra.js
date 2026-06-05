const pool = require('../config/database');

class Karyakshetra {
  static async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS karyakshetras (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_karyakshetras_name_active
       ON karyakshetras (lower(name)) WHERE is_active = true`
    );
  }

  static async list({ includeInactive = false } = {}) {
    const result = await pool.query(
      `SELECT id, name, is_active, created_by, created_at, updated_at
       FROM karyakshetras
       WHERE ($1::boolean = true OR is_active = true)
       ORDER BY is_active DESC, name ASC`,
      [Boolean(includeInactive)]
    );
    return result.rows;
  }

  static async create({ name, createdBy }) {
    const safeName = String(name || '').trim();
    if (!safeName) throw new Error('Karyakshetra name is required');

    const duplicate = await pool.query(
      `SELECT id FROM karyakshetras WHERE lower(name) = lower($1) AND is_active = true LIMIT 1`,
      [safeName]
    );
    if (duplicate.rows[0]) throw new Error('Karyakshetra already exists');

    const result = await pool.query(
      `INSERT INTO karyakshetras (name, created_by)
       VALUES ($1, $2)
       RETURNING id, name, is_active, created_by, created_at, updated_at`,
      [safeName, createdBy || null]
    );
    return result.rows[0];
  }

  static async update({ id, name }) {
    const safeId = Number(id);
    const safeName = String(name || '').trim();
    if (!Number.isFinite(safeId) || safeId <= 0) throw new Error('Invalid karyakshetra id');
    if (!safeName) throw new Error('Karyakshetra name is required');

    const duplicate = await pool.query(
      `SELECT id FROM karyakshetras WHERE lower(name) = lower($1) AND is_active = true AND id <> $2 LIMIT 1`,
      [safeName, safeId]
    );
    if (duplicate.rows[0]) throw new Error('Karyakshetra already exists');

    const result = await pool.query(
      `UPDATE karyakshetras
       SET name = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, is_active, created_by, created_at, updated_at`,
      [safeName, safeId]
    );
    if (!result.rows[0]) throw new Error('Karyakshetra not found');
    return result.rows[0];
  }

  static async deactivate({ id }) {
    const safeId = Number(id);
    if (!Number.isFinite(safeId) || safeId <= 0) throw new Error('Invalid karyakshetra id');
    const result = await pool.query(
      `UPDATE karyakshetras
       SET is_active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, is_active, created_by, created_at, updated_at`,
      [safeId]
    );
    if (!result.rows[0]) throw new Error('Karyakshetra not found');
    return result.rows[0];
  }

  static async reactivate({ id }) {
    const safeId = Number(id);
    if (!Number.isFinite(safeId) || safeId <= 0) throw new Error('Invalid karyakshetra id');
    const result = await pool.query(
      `UPDATE karyakshetras
       SET is_active = true, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, is_active, created_by, created_at, updated_at`,
      [safeId]
    );
    if (!result.rows[0]) throw new Error('Karyakshetra not found');
    return result.rows[0];
  }
}

module.exports = Karyakshetra;
