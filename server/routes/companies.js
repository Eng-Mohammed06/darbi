import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth, requireRole, asyncRoute } from '../lib/auth.js';

const router = Router();

router.use(requireAuth, requireRole('company'));

const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2MB decoded, same cap as user avatars
const LOGO_DATA_URL = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/]+={0,2})$/;

const APPLICATION_STATUSES = ['screening', 'shortlisted', 'interview', 'hired', 'rejected'];
const JOB_STATUSES = ['draft', 'active', 'closed'];

/**
 * "AI Match" shown on the Overview tab and each applicant row — a
 * deterministic score (major fit + GPA fit + skills/interest overlap), not
 * a live model call. Same "three failure tiers" philosophy as the student
 * side's rule-based recommendation fallback (server/lib/*): a company
 * scanning applicants shouldn't see the number blink out because of an
 * Anthropic billing hiccup, and scoring dozens of applicants per request
 * with a real model call would be slow and expensive for what is, in the
 * end, a rough triage signal.
 */
function computeAiMatch({ required_majors, min_gpa, required_skills, gpa, interests, major_name }) {
  let score = 0;

  const requiredMajors = (required_majors ?? []).map((m) => m.toLowerCase());
  const majorName = (major_name ?? '').toLowerCase();
  const studentInterests = (interests ?? []).map((i) => i.toLowerCase());

  if (requiredMajors.length === 0) {
    score += 50;
  } else if (majorName && requiredMajors.some((rm) => rm.includes(majorName) || majorName.includes(rm))) {
    score += 50;
  } else if (studentInterests.some((i) => requiredMajors.some((rm) => rm.includes(i) || i.includes(rm)))) {
    score += 30;
  }

  if (min_gpa == null) {
    score += 30;
  } else if (gpa != null) {
    const diff = Number(gpa) - Number(min_gpa);
    if (diff >= 0) score += 30;
    else if (diff >= -0.3) score += 15;
  } else {
    score += 10;
  }

  const requiredSkills = (required_skills ?? []).map((s) => s.toLowerCase());
  if (requiredSkills.length === 0) {
    score += 20;
  } else {
    const overlap = requiredSkills.filter((rs) => studentInterests.some((i) => i.includes(rs) || rs.includes(i))).length;
    score += Math.round(20 * Math.min(1, overlap / requiredSkills.length));
  }

  // Never a flat 0 or a suspiciously perfect 100 -- this is a triage signal,
  // not a certified score.
  return Math.max(5, Math.min(99, Math.round(score)));
}

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
 * Same fields FindStudents shows, plus when they applied, their pipeline
 * status, an AI Match score, any note the company has sent them, and the
 * phone/LinkedIn the student has on file — still no email, but phone and
 * LinkedIn are shared as soon as they appear here (any status, not just
 * Interview), so a company can actually reach them and see their academic
 * and work history. Both are only present once the student has filled them
 * in on their own Profile tab.
 */
router.get(
  '/me/jobs/:id/applicants',
  asyncRoute(async (req, res) => {
    const { rows } = await query(
      `SELECT s.user_id, s.name, s.level, s.gpa, s.location, s.interests, s.phone, s.linkedin_url,
              m.name AS major_name,
              a.status, a.created_at AS applied_at, a.company_note,
              j.required_majors, j.min_gpa, j.required_skills
         FROM job_applications a
         JOIN students s ON s.user_id = a.student_user_id
         JOIN jobs j ON j.id = a.job_id
         LEFT JOIN majors m ON m.id = s.major_id
        WHERE a.job_id = $1 AND j.company_id = $2
        ORDER BY a.created_at DESC`,
      [req.params.id, req.user.id],
    );
    res.json(rows.map(({ required_majors, min_gpa, required_skills, ...rest }) => ({
      ...rest,
      ai_match: computeAiMatch({ required_majors, min_gpa, required_skills, gpa: rest.gpa, interests: rest.interests, major_name: rest.major_name }),
    })));
  }),
);

/**
 * PUT /api/companies/me/jobs/:jobId/applicants/:studentUserId  { status, note? }
 * Moves an applicant through the pipeline (screening/shortlisted/interview/
 * hired/rejected) — the dropdown on each applicant row in My Jobs, and what
 * drives the Shortlisted/Interviews/Hired counts on the Overview tab. `note`
 * is optional free text the student sees on their side (e.g. an interview
 * invite with a proposed time); omitting it leaves any existing note as-is,
 * an empty string clears it.
 */
