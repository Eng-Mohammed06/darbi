import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth, requireRole, asyncRoute } from '../lib/auth.js';
import { chatConfigured, streamCareerReply, loadCareerHistory } from '../lib/careerChat.js';

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

/** Map an upstream failure to something worth showing a graduate. Mirrors chat.js's version but without the student-only "Recommendations tab" fallback mention. */
function friendlyError(err) {
  const status = err?.status;
  const text = err?.message ?? '';

  if (status === 401 || /authentication_error|API key/i.test(text)) {
    return 'The assistant is not authenticated. Check ANTHROPIC_API_KEY on the server.';
  }
  if (/credit balance is too low|Plans & Billing/i.test(text)) {
    return 'The assistant is out of API credit. Add credit at console.anthropic.com → Plans & Billing.';
  }
  if (status === 429 || /rate_limit/i.test(text)) {
    return 'The assistant is busy right now. Give it a few seconds and try again.';
  }
  if (status === 529 || /overloaded/i.test(text)) {
    return 'The assistant is temporarily overloaded. Try again in a moment.';
  }
  if (err?.message === 'chat_refused') {
    return 'I can’t help with that one. Try asking about your CV, a cover letter, interview prep, or your career path.';
  }
  if (/timeout|ECONNRESET|ENOTFOUND|fetch failed/i.test(text)) {
    return 'Lost the connection to the assistant. Try again.';
  }
  return 'Something went wrong reaching the assistant. Try again.';
}

/** GET /api/career/chat — replay the conversation after a refresh. */
router.get(
  '/chat',
  asyncRoute(async (req, res) => {
    res.json({ configured: chatConfigured, messages: await loadCareerHistory(req.user.id) });
  }),
);

/** DELETE /api/career/chat — start over. */
router.delete(
  '/chat',
  asyncRoute(async (req, res) => {
    await query(`DELETE FROM career_chat_messages WHERE career_user_id = $1`, [req.user.id]);
    res.status(204).end();
  }),
);

/**
 * POST /api/career/chat  { message }
 * NDJSON stream, same wire format as POST /api/chat (server/routes/chat.js):
 *   {"delta":"..."} repeated, then {"done":true} or {"error":"..."}.
 */
router.post(
  '/chat',
  asyncRoute(async (req, res) => {
    const message = String(req.body?.message ?? '').trim();
    if (!message) return res.status(400).json({ error: 'empty_message' });
    if (message.length > 4000) return res.status(400).json({ error: 'message_too_long' });

    if (!chatConfigured) {
      return res.status(503).json({
        error: 'chat_not_configured',
        message: 'The AI assistant needs ANTHROPIC_API_KEY to be set on the server.',
      });
    }

    const { rows } = await query(`SELECT * FROM career_profiles WHERE user_id = $1`, [req.user.id]);
    const profile = rows[0];
    if (!profile) return res.status(404).json({ error: 'no_profile' });

    // Persist the question before generating, so it survives a failed reply.
    await query(
      `INSERT INTO career_chat_messages (career_user_id, role, content) VALUES ($1,'user',$2)`,
      [req.user.id, message],
    );
    const history = await loadCareerHistory(req.user.id);

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no'); // don't let a proxy buffer the stream
    res.flushHeaders?.();

    let full = '';
    try {
      for await (const chunk of streamCareerReply({ profile, history })) {
        full += chunk;
        res.write(`${JSON.stringify({ delta: chunk })}\n`);
      }
    } catch (err) {
      console.error('[career chat]', err.message);
      res.write(`${JSON.stringify({ error: friendlyError(err) })}\n`);
      return res.end();
    }

    if (full.trim()) {
      await query(
        `INSERT INTO career_chat_messages (career_user_id, role, content) VALUES ($1,'assistant',$2)`,
        [req.user.id, full],
      );
    }
    res.write(`${JSON.stringify({ done: true })}\n`);
    res.end();
  }),
);

export default router;
