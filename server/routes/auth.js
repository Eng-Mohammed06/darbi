import { Router } from 'express';
import { query, withTransaction } from '../lib/db.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
  requireAuth,
  asyncRoute,
} from '../lib/auth.js';

const router = Router();
const ROLES = ['student', 'company', 'career'];

/** Loads the role-specific profile that hangs off a user row. */
async function loadProfile(userId, role) {
  const table = { student: 'students', company: 'companies', career: 'career_profiles' }[role];
  const { rows } = await query(`SELECT * FROM ${table} WHERE user_id = $1`, [userId]);
  return rows[0] ?? null;
}

/**
 * POST /api/auth/signup
 * { email, password, role, name, ...role-specific fields }
 * Creates the user and its profile row in one transaction.
 */
router.post(
  '/signup',
  asyncRoute(async (req, res) => {
    const { email, username, password, role, name } = req.body ?? {};

    if (!email || !username || !password || !role || !name) {
      return res.status(400).json({
        error: 'missing_fields',
        need: ['email', 'username', 'password', 'role', 'name'],
      });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: 'bad_role', allowed: ROLES });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'weak_password', message: 'Use at least 6 characters.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedUsername = String(username).trim();
    const passwordHash = await hashPassword(String(password));

    let user;
    try {
      user = await withTransaction(async (client) => {
        const { rows } = await client.query(
          `INSERT INTO users (email, username, password_hash, role) VALUES ($1,$2,$3,$4)
           RETURNING id, email, username, role`,
          [normalizedEmail, normalizedUsername, passwordHash, role],
        );
        const created = rows[0];

        if (role === 'student') {
          const { interests, gpa, level, location, salaryPref } = req.body;
          await client.query(
            `INSERT INTO students (user_id, name, level, interests, gpa, location, salary_pref)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [created.id, name, level ?? null, interests ?? [], gpa ?? null,
             location ?? null, salaryPref ?? null],
          );
        } else if (role === 'company') {
          const { industry, website } = req.body;
          await client.query(
            `INSERT INTO companies (user_id, name, industry, website) VALUES ($1,$2,$3,$4)`,
            [created.id, name, industry ?? null, website ?? null],
          );
        } else {
          const { currentTitle, yearsExperience, major, skills } = req.body;
          await client.query(
            `INSERT INTO career_profiles (user_id, name, current_title, years_experience, major, skills)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [created.id, name, currentTitle ?? null, yearsExperience ?? null,
             major ?? null, skills ?? []],
          );
        }
        return created;
      });
    } catch (err) {
      if (err.code === '23505') {
        const taken = err.constraint?.includes('username') ? 'username_taken' : 'email_taken';
        return res.status(409).json({ error: taken });
      }
      throw err;
    }

    res.status(201).json({
      token: signToken(user),
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
      profile: await loadProfile(user.id, user.role),
    });
  }),
);

/** POST /api/auth/login  { email, password } */
router.post(
  '/login',
  asyncRoute(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const { rows } = await query(
      `SELECT id, email, username, role, password_hash FROM users WHERE email = $1`,
      [String(email).trim().toLowerCase()],
    );
    const user = rows[0];

    // Same response whether the email is unknown or the password is wrong —
    // otherwise this endpoint enumerates registered accounts.
    const ok = user && (await verifyPassword(String(password), user.password_hash));
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

    res.json({
      token: signToken(user),
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
      profile: await loadProfile(user.id, user.role),
    });
  }),
);

/** GET /api/auth/me — rehydrate the session on page load. */
router.get(
  '/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { rows } = await query(
      `SELECT id, email, username, role FROM users WHERE id = $1`,
      [req.user.id],
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'user_gone' });
    res.json({ user, profile: await loadProfile(user.id, user.role) });
  }),
);

/** PUT /api/auth/username  { username } */
router.put(
  '/username',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { username } = req.body ?? {};
    const normalized = String(username ?? '').trim();
    if (!normalized) {
      return res.status(400).json({ error: 'missing_fields', need: ['username'] });
    }

    try {
      const { rows } = await query(
        `UPDATE users SET username = $1, updated_at = now() WHERE id = $2
         RETURNING id, email, username, role`,
        [normalized, req.user.id],
      );
      res.json({ user: rows[0] });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'username_taken' });
      }
      throw err;
    }
  }),
);

/** PUT /api/auth/password  { currentPassword, newPassword } */
router.put(
  '/password',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'missing_fields', need: ['currentPassword', 'newPassword'] });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'weak_password', message: 'Use at least 6 characters.' });
    }

    const { rows } = await query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.id]);
    const user = rows[0];
    const ok = user && (await verifyPassword(String(currentPassword), user.password_hash));
    // 403, not 401 — api.js treats any 401 as an expired session and clears the
    // token, which would wrongly sign the user out for mistyping their old
    // password rather than just rejecting the password change.
    if (!ok) return res.status(403).json({ error: 'invalid_credentials' });

    const passwordHash = await hashPassword(String(newPassword));
    await query(
      `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`,
      [passwordHash, req.user.id],
    );
    res.json({ ok: true });
  }),
);

export default router;
