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
 *   - courses          replaced wholesale (pure reference data)
 *   - jobs             only seeded rows are replaced (company_id IS NULL);
 *                      jobs posted through the company portal are untouched
 *   - demo accounts    upserted on email
 *
 * Regenerate data/*.json from spreadsheets first:
 *   python3 scripts/convert_xlsx.py <dir-with-xlsx>
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

async function seedMajors(client, majors) {
  const bySlug = new Map();
  for (const m of majors) {
    const { rows } = await client.query(
      `INSERT INTO majors (slug, name, faculty, duration_years, entry_requirements,
                           salary_entry_jod, salary_3yr_jod, salary_5yr_jod,
                           salary_source, top_jobs, data_quality)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         faculty = EXCLUDED.faculty,
         duration_years     = COALESCE(EXCLUDED.duration_years, majors.duration_years),
         entry_requirements = COALESCE(EXCLUDED.entry_requirements, majors.entry_requirements),
         salary_entry_jod   = COALESCE(EXCLUDED.salary_entry_jod, majors.salary_entry_jod),
         salary_3yr_jod     = COALESCE(EXCLUDED.salary_3yr_jod, majors.salary_3yr_jod),
         salary_5yr_jod     = COALESCE(EXCLUDED.salary_5yr_jod, majors.salary_5yr_jod),
         salary_source      = COALESCE(EXCLUDED.salary_source, majors.salary_source),
         data_quality       = EXCLUDED.data_quality
       RETURNING id, slug, name`,
      [
        m.slug, m.name, m.faculty, m.duration_years, m.entry_requirements,
        m.salary_entry_jod, m.salary_3yr_jod, m.salary_5yr_jod,
        m.salary_source, m.top_jobs ?? [], m.data_quality ?? 'pending',
      ],
    );
    bySlug.set(rows[0].slug, rows[0].id);
    bySlug.set(rows[0].name.toLowerCase(), rows[0].id);
  }
  return bySlug;
}

async function seedUniversities(client, universities) {
  const byCode = new Map();
  for (const u of universities) {
    const { rows } = await client.query(
      `INSERT INTO universities (code, name, city, website, website_source,
                                 source_files, programs_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         city = COALESCE(EXCLUDED.city, universities.city),
         website = EXCLUDED.website,
         website_source = EXCLUDED.website_source,
         source_files = EXCLUDED.source_files,
         programs_note = COALESCE(EXCLUDED.programs_note, universities.programs_note)
       RETURNING id, code`,
      [u.code, u.name, u.city ?? null, u.website, u.website_source,
       u.source_files ?? [], u.programs_note ?? null],
    );
    byCode.set(rows[0].code, rows[0].id);
  }
  return byCode;
}

async function seedUniversityMajors(client, links, universityIds, majorIds) {
  await client.query('DELETE FROM university_majors');
  let skipped = 0;
  for (const l of links) {
    const universityId = universityIds.get(l.university_code);
    const majorId = majorIds.get(l.major_name?.toLowerCase());
    if (!universityId || !majorId) {
      skipped += 1;
      continue;
    }
    await client.query(
      `INSERT INTO university_majors (university_id, major_id, relation, course_count, evidence)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (university_id, major_id) DO UPDATE SET
         relation = EXCLUDED.relation,
         course_count = EXCLUDED.course_count,
         evidence = EXCLUDED.evidence`,
      [universityId, majorId, l.relation ?? 'provides_courses', l.course_count ?? 0, l.evidence],
    );
  }
  if (skipped) console.warn(`  ! ${skipped} university-major link(s) had no matching row`);
}

async function seedCourses(client, courses, majorIds) {
  await client.query('DELETE FROM courses');
  let orphans = 0;
  for (const c of courses) {
    const majorId = majorIds.get(c.major_name?.toLowerCase()) ?? null;
    if (!majorId) orphans += 1;
    await client.query(
      `INSERT INTO courses (major_id, major_name, sub_field, name, provider,
                            accreditation, cost_raw, cost_min_jod, cost_max_jod,
                            duration, qualifications, notes, source_file)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        majorId, c.major_name, c.sub_field, c.name, c.provider,
        c.accreditation, c.cost_raw, c.cost_min_jod, c.cost_max_jod,
        c.duration, c.qualifications, c.notes, c.source_file,
      ],
    );
  }
  if (orphans) console.warn(`  ! ${orphans} course(s) had no matching major — major_id left null`);
}

async function seedJobs(client, jobs) {
  // Seeded listings only. Company-posted jobs (company_id NOT NULL) survive.
  await client.query('DELETE FROM jobs WHERE company_id IS NULL');
  for (const j of jobs) {
    await client.query(
      `INSERT INTO jobs (company_name, title, required_majors, min_gpa, salary_raw,
                         salary_min_jod, salary_max_jod, required_skills,
                         location, source, verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        j.company_name, j.title, j.required_majors ?? [], j.min_gpa, j.salary_raw,
        j.salary_min_jod, j.salary_max_jod, j.required_skills ?? [],
        j.location ?? null, j.source, j.verified ?? false,
      ],
    );
  }
}

async function seedCareer(client, paths, centers) {
  await client.query('DELETE FROM career_paths');
  for (const p of paths) {
    await client.query(
      `INSERT INTO career_paths (track, title, skills, coursera, udemy, jordan_centers)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [p.track, p.title, p.skills, p.coursera, p.udemy, p.jordan_centers],
    );
  }
  await client.query('DELETE FROM training_centers');
  for (const c of centers) {
    await client.query(
      `INSERT INTO training_centers (field, name, study_type, details, contact)
       VALUES ($1,$2,$3,$4,$5)`,
      [c.field, c.name, c.study_type, c.details, c.contact],
    );
  }
}

async function seedDemoAccounts(client) {
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  async function upsertUser(email, role) {
    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1,$2,$3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash,
                                         role = EXCLUDED.role,
                                         updated_at = now()
       RETURNING id`,
      [email.toLowerCase(), hash, role],
    );
    return rows[0].id;
  }

  const studentId = await upsertUser('student@darbi.jo', 'student');
  await client.query(
    `INSERT INTO students (user_id, name, level, interests, gpa, location, salary_pref)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (user_id) DO UPDATE SET
       name = EXCLUDED.name, level = EXCLUDED.level, interests = EXCLUDED.interests,
       gpa = EXCLUDED.gpa, location = EXCLUDED.location, salary_pref = EXCLUDED.salary_pref`,
    [studentId, 'Demo Student', 'undergraduate',
     ['Software', 'Data Science', 'Research'], 3.4, 'Amman', '800-1200 JOD'],
  );

  const companyId = await upsertUser('company@darbi.jo', 'company');
  await client.query(
    `INSERT INTO companies (user_id, name, industry, website)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id) DO UPDATE SET
       name = EXCLUDED.name, industry = EXCLUDED.industry, website = EXCLUDED.website`,
    [companyId, 'Demo Tech Co.', 'Software', 'https://example.jo'],
  );

  const careerId = await upsertUser('career@darbi.jo', 'career');
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

async function main() {
  const [majors, universities, universityMajors, courses, jobs, careerPaths, trainingCenters] =
    await Promise.all([
      load('majors.json'),
      load('universities.json'),
      load('university_majors.json'),
      load('courses.json'),
      load('jobs.json'),
      load('career_paths.json'),
      load('training_centers.json'),
    ]);

  await withTransaction(async (client) => {
    const majorIds = await seedMajors(client, majors);
    const universityIds = await seedUniversities(client, universities);
    await seedUniversityMajors(client, universityMajors, universityIds, majorIds);
    await seedCourses(client, courses, majorIds);
    await seedJobs(client, jobs);
    await seedCareer(client, careerPaths, trainingCenters);
    await seedDemoAccounts(client);
  });

  const counts = await pool.query(`
    SELECT 'majors' AS t, count(*) FROM majors
    UNION ALL SELECT 'universities', count(*) FROM universities
    UNION ALL SELECT 'university_majors', count(*) FROM university_majors
    UNION ALL SELECT 'courses', count(*) FROM courses
    UNION ALL SELECT 'jobs', count(*) FROM jobs
    UNION ALL SELECT 'career_paths', count(*) FROM career_paths
    UNION ALL SELECT 'training_centers', count(*) FROM training_centers
    UNION ALL SELECT 'users', count(*) FROM users`);

  console.log('\nseeded:');
  for (const r of counts.rows) console.log(`  ${r.t.padEnd(18)} ${String(r.count).padStart(4)}`);

  const gaps = await pool.query(
    `SELECT count(*) FILTER (WHERE salary_entry_jod IS NULL) AS majors_without_salary,
            (SELECT count(*) FROM universities) AS universities,
            (SELECT count(*) FROM jobs WHERE min_gpa IS NULL) AS jobs_without_gpa
       FROM majors`,
  );
  const g = gaps.rows[0];
  console.log('\nknown data gaps (Week-1 deliverables that did not land):');
  console.log(`  majors with no salary band : ${g.majors_without_salary}`);
  console.log(`  universities on file       : ${g.universities}`);
  console.log(`  jobs with no min GPA       : ${g.jobs_without_gpa}`);

  console.log(`\ndemo logins (password: ${DEMO_PASSWORD}):`);
  console.log('  student@darbi.jo  company@darbi.jo  career@darbi.jo');
}

main()
  .catch((err) => {
    console.error('seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
