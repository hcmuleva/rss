const pool = require('../config/database');

const ANNOUNCEMENT_CATEGORIES = [
  { key: 'general', label: 'General' },
  { key: 'events', label: 'Events' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'notifications', label: 'Notifications' },
];

class Announcement {
  static getCategories() {
    return ANNOUNCEMENT_CATEGORIES;
  }

  static isValidCategory(category) {
    const normalized = String(category || '').trim().toLowerCase();
    return ANNOUNCEMENT_CATEGORIES.some((entry) => entry.key === normalized);
  }

  static async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        category VARCHAR(60) NOT NULL,
        title VARCHAR(220) NOT NULL,
        message TEXT NOT NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcement_comments (
        id SERIAL PRIMARY KEY,
        announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        comment_text TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_announcements_category_date ON announcements(category, created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_announcements_active_date ON announcements(is_active, created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_announcement_comments_announcement ON announcement_comments(announcement_id, created_at DESC)`);
  }

  static async createAnnouncement({ category, title, message, createdBy }) {
    const result = await pool.query(
      `INSERT INTO announcements (category, title, message, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, category, title, message, created_by, is_active, created_at, updated_at`,
      [String(category || '').trim().toLowerCase(), String(title || '').trim(), String(message || '').trim(), createdBy || null]
    );
    return result.rows[0];
  }

  static async getCategorySummary() {
    const result = await pool.query(
      `SELECT
         a.category,
         COUNT(*)::int AS count,
         MAX(a.created_at) AS latest_created_at
       FROM announcements a
       WHERE a.is_active = true
       GROUP BY a.category`
    );
    const byCategory = new Map(result.rows.map((row) => [String(row.category), row]));
    return ANNOUNCEMENT_CATEGORIES.map((category) => {
      const row = byCategory.get(category.key);
      return {
        category: category.key,
        label: category.label,
        count: Number(row?.count || 0),
        latest_created_at: row?.latest_created_at || null,
      };
    });
  }

  static async listAnnouncements({ category, page = 1, limit = 20 }) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;
    const normalizedCategory = String(category || '').trim().toLowerCase();
    const hasCategory = Boolean(normalizedCategory);

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM announcements a
       WHERE a.is_active = true
         AND ($1::boolean = false OR a.category = $2)`,
      [hasCategory, normalizedCategory]
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const result = await pool.query(
      `SELECT
         a.id,
         a.category,
         a.title,
         a.message,
         a.created_by,
         a.created_at,
         a.updated_at,
         COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name', 'Admin') AS created_by_name,
         COALESCE(c.comment_count, 0)::int AS comment_count
       FROM announcements a
       LEFT JOIN users u ON u.id = a.created_by
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS comment_count
         FROM announcement_comments ac
         WHERE ac.announcement_id = a.id
           AND ac.is_active = true
       ) c ON true
       WHERE a.is_active = true
         AND ($1::boolean = false OR a.category = $2)
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT $3 OFFSET $4`,
      [hasCategory, normalizedCategory, safeLimit, offset]
    );

    return {
      rows: result.rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  static async listComments({ announcementId, page = 1, limit = 50 }) {
    const safeAnnouncementId = Number(announcementId);
    if (!Number.isFinite(safeAnnouncementId) || safeAnnouncementId <= 0) {
      return {
        rows: [],
        pagination: { page: 1, limit: 1, total: 0, totalPages: 0 },
      };
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const offset = (safePage - 1) * safeLimit;

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM announcement_comments
       WHERE announcement_id = $1
         AND is_active = true`,
      [safeAnnouncementId]
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const result = await pool.query(
      `SELECT
         ac.id,
         ac.announcement_id,
         ac.user_id,
         ac.comment_text,
         ac.created_at,
         ac.updated_at,
         COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name', 'User') AS user_name
       FROM announcement_comments ac
       LEFT JOIN users u ON u.id = ac.user_id
       WHERE ac.announcement_id = $1
         AND ac.is_active = true
       ORDER BY ac.created_at DESC, ac.id DESC
       LIMIT $2 OFFSET $3`,
      [safeAnnouncementId, safeLimit, offset]
    );

    return {
      rows: result.rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  static async createComment({ announcementId, userId, commentText }) {
    const safeAnnouncementId = Number(announcementId);
    const safeUserId = Number(userId);
    const text = String(commentText || '').trim();
    if (!Number.isFinite(safeAnnouncementId) || safeAnnouncementId <= 0) throw new Error('Invalid announcement id');
    if (!text) throw new Error('Comment text is required');

    const exists = await pool.query(
      `SELECT id
       FROM announcements
       WHERE id = $1
         AND is_active = true
       LIMIT 1`,
      [safeAnnouncementId]
    );
    if (!exists.rows[0]) throw new Error('Announcement not found');

    const result = await pool.query(
      `INSERT INTO announcement_comments (announcement_id, user_id, comment_text)
       VALUES ($1, $2, $3)
       RETURNING id, announcement_id, user_id, comment_text, created_at, updated_at`,
      [safeAnnouncementId, Number.isFinite(safeUserId) && safeUserId > 0 ? safeUserId : null, text]
    );
    return result.rows[0];
  }

  static async getAllActiveUserIds() {
    const result = await pool.query(
      `SELECT id
       FROM users
       WHERE is_active = true`
    );
    return result.rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);
  }
}

module.exports = Announcement;
