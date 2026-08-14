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

/**
 * Live-typing strength meter, separate from passwordIssues — that's a hard
 * pass/fail gate on submit, this is a softer "how strong so far" reading
 * while the user is still typing. One point per requirement met, plus a
 * bonus for real length, out of a max of 6.
 */
export function passwordStrength(password) {
  const p = String(password ?? '');
  if (!p) return null;

  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[a-z]/.test(p)) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (SPECIAL_CHAR.test(p)) score++;

  if (score <= 2) return { level: 'weak', label: 'Weak', score };
  if (score <= 4) return { level: 'fair', label: 'Fair', score };
  return { level: 'strong', label: 'Strong', score };
}
