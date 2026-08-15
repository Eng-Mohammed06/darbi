import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth, requireAdmin, asyncRoute } from '../lib/auth.js';

const router = Router();

// Every admin — the pure-admin account and any student/company/career
// account granted is_admin — gets full read/write over accounts, job
// listings, and the reference catalog (majors/courses/university entry
// averages). Reference-data editing here is a deliberate, later addition:
// see CLAUDE.md's hard rule #5 for why that catalog is normally regenerated
// from spreadsheets instead, and why this panel is the exception.
router.use(requireAuth, requireAdmin);

/** GET /api/admin/stats — counts across the whole platform. */
router.get(
  '/stats',
  asyncRoute(async (_req, res) => {
    const [users, jobs, companies, applications, chats, saved] = await Promise.all([
      query(`SELECT role, count(*)::int AS n FROM users GROUP BY role`),
      query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE verified)::int AS verified,
                count(*) FILTER (WHERE company_id IS NOT NULL)::int AS from_companies
           FROM jobs`,
      ),
      query(`SELECT count(*)::int AS n FROM companies`),
      query(`SELECT count(*)::int AS n FROM job_applications`),
      query(`SELECT count(*)::int AS n FROM chat_messages`),
      query(`SELECT count(*)::int AS n FROM saved_majors`),
    ]);

    res.json({
      users_by_role: Object.fromEntries(users.rows.map((r) => [r.role, r.n])),
      jobs: jobs.rows[0],
      companies: companies.rows[0].n,
      applications: applications.rows[0].n,
      chat_messages: chats.rows[0].n,
      saved_majors: saved.rows[0].n,
    });
  }),
);

/** GET /api/admin/users — every account, across every role. */
router.get(
  '/users',
  asyncRoute(async (_req, res) => {
    const { rows } = await query(
      `SELECT u.id, u.email, u.username, u.role, u.is_admin, u.email_verified, u.created_at,
              u.last_login_at, COALESCE(s.name, c.name, cp.name) AS name
         FROM users u
         LEFT JOIN students s ON s.user_id = u.id
         LEFT JOIN companies c ON c.user_id = u.id
         LEFT JOIN career_profiles cp ON cp.user_id = u.id
        ORDER BY u.created_at DESC`,
    );
    res.json(rows);
  }),
);

/**
 * GET /api/admin/users/:id — the detail panel behind clicking a user row.
 * Student-only fields (recommendation count, saved pathways, most-recommended
 * major) are null for company/career/admin accounts, which have no such
 * concept. Career accounts instead get everything the Graduate Portal lets
 * them build: their full profile, the latest generated career path, the
 * latest job match results, every tracked application, and their AI
 * Assistant activity.
 */
router.get(
  '/users/:id',
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    const { rows } = await query(
      `SELECT u.id, u.email, u.username, u.role, u.is_admin, u.email_verified, u.avatar,
              u.created_at, u.last_login_at,
              COALESCE(s.name, c.name, cp.name) AS name
         FROM users u
         LEFT JOIN students s ON s.user_id = u.id
         LEFT JOIN companies c ON c.user_id = u.id
         LEFT JOIN career_profiles cp ON cp.user_id = u.id
        WHERE u.id = $1`,
      [id],
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'not_found' });

    if (user.role === 'career') {
      const [profileRes, ladderRes, matchesRes, appsRes, chatRes, savedPathsRes, savedCentresRes] = await Promise.all([
        query(`SELECT * FROM career_profiles WHERE user_id = $1`, [id]),
        query(
          `SELECT payload, model, created_at FROM career_ladders
            WHERE career_user_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [id],
        ),
        query(
          `SELECT payload, model, created_at FROM job_matches
            WHERE career_user_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [id],
        ),
        query(`SELECT * FROM career_applications WHERE career_user_id = $1 ORDER BY applied_at DESC`, [id]),
        query(
          `SELECT count(*)::int AS n, max(created_at) AS last_at FROM career_chat_messages WHERE career_user_id = $1`,
          [id],
        ),
        query(
          `SELECT cp.name, cp.major_name FROM career_saved_paths sp
             JOIN career_paths cp ON cp.id = sp.career_path_id
            WHERE sp.career_user_id = $1 ORDER BY sp.created_at DESC`,
          [id],
        ),
        query(
          `SELECT tc.name, tc.field FROM career_saved_centres sc
             JOIN training_centers tc ON tc.id = sc.training_centre_id
            WHERE sc.career_user_id = $1 ORDER BY sc.created_at DESC`,
          [id],
        ),
      ]);

      return res.json({
        ...user,
        recommend_count: null,
        saved_pathways_count: null,
        top_recommended_major: null,
        career_profile: profileRes.rows[0] ?? null,
        career_ladder: ladderRes.rows[0] ?? null,
        job_matches: matchesRes.rows[0]?.payload?.matches ?? [],
        applications: appsRes.rows,
        chat_message_count: chatRes.rows[0].n,
        chat_last_at: chatRes.rows[0].last_at,
        saved_paths: savedPathsRes.rows,
        saved_centres: savedCentresRes.rows,
      });
    }

    if (user.role !== 'student') {
      return res.json({ ...user, recommend_count: null, saved_pathways_count: null, top_recommended_major: null });
    }

    const [recCount, savedCount, topMajor] = await Promise.all([
      query(`SELECT count(*)::int AS n FROM recommendations WHERE student_user_id = $1`, [id]),
      query(`SELECT count(*)::int AS n FROM saved_majors WHERE student_user_id = $1`, [id]),
      query(
        `SELECT payload->'recommendations'->0->>'major' AS major, count(*)::int AS n
           FROM recommendations
          WHERE student_user_id = $1 AND payload->'recommendations'->0->>'major' IS NOT NULL
          GROUP BY major
          ORDER BY n DESC
          LIMIT 1`,
        [id],
      ),
    ]);

    res.json({
      ...user,
      recommend_count: recCount.rows[0].n,
      saved_pathways_count: savedCount.rows[0].n,
      top_recommended_major: topMajor.rows[0] ? { name: topMajor.rows[0].major, count: topMajor.rows[0].n } : null,
    });
  }),
);

/**
 * PATCH /api/admin/users/:id/admin-access — { isAdmin: boolean }. Grants or
 * revokes dual-role admin access on an existing student/company/career
 * account (src/pages/AuthPage.jsx then offers that account a portal choice
 * at login). Refuses to revoke the caller's own access so a mistaken click
 * can't lock them out; the pure role='admin' account can't be toggled here
 * at all (it doesn't need is_admin — it already has full access).
 */
router.patch(
  '/users/:id/admin-access',
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    const { isAdmin } = req.body ?? {};
    if (typeof isAdmin !== 'boolean') return res.status(400).json({ error: 'missing_fields', need: ['isAdmin'] });
    if (id === req.user.id && !isAdmin) return res.status(400).json({ error: 'cannot_revoke_self' });

    const { rows } = await query(
      `UPDATE users SET is_admin = $1, updated_at = now() WHERE id = $2 AND role != 'admin'
       RETURNING id, email, username, role, is_admin`,
      [isAdmin, id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  }),
);

/**
 * DELETE /api/admin/users/:id — cascades to that account's own profile,
 * jobs (if a company), applications, chat history, everything (see the
 * ON DELETE CASCADE chain in db/schema.sql). Refuses to delete the admin's
 * own account so a mistaken click can't lock them out.
 */
router.delete(
  '/users/:id',
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) return res.status(400).json({ error: 'cannot_delete_self' });
    const { rowCount } = await query(`DELETE FROM users WHERE id = $1`, [id]);
    if (!rowCount) return res.status(404).json({ error: 'not_found' });
    res.status(204).end();
  }),
);

/** GET /api/admin/companies — every company account, with its posting count. */
router.get(
  '/companies',
  asyncRoute(async (_req, res) => {
    const { rows } = await query(
      `SELECT c.user_id, c.name, c.industry, c.website, u.email, u.created_at,
              (SELECT count(*)::int FROM jobs j WHERE j.company_id = c.user_id) AS job_count
         FROM companies c
         JOIN users u ON u.id = c.user_id
        ORDER BY u.created_at DESC`,
    );
    res.json(rows);
  }),
);

/** GET /api/admin/jobs — every listing on the board, company-posted or seeded. */
router.get(
  '/jobs',
  asyncRoute(async (_req, res) => {
    const { rows } = await query(`SELECT * FROM jobs ORDER BY posted_at DESC`);
    res.json(rows);
  }),
);

/** POST /api/admin/jobs — post a listing directly (company_id stays null, like the seeded ones). */
router.post(
  '/jobs',
  asyncRoute(async (req, res) => {
    const { title, companyName, requiredMajors, minGpa, salaryRange, requiredSkills, location, description } =
      req.body ?? {};

    if (!title) return res.status(400).json({ error: 'missing_title' });
    if (!companyName) return res.status(400).json({ error: 'missing_company_name' });
    if (minGpa != null && (Number.isNaN(Number(minGpa)) || minGpa < 0 || minGpa > 4)) {
      return res.status(400).json({ error: 'bad_gpa' });
    }

    const { rows } = await query(
      `INSERT INTO jobs (company_name, title, required_majors, min_gpa,
                         salary_raw, required_skills, location, description, verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
       RETURNING *`,
      [companyName, title, requiredMajors ?? [], minGpa ?? null,
       salaryRange ?? null, requiredSkills ?? [], location ?? null, description ?? null],
    );
    res.status(201).json(rows[0]);
  }),
);

// Full edit surface for a listing — approving (`verified`) is just one of
// these fields, not a separate action.
const JOB_FIELDS = [
  'title', 'company_name', 'location', 'description', 'salary_raw', 'verified',
  'required_majors', 'min_gpa', 'required_skills',
];

/** PUT /api/admin/jobs/:id — edit any listing (verify it, fix a typo, etc). */
router.put(
  '/jobs/:id',
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    const values = [id];
    const sets = [];
    for (const field of JOB_FIELDS) {
      if (req.body?.[field] !== undefined) {
        values.push(req.body[field]);
        sets.push(`${field} = $${values.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'no_fields' });

    const { rows } = await query(
      `UPDATE jobs SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      values,
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  }),
);

/** DELETE /api/admin/jobs/:id — any listing, not just company-posted ones. */
router.delete(
  '/jobs/:id',
  asyncRoute(async (req, res) => {
    const { rowCount } = await query(`DELETE FROM jobs WHERE id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'not_found' });
    res.status(204).end();
  }),
);

