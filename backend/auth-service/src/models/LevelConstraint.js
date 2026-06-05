const pool = require('../config/database');

// child_level can sit under parent_level. parent_level NULL means the level
// is allowed to be a root node (no parent).
const DEFAULT_CONSTRAINTS = [
  ['rashtriya', null],
  ['prant', 'rashtriya'],
  ['sambhag', 'prant'],
  ['vibhag', 'sambhag'],
  ['jila', 'vibhag'],
  ['khand', 'jila'],
  ['mandal', 'khand'],
  ['nagar', 'khand'],
  ['gram', 'mandal'],
  ['basti', 'nagar'],
  ['mohalla', 'basti'],
];

class LevelConstraint {
  static async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS level_constraints (
        id SERIAL PRIMARY KEY,
        child_level VARCHAR(120) NOT NULL,
        parent_level VARCHAR(120),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_level_constraints_pair
      ON level_constraints (child_level, parent_level)
      WHERE parent_level IS NOT NULL
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_level_constraints_root
      ON level_constraints (child_level)
      WHERE parent_level IS NULL
    `);
  }

  static async seedDefaults() {
    const existing = await pool.query(`SELECT COUNT(*)::int AS total FROM level_constraints`);
    if (Number(existing.rows[0]?.total || 0) > 0) return;

    const pairs = new Map(); // key "child|parent" -> [child, parentOrNull]
    const addPair = (child, parent) => {
      const c = String(child || '').trim().toLowerCase();
      if (!c) return;
      const p = parent ? String(parent).trim().toLowerCase() : null;
      pairs.set(`${c}|${p || ''}`, [c, p]);
    };

    for (const [child, parent] of DEFAULT_CONSTRAINTS) addPair(child, parent);

    // Union with the structure that already exists in the live tree so current
    // data stays valid after enforcement is switched on.
    try {
      const observed = await pool.query(`
        SELECT DISTINCT c.level AS child_level, p.level AS parent_level
        FROM karyakarini_nodes c
        JOIN karyakarini_nodes p ON c.parent_id = p.id
      `);
      for (const row of observed.rows) addPair(row.child_level, row.parent_level);

      const roots = await pool.query(
        `SELECT DISTINCT level FROM karyakarini_nodes WHERE parent_id IS NULL`
      );
      for (const row of roots.rows) addPair(row.level, null);
    } catch (err) {
      // karyakarini_nodes may not exist yet on a fresh DB; defaults are enough.
    }

    for (const [, [child, parent]] of pairs) {
      await pool.query(
        `INSERT INTO level_constraints (child_level, parent_level)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [child, parent]
      );
    }
  }

  static async list() {
    const result = await pool.query(
      `SELECT id, child_level, parent_level, created_at
       FROM level_constraints
       ORDER BY child_level ASC, parent_level ASC NULLS FIRST`
    );
    return result.rows;
  }

  static async create({ childLevel, parentLevel }) {
    const child = String(childLevel || '').trim().toLowerCase();
    if (!child) throw new Error('child level is required');
    const parent =
      parentLevel === null || parentLevel === undefined || parentLevel === ''
        ? null
        : String(parentLevel).trim().toLowerCase();
    if (parent && parent === child) throw new Error('एक स्तर अपना ही पैरेंट नहीं हो सकता');

    const result = await pool.query(
      `INSERT INTO level_constraints (child_level, parent_level)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING id, child_level, parent_level, created_at`,
      [child, parent]
    );
    if (result.rows[0]) return result.rows[0];

    const existing = await pool.query(
      `SELECT id, child_level, parent_level, created_at
       FROM level_constraints
       WHERE child_level = $1 AND parent_level IS NOT DISTINCT FROM $2`,
      [child, parent]
    );
    return existing.rows[0];
  }

  static async remove({ id }) {
    const safeId = Number(id);
    if (!Number.isFinite(safeId) || safeId <= 0) throw new Error('Invalid constraint id');
    const result = await pool.query(
      `DELETE FROM level_constraints WHERE id = $1 RETURNING id`,
      [safeId]
    );
    if (!result.rows[0]) throw new Error('Constraint not found');
    return result.rows[0];
  }

  // Removes any rule that references a level (as child or parent). Used when a
  // level is deleted so no orphan rules remain.
  static async removeForLevel(code) {
    const c = String(code || '').trim().toLowerCase();
    if (!c) return;
    await pool.query(
      `DELETE FROM level_constraints WHERE LOWER(child_level) = $1 OR LOWER(parent_level) = $1`,
      [c]
    );
  }
}

module.exports = LevelConstraint;
