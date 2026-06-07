#!/usr/bin/env node
/*
 * Import a karyakarini node tree (प्रान्त → ... → मोहल्ला) from a JSON file.
 *
 * JSON shape:
 *   {
 *     "version": { "name": "...", "startYear": 2026, "endYear": 2028 },
 *     "tree": [ { "name": "...", "level": "prant", "children": [ ... ] } ]
 *   }
 *
 * Usage:
 *   node scripts/importTree.js [jsonPath] [options]
 *
 * Options:
 *   --version=current        Import into the current (live) version
 *   --version=<id>           Import into an existing version id
 *   --new-version="Name"     Create a new version with this name (default behaviour
 *                            uses the name from the JSON's "version" block)
 *   --make-current           When creating a new version, also mark it current
 *   --parent=<id>            Attach the imported root(s) under this existing node id
 *   --dry-run                Show what would be created without writing anything
 *
 * Re-running is idempotent: a node with the same (version, parent, level, name)
 * is reused instead of duplicated.
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('../src/config/database');

const DEFAULT_JSON_PATH = path.resolve(
  __dirname,
  '../../../db-dumps/seed-data/malwa-tree.json'
);

const KNOWN_LEVELS = new Set([
  'rashtriya', 'prant', 'sambhag', 'vibhag', 'jila',
  'khand', 'mandal', 'nagar', 'gram', 'basti', 'mohalla',
]);

function parseArgs(argv) {
  const opts = { jsonPath: null, version: null, newVersion: null, makeCurrent: false, parentId: null, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eq = arg.indexOf('=');
    const key = eq >= 0 ? arg.slice(0, eq) : arg;
    const inlineVal = eq >= 0 ? arg.slice(eq + 1) : null;
    const next = () => (inlineVal !== null ? inlineVal : argv[++i]);
    switch (key) {
      case '--version': opts.version = next(); break;
      case '--new-version': opts.newVersion = next(); break;
      case '--make-current': opts.makeCurrent = true; break;
      case '--parent': opts.parentId = Number(next()); break;
      case '--dry-run': opts.dryRun = true; break;
      default:
        if (!arg.startsWith('--') && !opts.jsonPath) opts.jsonPath = path.resolve(arg);
    }
  }
  return opts;
}

async function resolveVersion(client, opts, jsonVersion) {
  if (opts.version === 'current') {
    const r = await client.query(`SELECT id, name FROM karyakarini_versions WHERE is_current = true LIMIT 1`);
    if (!r.rows[0]) throw new Error('No current version found');
    return { id: r.rows[0].id, name: r.rows[0].name, created: false };
  }
  if (opts.version != null) {
    const id = Number(opts.version);
    if (!Number.isFinite(id) || id <= 0) throw new Error(`Invalid --version "${opts.version}"`);
    const r = await client.query(`SELECT id, name FROM karyakarini_versions WHERE id = $1`, [id]);
    if (!r.rows[0]) throw new Error(`Version ${id} not found`);
    return { id: r.rows[0].id, name: r.rows[0].name, created: false };
  }
  // default: create a new version
  const name = opts.newVersion || (jsonVersion && jsonVersion.name) || 'Imported Tree';
  const startYear = jsonVersion && jsonVersion.startYear ? Number(jsonVersion.startYear) : null;
  const endYear = jsonVersion && jsonVersion.endYear ? Number(jsonVersion.endYear) : null;
  if (opts.makeCurrent) {
    await client.query(`UPDATE karyakarini_versions SET is_current = false WHERE is_current = true`);
  }
  const r = await client.query(
    `INSERT INTO karyakarini_versions (name, start_year, end_year, is_current, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING id, name`,
    [name, startYear, endYear, Boolean(opts.makeCurrent)]
  );
  return { id: r.rows[0].id, name: r.rows[0].name, created: true };
}

async function insertNode(client, { node, parentId, versionId, sortOrder, stats, dryRun }) {
  const name = String(node.name || '').trim();
  const level = String(node.level || '').trim().toLowerCase();
  if (!name || !level) throw new Error(`Node missing name/level: ${JSON.stringify(node)}`);
  if (!KNOWN_LEVELS.has(level)) {
    stats.unknownLevels.add(level);
  }

  let id;
  const existing = await client.query(
    `SELECT id FROM karyakarini_nodes
     WHERE version_id = $1 AND parent_id IS NOT DISTINCT FROM $2
       AND level = $3 AND lower(name) = lower($4)
     LIMIT 1`,
    [versionId, parentId, level, name]
  );

  if (existing.rows[0]) {
    id = existing.rows[0].id;
    stats.skipped += 1;
  } else if (dryRun) {
    id = null; // cannot recurse with a real id in dry-run; use placeholder counting
    stats.created += 1;
    stats.byLevel[level] = (stats.byLevel[level] || 0) + 1;
  } else {
    const r = await client.query(
      `INSERT INTO karyakarini_nodes (name, level, parent_id, version_id, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [name, level, parentId, versionId, sortOrder]
    );
    id = r.rows[0].id;
    stats.created += 1;
    stats.byLevel[level] = (stats.byLevel[level] || 0) + 1;
  }

  const children = Array.isArray(node.children) ? node.children : [];
  for (let i = 0; i < children.length; i += 1) {
    await insertNode(client, {
      node: children[i],
      parentId: id, // null in dry-run; dedupe lookup just won't match, counts stay correct
      versionId,
      sortOrder: i,
      stats,
      dryRun,
    });
  }
  return id;
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  const jsonPath = opts.jsonPath || DEFAULT_JSON_PATH;
  if (!fs.existsSync(jsonPath)) throw new Error(`JSON file not found: ${jsonPath}`);

  const doc = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const roots = Array.isArray(doc.tree) ? doc.tree : Array.isArray(doc) ? doc : [];
  if (!roots.length) throw new Error('JSON has no "tree" array');

  const client = await pool.connect();
  const stats = { created: 0, skipped: 0, byLevel: {}, unknownLevels: new Set() };
  try {
    await client.query('BEGIN');

    const version = await resolveVersion(client, opts, doc.version);

    let parentId = null;
    if (opts.parentId != null) {
      if (!Number.isFinite(opts.parentId) || opts.parentId <= 0) throw new Error('Invalid --parent id');
      const p = await client.query(
        `SELECT id FROM karyakarini_nodes WHERE id = $1 AND version_id = $2`,
        [opts.parentId, version.id]
      );
      if (!p.rows[0]) throw new Error(`--parent ${opts.parentId} not found in version ${version.id}`);
      parentId = opts.parentId;
    }

    for (let i = 0; i < roots.length; i += 1) {
      await insertNode(client, {
        node: roots[i],
        parentId,
        versionId: version.id,
        sortOrder: i,
        stats,
        dryRun: opts.dryRun,
      });
    }

    if (opts.dryRun) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
    }

    console.log('--- Tree import summary ---');
    console.log(`JSON:     ${jsonPath}`);
    console.log(`Version:  #${version.id} "${version.name}"${version.created ? ' (created)' : ''}${opts.makeCurrent ? ' (current)' : ''}`);
    console.log(`Parent:   ${parentId == null ? '(root)' : parentId}`);
    console.log(`Mode:     ${opts.dryRun ? 'DRY RUN (no changes written)' : 'WRITE'}`);
    console.log(`Created:  ${stats.created}`);
    console.log(`Reused:   ${stats.skipped}`);
    console.log('By level:');
    for (const lvl of ['prant', 'sambhag', 'vibhag', 'jila', 'khand', 'mandal', 'nagar', 'gram', 'basti', 'mohalla']) {
      if (stats.byLevel[lvl]) console.log(`  ${lvl.padEnd(9)} ${stats.byLevel[lvl]}`);
    }
    if (stats.unknownLevels.size) {
      console.log(`WARNING: unknown level codes used: ${[...stats.unknownLevels].join(', ')}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

run()
  .catch((error) => {
    console.error('Tree import failed:', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
