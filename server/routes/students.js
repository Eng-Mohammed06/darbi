import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth, requireRole, asyncRoute } from '../lib/auth.js';

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

export default router;
