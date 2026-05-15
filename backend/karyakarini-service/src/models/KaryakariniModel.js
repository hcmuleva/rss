const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4000';
const DEFAULT_PAD_OPTIONS = ['संयोजक', 'सह संयोजक', 'प्रमुख', 'आयाम', 'Other'];

class KaryakariniModel {
  static async initTables() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS karyakarini_versions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        start_year INTEGER,
        end_year INTEGER,
        is_current BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS karyakarini_nodes (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(180) NOT NULL,
        level VARCHAR(40) NOT NULL,
        parent_id BIGINT REFERENCES karyakarini_nodes(id) ON DELETE CASCADE,
        version_id INTEGER NOT NULL REFERENCES karyakarini_versions(id) ON DELETE CASCADE,
        sort_order INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS karyakarini_members (
        id BIGSERIAL PRIMARY KEY,
        pad VARCHAR(100),
        period VARCHAR(120),
        start_date DATE,
        end_date DATE,
        node_id BIGINT NOT NULL REFERENCES karyakarini_nodes(id) ON DELETE CASCADE,
        version_id INTEGER NOT NULL REFERENCES karyakarini_versions(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE karyakarini_members ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
    await pool.query(`ALTER TABLE karyakarini_members ADD COLUMN IF NOT EXISTS period VARCHAR(120)`);
    await pool.query(`ALTER TABLE karyakarini_members ADD COLUMN IF NOT EXISTS start_date DATE`);
    await pool.query(`ALTER TABLE karyakarini_members ADD COLUMN IF NOT EXISTS end_date DATE`);
    await pool.query(`ALTER TABLE karyakarini_members ADD COLUMN IF NOT EXISTS name VARCHAR(180)`);
    await pool.query(`ALTER TABLE karyakarini_members ADD COLUMN IF NOT EXISTS mobile VARCHAR(25)`);
    await pool.query(`ALTER TABLE karyakarini_members ADD COLUMN IF NOT EXISTS avatar TEXT`);
    await pool.query(`ALTER TABLE karyakarini_members ADD COLUMN IF NOT EXISTS address_village VARCHAR(180)`);
    await pool.query(`ALTER TABLE karyakarini_members ADD COLUMN IF NOT EXISTS address_tehsil VARCHAR(180)`);
    await pool.query(`ALTER TABLE karyakarini_members ADD COLUMN IF NOT EXISTS address_district VARCHAR(180)`);
    await pool.query(`ALTER TABLE karyakarini_members ADD COLUMN IF NOT EXISTS address_state VARCHAR(180)`);
    await pool.query(`ALTER TABLE karyakarini_members ADD COLUMN IF NOT EXISTS address_pincode VARCHAR(20)`);
    await pool.query(`ALTER TABLE karyakarini_members ADD COLUMN IF NOT EXISTS category VARCHAR(80)`);
    await pool.query(`ALTER TABLE karyakarini_members ADD COLUMN IF NOT EXISTS subcategory VARCHAR(120)`);
    await pool.query(`ALTER TABLE karyakarini_members ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '[]'::jsonb`);
    await pool.query(`ALTER TABLE karyakarini_members ADD COLUMN IF NOT EXISTS subcategories JSONB DEFAULT '[]'::jsonb`);
    await pool.query(`
      UPDATE karyakarini_members
      SET categories = CASE
        WHEN categories IS NULL OR jsonb_typeof(categories) <> 'array' THEN
          CASE
            WHEN NULLIF(trim(COALESCE(category, '')), '') IS NOT NULL THEN jsonb_build_array(trim(category))
            ELSE '[]'::jsonb
          END
        ELSE categories
      END
    `);
    await pool.query(`
      UPDATE karyakarini_members
      SET subcategories = CASE
        WHEN subcategories IS NULL OR jsonb_typeof(subcategories) <> 'array' THEN
          CASE
            WHEN NULLIF(trim(COALESCE(subcategory, '')), '') IS NOT NULL THEN jsonb_build_array(trim(subcategory))
            ELSE '[]'::jsonb
          END
        ELSE subcategories
      END
    `);

    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'karyakarini_members'
            AND column_name = 'mobile_number'
        ) THEN
          UPDATE karyakarini_members km
          SET user_id = u.id,
              updated_at = NOW()
          FROM users u
          WHERE km.user_id IS NULL
            AND (
              (NULLIF(regexp_replace(COALESCE(km.mobile_number, ''), '\\D', '', 'g'), '') IS NOT NULL
                AND (
                  u.phone = regexp_replace(COALESCE(km.mobile_number, ''), '\\D', '', 'g')
                  OR u.email = regexp_replace(COALESCE(km.mobile_number, ''), '\\D', '', 'g') || '@emeelan.com'
                )
              )
            );
        END IF;
      END $$;
    `);

    await pool.query(`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY user_id, node_id, version_id
                 ORDER BY created_at DESC, id DESC
               ) AS rn
        FROM karyakarini_members
        WHERE user_id IS NOT NULL
          AND is_active = true
      )
      UPDATE karyakarini_members km
      SET is_active = false,
          updated_at = NOW()
      FROM ranked r
      WHERE km.id = r.id
        AND r.rn > 1
    `);

    await pool.query(`ALTER TABLE karyakarini_members DROP CONSTRAINT IF EXISTS karyakarini_members_mobile_number_version_id_key`);
    await pool.query(`DROP INDEX IF EXISTS idx_karyakarini_members_mobile`);
    await pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_karyakarini_members_unique_assignment
       ON karyakarini_members(user_id, node_id, version_id)
       WHERE user_id IS NOT NULL AND is_active = true`
    );

    await pool.query(`
      CREATE TABLE IF NOT EXISTS karyakarini_guest_members (
        id BIGSERIAL PRIMARY KEY,
        node_id BIGINT NOT NULL REFERENCES karyakarini_nodes(id) ON DELETE CASCADE,
        version_id INTEGER NOT NULL REFERENCES karyakarini_versions(id) ON DELETE CASCADE,
        name VARCHAR(180) NOT NULL,
        mobile VARCHAR(25),
        email VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS karyakarini_meetings (
        id BIGSERIAL PRIMARY KEY,
        node_id BIGINT NOT NULL REFERENCES karyakarini_nodes(id) ON DELETE CASCADE,
        version_id INTEGER NOT NULL REFERENCES karyakarini_versions(id) ON DELETE CASCADE,
        title VARCHAR(220) NOT NULL,
        description TEXT,
        meeting_date DATE NOT NULL,
        created_by INTEGER,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS karyakarini_meeting_attendees (
        id BIGSERIAL PRIMARY KEY,
        meeting_id BIGINT NOT NULL REFERENCES karyakarini_meetings(id) ON DELETE CASCADE,
        attendee_type VARCHAR(20) NOT NULL DEFAULT 'member',
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        guest_member_id BIGINT REFERENCES karyakarini_guest_members(id) ON DELETE SET NULL,
        attendance_status VARCHAR(20) DEFAULT 'present',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS karyakarini_meeting_invites (
        id BIGSERIAL PRIMARY KEY,
        meeting_id BIGINT NOT NULL REFERENCES karyakarini_meetings(id) ON DELETE CASCADE,
        version_id INTEGER NOT NULL REFERENCES karyakarini_versions(id) ON DELETE CASCADE,
        invited_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invited_node_id BIGINT REFERENCES karyakarini_nodes(id) ON DELETE SET NULL,
        invitation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
        response_note TEXT,
        responded_at TIMESTAMP,
        notification_read_at TIMESTAMP,
        invited_by INTEGER,
        invited_at TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(meeting_id, invited_user_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS karyakarini_meeting_attachments (
        id BIGSERIAL PRIMARY KEY,
        meeting_id BIGINT NOT NULL REFERENCES karyakarini_meetings(id) ON DELETE CASCADE,
        attachment_url TEXT NOT NULL,
        attachment_type VARCHAR(30),
        file_name VARCHAR(255),
        uploaded_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS karyakarini_tasks (
        id BIGSERIAL PRIMARY KEY,
        node_id BIGINT NOT NULL REFERENCES karyakarini_nodes(id) ON DELETE CASCADE,
        version_id INTEGER NOT NULL REFERENCES karyakarini_versions(id) ON DELETE CASCADE,
        title VARCHAR(220) NOT NULL,
        description TEXT,
        task_date DATE NOT NULL,
        due_date DATE,
        status VARCHAR(30) DEFAULT 'open',
        hierarchy_l1 VARCHAR(180),
        hierarchy_l2 VARCHAR(180),
        hierarchy_l3 VARCHAR(180),
        hierarchy_l4 VARCHAR(180),
        hierarchy_l5 VARCHAR(180),
        hierarchy_l5_sublevels JSONB DEFAULT '[]'::jsonb,
        assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_by INTEGER,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE karyakarini_tasks ADD COLUMN IF NOT EXISTS hierarchy_l1 VARCHAR(180)`);
    await pool.query(`ALTER TABLE karyakarini_tasks ADD COLUMN IF NOT EXISTS hierarchy_l2 VARCHAR(180)`);
    await pool.query(`ALTER TABLE karyakarini_tasks ADD COLUMN IF NOT EXISTS hierarchy_l3 VARCHAR(180)`);
    await pool.query(`ALTER TABLE karyakarini_tasks ADD COLUMN IF NOT EXISTS hierarchy_l4 VARCHAR(180)`);
    await pool.query(`ALTER TABLE karyakarini_tasks ADD COLUMN IF NOT EXISTS hierarchy_l5 VARCHAR(180)`);
    await pool.query(`ALTER TABLE karyakarini_tasks ADD COLUMN IF NOT EXISTS hierarchy_l5_sublevels JSONB DEFAULT '[]'::jsonb`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS karyakarini_task_attachments (
        id BIGSERIAL PRIMARY KEY,
        task_id BIGINT NOT NULL REFERENCES karyakarini_tasks(id) ON DELETE CASCADE,
        attachment_url TEXT NOT NULL,
        attachment_type VARCHAR(30),
        file_name VARCHAR(255),
        uploaded_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS karyakarini_notifications (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        version_id INTEGER REFERENCES karyakarini_versions(id) ON DELETE SET NULL,
        category VARCHAR(40) NOT NULL DEFAULT 'general',
        type VARCHAR(60) NOT NULL DEFAULT 'generic',
        title VARCHAR(220) NOT NULL,
        message TEXT,
        entity_type VARCHAR(40),
        entity_id BIGINT,
        metadata JSONB DEFAULT '{}'::jsonb,
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS karyakarini_admin_scopes (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        node_id BIGINT NOT NULL REFERENCES karyakarini_nodes(id) ON DELETE CASCADE,
        version_id INTEGER NOT NULL REFERENCES karyakarini_versions(id) ON DELETE CASCADE,
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, node_id, version_id)
      )
    `);

    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_versions_current ON karyakarini_versions(is_current)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_nodes_version_parent ON karyakarini_nodes(version_id, parent_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_nodes_level ON karyakarini_nodes(level)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_members_node_version ON karyakarini_members(node_id, version_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_members_user_id ON karyakarini_members(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_scopes_user_version ON karyakarini_admin_scopes(user_id, version_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_guest_node_version ON karyakarini_guest_members(node_id, version_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_guest_mobile_email ON karyakarini_guest_members(mobile, email)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_meetings_node_date ON karyakarini_meetings(node_id, meeting_date)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_meetings_version_date ON karyakarini_meetings(version_id, meeting_date)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_tasks_node_date ON karyakarini_tasks(node_id, task_date)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_tasks_version_date ON karyakarini_tasks(version_id, task_date)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_tasks_assigned_user ON karyakarini_tasks(assigned_user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_tasks_hierarchy_l1 ON karyakarini_tasks(hierarchy_l1)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_tasks_hierarchy_l5_sublevels ON karyakarini_tasks USING GIN (hierarchy_l5_sublevels)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_meeting_attendees_meeting ON karyakarini_meeting_attendees(meeting_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_meeting_invites_meeting ON karyakarini_meeting_invites(meeting_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_meeting_invites_user_status ON karyakarini_meeting_invites(invited_user_id, invitation_status, is_active)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_task_attachments_task ON karyakarini_task_attachments(task_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_meeting_attachments_meeting ON karyakarini_meeting_attachments(meeting_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_notifications_user_created ON karyakarini_notifications(user_id, created_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_notifications_user_read ON karyakarini_notifications(user_id, is_read)');

    await this.ensureDefaultVersionAndRoot();
  }

  static async ensureDefaultVersionAndRoot() {
    const versionRes = await pool.query(
      `SELECT id FROM karyakarini_versions ORDER BY is_current DESC, id ASC LIMIT 1`
    );

    let versionId = versionRes.rows[0]?.id;
    if (!versionId) {
      const inserted = await pool.query(
        `INSERT INTO karyakarini_versions (name, start_year, end_year, is_current, is_active)
         VALUES ('2024-2026', 2024, 2026, true, true)
         RETURNING id`
      );
      versionId = inserted.rows[0].id;
    } else {
      await pool.query(
        `UPDATE karyakarini_versions
         SET is_current = CASE WHEN id = $1 THEN true ELSE false END`,
        [versionId]
      );
    }

    const rootRes = await pool.query(
      `SELECT id FROM karyakarini_nodes WHERE version_id = $1 AND parent_id IS NULL LIMIT 1`,
      [versionId]
    );
    if (!rootRes.rows[0]) {
      await pool.query(
        `INSERT INTO karyakarini_nodes (name, level, parent_id, version_id, sort_order)
         VALUES ('Rashtriya', 'rashtriya', NULL, $1, 0)`,
        [versionId]
      );
    }

    const refreshedRootRes = await pool.query(
      `SELECT id FROM karyakarini_nodes WHERE version_id = $1 AND parent_id IS NULL ORDER BY id ASC LIMIT 1`,
      [versionId]
    );
    const rootId = Number(refreshedRootRes.rows[0]?.id || 0);
    if (rootId > 0) {
      await this.seedHierarchyFromLevelNode(versionId, rootId);
    }
  }

  static async findOrCreateNode({ versionId, parentId, name, level, sortOrder = 0 }) {
    const existing = await pool.query(
      `SELECT id
       FROM karyakarini_nodes
       WHERE version_id = $1
         AND level = $2
         AND COALESCE(parent_id, 0) = COALESCE($3, 0)
         AND lower(name) = lower($4)
       LIMIT 1`,
      [versionId, level, parentId || null, String(name || '').trim()]
    );
    if (existing.rows[0]) return Number(existing.rows[0].id);
    const created = await pool.query(
      `INSERT INTO karyakarini_nodes (name, level, parent_id, version_id, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [String(name || '').trim(), level, parentId || null, versionId, Number(sortOrder || 0)]
    );
    return Number(created.rows[0].id);
  }

  static async seedHierarchyFromLevelNode(versionId, rootId) {
    try {
      const filePath = path.resolve(__dirname, '../../../../apps/level_node.json');
      if (!fs.existsSync(filePath)) return;
      const raw = fs.readFileSync(filePath, 'utf8');
      const source = JSON.parse(raw || '{}');

      const prantName = String(source['प्रान्त'] || 'प्रान्त').trim();
      const prantId = await this.findOrCreateNode({
        versionId,
        parentId: rootId,
        name: prantName,
        level: 'prant',
      });

      const sambhags = Array.isArray(source['संभाग']) ? source['संभाग'] : [];
      for (let s = 0; s < sambhags.length; s += 1) {
        const sambhag = sambhags[s] || {};
        const sambhagId = await this.findOrCreateNode({
          versionId,
          parentId: prantId,
          name: sambhag['नाम'] || `संभाग ${s + 1}`,
          level: 'sambhag',
          sortOrder: s,
        });

        const vibhags = Array.isArray(sambhag['विभाग']) ? sambhag['विभाग'] : [];
        for (let v = 0; v < vibhags.length; v += 1) {
          const vibhag = vibhags[v] || {};
          const vibhagId = await this.findOrCreateNode({
            versionId,
            parentId: sambhagId,
            name: vibhag['नाम'] || `विभाग ${v + 1}`,
            level: 'vibhag',
            sortOrder: v,
          });

          const jilay = Array.isArray(vibhag['जिला']) ? vibhag['जिला'] : [];
          for (let j = 0; j < jilay.length; j += 1) {
            const jila = jilay[j] || {};
            const jilaId = await this.findOrCreateNode({
              versionId,
              parentId: vibhagId,
              name: jila['नाम'] || `जिला ${j + 1}`,
              level: 'jila',
              sortOrder: j,
            });

            const khands = Array.isArray(jila['खण्ड']) ? jila['खण्ड'] : [];
            for (let k = 0; k < khands.length; k += 1) {
              const khand = khands[k] || {};
              const khandId = await this.findOrCreateNode({
                versionId,
                parentId: jilaId,
                name: khand['नाम'] || `खण्ड ${k + 1}`,
                level: 'khand',
                sortOrder: k,
              });

              const mandals = Array.isArray(khand['मण्डल']) ? khand['मण्डल'] : [];
              for (let m = 0; m < mandals.length; m += 1) {
                const mandal = mandals[m] || {};
                const nagarId = await this.findOrCreateNode({
                  versionId,
                  parentId: khandId,
                  name: mandal['नाम'] || `नगर ${m + 1}`,
                  level: 'nagar',
                  sortOrder: m,
                });

                const mohallas = Array.isArray(mandal['ग्राम_मोहल्ला']) ? mandal['ग्राम_मोहल्ला'] : [];
                for (let x = 0; x < mohallas.length; x += 1) {
                  await this.findOrCreateNode({
                    versionId,
                    parentId: nagarId,
                    name: String(mohallas[x] || '').trim() || `मोहल्ला ${x + 1}`,
                    level: 'nagar_mohalla',
                    sortOrder: x,
                  });
                }
              }
            }

            const bastis = Array.isArray(jila['बस्ती']) ? jila['बस्ती'] : [];
            for (let b = 0; b < bastis.length; b += 1) {
              const basti = bastis[b] || {};
              await this.findOrCreateNode({
                versionId,
                parentId: jilaId,
                name: basti['नाम'] || `मण्डल बस्ती ${b + 1}`,
                level: 'mandal_basti',
                sortOrder: b,
              });
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to seed hierarchy from level_node.json:', error?.message || error);
    }
  }

  static async resolveVersionId(versionValue) {
    if (versionValue && String(versionValue).toLowerCase() !== 'current') {
      const parsed = Number(versionValue);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    const current = await pool.query(
      `SELECT id
       FROM karyakarini_versions
       WHERE is_current = true
       ORDER BY id DESC
       LIMIT 1`
    );
    if (current.rows[0]) return current.rows[0].id;

    const fallback = await pool.query(
      `SELECT id FROM karyakarini_versions ORDER BY id DESC LIMIT 1`
    );
    return fallback.rows[0]?.id || null;
  }

  static async getVersions() {
    const result = await pool.query(
      `SELECT id, name, start_year, end_year, is_current, is_active, created_at, updated_at
       FROM karyakarini_versions
       WHERE is_active = true
       ORDER BY is_current DESC, COALESCE(end_year, 0) DESC, id DESC`
    );
    return result.rows;
  }

  static async createVersion({ name, startYear, endYear, isCurrent = false, createdBy }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (isCurrent) {
        await client.query(`UPDATE karyakarini_versions SET is_current = false`);
      }
      const inserted = await client.query(
        `INSERT INTO karyakarini_versions (name, start_year, end_year, is_current, is_active, created_by)
         VALUES ($1, $2, $3, $4, true, $5)
         RETURNING id, name, start_year, end_year, is_current, is_active, created_at, updated_at`,
        [name, startYear || null, endYear || null, Boolean(isCurrent), createdBy || null]
      );

      await client.query(
        `INSERT INTO karyakarini_nodes (name, level, parent_id, version_id, sort_order, created_by)
         VALUES ('Rashtriya', 'rashtriya', NULL, $1, 0, $2)`,
        [inserted.rows[0].id, createdBy || null]
      );

      await client.query('COMMIT');
      return inserted.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getNodeById(nodeId, versionId) {
    const result = await pool.query(
      `SELECT id, name, level, parent_id, version_id, sort_order, metadata
       FROM karyakarini_nodes
       WHERE id = $1 AND version_id = $2
       LIMIT 1`,
      [nodeId, versionId]
    );
    return result.rows[0] || null;
  }

  static async getNodesByParent(versionId, parentId = null) {
    const result = await pool.query(
      `SELECT
         n.id,
         n.name,
         n.level,
         n.parent_id,
         n.version_id,
         n.sort_order,
         n.metadata,
         COALESCE(mc.member_count, 0)::int AS member_count,
         COALESCE(cc.child_count, 0)::int AS child_count
       FROM karyakarini_nodes n
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS member_count
         FROM karyakarini_members km
         WHERE km.node_id = n.id
           AND km.version_id = n.version_id
           AND km.is_active = true
       ) mc ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS child_count
         FROM karyakarini_nodes cn
         WHERE cn.parent_id = n.id
           AND cn.version_id = n.version_id
       ) cc ON true
       WHERE n.version_id = $1
         AND (($2::bigint IS NULL AND n.parent_id IS NULL) OR n.parent_id = $2::bigint)
       ORDER BY n.sort_order ASC, n.name ASC`,
      [versionId, parentId]
    );

    return result.rows;
  }

  static async getAssignableNodeIds(userId, versionId) {
    const result = await pool.query(
      `WITH RECURSIVE scope_roots AS (
         SELECT node_id
         FROM karyakarini_admin_scopes
         WHERE user_id = $1
           AND version_id = $2
           AND is_active = true
       ),
       expanded AS (
         SELECT n.id
         FROM karyakarini_nodes n
         JOIN scope_roots s ON s.node_id = n.id
         WHERE n.version_id = $2
         UNION
         SELECT c.id
         FROM karyakarini_nodes c
         JOIN expanded e ON c.parent_id = e.id
         WHERE c.version_id = $2
       )
       SELECT id FROM expanded`,
      [userId, versionId]
    );
    return result.rows.map((r) => Number(r.id));
  }

  static async getScopeRootNodes({ userId, versionId }) {
    const safeUserId = Number(userId);
    const safeVersionId = Number(versionId);
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) return [];
    if (!Number.isFinite(safeVersionId) || safeVersionId <= 0) return [];

    const result = await pool.query(
      `SELECT
         s.node_id,
         n.level AS node_level,
         n.name AS node_name
       FROM karyakarini_admin_scopes s
       JOIN karyakarini_nodes n ON n.id = s.node_id
       WHERE s.user_id = $1
         AND s.version_id = $2
         AND s.is_active = true
       ORDER BY s.updated_at DESC, s.id DESC`,
      [safeUserId, safeVersionId]
    );
    return result.rows;
  }

  static async hasNodeAccess({ nodeId, userId, userRole, versionId }) {
    if (userRole === 'superadmin') return true;
    const assignableNodeIds = await this.getAssignableNodeIds(userId, versionId);
    if (!assignableNodeIds.length) return false;
    return assignableNodeIds.includes(Number(nodeId));
  }

  static async getNodeBreadcrumb(nodeId, versionId) {
    const result = await pool.query(
      `WITH RECURSIVE ancestors AS (
         SELECT id, name, level, parent_id, 0 AS depth
         FROM karyakarini_nodes
         WHERE id = $1 AND version_id = $2
         UNION ALL
         SELECT p.id, p.name, p.level, p.parent_id, a.depth + 1
         FROM karyakarini_nodes p
         JOIN ancestors a ON a.parent_id = p.id
         WHERE p.version_id = $2
       )
       SELECT id, name, level, parent_id, depth
       FROM ancestors
       ORDER BY depth DESC`,
      [nodeId, versionId]
    );
    return result.rows;
  }

  static async createNode({ name, level, parentId, versionId, sortOrder = 0, metadata = {}, createdBy }) {
    const result = await pool.query(
      `INSERT INTO karyakarini_nodes (name, level, parent_id, version_id, sort_order, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       RETURNING id, name, level, parent_id, version_id, sort_order, metadata, created_at, updated_at`,
      [name, level, parentId || null, versionId, Number(sortOrder || 0), JSON.stringify(metadata || {}), createdBy || null]
    );
    return result.rows[0];
  }

  static async updateNode(nodeId, versionId, payload = {}) {
    const fields = [];
    const values = [];
    let index = 1;

    const allowed = ['name', 'level', 'parent_id', 'sort_order', 'metadata'];
    for (const key of allowed) {
      if (payload[key] === undefined) continue;
      fields.push(`${key} = $${index}`);
      if (key === 'metadata') values.push(JSON.stringify(payload[key] || {}));
      else values.push(payload[key]);
      index += 1;
    }

    if (!fields.length) return this.getNodeById(nodeId, versionId);
    fields.push(`updated_at = NOW()`);
    values.push(nodeId, versionId);

    const result = await pool.query(
      `UPDATE karyakarini_nodes
       SET ${fields.join(', ')}
       WHERE id = $${index} AND version_id = $${index + 1}
       RETURNING id, name, level, parent_id, version_id, sort_order, metadata, created_at, updated_at`,
      values
    );
    return result.rows[0] || null;
  }

  static async createMember({
    pad,
    period,
    startDate,
    endDate,
    name,
    mobile,
    avatar,
    addressVillage,
    addressTehsil,
    addressDistrict,
    addressState,
    addressPincode,
    category,
    subcategory,
    categories = [],
    subcategories = [],
    nodeId,
    versionId,
    userId,
    createdBy,
  }) {
    const resolvedUserId = Number(userId);
    if (!Number.isFinite(resolvedUserId) || resolvedUserId <= 0) {
      throw new Error('Valid userId is required');
    }

    const existing = await pool.query(
      `SELECT id
       FROM karyakarini_members
       WHERE user_id = $1
         AND node_id = $2
         AND version_id = $3
         AND is_active = true
       LIMIT 1`,
      [resolvedUserId, nodeId, versionId]
    );
    if (existing.rows[0]) {
      return {
        status: 'skipped_existing_member',
        reason: 'Karyakarini member already exists for this user in this node/version',
        memberId: existing.rows[0].id,
        userId: resolvedUserId,
      };
    }

    const normalizedStartDate = this.normalizeDate(startDate);
    const normalizedEndDate = this.normalizeDate(endDate);
    const resolvedPeriod =
      String(period || '').trim() ||
      [
        normalizedStartDate || null,
        normalizedEndDate || null,
      ]
        .filter(Boolean)
        .join(' to ') ||
      null;
    const resolvedCategories = this.normalizeMemberLabelList(categories, category);
    const resolvedSubcategories = this.normalizeMemberLabelList(subcategories, subcategory);
    const primaryCategory = resolvedCategories[0] || (category ? String(category).trim() : null) || null;
    const primarySubcategory = resolvedSubcategories[0] || (subcategory ? String(subcategory).trim() : null) || null;

    const result = await pool.query(
      `INSERT INTO karyakarini_members (
         pad, period, start_date, end_date, name, mobile, avatar,
         address_village, address_tehsil, address_district, address_state, address_pincode,
         category, subcategory, categories, subcategories,
         node_id, version_id, user_id, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7,
               $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb,
               $17, $18, $19, $20)
       RETURNING id, pad, period, start_date, end_date, name, mobile, avatar,
                 address_village, address_tehsil, address_district, address_state, address_pincode,
                 category, subcategory, categories, subcategories, node_id, version_id, user_id, created_at, updated_at`,
      [
        pad || null,
        resolvedPeriod,
        normalizedStartDate,
        normalizedEndDate,
        name ? String(name).trim() : null,
        mobile ? this.sanitizeMobile(mobile) : null,
        avatar ? String(avatar).trim() : null,
        addressVillage ? String(addressVillage).trim() : null,
        addressTehsil ? String(addressTehsil).trim() : null,
        addressDistrict ? String(addressDistrict).trim() : null,
        addressState ? String(addressState).trim() : null,
        addressPincode ? String(addressPincode).trim() : null,
        primaryCategory,
        primarySubcategory,
        JSON.stringify(resolvedCategories),
        JSON.stringify(resolvedSubcategories),
        nodeId,
        versionId,
        resolvedUserId,
        createdBy || null,
      ]
    );
    return {
      status: 'created',
      member: result.rows[0],
    };
  }

  static sanitizeMobile(input) {
    return String(input || '').replace(/\D/g, '');
  }

  static normalizeDate(input) {
    if (!input) return null;
    const raw = String(input).trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const converted = raw.replace(/\//g, '-');
    const parsed = new Date(converted);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }

  static normalizeMemberLabelList(value, fallbackValue = null) {
    if (Array.isArray(value)) {
      return [...new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean))];
    }
    const raw = String(value || '').trim();
    if (raw) {
      return [...new Set(raw.split(',').map((entry) => entry.trim()).filter(Boolean))];
    }
    const fallback = String(fallbackValue || '').trim();
    return fallback ? [fallback] : [];
  }

  static normalizeTaskHierarchy(locationHierarchy = {}) {
    const source = locationHierarchy && typeof locationHierarchy === 'object' ? locationHierarchy : {};
    const clean = (value) => {
      const trimmed = String(value || '').trim();
      return trimmed || null;
    };
    const normalizeSublevels = (value) => {
      if (Array.isArray(value)) {
        return [...new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean))];
      }
      const raw = String(value || '').trim();
      if (!raw) return [];
      return [...new Set(raw.split(',').map((entry) => entry.trim()).filter(Boolean))];
    };

    return {
      l1: clean(source.l1 || source.level1 || source.hierarchyL1),
      l2: clean(source.l2 || source.level2 || source.hierarchyL2),
      l3: clean(source.l3 || source.level3 || source.hierarchyL3),
      l4: clean(source.l4 || source.level4 || source.hierarchyL4),
      l5: clean(source.l5 || source.level5 || source.hierarchyL5),
      l5Sublevels: normalizeSublevels(source.l5Sublevels || source.sublevels || source.hierarchyL5Sublevels),
    };
  }

  static randomToken(length = 8) {
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
    const bytes = crypto.randomBytes(Math.max(1, length));
    let output = '';
    for (let i = 0; i < length; i += 1) {
      output += alphabet[bytes[i] % alphabet.length];
    }
    return output;
  }

  static async generateUniqueSlug(tableName, prefix = '', length = 8) {
    for (let i = 0; i < 60; i += 1) {
      const slug = `${prefix}${this.randomToken(length)}`;
      const exists = await pool.query(`SELECT 1 FROM ${tableName} WHERE slug = $1 LIMIT 1`, [slug]);
      if (exists.rows.length === 0) return slug;
    }
    throw new Error(`Unable to generate unique slug for ${tableName}`);
  }

  static async createMappedMemberWithUser({
    userId: requestedUserId,
    mobileNumber,
    name,
    password = null,
    pad,
    period,
    startDate,
    endDate,
    village,
    tehsil = null,
    district = null,
    state = null,
    pincode = null,
    category = null,
    subcategory = null,
    categories = [],
    subcategories = [],
    nodeId,
    versionId,
    createdBy,
    dob = '1990-01-01',
    gotra = 'Unknown',
    fatherOrHusbandName = 'Unknown',
    avatar = null,
  }) {
    const mobile = this.sanitizeMobile(mobileNumber);
    const trimmedName = String(name || '').trim();
    const fallbackFatherName = fatherOrHusbandName ? String(fatherOrHusbandName).trim() : 'Unknown';
    const requestedId = Number(requestedUserId);
    const hasRequestedId = Number.isFinite(requestedId) && requestedId > 0;
    const email = mobile ? `${mobile}@emeelan.com` : null;
    const requestedPassword = String(password || '').trim();
    const registerPassword = requestedPassword || process.env.DEFAULT_NEW_USER_PASSWORD || 'welcome';
    let createdLoginPassword = null;

    let existingUserRes = null;
    if (hasRequestedId) {
      const foundById = await pool.query(
        `SELECT id
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [requestedId]
      );
      existingUserRes = foundById.rows[0] || null;
      if (!existingUserRes) throw new Error('Provided userId not found');
    } else {
      if (!mobile) throw new Error('Valid mobile number is required when userId is missing');
      if (!trimmedName) throw new Error('Name is required when userId is missing');

      const foundByMobile = await pool.query(
        `SELECT id
         FROM users
         WHERE phone = $1 OR email = $2
         ORDER BY id ASC
         LIMIT 1`,
        [mobile, email]
      );
      existingUserRes = foundByMobile.rows[0] || null;

      if (!existingUserRes) {
        await axios.post(`${AUTH_SERVICE_URL}/api/auth/register`, {
          firstName: trimmedName,
          fatherName: fallbackFatherName || 'Unknown',
          dob: String(dob || '1990-01-01'),
          gotra: String(gotra || 'Unknown'),
          gender: 'male',
          email,
          password: registerPassword,
        });
        createdLoginPassword = registerPassword;

        const refetch = await pool.query(
          `SELECT id
           FROM users
           WHERE email = $1
           ORDER BY id DESC
           LIMIT 1`,
          [email]
        );
        existingUserRes = refetch.rows[0] || null;
        if (!existingUserRes) {
          throw new Error('User creation succeeded but user record was not found');
        }
      }
    }

    const userId = Number(existingUserRes.id);

    await pool.query(
      `UPDATE users
       SET first_name = COALESCE(NULLIF(first_name, ''), NULLIF($1, '')),
           father_name = COALESCE(NULLIF(father_name, ''), NULLIF($2, '')),
           gotra = COALESCE(NULLIF(gotra, ''), NULLIF($3, '')),
           village = COALESCE(NULLIF(village, ''), NULLIF($4, '')),
           phone = COALESCE(NULLIF(phone, ''), NULLIF($5, '')),
           profile_photo_url = COALESCE(profile_photo_url, NULLIF($6, '')),
           updated_at = NOW()
       WHERE id = $7`,
      [
        trimmedName || null,
        fallbackFatherName || null,
        String(gotra || '').trim() || null,
        String(village || '').trim() || null,
        mobile || null,
        avatar || null,
        userId,
      ]
    );

    const createdMemberRes = await this.createMember({
      userId,
      name: trimmedName,
      mobile,
      avatar,
      pad,
      period,
      startDate,
      endDate,
      addressVillage: village,
      addressTehsil: tehsil,
      addressDistrict: district,
      addressState: state,
      addressPincode: pincode,
      category,
      subcategory,
      categories,
      subcategories,
      nodeId,
      versionId,
      createdBy,
    });

    return {
      status: createdMemberRes.status,
      reason: createdMemberRes.reason,
      email,
      mobileNumber: mobile,
      userId,
      createdUser: Boolean(createdLoginPassword),
      loginPassword: createdLoginPassword,
      member: createdMemberRes.member || null,
      memberId: createdMemberRes.memberId || createdMemberRes.member?.id || null,
    };
  }

  static async getMemberById({ memberId, versionId }) {
    const result = await pool.query(
      `SELECT id, user_id, node_id, version_id, is_active,
              pad, period, start_date, end_date,
              category, subcategory, categories, subcategories,
              address_state, address_district, address_tehsil, address_village, address_pincode,
              name, mobile, avatar
       FROM karyakarini_members
       WHERE id = $1
         AND version_id = $2
         AND is_active = true
       LIMIT 1`,
      [memberId, versionId]
    );
    return result.rows[0] || null;
  }

  static async updateMember({
    memberId,
    versionId,
    name,
    fatherOrHusbandName,
    mobileNumber,
    avatar,
    pad,
    period,
    startDate,
    endDate,
    village,
    tehsil,
    district,
    state,
    pincode,
    category,
    subcategory,
    categories,
    subcategories,
  }) {
    const safeMemberId = Number(memberId);
    const safeVersionId = Number(versionId);
    if (!Number.isFinite(safeMemberId) || safeMemberId <= 0) return null;
    if (!Number.isFinite(safeVersionId) || safeVersionId <= 0) return null;

    const existing = await this.getMemberById({ memberId: safeMemberId, versionId: safeVersionId });
    if (!existing) return null;

    const normalizedStartDate = this.normalizeDate(startDate !== undefined ? startDate : existing.start_date);
    const normalizedEndDate = this.normalizeDate(endDate !== undefined ? endDate : existing.end_date);
    const resolvedPeriod =
      String(period !== undefined ? period : existing.period || '').trim() ||
      [normalizedStartDate || null, normalizedEndDate || null].filter(Boolean).join(' to ') ||
      null;

    const nextName = String(name !== undefined ? name : existing.name || '').trim() || null;
    const nextMobile = this.sanitizeMobile(mobileNumber !== undefined ? mobileNumber : existing.mobile || '');
    const nextAvatar = String(avatar !== undefined ? avatar : existing.avatar || '').trim() || null;
    const nextPad = String(pad !== undefined ? pad : existing.pad || '').trim() || null;
    const nextCategories = this.normalizeMemberLabelList(
      categories !== undefined ? categories : existing.categories,
      category !== undefined ? category : existing.category
    );
    const nextSubcategories = this.normalizeMemberLabelList(
      subcategories !== undefined ? subcategories : existing.subcategories,
      subcategory !== undefined ? subcategory : existing.subcategory
    );
    const nextCategory = nextCategories[0] || null;
    const nextSubcategory = nextSubcategories[0] || null;
    const nextState = String(state !== undefined ? state : existing.address_state || '').trim() || null;
    const nextDistrict = String(district !== undefined ? district : existing.address_district || '').trim() || null;
    const nextTehsil = String(tehsil !== undefined ? tehsil : existing.address_tehsil || '').trim() || null;
    const nextVillage = String(village !== undefined ? village : existing.address_village || '').trim() || null;
    const nextPincode = String(pincode !== undefined ? pincode : existing.address_pincode || '').trim() || null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE karyakarini_members
         SET pad = $1,
             period = $2,
             start_date = $3,
             end_date = $4,
             name = $5,
             mobile = $6,
             avatar = $7,
             address_village = $8,
             address_tehsil = $9,
             address_district = $10,
             address_state = $11,
             address_pincode = $12,
             category = $13,
             subcategory = $14,
             categories = $15::jsonb,
             subcategories = $16::jsonb,
             updated_at = NOW()
         WHERE id = $17
           AND version_id = $18`,
        [
          nextPad,
          resolvedPeriod,
          normalizedStartDate,
          normalizedEndDate,
          nextName,
          nextMobile || null,
          nextAvatar,
          nextVillage,
          nextTehsil,
          nextDistrict,
          nextState,
          nextPincode,
          nextCategory,
          nextSubcategory,
          JSON.stringify(nextCategories),
          JSON.stringify(nextSubcategories),
          safeMemberId,
          safeVersionId,
        ]
      );

      const safeUserId = Number(existing.user_id || 0);
      if (safeUserId > 0) {
        await client.query(
          `UPDATE users
           SET first_name = COALESCE(NULLIF($1, ''), first_name),
               father_name = COALESCE(NULLIF($2, ''), father_name),
               phone = COALESCE(NULLIF($3, ''), phone),
               village = COALESCE(NULLIF($4, ''), village),
               profile_photo_url = COALESCE(NULLIF($5, ''), profile_photo_url),
               updated_at = NOW()
           WHERE id = $6`,
          [
            String(nextName || '').trim(),
            String(fatherOrHusbandName || '').trim(),
            String(nextMobile || '').trim(),
            String(nextVillage || '').trim(),
            String(nextAvatar || '').trim(),
            safeUserId,
          ]
        );
      }

      const updated = await client.query(
        `WITH RECURSIVE node_paths AS (
           SELECT n.id, n.parent_id, n.name, n.version_id, n.name::text AS path
           FROM karyakarini_nodes n
           WHERE n.version_id = $2
             AND n.parent_id IS NULL
           UNION ALL
           SELECT c.id, c.parent_id, c.name, c.version_id, np.path || ' > ' || c.name AS path
           FROM karyakarini_nodes c
           JOIN node_paths np ON c.parent_id = np.id
           WHERE c.version_id = $2
         )
         SELECT
           m.id,
           m.user_id,
           m.pad,
           m.period,
           m.start_date,
           m.end_date,
           m.category,
           m.subcategory,
           m.categories,
           m.subcategories,
           m.address_state AS state,
           m.address_district AS district,
           m.address_tehsil AS tehsil,
           m.address_village AS address_village,
           m.address_pincode AS pincode,
           m.node_id,
           COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name', m.name) AS first_name,
           COALESCE(to_jsonb(u) ->> 'father_name', to_jsonb(u) ->> 'last_name') AS father_name,
           COALESCE(to_jsonb(u) ->> 'phone', to_jsonb(u) ->> 'mobile_number', to_jsonb(u) ->> 'mobile', m.mobile) AS mobile_number,
           COALESCE(to_jsonb(u) ->> 'profile_photo_url', to_jsonb(u) ->> 'avatar', to_jsonb(u) ->> 'photo_url', m.avatar) AS avatar,
           COALESCE(to_jsonb(u) ->> 'gotra', '') AS gotra,
           COALESCE(NULLIF(m.address_village, ''), to_jsonb(u) ->> 'village', '') AS village,
           n.name AS node_name,
           n.level AS node_level,
           COALESCE(np.path, n.name) AS hierarchy_path,
           m.created_at,
           m.updated_at
         FROM karyakarini_members m
         JOIN karyakarini_nodes n ON n.id = m.node_id
         LEFT JOIN users u ON u.id = m.user_id
         LEFT JOIN node_paths np ON np.id = m.node_id
         WHERE m.id = $1
           AND m.version_id = $2
         LIMIT 1`,
        [safeMemberId, safeVersionId]
      );

      await client.query('COMMIT');
      return updated.rows[0] || null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getMembersByNode({ nodeId, versionId, page = 1, limit = 20 }) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const countResult = await pool.query(
      `WITH RECURSIVE subtree AS (
         SELECT id
         FROM karyakarini_nodes
         WHERE id = $1 AND version_id = $2
         UNION ALL
         SELECT c.id
         FROM karyakarini_nodes c
         JOIN subtree s ON c.parent_id = s.id
         WHERE c.version_id = $2
       )
       SELECT COUNT(*)::int AS total
       FROM karyakarini_members m
       JOIN subtree s ON s.id = m.node_id
       WHERE m.version_id = $2
         AND m.is_active = true`,
      [nodeId, versionId]
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const rows = await pool.query(
      `WITH RECURSIVE subtree AS (
         SELECT id
         FROM karyakarini_nodes
         WHERE id = $1 AND version_id = $2
         UNION ALL
         SELECT c.id
         FROM karyakarini_nodes c
         JOIN subtree s ON c.parent_id = s.id
         WHERE c.version_id = $2
       ),
       node_paths AS (
         SELECT n.id, n.parent_id, n.name, n.version_id, n.name::text AS path
         FROM karyakarini_nodes n
         WHERE n.version_id = $2
           AND n.parent_id IS NULL
         UNION ALL
         SELECT c.id, c.parent_id, c.name, c.version_id, np.path || ' > ' || c.name AS path
         FROM karyakarini_nodes c
         JOIN node_paths np ON c.parent_id = np.id
         WHERE c.version_id = $2
       )
       SELECT
         m.id,
         m.user_id,
         m.pad,
         m.period,
         m.start_date,
         m.end_date,
         m.category,
         m.subcategory,
         m.categories,
         m.subcategories,
         m.address_state AS state,
         m.address_district AS district,
         m.address_tehsil AS tehsil,
         m.address_village AS address_village,
         m.address_pincode AS pincode,
         m.node_id,
         COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name') AS first_name,
         COALESCE(to_jsonb(u) ->> 'father_name', to_jsonb(u) ->> 'last_name') AS father_name,
         COALESCE(to_jsonb(u) ->> 'phone', to_jsonb(u) ->> 'mobile_number', to_jsonb(u) ->> 'mobile', m.mobile) AS mobile_number,
         COALESCE(to_jsonb(u) ->> 'profile_photo_url', to_jsonb(u) ->> 'avatar', to_jsonb(u) ->> 'photo_url') AS avatar,
         COALESCE(to_jsonb(u) ->> 'gotra', '') AS gotra,
         COALESCE(NULLIF(m.address_village, ''), to_jsonb(u) ->> 'village', '') AS village,
         n.name AS node_name,
         n.level AS node_level,
         COALESCE(np.path, n.name) AS hierarchy_path,
         m.created_at,
         m.updated_at
       FROM karyakarini_members m
       JOIN subtree s ON s.id = m.node_id
       JOIN karyakarini_nodes n ON n.id = m.node_id
       LEFT JOIN users u ON u.id = m.user_id
       LEFT JOIN node_paths np ON np.id = m.node_id
       WHERE m.version_id = $2
         AND m.is_active = true
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT $3 OFFSET $4`,
      [nodeId, versionId, safeLimit, offset]
    );

    return {
      rows: rows.rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  static async searchUsersForAssignment({ query, limit = 12 }) {
    const safeQuery = String(query || '').trim();
    if (!safeQuery || safeQuery.length < 3) return [];
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 12));

    const result = await pool.query(
      `SELECT
         u.id,
         COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name') AS first_name,
         COALESCE(to_jsonb(u) ->> 'father_name', to_jsonb(u) ->> 'last_name') AS father_name,
         COALESCE(to_jsonb(u) ->> 'email', '') AS email,
         COALESCE(to_jsonb(u) ->> 'phone', to_jsonb(u) ->> 'mobile_number', to_jsonb(u) ->> 'mobile') AS phone,
         COALESCE(to_jsonb(u) ->> 'gotra', '') AS gotra,
         COALESCE(to_jsonb(u) ->> 'village', '') AS village,
         COALESCE(to_jsonb(u) ->> 'profile_photo_url', to_jsonb(u) ->> 'avatar', to_jsonb(u) ->> 'photo_url') AS avatar
       FROM users u
       WHERE (
         COALESCE(to_jsonb(u) ->> 'email', '') ILIKE $1
         OR COALESCE(to_jsonb(u) ->> 'phone', to_jsonb(u) ->> 'mobile_number', to_jsonb(u) ->> 'mobile', '') ILIKE $1
       )
       ORDER BY u.id DESC
       LIMIT $2`,
      [`%${safeQuery}%`, safeLimit]
    );

    return result.rows;
  }

  static async getMadhyaPradeshPads({ versionId }) {
    const byMpRoot = await pool.query(
      `WITH RECURSIVE mp_root AS (
         SELECT id
         FROM karyakarini_nodes
         WHERE version_id = $1
           AND (
             lower(replace(replace(name, ' ', ''), '.', '')) IN (
               'मध्यप्रदेश',
               'madhyapradesh',
               'madhyapradeshprant',
               'mpprant',
               'mp'
             )
             OR lower(name) IN ('madhya pradesh', 'madhyapradesh')
           )
         ORDER BY id ASC
         LIMIT 1
       ),
       subtree AS (
         SELECT id FROM mp_root
         UNION ALL
         SELECT c.id
         FROM karyakarini_nodes c
         JOIN subtree s ON c.parent_id = s.id
         WHERE c.version_id = $1
       )
       SELECT DISTINCT trim(km.pad) AS pad
       FROM karyakarini_members km
       JOIN subtree s ON s.id = km.node_id
       WHERE km.version_id = $1
         AND km.is_active = true
         AND km.pad IS NOT NULL
         AND trim(km.pad) <> ''
       ORDER BY trim(km.pad) ASC`,
      [versionId]
    );

    const mpPads = byMpRoot.rows.map((r) => String(r.pad || '').trim()).filter(Boolean);
    if (mpPads.length > 0) {
      return [...new Set([...DEFAULT_PAD_OPTIONS, ...mpPads])];
    }

    const fallback = await pool.query(
      `SELECT DISTINCT trim(pad) AS pad
       FROM karyakarini_members
       WHERE version_id = $1
         AND is_active = true
         AND pad IS NOT NULL
         AND trim(pad) <> ''
       ORDER BY trim(pad) ASC`,
      [versionId]
    );
    const fallbackPads = fallback.rows.map((r) => String(r.pad || '').trim()).filter(Boolean);
    if (fallbackPads.length > 0) {
      return [...new Set([...DEFAULT_PAD_OPTIONS, ...fallbackPads])];
    }
    return [...DEFAULT_PAD_OPTIONS];
  }

  static async getVisibleNodeIdsForUser({ userId, userRole, versionId }) {
    if (String(userRole || '').toLowerCase() === 'superadmin') {
      const allNodes = await pool.query(
        `SELECT id
         FROM karyakarini_nodes
         WHERE version_id = $1`,
        [versionId]
      );
      return allNodes.rows.map((row) => Number(row.id)).filter((value) => Number.isFinite(value) && value > 0);
    }

    if (!userId) return [];
    const scoped = await this.getAssignableNodeIds(userId, versionId);
    return [...new Set(scoped.map((id) => Number(id)).filter((value) => Number.isFinite(value) && value > 0))];
  }

  static async getAssignableNodesForUser({ userId, userRole, versionId }) {
    const visibleNodeIds = await this.getVisibleNodeIdsForUser({ userId, userRole, versionId });
    if (!visibleNodeIds.length) return [];

    const result = await pool.query(
      `WITH RECURSIVE node_paths AS (
         SELECT n.id, n.parent_id, n.name, n.level, n.version_id, n.name::text AS path
         FROM karyakarini_nodes n
         WHERE n.version_id = $1
           AND n.parent_id IS NULL
         UNION ALL
         SELECT c.id, c.parent_id, c.name, c.level, c.version_id, np.path || ' > ' || c.name AS path
         FROM karyakarini_nodes c
         JOIN node_paths np ON c.parent_id = np.id
         WHERE c.version_id = $1
       )
       SELECT
         n.id,
         n.name,
         n.level,
         n.parent_id,
         n.version_id,
         COALESCE(np.path, n.name) AS hierarchy_path
       FROM karyakarini_nodes n
       LEFT JOIN node_paths np ON np.id = n.id
       WHERE n.version_id = $1
         AND n.id = ANY($2::bigint[])
       ORDER BY COALESCE(np.path, n.name) ASC, n.id ASC`,
      [versionId, visibleNodeIds]
    );

    return result.rows;
  }

  static async getNodeMembersDirect({ nodeId, versionId }) {
    const result = await pool.query(
      `SELECT
         m.id,
         m.user_id,
         m.pad,
         m.period,
         m.start_date,
         m.end_date,
         m.category,
         m.subcategory,
         m.categories,
         m.subcategories,
         m.address_state AS state,
         m.address_district AS district,
         m.address_tehsil AS tehsil,
         m.address_village AS address_village,
         m.address_pincode AS pincode,
         m.node_id,
         COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name') AS first_name,
         COALESCE(to_jsonb(u) ->> 'father_name', to_jsonb(u) ->> 'last_name') AS father_name,
         COALESCE(to_jsonb(u) ->> 'phone', to_jsonb(u) ->> 'mobile_number', to_jsonb(u) ->> 'mobile', m.mobile) AS mobile_number,
         COALESCE(to_jsonb(u) ->> 'email', '') AS email,
         COALESCE(to_jsonb(u) ->> 'profile_photo_url', to_jsonb(u) ->> 'avatar', to_jsonb(u) ->> 'photo_url') AS avatar,
         n.name AS node_name,
         n.level AS node_level
       FROM karyakarini_members m
       JOIN karyakarini_nodes n ON n.id = m.node_id
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.node_id = $1
         AND m.version_id = $2
         AND m.is_active = true
       ORDER BY m.created_at DESC, m.id DESC`,
      [nodeId, versionId]
    );
    return result.rows;
  }

  static async searchGuestsForNode({ nodeId, versionId, query, limit = 20 }) {
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const safeQuery = String(query || '').trim();
    const hasQuery = safeQuery.length > 0;

    const result = await pool.query(
      `SELECT id, node_id, version_id, name, mobile, email, is_active, created_at, updated_at
       FROM karyakarini_guest_members
       WHERE node_id = $1
         AND version_id = $2
         AND is_active = true
         AND (
           $3::boolean = false
           OR name ILIKE $4
           OR COALESCE(mobile, '') ILIKE $4
           OR COALESCE(email, '') ILIKE $4
         )
       ORDER BY created_at DESC, id DESC
       LIMIT $5`,
      [nodeId, versionId, hasQuery, `%${safeQuery}%`, safeLimit]
    );
    return result.rows;
  }

  static async createGuestMember({ nodeId, versionId, name, mobile, email, createdBy }) {
    const trimmedName = String(name || '').trim();
    const normalizedMobile = this.sanitizeMobile(mobile);
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!trimmedName) throw new Error('Guest name is required');

    const existing = await pool.query(
      `SELECT id, node_id, version_id, name, mobile, email, is_active, created_at, updated_at
       FROM karyakarini_guest_members
       WHERE node_id = $1
         AND version_id = $2
         AND is_active = true
         AND (
           ($3 <> '' AND mobile = $3)
           OR ($4 <> '' AND lower(email) = $4)
         )
       ORDER BY id DESC
       LIMIT 1`,
      [nodeId, versionId, normalizedMobile, normalizedEmail]
    );
    if (existing.rows[0]) {
      return {
        status: 'existing',
        guest: existing.rows[0],
      };
    }

    const inserted = await pool.query(
      `INSERT INTO karyakarini_guest_members (
         node_id, version_id, name, mobile, email, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, node_id, version_id, name, mobile, email, is_active, created_at, updated_at`,
      [nodeId, versionId, trimmedName, normalizedMobile || null, normalizedEmail || null, createdBy || null]
    );

    return {
      status: 'created',
      guest: inserted.rows[0],
    };
  }

  static async resolveInvitableMemberNodes({ client, nodeId, versionId, userIds = [] }) {
    const safeUserIds = [...new Set((Array.isArray(userIds) ? userIds : []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
    if (!safeUserIds.length) return [];

    const result = await client.query(
      `WITH RECURSIVE subtree AS (
         SELECT id
         FROM karyakarini_nodes
         WHERE id = $1
           AND version_id = $2
         UNION ALL
         SELECT n.id
         FROM karyakarini_nodes n
         JOIN subtree s ON n.parent_id = s.id
         WHERE n.version_id = $2
       ),
       ranked AS (
         SELECT
           km.user_id,
           km.node_id,
           n.level AS node_level,
           n.name AS node_name,
           ROW_NUMBER() OVER (PARTITION BY km.user_id ORDER BY km.created_at DESC, km.id DESC) AS rn
         FROM karyakarini_members km
         JOIN subtree s ON s.id = km.node_id
         JOIN karyakarini_nodes n ON n.id = km.node_id
         WHERE km.version_id = $2
           AND km.is_active = true
           AND km.user_id = ANY($3::int[])
       )
       SELECT user_id, node_id, node_level, node_name
       FROM ranked
       WHERE rn = 1`,
      [nodeId, versionId, safeUserIds]
    );
    return result.rows;
  }

  static async syncMeetingInvites({
    client,
    meetingId,
    nodeId,
    versionId,
    invitedUserIds = [],
    invitedBy,
  }) {
    const safeMeetingId = Number(meetingId);
    const safeUserIds = [...new Set((Array.isArray(invitedUserIds) ? invitedUserIds : []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];

    const oldActiveRes = await client.query(
      `SELECT invited_user_id
       FROM karyakarini_meeting_invites
       WHERE meeting_id = $1
         AND is_active = true`,
      [safeMeetingId]
    );
    const oldActiveSet = new Set(oldActiveRes.rows.map((row) => Number(row.invited_user_id)).filter((id) => Number.isFinite(id) && id > 0));

    await client.query(
      `UPDATE karyakarini_meeting_invites
       SET is_active = false,
           updated_at = NOW()
       WHERE meeting_id = $1`,
      [safeMeetingId]
    );

    if (!safeUserIds.length) {
      return {
        inviteRows: [],
        newlyInvitedUserIds: [],
      };
    }

    const invitableRows = await this.resolveInvitableMemberNodes({
      client,
      nodeId,
      versionId,
      userIds: safeUserIds,
    });
    const invitableMap = new Map(invitableRows.map((row) => [Number(row.user_id), row]));
    const invalidUserIds = safeUserIds.filter((userId) => !invitableMap.has(userId));
    if (invalidUserIds.length > 0) {
      throw new Error('Some invited users are outside selected node scope');
    }

    const inviteRows = [];
    const newlyInvitedUserIds = [];
    for (const invitedUserId of safeUserIds) {
      const row = invitableMap.get(invitedUserId);
      const upserted = await client.query(
        `INSERT INTO karyakarini_meeting_invites (
           meeting_id, version_id, invited_user_id, invited_node_id, invited_by, invitation_status, notification_read_at, is_active
         )
         VALUES ($1, $2, $3, $4, $5, 'pending', NULL, true)
         ON CONFLICT (meeting_id, invited_user_id)
         DO UPDATE SET
           version_id = EXCLUDED.version_id,
           invited_node_id = EXCLUDED.invited_node_id,
           invited_by = EXCLUDED.invited_by,
           invitation_status = CASE
             WHEN karyakarini_meeting_invites.is_active = false THEN 'pending'
             ELSE karyakarini_meeting_invites.invitation_status
           END,
           response_note = CASE
             WHEN karyakarini_meeting_invites.is_active = false THEN NULL
             ELSE karyakarini_meeting_invites.response_note
           END,
           responded_at = CASE
             WHEN karyakarini_meeting_invites.is_active = false THEN NULL
             ELSE karyakarini_meeting_invites.responded_at
           END,
           notification_read_at = CASE
             WHEN karyakarini_meeting_invites.is_active = false THEN NULL
             ELSE karyakarini_meeting_invites.notification_read_at
           END,
           is_active = true,
           updated_at = NOW()
         RETURNING id, invited_user_id, invited_node_id, invitation_status, invited_at, updated_at`,
        [safeMeetingId, versionId, invitedUserId, Number(row.node_id) || null, invitedBy || null]
      );
      const invite = upserted.rows[0];
      inviteRows.push(invite);
      if (!oldActiveSet.has(invitedUserId)) {
        newlyInvitedUserIds.push(invitedUserId);
      }
    }

    return {
      inviteRows,
      newlyInvitedUserIds,
    };
  }

  static async getMeetingInvites({ meetingId }) {
    const safeMeetingId = Number(meetingId);
    if (!Number.isFinite(safeMeetingId) || safeMeetingId <= 0) return [];

    const result = await pool.query(
      `SELECT
         i.id,
         i.meeting_id,
         i.version_id,
         i.invited_user_id,
         i.invited_node_id,
         i.invitation_status,
         i.response_note,
         i.responded_at,
         i.notification_read_at,
         i.invited_by,
         i.invited_at,
         i.updated_at,
         COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name') AS invited_first_name,
         COALESCE(to_jsonb(u) ->> 'father_name', to_jsonb(u) ->> 'last_name') AS invited_father_name,
         COALESCE(to_jsonb(u) ->> 'phone', to_jsonb(u) ->> 'mobile_number', to_jsonb(u) ->> 'mobile') AS invited_mobile,
         COALESCE(to_jsonb(u) ->> 'email', '') AS invited_email,
         n.name AS invited_node_name,
         n.level AS invited_node_level
       FROM karyakarini_meeting_invites i
       LEFT JOIN users u ON u.id = i.invited_user_id
       LEFT JOIN karyakarini_nodes n ON n.id = i.invited_node_id
       WHERE i.meeting_id = $1
         AND i.is_active = true
       ORDER BY i.invited_at DESC, i.id DESC`,
      [safeMeetingId]
    );
    return result.rows;
  }

  static async getMemberVisibleNodeIds({ userId, versionId }) {
    const safeUserId = Number(userId);
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) return [];

    const result = await pool.query(
      `WITH RECURSIVE roots AS (
         SELECT DISTINCT node_id
         FROM karyakarini_members
         WHERE user_id = $1
           AND version_id = $2
           AND is_active = true
       ),
       subtree AS (
         SELECT n.id
         FROM karyakarini_nodes n
         JOIN roots r ON r.node_id = n.id
         WHERE n.version_id = $2
         UNION
         SELECT c.id
         FROM karyakarini_nodes c
         JOIN subtree s ON c.parent_id = s.id
         WHERE c.version_id = $2
       )
       SELECT DISTINCT id
       FROM subtree`,
      [safeUserId, versionId]
    );
    return result.rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);
  }

  static async getMyTeamNodes({ userId, versionId }) {
    const safeUserId = Number(userId);
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) return [];

    const result = await pool.query(
      `WITH RECURSIVE node_paths AS (
         SELECT n.id, n.parent_id, n.name, n.level, n.version_id, n.name::text AS path
         FROM karyakarini_nodes n
         WHERE n.version_id = $2
           AND n.parent_id IS NULL
         UNION ALL
         SELECT c.id, c.parent_id, c.name, c.level, c.version_id, np.path || ' > ' || c.name AS path
         FROM karyakarini_nodes c
         JOIN node_paths np ON c.parent_id = np.id
         WHERE c.version_id = $2
       )
       SELECT
         m.id,
         m.user_id,
         m.pad,
         m.period,
         m.start_date,
         m.end_date,
         m.node_id,
         n.name AS node_name,
         n.level AS node_level,
         COALESCE(np.path, n.name) AS hierarchy_path,
         m.created_at,
         m.updated_at
       FROM karyakarini_members m
       JOIN karyakarini_nodes n ON n.id = m.node_id
       LEFT JOIN node_paths np ON np.id = n.id
       WHERE m.user_id = $1
         AND m.version_id = $2
         AND m.is_active = true
       ORDER BY n.level ASC, n.name ASC, m.id DESC`,
      [safeUserId, versionId]
    );
    return result.rows;
  }

  static async getUserInvitations({ userId, versionId, status, onlyUnread = false, page = 1, limit = 20 }) {
    const safeUserId = Number(userId);
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) {
      return {
        rows: [],
        pagination: { page: 1, limit: Math.max(1, Number(limit) || 20), total: 0, totalPages: 0 },
      };
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const hasStatusFilter = ['pending', 'accepted', 'rejected', 'tentative'].includes(normalizedStatus);
    const hasVersionFilter = Number(versionId) > 0;

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM karyakarini_meeting_invites i
       JOIN karyakarini_meetings m ON m.id = i.meeting_id
       WHERE i.invited_user_id = $1
         AND i.is_active = true
         AND m.is_active = true
         AND ($2::boolean = false OR i.version_id = $3)
         AND ($4::boolean = false OR i.invitation_status = $5)
         AND ($6::boolean = false OR i.notification_read_at IS NULL)`,
      [safeUserId, hasVersionFilter, Number(versionId) || 0, hasStatusFilter, normalizedStatus, Boolean(onlyUnread)]
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const rows = await pool.query(
      `SELECT
         i.id,
         i.meeting_id,
         i.version_id,
         i.invited_user_id,
         i.invited_node_id,
         i.invitation_status,
         i.response_note,
         i.responded_at,
         i.notification_read_at,
         i.invited_by,
         i.invited_at,
         i.updated_at,
         m.title AS meeting_title,
         m.description AS meeting_description,
         m.meeting_date,
         m.node_id AS meeting_node_id,
         mn.name AS meeting_node_name,
         mn.level AS meeting_node_level,
         invn.name AS invited_node_name,
         invn.level AS invited_node_level,
         COALESCE(to_jsonb(cb) ->> 'first_name', to_jsonb(cb) ->> 'name', 'Coordinator') AS invited_by_name
       FROM karyakarini_meeting_invites i
       JOIN karyakarini_meetings m ON m.id = i.meeting_id
       LEFT JOIN karyakarini_nodes mn ON mn.id = m.node_id
       LEFT JOIN karyakarini_nodes invn ON invn.id = i.invited_node_id
       LEFT JOIN users cb ON cb.id = i.invited_by
       WHERE i.invited_user_id = $1
         AND i.is_active = true
         AND m.is_active = true
         AND ($2::boolean = false OR i.version_id = $3)
         AND ($4::boolean = false OR i.invitation_status = $5)
         AND ($6::boolean = false OR i.notification_read_at IS NULL)
       ORDER BY i.invited_at DESC, i.id DESC
       LIMIT $7 OFFSET $8`,
      [
        safeUserId,
        hasVersionFilter,
        Number(versionId) || 0,
        hasStatusFilter,
        normalizedStatus,
        Boolean(onlyUnread),
        safeLimit,
        offset,
      ]
    );

    return {
      rows: rows.rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  static async getSentInvitationSummary({ userId, versionId, page = 1, limit = 20 }) {
    const safeUserId = Number(userId);
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) {
      return {
        rows: [],
        pagination: { page: 1, limit: Math.max(1, Number(limit) || 20), total: 0, totalPages: 0 },
      };
    }

    const safeVersionId = Number(versionId);
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM karyakarini_meetings m
       WHERE m.created_by = $1
         AND m.version_id = $2
         AND m.is_active = true
         AND EXISTS (
           SELECT 1
           FROM karyakarini_meeting_invites i
           WHERE i.meeting_id = m.id
             AND i.is_active = true
         )`,
      [safeUserId, safeVersionId]
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const rows = await pool.query(
      `WITH RECURSIVE node_paths AS (
         SELECT n.id, n.parent_id, n.name, n.level, n.version_id, n.name::text AS path
         FROM karyakarini_nodes n
         WHERE n.version_id = $2
           AND n.parent_id IS NULL
         UNION ALL
         SELECT c.id, c.parent_id, c.name, c.level, c.version_id, np.path || ' > ' || c.name AS path
         FROM karyakarini_nodes c
         JOIN node_paths np ON c.parent_id = np.id
         WHERE c.version_id = $2
       )
       SELECT
         m.id AS meeting_id,
         m.title,
         m.meeting_date,
         m.node_id,
         n.name AS node_name,
         n.level AS node_level,
         COALESCE(np.path, n.name) AS hierarchy_path,
         COUNT(i.id)::int AS invited_count,
         COUNT(*) FILTER (WHERE i.invitation_status = 'accepted')::int AS accepted_count,
         COUNT(*) FILTER (WHERE i.invitation_status = 'tentative')::int AS tentative_count,
         COUNT(*) FILTER (WHERE i.invitation_status = 'rejected')::int AS rejected_count,
         COUNT(*) FILTER (WHERE i.invitation_status = 'pending')::int AS pending_count
       FROM karyakarini_meetings m
       JOIN karyakarini_nodes n ON n.id = m.node_id
       LEFT JOIN node_paths np ON np.id = n.id
       JOIN karyakarini_meeting_invites i
         ON i.meeting_id = m.id
        AND i.is_active = true
       WHERE m.created_by = $1
         AND m.version_id = $2
         AND m.is_active = true
       GROUP BY m.id, m.title, m.meeting_date, m.node_id, n.name, n.level, np.path
       ORDER BY m.meeting_date DESC, m.id DESC
       LIMIT $3 OFFSET $4`,
      [safeUserId, safeVersionId, safeLimit, offset]
    );

    return {
      rows: rows.rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  static async markUserInvitationsRead({ userId, invitationIds = [] }) {
    const safeUserId = Number(userId);
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) return 0;
    const safeInvitationIds = [...new Set((Array.isArray(invitationIds) ? invitationIds : []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];

    if (!safeInvitationIds.length) {
      const result = await pool.query(
        `UPDATE karyakarini_meeting_invites
         SET notification_read_at = NOW(),
             updated_at = NOW()
         WHERE invited_user_id = $1
           AND is_active = true
           AND notification_read_at IS NULL`,
        [safeUserId]
      );
      return Number(result.rowCount || 0);
    }

    const result = await pool.query(
      `UPDATE karyakarini_meeting_invites
       SET notification_read_at = NOW(),
           updated_at = NOW()
       WHERE invited_user_id = $1
         AND is_active = true
         AND id = ANY($2::bigint[])
         AND notification_read_at IS NULL`,
      [safeUserId, safeInvitationIds]
    );
    return Number(result.rowCount || 0);
  }

  static async respondToMeetingInvitation({ invitationId, userId, status, responseNote }) {
    const safeInvitationId = Number(invitationId);
    const safeUserId = Number(userId);
    const normalizedStatus = String(status || '').trim().toLowerCase();
    if (!['accepted', 'rejected', 'tentative'].includes(normalizedStatus)) {
      throw new Error('Invalid invitation status');
    }
    if (!Number.isFinite(safeInvitationId) || safeInvitationId <= 0) {
      throw new Error('Invalid invitation id');
    }
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) {
      throw new Error('Invalid user id');
    }

    const result = await pool.query(
      `WITH updated AS (
         UPDATE karyakarini_meeting_invites
         SET invitation_status = $1,
             response_note = $2,
             responded_at = NOW(),
             notification_read_at = COALESCE(notification_read_at, NOW()),
             updated_at = NOW()
         WHERE id = $3
           AND invited_user_id = $4
           AND is_active = true
         RETURNING id, meeting_id, version_id, invited_user_id, invited_node_id, invitation_status, response_note, responded_at, notification_read_at, invited_by, invited_at, updated_at
       )
       SELECT
         u.*,
         m.title AS meeting_title,
         m.meeting_date,
         n.name AS meeting_node_name,
         n.level AS meeting_node_level
       FROM updated u
       JOIN karyakarini_meetings m ON m.id = u.meeting_id
       LEFT JOIN karyakarini_nodes n ON n.id = m.node_id`,
      [normalizedStatus, String(responseNote || '').trim() || null, safeInvitationId, safeUserId]
    );
    return result.rows[0] || null;
  }

  static async createMeeting({
    nodeId,
    versionId,
    title,
    description,
    meetingDate,
    attendeeUserIds = [],
    invitedUserIds = [],
    guestIds = [],
    newGuests = [],
    attachments = [],
    createdBy,
  }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const meetingInsert = await client.query(
        `INSERT INTO karyakarini_meetings (
           node_id, version_id, title, description, meeting_date, created_by
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, node_id, version_id, title, description, meeting_date, created_by, created_at, updated_at`,
        [nodeId, versionId, String(title || '').trim(), String(description || '').trim() || null, meetingDate, createdBy || null]
      );
      const meeting = meetingInsert.rows[0];
      const meetingId = Number(meeting.id);

      const memberIds = [...new Set((Array.isArray(attendeeUserIds) ? attendeeUserIds : []).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))];
      if (memberIds.length > 0) {
        const validMembersRes = await client.query(
          `WITH RECURSIVE subtree AS (
             SELECT id
             FROM karyakarini_nodes
             WHERE id = $1
               AND version_id = $2
             UNION ALL
             SELECT n.id
             FROM karyakarini_nodes n
             JOIN subtree s ON n.parent_id = s.id
             WHERE n.version_id = $2
           )
           SELECT DISTINCT km.user_id
           FROM karyakarini_members km
           JOIN subtree s ON s.id = km.node_id
           WHERE km.version_id = $2
             AND is_active = true
             AND km.user_id = ANY($3::int[])`,
          [nodeId, versionId, memberIds]
        );
        const validMemberIds = validMembersRes.rows.map((row) => Number(row.user_id)).filter((value) => Number.isFinite(value) && value > 0);
        const invalidMemberIds = memberIds.filter((id) => !validMemberIds.includes(id));
        if (invalidMemberIds.length > 0) {
          throw new Error('Some selected members are not assigned to this node');
        }

        for (const userId of validMemberIds) {
          await client.query(
            `INSERT INTO karyakarini_meeting_attendees (
               meeting_id, attendee_type, user_id, attendance_status
             )
             VALUES ($1, 'member', $2, 'present')`,
            [meetingId, userId]
          );
        }
      }

      const resolvedGuestIds = [...new Set((Array.isArray(guestIds) ? guestIds : []).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))];
      for (const guestPayload of Array.isArray(newGuests) ? newGuests : []) {
        const guestName = String(guestPayload?.name || '').trim();
        if (!guestName) continue;
        const normalizedMobile = this.sanitizeMobile(guestPayload?.mobile || null);
        const normalizedEmail = String(guestPayload?.email || '').trim().toLowerCase();

        const existingGuest = await client.query(
          `SELECT id
           FROM karyakarini_guest_members
           WHERE node_id = $1
             AND version_id = $2
             AND is_active = true
             AND (
               ($3 <> '' AND mobile = $3)
               OR ($4 <> '' AND lower(email) = $4)
             )
           ORDER BY id DESC
           LIMIT 1`,
          [nodeId, versionId, normalizedMobile, normalizedEmail]
        );
        if (existingGuest.rows[0]?.id) {
          resolvedGuestIds.push(Number(existingGuest.rows[0].id));
          continue;
        }

        const insertedGuest = await client.query(
          `INSERT INTO karyakarini_guest_members (
             node_id, version_id, name, mobile, email, created_by
           )
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [nodeId, versionId, guestName, normalizedMobile || null, normalizedEmail || null, createdBy || null]
        );
        if (insertedGuest.rows[0]?.id) {
          resolvedGuestIds.push(Number(insertedGuest.rows[0].id));
        }
      }

      const uniqueGuestIds = [...new Set(resolvedGuestIds)];
      if (uniqueGuestIds.length > 0) {
        const validGuestsRes = await client.query(
          `WITH RECURSIVE subtree AS (
             SELECT id
             FROM karyakarini_nodes
             WHERE id = $1
               AND version_id = $2
             UNION ALL
             SELECT n.id
             FROM karyakarini_nodes n
             JOIN subtree s ON n.parent_id = s.id
             WHERE n.version_id = $2
           )
           SELECT DISTINCT g.id
           FROM karyakarini_guest_members g
           JOIN subtree s ON s.id = g.node_id
           WHERE g.version_id = $2
             AND is_active = true
             AND g.id = ANY($3::bigint[])`,
          [nodeId, versionId, uniqueGuestIds]
        );
        const validGuestIds = validGuestsRes.rows.map((row) => Number(row.id)).filter((value) => Number.isFinite(value) && value > 0);
        const invalidGuestIds = uniqueGuestIds.filter((id) => !validGuestIds.includes(id));
        if (invalidGuestIds.length > 0) {
          throw new Error('Some selected guests are invalid for this node scope');
        }
        for (const guestId of validGuestIds) {
          await client.query(
            `INSERT INTO karyakarini_meeting_attendees (
               meeting_id, attendee_type, guest_member_id, attendance_status
             )
             VALUES ($1, 'guest', $2, 'present')`,
            [meetingId, guestId]
          );
        }
      }

      for (const attachment of Array.isArray(attachments) ? attachments : []) {
        const attachmentUrl = String(attachment?.url || attachment?.attachment_url || '').trim();
        if (!attachmentUrl) continue;
        await client.query(
          `INSERT INTO karyakarini_meeting_attachments (
             meeting_id, attachment_url, attachment_type, file_name, uploaded_by
           )
           VALUES ($1, $2, $3, $4, $5)`,
          [
            meetingId,
            attachmentUrl,
            String(attachment?.type || attachment?.attachment_type || '').trim() || null,
            String(attachment?.name || attachment?.file_name || '').trim() || null,
            createdBy || null,
          ]
        );
      }

      const inviteSync = await this.syncMeetingInvites({
        client,
        meetingId,
        nodeId,
        versionId,
        invitedUserIds,
        invitedBy: createdBy || null,
      });

      await client.query('COMMIT');
      return {
        ...meeting,
        invited_user_count: inviteSync.inviteRows.length,
        newly_invited_user_ids: inviteSync.newlyInvitedUserIds,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getMeetingDetails({ meetingId, versionId, visibleNodeIds = [] }) {
    const safeMeetingId = Number(meetingId);
    if (!Number.isFinite(safeMeetingId) || safeMeetingId <= 0) return null;
    const scopedNodeIds = Array.isArray(visibleNodeIds)
      ? [...new Set(visibleNodeIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))]
      : [];
    if (!scopedNodeIds.length) return null;

    const meetingQuery = await pool.query(
      `WITH RECURSIVE node_paths AS (
         SELECT n.id, n.parent_id, n.name, n.level, n.version_id, n.name::text AS path
         FROM karyakarini_nodes n
         WHERE n.version_id = $2
           AND n.parent_id IS NULL
         UNION ALL
         SELECT c.id, c.parent_id, c.name, c.level, c.version_id, np.path || ' > ' || c.name AS path
         FROM karyakarini_nodes c
         JOIN node_paths np ON c.parent_id = np.id
         WHERE c.version_id = $2
       )
       SELECT
         m.id,
         m.node_id,
         m.version_id,
         m.title,
         m.description,
         m.meeting_date,
         m.created_by,
         m.created_at,
         m.updated_at,
         n.name AS node_name,
         n.level AS node_level,
         COALESCE(np.path, n.name) AS hierarchy_path
       FROM karyakarini_meetings m
       JOIN karyakarini_nodes n ON n.id = m.node_id
       LEFT JOIN node_paths np ON np.id = n.id
       WHERE m.id = $1
         AND m.version_id = $2
         AND m.is_active = true
         AND m.node_id = ANY($3::bigint[])
       LIMIT 1`,
      [safeMeetingId, versionId, scopedNodeIds]
    );
    const meeting = meetingQuery.rows[0];
    if (!meeting) return null;

    const attendees = await pool.query(
      `SELECT
         a.id,
         a.attendee_type,
         a.user_id,
         a.guest_member_id,
         a.attendance_status,
         CASE
           WHEN a.attendee_type = 'member' THEN COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name')
           ELSE g.name
         END AS first_name,
         CASE
           WHEN a.attendee_type = 'member' THEN COALESCE(to_jsonb(u) ->> 'father_name', to_jsonb(u) ->> 'last_name')
           ELSE NULL
         END AS father_name,
         CASE
           WHEN a.attendee_type = 'member' THEN COALESCE(to_jsonb(u) ->> 'phone', to_jsonb(u) ->> 'mobile_number', to_jsonb(u) ->> 'mobile')
           ELSE g.mobile
         END AS mobile_number,
         CASE
           WHEN a.attendee_type = 'member' THEN COALESCE(to_jsonb(u) ->> 'email', '')
           ELSE g.email
         END AS email,
         CASE
           WHEN a.attendee_type = 'member' THEN COALESCE(to_jsonb(u) ->> 'profile_photo_url', to_jsonb(u) ->> 'avatar', to_jsonb(u) ->> 'photo_url')
           ELSE NULL
         END AS avatar,
         CASE
           WHEN a.attendee_type = 'member' THEN km.node_level
           ELSE NULL
         END AS node_level,
         CASE
           WHEN a.attendee_type = 'member' THEN km.node_name
           ELSE NULL
         END AS node_name
       FROM karyakarini_meeting_attendees a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN karyakarini_guest_members g ON g.id = a.guest_member_id
       LEFT JOIN LATERAL (
         SELECT n.level AS node_level, n.name AS node_name
         FROM karyakarini_members m
         JOIN karyakarini_nodes n ON n.id = m.node_id
         WHERE m.user_id = a.user_id
           AND m.version_id = $2
           AND m.is_active = true
         ORDER BY m.id DESC
         LIMIT 1
       ) km ON true
       WHERE a.meeting_id = $1
       ORDER BY a.attendee_type ASC, a.id ASC`,
      [safeMeetingId, versionId]
    );

    const attachments = await pool.query(
      `SELECT
         id,
         attachment_url AS url,
         attachment_type AS type,
         file_name AS name,
         uploaded_by,
         created_at
       FROM karyakarini_meeting_attachments
       WHERE meeting_id = $1
       ORDER BY id DESC`,
      [safeMeetingId]
    );

    const invites = await this.getMeetingInvites({ meetingId: safeMeetingId });

    return {
      ...meeting,
      attendees: attendees.rows,
      attachments: attachments.rows,
      invites,
      attendeeUserIds: attendees.rows
        .filter((row) => row.attendee_type === 'member' && Number(row.user_id) > 0)
        .map((row) => Number(row.user_id)),
      guestIds: attendees.rows
        .filter((row) => row.attendee_type === 'guest' && Number(row.guest_member_id) > 0)
        .map((row) => Number(row.guest_member_id)),
      invitedUserIds: invites
        .map((row) => Number(row.invited_user_id))
        .filter((value) => Number.isFinite(value) && value > 0),
    };
  }

  static async updateMeeting({
    meetingId,
    versionId,
    nodeId,
    title,
    description,
    meetingDate,
    attendeeUserIds = [],
    invitedUserIds = [],
    guestIds = [],
    newGuests = [],
    attachments = [],
    updatedBy,
  }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const safeMeetingId = Number(meetingId);
      const existingMeeting = await client.query(
        `SELECT id, node_id, version_id
         FROM karyakarini_meetings
         WHERE id = $1
           AND version_id = $2
           AND is_active = true
         LIMIT 1`,
        [safeMeetingId, versionId]
      );
      if (!existingMeeting.rows[0]) {
        throw new Error('Meeting not found');
      }

      const targetNodeId = Number(nodeId) || Number(existingMeeting.rows[0].node_id);
      const updatedMeeting = await client.query(
        `UPDATE karyakarini_meetings
         SET node_id = $1,
             title = $2,
             description = $3,
             meeting_date = $4,
             updated_at = NOW()
         WHERE id = $5
           AND version_id = $6
         RETURNING id, node_id, version_id, title, description, meeting_date, created_by, created_at, updated_at`,
        [
          targetNodeId,
          String(title || '').trim(),
          String(description || '').trim() || null,
          meetingDate,
          safeMeetingId,
          versionId,
        ]
      );

      const memberIds = [...new Set((Array.isArray(attendeeUserIds) ? attendeeUserIds : []).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))];
      if (memberIds.length > 0) {
        const validMembersRes = await client.query(
          `WITH RECURSIVE subtree AS (
             SELECT id
             FROM karyakarini_nodes
             WHERE id = $1
               AND version_id = $2
             UNION ALL
             SELECT n.id
             FROM karyakarini_nodes n
             JOIN subtree s ON n.parent_id = s.id
             WHERE n.version_id = $2
           )
           SELECT DISTINCT km.user_id
           FROM karyakarini_members km
           JOIN subtree s ON s.id = km.node_id
           WHERE km.version_id = $2
             AND is_active = true
             AND km.user_id = ANY($3::int[])`,
          [targetNodeId, versionId, memberIds]
        );
        const validMemberIds = validMembersRes.rows.map((row) => Number(row.user_id)).filter((value) => Number.isFinite(value) && value > 0);
        const invalidMemberIds = memberIds.filter((id) => !validMemberIds.includes(id));
        if (invalidMemberIds.length > 0) {
          throw new Error('Some selected members are not assigned to this node');
        }
      }

      const resolvedGuestIds = [...new Set((Array.isArray(guestIds) ? guestIds : []).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))];
      for (const guestPayload of Array.isArray(newGuests) ? newGuests : []) {
        const guestName = String(guestPayload?.name || '').trim();
        if (!guestName) continue;
        const normalizedMobile = this.sanitizeMobile(guestPayload?.mobile || null);
        const normalizedEmail = String(guestPayload?.email || '').trim().toLowerCase();

        const existingGuest = await client.query(
          `SELECT id
           FROM karyakarini_guest_members
           WHERE node_id = $1
             AND version_id = $2
             AND is_active = true
             AND (
               ($3 <> '' AND mobile = $3)
               OR ($4 <> '' AND lower(email) = $4)
             )
           ORDER BY id DESC
           LIMIT 1`,
          [targetNodeId, versionId, normalizedMobile, normalizedEmail]
        );
        if (existingGuest.rows[0]?.id) {
          resolvedGuestIds.push(Number(existingGuest.rows[0].id));
          continue;
        }

        const insertedGuest = await client.query(
          `INSERT INTO karyakarini_guest_members (
             node_id, version_id, name, mobile, email, created_by
           )
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [targetNodeId, versionId, guestName, normalizedMobile || null, normalizedEmail || null, updatedBy || null]
        );
        if (insertedGuest.rows[0]?.id) {
          resolvedGuestIds.push(Number(insertedGuest.rows[0].id));
        }
      }

      const uniqueGuestIds = [...new Set(resolvedGuestIds)];
      if (uniqueGuestIds.length > 0) {
        const validGuestsRes = await client.query(
          `WITH RECURSIVE subtree AS (
             SELECT id
             FROM karyakarini_nodes
             WHERE id = $1
               AND version_id = $2
             UNION ALL
             SELECT n.id
             FROM karyakarini_nodes n
             JOIN subtree s ON n.parent_id = s.id
             WHERE n.version_id = $2
           )
           SELECT DISTINCT g.id
           FROM karyakarini_guest_members g
           JOIN subtree s ON s.id = g.node_id
           WHERE g.version_id = $2
             AND is_active = true
             AND g.id = ANY($3::bigint[])`,
          [targetNodeId, versionId, uniqueGuestIds]
        );
        const validGuestIds = validGuestsRes.rows.map((row) => Number(row.id)).filter((value) => Number.isFinite(value) && value > 0);
        const invalidGuestIds = uniqueGuestIds.filter((id) => !validGuestIds.includes(id));
        if (invalidGuestIds.length > 0) {
          throw new Error('Some selected guests are invalid for this node');
        }
      }

      await client.query(`DELETE FROM karyakarini_meeting_attendees WHERE meeting_id = $1`, [safeMeetingId]);
      await client.query(`DELETE FROM karyakarini_meeting_attachments WHERE meeting_id = $1`, [safeMeetingId]);

      for (const userId of memberIds) {
        await client.query(
          `INSERT INTO karyakarini_meeting_attendees (
             meeting_id, attendee_type, user_id, attendance_status
           )
           VALUES ($1, 'member', $2, 'present')`,
          [safeMeetingId, userId]
        );
      }

      for (const guestId of uniqueGuestIds) {
        await client.query(
          `INSERT INTO karyakarini_meeting_attendees (
             meeting_id, attendee_type, guest_member_id, attendance_status
           )
           VALUES ($1, 'guest', $2, 'present')`,
          [safeMeetingId, guestId]
        );
      }

      for (const attachment of Array.isArray(attachments) ? attachments : []) {
        const attachmentUrl = String(attachment?.url || attachment?.attachment_url || '').trim();
        if (!attachmentUrl) continue;
        await client.query(
          `INSERT INTO karyakarini_meeting_attachments (
             meeting_id, attachment_url, attachment_type, file_name, uploaded_by
           )
           VALUES ($1, $2, $3, $4, $5)`,
          [
            safeMeetingId,
            attachmentUrl,
            String(attachment?.type || attachment?.attachment_type || '').trim() || null,
            String(attachment?.name || attachment?.file_name || '').trim() || null,
            updatedBy || null,
          ]
        );
      }

      const inviteSync = await this.syncMeetingInvites({
        client,
        meetingId: safeMeetingId,
        nodeId: targetNodeId,
        versionId,
        invitedUserIds,
        invitedBy: updatedBy || null,
      });

      await client.query('COMMIT');
      return {
        ...(updatedMeeting.rows[0] || {}),
        invited_user_count: inviteSync.inviteRows.length,
        newly_invited_user_ids: inviteSync.newlyInvitedUserIds,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getMeetings({ versionId, visibleNodeIds = [], nodeId, page = 1, limit = 20 }) {
    if (!visibleNodeIds.length) {
      return {
        rows: [],
        pagination: { page: 1, limit: Math.max(1, Number(limit) || 20), total: 0, totalPages: 0 },
      };
    }
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;
    const filteredNodeId = nodeId ? Number(nodeId) : null;

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM karyakarini_meetings m
       WHERE m.version_id = $1
         AND m.is_active = true
         AND m.node_id = ANY($2::bigint[])
         AND ($3::bigint IS NULL OR m.node_id = $3::bigint)`,
      [versionId, visibleNodeIds, filteredNodeId]
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const rows = await pool.query(
      `WITH RECURSIVE node_paths AS (
         SELECT n.id, n.parent_id, n.name, n.level, n.version_id, n.name::text AS path
         FROM karyakarini_nodes n
         WHERE n.version_id = $1
           AND n.parent_id IS NULL
         UNION ALL
         SELECT c.id, c.parent_id, c.name, c.level, c.version_id, np.path || ' > ' || c.name AS path
         FROM karyakarini_nodes c
         JOIN node_paths np ON c.parent_id = np.id
         WHERE c.version_id = $1
       )
       SELECT
         m.id,
         m.title,
         m.description,
         m.meeting_date,
         m.node_id,
         n.name AS node_name,
         n.level AS node_level,
         COALESCE(np.path, n.name) AS hierarchy_path,
         COALESCE(ac.attendee_count, 0)::int AS attendee_count,
         COALESCE(atc.attachment_count, 0)::int AS attachment_count,
         COALESCE(ic.invited_count, 0)::int AS invited_count,
         COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name', 'System') AS created_by_name,
         m.created_by,
         m.created_at,
         m.updated_at
       FROM karyakarini_meetings m
       JOIN karyakarini_nodes n ON n.id = m.node_id
       LEFT JOIN node_paths np ON np.id = n.id
       LEFT JOIN users u ON u.id = m.created_by
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS attendee_count
         FROM karyakarini_meeting_attendees a
         WHERE a.meeting_id = m.id
       ) ac ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS attachment_count
         FROM karyakarini_meeting_attachments a
         WHERE a.meeting_id = m.id
       ) atc ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS invited_count
         FROM karyakarini_meeting_invites i
         WHERE i.meeting_id = m.id
           AND i.is_active = true
       ) ic ON true
       WHERE m.version_id = $1
         AND m.is_active = true
         AND m.node_id = ANY($2::bigint[])
         AND ($3::bigint IS NULL OR m.node_id = $3::bigint)
       ORDER BY m.meeting_date DESC, m.created_at DESC, m.id DESC
       LIMIT $4 OFFSET $5`,
      [versionId, visibleNodeIds, filteredNodeId, safeLimit, offset]
    );

    return {
      rows: rows.rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  static async createTask({
    nodeId,
    versionId,
    title,
    description,
    taskDate,
    dueDate,
    status = 'open',
    assignedUserId,
    locationHierarchy = {},
    attachments = [],
    createdBy,
  }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const normalizedHierarchy = this.normalizeTaskHierarchy(locationHierarchy);

      const normalizedAssignedUserId = Number(assignedUserId);
      if (normalizedAssignedUserId > 0) {
        const assignedUserCheck = await client.query(
          `SELECT 1
           FROM karyakarini_members
           WHERE node_id = $1
             AND version_id = $2
             AND is_active = true
             AND user_id = $3
           LIMIT 1`,
          [nodeId, versionId, normalizedAssignedUserId]
        );
        if (!assignedUserCheck.rows[0]) {
          throw new Error('Assigned user is not mapped to selected node');
        }
      }

      const insertedTask = await client.query(
        `INSERT INTO karyakarini_tasks (
           node_id, version_id, title, description, task_date, due_date, status,
           hierarchy_l1, hierarchy_l2, hierarchy_l3, hierarchy_l4, hierarchy_l5, hierarchy_l5_sublevels,
           assigned_user_id, created_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15)
         RETURNING id, node_id, version_id, title, description, task_date, due_date, status,
                   hierarchy_l1, hierarchy_l2, hierarchy_l3, hierarchy_l4, hierarchy_l5, hierarchy_l5_sublevels,
                   assigned_user_id, created_by, created_at, updated_at`,
        [
          nodeId,
          versionId,
          String(title || '').trim(),
          String(description || '').trim() || null,
          taskDate,
          dueDate || null,
          String(status || 'open').trim().toLowerCase() || 'open',
          normalizedHierarchy.l1,
          normalizedHierarchy.l2,
          normalizedHierarchy.l3,
          normalizedHierarchy.l4,
          normalizedHierarchy.l5,
          JSON.stringify(normalizedHierarchy.l5Sublevels || []),
          normalizedAssignedUserId > 0 ? normalizedAssignedUserId : null,
          createdBy || null,
        ]
      );
      const task = insertedTask.rows[0];
      const taskId = Number(task.id);

      for (const attachment of Array.isArray(attachments) ? attachments : []) {
        const attachmentUrl = String(attachment?.url || attachment?.attachment_url || '').trim();
        if (!attachmentUrl) continue;
        await client.query(
          `INSERT INTO karyakarini_task_attachments (
             task_id, attachment_url, attachment_type, file_name, uploaded_by
           )
           VALUES ($1, $2, $3, $4, $5)`,
          [
            taskId,
            attachmentUrl,
            String(attachment?.type || attachment?.attachment_type || '').trim() || null,
            String(attachment?.name || attachment?.file_name || '').trim() || null,
            createdBy || null,
          ]
        );
      }

      await client.query('COMMIT');
      return task;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getTasks({ versionId, visibleNodeIds = [], nodeId, hierarchy = {}, page = 1, limit = 20 }) {
    if (!visibleNodeIds.length) {
      return {
        rows: [],
        pagination: { page: 1, limit: Math.max(1, Number(limit) || 20), total: 0, totalPages: 0 },
      };
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;
    const filteredNodeId = nodeId ? Number(nodeId) : null;
    const normalizedHierarchy = this.normalizeTaskHierarchy(hierarchy);
    const hierarchySublevel = String(hierarchy?.sublevel || hierarchy?.hierarchySublevel || '').trim();
    const queryValues = [versionId, visibleNodeIds];
    const filters = [`t.version_id = $1`, `t.is_active = true`, `t.node_id = ANY($2::bigint[])`];

    if (filteredNodeId) {
      queryValues.push(filteredNodeId);
      filters.push(`t.node_id = $${queryValues.length}`);
    }

    const pushHierarchyFilter = (column, value) => {
      if (!value) return;
      queryValues.push(value);
      filters.push(`lower(COALESCE(t.${column}, '')) = lower($${queryValues.length})`);
    };

    pushHierarchyFilter('hierarchy_l1', normalizedHierarchy.l1);
    pushHierarchyFilter('hierarchy_l2', normalizedHierarchy.l2);
    pushHierarchyFilter('hierarchy_l3', normalizedHierarchy.l3);
    pushHierarchyFilter('hierarchy_l4', normalizedHierarchy.l4);
    pushHierarchyFilter('hierarchy_l5', normalizedHierarchy.l5);

    if (hierarchySublevel) {
      queryValues.push(hierarchySublevel);
      filters.push(
        `EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(COALESCE(t.hierarchy_l5_sublevels, '[]'::jsonb)) AS sub(value)
          WHERE lower(sub.value) = lower($${queryValues.length})
        )`
      );
    }

    const whereClause = filters.join('\n         AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM karyakarini_tasks t
       WHERE ${whereClause}`,
      queryValues
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const rowQueryValues = [...queryValues, safeLimit, offset];
    const limitPlaceholder = `$${queryValues.length + 1}`;
    const offsetPlaceholder = `$${queryValues.length + 2}`;

    const rows = await pool.query(
      `WITH RECURSIVE node_paths AS (
         SELECT n.id, n.parent_id, n.name, n.level, n.version_id, n.name::text AS path
         FROM karyakarini_nodes n
         WHERE n.version_id = $1
           AND n.parent_id IS NULL
         UNION ALL
         SELECT c.id, c.parent_id, c.name, c.level, c.version_id, np.path || ' > ' || c.name AS path
         FROM karyakarini_nodes c
         JOIN node_paths np ON c.parent_id = np.id
         WHERE c.version_id = $1
       )
       SELECT
         t.id,
         t.title,
         t.description,
         t.task_date,
         t.due_date,
         t.status,
         t.hierarchy_l1,
         t.hierarchy_l2,
         t.hierarchy_l3,
         t.hierarchy_l4,
         t.hierarchy_l5,
         COALESCE(t.hierarchy_l5_sublevels, '[]'::jsonb) AS hierarchy_l5_sublevels,
         t.node_id,
         n.name AS node_name,
         n.level AS node_level,
         COALESCE(np.path, n.name) AS hierarchy_path,
         t.assigned_user_id,
         COALESCE(to_jsonb(au) ->> 'first_name', to_jsonb(au) ->> 'name') AS assigned_first_name,
         COALESCE(to_jsonb(au) ->> 'father_name', to_jsonb(au) ->> 'last_name') AS assigned_father_name,
         COALESCE(to_jsonb(cu) ->> 'first_name', to_jsonb(cu) ->> 'name', 'System') AS created_by_name,
         COALESCE(atc.attachment_count, 0)::int AS attachment_count,
         t.created_by,
         t.created_at,
         t.updated_at
       FROM karyakarini_tasks t
       JOIN karyakarini_nodes n ON n.id = t.node_id
       LEFT JOIN node_paths np ON np.id = n.id
       LEFT JOIN users au ON au.id = t.assigned_user_id
       LEFT JOIN users cu ON cu.id = t.created_by
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS attachment_count
         FROM karyakarini_task_attachments ta
         WHERE ta.task_id = t.id
       ) atc ON true
       WHERE ${whereClause}
       ORDER BY t.task_date DESC, t.created_at DESC, t.id DESC
       LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      rowQueryValues
    );

    return {
      rows: rows.rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  static async getTasksForUser({ userId, versionId, page = 1, limit = 20, statuses = [] }) {
    const safeUserId = Number(userId);
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) {
      return {
        rows: [],
        pagination: { page: 1, limit: Math.max(1, Number(limit) || 20), total: 0, totalPages: 0 },
      };
    }

    const memberVisibleNodeIds = await this.getMemberVisibleNodeIds({ userId: safeUserId, versionId });
    const hasNodeScope = memberVisibleNodeIds.length > 0;
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;
    const normalizedStatuses = [...new Set((Array.isArray(statuses) ? statuses : [])
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean))];
    const hasStatusFilter = normalizedStatuses.length > 0;

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM karyakarini_tasks t
       WHERE t.version_id = $1
         AND t.is_active = true
         AND (
           ($2::boolean = true AND t.node_id = ANY($3::bigint[]))
           OR t.assigned_user_id = $4
         )
         AND ($5::boolean = false OR lower(COALESCE(t.status, 'open')) = ANY($6::text[]))`,
      [versionId, hasNodeScope, hasNodeScope ? memberVisibleNodeIds : [0], safeUserId, hasStatusFilter, normalizedStatuses]
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const rows = await pool.query(
      `WITH RECURSIVE node_paths AS (
         SELECT n.id, n.parent_id, n.name, n.level, n.version_id, n.name::text AS path
         FROM karyakarini_nodes n
         WHERE n.version_id = $1
           AND n.parent_id IS NULL
         UNION ALL
         SELECT c.id, c.parent_id, c.name, c.level, c.version_id, np.path || ' > ' || c.name AS path
         FROM karyakarini_nodes c
         JOIN node_paths np ON c.parent_id = np.id
         WHERE c.version_id = $1
       )
       SELECT
         t.id,
         t.title,
         t.description,
         t.task_date,
         t.due_date,
         t.status,
         t.hierarchy_l1,
         t.hierarchy_l2,
         t.hierarchy_l3,
         t.hierarchy_l4,
         t.hierarchy_l5,
         COALESCE(t.hierarchy_l5_sublevels, '[]'::jsonb) AS hierarchy_l5_sublevels,
         t.node_id,
         n.name AS node_name,
         n.level AS node_level,
         COALESCE(np.path, n.name) AS hierarchy_path,
         t.assigned_user_id,
         COALESCE(to_jsonb(au) ->> 'first_name', to_jsonb(au) ->> 'name') AS assigned_first_name,
         COALESCE(to_jsonb(au) ->> 'father_name', to_jsonb(au) ->> 'last_name') AS assigned_father_name,
         COALESCE(to_jsonb(cu) ->> 'first_name', to_jsonb(cu) ->> 'name', 'System') AS created_by_name,
         COALESCE(atc.attachment_count, 0)::int AS attachment_count,
         t.created_by,
         t.created_at,
         t.updated_at
       FROM karyakarini_tasks t
       JOIN karyakarini_nodes n ON n.id = t.node_id
       LEFT JOIN node_paths np ON np.id = n.id
       LEFT JOIN users au ON au.id = t.assigned_user_id
       LEFT JOIN users cu ON cu.id = t.created_by
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS attachment_count
         FROM karyakarini_task_attachments ta
         WHERE ta.task_id = t.id
       ) atc ON true
       WHERE t.version_id = $1
         AND t.is_active = true
         AND (
           ($2::boolean = true AND t.node_id = ANY($3::bigint[]))
           OR t.assigned_user_id = $4
         )
         AND ($5::boolean = false OR lower(COALESCE(t.status, 'open')) = ANY($6::text[]))
       ORDER BY t.task_date DESC, t.created_at DESC, t.id DESC
       LIMIT $7 OFFSET $8`,
      [versionId, hasNodeScope, hasNodeScope ? memberVisibleNodeIds : [0], safeUserId, hasStatusFilter, normalizedStatuses, safeLimit, offset]
    );

    return {
      rows: rows.rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  static async updateTaskStatus({ taskId, userId, userRole, versionId, status }) {
    const safeTaskId = Number(taskId);
    const safeUserId = Number(userId);
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const allowedStatuses = ['open', 'in_progress', 'completed', 'blocked', 'cancelled'];
    if (!allowedStatuses.includes(normalizedStatus)) {
      throw new Error('status must be one of open, in_progress, completed, blocked, cancelled');
    }

    const taskRes = await pool.query(
      `SELECT id, node_id, version_id, assigned_user_id, created_by
       FROM karyakarini_tasks
       WHERE id = $1
         AND version_id = $2
         AND is_active = true
       LIMIT 1`,
      [safeTaskId, versionId]
    );
    const task = taskRes.rows[0];
    if (!task) return null;

    const normalizedRole = String(userRole || '').trim().toLowerCase();
    const isPrivileged = ['admin', 'superadmin', 'templeadmin'].includes(normalizedRole);
    const ownsTask = Number(task.assigned_user_id || 0) === safeUserId || Number(task.created_by || 0) === safeUserId;
    if (!ownsTask && !isPrivileged) {
      throw new Error('You can update only your assigned tasks');
    }

    if (isPrivileged && normalizedRole !== 'superadmin' && !ownsTask) {
      const hasAccess = await this.hasNodeAccess({
        nodeId: Number(task.node_id || 0),
        userId: safeUserId,
        userRole: normalizedRole,
        versionId: Number(versionId),
      });
      if (!hasAccess) {
        throw new Error('You can update tasks only in assigned scope');
      }
    }

    const updated = await pool.query(
      `WITH updated_task AS (
         UPDATE karyakarini_tasks
         SET status = $1,
             updated_at = NOW()
         WHERE id = $2
           AND version_id = $3
         RETURNING *
       ),
       node_paths AS (
         SELECT n.id, n.parent_id, n.name, n.level, n.version_id, n.name::text AS path
         FROM karyakarini_nodes n
         WHERE n.version_id = $3
           AND n.parent_id IS NULL
         UNION ALL
         SELECT c.id, c.parent_id, c.name, c.level, c.version_id, np.path || ' > ' || c.name AS path
         FROM karyakarini_nodes c
         JOIN node_paths np ON c.parent_id = np.id
         WHERE c.version_id = $3
       )
       SELECT
         t.id,
         t.title,
         t.description,
         t.task_date,
         t.due_date,
         t.status,
         t.hierarchy_l1,
         t.hierarchy_l2,
         t.hierarchy_l3,
         t.hierarchy_l4,
         t.hierarchy_l5,
         COALESCE(t.hierarchy_l5_sublevels, '[]'::jsonb) AS hierarchy_l5_sublevels,
         t.node_id,
         n.name AS node_name,
         n.level AS node_level,
         COALESCE(np.path, n.name) AS hierarchy_path,
         t.assigned_user_id,
         COALESCE(to_jsonb(au) ->> 'first_name', to_jsonb(au) ->> 'name') AS assigned_first_name,
         COALESCE(to_jsonb(au) ->> 'father_name', to_jsonb(au) ->> 'last_name') AS assigned_father_name,
         COALESCE(to_jsonb(cu) ->> 'first_name', to_jsonb(cu) ->> 'name', 'System') AS created_by_name,
         t.created_by,
         t.created_at,
         t.updated_at
       FROM updated_task t
       JOIN karyakarini_nodes n ON n.id = t.node_id
       LEFT JOIN node_paths np ON np.id = n.id
       LEFT JOIN users au ON au.id = t.assigned_user_id
       LEFT JOIN users cu ON cu.id = t.created_by
       LIMIT 1`,
      [normalizedStatus, safeTaskId, versionId]
    );
    return updated.rows[0] || null;
  }

  static async createNotification({
    userId,
    versionId,
    category = 'general',
    type = 'generic',
    title,
    message = null,
    entityType = null,
    entityId = null,
    metadata = {},
  }) {
    const safeUserId = Number(userId);
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) return null;
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) return null;

    const inserted = await pool.query(
      `INSERT INTO karyakarini_notifications (
         user_id, version_id, category, type, title, message, entity_type, entity_id, metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING id, user_id, version_id, category, type, title, message, entity_type, entity_id, metadata, is_read, read_at, created_at`,
      [
        safeUserId,
        Number(versionId) > 0 ? Number(versionId) : null,
        String(category || 'general').trim().toLowerCase() || 'general',
        String(type || 'generic').trim().toLowerCase() || 'generic',
        cleanTitle,
        message ? String(message).trim() : null,
        entityType ? String(entityType).trim().toLowerCase() : null,
        Number(entityId) > 0 ? Number(entityId) : null,
        JSON.stringify(metadata || {}),
      ]
    );
    return inserted.rows[0] || null;
  }

  static async getUnreadNotificationCount({ userId, versionId }) {
    const safeUserId = Number(userId);
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) {
      return { total: 0, taskNotifications: 0, invitations: 0 };
    }
    const hasVersionFilter = Number(versionId) > 0;

    const [taskRes, inviteRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM karyakarini_notifications
         WHERE user_id = $1
           AND is_read = false
           AND ($2::boolean = false OR version_id = $3)`,
        [safeUserId, hasVersionFilter, Number(versionId) || 0]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM karyakarini_meeting_invites
         WHERE invited_user_id = $1
           AND is_active = true
           AND notification_read_at IS NULL
           AND ($2::boolean = false OR version_id = $3)`,
        [safeUserId, hasVersionFilter, Number(versionId) || 0]
      ),
    ]);

    const taskNotifications = Number(taskRes.rows[0]?.total || 0);
    const invitations = Number(inviteRes.rows[0]?.total || 0);
    return {
      total: taskNotifications + invitations,
      taskNotifications,
      invitations,
    };
  }

  static async getNotificationFeed({ userId, versionId, category = 'all', onlyUnread = false, page = 1, limit = 20 }) {
    const safeUserId = Number(userId);
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) {
      return {
        rows: [],
        pagination: { page: 1, limit: Math.max(1, Number(limit) || 20), total: 0, totalPages: 0 },
      };
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const normalizedCategory = String(category || 'all').trim().toLowerCase();
    const hasVersionFilter = Number(versionId) > 0;
    const onlyUnreadFlag = Boolean(onlyUnread);

    const taskRowsPromise = pool.query(
      `SELECT
         n.id,
         n.category,
         n.type,
         n.title,
         n.message,
         n.entity_type,
         n.entity_id,
         n.metadata,
         n.is_read,
         n.read_at,
         n.created_at
       FROM karyakarini_notifications n
       WHERE n.user_id = $1
         AND ($2::boolean = false OR n.version_id = $3)
         AND ($4::boolean = false OR n.is_read = false)
       ORDER BY n.created_at DESC
       LIMIT 300`,
      [safeUserId, hasVersionFilter, Number(versionId) || 0, onlyUnreadFlag]
    );

    const invitationRowsPromise = this.getUserInvitations({
      userId: safeUserId,
      versionId,
      onlyUnread: onlyUnreadFlag,
      page: 1,
      limit: 300,
    });

    const [taskRowsRes, invitationRowsRes] = await Promise.all([taskRowsPromise, invitationRowsPromise]);
    const taskRows = (taskRowsRes.rows || []).map((entry) => ({
      id: Number(entry.id),
      source: 'task_notification',
      category: String(entry.category || 'tasks'),
      type: String(entry.type || 'generic'),
      title: String(entry.title || 'Notification'),
      message: String(entry.message || ''),
      entity_type: entry.entity_type || null,
      entity_id: Number(entry.entity_id || 0) || null,
      metadata: entry.metadata || {},
      status: String((entry.metadata || {}).taskStatus || ''),
      is_read: Boolean(entry.is_read),
      read_at: entry.read_at || null,
      created_at: entry.created_at,
    }));

    const invitationRows = (invitationRowsRes.rows || []).map((entry) => ({
      id: Number(entry.id),
      source: 'invitation',
      category: 'invitations',
      type: 'meeting-invitation',
      title: String(entry.meeting_title || 'Meeting invitation'),
      message: `${String(entry.meeting_node_name || '-')} • ${String(entry.meeting_date || '-')}`,
      entity_type: 'meeting',
      entity_id: Number(entry.meeting_id || 0) || null,
      metadata: {
        invitationId: Number(entry.id),
        meetingId: Number(entry.meeting_id || 0),
      },
      status: String(entry.invitation_status || 'pending'),
      is_read: Boolean(entry.notification_read_at),
      read_at: entry.notification_read_at || null,
      created_at: entry.invited_at || entry.updated_at || entry.meeting_date,
    }));

    const categoryFiltered = [...taskRows, ...invitationRows].filter((row) => {
      if (normalizedCategory === 'all' || !normalizedCategory) return true;
      if (normalizedCategory === 'tasks') return row.category === 'tasks';
      if (normalizedCategory === 'invitations') return row.category === 'invitations';
      return row.category === normalizedCategory;
    });

    categoryFiltered.sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeB - timeA;
    });

    const total = categoryFiltered.length;
    const start = (safePage - 1) * safeLimit;
    const pagedRows = categoryFiltered.slice(start, start + safeLimit);

    return {
      rows: pagedRows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  static async markNotificationsRead({ userId, notificationIds = [], invitationIds = [] }) {
    const safeUserId = Number(userId);
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) return { notificationCount: 0, invitationCount: 0 };

    const safeNotificationIds = [...new Set((Array.isArray(notificationIds) ? notificationIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0))];
    const safeInvitationIds = [...new Set((Array.isArray(invitationIds) ? invitationIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0))];

    const shouldMarkAllNotifications = safeNotificationIds.length === 0 && safeInvitationIds.length === 0;
    let notificationCount = 0;
    if (safeNotificationIds.length > 0) {
      const updated = await pool.query(
        `UPDATE karyakarini_notifications
         SET is_read = true,
             read_at = NOW()
         WHERE user_id = $1
           AND id = ANY($2::bigint[])
           AND is_read = false`,
        [safeUserId, safeNotificationIds]
      );
      notificationCount = Number(updated.rowCount || 0);
    } else if (shouldMarkAllNotifications) {
      const updated = await pool.query(
        `UPDATE karyakarini_notifications
         SET is_read = true,
             read_at = NOW()
         WHERE user_id = $1
           AND is_read = false`,
        [safeUserId]
      );
      notificationCount = Number(updated.rowCount || 0);
    }

    let invitationCount = 0;
    if (safeInvitationIds.length > 0) {
      invitationCount = await this.markUserInvitationsRead({
        userId: safeUserId,
        invitationIds: safeInvitationIds,
      });
    }

    return { notificationCount, invitationCount };
  }

  static async setAdminScope({ userId, nodeId, versionId, isActive = true, createdBy }) {
    const result = await pool.query(
      `INSERT INTO karyakarini_admin_scopes (user_id, node_id, version_id, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, node_id, version_id)
       DO UPDATE
       SET is_active = EXCLUDED.is_active,
           updated_at = NOW()
       RETURNING id, user_id, node_id, version_id, is_active, created_at, updated_at`,
      [userId, nodeId, versionId, Boolean(isActive), createdBy || null]
    );
    return result.rows[0];
  }

  static async promoteUserToAdminRole(userId) {
    const safeUserId = Number(userId);
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) return null;

    const result = await pool.query(
      `UPDATE users
       SET role = CASE
         WHEN lower(role) IN ('superadmin') THEN role
         ELSE 'admin'
       END,
       updated_at = NOW()
       WHERE id = $1
       RETURNING id, role`,
      [safeUserId]
    );
    return result.rows[0] || null;
  }

  static async getAdminScopes({ userId, versionId }) {
    const conditions = [];
    const values = [];
    let i = 1;

    if (userId) {
      conditions.push(`s.user_id = $${i++}`);
      values.push(userId);
    }
    if (versionId) {
      conditions.push(`s.version_id = $${i++}`);
      values.push(versionId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT
         s.id,
         s.user_id,
         s.node_id,
         s.version_id,
         s.is_active,
         n.name AS node_name,
         n.level AS node_level
       FROM karyakarini_admin_scopes s
       JOIN karyakarini_nodes n ON n.id = s.node_id
       ${where}
       ORDER BY s.updated_at DESC, s.id DESC`,
      values
    );
    return result.rows;
  }
}

module.exports = KaryakariniModel;
