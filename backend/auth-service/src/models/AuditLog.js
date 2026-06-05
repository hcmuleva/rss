const pool = require('../config/database');

class AuditLog {
  static async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        actor_name VARCHAR(255),
        action VARCHAR(40) NOT NULL,
        entity_type VARCHAR(60) NOT NULL,
        entity_id INTEGER,
        entity_label VARCHAR(255),
        details JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type)`
    );
  }

  // Fire-and-forget recorder; never throws so it cannot break the main operation.
  static async record({ actorId, actorName, action, entityType, entityId, entityLabel, details }) {
    try {
      await pool.query(
        `INSERT INTO audit_logs (actor_id, actor_name, action, entity_type, entity_id, entity_label, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          actorId || null,
          actorName || null,
          String(action || '').trim(),
          String(entityType || '').trim(),
          entityId || null,
          entityLabel ? String(entityLabel).slice(0, 255) : null,
          details && typeof details === 'object' ? details : {},
        ]
      );
    } catch (err) {
      console.error('Audit log record failed:', err.message);
    }
  }

  // One-time seed so the history is not empty: records existing master data as
  // historical "create" entries using their original timestamps. Runs only when
  // the audit table is empty.
  static async backfillFromMasterData() {
    const existing = await pool.query(`SELECT COUNT(*)::int AS total FROM audit_logs`);
    if (Number(existing.rows[0]?.total || 0) > 0) return;

    const actorExpr = `COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.father_name)), ''), 'सिस्टम')`;
    const sources = [
      { type: 'category', table: 'categories' },
      { type: 'subcategory', table: 'subcategories' },
      { type: 'level', table: 'levels' },
      { type: 'karyakshetra', table: 'karyakshetras' },
    ];

    for (const src of sources) {
      try {
        await pool.query(
          `INSERT INTO audit_logs
             (actor_id, actor_name, action, entity_type, entity_id, entity_label, details, created_at)
           SELECT e.created_by, ${actorExpr}, 'create', $1, e.id, e.name,
                  '{"backfill":true}'::jsonb, e.created_at
           FROM ${src.table} e
           LEFT JOIN users u ON u.id = e.created_by`,
          [src.type]
        );
      } catch (err) {
        console.error(`Audit backfill failed for ${src.table}:`, err.message);
      }
    }
  }

  static async list({ entityType, action, search, limit = 50, offset = 0 } = {}) {
    const conditions = [];
    const params = [];
    let i = 1;
    if (entityType) {
      conditions.push(`entity_type = $${i++}`);
      params.push(entityType);
    }
    if (action) {
      conditions.push(`action = $${i++}`);
      params.push(action);
    }
    if (search) {
      conditions.push(`(entity_label ILIKE $${i} OR actor_name ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const safeOffset = Math.max(Number(offset) || 0, 0);

    const totalResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM audit_logs ${where}`,
      params
    );
    const rowsResult = await pool.query(
      `SELECT id, actor_id, actor_name, action, entity_type, entity_id, entity_label, details, created_at
       FROM audit_logs
       ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      params
    );
    return { logs: rowsResult.rows, total: Number(totalResult.rows[0]?.total || 0) };
  }
}

module.exports = AuditLog;
