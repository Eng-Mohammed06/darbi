import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../services/auth.jsx';
import { api } from '../services/api.js';
import { Wisps, DarkField, darkInput, PURPLE, PURPLE_DARK, GOLD, GRADIENT } from '../components/common/ui.jsx';
import { PASSWORD_HINT, passwordIssues } from '../lib/password.js';
import PasswordStrengthMeter from '../components/common/PasswordStrengthMeter.jsx';

const ROLES = [
  { role: 'student', label: 'Student', icon: '🎓' },
  { role: 'career', label: 'Graduate', icon: '📈' },
  { role: 'company', label: 'Company', icon: '🏢' },
];

const COPY = {
  student: { title: 'Student Portal', blurb: 'Find your engineering major' },
  company: { title: 'Company Portal', blurb: 'Find engineering talent' },
  career: { title: 'Career Boost', blurb: 'Advance your engineering career' },
  // Not in ROLES, so no pill for it in the switcher below — reachable only
  // by navigating to /portal/admin directly. No signup either: the single
  // admin account only ever comes from ADMIN_EMAIL/ADMIN_PASSWORD at server
  // boot (server/index.js), so this portal forces login-only mode further down.
  admin: { title: 'Admin', blurb: 'Full platform control' },
};

export default function AuthPage() {
  const { role } = useParams();
  const navigate = useNavigate();
  const { login, signup } = useAuth();

  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(null);

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
    // No self-serve admin signup — see COPY.admin's comment — so landing
    // here always means signing in, never toggled to "Create account".
    if (role === 'admin') setMode('login');
  }, [role]);

  const copy = COPY[role];
  if (!copy) return <p className="p-8">Unknown portal.</p>;
  const isAdmin = role === 'admin';

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (mode === 'signup') {
      const issues = passwordIssues(form.password);
      if (issues.length) {
        setError(`Password needs ${issues.join(', ')}.`);
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        navigate('/');
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
          invalid_credentials: 'That email and password combination is not correct.',
          email_taken: 'An account already exists for that email. Try signing in.',
          username_taken: 'That username is already taken. Try another.',
        }[err.code] ?? err.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex relative overflow-hidden" style={{ background: '#0f172a' }}>
      {/* One background spanning the full width, not one per half — two
          separate Wisps each confined to a half-width panel left a hard
          seam down the middle where neither's blobs reached. */}
      <Wisps palette={[PURPLE, GOLD]} opacity={0.5} fixed />

      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-center px-16">
        <div>
          <h1
            className="text-6xl font-extrabold text-white tracking-tight"
            style={{ textShadow: `0 0 50px ${PURPLE}99` }}
          >
            Darbi
          </h1>
          <p className="text-lg mt-3" style={{ color: '#67e8f9' }}>
            Career Assistant Platform
          </p>
          {stats && (
            <p className="text-gray-400 text-sm mt-6">
              {stats.majors} majors · {stats.courses} verified courses · {stats.jobs} verified job
              listings
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 relative z-10 flex items-center justify-center px-4 py-10">
        <div className="relative z-10 w-full max-w-md">
          <div
            className="rounded-3xl p-8"
            style={{
              background: 'rgba(30,41,59,0.9)',
              border: `1px solid ${PURPLE}40`,
              boxShadow: `0 0 60px ${PURPLE_DARK}26`,
            }}
          >
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white">{copy.title}</h2>
              <p className="text-gray-400 text-sm mt-1">{copy.blurb}</p>
            </div>

            {!isAdmin && (
              <div
                className="flex rounded-full p-1 mb-5"
                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
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
                    <span>{r.icon}</span> {r.label}
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
                    {m === 'login' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div
                className="mb-4 px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(255,107,122,0.1)', border: '1px solid rgba(255,107,122,0.3)', color: '#ff6b7a' }}
              >
                {error}
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              {mode === 'signup' && (
                <DarkField label="Username">
                  <input className={darkInput} value={form.username ?? ''} onChange={set('username')} required />
                </DarkField>
              )}

              <DarkField label={mode === 'login' ? 'Email / Username' : 'Email'}>
                <input
                  type={mode === 'login' ? 'text' : 'email'}
                  className={darkInput}
                  value={form.email ?? ''}
                  onChange={set('email')}
                  required
                />
              </DarkField>

              <DarkField
                label="Password"
                hint={mode === 'signup' ? PASSWORD_HINT : undefined}
                action={
                  mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => navigate('/reset-password')}
                      className="text-xs font-semibold hover:underline"
                      style={{ color: '#67e8f9' }}
                    >
                      Forgot password?
                    </button>
                  )
                }
              >
                <input type="password" className={darkInput} value={form.password ?? ''} onChange={set('password')} required />
                {mode === 'signup' && <PasswordStrengthMeter password={form.password} />}
              </DarkField>

              {mode === 'signup' && role === 'student' && (
                <p className="text-xs text-gray-500 -mt-1">
                  After you verify your email, we'll ask about your level, interests, and location —
                  that's what drives your recommendations.
                </p>
              )}

              {mode === 'signup' && role === 'company' && (
                <DarkField label="Industry">
                  <input className={darkInput} placeholder="Software" value={form.industry ?? ''} onChange={set('industry')} />
                </DarkField>
              )}

              {mode === 'signup' && role === 'career' && (
                <>
                  <DarkField label="Current role">
                    <input className={darkInput} placeholder="Senior Engineer" value={form.currentTitle ?? ''} onChange={set('currentTitle')} />
                  </DarkField>
                  <DarkField label="Years of experience">
                    <input type="number" min="0" className={darkInput} value={form.yearsExperience ?? ''} onChange={set('yearsExperience')} />
                  </DarkField>
                  <DarkField label="Engineering major">
                    <input className={darkInput} placeholder="Computer Engineering" value={form.major ?? ''} onChange={set('major')} />
                  </DarkField>
                </>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full py-3 font-bold text-white transition disabled:opacity-60"
                style={{ background: GRADIENT, boxShadow: `0 10px 30px ${PURPLE_DARK}59` }}
              >
                {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
