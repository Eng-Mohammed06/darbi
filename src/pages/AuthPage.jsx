import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../services/auth.jsx';
import { api } from '../services/api.js';
import { Wisps, DarkField, darkInput, PURPLE, PURPLE_DARK, GOLD, GRADIENT, ThemeLangSwitcher } from '../components/common/ui.jsx';
import { passwordHint, passwordIssues } from '../lib/password.js';
import { useLang } from '../i18n/index.jsx';
import PasswordStrengthMeter from '../components/common/PasswordStrengthMeter.jsx';

const ROLES = [
  { role: 'student', icon: '🎓' },
  { role: 'career', icon: '📈' },
  { role: 'company', icon: '🏢' },
];

export default function AuthPage() {
  const { role } = useParams();
  const navigate = useNavigate();
  const { login, signup, setViewMode } = useAuth();
  const { t, lang } = useLang();

  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(null);
  // Set right after a successful login for a dual-role account (is_admin,
  // but role isn't the pure 'admin' account) — replaces the form with a
  // "which portal?" choice instead of navigating straight away.
  const [choosingPortal, setChoosingPortal] = useState(null);

  useEffect(() => {
    Promise.all([api('/majors', { auth: false }), api('/jobs', { auth: false })])
      .then(([majors, jobs]) =>
        setStats({
          majors: majors.length,
          courses: majors.reduce((n, m) => n + m.course_count, 0),
          jobs: jobs.length,
        }),
      )
      .catch(() => setStats(null));
  }, []);

  // Switching role via the pill switcher shouldn't carry the previous role's
  // form values (e.g. "Industry" typed for Company leaking into Student).
  useEffect(() => {
    setForm({});
    setError('');
    // No self-serve admin signup — see t('auth.portal.admin')'s comment
    // below — so landing here always means signing in, never toggled to
    // "Create account".
    if (role === 'admin') setMode('login');
  }, [role]);

  const roleLabels = { student: t('auth.roleStudent'), career: t('auth.roleGraduate'), company: t('auth.roleCompany') };
  // The single admin account only ever comes from ADMIN_EMAIL/ADMIN_PASSWORD
  // at server boot (server/index.js) — no self-serve admin signup, and no
  // pill for it in the ROLES switcher, reachable only by navigating to
  // /portal/admin directly.
  const portalCopy = t('auth.portal');
  const copy = portalCopy[role];
  if (!copy) return <p className="p-8">{t('auth.unknownPortal')}</p>;
  const isAdmin = role === 'admin';

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (mode === 'signup') {
      const issues = passwordIssues(form.password, lang);
      if (issues.length) {
        setError(t('auth.passwordNeeds')(issues.join(', ')));
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        const loggedInUser = await login(form.email, form.password);
        if (loggedInUser.is_admin && loggedInUser.role !== 'admin') {
          setChoosingPortal(loggedInUser);
        } else {
          navigate('/');
        }
      } else {
        await signup({
          email: form.email,
          username: form.username,
          password: form.password,
          role,
          // Interests drive the recommendation engine, so capture them at signup.
          interests: form.interests
            ? form.interests.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
          gpa: form.gpa ? Number(form.gpa) : null,
          level: form.level || null,
          location: form.location || null,
          industry: form.industry || null,
          currentTitle: form.currentTitle || null,
          yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : null,
          major: form.major || null,
        });
        // Students verify their email, then fill in level/interests/location,
        // then answer the onboarding questionnaire, before landing on their
        // dashboard — see VerifyEmailPage, ProfileSetupPage, OnboardingPage.
        // Other roles have no such flow yet.
        navigate(role === 'student' ? '/verify-email' : '/');
      }
    } catch (err) {
      setError(
        {
          invalid_credentials: t('auth.errInvalidCredentials'),
          email_taken: t('auth.errEmailTaken'),
          username_taken: t('auth.errUsernameTaken'),
        }[err.code] ?? err.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex relative overflow-hidden" style={{ background: 'var(--darbi-bg)' }}>
      {/* One background spanning the full width, not one per half — two
          separate Wisps each confined to a half-width panel left a hard
          seam down the middle where neither's blobs reached. */}
      <Wisps palette={[PURPLE, GOLD]} opacity={0.5} fixed />

      <div className="absolute top-4 end-4 z-20">
        <ThemeLangSwitcher dark />
      </div>

      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-center px-16">
        <div>
          <h1
            className="text-6xl font-extrabold text-white tracking-tight"
            style={{ textShadow: `0 0 50px color-mix(in srgb, ${PURPLE} 60%, transparent)` }}
          >
            Darbi
          </h1>
          <p className="text-lg mt-3" style={{ color: 'var(--darbi-purple)' }}>
            Career Assistant Platform
          </p>
          {stats && (
            <p className="text-gray-400 text-sm mt-6">
              {t('auth.statsLine')(stats.majors, stats.courses, stats.jobs)}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 relative z-10 flex items-center justify-center px-4 py-10">
        <div className="relative z-10 w-full max-w-md">
          <div
            className="rounded-3xl p-8"
            style={{
              background: 'var(--darbi-surface)',
              border: `1px solid color-mix(in srgb, ${PURPLE} 25%, transparent)`,
              boxShadow: `0 0 60px color-mix(in srgb, ${PURPLE_DARK} 15%, transparent)`,
            }}
          >
            {choosingPortal ? (
              <div className="text-center">
                <h2 className="text-xl font-bold text-white mb-1">{t('auth.portalChoiceTitle')}</h2>
                <p className="text-gray-400 text-sm mb-6">{t('auth.portalChoiceBlurb')}</p>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => { setViewMode(null); navigate('/'); }}
                    className="w-full rounded-full py-3 font-bold text-white transition"
                    style={{ background: GRADIENT, boxShadow: `0 10px 30px color-mix(in srgb, ${PURPLE_DARK} 35%, transparent)` }}
                  >
                    {t('auth.continueToPortal')(roleLabels[choosingPortal.role] ?? choosingPortal.role)}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setViewMode('admin'); navigate('/'); }}
                    className="w-full rounded-full py-3 font-bold transition"
                    style={{ border: `1px solid color-mix(in srgb, ${PURPLE} 40%, transparent)`, color: 'var(--darbi-purple)' }}
                  >
                    {t('auth.enterAdminPortal')}
                  </button>
                </div>
              </div>
            ) : (
              <>
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white">{copy.title}</h2>
              <p className="text-gray-400 text-sm mt-1">{copy.blurb}</p>
            </div>

            {!isAdmin && (
              <div
                className="flex rounded-full p-1 mb-5"
                style={{
                  background: 'color-mix(in srgb, var(--darbi-bg) 55%, black 15%)',
                  border: '1px solid color-mix(in srgb, var(--darbi-navy) 10%, transparent)',
                }}
              >
                {ROLES.map((r) => (
                  <button
                    key={r.role}
                    type="button"
                    onClick={() => navigate(`/portal/${r.role}`, { replace: true })}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-semibold transition ${
                      role === r.role ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                    }`}
                    style={role === r.role ? { background: GRADIENT } : undefined}
                  >
                    <span>{r.icon}</span> {roleLabels[r.role]}
                  </button>
                ))}
              </div>
            )}

            {!isAdmin && (
              <div className="flex gap-6 justify-center text-sm mb-6">
                {['login', 'signup'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMode(m); setError(''); }}
                    className={`pb-1 font-semibold transition border-b-2 ${
                      mode === m ? 'text-white' : 'text-gray-500 border-transparent hover:text-gray-300'
                    }`}
                    style={mode === m ? { borderColor: PURPLE } : undefined}
                  >
                    {m === 'login' ? t('auth.signIn') : t('auth.createAccount')}
                  </button>
                ))}
              </div>
            )}

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

            <form onSubmit={submit} className="space-y-4">
              {mode === 'signup' && (
                <DarkField label={t('auth.username')}>
                  <input className={darkInput} value={form.username ?? ''} onChange={set('username')} required />
                </DarkField>
              )}

              <DarkField label={mode === 'login' ? t('auth.emailOrUsername') : t('auth.email')}>
                <input
                  type={mode === 'login' ? 'text' : 'email'}
                  className={darkInput}
                  value={form.email ?? ''}
                  onChange={set('email')}
                  required
                />
              </DarkField>

              <DarkField
                label={t('auth.password')}
                hint={mode === 'signup' ? passwordHint(lang) : undefined}
                action={
                  mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => navigate('/reset-password')}
                      className="text-xs font-semibold hover:underline"
                      style={{ color: 'var(--darbi-purple)' }}
                    >
                      {t('auth.forgotPassword')}
                    </button>
                  )
                }
              >
                <input type="password" className={darkInput} value={form.password ?? ''} onChange={set('password')} required />
                {mode === 'signup' && <PasswordStrengthMeter password={form.password} />}
              </DarkField>

              {mode === 'signup' && role === 'student' && (
                <p className="text-xs text-gray-500 -mt-1">
                  {t('auth.studentSignupNote')}
                </p>
              )}

              {mode === 'signup' && role === 'company' && (
                <DarkField label={t('auth.industry')}>
                  <input className={darkInput} placeholder={t('auth.industryPlaceholder')} value={form.industry ?? ''} onChange={set('industry')} />
                </DarkField>
              )}

              {mode === 'signup' && role === 'career' && (
                <>
                  <DarkField label={t('auth.currentRole')}>
                    <input className={darkInput} placeholder={t('auth.currentRolePlaceholder')} value={form.currentTitle ?? ''} onChange={set('currentTitle')} />
                  </DarkField>
                  <DarkField label={t('auth.yearsExperience')}>
                    <input type="number" min="0" className={darkInput} value={form.yearsExperience ?? ''} onChange={set('yearsExperience')} />
                  </DarkField>
                  <DarkField label={t('auth.engineeringMajor')}>
                    <input className={darkInput} placeholder={t('auth.engineeringMajorPlaceholder')} value={form.major ?? ''} onChange={set('major')} />
                  </DarkField>
                </>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full py-3 font-bold text-white transition disabled:opacity-60"
                style={{ background: GRADIENT, boxShadow: `0 10px 30px color-mix(in srgb, ${PURPLE_DARK} 35%, transparent)` }}
              >
                {busy ? t('auth.working') : mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}
              </button>
            </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