// ------------------------------------------------------ reference catalog --
// Majors, courses, and university entry averages. See the router-level
// comment above and CLAUDE.md hard rule #5 — this is a deliberate exception
// to "reference data is regenerated, not hand-edited", added because the
// admin needs to add/fix entries with no spreadsheet to regenerate from.

const slugify = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const MAJOR_FIELDS = [
  'name', 'faculty', 'duration_years', 'entry_requirements', 'top_jobs',
  'salary_entry_min_jod', 'salary_entry_max_jod', 'salary_entry_raw',
  'salary_3yr_min_jod', 'salary_3yr_max_jod', 'salary_3yr_raw',
  'salary_5yr_min_jod', 'salary_5yr_max_jod', 'salary_5yr_raw',
  'salary_source', 'salary_confidence', 'data_quality',
];

/** POST /api/admin/majors — { name, ...any MAJOR_FIELDS }. slug is derived from name. */
router.post(
  '/majors',
  asyncRoute(async (req, res) => {
    const { name } = req.body ?? {};
    if (!name) return res.status(400).json({ error: 'missing_name' });
    const slug = slugify(name);

    try {
      const { rows } = await query(
        `INSERT INTO majors (slug, name, data_quality) VALUES ($1, $2, 'pending') RETURNING *`,
        [slug, name],
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'slug_taken', slug });
      throw err;
    }
  }),
);

