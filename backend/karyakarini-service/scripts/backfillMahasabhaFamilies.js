#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../src/config/database');

const DEFAULT_CSV_PATH = path.resolve(
  __dirname,
  '../../../els/kids/docs/karykarini/mahasabha-table.csv'
);

const sanitizeMobile = (value) => String(value || '').replace(/\D/g, '');

const parseRow = (line) => {
  const cols = line.split(',');
  if (cols.length < 5) return null;
  return {
    pad: String(cols[1] || '').trim(),
    name: String(cols[2] || '').trim(),
    village: String(cols[3] || '').trim(),
    mobile: sanitizeMobile(String(cols[4] || '').trim()),
  };
};

const randomSlug = (prefix = 'fam-', length = 8) => {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  const bytes = crypto.randomBytes(length);
  let token = '';
  for (let i = 0; i < length; i += 1) token += alphabet[bytes[i] % alphabet.length];
  return `${prefix}${token}`;
};

async function generateUniqueFamilySlug(client) {
  for (let i = 0; i < 60; i += 1) {
    const slug = randomSlug('fam-', 8);
    const exists = await client.query('SELECT 1 FROM families WHERE slug = $1 LIMIT 1', [slug]);
    if (!exists.rows[0]) return slug;
  }
  throw new Error('Could not generate unique family slug');
}

async function run() {
  const csvPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_CSV_PATH;
  const csv = fs.readFileSync(csvPath, 'utf8');
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const stats = {
    totalRows: 0,
    usersFound: 0,
    familiesCreated: 0,
    familyMembersCreated: 0,
    mappingsUpserted: 0,
    karyMembersUpdated: 0,
    failed: 0,
  };

  for (let i = 1; i < lines.length; i += 1) {
    const row = parseRow(lines[i]);
    if (!row || !row.mobile || !row.name) continue;
    stats.totalRows += 1;

    const email = `${row.mobile}@emeelan.com`;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userRes = await client.query(
        `SELECT id, family_id
         FROM users
         WHERE email = $1 OR phone = $2
         ORDER BY id ASC
         LIMIT 1`,
        [email, row.mobile]
      );
      if (!userRes.rows[0]) {
        await client.query('ROLLBACK');
        continue;
      }

      stats.usersFound += 1;
      const userId = Number(userRes.rows[0].id);
      let familyId = userRes.rows[0].family_id ? Number(userRes.rows[0].family_id) : null;
      const familyName = `${row.name} ${row.village}`.trim();

      await client.query(
        `UPDATE users
         SET phone = COALESCE(phone, $1),
             village = COALESCE(village, $2),
             updated_at = NOW()
         WHERE id = $3`,
        [row.mobile, row.village || null, userId]
      );

      if (!familyId) {
        const slug = await generateUniqueFamilySlug(client);
        const familyInsert = await client.query(
          `INSERT INTO families (slug, name, created_by, head_of_family_name, phone, email, village, active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)
           RETURNING id`,
          [slug, familyName || row.name, userId, row.name, row.mobile, email, row.village || null]
        );
        familyId = Number(familyInsert.rows[0].id);
        stats.familiesCreated += 1;

        await client.query(
          `UPDATE users
           SET family_id = $1, updated_at = NOW()
           WHERE id = $2`,
          [familyId, userId]
        );
      } else {
        await client.query(
          `UPDATE families
           SET name = COALESCE(NULLIF($1, ''), name),
               head_of_family_name = COALESCE(NULLIF($2, ''), head_of_family_name),
               phone = COALESCE(phone, $3),
               email = COALESCE(email, $4),
               village = COALESCE(village, $5),
               updated_at = NOW()
           WHERE id = $6`,
          [familyName, row.name, row.mobile, email, row.village || null, familyId]
        );
      }

      let familyMemberId = null;
      const fmExisting = await client.query(
        `SELECT id
         FROM family_members
         WHERE user_id = $1 AND family_id = $2
         LIMIT 1`,
        [userId, familyId]
      );
      if (fmExisting.rows[0]) {
        familyMemberId = Number(fmExisting.rows[0].id);
      } else {
        const fmInsert = await client.query(
          `INSERT INTO family_members (
             family_id, user_id, relation_to_head, is_head, joined_at,
             is_head_of_family, relationship_to_head, is_alive, phone, email, active
           )
           VALUES ($1, $2, 'self', true, NOW(), true, 'self', true, $3, $4, true)
           RETURNING id`,
          [familyId, userId, row.mobile, email]
        );
        familyMemberId = Number(fmInsert.rows[0].id);
        stats.familyMembersCreated += 1;
      }

      await client.query(
        `INSERT INTO user_family_mapping (user_id, family_id, family_member_id, is_primary, role)
         VALUES ($1, $2, $3, true, 'head')
         ON CONFLICT (user_id, family_id)
         DO UPDATE
         SET family_member_id = COALESCE(EXCLUDED.family_member_id, user_family_mapping.family_member_id),
             is_primary = true,
             role = 'head',
             updated_at = NOW()`,
        [userId, familyId, familyMemberId]
      );
      stats.mappingsUpserted += 1;

      const karyUpdate = await client.query(
        `UPDATE karyakarini_members
         SET user_id = COALESCE(user_id, $1),
             father_or_husband_name = COALESCE(father_or_husband_name, 'Unknown'),
             pad = COALESCE(NULLIF($2, ''), pad),
             updated_at = NOW()
         WHERE mobile_number = $3
           AND node_id = 9
           AND version_id = (SELECT id FROM karyakarini_versions WHERE is_current = true ORDER BY id DESC LIMIT 1)`,
        [userId, row.pad || null, row.mobile]
      );
      stats.karyMembersUpdated += Number(karyUpdate.rowCount || 0);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      stats.failed += 1;
      console.error(`Failed row ${i + 1} (${row.mobile}):`, error.message);
    } finally {
      client.release();
    }
  }

  console.log('Backfill summary:', stats);
}

run()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
