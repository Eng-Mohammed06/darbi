import { Router } from 'express';
import { createHash } from 'node:crypto';
import { query } from '../lib/db.js';
import { requireAuth, requireRole, asyncRoute } from '../lib/auth.js';
import { claudeConfigured, recommendMajors, recommendMajorsFallback } from '../lib/claude.js';

const router = Router();

/** Cache key: same profile -> same recommendations, no repeat API spend. */
const profileHash = (student) =>
  createHash('sha256')
    .update(
      JSON.stringify({
        interests: [...(student.interests ?? [])].sort(),
        gpa: student.gpa,
        level: student.level,
        location: student.location,
        salary_pref: student.salary_pref,
      }),
    )
    .digest('hex');

/**
 * POST /api/recommend  (student only)
 * Returns cached recommendations when the profile is unchanged.
 * ?refresh=1 forces a new call.
 */
router.post(
  '/',
  requireAuth,
  requireRole('student'),
  asyncRoute(async (req, res) => {
    const { rows: studentRows } = await query(`SELECT * FROM students WHERE user_id = $1`, [
      req.user.id,
    ]);
    const student = studentRows[0];
    if (!student) return res.status(404).json({ error: 'no_profile' });
    if (!student.interests?.length) {
      return res.status(400).json({
        error: 'profile_incomplete',
        message: 'Add at least one interest before requesting recommendations.',
      });
    }

    const hash = profileHash(student);

    if (req.query.refresh !== '1') {
      const { rows } = await query(
        `SELECT payload, model, created_at FROM recommendations
          WHERE student_user_id = $1 AND profile_hash = $2
          ORDER BY created_at DESC LIMIT 1`,
        [req.user.id, hash],
      );
      if (rows[0]) {
        return res.json({ ...rows[0].payload, model: rows[0].model, cached: true });
      }
    }

    const [{ rows: majors }, { rows: courses }, { rows: jobs }] = await Promise.all([
      query(`SELECT m.name, m.salary_entry_min_jod, m.salary_entry_max_jod, m.top_jobs,
                    (SELECT count(*)::int FROM courses c WHERE c.major_id = m.id) AS course_count,
                    (SELECT coalesce(array_agg(DISTINCT u.code), '{}')
                       FROM university_majors um JOIN universities u ON u.id = um.university_id
                      WHERE um.major_id = m.id) AS universities
               FROM majors m ORDER BY m.name`),
      query(`SELECT major_name, name, track, provider FROM courses ORDER BY major_name, name`),
      query(`SELECT company_name, title, required_majors, required_skills FROM jobs WHERE status = 'active'`),
    ]);

    const input = { student, majors, courses, jobs };

    let result;
    if (claudeConfigured) {
      try {
        result = await recommendMajors(input);
      } catch (err) {
        // Never fail the request on an API problem — the student still gets a
        // ranked list, and the response says which engine produced it.
        console.warn('[recommend] Claude unavailable, using fallback:', err.message);
        result = recommendMajorsFallback(input);
        result.degraded_reason = err.message;
      }
    } else {
      result = recommendMajorsFallback(input);
      result.degraded_reason = 'claude_not_configured';
    }

    await query(
      `INSERT INTO recommendations (student_user_id, profile_hash, payload, model)
       VALUES ($1,$2,$3,$4)`,
      [req.user.id, hash, result.data, result.model],
    );

    res.json({
      ...result.data,
      model: result.model,
      source: result.source,
      degraded_reason: result.degraded_reason,
      cached: false,
    });
  }),
);

export default router;
