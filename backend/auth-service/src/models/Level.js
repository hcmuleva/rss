const pool = require('../config/database');

const DEFAULT_LEVELS = [
  { name: 'राष्ट्रीय', code: 'rashtriya' },
  { name: 'प्रान्त', code: 'prant' },
  { name: 'संभाग', code: 'sambhag' },
  { name: 'विभाग', code: 'vibhag' },
  { name: 'जिला', code: 'jila' },
  { name: 'खंड', code: 'khand' },
  { name: 'मंडल', code: 'mandal' },
  { name: 'नगर', code: 'nagar' },
  { name: 'ग्राम', code: 'gram' },
  { name: 'बस्ती', code: 'basti' },
  { name: 'मोहल्ला', code: 'mohalla' },
];

class Level {
  static async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS levels (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(120),
        level_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        is_dynamic BOOLEAN DEFAULT false,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  }

  static async seedDefaults() {
    const existing = await pool.query(`SELECT COUNT(*)::int AS total FROM levels`);
    if (Number(existing.rows[0]?.total || 0) > 0) return;
    let order = 1;
    for (const entry of DEFAULT_LEVELS) {
      await pool.query(
        `INSERT INTO levels (name, code, level_order, is_dynamic) VALUES ($1, $2, $3, $4)`,
        [entry.name, entry.code, order, false]
      );
      order += 1;
    }
  }

  static async list({ includeInactive = false } = {}) {
    const result = await pool.query(
      `SELECT l.id, l.name, l.code, l.level_order, l.is_active, l.is_dynamic, l.created_at, l.updated_at,
              COALESCE(pc.cnt, 0)::int AS place_count,
              COALESCE(cc.cnt, 0)::int AS child_level_count
       FROM levels l
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS cnt FROM karyakarini_nodes n
         WHERE l.code IS NOT NULL AND LOWER(n.level) = LOWER(l.code)
       ) pc ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(DISTINCT lc.child_level) AS cnt FROM level_constraints lc
         WHERE l.code IS NOT NULL AND LOWER(lc.parent_level) = LOWER(l.code)
       ) cc ON true
       WHERE ($1::boolean = true OR l.is_active = true)
       ORDER BY l.level_order ASC, l.id ASC`,
      [Boolean(includeInactive)]
    );
    return result.rows;
  }

  // Counts what would block a delete: places (nodes) using this level's code,
  // and child levels that name this level as a parent in the constraint rules.
  static async usage({ id }) {
    const safeId = Number(id);
    if (!Number.isFinite(safeId) || safeId <= 0) throw new Error('Invalid level id');
    const lvlResult = await pool.query(`SELECT id, name, code FROM levels WHERE id = $1`, [safeId]);
    const level = lvlResult.rows[0];
    if (!level) return null;

    let placeCount = 0;
    let childLevelCount = 0;
    if (level.code) {
      const code = String(level.code).toLowerCase();
      try {
        const p = await pool.query(
          `SELECT COUNT(*)::int AS cnt FROM karyakarini_nodes WHERE LOWER(level) = $1`,
          [code]
        );
        placeCount = Number(p.rows[0]?.cnt || 0);
      } catch (err) {
        placeCount = 0;
      }
      const c = await pool.query(
        `SELECT COUNT(DISTINCT child_level)::int AS cnt FROM level_constraints WHERE LOWER(parent_level) = $1`,
        [code]
      );
      childLevelCount = Number(c.rows[0]?.cnt || 0);
    }
    return { level, placeCount, childLevelCount };
  }

