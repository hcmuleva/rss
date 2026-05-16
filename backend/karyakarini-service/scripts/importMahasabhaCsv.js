#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const KaryakariniModel = require('../src/models/KaryakariniModel');
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
    sr: String(cols[0] || '').trim(),
    pad: String(cols[1] || '').trim(),
    name: String(cols[2] || '').trim(),
    village: String(cols[3] || '').trim(),
    mobile: sanitizeMobile(String(cols[4] || '').trim()),
  };
};

async function run() {
  const csvPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_CSV_PATH;
  const nodeIdArg = Number(process.argv[3] || 9);
  const nodeId = Number.isFinite(nodeIdArg) && nodeIdArg > 0 ? nodeIdArg : 9;

  const csv = fs.readFileSync(csvPath, 'utf8');
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) {
    throw new Error('CSV has no data rows');
  }

  const versionId = await KaryakariniModel.resolveVersionId('current');
  if (!versionId) throw new Error('Current karyakarini version not found');

  const stats = {
    total: 0,
    created: 0,
    skippedExistingUser: 0,
    skippedExistingMember: 0,
    failed: 0,
    failures: [],
  };

  for (let i = 1; i < lines.length; i += 1) {
    const parsed = parseRow(lines[i]);
    if (!parsed || !parsed.name || !parsed.mobile) continue;

    stats.total += 1;
    try {
      const result = await KaryakariniModel.createMappedMemberWithUser({
        mobileNumber: parsed.mobile,
        name: parsed.name,
        pad: parsed.pad || null,
        village: parsed.village || null,
        nodeId,
        versionId,
        createdBy: null,
        dob: '1990-01-01',
        gotra: 'Unknown',
        fatherOrHusbandName: 'Unknown',
        avatar: null,
        skipExistingUser: true,
      });

      if (result.status === 'created') stats.created += 1;
      else if (result.status === 'skipped_existing_user') stats.skippedExistingUser += 1;
      else if (result.status === 'skipped_existing_member') stats.skippedExistingMember += 1;
    } catch (error) {
      stats.failed += 1;
      stats.failures.push({
        line: i + 1,
        sr: parsed.sr,
        name: parsed.name,
        mobile: parsed.mobile,
        error: error?.message || String(error),
      });
    }
  }

  console.log('Import summary:', stats);
  if (stats.failures.length) {
    console.log('Failed rows:');
    for (const fail of stats.failures) {
      console.log(
        `- line ${fail.line} (sr ${fail.sr}, ${fail.name}, ${fail.mobile}): ${fail.error}`
      );
    }
  }
}

run()
  .catch((error) => {
    console.error('Import failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
