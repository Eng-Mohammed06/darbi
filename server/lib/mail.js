const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM ?? 'Darbi <onboarding@resend.dev>';

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
