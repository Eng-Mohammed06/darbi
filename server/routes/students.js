import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth, requireRole, asyncRoute } from '../lib/auth.js';
import { ONBOARDING_QUESTIONS, analyzeOnboarding, analyzeOnboardingFallback } from '../lib/onboarding.js';

const router = Router();

router.use(requireAuth, requireRole('student'));

/**
 * Student row plus the display names for university_id/major_id — an
 * undergraduate picks these at profile setup (ProfileSetupPage.jsx) so the
 * chat advisor (server/lib/chat.js) and the dashboard can show "Computer
 * Science @ University of Jordan" without a second lookup.
 */
async function loadStudent(userId) {
  const { rows } = await query(
    `SELECT s.*, m.name AS major_name, m.slug AS major_slug,
            u.name AS university_name, u.code AS university_code
       FROM students s
       LEFT JOIN majors m ON m.id = s.major_id
       LEFT JOIN universities u ON u.id = s.university_id
      WHERE s.user_id = $1`,
    [userId],
  );
  return rows[0];
}

/** GET /api/students/me */
router.get(
  '/me',
  asyncRoute(async (req, res) => {
    const student = await loadStudent(req.user.id);
    if (!student) return res.status(404).json({ error: 'no_profile' });
    res.json(student);
  }),
);

/**
 * PUT /api/students/me — update the profiling form.
 * COALESCE means an omitted field keeps its current value.
 *
 * `gpa` and `tawjihiAverage` are mutually exclusive by level, same as
 * signup (server/routes/auth.js) -- a high schooler's average has to land
 * in `tawjihi_average`, not `gpa`, or it trips gpa's CHECK constraint.
 * Level can be changing in this same request, so the effective level is
 * read from the request first and only falls back to the stored row.
 *
 * `gpaScale` ('4' or '100') says which scale `gpa` was entered in -- some
 * Jordanian universities grade out of 100 rather than the standard 4.0
 * scale, so the number alone is ambiguous without it.
 */
router.put(
  '/me',
  asyncRoute(async (req, res) => {
    const {
      name, level, interests, gpa, gpaScale, tawjihiAverage, location, salaryPref,
      universityId, majorId, phone, linkedinUrl,
    } = req.body ?? {};

    const { rows: current } = await query(`SELECT level FROM students WHERE user_id = $1`, [req.user.id]);
    if (!current[0]) return res.status(404).json({ error: 'no_profile' });
    const isHighSchool = (level ?? current[0].level) === 'highschool';
    const maxGpa = gpaScale === '100' ? 100 : 4;

    if (!isHighSchool && gpa != null && (Number.isNaN(Number(gpa)) || gpa < 0 || gpa > maxGpa)) {
      return res.status(400).json({ error: 'bad_gpa', message: `GPA must be between 0 and ${maxGpa}.` });
    }
    if (isHighSchool && tawjihiAverage != null
      && (Number.isNaN(Number(tawjihiAverage)) || tawjihiAverage < 0 || tawjihiAverage > 100)) {
      return res.status(400).json({ error: 'bad_average', message: 'Average must be between 0 and 100.' });
    }

    try {
      await query(
        `UPDATE students SET
           name            = COALESCE($2, name),
           level           = COALESCE($3, level),
           interests       = COALESCE($4, interests),
           gpa             = CASE WHEN $9 THEN gpa ELSE COALESCE($5, gpa) END,
           gpa_scale       = CASE WHEN $9 THEN gpa_scale ELSE COALESCE($10, gpa_scale) END,
           tawjihi_average = CASE WHEN $9 THEN COALESCE($8, tawjihi_average) ELSE tawjihi_average END,
           location        = COALESCE($6, location),
           salary_pref     = COALESCE($7, salary_pref),
           university_id   = COALESCE($11, university_id),
           major_id        = COALESCE($12, major_id),
           phone           = COALESCE($13, phone),
           linkedin_url    = COALESCE($14, linkedin_url)
         WHERE user_id = $1`,
        [req.user.id, name ?? null, level ?? null, interests ?? null, gpa ?? null,
         location ?? null, salaryPref ?? null, tawjihiAverage ?? null, isHighSchool,
         gpaScale ?? null, universityId ?? null, majorId ?? null,
         phone ?? null, linkedinUrl ?? null],
      );
    } catch (err) {
      if (err.code === '23503') return res.status(404).json({ error: 'unknown_university_or_major' });
      throw err;
    }
    res.json(await loadStudent(req.user.id));
  }),
);

