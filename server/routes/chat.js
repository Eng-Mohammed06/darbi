import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth, requireRole, asyncRoute } from '../lib/auth.js';
import { chatConfigured, streamReply, loadHistory } from '../lib/chat.js';

const router = Router();
router.use(requireAuth, requireRole('student'));

/** Map an upstream failure to something worth showing a student. */
function friendlyError(err) {
  const status = err?.status;
  const text = err?.message ?? '';

  if (status === 401 || /authentication_error|API key/i.test(text)) {
    return 'The advisor is not authenticated. Check ANTHROPIC_API_KEY on the server.';
  }
  // Distinct from a bad key: the key is fine, the account is out of credit.
  // Worth its own message so nobody spends the demo debugging the key.
  if (/credit balance is too low|Plans & Billing/i.test(text)) {
    return 'The advisor is out of API credit. Add credit at console.anthropic.com → Plans & Billing. ' +
      'The Recommendations tab still works without it.';
  }
  if (status === 429 || /rate_limit/i.test(text)) {
    return 'The advisor is busy right now. Give it a few seconds and try again.';
  }
  if (status === 529 || /overloaded/i.test(text)) {
    return 'The advisor is temporarily overloaded. Try again in a moment.';
  }
  if (err?.message === 'chat_refused') {
    return 'I can’t help with that one. Try asking about majors, courses, or jobs.';
  }
  if (/timeout|ECONNRESET|ENOTFOUND|fetch failed/i.test(text)) {
    return 'Lost the connection to the advisor. Try again.';
  }
  return 'Something went wrong reaching the advisor. Try again.';
}

/** GET /api/chat — replay the conversation after a refresh. */
router.get(
  '/',
  asyncRoute(async (req, res) => {
    res.json({ configured: chatConfigured, messages: await loadHistory(req.user.id) });
  }),
);

/** DELETE /api/chat — start over. */
router.delete(
  '/',
  asyncRoute(async (req, res) => {
    await query(`DELETE FROM chat_messages WHERE student_user_id = $1`, [req.user.id]);
    res.status(204).end();
  }),
);

/**
 * POST /api/chat  { message }
 * Responds with newline-delimited JSON so the reply renders as it is written:
 *   {"delta":"..."}   repeated
 *   {"done":true}     once, at the end
 *   {"error":"..."}   instead of done, if generation failed
 *
 * NDJSON rather than SSE because EventSource cannot POST, and this needs a
 * request body plus an Authorization header.
 */
router.post(
  '/',
  asyncRoute(async (req, res) => {
    const message = String(req.body?.message ?? '').trim();
    if (!message) return res.status(400).json({ error: 'empty_message' });
    if (message.length > 4000) return res.status(400).json({ error: 'message_too_long' });

    if (!chatConfigured) {
      return res.status(503).json({
        error: 'chat_not_configured',
        message:
          'The AI advisor needs ANTHROPIC_API_KEY to be set on the server. ' +
          'Major recommendations still work without it.',
      });
    }

    const { rows } = await query(`SELECT * FROM students WHERE user_id = $1`, [req.user.id]);
    const student = rows[0];
    if (!student) return res.status(404).json({ error: 'no_profile' });

    const { rows: analysisRows } = await query(
      `SELECT analysis FROM onboarding_analysis WHERE student_user_id = $1`,
      [req.user.id],
    );
    const analysis = analysisRows[0]?.analysis ?? null;

    // Persist the question before generating, so it survives a failed reply.
    await query(
      `INSERT INTO chat_messages (student_user_id, role, content) VALUES ($1,'user',$2)`,
      [req.user.id, message],
    );

    const history = await loadHistory(req.user.id);

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no'); // don't let a proxy buffer the stream
    res.flushHeaders?.();

    let full = '';
    try {
      for await (const chunk of streamReply({ student, analysis, history })) {
        full += chunk;
        res.write(`${JSON.stringify({ delta: chunk })}\n`);
      }
    } catch (err) {
      console.error('[chat]', err.message);
      // Headers are already sent, so the error has to travel in-band. Send a
      // readable line, not the raw SDK error — that leaks request ids and
      // internals into the browser, and reads as a crash to a judge.
      res.write(`${JSON.stringify({ error: friendlyError(err) })}\n`);
      return res.end();
    }

    if (full.trim()) {
      await query(
        `INSERT INTO chat_messages (student_user_id, role, content) VALUES ($1,'assistant',$2)`,
        [req.user.id, full],
      );
    }
    res.write(`${JSON.stringify({ done: true })}\n`);
    res.end();
  }),
);

export default router;
