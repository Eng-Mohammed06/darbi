import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth, requireRole, asyncRoute } from '../lib/auth.js';

const router = Router();

router.use(requireAuth, requireRole('career'));

/** PUT /api/career/me  { name } — signup no longer collects a name
 * separately (it defaults to the username), so this is how a graduate sets
 * a proper display name afterward. */
router.put(
  '/me',
  asyncRoute(async (req, res) => {
    const { name } = req.body ?? {};
    if (!name) return res.status(400).json({ error: 'missing_name' });

    const { rows } = await query(
      `UPDATE career_profiles SET name = $2 WHERE user_id = $1 RETURNING *`,
      [req.user.id, String(name).trim()],
    );
    if (!rows[0]) return res.status(404).json({ error: 'no_profile' });
    res.json(rows[0]);
  }),
);

export default router;