/** GET /api/students/me/onboarding-questions — the fixed post-signup question set. */
router.get(
  '/me/onboarding-questions',
  asyncRoute(async (_req, res) => {
    res.json({
      questions: ONBOARDING_QUESTIONS.map(({ id, question, required, options }) => ({
        id, question, required, options,
      })),
    });
  }),
);

/** GET /api/students/me/onboarding — has this student completed it, and with what. */
router.get(
  '/me/onboarding',
  asyncRoute(async (req, res) => {
    const { rows } = await query(
      `SELECT analysis, model, source, created_at FROM onboarding_analysis WHERE student_user_id = $1`,
      [req.user.id],
    );
    const row = rows[0];
    res.json({
      completed: Boolean(row),
      analysis: row?.analysis ?? null,
      model: row?.model ?? null,
      source: row?.source ?? null,
    });
  }),
);

/**
 * POST /api/students/me/onboarding  { answers: [{ id, answer }] }
 * Analyzes the answers with Claude — falling back to storing them unprocessed
 * if the API is unavailable — and saves the result for the chat advisor.
 */
router.post(
  '/me/onboarding',
  asyncRoute(async (req, res) => {
    const submitted = Array.isArray(req.body?.answers) ? req.body.answers : null;
    if (!submitted) return res.status(400).json({ error: 'missing_answers' });

    const byId = new Map(submitted.map((a) => [a?.id, String(a?.answer ?? '').trim()]));
    for (const q of ONBOARDING_QUESTIONS) {
      if (q.required && !byId.get(q.id)) {
        return res.status(400).json({ error: 'missing_answer', questionId: q.id });
      }
    }

    const answers = ONBOARDING_QUESTIONS.map((q) => ({
      id: q.id,
      question: q.question,
      answer: byId.get(q.id) ?? '',
    }));

    const { rows: studentRows } = await query(`SELECT name FROM students WHERE user_id = $1`, [req.user.id]);
    const student = studentRows[0];
    if (!student) return res.status(404).json({ error: 'no_profile' });

    let result;
    try {
      result = await analyzeOnboarding({ name: student.name, answers });
    } catch (err) {
      console.warn('[onboarding] analysis failed, using fallback:', err.message);
      result = analyzeOnboardingFallback(answers);
    }

    await query(
      `INSERT INTO onboarding_analysis (student_user_id, answers, analysis, model, source)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (student_user_id) DO UPDATE SET
         answers    = EXCLUDED.answers,
         analysis   = EXCLUDED.analysis,
         model      = EXCLUDED.model,
         source     = EXCLUDED.source,
         updated_at = now()`,
      // `answers` is a JS array — pg serializes arrays as Postgres array
      // literals, not JSON, so it needs an explicit stringify for the jsonb
      // column. `result.data` is a plain object, which pg does stringify
      // automatically.
      [req.user.id, JSON.stringify(answers), result.data, result.model, result.source],
    );

    res.json({ analysis: result.data, model: result.model, source: result.source });
  }),
);

/** GET /api/students/me/saved-majors */
router.get(
  '/me/saved-majors',
  asyncRoute(async (req, res) => {
    const { rows } = await query(
      `SELECT m.* FROM saved_majors s
         JOIN majors m ON m.id = s.major_id
        WHERE s.student_user_id = $1
        ORDER BY s.saved_at DESC`,
      [req.user.id],
    );
    res.json(rows);
  }),
);

/** POST /api/students/me/saved-majors  { majorId } */
router.post(
  '/me/saved-majors',
  asyncRoute(async (req, res) => {
    const { majorId } = req.body ?? {};
    if (!majorId) return res.status(400).json({ error: 'missing_major_id' });
    try {
      await query(
        `INSERT INTO saved_majors (student_user_id, major_id) VALUES ($1,$2)
         ON CONFLICT DO NOTHING`,
        [req.user.id, majorId],
      );
    } catch (err) {
      if (err.code === '23503') return res.status(404).json({ error: 'unknown_major' });
      throw err;
    }
    res.status(201).json({ ok: true });
  }),
);

