import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../services/auth.jsx';
import { api } from '../services/api.js';
import { Wisps } from '../components/common/ui.jsx';

const PURPLE = '#a855f7';
const PURPLE_DARK = '#7c3aed';
const GOLD = '#d4af37';
const GRADIENT = 'linear-gradient(90deg,#9333ea,#c026d3)';

const ROLES = [
  { role: 'student', label: 'Student', icon: '🎓' },
  { role: 'career', label: 'Graduate', icon: '📈' },
  { role: 'company', label: 'Company', icon: '🏢' },
];

const COPY = {
  student: { title: 'Student Portal', blurb: 'Find your engineering major' },
  company: { title: 'Company Portal', blurb: 'Find engineering talent' },
  career: { title: 'Career Boost', blurb: 'Advance your engineering career' },
};

const darkInput =
  'darbi-dark-input w-full rounded-full bg-black/40 border border-white/10 text-white placeholder-gray-500 ' +
  'px-5 py-3 text-sm focus:outline-none focus:border-purple-400 transition';

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
  }, [role]);

  const copy = COPY[role];
  if (!copy) return <p className="p-8">Unknown portal.</p>;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
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
        // Students answer the onboarding questionnaire before landing on their
        // dashboard, so the chat advisor has something to ground its first
        // reply in. Other roles have no such flow yet.
        navigate(role === 'student' ? '/onboarding' : '/');
      }
    } catch (err) {
      setError(
        {
          invalid_credentials: 'That email and password combination is not correct.',
          email_taken: 'An account already exists for that email. Try signing in.',
          username_taken: 'That username is already taken. Try another.',
          weak_password: 'Password must be at least 6 characters.',
        }[err.code] ?? err.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#05020a' }}>
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-center px-16">
        <Wisps palette={[PURPLE, PURPLE_DARK]} opacity={0.65} />
        <div className="relative z-10">
          <h1
            className="text-6xl font-extrabold text-white tracking-tight"
            style={{ textShadow: `0 0 50px ${PURPLE}99` }}
          >
            Darbi
          </h1>
          <p className="text-lg mt-3" style={{ color: '#c084fc' }}>
            Career advisory platform
          </p>
          {stats && (
            <p className="text-gray-400 text-sm mt-6">
              {stats.majors} majors · {stats.courses} verified courses · {stats.jobs} verified job
              listings
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden flex items-center justify-center px-4 py-10">
        <Wisps palette={[PURPLE, GOLD]} opacity={0.45} />

        <div className="relative z-10 w-full max-w-md">
          <div
            className="rounded-3xl p-8"
            style={{
              background: 'rgba(15,10,22,0.9)',
              border: `1px solid ${PURPLE}40`,
              boxShadow: `0 0 60px ${PURPLE_DARK}26`,
            }}
          >
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white">{copy.title}</h2>
              <p className="text-gray-400 text-sm mt-1">{copy.blurb}</p>
            </div>

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

            {error && (
              <div
                className="mb-4 px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}
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
                hint={mode === 'signup' ? 'At least 6 characters' : undefined}
                action={
                  mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setError("Password reset isn't available yet — contact your admin.")}
                      className="text-xs font-semibold hover:underline"
                      style={{ color: '#c084fc' }}
                    >
                      Forgot password?
                    </button>
                  )
                }
              >
                <input type="password" className={darkInput} value={form.password ?? ''} onChange={set('password')} required />
              </DarkField>

              {mode === 'signup' && role === 'student' && (
                <>
                  <DarkField label="Level">
                    <select className={darkInput} value={form.level ?? ''} onChange={set('level')}>
                      <option value="">Select…</option>
                      <option value="highschool">High school</option>
                      <option value="undergraduate">Undergraduate</option>
                      <option value="graduate">Graduate</option>
                    </select>
                  </DarkField>
                  <DarkField label="Interests" hint="Comma separated — these drive your recommendations">
                    <input className={darkInput} placeholder="Cybersecurity, Data Science" value={form.interests ?? ''} onChange={set('interests')} />
                  </DarkField>
                  <div
                    className="overflow-hidden transition-all duration-300 ease-in-out"
                    style={{
                      maxHeight: form.level ? '96px' : '0px',
                      opacity: form.level ? 1 : 0,
                      marginTop: form.level ? '1rem' : '0px',
                    }}
                  >
                    <DarkField
                      label={form.level === 'highschool' ? 'Average' : 'GPA'}
                      hint={form.level === 'highschool' ? 'Tawjihi average, out of 100' : 'Out of 4'}
                    >
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={form.level === 'highschool' ? 100 : 4}
                        className={darkInput}
                        value={form.gpa ?? ''}
                        onChange={set('gpa')}
                      />
                    </DarkField>
                  </div>
                  <DarkField label="Location">
                    <input className={darkInput} placeholder="Amman" value={form.location ?? ''} onChange={set('location')} />
                  </DarkField>
                </>
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

function DarkField({ label, hint, action, children }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between mb-1.5">
        <span className="text-gray-300 font-semibold text-xs uppercase tracking-wide">{label}</span>
        {action}
      </span>
      {children}
      {hint && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
    </label>
  );
}