/** PUT /api/admin/majors/:id — patch any of MAJOR_FIELDS present in the body. */
router.put(
  '/majors/:id',
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    const values = [id];
    const sets = [];
    for (const field of MAJOR_FIELDS) {
      if (req.body?.[field] !== undefined) {
        values.push(req.body[field]);
        sets.push(`${field} = $${values.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'no_fields' });

    const { rows } = await query(`UPDATE majors SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, values);
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  }),
);

/** DELETE /api/admin/majors/:id — cascades to its courses, career paths, university links, saved pathways. */
router.delete(
  '/majors/:id',
  asyncRoute(async (req, res) => {
    const { rowCount } = await query(`DELETE FROM majors WHERE id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'not_found' });
    res.status(204).end();
  }),
);

const COURSE_FIELDS = [
  'major_id', 'track', 'name', 'what_you_learn', 'provider', 'accreditation',
  'online_alternative', 'duration', 'cost_raw', 'cost_min_jod', 'cost_max_jod',
  'cost_online_usd', 'notes',
];

/** POST /api/admin/courses — { name, major_id, ...any other COURSE_FIELDS }. */
router.post(
  '/courses',
  asyncRoute(async (req, res) => {
    const { name, major_id } = req.body ?? {};
    if (!name) return res.status(400).json({ error: 'missing_name' });

    const majorName = major_id
      ? (await query(`SELECT name FROM majors WHERE id = $1`, [major_id])).rows[0]?.name ?? null
      : null;

    const { rows } = await query(
      `INSERT INTO courses (name, major_id, major_name, source_sheet) VALUES ($1, $2, $3, 'Admin panel') RETURNING *`,
      [name, major_id ?? null, majorName],
    );
    res.status(201).json(rows[0]);
  }),
);

/** PUT /api/admin/courses/:id — patch any of COURSE_FIELDS present in the body. */
router.put(
  '/courses/:id',
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    const values = [id];
    const sets = [];
    for (const field of COURSE_FIELDS) {
      if (req.body?.[field] !== undefined) {
        values.push(req.body[field]);
        sets.push(`${field} = $${values.length}`);
      }
    }
    // Keep the denormalised major_name in sync when major_id changes.
    if (req.body?.major_id !== undefined) {
      const majorName = req.body.major_id
        ? (await query(`SELECT name FROM majors WHERE id = $1`, [req.body.major_id])).rows[0]?.name ?? null
        : null;
      values.push(majorName);
      sets.push(`major_name = $${values.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'no_fields' });

    const { rows } = await query(`UPDATE courses SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, values);
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  }),
);

/** DELETE /api/admin/courses/:id */
router.delete(
  '/courses/:id',
  asyncRoute(async (req, res) => {
    const { rowCount } = await query(`DELETE FROM courses WHERE id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'not_found' });
    res.status(204).end();
  }),
);

