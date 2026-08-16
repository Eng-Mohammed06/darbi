#!/usr/bin/env node
/**
 * Load data/*.json into Postgres.
 *
 *   npm run db:seed
 *
 * Idempotent — re-running gives the same result, so it is safe to re-seed a
 * live database after the team ships corrected spreadsheets:
 *
 *   - majors           upserted on `slug`, so existing ids (and the
 *                      saved_majors rows pointing at them) survive
 *   - reference data   replaced wholesale (courses, paths, centres, ...)
 *   - jobs             only seeded rows are replaced (company_id IS NULL);
 *                      jobs posted through the company portal are untouched
 *   - demo accounts    upserted on email
 *
 * Regenerate data/*.json from the approved deliverables first:
 *   python3 scripts/convert_xlsx.py docs/deliverables
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool, withTransaction } from '../server/lib/db.js';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

// Judges need working logins without signing up. Override in Railway with
// DEMO_PASSWORD; the default is fine for a hackathon demo but is not a secret.
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'darbi2026';

async function load(name) {
  try {
    return JSON.parse(await readFile(join(DATA, name), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn(`  ! data/${name} missing — skipping`);
      return [];
    }
    throw err;
  }
}

/** Bulk insert helper: one statement per table instead of one per row. */
async function insertAll(client, table, columns, rows, mapper) {
  if (!rows.length) return;
  const values = [];
  const tuples = rows.map((row, i) => {
    const mapped = mapper(row);
    const placeholders = mapped.map((_, j) => `$${i * columns.length + j + 1}`);
    values.push(...mapped);
    return `(${placeholders.join(',')})`;
  });
  await client.query(
    `INSERT INTO ${table} (${columns.join(',')}) VALUES ${tuples.join(',')}`,
    values,
  );
}

async function seedMajors(client, majors) {
  const ids = new Map();
  for (const m of majors) {
    const { rows } = await client.query(
      `INSERT INTO majors (slug, name, faculty, duration_years, entry_requirements, top_jobs,
                           salary_entry_min_jod, salary_entry_max_jod, salary_entry_raw,
                           salary_3yr_min_jod, salary_3yr_max_jod, salary_3yr_raw,
                           salary_5yr_min_jod, salary_5yr_max_jod, salary_5yr_raw,
                           salary_source, salary_confidence, data_quality)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name, faculty = EXCLUDED.faculty,
         duration_years = EXCLUDED.duration_years,
         entry_requirements = EXCLUDED.entry_requirements,
         top_jobs = EXCLUDED.top_jobs,
         salary_entry_min_jod = EXCLUDED.salary_entry_min_jod,
         salary_entry_max_jod = EXCLUDED.salary_entry_max_jod,
         salary_entry_raw = EXCLUDED.salary_entry_raw,
         salary_3yr_min_jod = EXCLUDED.salary_3yr_min_jod,
         salary_3yr_max_jod = EXCLUDED.salary_3yr_max_jod,
         salary_3yr_raw = EXCLUDED.salary_3yr_raw,
         salary_5yr_min_jod = EXCLUDED.salary_5yr_min_jod,
         salary_5yr_max_jod = EXCLUDED.salary_5yr_max_jod,
         salary_5yr_raw = EXCLUDED.salary_5yr_raw,
         salary_source = EXCLUDED.salary_source,
         salary_confidence = EXCLUDED.salary_confidence,
         data_quality = EXCLUDED.data_quality
       RETURNING id, slug, name`,
      [m.slug, m.name, m.faculty, m.duration_years, m.entry_requirements, m.top_jobs ?? [],
       m.salary_entry_min_jod, m.salary_entry_max_jod, m.salary_entry_raw,
       m.salary_3yr_min_jod, m.salary_3yr_max_jod, m.salary_3yr_raw,
       m.salary_5yr_min_jod, m.salary_5yr_max_jod, m.salary_5yr_raw,
       m.salary_source, m.salary_confidence, m.data_quality ?? 'pending'],
    );
    ids.set(rows[0].slug, rows[0].id);
    ids.set(rows[0].name.toLowerCase(), rows[0].id);
  }
  return ids;
}

async function seedUniversities(client, universities) {
  const ids = new Map();
  for (const u of universities) {
    const { rows } = await client.query(
      `INSERT INTO universities (code, name, name_in_source, city, website, website_source,
                                 source_files, programs_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name, name_in_source = EXCLUDED.name_in_source,
         city = COALESCE(EXCLUDED.city, universities.city),
         website = COALESCE(EXCLUDED.website, universities.website),
         website_source = COALESCE(EXCLUDED.website_source, universities.website_source),
         source_files = EXCLUDED.source_files,
         programs_note = COALESCE(EXCLUDED.programs_note, universities.programs_note)
       RETURNING id, code`,
      [u.code, u.name, u.name_in_source, u.city, u.website, u.website_source,
       u.source_files ?? [], u.programs_note],
    );
    ids.set(rows[0].code, rows[0].id);
  }
  return ids;
}

