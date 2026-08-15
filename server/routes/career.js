import { Router } from 'express';
import { createHash } from 'node:crypto';
import { query } from '../lib/db.js';
import { requireAuth, requireRole, asyncRoute } from '../lib/auth.js';
import { chatConfigured, streamCareerReply, loadCareerHistory } from '../lib/careerChat.js';
import { generateCareerLadder, generateCareerLadderFallback } from '../lib/careerLadder.js';
import { matchJobs, matchJobsFallback, candidateJobs } from '../lib/jobMatch.js';

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
      skills, careerGoals, certificates, projects, experience, targetRole,
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
         experience        = COALESCE($12, experience),
         target_role       = COALESCE($13, target_role)
       WHERE user_id = $1
       RETURNING *`,
      [req.user.id, name ?? null, currentTitle ?? null, yearsExperience ?? null,
       major ?? null, university ?? null, yearGraduated ?? null, skills ?? null,
       careerGoals ?? null,
       certificates != null ? JSON.stringify(certificates) : null,
       projects != null ? JSON.stringify(projects) : null,
       experience != null ? JSON.stringify(experience) : null,
       targetRole ?? null],
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

/** Cache key: same relevant profile fields -> same ladder, no repeat API spend. */
const ladderHash = (profile) =>
  createHash('sha256')
    .update(
      JSON.stringify({
        major: profile.major,
        current_title: profile.current_title,
        years_experience: profile.years_experience,
        skills: [...(profile.skills ?? [])].sort(),
        certificates: profile.certificates,
        projects: profile.projects,
        experience: profile.experience,
        career_goals: [...(profile.career_goals ?? [])].sort(),
        target_role: profile.target_role,
      }),
    )
    .digest('hex');

/**
 * POST /api/career/ladder — a personalized career progression ladder.
 * Returns the cached one when the relevant profile fields are unchanged.
 * ?refresh=1 forces a new call. Same cache/degrade pattern as
 * server/routes/recommend.js.
 */
router.post(
  '/ladder',
  asyncRoute(async (req, res) => {
    const { rows } = await query(`SELECT * FROM career_profiles WHERE user_id = $1`, [req.user.id]);
    const profile = rows[0];
    if (!profile) return res.status(404).json({ error: 'no_profile' });
    if (!profile.major && !profile.current_title) {
      return res.status(400).json({
        error: 'profile_incomplete',
        message: 'Add your major or current role in the Profile tab first.',
      });
    }

    const hash = ladderHash(profile);

    if (req.query.refresh !== '1') {
      const { rows: cached } = await query(
        `SELECT payload, model, created_at FROM career_ladders
          WHERE career_user_id = $1 AND profile_hash = $2
          ORDER BY created_at DESC LIMIT 1`,
        [req.user.id, hash],
      );
      if (cached[0]) {
        return res.json({ ...cached[0].payload, model: cached[0].model, cached: true });
      }
    }

    const { rows: jobsSample } = await query(
      `SELECT company_name, title, required_majors, required_skills, salary_raw
         FROM jobs ORDER BY company_name LIMIT 40`,
    );

    let result;
    if (chatConfigured) {
      try {
        result = await generateCareerLadder({ profile, jobsSample });
      } catch (err) {
        console.warn('[career ladder] Claude unavailable, using fallback:', err.message);
        result = generateCareerLadderFallback({ profile });
        result.degraded_reason = err.message;
      }
    } else {
      result = generateCareerLadderFallback({ profile });
      result.degraded_reason = 'chat_not_configured';
    }

    await query(
      `INSERT INTO career_ladders (career_user_id, profile_hash, payload, model)
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

/** Cache key: same relevant profile fields -> same matches, no repeat API spend. */
const jobMatchHash = (profile) =>
  createHash('sha256')
    .update(
      JSON.stringify({
        major: profile.major,
        current_title: profile.current_title,
        years_experience: profile.years_experience,
        skills: [...(profile.skills ?? [])].sort(),
        certificates: profile.certificates,
        projects: profile.projects,
        experience: profile.experience,
      }),
    )
    .digest('hex');

