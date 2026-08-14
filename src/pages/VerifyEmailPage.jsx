import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth.jsx';
import { Alert, Button, CenteredCard } from '../components/common/ui.jsx';

/**
 * First stop after signup, before ProfileSetupPage and OnboardingPage.
 * Verification still never gates login server-side (server/routes/auth.js) —
 * "Skip for now" exists so a slow or undelivered email can't strand a new
 * account mid-flow, matching that same soft-gate philosophy.
 */
export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const { user, setUser, verifyEmail, resendVerification } = useAuth();

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const updated = await verifyEmail(code);
      setUser(updated);
      navigate('/profile-setup');
    } catch (err) {
      setError(
        {
          invalid_code: 'That code is not correct.',
          code_expired: 'That code expired — send a new one.',
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
      setStatus('New code sent — check your email.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <CenteredCard>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--darbi-gold)' }}>
        Step 1 of 3
      </p>
      <h1 className="text-lg font-bold text-darbi-navy mt-2 mb-2">Verify your email</h1>
      <p className="text-sm text-gray-400 mb-5">
        We sent a 6-digit code to <span className="text-white font-semibold">{user?.email}</span>.
      </p>

      <Alert>{error}</Alert>
      {status && <p className="text-sm text-green-400 mb-4">{status}</p>}

      <form onSubmit={submit} className="space-y-4 text-left">
        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            6-digit code
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
            {busy ? 'Checking…' : 'Verify'}
          </Button>
        </div>
      </form>

      <button
        type="button"
        onClick={resend}
        disabled={busy}
        className="text-xs text-gray-500 mt-5 underline block mx-auto"
      >
        Resend code
      </button>
      <button
        type="button"
        onClick={() => navigate('/profile-setup')}
        disabled={busy}
        className="text-xs text-gray-500 mt-3 underline block mx-auto"
      >
        Skip for now
      </button>
    </CenteredCard>
  );
}