  static async create({ name, code, isDynamic, createdBy }) {
    const safeName = String(name || '').trim();
    if (!safeName) throw new Error('Level name is required');
    const safeCode = String(code || '').trim().toLowerCase() || null;

    if (safeCode) {
      const dup = await pool.query(
        `SELECT 1 FROM levels WHERE LOWER(code) = $1 AND is_active = true LIMIT 1`,
        [safeCode]
      );
      if (dup.rows[0]) throw new Error('इस कोड का स्तर पहले से मौजूद है');
    }

    const maxResult = await pool.query(`SELECT COALESCE(MAX(level_order), 0) AS max_order FROM levels`);
    const nextOrder = Number(maxResult.rows[0]?.max_order || 0) + 1;

    const result = await pool.query(
      `INSERT INTO levels (name, code, level_order, is_dynamic, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, code, level_order, is_active, is_dynamic, created_at, updated_at`,
      [safeName, safeCode, nextOrder, Boolean(isDynamic), createdBy || null]
    );
    return result.rows[0];
  }

  static async update({ id, name }) {
    const safeId = Number(id);
    const safeName = String(name || '').trim();
    if (!Number.isFinite(safeId) || safeId <= 0) throw new Error('Invalid level id');
    if (!safeName) throw new Error('Level name is required');
    const result = await pool.query(
      `UPDATE levels SET name = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, name, code, level_order, is_active, is_dynamic, created_at, updated_at`,
      [safeName, safeId]
    );
    if (!result.rows[0]) throw new Error('Level not found');
    return result.rows[0];
  }

  static async move({ id, direction }) {
    const safeId = Number(id);
    if (!Number.isFinite(safeId) || safeId <= 0) throw new Error('Invalid level id');
    const dir = direction === 'up' ? 'up' : 'down';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const currentRes = await client.query(
        `SELECT id, level_order FROM levels WHERE id = $1 AND is_active = true`,
        [safeId]
      );
      const current = currentRes.rows[0];
      if (!current) throw new Error('Level not found');

      const neighborRes = await client.query(
        dir === 'up'
          ? `SELECT id, level_order FROM levels
             WHERE is_active = true AND level_order < $1
             ORDER BY level_order DESC LIMIT 1`
          : `SELECT id, level_order FROM levels
             WHERE is_active = true AND level_order > $1
             ORDER BY level_order ASC LIMIT 1`,
        [current.level_order]
      );
      const neighbor = neighborRes.rows[0];
      if (neighbor) {
        await client.query(`UPDATE levels SET level_order = $1, updated_at = NOW() WHERE id = $2`, [
          neighbor.level_order,
          current.id,
        ]);
        await client.query(`UPDATE levels SET level_order = $1, updated_at = NOW() WHERE id = $2`, [
          current.level_order,
          neighbor.id,
        ]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return this.list({ includeInactive: false });
  }

  static async deactivate({ id }) {
    const safeId = Number(id);
    if (!Number.isFinite(safeId) || safeId <= 0) throw new Error('Invalid level id');
    const result = await pool.query(
      `UPDATE levels SET is_active = false, updated_at = NOW() WHERE id = $1
       RETURNING id, name, code, level_order, is_active, is_dynamic, created_at, updated_at`,
      [safeId]
    );
    if (!result.rows[0]) throw new Error('Level not found');
    return result.rows[0];
  }

  static async reactivate({ id }) {
    const safeId = Number(id);
    if (!Number.isFinite(safeId) || safeId <= 0) throw new Error('Invalid level id');
    const result = await pool.query(
      `UPDATE levels SET is_active = true, updated_at = NOW() WHERE id = $1
       RETURNING id, name, code, level_order, is_active, is_dynamic, created_at, updated_at`,
      [safeId]
    );
    if (!result.rows[0]) throw new Error('Level not found');
    return result.rows[0];
  }

  static async remove({ id }) {
    const safeId = Number(id);
    if (!Number.isFinite(safeId) || safeId <= 0) throw new Error('Invalid level id');
    const result = await pool.query(
      `DELETE FROM levels WHERE id = $1 RETURNING id, name, code`,
      [safeId]
    );
    if (!result.rows[0]) throw new Error('Level not found');
    return result.rows[0];
  }
}

module.exports = Level;