/**
 * POST /api/career/job-matches — the 8-10 best-fitting real job listings for
 * this graduate, each with a match score and a per-requirement ✅/❌
 * breakdown. Same cache/degrade pattern as /ladder and
 * server/routes/recommend.js.
 */
router.post(
  '/job-matches',
  asyncRoute(async (req, res) => {
    const { rows } = await query(`SELECT * FROM career_profiles WHERE user_id = $1`, [req.user.id]);
    const profile = rows[0];
    if (!profile) return res.status(404).json({ error: 'no_profile' });
    if (!profile.skills?.length && !profile.major) {
      return res.status(400).json({
        error: 'profile_incomplete',
        message: 'Add your major or a few skills in the Profile tab first.',
      });
    }

    const hash = jobMatchHash(profile);

    if (req.query.refresh !== '1') {
      const { rows: cached } = await query(
        `SELECT payload, model, created_at FROM job_matches
          WHERE career_user_id = $1 AND profile_hash = $2
          ORDER BY created_at DESC LIMIT 1`,
        [req.user.id, hash],
      );
      if (cached[0]) {
        return res.json({ ...cached[0].payload, model: cached[0].model, cached: true });
      }
    }

    const { rows: jobs } = await query(
      `SELECT id, company_name, title, required_majors, required_skills,
              salary_raw, salary_is_estimate, location
         FROM jobs ORDER BY id`,
    );

    let result;
    if (chatConfigured) {
      try {
        result = await matchJobs({ profile, jobs: candidateJobs(profile, jobs) });
      } catch (err) {
        console.warn('[job matches] Claude unavailable, using fallback:', err.message);
        result = matchJobsFallback({ profile, jobs });
        result.degraded_reason = err.message;
      }
    } else {
      result = matchJobsFallback({ profile, jobs });
      result.degraded_reason = 'chat_not_configured';
    }

    // Claude/the fallback only return job_id + scoring — merge back the
    // actual listing details so the client needs just this one response.
    const byId = new Map(jobs.map((j) => [j.id, j]));
    const matches = result.data.matches
      .filter((m) => byId.has(m.job_id))
      .map((m) => ({ ...m, ...byId.get(m.job_id) }));

    const payload = { matches };

    await query(
      `INSERT INTO job_matches (career_user_id, profile_hash, payload, model)
       VALUES ($1,$2,$3,$4)`,
      [req.user.id, hash, payload, result.model],
    );

    res.json({
      ...payload,
      model: result.model,
      source: result.source,
      degraded_reason: result.degraded_reason,
      cached: false,
    });
  }),
);

const APPLICATION_STATUSES = ['applied', 'under_review', 'interview', 'accepted', 'rejected'];

/** GET /api/career/applications — every application this graduate is tracking. */
router.get(
  '/applications',
  asyncRoute(async (req, res) => {
    const { rows } = await query(
      `SELECT * FROM career_applications WHERE career_user_id = $1 ORDER BY applied_at DESC`,
      [req.user.id],
    );
    res.json(rows);
  }),
);

/**
 * POST /api/career/applications
 *   { jobId?, companyName, title, status?, notes?, matchScore?, requirements?, why? }
 * Either tracks a real listing (jobId set — idempotent, ON CONFLICT just
 * returns the existing row rather than erroring, since re-clicking "Track"
 * on the same Job Recommendations match shouldn't create a duplicate) or
 * logs one manually (jobId omitted, e.g. a role found outside DARBI).
 *
 * When jobId is set but matchScore/requirements/why weren't already
 * supplied (i.e. applying from the Jobs tab, which shows the raw listing
 * rather than a pre-scored match), this fills them in itself using the same
 * scoring Job Recommendations uses (server/lib/jobMatch.js), so every
 * tracked application ends up with the full picture — not just company and
 * title — regardless of where the graduate applied from. Tracking from a
 * Job Recommendations card already has this data client-side, so it's
 * passed straight through instead of paying for a second API call.
 */
