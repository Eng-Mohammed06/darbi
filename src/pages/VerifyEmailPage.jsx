import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth.jsx';
import { Alert, Button, CenteredCard } from '../components/common/ui.jsx';
import { useLang } from '../i18n/index.jsx';

/**
 * First stop after signup, before ProfileSetupPage and OnboardingPage.
 * Verification still never gates login server-side (server/routes/auth.js) —
 * "Skip for now" exists so a slow or undelivered email can't strand a new
 * account mid-flow, matching that same soft-gate philosophy.
 */
export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const { user, setUser, verifyEmail, resendVerification } = useAuth();
  const { t } = useLang();

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  // Students continue into profile-setup/onboarding; companies continue into
  // their own required profile step (industry/description/website/location/
  // logo). Career has no further signup steps yet and lands on its dashboard.
  const DESTINATION = { student: '/profile-setup', company: '/company-profile-setup' };
  const destination = DESTINATION[user?.role] ?? '/';

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const updated = await verifyEmail(code);
      setUser(updated);
      navigate(destination);
    } catch (err) {
      setError(
        {
          invalid_code: t('verifyEmail.errorInvalidCode'),
          code_expired: t('verifyEmail.errorCodeExpired'),
        }[err.code] ?? err.message,
      );
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError('');
    setStatus('');
    setBusy(true);
    try {
      await resendVerification();
      setStatus(t('verifyEmail.resendSuccess'));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <CenteredCard>
      {user?.role === 'student' && (
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--darbi-gold)' }}>
          {t('verifyEmail.stepIndicator')}
        </p>
      )}
      <h1 className="text-lg font-bold text-darbi-navy mt-2 mb-2">{t('verifyEmail.heading')}</h1>
      <p className="text-sm text-gray-400 mb-5">
        {t('verifyEmail.sentCodePrefix')}{' '}
        <span className="text-white font-semibold">{user?.email}</span>
        {t('verifyEmail.sentCodeSuffix')}
      </p>

      <Alert>{error}</Alert>
      {status && <p className="text-sm text-green-400 mb-4">{status}</p>}

      <form onSubmit={submit} className="space-y-4 text-start">
        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            {t('verifyEmail.codeLabel')}
          </span>
          <input
            className="darbi-input text-center tracking-[0.4em]"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={busy}
            autoFocus
            required
          />
        </label>

        <div className="flex items-center justify-center">
          <Button type="submit" disabled={busy}>
            {busy ? t('verifyEmail.checkingButton') : t('verifyEmail.verifyButton')}
          </Button>
        </div>
      </form>

      <button
        type="button"
        onClick={resend}
        disabled={busy}
        className="text-xs text-gray-500 mt-5 underline block mx-auto"
      >
        {t('verifyEmail.resendButton')}
      </button>
      <button
        type="button"
        onClick={() => navigate(destination)}
        disabled={busy}
        className="text-xs text-gray-500 mt-3 underline block mx-auto"
      >
        {t('verifyEmail.skipButton')}
      </button>
    </CenteredCard>
  );
}
