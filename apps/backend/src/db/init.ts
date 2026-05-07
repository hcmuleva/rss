import { adminUsers, masterListItems } from '../data/admin.store';
import { hierarchyNodes, vanshavaliNodes } from '../data/tree.store';
import { db } from './index';

const createSchema = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      assigned_node_id TEXT NOT NULL,
      photo_url TEXT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      is_full_time BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS master_lists (
      id TEXT PRIMARY KEY,
      list_type TEXT NOT NULL,
      name_hi TEXT NOT NULL,
      name_en TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hierarchy_nodes (
      id TEXT PRIMARY KEY,
      name_hi TEXT NOT NULL,
      name_en TEXT NOT NULL,
      level TEXT NOT NULL,
      branch TEXT NOT NULL,
      parent_id TEXT NULL,
      address TEXT NOT NULL,
      address_details JSONB NULL,
      lat DOUBLE PRECISION NOT NULL,
      long DOUBLE PRECISION NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vanshavali_nodes (
      id TEXT PRIMARY KEY,
      parent_id TEXT NULL,
      name TEXT NOT NULL,
      dates JSONB NOT NULL,
      religion TEXT NOT NULL,
      caste TEXT NOT NULL,
      gotra TEXT NOT NULL,
      photo TEXT NULL
    );

    CREATE TABLE IF NOT EXISTS sensitive_entries (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      from_type TEXT NOT NULL,
      to_type TEXT NOT NULL,
      date TEXT NOT NULL,
      is_partial BOOLEAN NOT NULL,
      hindu_count INTEGER NULL,
      converted_count INTEGER NULL,
      status TEXT NOT NULL,
      address TEXT NOT NULL,
      assigned_user_ids TEXT[] NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      male_old INTEGER NOT NULL,
      male_young INTEGER NOT NULL,
      male_kids INTEGER NOT NULL,
      female_old INTEGER NOT NULL,
      female_young INTEGER NOT NULL,
      female_kids INTEGER NOT NULL,
      assigned_user_ids TEXT[] NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS project_tasks (
      id TEXT PRIMARY KEY,
      project_category TEXT NOT NULL,
      task_name TEXT NOT NULL,
      status TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      assigned_user_ids TEXT[] NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS ayam_entries (
      id TEXT PRIMARY KEY,
      sub_category TEXT NOT NULL,
      node_id TEXT NOT NULL,
      description TEXT NOT NULL,
      worked_for TEXT NOT NULL,
      who_worked TEXT NOT NULL,
      date TEXT NOT NULL,
      assigned_user_ids TEXT[] NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS fulltime_tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      location TEXT NOT NULL,
      media_urls TEXT[] NOT NULL DEFAULT '{}',
      assigned_user_ids TEXT[] NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS dharm_raksha_entries (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      media_urls TEXT[] NOT NULL DEFAULT '{}',
      assigned_user_ids TEXT[] NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS module_assignments (
      id TEXT PRIMARY KEY,
      module_type TEXT NOT NULL,
      assignment_key TEXT NOT NULL,
      node_id TEXT NULL,
      assigned_user_ids TEXT[] NOT NULL DEFAULT '{}',
      UNIQUE (module_type, assignment_key, node_id)
    );

    CREATE TABLE IF NOT EXISTS ayam_members (
      id TEXT PRIMARY KEY,
      sub_category TEXT NOT NULL,
      node_id TEXT NOT NULL,
      member_type TEXT NULL,
      name TEXT NOT NULL,
      guardian_name TEXT NOT NULL,
      marital_status TEXT NOT NULL,
      dob TEXT NOT NULL,
      address TEXT NOT NULL,
      address_details JSONB NULL,
      photo_url TEXT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      assigned_user_ids TEXT[] NOT NULL DEFAULT '{}'
    );

    ALTER TABLE sensitive_entries ADD COLUMN IF NOT EXISTS media_urls TEXT[] NOT NULL DEFAULT '{}';
    ALTER TABLE activities ADD COLUMN IF NOT EXISTS media_urls TEXT[] NOT NULL DEFAULT '{}';
    ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS media_urls TEXT[] NOT NULL DEFAULT '{}';
    ALTER TABLE ayam_entries ADD COLUMN IF NOT EXISTS media_urls TEXT[] NOT NULL DEFAULT '{}';
    ALTER TABLE ayam_entries ADD COLUMN IF NOT EXISTS document_urls TEXT[] NOT NULL DEFAULT '{}';
    ALTER TABLE ayam_members ADD COLUMN IF NOT EXISTS address_details JSONB NULL;
    ALTER TABLE ayam_members ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT NULL;
  `);
};

const seedIfEmpty = async () => {
  const usersCount = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
  if (Number(usersCount.rows[0]?.count ?? '0') === 0) {
    for (const user of adminUsers) {
      await db.query(
        `INSERT INTO users (id, name, phone, password, role, assigned_node_id, is_active, is_full_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [user.id, user.name, user.phone, user.password, user.role, user.assignedNodeId, user.isActive, user.isFullTime]
      );
    }
  }

  const masterCount = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM master_lists');
  if (Number(masterCount.rows[0]?.count ?? '0') === 0) {
    for (const item of masterListItems) {
      await db.query(
        `INSERT INTO master_lists (id, list_type, name_hi, name_en) VALUES ($1, $2, $3, $4)`,
        [item.id, item.listType, item.name_hi, item.name_en]
      );
    }
  }

  const hierarchyCount = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM hierarchy_nodes');
  if (Number(hierarchyCount.rows[0]?.count ?? '0') === 0) {
    for (const node of hierarchyNodes) {
      await db.query(
        `INSERT INTO hierarchy_nodes (id, name_hi, name_en, level, branch, parent_id, address, address_details, lat, long)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [node.id, node.name_hi, node.name_en, node.level, node.branch, node.parentId, node.address, node.addressDetails ?? null, node.lat, node.long]
      );
    }
  }

  const vanshavaliCount = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM vanshavali_nodes');
  if (Number(vanshavaliCount.rows[0]?.count ?? '0') === 0) {
    for (const node of vanshavaliNodes) {
      await db.query(
        `INSERT INTO vanshavali_nodes (id, parent_id, name, dates, religion, caste, gotra, photo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [node.id, node.parentId, node.name, node.dates, node.religion, node.caste, node.gotra, node.photo ?? null]
      );
    }
  }
};

export const initDb = async (): Promise<void> => {
  await createSchema();
  await seedIfEmpty();
};
