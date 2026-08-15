import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../services/auth.jsx';
import { Alert, Button, Card, Field, inputClass, Wisps, PURPLE, GOLD, ThemeLangSwitcher, PhotoViewModal } from '../components/common/ui.jsx';
import { useToast } from '../components/common/toast.jsx';
import { passwordHint, passwordIssues } from '../lib/password.js';
import { readAvatarFile } from '../lib/avatar.js';
import AvatarCropModal from '../components/common/AvatarCropModal.jsx';
import PasswordStrengthMeter from '../components/common/PasswordStrengthMeter.jsx';
import { useLang } from '../i18n/index.jsx';

const TABS = ['profile', 'security'];

/**
 * Settings page, not a scroll of five always-open forms — a profile summary
 * up top, two tabs underneath, and every field starts read-only with an
 * "Edit" click to open it (EditableRow) rather than a form nobody asked for
 * taking up space by default.
 */
export default function AccountPage() {
  const { logout } = useAuth();
  const { t } = useLang();
  const [tab, setTab] = useState('profile');
  const tabLabel = { profile: t('account.tabProfile'), security: t('account.tabSecurity') };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--darbi-bg)' }}>
      <Wisps palette={[PURPLE, GOLD]} opacity={0.28} fixed />

      <header
        className="text-white relative z-10"
        style={{ background: 'color-mix(in srgb, var(--darbi-bg) 85%, transparent)', borderBottom: '1px solid var(--darbi-border)' }}
      >
        <div className="darbi-container py-5 flex items-center gap-4">
          <Link to="/" className="text-gray-300 hover:text-white text-sm font-semibold shrink-0 transition">{t('account.back')}</Link>
          <h1 className="text-2xl font-bold flex-1">{t('account.title')}</h1>
          <ThemeLangSwitcher dark />
        </div>
      </header>

      <main className="darbi-container py-8 relative z-10">
        <div className="max-w-xl mx-auto">
          <ProfileSummary />

          <div className="flex gap-2 mb-4">
            {TABS.map((tabId) => (
              <button
                key={tabId}
                type="button"
                onClick={() => setTab(tabId)}
                className={`text-sm px-4 py-2 rounded-full font-bold transition ${
                  tab === tabId ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                style={tab === tabId ? { background: 'var(--darbi-gradient)' } : { border: '1px solid color-mix(in srgb, var(--darbi-navy) 15%, transparent)' }}
              >
                {tabLabel[tabId]}
              </button>
            ))}
          </div>

          {tab === 'profile' && <ProfileTab />}
          {tab === 'security' && <SecurityTab />}

          <div className="flex justify-end mt-6">
            <button onClick={logout} className="text-sm text-gray-500 hover:text-red-400 transition">
              {t('account.signOut')}
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
            style={{
              background: 'color-mix(in srgb, var(--darbi-purple) 15%, transparent)',
              color: 'var(--darbi-purple)',
              border: '1px solid color-mix(in srgb, var(--darbi-purple) 30%, transparent)',
            }}
          >
            {user.role}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Avatar as a single click target — clicking a photo that's already set
 * opens a small action menu (View / Change / Remove) instead of separate
 * always-visible controls; clicking the empty placeholder (no photo yet)
 * jumps straight to the file picker, since there's nothing to view or
 * remove. PNG/JPEG only; picking a file opens AvatarCropModal so the user
 * chooses what part of the photo shows before it's ever uploaded.
 * server/routes/auth.js re-checks type and a 2MB size cap on the way in,
 * since the client-side check (src/lib/avatar.js) is skippable.
 */
function AvatarEditor() {
  const { user, uploadAvatar, removeAvatar } = useAuth();
  const { t, lang } = useLang();
  const inputRef = useRef(null);
  const [cropSrc, setCropSrc] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewing, setViewing] = useState(false);
  const toast = useToast();

  function onAvatarClick() {
    if (user?.avatar) setMenuOpen(true);
    else inputRef.current?.click();
  }

  async function onFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      const dataUri = await readAvatarFile(file, lang);
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
      toast.show(t('account.photoUpdated'), { kind: 'success' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setMenuOpen(false);
    setError('');
    setBusy(true);
    try {
      await removeAvatar();
      toast.show(t('account.photoRemoved'), { kind: 'success' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0">
      <button
        type="button"
        onClick={onAvatarClick}
        disabled={busy}
        aria-label={user?.avatar ? t('account.changePhoto') : t('account.uploadPhoto')}
        className="relative w-20 h-20 rounded-full group"
      >
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
        <span
          className="absolute inset-0 rounded-full flex items-center justify-center text-lg opacity-0 group-hover:opacity-100 transition"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          aria-hidden="true"
        >
          📷
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
        className="hidden"
        onChange={onFileChange}
      />
      {error && <p className="text-xs mt-1.5 max-w-[9rem]" style={{ color: 'var(--darbi-error)' }}>{error}</p>}

      {menuOpen && (
        <AvatarActionMenu
          onView={() => { setMenuOpen(false); setViewing(true); }}
          onChange={() => { setMenuOpen(false); inputRef.current?.click(); }}
          onRemove={onRemove}
          onClose={() => setMenuOpen(false)}
        />
      )}
      {viewing && <PhotoViewModal src={user.avatar} onClose={() => setViewing(false)} />}
      {cropSrc && (
        <AvatarCropModal src={cropSrc} onCancel={() => setCropSrc(null)} onConfirm={onCropConfirm} />
      )}
    </div>
  );
}

/** Small action sheet shown when clicking an existing profile photo. */
function AvatarActionMenu({ onView, onChange, onRemove, onClose }) {
  const { t } = useLang();
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div
        className="w-full max-w-xs overflow-hidden"
        style={{ background: 'var(--darbi-surface-solid)', border: '1px solid var(--darbi-border)', borderRadius: 'var(--darbi-radius)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onView} className="w-full text-start px-5 py-3.5 text-sm text-white hover:bg-white/5 transition block">
          {t('account.viewPhoto')}
        </button>
        <div style={{ borderTop: '1px solid var(--darbi-border)' }} />
        <button type="button" onClick={onChange} className="w-full text-start px-5 py-3.5 text-sm text-white hover:bg-white/5 transition block">
          {t('account.changePhoto')}
        </button>
        <div style={{ borderTop: '1px solid var(--darbi-border)' }} />
        <button type="button" onClick={onRemove} className="w-full text-start px-5 py-3.5 text-sm hover:bg-white/5 transition block" style={{ color: 'var(--darbi-error)' }}>
          {t('account.removePhoto')}
        </button>
        <div style={{ borderTop: '1px solid var(--darbi-border)' }} />
        <button type="button" onClick={onClose} className="w-full text-start px-5 py-3.5 text-sm text-gray-400 hover:bg-white/5 transition block">
          {t('account.cancel')}
        </button>
      </div>
    </div>
  );
}

const NAME_ENDPOINT = { student: '/students/me', company: '/companies/me', career: '/career/me', admin: '/auth/name' };

function ProfileTab() {
  const { user, profile, setProfile, setUser } = useAuth();
  const { t } = useLang();

  async function saveName(name) {
    const updated = await api(NAME_ENDPOINT[user.role], { method: 'PUT', body: { name } });
    setProfile(updated);
  }

  async function saveUsername(username) {
    try {
      const { user: updated } = await api('/auth/username', { method: 'PUT', body: { username } });
      setUser(updated);
    } catch (err) {
      throw new Error(err.code === 'username_taken' ? t('account.usernameTaken') : err.message);
    }
  }

  return (
    <Card accent={false}>
      <EditableRow label={t('account.name')} value={profile?.name} onSave={saveName} successMessage={t('account.nameChanged')} />
      <EditableRow label={t('account.username')} value={user?.username} onSave={saveUsername} successMessage={t('account.usernameChanged')} />
      <div className="py-4">
        <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">{t('account.email')}</span>
        <span className="text-white">{user?.email}</span>
      </div>
    </Card>
  );
}

function SecurityTab() {
  const { t, lang } = useLang();
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
      setError(t('account.errPasswordMismatch'));
      return;
    }
    if (form.newPassword === form.currentPassword) {
      setError(t('account.errSamePassword'));
      return;
    }
    const issues = passwordIssues(form.newPassword, lang);
    if (issues.length) {
      setError(t('account.passwordNeeds')(issues.join(', ')));
      return;
    }

    setBusy(true);
    try {
      await api('/auth/password', {
        method: 'PUT',
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      });
      toast.show(t('account.passwordChanged'), { kind: 'success' });
      cancel();
    } catch (err) {
      setError(
        {
          invalid_credentials: t('account.errCurrentPasswordWrong'),
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
            <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">{t('account.password')}</span>
            <span className="text-white tracking-widest">••••••••</span>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-bold shrink-0"
            style={{ color: 'var(--darbi-purple)' }}
          >
            {t('account.change')}
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <Alert>{error}</Alert>
          <Field label={t('account.currentPassword')}>
            <input
              type="password"
              className={inputClass}
              value={form.currentPassword}
              onChange={set('currentPassword')}
              autoFocus
              required
            />
          </Field>
          <Field label={t('account.newPassword')} hint={passwordHint(lang)}>
            <input type="password" className={inputClass} value={form.newPassword} onChange={set('newPassword')} required />
            <PasswordStrengthMeter password={form.newPassword} />
          </Field>
          <Field label={t('account.confirmNewPassword')}>
            <input type="password" className={inputClass} value={form.confirmPassword} onChange={set('confirmPassword')} required />
          </Field>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? t('account.saving') : t('account.savePassword')}
            </Button>
            <button type="button" onClick={cancel} disabled={busy} className="text-xs text-gray-400 hover:text-gray-200">
              {t('account.cancel')}
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
  const { t } = useLang();
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
            <span className="text-white">{value || <span className="text-gray-500 italic">{t('account.notSet')}</span>}</span>
          </div>
          <button type="button" onClick={startEdit} className="text-xs font-bold shrink-0" style={{ color: 'var(--darbi-purple)' }}>
            {t('account.edit')}
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
              {busy ? t('account.saving') : t('account.save')}
            </Button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError(''); }}
              disabled={busy}
              className="text-xs text-gray-400 hover:text-gray-200"
            >
              {t('account.cancel')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
