#!/usr/bin/env node
/**
 * Apply db/schema.sql.
 *
 *   npm run db:migrate          apply (idempotent — safe to re-run)
 *   npm run db:migrate -- --drop   DESTRUCTIVE: drop every table first
 *
 * --drop exists for local iteration and for rebuilding the demo database
 * before judging. It refuses to run against a non-local database unless
 * ALLOW_DESTRUCTIVE=1 is also set, so a stray flag can't wipe production.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from '../server/lib/db.js';

const here = dirname(fileURLToPath(import.meta.url));
const drop = process.argv.includes('--drop');

const TABLES = [
  'onboarding_analysis',
  'chat_messages',
  'job_applications',
  'online_platforms',
  'salary_benchmarks',
  'salary_references',
  'recommendations',
  'saved_majors',
  'jobs',
  'training_centers',
  'career_paths',
  'courses',
  'university_majors',
  'majors',
  'universities',
  'career_profiles',
  'companies',
  'students',
  'users',
];

async function main() {
  if (drop) {
    const url = process.env.DATABASE_URL ?? '';
    const isLocal = /@(localhost|127\.0\.0\.1|postgres)[:/]/.test(url);
    if (!isLocal && process.env.ALLOW_DESTRUCTIVE !== '1') {
      console.error(
        '\nRefusing to --drop a non-local database.\n' +
          `  target: ${url.replace(/:[^:@/]+@/, ':****@')}\n` +
          '  If you really mean it: ALLOW_DESTRUCTIVE=1 npm run db:migrate -- --drop\n',
      );
      process.exit(1);
    }
    console.log(`dropping ${TABLES.length} tables...`);
    await pool.query(`DROP TABLE IF EXISTS ${TABLES.join(', ')} CASCADE`);
  }

  const sql = await readFile(join(here, '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('schema applied.');

  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`,
  );
  console.log(`${rows.length} tables:`, rows.map((r) => r.table_name).join(', '));
}

main()
  .catch((err) => {
    console.error('migrate failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
