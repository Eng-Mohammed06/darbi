import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';

const SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = '7d';

if (!SECRET) throw new Error('JWT_SECRET is not set — see .env.example');

// A deploy running the placeholder secret would let anyone forge a token for
// any account. Fail at boot rather than in front of judges.
if (process.env.NODE_ENV === 'production' && SECRET === 'dev-only-change-me') {
  throw new Error(
    'JWT_SECRET is still the .env.example placeholder. Set a real one on Railway:\n' +
      '  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
  );
}

export const hashPassword = (plain) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

const SPECIAL_CHAR = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/;

/**
 * Returns the unmet requirements for a password (empty array = strong
 * enough). Kept as a list rather than a single true/false so the error
 * message can tell the user exactly what's missing, not just "too weak".
 * Mirrored on the frontend (src/lib/password.js) for instant feedback —
 * this is the version that actually gets enforced.
 */
export function passwordIssues(password) {
  const p = String(password ?? '');
  const issues = [];
  if (p.length < 8) issues.push('at least 8 characters');
  if (!/[A-Z]/.test(p)) issues.push('an uppercase letter');
  if (!/[a-z]/.test(p)) issues.push('a lowercase letter');
  if (!/[0-9]/.test(p)) issues.push('a number');
  if (!SPECIAL_CHAR.test(p)) issues.push('a special character (e.g. ! @ # $ %)');
  return issues;
}

export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role, email: user.email }, SECRET, {
    expiresIn: TOKEN_TTL,
  });

/** Populates req.user from the Bearer token, or 401s. */
export function requireAuth(req, res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });

  try {
    const claims = jwt.verify(token, SECRET);
    req.user = { id: claims.sub, role: claims.role, email: claims.email };
    next();
  } catch {
    // Expired and malformed are the same to the client: log in again.
    res.status(401).json({ error: 'invalid_token' });
  }
}

/**
 * Like requireAuth, but a missing or invalid token isn't an error — it just
 * proceeds without req.user. For routes that are public but personalize when
 * the caller happens to be signed in (e.g. GET /api/pathways/:slug).
 */
export function optionalAuth(req, res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();

  try {
    const claims = jwt.verify(token, SECRET);
    req.user = { id: claims.sub, role: claims.role, email: claims.email };
  } catch {
    // Expired/malformed token on an optional route — proceed anonymously
    // rather than rejecting a request nobody required auth for.
  }
  next();
}

/** Gate a route to one or more roles. Use after requireAuth. */
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'missing_token' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'wrong_role', need: roles, have: req.user.role });
    }
    next();
  };

/**
 * Gate a route to admin access — either the pure-admin role, or a
 * student/company/career account with `is_admin` granted (dual-role, see
 * db/schema.sql). Checks the database fresh on every request rather than a
 * JWT claim: a token is valid for 7 days, and granting or revoking admin
 * access needs to take effect immediately in both directions, not wait for
 * the caller's token to expire. Use after requireAuth.
 */
export async function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'missing_token' });
  try {
    const { rows } = await pool.query(`SELECT role, is_admin FROM users WHERE id = $1`, [req.user.id]);
    const row = rows[0];
    if (!row || !(row.role === 'admin' || row.is_admin)) {
      return res.status(403).json({ error: 'wrong_role', need: ['admin'], have: row?.role ?? null });
    }
    next();
  } catch (err) {
    next(err);
  }
}

/** Wraps an async handler so a rejected promise reaches the error middleware. */
export const asyncRoute = (fn) => (req, res, next) => fn(req, res, next).catch(next);
