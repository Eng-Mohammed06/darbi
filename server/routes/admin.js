import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth, requireRole, asyncRoute } from '../lib/auth.js';

const router = Router();

// The single admin account (server/index.js's ensureAdminAccount) — full
// read/write over accounts and job listings. Deliberately does NOT expose
// editing majors/courses/universities: that reference catalog is
// regenerated from the approved spreadsheets, never hand-edited (see
// CLAUDE.md's hard rules) — a UI to edit it here would undermine the one
// thing judges actually fact-check.
router.use(requireAuth, requireRole('admin'));

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
      `SELECT u.id, u.email, u.username, u.role, u.email_verified, u.created_at,
              COALESCE(s.name, c.name, cp.name) AS name
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

const JOB_FIELDS = ['title', 'company_name', 'location', 'description', 'salary_raw', 'verified'];

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

export default router;