router.put(
  '/me/jobs/:jobId/applicants/:studentUserId',
  asyncRoute(async (req, res) => {
    const { status, note } = req.body ?? {};
    if (!APPLICATION_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'bad_status', allowed: APPLICATION_STATUSES });
    }

    const { rows } = await query(
      `UPDATE job_applications a SET status = $1, company_note = COALESCE($5, a.company_note)
         FROM jobs j
        WHERE a.job_id = j.id AND j.company_id = $2
          AND a.job_id = $3 AND a.student_user_id = $4
        RETURNING a.id, a.status, a.company_note`,
      [status, req.user.id, req.params.jobId, req.params.studentUserId, note ?? null],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  }),
);

/**
 * GET /api/companies/me/overview
 * Powers the Overview tab: five stat tiles (active jobs, total applications,
 * shortlisted, interviews, hired) plus a Recent Applications table. AI Match
 * and status mirror what each applicant row shows in My Jobs.
 */
router.get(
  '/me/overview',
  asyncRoute(async (req, res) => {
    const [{ rows: jobRows }, { rows: appRows }] = await Promise.all([
      query(`SELECT count(*)::int AS active_jobs FROM jobs WHERE company_id = $1 AND status = 'active'`, [req.user.id]),
      query(
        `SELECT a.id, a.status, a.created_at,
                j.title AS position, j.required_majors, j.min_gpa, j.required_skills,
                s.name AS candidate_name, s.gpa, s.interests, m.name AS major_name
           FROM job_applications a
           JOIN jobs j ON j.id = a.job_id
           JOIN students s ON s.user_id = a.student_user_id
           LEFT JOIN majors m ON m.id = s.major_id
          WHERE j.company_id = $1
          ORDER BY a.created_at DESC`,
        [req.user.id],
      ),
    ]);

    const counts = { shortlisted: 0, interview: 0, hired: 0 };
    for (const a of appRows) {
      if (a.status in counts) counts[a.status] += 1;
    }

    res.json({
      activeJobs: jobRows[0].active_jobs,
      totalApplications: appRows.length,
      shortlisted: counts.shortlisted,
      interviews: counts.interview,
      hired: counts.hired,
      recentApplications: appRows.slice(0, 8).map((a) => ({
        id: a.id,
        candidateName: a.candidate_name,
        position: a.position,
        status: a.status,
        aiMatch: computeAiMatch(a),
      })),
    });
  }),
);

/**
 * POST /api/companies/me/jobs — Create a Job's Publish/Save-as-Draft
 * buttons both hit this, differing only in `status` ('active' or 'draft').
 * A draft never shows on the student job board or feeds the advisor/
 * recommendation/pathway surfaces (see server/index.js, server/lib/chat.js,
 * server/lib/careerChat.js, server/routes/{recommend,career,pathways}.js —
 * all filter to status = 'active') until it's published.
 */
router.post(
  '/me/jobs',
  asyncRoute(async (req, res) => {
    const {
      title, requiredMajors, minGpa, salaryRange, requiredSkills, location, description,
      responsibilities, yearsExperience, education, employmentType, status,
    } = req.body ?? {};

    if (!title) return res.status(400).json({ error: 'missing_title' });
    if (minGpa != null && (Number.isNaN(Number(minGpa)) || minGpa < 0 || minGpa > 4)) {
      return res.status(400).json({ error: 'bad_gpa' });
    }
    const jobStatus = status ?? 'active';
    if (!JOB_STATUSES.includes(jobStatus)) {
      return res.status(400).json({ error: 'bad_status', allowed: JOB_STATUSES });
    }

    const { rows: companyRows } = await query(`SELECT name FROM companies WHERE user_id = $1`, [
      req.user.id,
    ]);
    if (!companyRows[0]) return res.status(404).json({ error: 'no_profile' });

    const { rows } = await query(
      `INSERT INTO jobs (company_id, company_name, title, required_majors, min_gpa,
                         salary_raw, required_skills, location, description,
                         responsibilities, years_experience, education, employment_type,
                         status, verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true)
       RETURNING *`,
      [req.user.id, companyRows[0].name, title, requiredMajors ?? [], minGpa ?? null,
       salaryRange ?? null, requiredSkills ?? [], location ?? null, description ?? null,
       responsibilities ?? null, yearsExperience ?? null, education ?? null, employmentType ?? null,
       jobStatus],
    );
    res.status(201).json(rows[0]);
  }),
);

/**
 * PUT /api/companies/me/jobs/:id/status  { status }
 * The Publish (draft→active) / Close (active→closed) / Reopen (closed→
 * active) actions on each posting in My Jobs.
 */
router.put(
  '/me/jobs/:id/status',
  asyncRoute(async (req, res) => {
    const { status } = req.body ?? {};
    if (!JOB_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'bad_status', allowed: JOB_STATUSES });
    }
    const { rows } = await query(
      `UPDATE jobs SET status = $1 WHERE id = $2 AND company_id = $3 RETURNING *`,
      [status, req.params.id, req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
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
