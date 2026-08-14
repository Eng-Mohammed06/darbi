import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../services/auth.jsx';
import { Alert, Button, Card, Field, inputClass, Wisps } from '../components/common/ui.jsx';
import { useToast } from '../components/common/toast.jsx';
import { PASSWORD_HINT, passwordIssues } from '../lib/password.js';
import { readAvatarFile } from '../lib/avatar.js';
import AvatarCropModal from '../components/common/AvatarCropModal.jsx';
import PasswordStrengthMeter from '../components/common/PasswordStrengthMeter.jsx';

const TABS = ['profile', 'security'];
const TAB_LABEL = { profile: 'Profile', security: 'Security' };

/**
 * Settings page, not a scroll of five always-open forms — a profile summary
 * up top, two tabs underneath, and every field starts read-only with an
 * "Edit" click to open it (EditableRow) rather than a form nobody asked for
 * taking up space by default.
 */
export default function AccountPage() {
  const { logout } = useAuth();
  const [tab, setTab] = useState('profile');

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--darbi-bg)' }}>
      <Wisps palette={['#06b6d4', '#ff5722']} opacity={0.28} fixed />

      <header
        className="text-white relative z-10"
        style={{ background: 'rgba(15,23,42,0.85)', borderBottom: '1px solid var(--darbi-border)' }}
      >
        <div className="darbi-container py-5 flex items-center gap-4">
          <Link to="/" className="text-gray-300 hover:text-white text-sm font-semibold shrink-0 transition">← Back</Link>
          <h1 className="text-2xl font-bold flex-1">Account</h1>
        </div>
      </header>

      <main className="darbi-container py-8 relative z-10">
        <div className="max-w-xl mx-auto">
          <ProfileSummary />

          <div className="flex gap-2 mb-4">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`text-sm px-4 py-2 rounded-full font-bold transition ${
                  tab === t ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                style={tab === t ? { background: 'var(--darbi-gradient)' } : { border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>

          {tab === 'profile' && <ProfileTab />}
          {tab === 'security' && <SecurityTab />}

          <div className="flex justify-end mt-6">
            <button onClick={logout} className="text-sm text-gray-500 hover:text-red-400 transition">
              Sign out
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function ProfileSummary() {
  const { user, profile } = useAuth();
  return (
    <div className="darbi-box flex items-center gap-5 flex-wrap mb-6">
      <AvatarEditor />
      <div className="flex-1 min-w-[180px]">
        <h2 className="text-xl font-bold text-white">{profile?.name || user?.username}</h2>
        <p className="text-sm text-gray-400">{user?.email}</p>
        {user?.role && (
          <span
            className="inline-block mt-2 text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(6,182,212,0.15)', color: 'var(--darbi-purple)', border: '1px solid rgba(6,182,212,0.3)' }}
          >
            {user.role}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Avatar plus a small corner button to change it — replaces the old
 * always-visible "Upload photo" / "Remove photo" text controls, which took
 * as much visual weight as the picture itself. PNG/JPEG only, shown
 * circular; picking a file opens AvatarCropModal so the user chooses what
 * part of the photo shows before it's ever uploaded. server/routes/auth.js
 * re-checks type and a 2MB size cap on the way in, since the client-side
 * check (src/lib/avatar.js) is skippable.
 */
function AvatarEditor() {
  const { user, uploadAvatar, removeAvatar } = useAuth();
  const inputRef = useRef(null);
  const [cropSrc, setCropSrc] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function onFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      const dataUri = await readAvatarFile(file);
      setCropSrc(dataUri);
    } catch (err) {
      setError(err.message);
    }
  }

  async function onCropConfirm(croppedDataUri) {
    setCropSrc(null);
    setBusy(true);
    try {
      await uploadAvatar(croppedDataUri);
      toast.show('Profile picture updated.', { kind: 'success' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setError('');
    setBusy(true);
    try {
      await removeAvatar();
      toast.show('Profile picture removed.', { kind: 'success' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0">
      <div className="relative w-20 h-20">
        <div
          className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-2xl font-bold text-white"
          style={{ background: 'var(--darbi-gradient)' }}
        >
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span aria-hidden="true">{(user?.username ?? '?')[0].toUpperCase()}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={user?.avatar ? 'Change photo' : 'Upload photo'}
          className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-xs transition hover:brightness-110"
          style={{ background: 'var(--darbi-surface-solid)', border: '2px solid var(--darbi-bg)' }}
        >
          📷
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".png,.jpg,.jpeg,image/png,image/jpeg"
          className="hidden"
          onChange={onFileChange}
        />
      </div>
      {user?.avatar && (
        <button type="button" onClick={onRemove} disabled={busy} className="text-xs text-gray-500 underline mt-1.5 block">
          Remove
        </button>
      )}
      {error && <p className="text-xs mt-1.5 max-w-[9rem]" style={{ color: 'var(--darbi-error)' }}>{error}</p>}

      {cropSrc && (
        <AvatarCropModal src={cropSrc} onCancel={() => setCropSrc(null)} onConfirm={onCropConfirm} />
      )}
    </div>
  );
}

const NAME_ENDPOINT = { student: '/students/me', company: '/companies/me', career: '/career/me' };

function ProfileTab() {
  const { user, profile, setProfile, setUser } = useAuth();

  async function saveName(name) {
    const updated = await api(NAME_ENDPOINT[user.role], { method: 'PUT', body: { name } });
    setProfile(updated);
  }

  async function saveUsername(username) {
    try {
      const { user: updated } = await api('/auth/username', { method: 'PUT', body: { username } });
      setUser(updated);
    } catch (err) {
      throw new Error(err.code === 'username_taken' ? 'That username is already taken. Try another.' : err.message);
    }
  }

  return (
    <Card accent={false}>
      <EditableRow label="Name" value={profile?.name} onSave={saveName} successMessage="Name changed." />
      <EditableRow label="Username" value={user?.username} onSave={saveUsername} successMessage="Username changed." />
      <div className="py-4">
        <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Email</span>
        <span className="text-white">{user?.email}</span>
      </div>
    </Card>
  );
}

function SecurityTab() {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function cancel() {
    setEditing(false);
    setError('');
    setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  }

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (form.newPassword === form.currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }
    const issues = passwordIssues(form.newPassword);
    if (issues.length) {
      setError(`Password needs ${issues.join(', ')}.`);
      return;
    }

    setBusy(true);
    try {
      await api('/auth/password', {
        method: 'PUT',
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      });
      toast.show('Password changed.', { kind: 'success' });
      cancel();
    } catch (err) {
      setError(
        {
          invalid_credentials: 'Current password is not correct.',
        }[err.code] ?? err.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card accent={false}>
      {!editing ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Password</span>
            <span className="text-white tracking-widest">••••••••</span>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-bold shrink-0"
            style={{ color: 'var(--darbi-purple)' }}
          >
            Change
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <Alert>{error}</Alert>
          <Field label="Current password">
            <input
              type="password"
              className={inputClass}
              value={form.currentPassword}
              onChange={set('currentPassword')}
              autoFocus
              required
            />
          </Field>
          <Field label="New password" hint={PASSWORD_HINT}>
            <input type="password" className={inputClass} value={form.newPassword} onChange={set('newPassword')} required />
            <PasswordStrengthMeter password={form.newPassword} />
          </Field>
          <Field label="Confirm new password">
            <input type="password" className={inputClass} value={form.confirmPassword} onChange={set('confirmPassword')} required />
          </Field>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save password'}
            </Button>
            <button type="button" onClick={cancel} disabled={busy} className="text-xs text-gray-400 hover:text-gray-200">
              Cancel
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}

/**
 * A field that starts as plain read-only text with an "Edit" click to open
 * it, instead of a form that's always sitting open — click to reveal,
 * Save/Cancel to close it back up.
 */
function EditableRow({ label, value, onSave, successMessage }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  function startEdit() {
    setDraft(value ?? '');
    setError('');
    setEditing(true);
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onSave(draft);
      if (successMessage) toast.show(successMessage, { kind: 'success' });
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="py-4 border-b last:border-0" style={{ borderColor: 'var(--darbi-border)' }}>
      {!editing ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">{label}</span>
            <span className="text-white">{value || <span className="text-gray-500 italic">Not set</span>}</span>
          </div>
          <button type="button" onClick={startEdit} className="text-xs font-bold shrink-0" style={{ color: 'var(--darbi-purple)' }}>
            Edit
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <Alert>{error}</Alert>
          <Field label={label}>
            <input className={inputClass} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus required />
          </Field>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError(''); }}
              disabled={busy}
              className="text-xs text-gray-400 hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