async function main() {
  const [
    majors, universities, universityMajors, courses, careerPaths,
    trainingCenters, onlinePlatforms, jobs, benchmarks, references,
  ] = await Promise.all([
    load('majors.json'), load('universities.json'), load('university_majors.json'),
    load('courses.json'), load('career_paths.json'), load('training_centers.json'),
    load('online_platforms.json'), load('jobs.json'),
    load('salary_benchmarks.json'), load('salary_references.json'),
  ]);

  let skipped = 0;

  await withTransaction(async (client) => {
    const majorIds = await seedMajors(client, majors);
    const uniIds = await seedUniversities(client, universities);
    const majorId = (name) => majorIds.get((name ?? '').toLowerCase()) ?? null;

    await client.query('DELETE FROM university_majors');
    for (const l of universityMajors) {
      const uid = uniIds.get(l.university_code);
      const mid = majorId(l.major_name);
      if (!uid || !mid) { skipped += 1; continue; }
      await client.query(
        `INSERT INTO university_majors (university_id, major_id, program_name, faculty,
                                        duration_years, parallel_average, competitive_average,
                                        minimum_average, relation, evidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (university_id, major_id, program_name) DO UPDATE SET
           faculty = EXCLUDED.faculty, duration_years = EXCLUDED.duration_years,
           parallel_average = EXCLUDED.parallel_average,
           competitive_average = EXCLUDED.competitive_average,
           minimum_average = EXCLUDED.minimum_average,
           relation = EXCLUDED.relation, evidence = EXCLUDED.evidence`,
        [uid, mid, l.program_name, l.faculty, l.duration_years, l.parallel_average,
         l.competitive_average, l.minimum_average, l.relation ?? 'offers_degree', l.evidence],
      );
    }

    await client.query('DELETE FROM courses');
    await insertAll(client, 'courses',
      ['major_id', 'major_name', 'track', 'name', 'what_you_learn', 'provider', 'accreditation',
       'online_alternative', 'duration', 'cost_raw', 'cost_min_jod', 'cost_max_jod',
       'cost_online_usd', 'notes', 'source_sheet'],
      courses,
      (c) => [majorId(c.major_name), c.major_name, c.track, c.name, c.what_you_learn, c.provider,
              c.accreditation, c.online_alternative, c.duration, c.cost_raw, c.cost_min_jod,
              c.cost_max_jod, c.cost_online_usd, c.notes, c.source_sheet]);

    await client.query('DELETE FROM career_paths');
    await insertAll(client, 'career_paths',
      ['major_id', 'major_name', 'name', 'focus', 'typical_roles', 'tools', 'skills',
       'coursera', 'udemy', 'jordan_centers', 'source_sheet'],
      careerPaths,
      (p) => [majorId(p.major_name), p.major_name, p.name, p.focus, p.typical_roles, p.tools,
              p.skills, p.coursera, p.udemy, p.jordan_centers, p.source_sheet]);

    await client.query('DELETE FROM training_centers');
    await insertAll(client, 'training_centers',
      ['name', 'field', 'location', 'specialty', 'notes', 'website', 'source_sheet'],
      trainingCenters,
      (t) => [t.name, t.field, t.location, t.specialty, t.notes, t.website, t.source_sheet]);

    await client.query('DELETE FROM online_platforms');
    await insertAll(client, 'online_platforms',
      ['name', 'best_for', 'pricing', 'notes', 'source_sheet'],
      onlinePlatforms,
      (p) => [p.name, p.best_for, p.pricing, p.notes, p.source_sheet]);

    await client.query('DELETE FROM salary_benchmarks');
    await insertAll(client, 'salary_benchmarks',
      ['role_family', 'range_raw', 'min_jod', 'max_jod', 'source'],
      benchmarks,
      (b) => [b.role_family, b.range_raw, b.min_jod, b.max_jod, b.source]);

    await client.query('DELETE FROM salary_references');
    await insertAll(client, 'salary_references',
      ['id', 'source', 'role', 'provided', 'link'],
      references,
      (r) => [r.id, r.source, r.role, r.provided, r.link]);

    // Seeded listings only. Company-posted jobs (company_id NOT NULL) survive.
    await client.query('DELETE FROM jobs WHERE company_id IS NULL');
    await insertAll(client, 'jobs',
      ['company_name', 'title', 'required_majors', 'canonical_majors', 'min_gpa', 'min_gpa_raw',
       'salary_raw', 'salary_min_jod', 'salary_max_jod', 'salary_is_estimate',
       'required_skills', 'source', 'verified'],
      jobs,
      (j) => [j.company_name, j.title, j.required_majors ?? [], j.canonical_majors ?? [],
              j.min_gpa, j.min_gpa_raw, j.salary_raw, j.salary_min_jod, j.salary_max_jod,
              j.salary_is_estimate ?? false, j.required_skills ?? [], j.source,
              j.verified ?? false]);

    await seedDemoAccounts(client);
  });

  if (skipped) console.warn(`  ! ${skipped} university-major link(s) had no matching row`);

  const counts = await pool.query(`
    SELECT 'majors' AS t, count(*) FROM majors
    UNION ALL SELECT 'universities', count(*) FROM universities
    UNION ALL SELECT 'university_majors', count(*) FROM university_majors
    UNION ALL SELECT 'courses', count(*) FROM courses
    UNION ALL SELECT 'career_paths', count(*) FROM career_paths
    UNION ALL SELECT 'training_centers', count(*) FROM training_centers
    UNION ALL SELECT 'online_platforms', count(*) FROM online_platforms
    UNION ALL SELECT 'jobs', count(*) FROM jobs
    UNION ALL SELECT 'salary_benchmarks', count(*) FROM salary_benchmarks
    UNION ALL SELECT 'salary_references', count(*) FROM salary_references
    UNION ALL SELECT 'users', count(*) FROM users`);

  console.log('\nseeded:');
  for (const r of counts.rows) console.log(`  ${r.t.padEnd(20)} ${String(r.count).padStart(4)}`);

  const cover = await pool.query(
    `SELECT count(*) FILTER (WHERE salary_entry_min_jod IS NOT NULL)::int AS with_salary,
            count(*)::int AS total,
            (SELECT count(DISTINCT major_id)::int FROM university_majors) AS with_university,
            (SELECT count(*)::int FROM university_majors WHERE competitive_average IS NOT NULL)
              AS with_competitive_avg
       FROM majors`,
  );
  const c = cover.rows[0];
  console.log('\ncoverage:');
  console.log(`  majors with a salary band     : ${c.with_salary}/${c.total}`);
  console.log(`  majors taught at a university : ${c.with_university}/${c.total}`);
  console.log(`  programmes with a Tawjihi avg : ${c.with_competitive_avg}`);

  console.log(`\ndemo logins (password: ${DEMO_PASSWORD}):`);
  console.log('  student@darbi.jo  company@darbi.jo  career@darbi.jo');
}

