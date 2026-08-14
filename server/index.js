import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { pool } from './lib/db.js';
import { hashPassword } from './lib/auth.js';
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import companyRoutes from './routes/companies.js';
import recommendRoutes from './routes/recommend.js';
import chatRoutes from './routes/chat.js';
import pathwayRoutes from './routes/pathways.js';
import careerRoutes from './routes/career.js';
import adminRoutes from './routes/admin.js';

const here = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// 1mb comfortably covers every route except the avatar upload, whose base64
// image payload (server/routes/auth.js) needs more headroom.
app.use(express.json({ limit: '3mb' }));

// Railway pings this to decide whether a deploy is healthy.
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'up' });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'down', error: err.message });
  }
});

// Reference data — public, no auth. Enough to prove the DB is wired end to end.
app.get('/api/majors', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.id, m.slug, m.name, m.faculty, m.data_quality,
              m.salary_entry_min_jod, m.salary_entry_max_jod,
              m.salary_5yr_min_jod, m.salary_5yr_max_jod,
              m.salary_confidence, m.top_jobs,
              (SELECT count(*)::int FROM courses c WHERE c.major_id = m.id) AS course_count,
              (SELECT coalesce(array_agg(DISTINCT u.code), '{}')
                 FROM university_majors um JOIN universities u ON u.id = um.university_id
                WHERE um.major_id = m.id) AS universities
         FROM majors m
        ORDER BY m.name`,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.get('/api/universities', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.*,
              coalesce(
                json_agg(json_build_object('major', m.name, 'program', um.program_name,
                                           'competitive_average', um.competitive_average)
                         ORDER BY m.name) FILTER (WHERE m.id IS NOT NULL), '[]') AS majors
         FROM universities u
         LEFT JOIN university_majors um ON um.university_id = u.id
         LEFT JOIN majors m ON m.id = um.major_id
        GROUP BY u.id
        ORDER BY u.code`,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/** Institutions teaching this major, with the evidence behind each link. */
app.get('/api/majors/:slug/universities', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id AS university_id, u.code, u.name, u.website, um.relation, um.evidence,
              um.competitive_average, um.minimum_average,
              um.program_name, um.entry_year, m.id AS major_id
         FROM university_majors um
         JOIN universities u ON u.id = um.university_id
         JOIN majors m ON m.id = um.major_id
        WHERE m.slug = $1
        ORDER BY um.competitive_average DESC NULLS LAST, u.code`,
      [req.params.slug],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.get('/api/majors/:slug/courses', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.* FROM courses c
         JOIN majors m ON m.id = c.major_id
        WHERE m.slug = $1
        ORDER BY c.track NULLS LAST, c.name`,
      [req.params.slug],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/** Every course, across every major — backs the Courses tab's flat checklist. */
app.get('/api/courses', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, major_id, major_name, track, name, provider, cost_raw, what_you_learn
         FROM courses ORDER BY major_name NULLS LAST, name`,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.get('/api/jobs', async (req, res, next) => {
  try {
    const { major, minGpa } = req.query;
    const { rows } = await pool.query(
      `SELECT * FROM jobs
        WHERE ($1::text IS NULL OR EXISTS (
                 SELECT 1 FROM unnest(required_majors) rm
                  WHERE rm ILIKE '%' || $1 || '%'))
          AND ($2::numeric IS NULL OR min_gpa IS NULL OR min_gpa <= $2)
        ORDER BY verified DESC, company_name, title`,
      [major ?? null, minGpa ?? null],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Career reference data — public, seeded from career_courses_ENGLISH.xlsx.
app.get('/api/career/paths', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM career_paths ORDER BY track, title`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.get('/api/career/centres', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM training_centers ORDER BY field, name`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/recommend', recommendRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/pathways', pathwayRoutes);
app.use('/api/career', careerRoutes);
app.use('/api/admin', adminRoutes);

// Serve the built React app. Any non-/api path falls through to index.html so
// client-side routing works on refresh and deep links.
const dist = join(here, '..', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
} else {
  app.get('/', (_req, res) =>
    res
      .status(200)
      .type('text/plain')
      .send('API is up. Run `npm run dev` for the Vite dev server, or `npm run build` first.'),
  );
}

app.use((err, _req, res, _next) => {
  console.error('[api]', err);
  res.status(500).json({ error: 'internal_error' });
});

/**
 * The one admin account (the sole intended use — see server/routes/admin.js)
 * is provisioned here rather than through POST /api/auth/signup, which
 * still only ever accepts student/company/career. Runs on every boot, so
 * setting ADMIN_EMAIL/ADMIN_PASSWORD on Railway is the entire setup step —
 * no separate one-off script to run against production. Never touches the
 * password on an existing account, so changing it later (e.g. from the
 * Account page) sticks.
 */
async function ensureAdminAccount() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  try {
    const { rows } = await pool.query(`SELECT id FROM users WHERE lower(email) = $1`, [email]);
    if (rows[0]) return;

    const passwordHash = await hashPassword(password);
    await pool.query(
      `INSERT INTO users (email, username, password_hash, role) VALUES ($1,'admin',$2,'admin')`,
      [email, passwordHash],
    );
    console.log(`[admin] provisioned admin account for ${email}`);
  } catch (err) {
    console.error('[admin] failed to provision admin account:', err.message);
  }
}

ensureAdminAccount().finally(() => {
  app.listen(PORT, () => {
    console.log(`darbi api listening on :${PORT}`);
  });
});
