import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth, requireRole, asyncRoute } from '../lib/auth.js';

const router = Router();

router.use(requireAuth, requireRole('career'));

/** Each entry just needs to be a plain object — the exact shape (title/company/period/... vs name/issuer/year vs title/description/link) is up to the client per list, nothing here depends on it. */
function isEntryList(v) {
  return Array.isArray(v) && v.every((e) => e && typeof e === 'object' && !Array.isArray(e));
}

/**
 * PUT /api/career/me — updates the graduate's editable profile fields, all
 * optional (COALESCE keeps whatever isn't sent), same pattern as
 * server/routes/students.js's PUT /me. Array fields (skills, careerGoals,
 * certificates, projects, experience) are each a full replace, not a merge
 * — the Profile tab always submits a section's complete list when it saves
 * that section.
 */
router.put(
  '/me',
  asyncRoute(async (req, res) => {
    const {
      name, currentTitle, yearsExperience, major, university, yearGraduated,
      skills, careerGoals, certificates, projects, experience,
    } = req.body ?? {};

    if (yearsExperience != null && (Number.isNaN(Number(yearsExperience)) || yearsExperience < 0)) {
      return res.status(400).json({ error: 'bad_years_experience' });
    }
    const thisYear = new Date().getFullYear();
    if (yearGraduated != null && (Number.isNaN(Number(yearGraduated)) || yearGraduated < 1950 || yearGraduated > thisYear + 10)) {
      return res.status(400).json({ error: 'bad_year_graduated' });
    }
    for (const [key, value] of [['certificates', certificates], ['projects', projects], ['experience', experience]]) {
      if (value != null && !isEntryList(value)) {
        return res.status(400).json({ error: 'bad_entry_list', field: key });
      }
    }

    const { rows } = await query(
      `UPDATE career_profiles SET
         name              = COALESCE($2, name),
         current_title     = COALESCE($3, current_title),
         years_experience  = COALESCE($4, years_experience),
         major             = COALESCE($5, major),
         university        = COALESCE($6, university),
         year_graduated    = COALESCE($7, year_graduated),
         skills            = COALESCE($8, skills),
         career_goals      = COALESCE($9, career_goals),
         certificates      = COALESCE($10, certificates),
         projects          = COALESCE($11, projects),
         experience        = COALESCE($12, experience)
       WHERE user_id = $1
       RETURNING *`,
      [req.user.id, name ?? null, currentTitle ?? null, yearsExperience ?? null,
       major ?? null, university ?? null, yearGraduated ?? null, skills ?? null,
       careerGoals ?? null,
       certificates != null ? JSON.stringify(certificates) : null,
       projects != null ? JSON.stringify(projects) : null,
       experience != null ? JSON.stringify(experience) : null],
    );
    if (!rows[0]) return res.status(404).json({ error: 'no_profile' });
    res.json(rows[0]);
  }),
);

const CV_MAX_BYTES = 4 * 1024 * 1024; // 4MB decoded — plenty for a CV
const CV_DATA_URL = /^data:application\/pdf;base64,([A-Za-z0-9+/]+={0,2})$/;

/**
 * PUT /api/career/cv  { file: "data:application/pdf;base64,...", filename }
 * PDF only, and only up to CV_MAX_BYTES decoded -- checked here, not just
 * client-side, since the client check (src/lib/cv.js) is bypassable. Stored
 * as the data: URI itself (career_profiles.cv), same rationale as
 * users.avatar: no object store configured for this deploy.
 */
router.put(
  '/cv',
  asyncRoute(async (req, res) => {
    const { file, filename } = req.body ?? {};
    const match = typeof file === 'string' && CV_DATA_URL.exec(file);
    if (!match) {
      return res.status(400).json({ error: 'bad_file', message: 'Upload a .pdf file.' });
    }
    const bytes = Buffer.from(match[1], 'base64').length;
    if (bytes > CV_MAX_BYTES) {
      return res.status(400).json({ error: 'file_too_large', message: 'File must be 4MB or smaller.' });
    }

    const { rows } = await query(
      `UPDATE career_profiles SET cv = $1, cv_filename = $2, cv_uploaded_at = now()
       WHERE user_id = $3 RETURNING *`,
      [file, String(filename ?? 'CV.pdf').slice(0, 200), req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'no_profile' });
    res.json(rows[0]);
  }),
);

/** DELETE /api/career/cv — removes the uploaded CV file. */
router.delete(
  '/cv',
  asyncRoute(async (req, res) => {
    const { rows } = await query(
      `UPDATE career_profiles SET cv = NULL, cv_filename = NULL, cv_uploaded_at = NULL
       WHERE user_id = $1 RETURNING *`,
      [req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'no_profile' });
    res.json(rows[0]);
  }),
);

export default router;
