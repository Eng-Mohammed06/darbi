/**
 * Mirrors server/lib/auth.js's passwordIssues — the server is what actually
 * enforces this, but checking client-side first means a weak password shows
 * a specific "needs a number" error immediately instead of a round trip.
 */
const SPECIAL_CHAR = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/;

const HINT = {
  en: '8+ characters, with upper & lower case, a number, and a symbol',
  ar: '8 أحرف على الأقل، بحروف كبيرة وصغيرة، ورقم، ورمز',
};

const ISSUES = {
  en: {
    length: 'at least 8 characters',
    upper: 'an uppercase letter',
    lower: 'a lowercase letter',
    digit: 'a number',
    special: 'a special character (e.g. ! @ # $ %)',
  },
  ar: {
    length: '8 أحرف على الأقل',
    upper: 'حرفًا كبيرًا',
    lower: 'حرفًا صغيرًا',
    digit: 'رقمًا',
    special: 'رمزًا خاصًا (مثل ! @ # $ %)',
  },
};

const STRENGTH_LABEL = {
  en: { weak: 'Weak', fair: 'Fair', strong: 'Strong' },
  ar: { weak: 'ضعيفة', fair: 'مقبولة', strong: 'قوية' },
};

export function passwordHint(lang = 'en') {
  return HINT[lang] ?? HINT.en;
}
// Kept as a plain export for existing `import { PASSWORD_HINT }` call sites — English default.
export const PASSWORD_HINT = HINT.en;

export function passwordIssues(password, lang = 'en') {
  const p = String(password ?? '');
  const d = ISSUES[lang] ?? ISSUES.en;
  const issues = [];
  if (p.length < 8) issues.push(d.length);
  if (!/[A-Z]/.test(p)) issues.push(d.upper);
  if (!/[a-z]/.test(p)) issues.push(d.lower);
  if (!/[0-9]/.test(p)) issues.push(d.digit);
  if (!SPECIAL_CHAR.test(p)) issues.push(d.special);
  return issues;
}

/**
 * Live-typing strength meter, separate from passwordIssues — that's a hard
 * pass/fail gate on submit, this is a softer "how strong so far" reading
 * while the user is still typing. One point per requirement met, plus a
 * bonus for real length, out of a max of 6.
 */
export function passwordStrength(password, lang = 'en') {
  const p = String(password ?? '');
  if (!p) return null;

  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[a-z]/.test(p)) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (SPECIAL_CHAR.test(p)) score++;

  const labels = STRENGTH_LABEL[lang] ?? STRENGTH_LABEL.en;
  if (score <= 2) return { level: 'weak', label: labels.weak, score };
  if (score <= 4) return { level: 'fair', label: labels.fair, score };
  return { level: 'strong', label: labels.strong, score };
}
