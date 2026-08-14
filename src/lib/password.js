/**
 * Mirrors server/lib/auth.js's passwordIssues — the server is what actually
 * enforces this, but checking client-side first means a weak password shows
 * a specific "needs a number" error immediately instead of a round trip.
 */
const SPECIAL_CHAR = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/;

export const PASSWORD_HINT = '8+ characters, with upper & lower case, a number, and a symbol';

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
