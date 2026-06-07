const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4000';
const DEFAULT_PAD_OPTIONS = ['संयोजक', 'सह संयोजक', 'प्रमुख', 'आयाम', 'अन्य'];
const OTHER_INFO_GENDERS = ['male', 'female', 'baccha', 'bacchi'];
const OTHER_INFO_RELIGIONS = ['hindu', 'isai', 'muslim', 'other'];
const JANSANKHIYA_RELIGIONS = ['hindu', 'isai', 'muslim', 'other'];

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
      CREATE TABLE IF NOT EXISTS karyakarini_category_teams (
        id BIGSERIAL PRIMARY KEY,
        version_id INTEGER NOT NULL REFERENCES karyakarini_versions(id) ON DELETE CASCADE,
        node_id BIGINT NOT NULL REFERENCES karyakarini_nodes(id) ON DELETE CASCADE,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(160) NOT NULL,
        subcategory VARCHAR(160),
        team_members JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_karyakarini_category_teams_scope ON karyakarini_category_teams(version_id, node_id, category)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_karyakarini_category_teams_creator ON karyakarini_category_teams(created_by, version_id)`);
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
        male_count INTEGER DEFAULT 0,
        female_count INTEGER DEFAULT 0,
        children_count INTEGER DEFAULT 0,
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
    await pool.query(`ALTER TABLE karyakarini_tasks ADD COLUMN IF NOT EXISTS task_categories JSONB DEFAULT '[]'::jsonb`);
    await pool.query(`ALTER TABLE karyakarini_tasks ADD COLUMN IF NOT EXISTS task_subcategories JSONB DEFAULT '[]'::jsonb`);
    await pool.query(`ALTER TABLE karyakarini_tasks ADD COLUMN IF NOT EXISTS male_count INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE karyakarini_tasks ADD COLUMN IF NOT EXISTS female_count INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE karyakarini_tasks ADD COLUMN IF NOT EXISTS children_count INTEGER DEFAULT 0`);

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
      CREATE TABLE IF NOT EXISTS karyakarini_category_activities (
        id BIGSERIAL PRIMARY KEY,
        version_id INTEGER NOT NULL REFERENCES karyakarini_versions(id) ON DELETE CASCADE,
        node_id BIGINT NOT NULL REFERENCES karyakarini_nodes(id) ON DELETE CASCADE,
        submitted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(180),
        subcategory VARCHAR(180) NOT NULL,
        title VARCHAR(220) NOT NULL,
        description TEXT,
        attachments JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE karyakarini_category_activities ADD COLUMN IF NOT EXISTS male_count INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE karyakarini_category_activities ADD COLUMN IF NOT EXISTS female_count INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE karyakarini_category_activities ADD COLUMN IF NOT EXISTS children_count INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE karyakarini_category_activities ADD COLUMN IF NOT EXISTS from_date DATE`);
    await pool.query(`ALTER TABLE karyakarini_category_activities ADD COLUMN IF NOT EXISTS to_date DATE`);
    await pool.query(`ALTER TABLE karyakarini_category_activities ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'open'`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS karyakarini_activity_assignments (
        id BIGSERIAL PRIMARY KEY,
        version_id INTEGER NOT NULL REFERENCES karyakarini_versions(id) ON DELETE CASCADE,
        node_id BIGINT REFERENCES karyakarini_nodes(id) ON DELETE SET NULL,
        activity_name VARCHAR(220) NOT NULL,
        description TEXT,
        assigned_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_by INTEGER,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS karyakarini_activity_submissions (
        id BIGSERIAL PRIMARY KEY,
        assignment_id BIGINT NOT NULL REFERENCES karyakarini_activity_assignments(id) ON DELETE CASCADE,
        version_id INTEGER NOT NULL REFERENCES karyakarini_versions(id) ON DELETE CASCADE,
        submitted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        activity_name VARCHAR(220) NOT NULL,
        description TEXT,
        male_count INTEGER DEFAULT 0,
        female_count INTEGER DEFAULT 0,
        children_count INTEGER DEFAULT 0,
        attachments JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_other_information (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        gender_type VARCHAR(20),
        religion VARCHAR(20),
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS karyakarini_jansankhiya_entries (
        id BIGSERIAL PRIMARY KEY,
        version_id INTEGER NOT NULL REFERENCES karyakarini_versions(id) ON DELETE CASCADE,
        node_id BIGINT NOT NULL REFERENCES karyakarini_nodes(id) ON DELETE CASCADE,
        religion VARCHAR(20) NOT NULL,
        family_count INTEGER NOT NULL DEFAULT 0,
        member_count INTEGER NOT NULL DEFAULT 0,
        created_by INTEGER,
        updated_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(version_id, node_id, religion)
      )
    `);

    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_versions_current ON karyakarini_versions(is_current)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_nodes_version_parent ON karyakarini_nodes(version_id, parent_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_nodes_level ON karyakarini_nodes(level)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_members_node_version ON karyakarini_members(node_id, version_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_members_user_id ON karyakarini_members(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_scopes_user_version ON karyakarini_admin_scopes(user_id, version_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_jansankhiya_version_node ON karyakarini_jansankhiya_entries(version_id, node_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_guest_node_version ON karyakarini_guest_members(node_id, version_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_guest_mobile_email ON karyakarini_guest_members(mobile, email)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_meetings_node_date ON karyakarini_meetings(node_id, meeting_date)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_meetings_version_date ON karyakarini_meetings(version_id, meeting_date)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_tasks_node_date ON karyakarini_tasks(node_id, task_date)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_tasks_version_date ON karyakarini_tasks(version_id, task_date)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_tasks_assigned_user ON karyakarini_tasks(assigned_user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_tasks_hierarchy_l1 ON karyakarini_tasks(hierarchy_l1)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_tasks_hierarchy_l5_sublevels ON karyakarini_tasks USING GIN (hierarchy_l5_sublevels)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_tasks_categories ON karyakarini_tasks USING GIN (task_categories)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_tasks_subcategories ON karyakarini_tasks USING GIN (task_subcategories)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_meeting_attendees_meeting ON karyakarini_meeting_attendees(meeting_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_meeting_invites_meeting ON karyakarini_meeting_invites(meeting_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_meeting_invites_user_status ON karyakarini_meeting_invites(invited_user_id, invitation_status, is_active)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_task_attachments_task ON karyakarini_task_attachments(task_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_meeting_attachments_meeting ON karyakarini_meeting_attachments(meeting_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_notifications_user_created ON karyakarini_notifications(user_id, created_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_notifications_user_read ON karyakarini_notifications(user_id, is_read)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_category_activity_node ON karyakarini_category_activities(node_id, created_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_category_activity_user ON karyakarini_category_activities(submitted_by, created_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_category_activity_filters ON karyakarini_category_activities(version_id, category, subcategory)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_activity_assignment_user_version ON karyakarini_activity_assignments(assigned_user_id, version_id, is_active)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_activity_assignment_node ON karyakarini_activity_assignments(node_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_activity_submission_assignment ON karyakarini_activity_submissions(assignment_id, created_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_karyakarini_activity_submission_user ON karyakarini_activity_submissions(submitted_by, version_id, created_at DESC)');

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
         VALUES ('राष्ट्रीय', 'rashtriya', NULL, $1, 0)`,
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

              const mandals = Array.isArray(khand['मण्डल'])
                ? khand['मण्डल']
                : Array.isArray(khand['मंडल'])
                  ? khand['मंडल']
                  : [];
              for (let m = 0; m < mandals.length; m += 1) {
                const mandal = mandals[m] || {};
                const mandalId = await this.findOrCreateNode({
                  versionId,
                  parentId: khandId,
                  name: mandal['नाम'] || `मंडल ${m + 1}`,
                  level: 'mandal',
                  sortOrder: m,
                });

                const grams = Array.isArray(mandal['ग्राम'])
                  ? mandal['ग्राम']
                  : Array.isArray(mandal['ग्राम_मोहल्ला'])
                    ? mandal['ग्राम_मोहल्ला']
                    : [];
                for (let x = 0; x < grams.length; x += 1) {
                  await this.findOrCreateNode({
                    versionId,
                    parentId: mandalId,
                    name: String(grams[x] || '').trim() || `ग्राम ${x + 1}`,
                    level: 'gram',
                    sortOrder: x,
                  });
                }
              }

              const nagars = Array.isArray(khand['नगर']) ? khand['नगर'] : [];
              for (let n = 0; n < nagars.length; n += 1) {
                const nagar = nagars[n] || {};
                const nagarId = await this.findOrCreateNode({
                  versionId,
                  parentId: khandId,
                  name: nagar['नाम'] || `नगर ${n + 1}`,
                  level: 'nagar',
                  sortOrder: n,
                });
                const bastiRows = Array.isArray(nagar['बस्ती']) ? nagar['बस्ती'] : [];
                for (let b = 0; b < bastiRows.length; b += 1) {
                  const basti = bastiRows[b] || {};
                  const bastiId = await this.findOrCreateNode({
                    versionId,
                    parentId: nagarId,
                    name: basti['नाम'] || `बस्ती ${b + 1}`,
                    level: 'basti',
                    sortOrder: b,
                  });
                  const mohallas = Array.isArray(basti['मोहल्ला'])
                    ? basti['मोहल्ला']
                    : Array.isArray(basti['वार्ड'])
                      ? basti['वार्ड']
                      : [];
                  for (let w = 0; w < mohallas.length; w += 1) {
                    await this.findOrCreateNode({
                      versionId,
                      parentId: bastiId,
                      name: String(mohallas[w] || '').trim() || `मोहल्ला ${w + 1}`,
                      level: 'mohalla',
                      sortOrder: w,
                    });
                  }
                }
              }
            }

            const bastis = Array.isArray(jila['बस्ती']) ? jila['बस्ती'] : [];
            for (let b = 0; b < bastis.length; b += 1) {
              const basti = bastis[b] || {};
              const bastiId = await this.findOrCreateNode({
                versionId,
                parentId: jilaId,
                name: basti['नाम'] || `बस्ती ${b + 1}`,
                level: 'basti',
                sortOrder: b,
              });
              const mohallas = Array.isArray(basti['मोहल्ला'])
                ? basti['मोहल्ला']
                : Array.isArray(basti['वार्ड'])
                  ? basti['वार्ड']
                  : [];
              for (let w = 0; w < mohallas.length; w += 1) {
                await this.findOrCreateNode({
                  versionId,
                  parentId: bastiId,
                  name: String(mohallas[w] || '').trim() || `मोहल्ला ${w + 1}`,
                  level: 'mohalla',
                  sortOrder: w,
                });
              }
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
         VALUES ('राष्ट्रीय', 'rashtriya', NULL, $1, 0, $2)`,
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
         COALESCE(cc.child_count, 0)::int AS child_count,
         COALESCE(js.hindu_member_count, 0)::int AS hindu_member_count,
         COALESCE(js.muslim_member_count, 0)::int AS muslim_member_count,
         COALESCE(js.isai_member_count, 0)::int AS isai_member_count,
         COALESCE(js.other_member_count, 0)::int AS other_member_count,
         COALESCE(js.hindu_family_count, 0)::int AS hindu_family_count,
         COALESCE(js.muslim_family_count, 0)::int AS muslim_family_count,
         COALESCE(js.isai_family_count, 0)::int AS isai_family_count,
         COALESCE(js.other_family_count, 0)::int AS other_family_count
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
       LEFT JOIN LATERAL (
         SELECT
           SUM(CASE WHEN e.religion = 'hindu' THEN e.member_count ELSE 0 END) AS hindu_member_count,
           SUM(CASE WHEN e.religion = 'muslim' THEN e.member_count ELSE 0 END) AS muslim_member_count,
           SUM(CASE WHEN e.religion = 'isai' THEN e.member_count ELSE 0 END) AS isai_member_count,
           SUM(CASE WHEN e.religion = 'other' THEN e.member_count ELSE 0 END) AS other_member_count,
           SUM(CASE WHEN e.religion = 'hindu' THEN e.family_count ELSE 0 END) AS hindu_family_count,
           SUM(CASE WHEN e.religion = 'muslim' THEN e.family_count ELSE 0 END) AS muslim_family_count,
           SUM(CASE WHEN e.religion = 'isai' THEN e.family_count ELSE 0 END) AS isai_family_count,
           SUM(CASE WHEN e.religion = 'other' THEN e.family_count ELSE 0 END) AS other_family_count
         FROM karyakarini_jansankhiya_entries e
         WHERE e.version_id = n.version_id
           AND e.node_id = n.id
       ) js ON true
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

  static async hasNodeAccess({ nodeId, userId, userRole, versionId, includeSelf = true }) {
    if (userRole === 'superadmin') return true;
    const targetNodeId = Number(nodeId);
    if (!Number.isFinite(targetNodeId) || targetNodeId <= 0) return false;
    const assignableNodeIds = await this.getAssignableNodeIds(userId, versionId);
    if (!assignableNodeIds.length) return false;
    if (!assignableNodeIds.includes(targetNodeId)) return false;
    if (includeSelf) return true;

    const scopeRoots = await this.getScopeRootNodes({ userId, versionId });
    const scopeRootSet = new Set(scopeRoots.map((row) => Number(row.node_id)).filter((id) => Number.isFinite(id) && id > 0));
    return !scopeRootSet.has(targetNodeId);
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

  static async countChildNodes(nodeId, versionId) {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM karyakarini_nodes
       WHERE parent_id = $1 AND version_id = $2`,
      [nodeId, versionId]
    );
    return Number(result.rows[0]?.total || 0);
  }

  static async getNodeSubtree(nodeId, versionId, includeSelf = true) {
    const result = await pool.query(
      `WITH RECURSIVE subtree AS (
         SELECT id, name, level, parent_id, 0 AS depth
         FROM karyakarini_nodes
         WHERE id = $1 AND version_id = $2
         UNION ALL
         SELECT c.id, c.name, c.level, c.parent_id, s.depth + 1
         FROM karyakarini_nodes c
         JOIN subtree s ON c.parent_id = s.id
         WHERE c.version_id = $2
       )
       SELECT id, name, level, parent_id, depth
       FROM subtree
       ${includeSelf ? '' : 'WHERE depth > 0'}
       ORDER BY depth ASC, name ASC`,
      [nodeId, versionId]
    );
    return result.rows;
  }

  static async bulkUpdateSubtree({ nodeId, versionId, name, level, includeSelf = true }) {
    const subtree = await this.getNodeSubtree(nodeId, versionId, includeSelf);
    if (!subtree.length) return { count: 0, nodes: [] };
    const ids = subtree.map((r) => Number(r.id));
    const result = await pool.query(
      `UPDATE karyakarini_nodes
       SET name = $1, level = $2, updated_at = NOW()
       WHERE version_id = $3 AND id = ANY($4::bigint[])
       RETURNING id, name, level`,
      [name, level, versionId, ids]
    );
    return { count: result.rowCount, nodes: result.rows };
  }

  static async deleteNode({ nodeId, versionId }) {
    const node = await this.getNodeById(nodeId, versionId);
    if (!node) return { status: 'not_found' };

    const childCount = await this.countChildNodes(nodeId, versionId);
    if (childCount > 0) {
      return { status: 'has_children', childCount };
    }

    await pool.query(
      `DELETE FROM karyakarini_nodes WHERE id = $1 AND version_id = $2`,
      [nodeId, versionId]
    );
    return { status: 'deleted', node };
  }

  // Validates that a node of `childLevel` may sit under a parent of `parentLevel`
  // (parentLevel === null means it would be a root node). Enforcement is lenient:
  // levels with no configured rule are unrestricted, and a missing table is ignored.
  static async checkLevelConstraint(childLevel, parentLevel) {
    const child = String(childLevel || '').trim().toLowerCase();
    if (!child) return { ok: true };
    const parent = parentLevel ? String(parentLevel).trim().toLowerCase() : null;

    let rows;
    try {
      const result = await pool.query(
        `SELECT parent_level FROM level_constraints WHERE child_level = $1`,
        [child]
      );
      rows = result.rows;
    } catch (err) {
      return { ok: true };
    }
    if (!rows.length) return { ok: true };

    const allowed = rows.map((r) => (r.parent_level === null ? null : String(r.parent_level).toLowerCase()));
    const labelOf = async (code) => {
      if (!code) return null;
      try {
        const r = await pool.query(`SELECT name FROM levels WHERE LOWER(code) = $1 LIMIT 1`, [code]);
        return r.rows[0]?.name || code;
      } catch (err) {
        return code;
      }
    };

    if (parent === null) {
      if (allowed.includes(null)) return { ok: true };
      const childName = await labelOf(child);
      return { ok: false, message: `"${childName}" को बिना पैरेंट (रूट) नहीं रखा जा सकता` };
    }
    if (allowed.includes(parent)) return { ok: true };
    const childName = await labelOf(child);
    const parentName = await labelOf(parent);
    return { ok: false, message: `"${childName}" को "${parentName}" के नीचे नहीं रखा जा सकता` };
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
    userRole = 'user',
  }) {
    const mobile = this.sanitizeMobile(mobileNumber);
    const trimmedName = String(name || '').trim();
    const fallbackFatherName = fatherOrHusbandName ? String(fatherOrHusbandName).trim() : 'Unknown';
    const requestedId = Number(requestedUserId);
    const hasRequestedId = Number.isFinite(requestedId) && requestedId > 0;
    const email = mobile ? `${mobile}@emeelan.com` : null;
    const requestedPassword = String(password || '').trim();
    const registerPassword = requestedPassword || process.env.DEFAULT_NEW_USER_PASSWORD || 'welcome';
    const normalizedUserRole = String(userRole || 'user').trim().toLowerCase() === 'admin' ? 'admin' : 'user';
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
           role = COALESCE(NULLIF($8, ''), role),
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
        normalizedUserRole,
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

    if (normalizedUserRole === 'admin' && Number(nodeId) > 0 && Number(versionId) > 0) {
      await this.setAdminScope({
        userId,
        nodeId: Number(nodeId),
        versionId: Number(versionId),
        isActive: true,
        createdBy: createdBy || null,
      });
    }

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

  static normalizeGenderType(value) {
    const v = String(value || '').trim().toLowerCase();
    return OTHER_INFO_GENDERS.includes(v) ? v : null;
  }

  static normalizeReligion(value) {
    const v = String(value || '').trim().toLowerCase();
    return OTHER_INFO_RELIGIONS.includes(v) ? v : null;
  }

  static async getUserOtherInfo(userId) {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return null;
    const r = await pool.query(
      `SELECT user_id, gender_type, religion FROM user_other_information WHERE user_id = $1 LIMIT 1`,
      [id]
    );
    return r.rows[0] || null;
  }

  static async upsertUserOtherInfo({ userId, genderType, religion, createdBy = null }) {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) throw new Error('Valid userId is required');
    const g = this.normalizeGenderType(genderType);
    const rel = this.normalizeReligion(religion);
    if (!g && !rel) return this.getUserOtherInfo(id);
    const r = await pool.query(
      `INSERT INTO user_other_information (user_id, gender_type, religion, created_by, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         gender_type = COALESCE(EXCLUDED.gender_type, user_other_information.gender_type),
         religion = COALESCE(EXCLUDED.religion, user_other_information.religion),
         updated_at = NOW()
       RETURNING user_id, gender_type, religion`,
      [id, g, rel, createdBy]
    );
    return r.rows[0];
  }

  static async getDirectVillageScopeNodes({ userId, versionId }) {
    const safeUserId = Number(userId);
    const safeVersionId = Number(versionId);
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) return [];
    if (!Number.isFinite(safeVersionId) || safeVersionId <= 0) return [];

    const result = await pool.query(
      `SELECT
         s.node_id,
         n.name AS node_name,
         LOWER(n.level) AS node_level,
         COALESCE(js.hindu_family_count, 0)::int AS hindu_family_count,
         COALESCE(js.isai_family_count, 0)::int AS isai_family_count,
         COALESCE(js.muslim_family_count, 0)::int AS muslim_family_count,
         COALESCE(js.other_family_count, 0)::int AS other_family_count,
         COALESCE(js.hindu_member_count, 0)::int AS hindu_member_count,
         COALESCE(js.isai_member_count, 0)::int AS isai_member_count,
         COALESCE(js.muslim_member_count, 0)::int AS muslim_member_count,
         COALESCE(js.other_member_count, 0)::int AS other_member_count
       FROM karyakarini_admin_scopes s
       JOIN karyakarini_nodes n ON n.id = s.node_id
       LEFT JOIN LATERAL (
         SELECT
           SUM(CASE WHEN e.religion = 'hindu' THEN e.family_count ELSE 0 END) AS hindu_family_count,
           SUM(CASE WHEN e.religion = 'isai' THEN e.family_count ELSE 0 END) AS isai_family_count,
           SUM(CASE WHEN e.religion = 'muslim' THEN e.family_count ELSE 0 END) AS muslim_family_count,
           SUM(CASE WHEN e.religion = 'other' THEN e.family_count ELSE 0 END) AS other_family_count,
           SUM(CASE WHEN e.religion = 'hindu' THEN e.member_count ELSE 0 END) AS hindu_member_count,
           SUM(CASE WHEN e.religion = 'isai' THEN e.member_count ELSE 0 END) AS isai_member_count,
           SUM(CASE WHEN e.religion = 'muslim' THEN e.member_count ELSE 0 END) AS muslim_member_count,
           SUM(CASE WHEN e.religion = 'other' THEN e.member_count ELSE 0 END) AS other_member_count
         FROM karyakarini_jansankhiya_entries e
         WHERE e.version_id = s.version_id
           AND e.node_id = s.node_id
       ) js ON true
       WHERE s.user_id = $1
         AND s.version_id = $2
         AND s.is_active = true
         AND LOWER(n.level) IN ('gram', 'mohalla')
       ORDER BY n.name ASC`,
      [safeUserId, safeVersionId]
    );

    return result.rows.map((row) => ({
      nodeId: Number(row.node_id),
      nodeName: row.node_name,
      nodeLevel: row.node_level,
      familyCounts: {
        hindu: Number(row.hindu_family_count || 0),
        isai: Number(row.isai_family_count || 0),
        muslim: Number(row.muslim_family_count || 0),
        other: Number(row.other_family_count || 0),
      },
      memberCounts: {
        hindu: Number(row.hindu_member_count || 0),
        isai: Number(row.isai_member_count || 0),
        muslim: Number(row.muslim_member_count || 0),
        other: Number(row.other_member_count || 0),
      },
    }));
  }

  static normalizeJansankhiyaCountMap(value) {
    const source = value && typeof value === 'object' ? value : {};
    const out = {};
    JANSANKHIYA_RELIGIONS.forEach((religion) => {
      const raw = Number(source[religion] || 0);
      out[religion] = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
    });
    return out;
  }

  // Jansankhiya aggregation grouped per node level, scoped to the caller's assignable
  // subtree (their assigned node + descendants); gram+mohalla are treated as village.
  static async getJansankhiya({ userId, userRole, versionId, level = null, nodeId = null }) {
    const safeVersionId = Number(versionId);
    if (!Number.isFinite(safeVersionId) || safeVersionId <= 0) return { versionId: null, levels: [] };
    const role = String(userRole || '').trim().toLowerCase();
    const safeNodeId = Number(nodeId);
    const hasNodeFilter = Number.isFinite(safeNodeId) && safeNodeId > 0;

    const editableVillages = await this.getDirectVillageScopeNodes({
      userId,
      versionId: safeVersionId,
    });

    let scopedNodeIds = null;
    if (role !== 'superadmin') {
      scopedNodeIds = await this.getAssignableNodeIds(userId, safeVersionId);
      if (!scopedNodeIds.length) {
        return {
          versionId: safeVersionId,
          levels: [],
          canEdit: editableVillages.length > 0,
          editableVillages,
        };
      }
    }

    let selectedNode = null;
    let nodeScopedIds = null;
    if (hasNodeFilter) {
      const nodeRes = await pool.query(
        `SELECT id, name, LOWER(level) AS level
         FROM karyakarini_nodes
         WHERE id = $1
           AND version_id = $2
         LIMIT 1`,
        [safeNodeId, safeVersionId]
      );
      const node = nodeRes.rows[0];
      if (!node) {
        throw new Error('Selected node not found');
      }

      if (Array.isArray(scopedNodeIds)) {
        const scopedSet = new Set(scopedNodeIds.map((id) => Number(id)));
        if (!scopedSet.has(safeNodeId)) {
          throw new Error('You can filter only within your assigned scope');
        }
      }

      const subtreeRes = await pool.query(
        `WITH RECURSIVE subtree AS (
           SELECT id
           FROM karyakarini_nodes
           WHERE id = $1
             AND version_id = $2
           UNION ALL
           SELECT c.id
           FROM karyakarini_nodes c
           JOIN subtree s ON c.parent_id = s.id
           WHERE c.version_id = $2
         )
         SELECT id FROM subtree`,
        [safeNodeId, safeVersionId]
      );
      nodeScopedIds = subtreeRes.rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);

      const breadcrumb = await this.getNodeBreadcrumb(safeNodeId, safeVersionId);
      selectedNode = {
        nodeId: safeNodeId,
        nodeName: node.name,
        nodeLevel: node.level,
        hierarchyPath: breadcrumb.map((entry) => entry.name).join(' > '),
      };
    }

    let effectiveNodeIds = null;
    if (Array.isArray(scopedNodeIds) && Array.isArray(nodeScopedIds)) {
      const scopedSet = new Set(scopedNodeIds.map((id) => Number(id)));
      effectiveNodeIds = nodeScopedIds.filter((id) => scopedSet.has(Number(id)));
    } else if (Array.isArray(scopedNodeIds)) {
      effectiveNodeIds = scopedNodeIds;
    } else if (Array.isArray(nodeScopedIds)) {
      effectiveNodeIds = nodeScopedIds;
    }

    if (Array.isArray(effectiveNodeIds) && !effectiveNodeIds.length) {
      return {
        versionId: safeVersionId,
        levels: [],
        canEdit: editableVillages.length > 0,
        editableVillages,
        selectedNode,
      };
    }

    const params = [safeVersionId];
    let nodeFilter = '';
    if (Array.isArray(effectiveNodeIds)) {
      params.push(effectiveNodeIds);
      nodeFilter = `AND e.node_id = ANY($${params.length})`;
    }
    let levelFilter = '';
    const safeLevel = level ? String(level).trim().toLowerCase() : null;
    if (safeLevel) {
      if (safeLevel === 'village') {
        levelFilter = `AND LOWER(n.level) IN ('gram', 'mohalla')`;
      } else {
        params.push(safeLevel);
        levelFilter = `AND LOWER(n.level) = $${params.length}`;
      }
    }

    const result = await pool.query(
      `SELECT
         CASE WHEN LOWER(n.level) IN ('gram', 'mohalla') THEN 'village' ELSE LOWER(n.level) END AS level_code,
         COALESCE(
           MAX(CASE WHEN LOWER(n.level) IN ('gram', 'mohalla') THEN 'ग्राम/मोहल्ला' ELSE l.name END),
           MAX(CASE WHEN LOWER(n.level) IN ('gram', 'mohalla') THEN 'ग्राम/मोहल्ला' ELSE n.level END)
         ) AS level_name,
         MIN(l.level_order) AS level_order,
         COALESCE(SUM(e.family_count) FILTER (WHERE e.religion = 'hindu'), 0)::int AS family_hindu,
         COALESCE(SUM(e.family_count) FILTER (WHERE e.religion = 'isai'), 0)::int AS family_isai,
         COALESCE(SUM(e.family_count) FILTER (WHERE e.religion = 'muslim'), 0)::int AS family_muslim,
         COALESCE(SUM(e.family_count) FILTER (WHERE e.religion = 'other'), 0)::int AS family_other,
         COALESCE(SUM(e.member_count) FILTER (WHERE e.religion = 'hindu'), 0)::int AS member_hindu,
         COALESCE(SUM(e.member_count) FILTER (WHERE e.religion = 'isai'), 0)::int AS member_isai,
         COALESCE(SUM(e.member_count) FILTER (WHERE e.religion = 'muslim'), 0)::int AS member_muslim,
         COALESCE(SUM(e.member_count) FILTER (WHERE e.religion = 'other'), 0)::int AS member_other
       FROM karyakarini_jansankhiya_entries e
       JOIN karyakarini_nodes n ON n.id = e.node_id
       LEFT JOIN levels l ON LOWER(l.code) = LOWER(n.level)
       WHERE e.version_id = $1
         ${nodeFilter}
         ${levelFilter}
       GROUP BY CASE WHEN LOWER(n.level) IN ('gram', 'mohalla') THEN 'village' ELSE LOWER(n.level) END
       ORDER BY MIN(l.level_order) NULLS LAST, level_code`,
      params
    );

    const levels = result.rows.map((row) => ({
      levelCode: row.level_code,
      levelName: row.level_name || row.level_code,
      levelOrder: row.level_order != null ? Number(row.level_order) : null,
      familyHindu: Number(row.family_hindu || 0),
      familyIsai: Number(row.family_isai || 0),
      familyMuslim: Number(row.family_muslim || 0),
      familyOther: Number(row.family_other || 0),
      familyTotal:
        Number(row.family_hindu || 0) +
        Number(row.family_isai || 0) +
        Number(row.family_muslim || 0) +
        Number(row.family_other || 0),
      memberHindu: Number(row.member_hindu || 0),
      memberIsai: Number(row.member_isai || 0),
      memberMuslim: Number(row.member_muslim || 0),
      memberOther: Number(row.member_other || 0),
      memberTotal:
        Number(row.member_hindu || 0) +
        Number(row.member_isai || 0) +
        Number(row.member_muslim || 0) +
        Number(row.member_other || 0),
    }));

    let nodeRows = [];
    if (Array.isArray(effectiveNodeIds) && effectiveNodeIds.length > 0) {
      const nodeRowsRes = await pool.query(
        `SELECT
           n.id AS node_id,
           n.name AS node_name,
           LOWER(n.level) AS node_level,
           COALESCE(SUM(e.family_count) FILTER (WHERE e.religion = 'hindu'), 0)::int AS family_hindu,
           COALESCE(SUM(e.family_count) FILTER (WHERE e.religion = 'isai'), 0)::int AS family_isai,
           COALESCE(SUM(e.family_count) FILTER (WHERE e.religion = 'muslim'), 0)::int AS family_muslim,
           COALESCE(SUM(e.family_count) FILTER (WHERE e.religion = 'other'), 0)::int AS family_other,
           COALESCE(SUM(e.member_count) FILTER (WHERE e.religion = 'hindu'), 0)::int AS member_hindu,
           COALESCE(SUM(e.member_count) FILTER (WHERE e.religion = 'isai'), 0)::int AS member_isai,
           COALESCE(SUM(e.member_count) FILTER (WHERE e.religion = 'muslim'), 0)::int AS member_muslim,
           COALESCE(SUM(e.member_count) FILTER (WHERE e.religion = 'other'), 0)::int AS member_other
         FROM karyakarini_nodes n
         LEFT JOIN karyakarini_jansankhiya_entries e
           ON e.version_id = $1
          AND e.node_id = n.id
         WHERE n.version_id = $1
           AND n.id = ANY($2::bigint[])
           AND ($3::bigint IS NULL OR n.id <> $3::bigint)
           AND LOWER(n.level) IN ('gram', 'mohalla')
         GROUP BY n.id, n.name, n.level
         ORDER BY n.name ASC, n.id ASC`,
        [safeVersionId, effectiveNodeIds, hasNodeFilter ? safeNodeId : null]
      );

      nodeRows = nodeRowsRes.rows.map((row) => ({
        nodeId: Number(row.node_id),
        nodeName: row.node_name,
        nodeLevel: row.node_level,
        familyHindu: Number(row.family_hindu || 0),
        familyIsai: Number(row.family_isai || 0),
        familyMuslim: Number(row.family_muslim || 0),
        familyOther: Number(row.family_other || 0),
        familyTotal:
          Number(row.family_hindu || 0) +
          Number(row.family_isai || 0) +
          Number(row.family_muslim || 0) +
          Number(row.family_other || 0),
        memberHindu: Number(row.member_hindu || 0),
        memberIsai: Number(row.member_isai || 0),
        memberMuslim: Number(row.member_muslim || 0),
        memberOther: Number(row.member_other || 0),
        memberTotal:
          Number(row.member_hindu || 0) +
          Number(row.member_isai || 0) +
          Number(row.member_muslim || 0) +
          Number(row.member_other || 0),
      }));
    }

    return {
      versionId: safeVersionId,
      levels,
      nodeRows,
      canEdit: editableVillages.length > 0,
      editableVillages,
      selectedNode,
    };
  }

  static async upsertJansankhiyaEntry({ userId, userRole, versionId, nodeId, familyCounts = {}, memberCounts = {} }) {
    const safeVersionId = Number(versionId);
    const safeNodeId = Number(nodeId);
    const safeUserId = Number(userId);
    const role = String(userRole || '').trim().toLowerCase();

    if (!Number.isFinite(safeVersionId) || safeVersionId <= 0) throw new Error('Valid versionId is required');
    if (!Number.isFinite(safeNodeId) || safeNodeId <= 0) throw new Error('Valid nodeId is required');

    const nodeRes = await pool.query(
      `SELECT id, name, LOWER(level) AS level
       FROM karyakarini_nodes
       WHERE id = $1 AND version_id = $2
       LIMIT 1`,
      [safeNodeId, safeVersionId]
    );
    const node = nodeRes.rows[0];
    if (!node) throw new Error('Village node not found');
    if (!['gram', 'mohalla'].includes(node.level)) {
      throw new Error('Counts can be updated only for ग्राम/मोहल्ला level nodes');
    }

    if (role !== 'superadmin') {
      const editableVillages = await this.getDirectVillageScopeNodes({
        userId: safeUserId,
        versionId: safeVersionId,
      });
      const editableNodeSet = new Set(editableVillages.map((row) => Number(row.nodeId)));
      if (!editableNodeSet.has(safeNodeId)) {
        throw new Error('You can update counts only for your assigned village');
      }
    }

    const normalizedFamily = this.normalizeJansankhiyaCountMap(familyCounts);
    const normalizedMembers = this.normalizeJansankhiyaCountMap(memberCounts);

    await pool.query('BEGIN');
    try {
      for (const religion of JANSANKHIYA_RELIGIONS) {
        await pool.query(
          `INSERT INTO karyakarini_jansankhiya_entries
             (version_id, node_id, religion, family_count, member_count, created_by, updated_by, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (version_id, node_id, religion) DO UPDATE SET
             family_count = EXCLUDED.family_count,
             member_count = EXCLUDED.member_count,
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()`,
          [
            safeVersionId,
            safeNodeId,
            religion,
            normalizedFamily[religion],
            normalizedMembers[religion],
            Number.isFinite(safeUserId) && safeUserId > 0 ? safeUserId : null,
            Number.isFinite(safeUserId) && safeUserId > 0 ? safeUserId : null,
          ]
        );
      }
      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

    return {
      versionId: safeVersionId,
      nodeId: safeNodeId,
      nodeName: node.name,
      nodeLevel: node.level,
      familyCounts: normalizedFamily,
      memberCounts: normalizedMembers,
    };
  }

  static async getJangarna(args) {
    return this.getJansankhiya(args);
  }

  // Active categories (आयाम) with their active subcategories (टोली), from the
  // shared master-data tables so the UI always reflects current admin edits.
  static async getCategoryTree() {
    const result = await pool.query(
      `SELECT c.name AS category,
              COALESCE(
                json_agg(s.name ORDER BY s.name) FILTER (WHERE s.id IS NOT NULL),
                '[]'
              ) AS subcategories
       FROM categories c
       LEFT JOIN subcategories s ON s.category_id = c.id AND s.is_active = true
       WHERE c.is_active = true
       GROUP BY c.id, c.name
       ORDER BY c.name ASC`
    );
    return result.rows.map((row) => ({
      category: row.category,
      subcategories: Array.isArray(row.subcategories) ? row.subcategories : [],
    }));
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
    userRole,
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
    const nextUserRole =
      userRole !== undefined
        ? String(userRole || '').trim().toLowerCase() === 'admin'
          ? 'admin'
          : 'user'
        : null;

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
               role = COALESCE(NULLIF($7, ''), role),
               updated_at = NOW()
           WHERE id = $6`,
          [
            String(nextName || '').trim(),
            String(fatherOrHusbandName || '').trim(),
            String(nextMobile || '').trim(),
            String(nextVillage || '').trim(),
            String(nextAvatar || '').trim(),
            safeUserId,
            nextUserRole,
          ]
        );
        if (nextUserRole === 'admin') {
          await this.setAdminScope({
            userId: safeUserId,
            nodeId: Number(existing.node_id),
            versionId: safeVersionId,
            isActive: true,
            createdBy: safeUserId,
          });
        } else if (nextUserRole === 'user') {
          await this.setAdminScope({
            userId: safeUserId,
            nodeId: Number(existing.node_id),
            versionId: safeVersionId,
            isActive: false,
            createdBy: safeUserId,
          });
        }
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
           COALESCE(to_jsonb(u) ->> 'role', 'user') AS user_role,
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

  static async getMembersByNode({ nodeId, versionId, page = 1, limit = 20, category, subcategory }) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const hasCategory = Boolean(category);
    const hasSubcategory = Boolean(subcategory);

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
         AND m.is_active = true
         AND ($3::boolean = false OR (
           m.categories @> jsonb_build_array($4::text) OR 
           lower(COALESCE(m.category, '')) = lower($4::text)
         ))
         AND ($5::boolean = false OR (
           m.subcategories @> jsonb_build_array($6::text) OR 
           lower(COALESCE(m.subcategory, '')) = lower($6::text)
         ))`,
      [nodeId, versionId, hasCategory, category || '', hasSubcategory, subcategory || '']
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
         COALESCE(to_jsonb(u) ->> 'role', 'user') AS user_role,
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
         AND ($5::boolean = false OR (
           m.categories @> jsonb_build_array($6::text) OR 
           lower(COALESCE(m.category, '')) = lower($6::text)
         ))
         AND ($7::boolean = false OR (
           m.subcategories @> jsonb_build_array($8::text) OR 
           lower(COALESCE(m.subcategory, '')) = lower($8::text)
         ))
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT $3 OFFSET $4`,
      [nodeId, versionId, safeLimit, offset, hasCategory, category || '', hasSubcategory, subcategory || '']
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

  static async getReportMembers({
    versionId,
    visibleNodeIds = [],
    page = 1,
    limit = 20,
    category = '',
    subcategory = '',
    nodeLevel = '',
    pad = '',
    query = '',
  }) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;
    if (!visibleNodeIds.length) {
      return {
        rows: [],
        pagination: { page: safePage, limit: safeLimit, total: 0, totalPages: 0 },
      };
    }

    const normalizedCategory = String(category || '').trim().toLowerCase();
    const normalizedSubcategory = String(subcategory || '').trim().toLowerCase();
    const normalizedNodeLevel = String(nodeLevel || '').trim().toLowerCase();
    const normalizedPad = String(pad || '').trim().toLowerCase();
    const normalizedQuery = String(query || '').trim();
    const hasCategory = Boolean(normalizedCategory);
    const hasSubcategory = Boolean(normalizedSubcategory);
    const hasNodeLevel = Boolean(normalizedNodeLevel);
    const hasPad = Boolean(normalizedPad);
    const hasQuery = normalizedQuery.length > 0;
    const queryLike = `%${normalizedQuery}%`;

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM karyakarini_members m
       JOIN karyakarini_nodes n ON n.id = m.node_id
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.version_id = $1
         AND m.is_active = true
         AND m.node_id = ANY($2::bigint[])
         AND ($3::boolean = false OR lower(COALESCE(m.category, '')) = $4 OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(m.categories, '[]'::jsonb)) AS cat(value) WHERE lower(trim(cat.value)) = $4))
         AND ($5::boolean = false OR lower(COALESCE(m.subcategory, '')) = $6 OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(m.subcategories, '[]'::jsonb)) AS sub(value) WHERE lower(trim(sub.value)) = $6))
         AND ($7::boolean = false OR lower(COALESCE(n.level, '')) = $8)
         AND ($9::boolean = false OR lower(COALESCE(m.pad, '')) = $10)
         AND (
           $11::boolean = false
           OR lower(COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name', m.name, '')) ILIKE $12
           OR lower(COALESCE(to_jsonb(u) ->> 'father_name', to_jsonb(u) ->> 'last_name', '')) ILIKE $12
           OR lower(COALESCE(to_jsonb(u) ->> 'phone', to_jsonb(u) ->> 'mobile_number', to_jsonb(u) ->> 'mobile', m.mobile, '')) ILIKE $12
           OR lower(COALESCE(n.name, '')) ILIKE $12
         )`,
      [
        Number(versionId),
        visibleNodeIds,
        hasCategory,
        normalizedCategory,
        hasSubcategory,
        normalizedSubcategory,
        hasNodeLevel,
        normalizedNodeLevel,
        hasPad,
        normalizedPad,
        hasQuery,
        queryLike,
      ]
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const rowsResult = await pool.query(
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
         COALESCE(to_jsonb(u) ->> 'role', 'user') AS user_role,
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
       JOIN karyakarini_nodes n ON n.id = m.node_id
       LEFT JOIN users u ON u.id = m.user_id
       LEFT JOIN node_paths np ON np.id = m.node_id
       WHERE m.version_id = $1
         AND m.is_active = true
         AND m.node_id = ANY($2::bigint[])
         AND ($3::boolean = false OR lower(COALESCE(m.category, '')) = $4 OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(m.categories, '[]'::jsonb)) AS cat(value) WHERE lower(trim(cat.value)) = $4))
         AND ($5::boolean = false OR lower(COALESCE(m.subcategory, '')) = $6 OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(m.subcategories, '[]'::jsonb)) AS sub(value) WHERE lower(trim(sub.value)) = $6))
         AND ($7::boolean = false OR lower(COALESCE(n.level, '')) = $8)
         AND ($9::boolean = false OR lower(COALESCE(m.pad, '')) = $10)
         AND (
           $11::boolean = false
           OR lower(COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name', m.name, '')) ILIKE $12
           OR lower(COALESCE(to_jsonb(u) ->> 'father_name', to_jsonb(u) ->> 'last_name', '')) ILIKE $12
           OR lower(COALESCE(to_jsonb(u) ->> 'phone', to_jsonb(u) ->> 'mobile_number', to_jsonb(u) ->> 'mobile', m.mobile, '')) ILIKE $12
           OR lower(COALESCE(n.name, '')) ILIKE $12
         )
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT $13 OFFSET $14`,
      [
        Number(versionId),
        visibleNodeIds,
        hasCategory,
        normalizedCategory,
        hasSubcategory,
        normalizedSubcategory,
        hasNodeLevel,
        normalizedNodeLevel,
        hasPad,
        normalizedPad,
        hasQuery,
        queryLike,
        safeLimit,
        offset,
      ]
    );

    return {
      rows: rowsResult.rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  static async searchUsersForAssignment({ query, limit = 12, versionId = null, nodeId = null, allowedNodeIds = null }) {
    const safeQuery = String(query || '').trim();
    if (!safeQuery || safeQuery.length < 3) return [];
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 12));

    const safeVersionId = Number(versionId || 0);
    const safeNodeId = Number(nodeId || 0);
    const scopedNodeIds = Array.isArray(allowedNodeIds)
      ? [...new Set(allowedNodeIds.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry) && entry > 0))]
      : null;

    if (safeVersionId > 0 && Array.isArray(scopedNodeIds) && scopedNodeIds.length === 0) {
      return [];
    }

    if (safeVersionId > 0 && Array.isArray(scopedNodeIds) && scopedNodeIds.length > 0) {
      const scopedResult = await pool.query(
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
         ),
         scoped_subtree AS (
           SELECT id
           FROM karyakarini_nodes
           WHERE $4::bigint IS NOT NULL
             AND id = $4::bigint
             AND version_id = $2
           UNION ALL
           SELECT c.id
           FROM karyakarini_nodes c
           JOIN scoped_subtree s ON c.parent_id = s.id
           WHERE c.version_id = $2
         ),
         candidate_rows AS (
           SELECT
             u.id,
             COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name') AS first_name,
             COALESCE(to_jsonb(u) ->> 'father_name', to_jsonb(u) ->> 'last_name') AS father_name,
             COALESCE(to_jsonb(u) ->> 'email', '') AS email,
             COALESCE(to_jsonb(u) ->> 'phone', to_jsonb(u) ->> 'mobile_number', to_jsonb(u) ->> 'mobile') AS phone,
             COALESCE(to_jsonb(u) ->> 'gotra', '') AS gotra,
             COALESCE(to_jsonb(u) ->> 'village', '') AS village,
             COALESCE(to_jsonb(u) ->> 'profile_photo_url', to_jsonb(u) ->> 'avatar', to_jsonb(u) ->> 'photo_url') AS avatar,
             COALESCE(NULLIF(trim(m.pad), ''), '-') AS position,
             n.level AS node_level,
             n.name AS node_name,
             COALESCE(np.path, n.name) AS hierarchy_path,
             m.created_at,
             ROW_NUMBER() OVER (PARTITION BY u.id ORDER BY m.created_at DESC, m.id DESC) AS rn
           FROM karyakarini_members m
           JOIN users u ON u.id = m.user_id
           JOIN karyakarini_nodes n ON n.id = m.node_id AND n.version_id = m.version_id
           LEFT JOIN node_paths np ON np.id = m.node_id
           WHERE m.version_id = $2
             AND m.is_active = true
             AND m.user_id IS NOT NULL
             AND m.node_id = ANY($3::bigint[])
             AND ($4::bigint IS NULL OR m.node_id IN (SELECT id FROM scoped_subtree))
             AND (
               COALESCE(to_jsonb(u) ->> 'email', '') ILIKE $1
               OR COALESCE(to_jsonb(u) ->> 'phone', to_jsonb(u) ->> 'mobile_number', to_jsonb(u) ->> 'mobile', m.mobile, '') ILIKE $1
               OR COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name', '') ILIKE $1
               OR COALESCE(to_jsonb(u) ->> 'father_name', to_jsonb(u) ->> 'last_name', '') ILIKE $1
               OR COALESCE(NULLIF(trim(m.pad), ''), '') ILIKE $1
               OR COALESCE(n.name, '') ILIKE $1
               OR COALESCE(np.path, '') ILIKE $1
               OR u.id::text ILIKE $1
               OR m.user_id::text ILIKE $1
               OR m.id::text ILIKE $1
             )
         )
         SELECT
           id,
           first_name,
           father_name,
           email,
           phone,
           gotra,
           village,
           avatar,
           position,
           node_level,
           node_name,
           hierarchy_path
         FROM candidate_rows
         WHERE rn = 1
         ORDER BY id DESC
         LIMIT $5`,
        [`%${safeQuery}%`, safeVersionId, scopedNodeIds, safeNodeId > 0 ? safeNodeId : null, safeLimit]
      );
      return scopedResult.rows;
    }

    const result = await pool.query(
      `SELECT
         u.id,
         COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name') AS first_name,
         COALESCE(to_jsonb(u) ->> 'father_name', to_jsonb(u) ->> 'last_name') AS father_name,
         COALESCE(to_jsonb(u) ->> 'email', '') AS email,
         COALESCE(to_jsonb(u) ->> 'phone', to_jsonb(u) ->> 'mobile_number', to_jsonb(u) ->> 'mobile') AS phone,
         COALESCE(to_jsonb(u) ->> 'gotra', '') AS gotra,
         COALESCE(to_jsonb(u) ->> 'village', '') AS village,
         COALESCE(to_jsonb(u) ->> 'profile_photo_url', to_jsonb(u) ->> 'avatar', to_jsonb(u) ->> 'photo_url') AS avatar,
         NULL::text AS position,
         NULL::text AS node_level,
         NULL::text AS node_name,
         NULL::text AS hierarchy_path
       FROM users u
       WHERE (
         COALESCE(to_jsonb(u) ->> 'email', '') ILIKE $1
         OR COALESCE(to_jsonb(u) ->> 'phone', to_jsonb(u) ->> 'mobile_number', to_jsonb(u) ->> 'mobile', '') ILIKE $1
         OR COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name', '') ILIKE $1
         OR COALESCE(to_jsonb(u) ->> 'father_name', to_jsonb(u) ->> 'last_name', '') ILIKE $1
         OR u.id::text ILIKE $1
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
         COALESCE(np.path, n.name) AS hierarchy_path,
         COALESCE(js.hindu_member_count, 0)::int AS hindu_member_count,
         COALESCE(js.muslim_member_count, 0)::int AS muslim_member_count,
         COALESCE(js.isai_member_count, 0)::int AS isai_member_count,
         COALESCE(js.other_member_count, 0)::int AS other_member_count,
         COALESCE(js.hindu_family_count, 0)::int AS hindu_family_count,
         COALESCE(js.muslim_family_count, 0)::int AS muslim_family_count,
         COALESCE(js.isai_family_count, 0)::int AS isai_family_count,
         COALESCE(js.other_family_count, 0)::int AS other_family_count
       FROM karyakarini_nodes n
       LEFT JOIN node_paths np ON np.id = n.id
       LEFT JOIN LATERAL (
         SELECT
           SUM(CASE WHEN e.religion = 'hindu' THEN e.member_count ELSE 0 END) AS hindu_member_count,
           SUM(CASE WHEN e.religion = 'muslim' THEN e.member_count ELSE 0 END) AS muslim_member_count,
           SUM(CASE WHEN e.religion = 'isai' THEN e.member_count ELSE 0 END) AS isai_member_count,
           SUM(CASE WHEN e.religion = 'other' THEN e.member_count ELSE 0 END) AS other_member_count,
           SUM(CASE WHEN e.religion = 'hindu' THEN e.family_count ELSE 0 END) AS hindu_family_count,
           SUM(CASE WHEN e.religion = 'muslim' THEN e.family_count ELSE 0 END) AS muslim_family_count,
           SUM(CASE WHEN e.religion = 'isai' THEN e.family_count ELSE 0 END) AS isai_family_count,
           SUM(CASE WHEN e.religion = 'other' THEN e.family_count ELSE 0 END) AS other_family_count
         FROM karyakarini_jansankhiya_entries e
         WHERE e.version_id = n.version_id
           AND e.node_id = n.id
       ) js ON true
       WHERE n.version_id = $1
         AND n.id = ANY($2::bigint[])
       ORDER BY COALESCE(np.path, n.name) ASC, n.id ASC`,
      [versionId, visibleNodeIds]
    );

    return result.rows;
  }

  static async getNodeMembersDirect({ nodeId, versionId }) {
    const result = await pool.query(
      `WITH RECURSIVE subtree AS (
         SELECT id
         FROM karyakarini_nodes
         WHERE id = $1
           AND version_id = $2
         UNION ALL
         SELECT c.id
         FROM karyakarini_nodes c
         JOIN subtree s ON c.parent_id = s.id
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
         COALESCE(to_jsonb(u) ->> 'role', 'user') AS user_role,
         COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name') AS first_name,
         COALESCE(to_jsonb(u) ->> 'father_name', to_jsonb(u) ->> 'last_name') AS father_name,
         COALESCE(to_jsonb(u) ->> 'phone', to_jsonb(u) ->> 'mobile_number', to_jsonb(u) ->> 'mobile', m.mobile) AS mobile_number,
         COALESCE(to_jsonb(u) ->> 'email', '') AS email,
         COALESCE(to_jsonb(u) ->> 'profile_photo_url', to_jsonb(u) ->> 'avatar', to_jsonb(u) ->> 'photo_url') AS avatar,
         n.name AS node_name,
         n.level AS node_level
       FROM karyakarini_members m
       JOIN subtree s ON s.id = m.node_id
       JOIN karyakarini_nodes n ON n.id = m.node_id
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.version_id = $2
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
      `WITH ranked AS (
         SELECT
           km.user_id,
           km.node_id,
           n.level AS node_level,
           n.name AS node_name,
           ROW_NUMBER() OVER (PARTITION BY km.user_id ORDER BY km.created_at DESC, km.id DESC) AS rn
         FROM karyakarini_members km
         JOIN karyakarini_nodes n ON n.id = km.node_id
         WHERE km.version_id = $1
           AND km.is_active = true
           AND km.user_id = ANY($2::int[])
       )
       SELECT user_id, node_id, node_level, node_name
       FROM ranked
       WHERE rn = 1`,
      [versionId, safeUserIds]
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
    const deactivateUserIds = [...oldActiveSet].filter((id) => !safeUserIds.includes(id));
    if (deactivateUserIds.length > 0) {
      await client.query(
        `UPDATE karyakarini_meeting_invites
         SET is_active = false,
             updated_at = NOW()
         WHERE meeting_id = $1
           AND invited_user_id = ANY($2::int[])
           AND is_active = true`,
        [safeMeetingId, deactivateUserIds]
      );
    }

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
      throw new Error('Some invited users are not active in this karyakarini version');
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
         UNION
         SELECT DISTINCT node_id
         FROM karyakarini_admin_scopes
         WHERE user_id = $1
           AND version_id = $2
           AND is_active = true
       ),
       subtree AS (
         SELECT node_id AS id
         FROM roots
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
         m.category,
         m.subcategory,
         m.categories,
         m.subcategories,
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

  static sanitizeCategoryTeamMembers(members) {
    if (!Array.isArray(members)) return [];
    return members
      .map((entry) => {
        const fullName = String(entry?.fullName || entry?.full_name || entry?.name || '').trim();
        const mobileNumber = String(entry?.mobileNumber || entry?.mobile_number || entry?.mobile || '').replace(/\D/g, '').slice(0, 15);
        const profilePhotoUrl = String(entry?.profilePhotoUrl || entry?.profile_photo_url || entry?.avatar || '').trim();
        if (!fullName || !mobileNumber) return null;
        return {
          fullName,
          mobileNumber,
          profilePhotoUrl: profilePhotoUrl || null,
        };
      })
      .filter(Boolean)
      .slice(0, 200);
  }

  static async userHasCategoryAccessInNodeScope({ userId, versionId, nodeId, category }) {
    const safeUserId = Number(userId);
    const safeVersionId = Number(versionId);
    const safeNodeId = Number(nodeId);
    const normalizedCategory = String(category || '').trim().toLowerCase();
    if (!safeUserId || !safeVersionId || !safeNodeId || !normalizedCategory) return false;

    const result = await pool.query(
      `WITH RECURSIVE user_scope AS (
         SELECT m.node_id AS id, m.categories, m.category
         FROM karyakarini_members m
         WHERE m.user_id = $1
           AND m.version_id = $2
           AND m.is_active = true
         UNION ALL
         SELECT c.id, u.categories, u.category
         FROM karyakarini_nodes c
         JOIN user_scope u ON c.parent_id = u.id
         WHERE c.version_id = $2
       )
       SELECT 1
       FROM user_scope u
       WHERE u.id = $3
         AND EXISTS (
           SELECT 1
           FROM jsonb_array_elements_text(
             CASE
               WHEN u.categories IS NOT NULL
                 AND jsonb_typeof(u.categories) = 'array'
                 AND jsonb_array_length(u.categories) > 0
                 THEN u.categories
               WHEN NULLIF(trim(COALESCE(u.category, '')), '') IS NOT NULL
                 THEN jsonb_build_array(trim(u.category))
               ELSE '[]'::jsonb
             END
           ) AS cats(value)
           WHERE lower(trim(cats.value)) = $4
         )
       LIMIT 1`,
      [safeUserId, safeVersionId, safeNodeId, normalizedCategory]
    );
    return Boolean(result.rows[0]);
  }

  static async getCategoryTeamById({ teamId, versionId }) {
    const safeTeamId = Number(teamId);
    const safeVersionId = Number(versionId);
    if (!safeTeamId || !safeVersionId) return null;

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
         t.id,
         t.version_id,
         t.node_id,
         n.name AS node_name,
         n.level AS node_level,
         COALESCE(np.path, n.name) AS hierarchy_path,
         t.created_by,
         COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name', ('User #' || t.created_by::text)) AS created_by_name,
         COALESCE(to_jsonb(u) ->> 'profile_photo_url', to_jsonb(u) ->> 'avatar', to_jsonb(u) ->> 'photo_url') AS created_by_avatar,
         t.category,
         t.subcategory,
         COALESCE(t.team_members, '[]'::jsonb) AS team_members,
         t.created_at,
         t.updated_at
       FROM karyakarini_category_teams t
       JOIN karyakarini_nodes n ON n.id = t.node_id
       LEFT JOIN node_paths np ON np.id = n.id
       LEFT JOIN users u ON u.id = t.created_by
       WHERE t.id = $1
         AND t.version_id = $2
         AND t.is_active = true
       LIMIT 1`,
      [safeTeamId, safeVersionId]
    );
    return result.rows[0] || null;
  }

  static async upsertMyCategoryTeam({
    teamId = null,
    userId,
    versionId,
    nodeId,
    category,
    subcategory = null,
    members = [],
  }) {
    const safeUserId = Number(userId);
    const safeVersionId = Number(versionId);
    const safeNodeId = Number(nodeId);
    const normalizedCategory = String(category || '').trim();
    const normalizedSubcategory = String(subcategory || '').trim();
    const safeMembers = this.sanitizeCategoryTeamMembers(members);
    if (!safeUserId || !safeVersionId || !safeNodeId || !normalizedCategory) return null;

    let resolvedTeamId = Number(teamId || 0);
    if (resolvedTeamId > 0) {
      const updated = await pool.query(
        `UPDATE karyakarini_category_teams
         SET node_id = $1,
             category = $2,
             subcategory = $3,
             team_members = $4::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
           AND version_id = $6
           AND created_by = $7
           AND is_active = true
         RETURNING id`,
        [
          safeNodeId,
          normalizedCategory,
          normalizedSubcategory || null,
          JSON.stringify(safeMembers),
          resolvedTeamId,
          safeVersionId,
          safeUserId,
        ]
      );
      if (updated.rows[0]?.id) {
        resolvedTeamId = Number(updated.rows[0].id);
      } else {
        resolvedTeamId = 0;
      }
    }

    if (!resolvedTeamId) {
      const existing = await pool.query(
        `SELECT id
         FROM karyakarini_category_teams
         WHERE version_id = $1
           AND node_id = $2
           AND created_by = $3
           AND lower(trim(category)) = lower(trim($4))
           AND lower(trim(COALESCE(subcategory, ''))) = lower(trim($5))
           AND is_active = true
         ORDER BY id DESC
         LIMIT 1`,
        [safeVersionId, safeNodeId, safeUserId, normalizedCategory, normalizedSubcategory]
      );

      if (existing.rows[0]?.id) {
        resolvedTeamId = Number(existing.rows[0].id);
        await pool.query(
          `UPDATE karyakarini_category_teams
           SET team_members = $1::jsonb,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [JSON.stringify(safeMembers), resolvedTeamId]
        );
      } else {
        const created = await pool.query(
          `INSERT INTO karyakarini_category_teams (
             version_id, node_id, created_by, category, subcategory, team_members
           )
           VALUES ($1, $2, $3, $4, $5, $6::jsonb)
           RETURNING id`,
          [
            safeVersionId,
            safeNodeId,
            safeUserId,
            normalizedCategory,
            normalizedSubcategory || null,
            JSON.stringify(safeMembers),
          ]
        );
        resolvedTeamId = Number(created.rows[0]?.id || 0);
      }
    }

    if (!resolvedTeamId) return null;
    return this.getCategoryTeamById({ teamId: resolvedTeamId, versionId: safeVersionId });
  }

  static async getVisibleCategoryTeams({
    userId,
    versionId,
    category = '',
    subcategory = '',
  }) {
    const safeUserId = Number(userId);
    const safeVersionId = Number(versionId);
    if (!safeUserId || !safeVersionId) return [];

    const normalizedCategory = String(category || '').trim().toLowerCase();
    const normalizedSubcategory = String(subcategory || '').trim().toLowerCase();
    const hasCategory = Boolean(normalizedCategory);
    const hasSubcategory = Boolean(normalizedSubcategory);

    const levelWeightCase = (alias) => `CASE lower(trim(COALESCE(${alias}, '')))
      WHEN 'rashtriya' THEN 1
      WHEN 'prant' THEN 2
      WHEN 'sambhag' THEN 3
      WHEN 'vibhag' THEN 4
      WHEN 'jila' THEN 5
      WHEN 'khand' THEN 6
      WHEN 'mandal' THEN 7
      WHEN 'nagar' THEN 7
      WHEN 'gram' THEN 8
      WHEN 'basti' THEN 8
      WHEN 'mohalla' THEN 9
      WHEN 'mandal_basti' THEN 8
      WHEN 'nagar_mohalla' THEN 9
      ELSE 99
    END`;

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
       ),
       user_assigned_nodes AS (
         SELECT m.node_id AS id, m.node_id AS root_node_id, m.categories, m.category, n.level AS root_level
         FROM karyakarini_members m
         JOIN karyakarini_nodes n ON n.id = m.node_id
         WHERE m.user_id = $2
           AND m.version_id = $1
           AND m.is_active = true
         UNION ALL
         SELECT c.id, u.root_node_id, u.categories, u.category, u.root_level
         FROM karyakarini_nodes c
         JOIN user_assigned_nodes u ON c.parent_id = u.id
         WHERE c.version_id = $1
       )
       SELECT
         t.id,
         t.version_id,
         t.node_id,
         n.name AS node_name,
         n.level AS node_level,
         COALESCE(np.path, n.name) AS hierarchy_path,
         t.created_by,
         COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name', ('User #' || t.created_by::text)) AS created_by_name,
         COALESCE(to_jsonb(u) ->> 'profile_photo_url', to_jsonb(u) ->> 'avatar', to_jsonb(u) ->> 'photo_url') AS created_by_avatar,
         t.category,
         t.subcategory,
         COALESCE(t.team_members, '[]'::jsonb) AS team_members,
         t.created_at,
         t.updated_at
       FROM karyakarini_category_teams t
       JOIN karyakarini_nodes n ON n.id = t.node_id
       LEFT JOIN node_paths np ON np.id = n.id
       LEFT JOIN users u ON u.id = t.created_by
       WHERE t.version_id = $1
         AND t.is_active = true
         AND ($3::boolean = false OR lower(COALESCE(t.category, '')) = $4)
         AND ($5::boolean = false OR lower(COALESCE(t.subcategory, '')) = $6)
         AND (
           t.created_by = $2
           OR EXISTS (
             SELECT 1
             FROM user_assigned_nodes un
             WHERE un.id = t.node_id
               AND ${levelWeightCase('un.root_level')} < ${levelWeightCase('n.level')}
               AND EXISTS (
                 SELECT 1
                 FROM jsonb_array_elements_text(
                   CASE
                     WHEN un.categories IS NOT NULL
                       AND jsonb_typeof(un.categories) = 'array'
                       AND jsonb_array_length(un.categories) > 0
                       THEN un.categories
                     WHEN NULLIF(trim(COALESCE(un.category, '')), '') IS NOT NULL
                       THEN jsonb_build_array(trim(un.category))
                     ELSE '[]'::jsonb
                   END
                 ) AS cats(value)
                 WHERE lower(trim(cats.value)) = lower(trim(COALESCE(t.category, '')))
               )
           )
         )
       ORDER BY t.updated_at DESC, t.id DESC`,
      [safeVersionId, safeUserId, hasCategory, normalizedCategory, hasSubcategory, normalizedSubcategory]
    );

    return result.rows.map((row) => ({
      ...row,
      id: Number(row.id),
      version_id: Number(row.version_id),
      node_id: Number(row.node_id),
      created_by: Number(row.created_by),
      team_members: Array.isArray(row.team_members) ? row.team_members : [],
    }));
  }

  static async createActivityAssignment({
    versionId,
    nodeId = null,
    activityName,
    description = null,
    assignedUserId,
    assignedBy = null,
  }) {
    const result = await pool.query(
      `INSERT INTO karyakarini_activity_assignments (
         version_id, node_id, activity_name, description, assigned_user_id, assigned_by
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, version_id, node_id, activity_name, description, assigned_user_id, assigned_by, is_active, created_at, updated_at`,
      [
        Number(versionId),
        nodeId ? Number(nodeId) : null,
        String(activityName || '').trim(),
        String(description || '').trim() || null,
        Number(assignedUserId),
        assignedBy ? Number(assignedBy) : null,
      ]
    );
    return result.rows[0] || null;
  }

  static async getActivityAssignments({
    versionId,
    assignedUserId = null,
    assignedBy = null,
    page = 1,
    limit = 20,
  }) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;
    const safeVersionId = Number(versionId);
    const safeAssignedUserId = Number(assignedUserId || 0);
    const safeAssignedBy = Number(assignedBy || 0);
    const hasAssignedUser = Number.isFinite(safeAssignedUserId) && safeAssignedUserId > 0;
    const hasAssignedBy = Number.isFinite(safeAssignedBy) && safeAssignedBy > 0;

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM karyakarini_activity_assignments a
       WHERE a.version_id = $1
         AND a.is_active = true
         AND ($2::boolean = false OR a.assigned_user_id = $3)
         AND ($4::boolean = false OR a.assigned_by = $5)`,
      [safeVersionId, hasAssignedUser, safeAssignedUserId, hasAssignedBy, safeAssignedBy]
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const rowsResult = await pool.query(
      `SELECT
         a.id,
         a.version_id,
         a.node_id,
         n.name AS node_name,
         n.level AS node_level,
         a.activity_name,
         a.description,
         a.assigned_user_id,
         COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name', ('User #' || a.assigned_user_id::text)) AS assigned_user_name,
         COALESCE(to_jsonb(u) ->> 'phone', to_jsonb(u) ->> 'mobile_number', to_jsonb(u) ->> 'mobile') AS assigned_user_mobile,
         a.assigned_by,
         COALESCE(to_jsonb(ab) ->> 'first_name', to_jsonb(ab) ->> 'name', ('User #' || COALESCE(a.assigned_by, 0)::text)) AS assigned_by_name,
         a.created_at,
         a.updated_at
       FROM karyakarini_activity_assignments a
       LEFT JOIN karyakarini_nodes n ON n.id = a.node_id
       LEFT JOIN users u ON u.id = a.assigned_user_id
       LEFT JOIN users ab ON ab.id = a.assigned_by
       WHERE a.version_id = $1
         AND a.is_active = true
         AND ($2::boolean = false OR a.assigned_user_id = $3)
         AND ($4::boolean = false OR a.assigned_by = $5)
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT $6 OFFSET $7`,
      [safeVersionId, hasAssignedUser, safeAssignedUserId, hasAssignedBy, safeAssignedBy, safeLimit, offset]
    );

    return {
      rows: rowsResult.rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  static async getActivityAssignmentById({ assignmentId, versionId }) {
    const safeAssignmentId = Number(assignmentId);
    const safeVersionId = Number(versionId);
    if (!Number.isFinite(safeAssignmentId) || safeAssignmentId <= 0) return null;
    if (!Number.isFinite(safeVersionId) || safeVersionId <= 0) return null;
    const result = await pool.query(
      `SELECT id, version_id, node_id, activity_name, description, assigned_user_id, assigned_by, is_active, created_at, updated_at
       FROM karyakarini_activity_assignments
       WHERE id = $1
         AND version_id = $2
         AND is_active = true
       LIMIT 1`,
      [safeAssignmentId, safeVersionId]
    );
    return result.rows[0] || null;
  }

  static async createActivitySubmission({
    assignmentId,
    versionId,
    submittedBy,
    activityName,
    description = null,
    maleCount = 0,
    femaleCount = 0,
    childrenCount = 0,
    attachments = [],
  }) {
    const result = await pool.query(
      `INSERT INTO karyakarini_activity_submissions (
         assignment_id, version_id, submitted_by, activity_name, description, male_count, female_count, children_count, attachments
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING id, assignment_id, version_id, submitted_by, activity_name, description, male_count, female_count, children_count, attachments, created_at, updated_at`,
      [
        Number(assignmentId),
        Number(versionId),
        Number(submittedBy),
        String(activityName || '').trim(),
        String(description || '').trim() || null,
        Math.max(0, Number(maleCount || 0)),
        Math.max(0, Number(femaleCount || 0)),
        Math.max(0, Number(childrenCount || 0)),
        JSON.stringify(Array.isArray(attachments) ? attachments : []),
      ]
    );
    return result.rows[0] || null;
  }

  static async getActivitySubmissions({
    versionId,
    submittedBy = null,
    assignedUserId = null,
    page = 1,
    limit = 20,
  }) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;
    const safeVersionId = Number(versionId);
    const safeSubmittedBy = Number(submittedBy || 0);
    const safeAssignedUserId = Number(assignedUserId || 0);
    const hasSubmittedBy = Number.isFinite(safeSubmittedBy) && safeSubmittedBy > 0;
    const hasAssignedUser = Number.isFinite(safeAssignedUserId) && safeAssignedUserId > 0;

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM karyakarini_activity_submissions s
       JOIN karyakarini_activity_assignments a ON a.id = s.assignment_id
       WHERE s.version_id = $1
         AND s.is_active = true
         AND a.is_active = true
         AND ($2::boolean = false OR s.submitted_by = $3)
         AND ($4::boolean = false OR a.assigned_user_id = $5)`,
      [safeVersionId, hasSubmittedBy, safeSubmittedBy, hasAssignedUser, safeAssignedUserId]
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const rowsResult = await pool.query(
      `WITH RECURSIVE node_paths AS (
         SELECT n.id, n.parent_id, n.name, n.version_id, n.name::text AS path
         FROM karyakarini_nodes n
         WHERE n.version_id = $1
           AND n.parent_id IS NULL
         UNION ALL
         SELECT c.id, c.parent_id, c.name, c.version_id, np.path || ' > ' || c.name AS path
         FROM karyakarini_nodes c
         JOIN node_paths np ON c.parent_id = np.id
         WHERE c.version_id = $1
       )
       SELECT
         s.id,
         s.assignment_id,
         s.version_id,
         s.submitted_by,
         COALESCE(to_jsonb(sb) ->> 'first_name', to_jsonb(sb) ->> 'name', ('User #' || s.submitted_by::text)) AS submitted_by_name,
         s.activity_name,
         s.description,
         s.male_count,
         s.female_count,
         s.children_count,
         COALESCE(s.attachments, '[]'::jsonb) AS attachments,
         s.created_at,
         s.updated_at,
         a.activity_name AS assigned_activity_name,
         a.assigned_user_id,
         COALESCE(to_jsonb(au) ->> 'first_name', to_jsonb(au) ->> 'name', ('User #' || a.assigned_user_id::text)) AS assigned_user_name,
         a.assigned_by,
         COALESCE(to_jsonb(ab) ->> 'first_name', to_jsonb(ab) ->> 'name', ('User #' || COALESCE(a.assigned_by, 0)::text)) AS assigned_by_name,
         a.node_id,
         n.name AS node_name,
         n.level AS node_level,
         COALESCE(np.path, n.name) AS hierarchy_path
       FROM karyakarini_activity_submissions s
       JOIN karyakarini_activity_assignments a ON a.id = s.assignment_id
       LEFT JOIN users sb ON sb.id = s.submitted_by
       LEFT JOIN users au ON au.id = a.assigned_user_id
       LEFT JOIN users ab ON ab.id = a.assigned_by
       LEFT JOIN karyakarini_nodes n ON n.id = a.node_id
       LEFT JOIN node_paths np ON np.id = a.node_id
       WHERE s.version_id = $1
         AND s.is_active = true
         AND a.is_active = true
         AND ($2::boolean = false OR s.submitted_by = $3)
         AND ($4::boolean = false OR a.assigned_user_id = $5)
       ORDER BY s.created_at DESC, s.id DESC
       LIMIT $6 OFFSET $7`,
      [safeVersionId, hasSubmittedBy, safeSubmittedBy, hasAssignedUser, safeAssignedUserId, safeLimit, offset]
    );

    return {
      rows: rowsResult.rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
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
      `WITH RECURSIVE node_paths AS (
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
         COALESCE(np.path, mn.name) AS hierarchy_path,
         invn.name AS invited_node_name,
         invn.level AS invited_node_level,
         COALESCE(to_jsonb(cb) ->> 'first_name', to_jsonb(cb) ->> 'name', 'Coordinator') AS invited_by_name,
         COALESCE(att.attachments, '[]'::jsonb) AS attachments
       FROM karyakarini_meeting_invites i
       JOIN karyakarini_meetings m ON m.id = i.meeting_id
       LEFT JOIN karyakarini_nodes mn ON mn.id = m.node_id
       LEFT JOIN node_paths np ON np.id = mn.id
       LEFT JOIN karyakarini_nodes invn ON invn.id = i.invited_node_id
       LEFT JOIN users cb ON cb.id = i.invited_by
       LEFT JOIN LATERAL (
         SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'url', ma.attachment_url,
               'type', ma.attachment_type,
               'name', ma.file_name
             )
             ORDER BY ma.id DESC
           ),
           '[]'::jsonb
         ) AS attachments
         FROM karyakarini_meeting_attachments ma
         WHERE ma.meeting_id = m.id
       ) att ON true
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
       ),
       accepted_attendee AS (
         INSERT INTO karyakarini_meeting_attendees (
           meeting_id, attendee_type, user_id, attendance_status
         )
         SELECT u.meeting_id, 'member', u.invited_user_id, 'present'
         FROM updated u
         WHERE $1 = 'accepted'
           AND NOT EXISTS (
             SELECT 1
             FROM karyakarini_meeting_attendees a
             WHERE a.meeting_id = u.meeting_id
               AND a.attendee_type = 'member'
               AND a.user_id = u.invited_user_id
           )
         RETURNING id
       ),
       removed_attendee AS (
         DELETE FROM karyakarini_meeting_attendees a
         USING updated u
         WHERE $1 = 'rejected'
           AND a.meeting_id = u.meeting_id
           AND a.attendee_type = 'member'
           AND a.user_id = u.invited_user_id
         RETURNING a.id
       )
       SELECT
         u.*,
         m.title AS meeting_title,
         m.meeting_date,
         m.created_by AS meeting_created_by,
         n.name AS meeting_node_name,
         n.level AS meeting_node_level,
         EXISTS (SELECT 1 FROM accepted_attendee) AS attendee_added,
         EXISTS (SELECT 1 FROM removed_attendee) AS attendee_removed,
         (
           SELECT COUNT(*)::int
           FROM karyakarini_meeting_attendees a
           WHERE a.meeting_id = u.meeting_id
             AND a.attendee_type = 'member'
         ) AS attendee_member_count,
         (
           SELECT COUNT(*)::int
           FROM karyakarini_meeting_invites i2
           WHERE i2.meeting_id = u.meeting_id
             AND i2.is_active = true
             AND i2.invitation_status = 'pending'
         ) AS pending_invite_count,
         (
           SELECT COUNT(*)::int
           FROM karyakarini_meeting_invites i2
           WHERE i2.meeting_id = u.meeting_id
             AND i2.is_active = true
             AND i2.invitation_status = 'accepted'
         ) AS accepted_invite_count,
         (
           SELECT COUNT(*)::int
           FROM karyakarini_meeting_invites i2
           WHERE i2.meeting_id = u.meeting_id
             AND i2.is_active = true
             AND i2.invitation_status = 'rejected'
         ) AS rejected_invite_count
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
          `SELECT DISTINCT km.user_id
           FROM karyakarini_members km
           WHERE km.version_id = $1
             AND km.is_active = true
             AND km.user_id = ANY($2::int[])`,
          [versionId, memberIds]
        );
        const validMemberIds = validMembersRes.rows.map((row) => Number(row.user_id)).filter((value) => Number.isFinite(value) && value > 0);
        const invalidMemberIds = memberIds.filter((id) => !validMemberIds.includes(id));
        if (invalidMemberIds.length > 0) {
          throw new Error('Some selected members are not active in this karyakarini version');
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
          `SELECT DISTINCT g.id
           FROM karyakarini_guest_members g
           WHERE g.version_id = $1
             AND g.is_active = true
             AND g.id = ANY($2::bigint[])`,
          [versionId, uniqueGuestIds]
        );
        const validGuestIds = validGuestsRes.rows.map((row) => Number(row.id)).filter((value) => Number.isFinite(value) && value > 0);
        const invalidGuestIds = uniqueGuestIds.filter((id) => !validGuestIds.includes(id));
        if (invalidGuestIds.length > 0) {
          throw new Error('Some selected guests are not active in this karyakarini version');
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
          `SELECT DISTINCT km.user_id
           FROM karyakarini_members km
           WHERE km.version_id = $1
             AND km.is_active = true
             AND km.user_id = ANY($2::int[])`,
          [versionId, memberIds]
        );
        const validMemberIds = validMembersRes.rows.map((row) => Number(row.user_id)).filter((value) => Number.isFinite(value) && value > 0);
        const invalidMemberIds = memberIds.filter((id) => !validMemberIds.includes(id));
        if (invalidMemberIds.length > 0) {
          throw new Error('Some selected members are not active in this karyakarini version');
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
          `SELECT DISTINCT g.id
           FROM karyakarini_guest_members g
           WHERE g.version_id = $1
             AND g.is_active = true
             AND g.id = ANY($2::bigint[])`,
          [versionId, uniqueGuestIds]
        );
        const validGuestIds = validGuestsRes.rows.map((row) => Number(row.id)).filter((value) => Number.isFinite(value) && value > 0);
        const invalidGuestIds = uniqueGuestIds.filter((id) => !validGuestIds.includes(id));
        if (invalidGuestIds.length > 0) {
          throw new Error('Some selected guests are not active in this karyakarini version');
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
    maleCount = 0,
    femaleCount = 0,
    childrenCount = 0,
    assignedUserId,
    categories = [],
    subcategories = [],
    locationHierarchy = {},
    attachments = [],
    createdBy,
  }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const normalizedHierarchy = this.normalizeTaskHierarchy(locationHierarchy);
      const normalizedCategories = this.normalizeMemberLabelList(categories);
      const normalizedSubcategories = this.normalizeMemberLabelList(subcategories);

      const normalizedAssignedUserId = Number(assignedUserId);
      if (normalizedAssignedUserId > 0) {
        const assignedUserCheck = await client.query(
          `SELECT 1 FROM users WHERE id = $1 LIMIT 1`,
          [normalizedAssignedUserId]
        );
        if (!assignedUserCheck.rows[0]) {
          throw new Error('Assigned user not found');
        }
      }

      const insertedTask = await client.query(
        `INSERT INTO karyakarini_tasks (
           node_id, version_id, title, description, task_date, due_date, status,
           male_count, female_count, children_count,
           hierarchy_l1, hierarchy_l2, hierarchy_l3, hierarchy_l4, hierarchy_l5, hierarchy_l5_sublevels,
           task_categories, task_subcategories,
           assigned_user_id, created_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb, $18::jsonb, $19, $20)
         RETURNING id, node_id, version_id, title, description, task_date, due_date, status,
                   male_count, female_count, children_count,
                   hierarchy_l1, hierarchy_l2, hierarchy_l3, hierarchy_l4, hierarchy_l5, hierarchy_l5_sublevels,
                   task_categories, task_subcategories,
                   assigned_user_id, created_by, created_at, updated_at`,
        [
          nodeId,
          versionId,
          String(title || '').trim(),
          String(description || '').trim() || null,
          taskDate,
          dueDate || null,
          String(status || 'open').trim().toLowerCase() || 'open',
          Math.max(0, Number(maleCount) || 0),
          Math.max(0, Number(femaleCount) || 0),
          Math.max(0, Number(childrenCount) || 0),
          normalizedHierarchy.l1,
          normalizedHierarchy.l2,
          normalizedHierarchy.l3,
          normalizedHierarchy.l4,
          normalizedHierarchy.l5,
          JSON.stringify(normalizedHierarchy.l5Sublevels || []),
          JSON.stringify(normalizedCategories),
          JSON.stringify(normalizedSubcategories),
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

  static async getTaskById({ taskId, versionId }) {
    const safeTaskId = Number(taskId);
    const safeVersionId = Number(versionId);
    if (!Number.isFinite(safeTaskId) || safeTaskId <= 0) return null;
    if (!Number.isFinite(safeVersionId) || safeVersionId <= 0) return null;

    const result = await pool.query(
      `SELECT
         id,
         node_id,
         version_id,
         title,
         description,
         task_date,
         due_date,
         status,
         male_count,
         female_count,
         children_count,
         COALESCE(task_categories, '[]'::jsonb) AS task_categories,
         COALESCE(task_subcategories, '[]'::jsonb) AS task_subcategories,
         assigned_user_id,
         created_by,
         (
           SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'url', ta.attachment_url,
             'type', ta.attachment_type,
             'name', ta.file_name
           )), '[]'::jsonb)
           FROM karyakarini_task_attachments ta
           WHERE ta.task_id = karyakarini_tasks.id
         ) AS attachments,
         is_active
       FROM karyakarini_tasks
       WHERE id = $1
         AND version_id = $2
         AND is_active = true
       LIMIT 1`,
      [safeTaskId, safeVersionId]
    );
    return result.rows[0] || null;
  }

  static async getEligibleTaskAssigneeUserIds({ nodeId, versionId }) {
    const safeNodeId = Number(nodeId);
    const safeVersionId = Number(versionId);
    if (!Number.isFinite(safeNodeId) || safeNodeId <= 0) return [];
    if (!Number.isFinite(safeVersionId) || safeVersionId <= 0) return [];

    const result = await pool.query(
      `WITH RECURSIVE subtree AS (
         SELECT id
         FROM karyakarini_nodes
         WHERE id = $1
           AND version_id = $2
         UNION ALL
         SELECT c.id
         FROM karyakarini_nodes c
         JOIN subtree s ON c.parent_id = s.id
         WHERE c.version_id = $2
       )
       SELECT DISTINCT m.user_id
       FROM karyakarini_members m
       JOIN subtree s ON s.id = m.node_id
       WHERE m.version_id = $2
         AND m.is_active = true
         AND m.user_id IS NOT NULL`,
      [safeNodeId, safeVersionId]
    );

    return result.rows
      .map((row) => Number(row.user_id))
      .filter((id) => Number.isFinite(id) && id > 0);
  }

  static async hasUserTaskAssignmentForSubcategories({ userId, versionId, nodeId, subcategories = [] }) {
    const safeUserId = Number(userId);
    const safeVersionId = Number(versionId);
    const safeNodeId = Number(nodeId);
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) return false;
    if (!Number.isFinite(safeVersionId) || safeVersionId <= 0) return false;
    if (!Number.isFinite(safeNodeId) || safeNodeId <= 0) return false;

    const normalizedSubcategories = [...new Set((Array.isArray(subcategories) ? subcategories : [])
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean))];
    if (!normalizedSubcategories.length) return false;

    const result = await pool.query(
      `SELECT 1
       FROM karyakarini_members m
       WHERE m.user_id = $1
         AND m.version_id = $2
         AND m.node_id = $3
         AND m.is_active = true
         AND EXISTS (
           SELECT 1
           FROM jsonb_array_elements_text(
             CASE
               WHEN m.subcategories IS NOT NULL
                 AND jsonb_typeof(m.subcategories) = 'array'
                 AND jsonb_array_length(m.subcategories) > 0
                 THEN m.subcategories
               WHEN NULLIF(trim(COALESCE(m.subcategory, '')), '') IS NOT NULL
                 THEN jsonb_build_array(trim(m.subcategory))
               ELSE '[]'::jsonb
             END
           ) AS ms(value)
           WHERE lower(trim(ms.value)) = ANY($4::text[])
         )
       LIMIT 1`,
      [safeUserId, safeVersionId, safeNodeId, normalizedSubcategories]
    );

    return Boolean(result.rows[0]);
  }

  static async assignUsersToTaskScope({
    versionId,
    nodeId,
    categories = [],
    subcategories = [],
    userIds = [],
    createdBy = null,
  }) {
    const safeVersionId = Number(versionId);
    const safeNodeId = Number(nodeId);
    const normalizedCategories = this.normalizeMemberLabelList(categories);
    const normalizedSubcategories = this.normalizeMemberLabelList(subcategories);
    const safeUserIds = [...new Set((Array.isArray(userIds) ? userIds : [])
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry) && entry > 0))];

    if (!safeUserIds.length) return [];
    if (!normalizedSubcategories.length) return [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const rows = [];

      for (const userId of safeUserIds) {
        const userRes = await client.query(
          `SELECT
             id,
             COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name') AS first_name,
             COALESCE(to_jsonb(u) ->> 'phone', to_jsonb(u) ->> 'mobile_number', to_jsonb(u) ->> 'mobile') AS phone
           FROM users u
           WHERE id = $1
           LIMIT 1`,
          [userId]
        );
        if (!userRes.rows[0]) continue;

        const existingRes = await client.query(
          `SELECT
             id,
             pad,
             category,
             subcategory,
             categories,
             subcategories
           FROM karyakarini_members
           WHERE user_id = $1
             AND node_id = $2
             AND version_id = $3
             AND is_active = true
           ORDER BY id DESC
           LIMIT 1`,
          [userId, safeNodeId, safeVersionId]
        );
        const existing = existingRes.rows[0] || null;

        if (existing) {
          const mergedCategories = [...new Set([
            ...this.normalizeMemberLabelList(existing.categories, existing.category),
            ...normalizedCategories,
          ])];
          const mergedSubcategories = [...new Set([
            ...this.normalizeMemberLabelList(existing.subcategories, existing.subcategory),
            ...normalizedSubcategories,
          ])];

          const updatedRes = await client.query(
            `UPDATE karyakarini_members
             SET pad = COALESCE(NULLIF(trim(pad), ''), 'कार्य'),
                 category = $1,
                 subcategory = $2,
                 categories = $3::jsonb,
                 subcategories = $4::jsonb,
                 updated_at = NOW()
             WHERE id = $5
             RETURNING id, user_id, node_id, version_id, pad, category, subcategory, categories, subcategories, updated_at`,
            [
              mergedCategories[0] || null,
              mergedSubcategories[0] || null,
              JSON.stringify(mergedCategories),
              JSON.stringify(mergedSubcategories),
              Number(existing.id),
            ]
          );
          if (updatedRes.rows[0]) rows.push(updatedRes.rows[0]);
          continue;
        }

        const insertedRes = await client.query(
          `INSERT INTO karyakarini_members (
             pad,
             node_id,
             version_id,
             user_id,
             created_by,
             name,
             mobile,
             category,
             subcategory,
             categories,
             subcategories
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
           RETURNING id, user_id, node_id, version_id, pad, category, subcategory, categories, subcategories, created_at`,
          [
            'कार्य',
            safeNodeId,
            safeVersionId,
            userId,
            createdBy || null,
            String(userRes.rows[0].first_name || '').trim() || null,
            String(userRes.rows[0].phone || '').trim() || null,
            normalizedCategories[0] || null,
            normalizedSubcategories[0] || null,
            JSON.stringify(normalizedCategories),
            JSON.stringify(normalizedSubcategories),
          ]
        );
        if (insertedRes.rows[0]) rows.push(insertedRes.rows[0]);
      }

      await client.query('COMMIT');
      return rows;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateTask({
    taskId,
    versionId,
    nodeId,
    title,
    description,
    taskDate,
    dueDate,
    status = 'open',
    maleCount,
    femaleCount,
    childrenCount,
    assignedUserId,
    assignedUserIds = [],
    categories = [],
    subcategories = [],
    locationHierarchy = {},
    attachments = [],
    updatedBy,
  }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const safeTaskId = Number(taskId);
      const existingRes = await client.query(
        `SELECT id, node_id, version_id, title, task_date, created_by, male_count, female_count, children_count
         FROM karyakarini_tasks
         WHERE id = $1 AND version_id = $2 AND is_active = true
         LIMIT 1`,
        [safeTaskId, versionId]
      );
      if (!existingRes.rows[0]) {
        throw new Error('Task not found');
      }
      const origTask = existingRes.rows[0];
      const origTitle = origTask.title;
      const origTaskDate = origTask.task_date;

      const normalizedHierarchy = this.normalizeTaskHierarchy(locationHierarchy);
      const normalizedCategories = this.normalizeMemberLabelList(categories);
      const normalizedSubcategories = this.normalizeMemberLabelList(subcategories);

      const resolvedMaleCount = maleCount !== undefined && maleCount !== null
        ? Math.max(0, Number(maleCount) || 0)
        : Math.max(0, Number(origTask.male_count) || 0);
      const resolvedFemaleCount = femaleCount !== undefined && femaleCount !== null
        ? Math.max(0, Number(femaleCount) || 0)
        : Math.max(0, Number(origTask.female_count) || 0);
      const resolvedChildrenCount = childrenCount !== undefined && childrenCount !== null
        ? Math.max(0, Number(childrenCount) || 0)
        : Math.max(0, Number(origTask.children_count) || 0);

      let targetUserIds = [...new Set((Array.isArray(assignedUserIds) ? assignedUserIds : []).map(Number).filter(v => v > 0))];
      if (targetUserIds.length === 0 && Number(assignedUserId) > 0) {
        targetUserIds = [Number(assignedUserId)];
      }
      if (targetUserIds.length === 0) {
        targetUserIds = [null];
      }

      // First user ID goes to the primary task row
      const primaryUserId = targetUserIds[0];

      const updatedRes = await client.query(
        `UPDATE karyakarini_tasks
         SET node_id = $1,
             title = $2,
             description = $3,
             task_date = $4,
             due_date = $5,
             status = $6,
             male_count = $7,
             female_count = $8,
             children_count = $9,
             hierarchy_l1 = $10, hierarchy_l2 = $11, hierarchy_l3 = $12, hierarchy_l4 = $13, hierarchy_l5 = $14, hierarchy_l5_sublevels = $15::jsonb,
             task_categories = $16::jsonb,
             task_subcategories = $17::jsonb,
             assigned_user_id = $18,
             updated_at = NOW()
         WHERE id = $19 AND version_id = $20
         RETURNING id, node_id, version_id, title, description, task_date, due_date, status, male_count, female_count, children_count, assigned_user_id, created_by`,
        [
          nodeId || origTask.node_id,
          String(title || '').trim(),
          String(description || '').trim() || null,
          taskDate || origTask.task_date,
          dueDate || null,
          String(status || 'open').trim().toLowerCase() || 'open',
          resolvedMaleCount,
          resolvedFemaleCount,
          resolvedChildrenCount,
          normalizedHierarchy.l1,
          normalizedHierarchy.l2,
          normalizedHierarchy.l3,
          normalizedHierarchy.l4,
          normalizedHierarchy.l5,
          JSON.stringify(normalizedHierarchy.l5Sublevels || []),
          JSON.stringify(normalizedCategories),
          JSON.stringify(normalizedSubcategories),
          primaryUserId > 0 ? primaryUserId : null,
          safeTaskId,
          versionId,
        ]
      );
      const primaryTask = updatedRes.rows[0];

      // Now, delete any old extra rows for this task group that are not the primary safeTaskId
      await client.query(
        `DELETE FROM karyakarini_tasks
         WHERE node_id = $1
           AND version_id = $2
           AND title = $3
           AND task_date = $4
           AND id != $5`,
        [origTask.node_id, versionId, origTitle, origTaskDate, safeTaskId]
      );

      // For any remaining user IDs in targetUserIds, insert extra task rows
      for (let i = 1; i < targetUserIds.length; i++) {
        const uId = targetUserIds[i];
        if (!uId) continue;
        const insertedExtra = await client.query(
          `INSERT INTO karyakarini_tasks (
             node_id, version_id, title, description, task_date, due_date, status,
             male_count, female_count, children_count,
             hierarchy_l1, hierarchy_l2, hierarchy_l3, hierarchy_l4, hierarchy_l5, hierarchy_l5_sublevels,
             task_categories, task_subcategories,
             assigned_user_id, created_by
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb, $18::jsonb, $19, $20)
           RETURNING id`,
          [
            primaryTask.node_id, primaryTask.version_id, primaryTask.title, primaryTask.description, primaryTask.task_date, primaryTask.due_date, primaryTask.status,
            resolvedMaleCount, resolvedFemaleCount, resolvedChildrenCount,
            normalizedHierarchy.l1, normalizedHierarchy.l2, normalizedHierarchy.l3, normalizedHierarchy.l4, normalizedHierarchy.l5, JSON.stringify(normalizedHierarchy.l5Sublevels || []),
            JSON.stringify(normalizedCategories), JSON.stringify(normalizedSubcategories),
            uId > 0 ? uId : null,
            primaryTask.created_by || updatedBy || null
          ]
        );
        const newExtraId = insertedExtra.rows[0].id;
        // Copy any attachments from primary task to extra task
        await client.query(
          `INSERT INTO karyakarini_task_attachments (task_id, attachment_url, attachment_type, file_name, uploaded_by)
           SELECT $1, attachment_url, attachment_type, file_name, uploaded_by
           FROM karyakarini_task_attachments
           WHERE task_id = $2`,
          [newExtraId, safeTaskId]
        );
      }

      // Handle attachments sync on primary task
      const incomingAtts = Array.isArray(attachments) ? attachments : [];
      const incomingUrls = incomingAtts.map(a => String(a?.url || a?.attachment_url || '').trim()).filter(Boolean);
      if (incomingUrls.length > 0) {
        await client.query(
          `DELETE FROM karyakarini_task_attachments WHERE task_id = $1 AND NOT (attachment_url = ANY($2::text[]))`,
          [safeTaskId, incomingUrls]
        );
      } else {
        await client.query(`DELETE FROM karyakarini_task_attachments WHERE task_id = $1`, [safeTaskId]);
      }

      for (const att of incomingAtts) {
        const u = String(att?.url || att?.attachment_url || '').trim();
        if (!u) continue;
        const attCheck = await client.query(
          `SELECT id FROM karyakarini_task_attachments WHERE task_id = $1 AND attachment_url = $2`,
          [safeTaskId, u]
        );
        if (attCheck.rows.length === 0) {
          await client.query(
            `INSERT INTO karyakarini_task_attachments (task_id, attachment_url, attachment_type, file_name, uploaded_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              safeTaskId,
              u,
              String(att?.type || att?.attachment_type || '').trim() || null,
              String(att?.name || att?.file_name || '').trim() || null,
              updatedBy || null,
            ]
          );
        }
      }

      await client.query('COMMIT');
      return primaryTask;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getTasks({ versionId, visibleNodeIds = [], nodeId, hierarchy = {}, page = 1, limit = 20, category = '', subcategory = '', nodeLevel = '' }) {
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
      filters.push(`t.node_id IN (
        WITH RECURSIVE subtree AS (
          SELECT id FROM karyakarini_nodes WHERE id = $${queryValues.length} AND version_id = $1
          UNION ALL
          SELECT c.id FROM karyakarini_nodes c JOIN subtree s ON c.parent_id = s.id WHERE c.version_id = $1
        )
        SELECT id FROM subtree
      )`);
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

    if (category) {
      queryValues.push(String(category).trim());
      filters.push(
        `EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(COALESCE(t.task_categories, '[]'::jsonb)) AS cat(value)
          WHERE lower(cat.value) = lower($${queryValues.length})
        )`
      );
    }

    if (subcategory) {
      queryValues.push(String(subcategory).trim());
      filters.push(
        `EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(COALESCE(t.task_subcategories, '[]'::jsonb)) AS sub(value)
          WHERE lower(sub.value) = lower($${queryValues.length})
        )`
      );
    }

    if (nodeLevel) {
      queryValues.push(String(nodeLevel).trim());
      filters.push(`lower(COALESCE(n.level, '')) = lower($${queryValues.length})`);
    }

    const whereClause = filters.join('\n         AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM karyakarini_tasks t
       JOIN karyakarini_nodes n ON n.id = t.node_id
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
         t.male_count,
         t.female_count,
         t.children_count,
         t.hierarchy_l1,
         t.hierarchy_l2,
         t.hierarchy_l3,
         t.hierarchy_l4,
         t.hierarchy_l5,
         COALESCE(t.hierarchy_l5_sublevels, '[]'::jsonb) AS hierarchy_l5_sublevels,
         COALESCE(t.task_categories, '[]'::jsonb) AS task_categories,
         COALESCE(t.task_subcategories, '[]'::jsonb) AS task_subcategories,
         t.node_id,
         n.name AS node_name,
         n.level AS node_level,
         COALESCE(np.path, n.name) AS hierarchy_path,
         t.assigned_user_id,
         COALESCE(to_jsonb(au) ->> 'first_name', to_jsonb(au) ->> 'name') AS assigned_first_name,
         COALESCE(to_jsonb(au) ->> 'father_name', to_jsonb(au) ->> 'last_name') AS assigned_father_name,
         COALESCE(to_jsonb(au) ->> 'phone', to_jsonb(au) ->> 'mobile_number', to_jsonb(au) ->> 'mobile') AS assigned_mobile_number,
         COALESCE(to_jsonb(cu) ->> 'first_name', to_jsonb(cu) ->> 'name', 'System') AS created_by_name,
         COALESCE(atc.attachment_count, 0)::int AS attachment_count,
         COALESCE(atc.attachments, '[]'::jsonb) AS attachments,
         t.created_by,
         t.created_at,
         t.updated_at
       FROM karyakarini_tasks t
       JOIN karyakarini_nodes n ON n.id = t.node_id
       LEFT JOIN node_paths np ON np.id = n.id
       LEFT JOIN users au ON au.id = t.assigned_user_id
       LEFT JOIN users cu ON cu.id = t.created_by
       LEFT JOIN LATERAL (
         SELECT 
           COUNT(*) AS attachment_count,
           jsonb_agg(jsonb_build_object(
             'url', ta.attachment_url,
             'type', ta.attachment_type,
             'name', ta.file_name
           )) FILTER (WHERE ta.attachment_url IS NOT NULL) AS attachments
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

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;
    const normalizedStatuses = [...new Set((Array.isArray(statuses) ? statuses : [])
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean))];
    const hasStatusFilter = normalizedStatuses.length > 0;

    const countResult = await pool.query(
      `WITH RECURSIVE user_assigned_nodes AS (
         SELECT m.node_id AS id, m.node_id AS root_node_id, m.subcategories, m.subcategory
         FROM karyakarini_members m
         WHERE m.user_id = $2
           AND m.version_id = $1
           AND m.is_active = true
         UNION ALL
         SELECT c.id, u.root_node_id, u.subcategories, u.subcategory
         FROM karyakarini_nodes c
         JOIN user_assigned_nodes u ON c.parent_id = u.id
         WHERE c.version_id = $1
       )
       SELECT COUNT(*)::int AS total
       FROM karyakarini_tasks t
       WHERE t.version_id = $1
         AND t.is_active = true
         AND (
           EXISTS (
             SELECT 1
             FROM user_assigned_nodes un
             WHERE un.id = t.node_id
               AND EXISTS (
                 SELECT 1
                 FROM jsonb_array_elements_text(COALESCE(t.task_subcategories, '[]'::jsonb)) AS ts(value)
                 WHERE EXISTS (
                   SELECT 1
                   FROM jsonb_array_elements_text(
                     CASE
                       WHEN un.subcategories IS NOT NULL
                         AND jsonb_typeof(un.subcategories) = 'array'
                         AND jsonb_array_length(un.subcategories) > 0
                         THEN un.subcategories
                       WHEN NULLIF(trim(COALESCE(un.subcategory, '')), '') IS NOT NULL
                         THEN jsonb_build_array(trim(un.subcategory))
                       ELSE '[]'::jsonb
                     END
                   ) AS ms(value)
                   WHERE lower(trim(ms.value)) = lower(trim(ts.value))
                 )
               )
           )
           OR t.assigned_user_id = $2
           OR t.created_by = $2
         )
         AND ($3::boolean = false OR lower(COALESCE(t.status, 'open')) = ANY($4::text[]))`,
      [versionId, safeUserId, hasStatusFilter, normalizedStatuses]
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
       ),
       user_assigned_nodes AS (
         SELECT m.node_id AS id, m.node_id AS root_node_id, m.subcategories, m.subcategory
         FROM karyakarini_members m
         WHERE m.user_id = $2
           AND m.version_id = $1
           AND m.is_active = true
         UNION ALL
         SELECT c.id, u.root_node_id, u.subcategories, u.subcategory
         FROM karyakarini_nodes c
         JOIN user_assigned_nodes u ON c.parent_id = u.id
         WHERE c.version_id = $1
       )
       SELECT
         t.id,
         t.title,
         t.description,
         t.task_date,
         t.due_date,
         t.status,
         t.male_count,
         t.female_count,
         t.children_count,
         t.hierarchy_l1,
         t.hierarchy_l2,
         t.hierarchy_l3,
         t.hierarchy_l4,
         t.hierarchy_l5,
         COALESCE(t.hierarchy_l5_sublevels, '[]'::jsonb) AS hierarchy_l5_sublevels,
         COALESCE(t.task_categories, '[]'::jsonb) AS task_categories,
         COALESCE(t.task_subcategories, '[]'::jsonb) AS task_subcategories,
         t.node_id,
         n.name AS node_name,
         n.level AS node_level,
         COALESCE(np.path, n.name) AS hierarchy_path,
         t.assigned_user_id,
         COALESCE(to_jsonb(au) ->> 'first_name', to_jsonb(au) ->> 'name') AS assigned_first_name,
         COALESCE(to_jsonb(au) ->> 'father_name', to_jsonb(au) ->> 'last_name') AS assigned_father_name,
         COALESCE(to_jsonb(au) ->> 'phone', to_jsonb(au) ->> 'mobile_number', to_jsonb(au) ->> 'mobile') AS assigned_mobile_number,
         COALESCE(to_jsonb(cu) ->> 'first_name', to_jsonb(cu) ->> 'name', 'System') AS created_by_name,
         COALESCE(atc.attachment_count, 0)::int AS attachment_count,
         COALESCE(atc.attachments, '[]'::jsonb) AS attachments,
         t.created_by,
         t.created_at,
         t.updated_at
       FROM karyakarini_tasks t
       JOIN karyakarini_nodes n ON n.id = t.node_id
       LEFT JOIN node_paths np ON np.id = n.id
       LEFT JOIN users au ON au.id = t.assigned_user_id
       LEFT JOIN users cu ON cu.id = t.created_by
       LEFT JOIN LATERAL (
         SELECT 
           COUNT(*) AS attachment_count,
           jsonb_agg(jsonb_build_object(
             'url', ta.attachment_url,
             'type', ta.attachment_type,
             'name', ta.file_name
           )) FILTER (WHERE ta.attachment_url IS NOT NULL) AS attachments
         FROM karyakarini_task_attachments ta
         WHERE ta.task_id = t.id
       ) atc ON true
       WHERE t.version_id = $1
         AND t.is_active = true
         AND (
           EXISTS (
             SELECT 1
             FROM user_assigned_nodes un
             WHERE un.id = t.node_id
               AND EXISTS (
                 SELECT 1
                 FROM jsonb_array_elements_text(COALESCE(t.task_subcategories, '[]'::jsonb)) AS ts(value)
                 WHERE EXISTS (
                   SELECT 1
                   FROM jsonb_array_elements_text(
                     CASE
                       WHEN un.subcategories IS NOT NULL
                         AND jsonb_typeof(un.subcategories) = 'array'
                         AND jsonb_array_length(un.subcategories) > 0
                         THEN un.subcategories
                       WHEN NULLIF(trim(COALESCE(un.subcategory, '')), '') IS NOT NULL
                         THEN jsonb_build_array(trim(un.subcategory))
                       ELSE '[]'::jsonb
                     END
                   ) AS ms(value)
                   WHERE lower(trim(ms.value)) = lower(trim(ts.value))
                 )
               )
           )
           OR t.assigned_user_id = $2
           OR t.created_by = $2
         )
         AND ($3::boolean = false OR lower(COALESCE(t.status, 'open')) = ANY($4::text[]))
       ORDER BY t.task_date DESC, t.created_at DESC, t.id DESC
       LIMIT $5 OFFSET $6`,
      [versionId, safeUserId, hasStatusFilter, normalizedStatuses, safeLimit, offset]
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

  static async updateTaskStatus({ taskId, userId, userRole, versionId, status, attachments = [] }) {
    const safeTaskId = Number(taskId);
    const safeUserId = Number(userId);
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const allowedStatuses = ['open', 'in_progress', 'completed', 'blocked', 'cancelled'];
    if (!allowedStatuses.includes(normalizedStatus)) {
      throw new Error('status must be one of open, in_progress, completed, blocked, cancelled');
    }

    const taskRes = await pool.query(
      `SELECT id, node_id, version_id, assigned_user_id, created_by, COALESCE(task_subcategories, '[]'::jsonb) AS task_subcategories
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
    const hasTaskSubcategoryAccess = await this.hasUserTaskAssignmentForSubcategories({
      userId: safeUserId,
      versionId,
      nodeId: Number(task.node_id || 0),
      subcategories: Array.isArray(task.task_subcategories) ? task.task_subcategories : [],
    });

    if (!ownsTask && !isPrivileged && !hasTaskSubcategoryAccess) {
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

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updatedTask = await client.query(
        `UPDATE karyakarini_tasks
         SET status = $1,
             updated_at = NOW()
         WHERE id = $2
           AND version_id = $3
         RETURNING *`,
        [normalizedStatus, safeTaskId, versionId]
      );
      const taskRow = updatedTask.rows[0];
      if (!taskRow) {
        await client.query('ROLLBACK');
        return null;
      }

      for (const attachment of Array.isArray(attachments) ? attachments : []) {
        const attachmentUrl = String(attachment?.url || attachment?.attachment_url || '').trim();
        if (!attachmentUrl) continue;
        await client.query(
          `INSERT INTO karyakarini_task_attachments (
             task_id, attachment_url, attachment_type, file_name, uploaded_by
           )
           VALUES ($1, $2, $3, $4, $5)`,
          [
            safeTaskId,
            attachmentUrl,
            String(attachment?.type || attachment?.attachment_type || '').trim() || null,
            String(attachment?.name || attachment?.file_name || '').trim() || null,
            safeUserId > 0 ? safeUserId : null,
          ]
        );
      }

      const updated = await client.query(
        `WITH node_paths AS (
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
           t.id,
           t.title,
           t.description,
           t.task_date,
           t.due_date,
           t.status,
           t.male_count,
           t.female_count,
           t.children_count,
           t.hierarchy_l1,
           t.hierarchy_l2,
           t.hierarchy_l3,
           t.hierarchy_l4,
           t.hierarchy_l5,
           COALESCE(t.hierarchy_l5_sublevels, '[]'::jsonb) AS hierarchy_l5_sublevels,
           COALESCE(t.task_categories, '[]'::jsonb) AS task_categories,
           COALESCE(t.task_subcategories, '[]'::jsonb) AS task_subcategories,
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
         WHERE t.id = $1
           AND t.version_id = $2
         LIMIT 1`,
        [safeTaskId, versionId]
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
           AND NOT (lower(COALESCE(category, '')) = 'invitations' AND lower(COALESCE(type, '')) = 'meeting-invitation')
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
         AND NOT (lower(COALESCE(n.category, '')) = 'invitations' AND lower(COALESCE(n.type, '')) = 'meeting-invitation')
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
      message: `${String(entry.meeting_title || 'बैठक')} • ${String(entry.meeting_date || '-')}`,
      entity_type: 'meeting',
      entity_id: Number(entry.meeting_id || 0) || null,
      metadata: {
        invitationId: Number(entry.id),
        meetingId: Number(entry.meeting_id || 0),
        meetingTitle: String(entry.meeting_title || ''),
        meetingDescription: String(entry.meeting_description || ''),
        meetingDate: entry.meeting_date || null,
        meetingAreaName: String(entry.meeting_node_name || ''),
        meetingAreaLevel: String(entry.meeting_node_level || ''),
        meetingHierarchyPath: String(entry.hierarchy_path || ''),
        invitedByName: String(entry.invited_by_name || ''),
        attachments: Array.isArray(entry.attachments) ? entry.attachments : [],
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
    } else if (shouldMarkAllNotifications) {
      invitationCount = await this.markUserInvitationsRead({
        userId: safeUserId,
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

  static async createCategoryActivity({
    versionId,
    nodeId,
    submittedBy,
    category = null,
    subcategory,
    title,
    description = null,
    attachments = [],
    maleCount = 0,
    femaleCount = 0,
    childrenCount = 0,
    fromDate = null,
    toDate = null,
    status = 'open',
  }) {
    const result = await pool.query(
      `INSERT INTO karyakarini_category_activities (
         version_id, node_id, submitted_by, category, subcategory, title, description, attachments, male_count, female_count, children_count, from_date, to_date, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14)
       RETURNING id, version_id, node_id, submitted_by, category, subcategory, title, description, attachments, male_count, female_count, children_count, from_date, to_date, status, created_at, updated_at`,
      [
        Number(versionId),
        Number(nodeId),
        Number(submittedBy),
        String(category || '').trim() || null,
        String(subcategory || '').trim(),
        String(title || '').trim(),
        String(description || '').trim() || null,
        JSON.stringify(Array.isArray(attachments) ? attachments : []),
        Number(maleCount) || 0,
        Number(femaleCount) || 0,
        Number(childrenCount) || 0,
        fromDate ? String(fromDate).trim() : null,
        toDate ? String(toDate).trim() : null,
        String(status || 'open'),
      ]
    );
    return result.rows[0] || null;
  }

  static async getCategoryActivitiesForUser({
    userId,
    versionId,
    page = 1,
    limit = 20,
    category = '',
    subcategory = '',
    nodeLevel = '',
    nodeId = null,
  }) {
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

    const normalizedCategory = String(category || '').trim().toLowerCase();
    const normalizedSubcategory = String(subcategory || '').trim().toLowerCase();
    const normalizedNodeLevel = String(nodeLevel || '').trim().toLowerCase();
    const safeNodeId = Number(nodeId || 0);
    const hasCategory = Boolean(normalizedCategory);
    const hasSubcategory = Boolean(normalizedSubcategory);
    const hasNodeLevel = Boolean(normalizedNodeLevel);
    const hasNodeId = Number.isFinite(safeNodeId) && safeNodeId > 0;

    const countQuery = `
      WITH RECURSIVE user_assigned_nodes AS (
        SELECT m.node_id AS id, m.node_id AS root_node_id, m.subcategories, m.subcategory, false AS is_admin_scope
        FROM karyakarini_members m
        WHERE m.user_id = $2
          AND m.version_id = $1
          AND m.is_active = true
        UNION
        SELECT s.node_id AS id, s.node_id AS root_node_id, NULL::jsonb AS subcategories, NULL::varchar AS subcategory, true AS is_admin_scope
        FROM karyakarini_admin_scopes s
        WHERE s.user_id = $2
          AND s.version_id = $1
          AND s.is_active = true
        UNION ALL
        SELECT c.id, u.root_node_id, u.subcategories, u.subcategory, u.is_admin_scope
        FROM karyakarini_nodes c
        JOIN user_assigned_nodes u ON c.parent_id = u.id
        WHERE c.version_id = $1
      )
      SELECT COUNT(*)::int AS total
      FROM karyakarini_category_activities a
      JOIN karyakarini_nodes n ON n.id = a.node_id
      WHERE a.version_id = $1
        AND a.is_active = true
        AND (
          a.submitted_by = $2
          OR EXISTS (
            SELECT 1
            FROM user_assigned_nodes un
            WHERE un.id = a.node_id
              AND (
                un.is_admin_scope = true
                OR EXISTS (
                  SELECT 1
                  FROM unnest(string_to_array(COALESCE(a.subcategory, ''), ',')) AS act_sub(value)
                  WHERE EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements_text(
                      CASE
                        WHEN un.subcategories IS NOT NULL
                          AND jsonb_typeof(un.subcategories) = 'array'
                          AND jsonb_array_length(un.subcategories) > 0
                          THEN un.subcategories
                        WHEN NULLIF(trim(COALESCE(un.subcategory, '')), '') IS NOT NULL
                          THEN jsonb_build_array(trim(un.subcategory))
                        ELSE '[]'::jsonb
                      END
                    ) AS ms(value)
                    WHERE lower(trim(ms.value)) = lower(trim(act_sub.value))
                  )
                )
              )
          )
        )
        AND ($3::boolean = false OR lower(COALESCE(a.category, '')) = $4)
        AND ($5::boolean = false OR lower(COALESCE(a.subcategory, '')) = $6)
        AND ($7::boolean = false OR lower(COALESCE(n.level, '')) = $8)
        AND ($9::boolean = false OR a.node_id = $10)
    `;

    const countParams = [
      Number(versionId),
      safeUserId,
      hasCategory,
      normalizedCategory,
      hasSubcategory,
      normalizedSubcategory,
      hasNodeLevel,
      normalizedNodeLevel,
      hasNodeId,
      safeNodeId,
    ];

    const countResult = await pool.query(countQuery, countParams);
    const total = Number(countResult.rows[0]?.total || 0);

    const rowsQuery = `
      WITH RECURSIVE node_paths AS (
        SELECT n.id, n.parent_id, n.name, n.level, n.version_id, n.name::text AS path
        FROM karyakarini_nodes n
        WHERE n.version_id = $1
          AND n.parent_id IS NULL
        UNION ALL
        SELECT c.id, c.parent_id, c.name, c.level, c.version_id, np.path || ' > ' || c.name AS path
        FROM karyakarini_nodes c
        JOIN node_paths np ON c.parent_id = np.id
        WHERE c.version_id = $1
      ),
      user_assigned_nodes AS (
        SELECT m.node_id AS id, m.node_id AS root_node_id, m.subcategories, m.subcategory, false AS is_admin_scope
        FROM karyakarini_members m
        WHERE m.user_id = $2
          AND m.version_id = $1
          AND m.is_active = true
        UNION
        SELECT s.node_id AS id, s.node_id AS root_node_id, NULL::jsonb AS subcategories, NULL::varchar AS subcategory, true AS is_admin_scope
        FROM karyakarini_admin_scopes s
        WHERE s.user_id = $2
          AND s.version_id = $1
          AND s.is_active = true
        UNION ALL
        SELECT c.id, u.root_node_id, u.subcategories, u.subcategory, u.is_admin_scope
        FROM karyakarini_nodes c
        JOIN user_assigned_nodes u ON c.parent_id = u.id
        WHERE c.version_id = $1
      )
      SELECT
        a.id,
        a.version_id,
        a.node_id,
        n.name AS node_name,
        n.level AS node_level,
        COALESCE(np.path, n.name) AS hierarchy_path,
        a.submitted_by,
        COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name', ('User #' || a.submitted_by::text)) AS submitted_by_name,
        COALESCE(to_jsonb(u) ->> 'profile_photo_url', to_jsonb(u) ->> 'avatar', to_jsonb(u) ->> 'photo_url') AS submitted_by_avatar,
        a.category,
        a.subcategory,
        a.title,
        a.description,
        COALESCE(a.attachments, '[]'::jsonb) AS attachments,
        a.male_count,
        a.female_count,
        a.children_count,
        a.from_date,
        a.to_date,
        COALESCE(a.status, 'open') AS status,
        a.created_at,
        a.updated_at
      FROM karyakarini_category_activities a
      JOIN karyakarini_nodes n ON n.id = a.node_id
      LEFT JOIN node_paths np ON np.id = n.id
      LEFT JOIN users u ON u.id = a.submitted_by
      WHERE a.version_id = $1
        AND a.is_active = true
        AND (
          a.submitted_by = $2
          OR EXISTS (
            SELECT 1
            FROM user_assigned_nodes un
            WHERE un.id = a.node_id
              AND (
                un.is_admin_scope = true
                OR EXISTS (
                  SELECT 1
                  FROM unnest(string_to_array(COALESCE(a.subcategory, ''), ',')) AS act_sub(value)
                  WHERE EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements_text(
                      CASE
                        WHEN un.subcategories IS NOT NULL
                          AND jsonb_typeof(un.subcategories) = 'array'
                          AND jsonb_array_length(un.subcategories) > 0
                          THEN un.subcategories
                        WHEN NULLIF(trim(COALESCE(un.subcategory, '')), '') IS NOT NULL
                          THEN jsonb_build_array(trim(un.subcategory))
                        ELSE '[]'::jsonb
                      END
                    ) AS ms(value)
                    WHERE lower(trim(ms.value)) = lower(trim(act_sub.value))
                  )
                )
              )
          )
        )
        AND ($3::boolean = false OR lower(COALESCE(a.category, '')) = $4)
        AND ($5::boolean = false OR lower(COALESCE(a.subcategory, '')) = $6)
        AND ($7::boolean = false OR lower(COALESCE(n.level, '')) = $8)
        AND ($11::boolean = false OR a.node_id = $12)
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT $9 OFFSET $10
    `;

    const rowsParams = [
      Number(versionId),
      safeUserId,
      hasCategory,
      normalizedCategory,
      hasSubcategory,
      normalizedSubcategory,
      hasNodeLevel,
      normalizedNodeLevel,
      safeLimit,
      offset,
      hasNodeId,
      safeNodeId,
    ];

    const rowsResult = await pool.query(rowsQuery, rowsParams);

    return {
      rows: rowsResult.rows.map((row) => ({
        ...row,
        id: Number(row.id),
      })),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  static async getCategoryActivities({
    versionId,
    visibleNodeIds = [],
    page = 1,
    limit = 20,
    category = '',
    subcategory = '',
    nodeLevel = '',
    submittedBy = null,
    nodeId = null,
  }) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;
    if (!visibleNodeIds.length) {
      return {
        rows: [],
        pagination: { page: safePage, limit: safeLimit, total: 0, totalPages: 0 },
      };
    }

    const normalizedCategory = String(category || '').trim().toLowerCase();
    const normalizedSubcategory = String(subcategory || '').trim().toLowerCase();
    const normalizedNodeLevel = String(nodeLevel || '').trim().toLowerCase();
    const safeSubmittedBy = Number(submittedBy || 0);
    const safeNodeId = Number(nodeId || 0);
    const hasCategory = Boolean(normalizedCategory);
    const hasSubcategory = Boolean(normalizedSubcategory);
    const hasNodeLevel = Boolean(normalizedNodeLevel);
    const hasSubmittedBy = Number.isFinite(safeSubmittedBy) && safeSubmittedBy > 0;
    const hasNodeId = Number.isFinite(safeNodeId) && safeNodeId > 0;

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM karyakarini_category_activities a
       JOIN karyakarini_nodes n ON n.id = a.node_id
       WHERE a.version_id = $1
         AND a.is_active = true
         AND a.node_id = ANY($2::bigint[])
         AND ($3::boolean = false OR lower(COALESCE(a.category, '')) = $4)
         AND ($5::boolean = false OR lower(COALESCE(a.subcategory, '')) = $6)
         AND ($7::boolean = false OR lower(COALESCE(n.level, '')) = $8)
         AND ($9::boolean = false OR a.submitted_by = $10)
         AND ($11::boolean = false OR a.node_id IN (
           WITH RECURSIVE subtree AS (
             SELECT id FROM karyakarini_nodes WHERE id = $12 AND version_id = $1
             UNION ALL
             SELECT c.id FROM karyakarini_nodes c JOIN subtree s ON c.parent_id = s.id WHERE c.version_id = $1
           )
           SELECT id FROM subtree
         ))`,
      [
        Number(versionId),
        visibleNodeIds,
        hasCategory,
        normalizedCategory,
        hasSubcategory,
        normalizedSubcategory,
        hasNodeLevel,
        normalizedNodeLevel,
        hasSubmittedBy,
        safeSubmittedBy,
        hasNodeId,
        safeNodeId,
      ]
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const rowsResult = await pool.query(
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
         a.id,
         a.version_id,
         a.node_id,
         n.name AS node_name,
         n.level AS node_level,
         COALESCE(np.path, n.name) AS hierarchy_path,
         a.submitted_by,
         COALESCE(to_jsonb(u) ->> 'first_name', to_jsonb(u) ->> 'name', ('User #' || a.submitted_by::text)) AS submitted_by_name,
         COALESCE(to_jsonb(u) ->> 'profile_photo_url', to_jsonb(u) ->> 'avatar', to_jsonb(u) ->> 'photo_url') AS submitted_by_avatar,
         a.category,
         a.subcategory,
         a.title,
         a.description,
         COALESCE(a.attachments, '[]'::jsonb) AS attachments,
         a.male_count,
         a.female_count,
         a.children_count,
         a.from_date,
         a.to_date,
         COALESCE(a.status, 'open') AS status,
         a.created_at,
         a.updated_at
       FROM karyakarini_category_activities a
       JOIN karyakarini_nodes n ON n.id = a.node_id
       LEFT JOIN node_paths np ON np.id = n.id
       LEFT JOIN users u ON u.id = a.submitted_by
       WHERE a.version_id = $1
         AND a.is_active = true
         AND a.node_id = ANY($2::bigint[])
         AND ($3::boolean = false OR lower(COALESCE(a.category, '')) = $4)
         AND ($5::boolean = false OR lower(COALESCE(a.subcategory, '')) = $6)
         AND ($7::boolean = false OR lower(COALESCE(n.level, '')) = $8)
         AND ($9::boolean = false OR a.submitted_by = $10)
         AND ($13::boolean = false OR a.node_id IN (
           WITH RECURSIVE subtree AS (
             SELECT id FROM karyakarini_nodes WHERE id = $14 AND version_id = $1
             UNION ALL
             SELECT c.id FROM karyakarini_nodes c JOIN subtree s ON c.parent_id = s.id WHERE c.version_id = $1
           )
           SELECT id FROM subtree
         ))
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT $11 OFFSET $12`,
      [
        Number(versionId),
        visibleNodeIds,
        hasCategory,
        normalizedCategory,
        hasSubcategory,
        normalizedSubcategory,
        hasNodeLevel,
        normalizedNodeLevel,
        hasSubmittedBy,
        safeSubmittedBy,
        safeLimit,
        offset,
        hasNodeId,
        safeNodeId,
      ]
    );

    return {
      rows: rowsResult.rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  static async getCategoryActivityById({ activityId, versionId }) {
    const result = await pool.query(
      `SELECT id, version_id, node_id, submitted_by, category, subcategory, title, description, attachments, male_count, female_count, children_count, from_date, to_date, status, created_at, updated_at
       FROM karyakarini_category_activities
       WHERE id = $1
         AND version_id = $2
         AND is_active = true`,
      [Number(activityId), Number(versionId)]
    );
    return result.rows[0] || null;
  }

  static async updateCategoryActivity({
    activityId,
    versionId,
    title,
    description = null,
    fromDate = null,
    toDate = null,
    status = 'open',
    maleCount = 0,
    femaleCount = 0,
    childrenCount = 0,
    attachments = [],
  }) {
    const result = await pool.query(
      `UPDATE karyakarini_category_activities
       SET title = $3,
           description = $4,
           from_date = $5,
           to_date = $6,
           status = $7,
           male_count = $8,
           female_count = $9,
           children_count = $10,
           attachments = $11::jsonb,
           updated_at = NOW()
       WHERE id = $1
         AND version_id = $2
         AND is_active = true
       RETURNING id, version_id, node_id, submitted_by, category, subcategory, title, description, attachments, male_count, female_count, children_count, from_date, to_date, status, created_at, updated_at`,
      [
        Number(activityId),
        Number(versionId),
        String(title || '').trim(),
        description ? String(description).trim() : null,
        fromDate ? String(fromDate).trim() : null,
        toDate ? String(toDate).trim() : null,
        String(status || 'open'),
        Number(maleCount) || 0,
        Number(femaleCount) || 0,
        Number(childrenCount) || 0,
        JSON.stringify(Array.isArray(attachments) ? attachments : []),
      ]
    );
    return result.rows[0] || null;
  }

  static async deleteTask({ taskId, versionId }) {
    const result = await pool.query(
      `UPDATE karyakarini_tasks
       SET is_active = false,
           updated_at = NOW()
       WHERE id = $1
         AND version_id = $2
         AND is_active = true
       RETURNING id`,
      [Number(taskId), Number(versionId)]
    );
    return result.rows[0] || null;
  }

  static async deleteCategoryActivity({ activityId, versionId }) {
    const result = await pool.query(
      `UPDATE karyakarini_category_activities
       SET is_active = false,
           updated_at = NOW()
       WHERE id = $1
         AND version_id = $2
         AND is_active = true
       RETURNING id`,
      [Number(activityId), Number(versionId)]
    );
    return result.rows[0] || null;
  }
}

module.exports = KaryakariniModel;