router.post(
  '/applications',
  asyncRoute(async (req, res) => {
    const {
      jobId, companyName, title, status, notes,
      matchScore: providedScore, requirements: providedRequirements, why: providedWhy,
    } = req.body ?? {};
    const companyTrim = String(companyName ?? '').trim();
    const titleTrim = String(title ?? '').trim();
    if (!companyTrim || !titleTrim) {
      return res.status(400).json({ error: 'missing_fields', need: ['companyName', 'title'] });
    }
    if (status != null && !APPLICATION_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'bad_status', allowed: APPLICATION_STATUSES });
    }

    let matchScore = providedScore ?? null;
    let requirements = providedRequirements ?? null;
    let why = providedWhy ?? null;
    let salaryRaw = null;
    let location = null;

    if (jobId != null) {
      const { rows: jobRows } = await query(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
      const job = jobRows[0];
      if (job) {
        salaryRaw = job.salary_raw;
        location = job.location;

        if (matchScore == null) {
          const { rows: profileRows } = await query(`SELECT * FROM career_profiles WHERE user_id = $1`, [req.user.id]);
          const profile = profileRows[0];
          let result;
          if (chatConfigured) {
            try {
              result = await matchJobs({ profile, jobs: [job] });
            } catch (err) {
              // Same tiered fallback as /job-matches and /ladder — a bad or
              // out-of-credit key must not mean the application gets tracked
              // with no context, only that the context is rule-based instead.
              console.warn('[applications] Claude unavailable, using fallback:', err.message);
              result = matchJobsFallback({ profile, jobs: [job] });
            }
          } else {
            result = matchJobsFallback({ profile, jobs: [job] });
          }
          const m = result.data.matches[0];
          if (m) {
            matchScore = m.match_score;
            requirements = m.requirements;
            why = m.why;
          }
        }
      }
    }

    const { rows } = await query(
      `INSERT INTO career_applications
         (career_user_id, job_id, company_name, title, status, notes, match_score, requirements, why, salary_raw, location)
       VALUES ($1,$2,$3,$4,COALESCE($5,'applied'),$6,$7,$8,$9,$10,$11)
       ON CONFLICT (career_user_id, job_id) DO NOTHING
       RETURNING *`,
      [req.user.id, jobId ?? null, companyTrim, titleTrim, status ?? null, notes ?? null,
       matchScore, requirements != null ? JSON.stringify(requirements) : null, why, salaryRaw, location],
    );

    if (rows[0]) return res.status(201).json(rows[0]);

    // ON CONFLICT hit (jobId was already tracked) — jobId can't be null here,
    // since NULLs never conflict, so this lookup is unambiguous.
    const { rows: existing } = await query(
      `SELECT * FROM career_applications WHERE career_user_id = $1 AND job_id = $2`,
      [req.user.id, jobId],
    );
    res.status(200).json(existing[0]);
  }),
);

/** PATCH /api/career/applications/:id  { status?, notes? } */
router.patch(
  '/applications/:id',
  asyncRoute(async (req, res) => {
    const { status, notes } = req.body ?? {};
    if (status != null && !APPLICATION_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'bad_status', allowed: APPLICATION_STATUSES });
    }

    const { rows } = await query(
      `UPDATE career_applications SET
         status     = COALESCE($3, status),
         notes      = COALESCE($4, notes),
         updated_at = now()
       WHERE id = $1 AND career_user_id = $2
       RETURNING *`,
      [req.params.id, req.user.id, status ?? null, notes ?? null],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  }),
);

/** DELETE /api/career/applications/:id */
router.delete(
  '/applications/:id',
  asyncRoute(async (req, res) => {
    const { rows } = await query(
      `DELETE FROM career_applications WHERE id = $1 AND career_user_id = $2 RETURNING id`,
      [req.params.id, req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.status(204).end();
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