async function seedDemoAccounts(client) {
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  async function upsertUser(email, username, role) {
    // Pre-verified: judges log into these directly and should never see the
    // "verify your email" nag that a real signup would get.
    const { rows } = await client.query(
      `INSERT INTO users (email, username, password_hash, role, email_verified)
       VALUES ($1,$2,$3,$4,true)
       ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username,
                                         password_hash = EXCLUDED.password_hash,
                                         role = EXCLUDED.role, email_verified = true,
                                         updated_at = now()
       RETURNING id`,
      [email.toLowerCase(), username, hash, role],
    );
    return rows[0].id;
  }

  const studentId = await upsertUser('student@darbi.jo', 'demo_student', 'student');
  await client.query(
    `INSERT INTO students (user_id, name, level, interests, gpa, tawjihi_average, location, salary_pref)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (user_id) DO UPDATE SET
       name = EXCLUDED.name, level = EXCLUDED.level, interests = EXCLUDED.interests,
       gpa = EXCLUDED.gpa, tawjihi_average = EXCLUDED.tawjihi_average,
       location = EXCLUDED.location, salary_pref = EXCLUDED.salary_pref`,
    [studentId, 'Demo Student', 'undergraduate',
     ['Software', 'Data Science', 'Cybersecurity'], 3.4, 94.5, 'Amman', '800-1200 JOD'],
  );

  const companyId = await upsertUser('company@darbi.jo', 'demo_company', 'company');
  await client.query(
    `INSERT INTO companies (user_id, name, industry, website, description, location, logo)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (user_id) DO UPDATE SET
       name = EXCLUDED.name, industry = EXCLUDED.industry, website = EXCLUDED.website,
       description = EXCLUDED.description, location = EXCLUDED.location, logo = EXCLUDED.logo`,
    [companyId, 'Demo Tech Co.', 'Software', 'https://example.jo',
     'A demo software company used for judging the DARBI platform.', 'Amman, Jordan',
     // 1x1 transparent PNG — a real logo image would be dropped in for a real
     // account; this just needs to satisfy the "logo required" completeness
     // check (src/App.jsx) so the demo account isn't sent to the setup page.
     'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='],
  );

  const careerId = await upsertUser('career@darbi.jo', 'demo_career', 'career');
  await client.query(
    `INSERT INTO career_profiles (user_id, name, current_title, years_experience, major, skills)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id) DO UPDATE SET
       name = EXCLUDED.name, current_title = EXCLUDED.current_title,
       years_experience = EXCLUDED.years_experience, major = EXCLUDED.major,
       skills = EXCLUDED.skills`,
    [careerId, 'Demo Graduate', 'Software Engineer', 4, 'Computer Engineering',
     ['JavaScript', 'Node.js', 'SQL']],
  );
}

main()
  .catch((err) => {
    console.error('seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