/**
 * PUT /api/admin/university-majors — upsert the entry-average row for one
 * university+major(+program) triple. Addressed by body, not URL params,
 * since the natural key includes a free-text program name that can contain
 * characters awkward to put in a path.
 * Body: { universityId, majorId, programName, competitiveAverage, minimumAverage, entryYear }
 */
router.put(
  '/university-majors',
  asyncRoute(async (req, res) => {
    const { universityId, majorId, programName, competitiveAverage, minimumAverage, entryYear } = req.body ?? {};
    if (!universityId || !majorId) return res.status(400).json({ error: 'missing_fields', need: ['universityId', 'majorId'] });

    const { rows } = await query(
      `INSERT INTO university_majors (university_id, major_id, program_name, competitive_average, minimum_average, entry_year)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (university_id, major_id, program_name) DO UPDATE
         SET competitive_average = EXCLUDED.competitive_average,
             minimum_average = EXCLUDED.minimum_average,
             entry_year = EXCLUDED.entry_year
       RETURNING *`,
      [universityId, majorId, programName ?? null, competitiveAverage ?? null, minimumAverage ?? null, entryYear ?? null],
    );
    res.json(rows[0]);
  }),
);

/** DELETE /api/admin/university-majors — body: { universityId, majorId, programName }. */
router.delete(
  '/university-majors',
  asyncRoute(async (req, res) => {
    const { universityId, majorId, programName } = req.body ?? {};
    if (!universityId || !majorId) return res.status(400).json({ error: 'missing_fields', need: ['universityId', 'majorId'] });

    const { rowCount } = await query(
      `DELETE FROM university_majors WHERE university_id = $1 AND major_id = $2 AND program_name IS NOT DISTINCT FROM $3`,
      [universityId, majorId, programName ?? null],
    );
    if (!rowCount) return res.status(404).json({ error: 'not_found' });
    res.status(204).end();
  }),
);

export default router;
