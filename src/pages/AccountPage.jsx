import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../services/auth.jsx';
import { Alert, Button, Card, Field, inputClass, Wisps } from '../components/common/ui.jsx';

export default function AccountPage() {
  const { user, profile, logout } = useAuth();

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--darbi-bg)' }}>
      <Wisps palette={['#a855f7', '#d4af37']} opacity={0.28} fixed />

      <header
        className="text-white relative z-10"
        style={{ background: 'rgba(10,6,16,0.85)', borderBottom: '1px solid var(--darbi-border)' }}
      >
        <div className="darbi-container py-5 flex items-center gap-4">
          <Link to="/" className="text-gray-300 hover:text-white text-sm font-semibold shrink-0 transition">← Back</Link>
          <h1 className="text-2xl font-bold flex-1">Account</h1>
        </div>
      </header>

      <main className="darbi-container py-8 relative z-10">
        <Card title="Your details" accent={false}>
          <Detail label="Name" value={profile?.name} />
          <Detail label="Username" value={user?.username} />
          <Detail label="Email" value={user?.email} />
        </Card>

        <ChangeName />
        <ChangeUsername />
        <ChangePassword />

        <div className="flex justify-end">
          <button onClick={logout} className="darbi-btn text-sm">
            Sign out
          </button>
        </div>
      </main>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="mb-4 last:mb-0">
      <span className="block text-darbi-navy font-bold mb-1 text-sm">{label}</span>
      <span className="text-gray-300">{value ?? '—'}</span>
    </div>
  );
}

const NAME_ENDPOINT = { student: '/students/me', company: '/companies/me', career: '/career/me' };

/**
 * Signup no longer collects a separate display name (it defaults to the
 * username — see server/routes/auth.js), so this is where a user sets a
 * real one afterward. Each role's name lives on a different table, hence
 * the per-role endpoint.
 */
function ChangeName() {
  const { user, profile, setProfile } = useAuth();
  const [name, setName] = useState(profile?.name ?? '');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setStatus('');
    setBusy(true);
    try {
      const updated = await api(NAME_ENDPOINT[user.role], { method: 'PUT', body: { name } });
      setProfile(updated);
      setStatus('Name changed.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Change name">
      <Alert>{error}</Alert>
      {status && <p className="text-green-400 mb-4">{status}</p>}
      <form onSubmit={submit}>
        <Field label="Name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Change name'}
        </Button>
      </form>
    </Card>
  );
}

function ChangeUsername() {
  const { user, setUser } = useAuth();
  const [username, setUsername] = useState(user?.username ?? '');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setStatus('');
    setBusy(true);
    try {
      const { user: updated } = await api('/auth/username', {
        method: 'PUT',
        body: { username },
      });
      setUser(updated);
      setStatus('Username changed.');
    } catch (err) {
      setError(
        {
          username_taken: 'That username is already taken. Try another.',
        }[err.code] ?? err.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Change username">
      <Alert>{error}</Alert>
      {status && <p className="text-green-400 mb-4">{status}</p>}
      <form onSubmit={submit}>
        <Field label="Username">
          <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} required />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Change username'}
        </Button>
      </form>
    </Card>
  );
}

function ChangePassword() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setStatus('');

    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setBusy(true);
    try {
      await api('/auth/password', {
        method: 'PUT',
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      });
      setStatus('Password changed.');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(
        {
          invalid_credentials: 'Current password is not correct.',
          weak_password: 'New password must be at least 6 characters.',
        }[err.code] ?? err.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Change password">
      <Alert>{error}</Alert>
      {status && <p className="text-green-400 mb-4">{status}</p>}
      <form onSubmit={submit}>
        <Field label="Current password">
          <input type="password" className={inputClass} value={form.currentPassword} onChange={set('currentPassword')} required />
        </Field>
        <Field label="New password" hint="At least 6 characters">
          <input type="password" className={inputClass} value={form.newPassword} onChange={set('newPassword')} required />
        </Field>
        <Field label="Confirm new password">
          <input type="password" className={inputClass} value={form.confirmPassword} onChange={set('confirmPassword')} required />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Change password'}
        </Button>
      </form>
    </Card>
  );
}
