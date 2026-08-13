const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Built from two plain vars rather than one "Name <email>" value: Railway
// embeds raw variable values into the Dockerfile it generates for the build,
// and unescaped `<`/`>` in a value corrupts that file badly enough to silently
// wreck an unrelated step (observed: devDependencies got skipped entirely,
// so `vite build` failed with "vite: not found"). Keep MAIL_FROM_* free of
// Dockerfile-special characters; the display-name syntax is assembled here.
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME ?? 'Darbi';
const MAIL_FROM_EMAIL = process.env.MAIL_FROM_EMAIL ?? 'onboarding@resend.dev';
const MAIL_FROM = `${MAIL_FROM_NAME} <${MAIL_FROM_EMAIL}>`;
const APP_URL = process.env.APP_URL ?? 'https://darbi-production-563a.up.railway.app';

// Same gate pattern as claude.js: missing key degrades to a logged no-op
// instead of breaking signup/login, so local dev and a key-less deploy still
// work end to end (the code just lands in the server log instead of an inbox).
export const mailConfigured = Boolean(RESEND_API_KEY);

export function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendMail({ to, subject, html }) {
  if (!mailConfigured) {
    console.warn(`[mail] RESEND_API_KEY not set — not sending "${subject}" to ${to}`);
    return { skipped: true };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: MAIL_FROM, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`resend_send_failed: ${res.status} ${body}`);
  }

  return res.json();
}

const shell = (heading, body) => `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
  <h1 style="color:#001a33;font-size:20px;margin:0 0 16px;">${heading}</h1>
  ${body}
  <p style="color:#94a3b8;font-size:12px;margin-top:32px;">— Darbi, career advisory platform</p>
</div>`;

const codeBlock = (code) => `
<div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#001a33;
  background:#f4f4f5;border-radius:8px;padding:16px;text-align:center;margin:16px 0;">
  ${code}
</div>
<p style="color:#64748b;font-size:13px;">This code expires in 15 minutes.</p>`;

export const verificationEmail = (code) => ({
  subject: 'Verify your Darbi email',
  html: shell(
    'Confirm your email address',
    `<p style="color:#334155;font-size:14px;">Enter this code in Darbi to verify your email:</p>${codeBlock(code)}`,
  ),
});

export const resetPasswordEmail = (code) => ({
  subject: 'Reset your Darbi password',
  html: shell(
    'Reset your password',
    `<p style="color:#334155;font-size:14px;">Enter this code to choose a new password. If you didn't request this, you can ignore this email.</p>${codeBlock(code)}`,
  ),
});

const ROLE_PITCH = {
  student: 'Talk to Darbi about what you enjoy and what you’re unsure about, and get majors, courses, ' +
    'salary bands, and jobs matched to verified Jordanian data — no static form to fill out.',
  company: 'Post job listings and filter students by major, GPA, and skills, all backed by DARBI’s ' +
    'verified catalog.',
  career: 'Get AI-driven mentorship, a skills-gap assessment, and career guidance grounded in real ' +
    'Jordanian salary and job data.',
};

const button = (label, href) => `
<a href="${href}" style="display:inline-block;margin-top:20px;padding:12px 28px;
  background:linear-gradient(90deg,#9333ea,#c026d3);color:#ffffff;text-decoration:none;
  border-radius:999px;font-weight:bold;font-size:14px;">${label}</a>`;

/**
 * Sent once, right after signup (alongside, not instead of, the verification
 * code email — this one is about orienting a new user, that one is actionable).
 * `name` is the display name collected at signup (defaults to username, see
 * server/routes/auth.js), `role` picks the pitch that matches their portal.
 */
export const welcomeEmail = (name, role) => ({
  subject: 'Welcome to Darbi',
  html: shell(
    `Welcome to Darbi, ${name}`,
    `<p style="color:#334155;font-size:14px;">
       ${ROLE_PITCH[role] ?? 'Get started exploring verified Jordanian majors, courses, salaries, and jobs.'}
     </p>
     ${button('Open Darbi', APP_URL)}`,
  ),
});
