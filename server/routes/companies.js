import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth, requireRole, asyncRoute } from '../lib/auth.js';

const router = Router();

router.use(requireAuth, requireRole('company'));

const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2MB decoded, same cap as user avatars
const LOGO_DATA_URL = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/]+={0,2})$/;

/**
 * PUT /api/companies/me  { name?, industry?, description?, website?, location?, logo? }
 * Partial update — only the fields present in the body change. `name` alone
 * is how AccountPage's rename works; industry/description/website/location/
 * logo together are how CompanyProfileSetupPage completes the mandatory
 * post-verification profile (the "all fields required" rule is enforced by
 * that page before it ever calls this — see src/App.jsx's Dashboard guard
 * for what happens if a company reaches the dashboard without finishing it).
 */
router.put(
  '/me',
  asyncRoute(async (req, res) => {
    const { name, industry, description, website, location, logo } = req.body ?? {};
    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ error: 'missing_name' });
    }
    if (logo) {
      const match = LOGO_DATA_URL.exec(logo);
      if (!match) return res.status(400).json({ error: 'bad_image', message: 'Upload a .png or .jpg image.' });
      const bytes = Buffer.from(match[2], 'base64').length;
      if (bytes > LOGO_MAX_BYTES) {
        return res.status(400).json({ error: 'image_too_large', message: 'Image must be 2MB or smaller.' });
      }
    }

    const fields = { name, industry, description, website, location, logo };
    const sets = [];
    const values = [req.user.id];
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      values.push(typeof value === 'string' ? value.trim() : value);
      sets.push(`${key} = $${values.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'missing_fields' });

    const { rows } = await query(
      `UPDATE companies SET ${sets.join(', ')} WHERE user_id = $1 RETURNING *`,
      values,
    );
    if (!rows[0]) return res.status(404).json({ error: 'no_profile' });
    res.json(rows[0]);
  }),
);

/** GET /api/companies/me/jobs — this company's own postings. */
router.get(
  '/me/jobs',
  asyncRoute(async (req, res) => {
    const { rows } = await query(
      `SELECT j.*, (SELECT count(*)::int FROM job_applications a WHERE a.job_id = j.id) AS applicant_count
         FROM jobs j
        WHERE j.company_id = $1
        ORDER BY j.posted_at DESC`,
      [req.user.id],
    );
    res.json(rows);
  }),
);

/**
 * GET /api/companies/me/jobs/:id/applicants
 * Same fields FindStudents shows, plus when they applied — no email, same
 * "contact through the platform" rule as browsing the student pool.
 */
router.get(
  '/me/jobs/:id/applicants',
  asyncRoute(async (req, res) => {
    const { rows } = await query(
      `SELECT s.user_id, s.name, s.level, s.gpa, s.location, s.interests, a.created_at AS applied_at
         FROM job_applications a
         JOIN students s ON s.user_id = a.student_user_id
         JOIN jobs j ON j.id = a.job_id
        WHERE a.job_id = $1 AND j.company_id = $2
        ORDER BY a.created_at DESC`,
      [req.params.id, req.user.id],
    );
    res.json(rows);
  }),
);

/** POST /api/companies/me/jobs — post a job. */
router.post(
  '/me/jobs',
  asyncRoute(async (req, res) => {
    const { title, requiredMajors, minGpa, salaryRange, requiredSkills, location, description } =
      req.body ?? {};

    if (!title) return res.status(400).json({ error: 'missing_title' });
    if (minGpa != null && (Number.isNaN(Number(minGpa)) || minGpa < 0 || minGpa > 4)) {
      return res.status(400).json({ error: 'bad_gpa' });
    }

    const { rows: companyRows } = await query(`SELECT name FROM companies WHERE user_id = $1`, [
      req.user.id,
    ]);
    if (!companyRows[0]) return res.status(404).json({ error: 'no_profile' });

    const { rows } = await query(
      `INSERT INTO jobs (company_id, company_name, title, required_majors, min_gpa,
                         salary_raw, required_skills, location, description, verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
       RETURNING *`,
      [req.user.id, companyRows[0].name, title, requiredMajors ?? [], minGpa ?? null,
       salaryRange ?? null, requiredSkills ?? [], location ?? null, description ?? null],
    );
    res.status(201).json(rows[0]);
  }),
);

/** DELETE /api/companies/me/jobs/:id — own postings only. */
router.delete(
  '/me/jobs/:id',
  asyncRoute(async (req, res) => {
    const { rowCount } = await query(`DELETE FROM jobs WHERE id = $1 AND company_id = $2`, [
      req.params.id,
      req.user.id,
    ]);
    if (!rowCount) return res.status(404).json({ error: 'not_found' });
    res.status(204).end();
  }),
);

/**
 * GET /api/companies/students?major=&minGpa=&skill=
 * Filter the student pool. Returns no email address — companies see a profile
 * and contact through the platform, so the student list can't be scraped for
 * addresses.
 */
router.get(
  '/students',
  asyncRoute(async (req, res) => {
    const { major, minGpa, skill } = req.query;

    const { rows } = await query(
      `SELECT s.user_id, s.name, s.level, s.interests, s.gpa, s.location
         FROM students s
        WHERE ($1::numeric IS NULL OR s.gpa >= $1)
          AND ($2::text IS NULL OR EXISTS (
                 SELECT 1 FROM unnest(s.interests) i WHERE i ILIKE '%' || $2 || '%'))
          AND ($3::text IS NULL OR EXISTS (
                 SELECT 1 FROM unnest(s.interests) i WHERE i ILIKE '%' || $3 || '%'))
        ORDER BY s.gpa DESC NULLS LAST, s.name`,
      [minGpa ?? null, major ?? null, skill ?? null],
    );
    res.json(rows);
  }),
);

export default router;
