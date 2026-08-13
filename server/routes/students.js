import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth, requireRole, asyncRoute } from '../lib/auth.js';
import { ONBOARDING_QUESTIONS, analyzeOnboarding, analyzeOnboardingFallback } from '../lib/onboarding.js';

const router = Router();

router.use(requireAuth, requireRole('student'));

/** GET /api/students/me */
router.get(
  '/me',
  asyncRoute(async (req, res) => {
    const { rows } = await query(`SELECT * FROM students WHERE user_id = $1`, [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'no_profile' });
    res.json(rows[0]);
  }),
);

/**
 * PUT /api/students/me — update the profiling form.
 * COALESCE means an omitted field keeps its current value.
 */
router.put(
  '/me',
  asyncRoute(async (req, res) => {
    const { name, level, interests, gpa, location, salaryPref } = req.body ?? {};

    if (gpa != null && (Number.isNaN(Number(gpa)) || gpa < 0 || gpa > 4)) {
      return res.status(400).json({ error: 'bad_gpa', message: 'GPA must be between 0 and 4.' });
    }

    const { rows } = await query(
      `UPDATE students SET
         name        = COALESCE($2, name),
         level       = COALESCE($3, level),
         interests   = COALESCE($4, interests),
         gpa         = COALESCE($5, gpa),
         location    = COALESCE($6, location),
         salary_pref = COALESCE($7, salary_pref)
       WHERE user_id = $1
       RETURNING *`,
      [req.user.id, name ?? null, level ?? null, interests ?? null, gpa ?? null,
       location ?? null, salaryPref ?? null],
    );
    if (!rows[0]) return res.status(404).json({ error: 'no_profile' });
    res.json(rows[0]);
  }),
);

/** GET /api/students/me/onboarding-questions — the fixed post-signup question set. */
router.get(
  '/me/onboarding-questions',
  asyncRoute(async (_req, res) => {
    res.json({
      questions: ONBOARDING_QUESTIONS.map(({ id, question, required }) => ({ id, question, required })),
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

    const { rows: jobRows } = await query(`SELECT id, company_id FROM jobs WHERE id = $1`, [jobId]);
    const job = jobRows[0];
    if (!job) return res.status(404).json({ error: 'unknown_job' });
    if (!job.company_id) return res.status(409).json({ error: 'no_company_account' });

    await query(
      `INSERT INTO job_applications (job_id, student_user_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [jobId, req.user.id],
    );
    res.status(201).json({ ok: true });
  }),
);

export default router;
