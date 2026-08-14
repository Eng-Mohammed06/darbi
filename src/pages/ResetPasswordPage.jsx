import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth.jsx';
import { DarkCard, DarkField, darkInput, GRADIENT, PURPLE_DARK } from '../components/common/ui.jsx';
import { PASSWORD_HINT, passwordIssues } from '../lib/password.js';
import { useLang } from '../i18n/index.jsx';

/**
 * Two-step forgot-password flow: request a code by email/username, then
 * submit that code with a new password. Public route — reachable while
 * signed out, which is exactly when a user needs it.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { forgotPassword, resetPassword } = useAuth();
  const { t } = useLang();

  const [step, setStep] = useState('request'); // 'request' | 'reset' | 'done'
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestCode(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await forgotPassword(identifier);
      setStep('reset');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError(t('resetPassword.errorMismatch'));
      return;
    }
    const issues = passwordIssues(newPassword);
    if (issues.length) {
      setError(t('resetPassword.errorPasswordNeeds')(issues.join(', ')));
      return;
    }
    setBusy(true);
    try {
      await resetPassword(identifier, code, newPassword);
      setStep('done');
    } catch (err) {
      setError(
        {
          invalid_code: t('resetPassword.errorInvalidCode'),
          code_expired: t('resetPassword.errorCodeExpired'),
        }[err.code] ?? err.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <DarkCard
      title={t('resetPassword.title')}
      subtitle={
        step === 'request'
          ? t('resetPassword.subtitleRequest')
          : step === 'reset'
            ? t('resetPassword.subtitleReset')(identifier)
            : t('resetPassword.subtitleDone')
      }
    >
      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{
            background: 'color-mix(in srgb, var(--darbi-error) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--darbi-error) 30%, transparent)',
            color: 'var(--darbi-error)',
          }}
        >
          {error}
        </div>
      )}

      {step === 'request' && (
        <form onSubmit={requestCode} className="space-y-4">
          <DarkField label={t('resetPassword.identifierLabel')}>
            <input
              className={darkInput}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
            />
          </DarkField>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full py-3 font-bold text-white transition disabled:opacity-60"
            style={{ background: GRADIENT, boxShadow: `0 10px 30px color-mix(in srgb, ${PURPLE_DARK} 35%, transparent)` }}
          >
            {busy ? t('resetPassword.sendingButton') : t('resetPassword.sendCodeButton')}
          </button>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={submitReset} className="space-y-4">
          <DarkField label={t('resetPassword.codeLabel')}>
            <input
              className={darkInput}
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
            />
          </DarkField>
          <DarkField label={t('resetPassword.newPasswordLabel')} hint={PASSWORD_HINT}>
            <input
              type="password"
              className={darkInput}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </DarkField>
          <DarkField label={t('resetPassword.confirmPasswordLabel')}>
            <input
              type="password"
              className={darkInput}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </DarkField>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full py-3 font-bold text-white transition disabled:opacity-60"
            style={{ background: GRADIENT, boxShadow: `0 10px 30px color-mix(in srgb, ${PURPLE_DARK} 35%, transparent)` }}
          >
            {busy ? t('resetPassword.resettingButton') : t('resetPassword.resetButton')}
          </button>
          <button
            type="button"
            onClick={() => setStep('request')}
            className="w-full text-xs font-semibold text-gray-400 hover:text-gray-200"
          >
            {t('resetPassword.retryButton')}
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="text-center space-y-4">
          <p className="text-gray-300 text-sm">{t('resetPassword.doneMessage')}</p>
          <button
            type="button"
            onClick={() => navigate('/portal/student')}
            className="w-full rounded-full py-3 font-bold text-white transition"
            style={{ background: GRADIENT, boxShadow: `0 10px 30px color-mix(in srgb, ${PURPLE_DARK} 35%, transparent)` }}
          >
            {t('resetPassword.backToSignIn')}
          </button>
        </div>
      )}
    </DarkCard>
  );
}
