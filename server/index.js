import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { pool } from './lib/db.js';
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import companyRoutes from './routes/companies.js';
import recommendRoutes from './routes/recommend.js';

const here = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

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
              m.salary_entry_jod, m.salary_3yr_jod, m.salary_5yr_jod,
              count(c.id)::int AS course_count
         FROM majors m
         LEFT JOIN courses c ON c.major_id = m.id
        GROUP BY m.id
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
                json_agg(json_build_object('major', m.name, 'relation', um.relation,
                                           'course_count', um.course_count)
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
      `SELECT u.code, u.name, u.website, um.relation, um.course_count, um.evidence
         FROM university_majors um
         JOIN universities u ON u.id = um.university_id
         JOIN majors m ON m.id = um.major_id
        WHERE m.slug = $1
        ORDER BY um.course_count DESC, u.code`,
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
        ORDER BY c.sub_field NULLS LAST, c.name`,
      [req.params.slug],
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

app.listen(PORT, () => {
  console.log(`darbi api listening on :${PORT}`);
});