/** DELETE /api/students/me/saved-majors/:majorId */
router.delete(
  '/me/saved-majors/:majorId',
  asyncRoute(async (req, res) => {
    await query(`DELETE FROM saved_majors WHERE student_user_id = $1 AND major_id = $2`, [
      req.user.id,
      req.params.majorId,
    ]);
    res.status(204).end();
  }),
);

/** GET /api/students/me/applications — job ids this student has applied to. */
router.get(
  '/me/applications',
  asyncRoute(async (req, res) => {
    const { rows } = await query(
      `SELECT job_id FROM job_applications WHERE student_user_id = $1`,
      [req.user.id],
    );
    res.json(rows.map((r) => r.job_id));
  }),
);

/**
 * GET /api/students/me/applications/status
 * The same applications as above, but with the job title, company, pipeline
 * status, and any note the company attached (an interview invite being the
 * main use) — what the Jobs tab's "My Applications" list renders. A separate
 * endpoint from GET /me/applications so that lightweight "did I already
 * apply" check on job cards doesn't pull the extra joins on every load.
 */
router.get(
  '/me/applications/status',
  asyncRoute(async (req, res) => {
    const { rows } = await query(
      `SELECT j.id AS job_id, j.title, j.company_name, j.location,
              a.status, a.company_note, a.created_at AS applied_at
         FROM job_applications a
         JOIN jobs j ON j.id = a.job_id
        WHERE a.student_user_id = $1
        ORDER BY a.created_at DESC`,
      [req.user.id],
    );
    res.json(rows);
  }),
);

/**
 * POST /api/students/me/applications  { jobId }
 * Refused for jobs with no company_id — those are seeded listings gathered
 * from public sources with no DARBI account behind them, so there is no one
 * for the application to reach.
 */
router.post(
  '/me/applications',
  asyncRoute(async (req, res) => {
    const { jobId } = req.body ?? {};
    if (!jobId) return res.status(400).json({ error: 'missing_job_id' });

    const { rows: jobRows } = await query(`SELECT id, company_id, status FROM jobs WHERE id = $1`, [jobId]);
    const job = jobRows[0];
    if (!job) return res.status(404).json({ error: 'unknown_job' });
    if (!job.company_id) return res.status(409).json({ error: 'no_company_account' });
    if (job.status !== 'active') return res.status(409).json({ error: 'job_not_active' });

    await query(
      `INSERT INTO job_applications (job_id, student_user_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [jobId, req.user.id],
    );
    res.status(201).json({ ok: true });
  }),
);

const COURSE_STATUSES = ['completed', 'in_progress', 'planned'];

/**
 * GET /api/students/me/course-progress — { courseId: status } for every
 * course this student has a tracked status for, across all majors. The
 * Majors tab checklist merges this into the course list it already fetched
 * publicly; the chat advisor's auto-check (server/lib/chat.js) writes to the
 * same table, so either source shows up here.
 */
router.get(
  '/me/course-progress',
  asyncRoute(async (req, res) => {
    const { rows } = await query(
      `SELECT course_id, status FROM course_progress WHERE student_user_id = $1`,
      [req.user.id],
    );
    res.json(Object.fromEntries(rows.map((r) => [r.course_id, r.status])));
  }),
);

/** PUT /api/students/me/course-progress/:courseId  { status } */
router.put(
  '/me/course-progress/:courseId',
  asyncRoute(async (req, res) => {
    const courseId = Number(req.params.courseId);
    const { status } = req.body ?? {};
    if (!COURSE_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'bad_status', allowed: COURSE_STATUSES });
    }

    try {
      await query(
        `INSERT INTO course_progress (student_user_id, course_id, status)
         VALUES ($1,$2,$3)
         ON CONFLICT (student_user_id, course_id)
         DO UPDATE SET status = EXCLUDED.status, updated_at = now()`,
        [req.user.id, courseId, status],
      );
    } catch (err) {
      if (err.code === '23503') return res.status(404).json({ error: 'unknown_course' });
      throw err;
    }
    res.json({ ok: true });
  }),
);

/** DELETE /api/students/me/course-progress/:courseId — back to "not tracked". */
router.delete(
  '/me/course-progress/:courseId',
  asyncRoute(async (req, res) => {
    await query(
      `DELETE FROM course_progress WHERE student_user_id = $1 AND course_id = $2`,
      [req.user.id, Number(req.params.courseId)],
    );
    res.status(204).end();
  }),
);

export default router;
