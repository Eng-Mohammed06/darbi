import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth.jsx';
import { DarkCard, DarkField, darkInput, GRADIENT, PURPLE_DARK } from '../components/common/ui.jsx';

/**
 * Two-step forgot-password flow: request a code by email/username, then
 * submit that code with a new password. Public route — reachable while
 * signed out, which is exactly when a user needs it.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { forgotPassword, resetPassword } = useAuth();

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
      setError('New password and confirmation do not match.');
      return;
    }
    setBusy(true);
    try {
      await resetPassword(identifier, code, newPassword);
      setStep('done');
    } catch (err) {
      setError(
        {
          invalid_code: 'That code is not correct.',
          code_expired: 'That code expired — request a new one.',
          weak_password: 'Password must be at least 6 characters.',
        }[err.code] ?? err.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <DarkCard
      title="Reset your password"
      subtitle={
        step === 'request'
          ? 'We’ll email you a 6-digit code'
          : step === 'reset'
            ? `Enter the code sent to ${identifier}`
            : 'Password changed'
      }
    >
      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(255,107,122,0.1)', border: '1px solid rgba(255,107,122,0.3)', color: '#ff6b7a' }}
        >
          {error}
        </div>
      )}

      {step === 'request' && (
        <form onSubmit={requestCode} className="space-y-4">
          <DarkField label="Email or username">
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
            style={{ background: GRADIENT, boxShadow: `0 10px 30px ${PURPLE_DARK}59` }}
          >
            {busy ? 'Sending…' : 'Send reset code'}
          </button>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={submitReset} className="space-y-4">
          <DarkField label="6-digit code">
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
          <DarkField label="New password" hint="At least 6 characters">
            <input
              type="password"
              className={darkInput}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </DarkField>
          <DarkField label="Confirm new password">
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
            style={{ background: GRADIENT, boxShadow: `0 10px 30px ${PURPLE_DARK}59` }}
          >
            {busy ? 'Resetting…' : 'Reset password'}
          </button>
          <button
            type="button"
            onClick={() => setStep('request')}
            className="w-full text-xs font-semibold text-gray-400 hover:text-gray-200"
          >
            Didn't get a code? Try again
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="text-center space-y-4">
          <p className="text-gray-300 text-sm">Your password has been changed. You can sign in now.</p>
          <button
            type="button"
            onClick={() => navigate('/portal/student')}
            className="w-full rounded-full py-3 font-bold text-white transition"
            style={{ background: GRADIENT, boxShadow: `0 10px 30px ${PURPLE_DARK}59` }}
          >
            Back to sign in
          </button>
        </div>
      )}
    </DarkCard>
  );
}
