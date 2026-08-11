import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../services/auth.jsx';
import { Alert, Button, Field, inputClass } from '../components/common/ui.jsx';

const COPY = {
  student: { icon: '👨‍🎓', title: 'Student Portal', blurb: 'Find your engineering major' },
  company: { icon: '🏢', title: 'Company Portal', blurb: 'Find engineering talent' },
  career: { icon: '📈', title: 'Career Boost', blurb: 'Advance your engineering career' },
};

export default function AuthPage() {
  const { role } = useParams();
  const navigate = useNavigate();
  const { login, signup } = useAuth();

  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
        navigate('/dashboard');
      } else {
        await signup({
          email: form.email,
          password: form.password,
          role,
          name: form.name,
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
        navigate(role === 'student' ? '/onboarding' : '/dashboard');
      }
    } catch (err) {
      setError(
        {
          invalid_credentials: 'That email and password combination is not correct.',
          email_taken: 'An account already exists for that email. Try signing in.',
          weak_password: 'Password must be at least 6 characters.',
        }[err.code] ?? err.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: 'linear-gradient(135deg, #001a33 0%, #0a2647 100%)' }}
    >
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <Link to="/" className="text-darbi-navy font-semibold text-sm">
          ← Back
        </Link>

        <div className="text-center my-5">
          <div className="text-4xl mb-2">{copy.icon}</div>
          <h1 className="text-2xl font-bold text-darbi-navy">{copy.title}</h1>
          <p className="text-gray-600 text-sm mt-1">{copy.blurb}</p>
        </div>

        <div className="flex gap-2 mb-6">
          {['login', 'signup'].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2 rounded-lg font-bold text-sm ${
                mode === m ? 'text-darbi-navy' : 'bg-gray-100 text-gray-600'
              }`}
              style={mode === m ? { backgroundColor: '#d4af37' } : undefined}
            >
              {m === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <Alert>{error}</Alert>

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <Field label={role === 'company' ? 'Company name' : 'Full name'}>
              <input className={inputClass} value={form.name ?? ''} onChange={set('name')} required />
            </Field>
          )}

          <Field label="Email">
            <input type="email" className={inputClass} value={form.email ?? ''} onChange={set('email')} required />
          </Field>

          <Field label="Password" hint={mode === 'signup' ? 'At least 6 characters' : undefined}>
            <input type="password" className={inputClass} value={form.password ?? ''} onChange={set('password')} required />
          </Field>

          {mode === 'signup' && role === 'student' && (
            <>
              <Field label="Level">
                <select className={inputClass} value={form.level ?? ''} onChange={set('level')}>
                  <option value="">Select…</option>
                  <option value="highschool">High school</option>
                  <option value="undergraduate">Undergraduate</option>
                  <option value="graduate">Graduate</option>
                </select>
              </Field>
              <Field label="Interests" hint="Comma separated — these drive your recommendations">
                <input className={inputClass} placeholder="Cybersecurity, Data Science" value={form.interests ?? ''} onChange={set('interests')} />
              </Field>
              <Field label="GPA" hint="Out of 4">
                <input type="number" step="0.01" min="0" max="4" className={inputClass} value={form.gpa ?? ''} onChange={set('gpa')} />
              </Field>
              <Field label="Location">
                <input className={inputClass} placeholder="Amman" value={form.location ?? ''} onChange={set('location')} />
              </Field>
            </>
          )}

          {mode === 'signup' && role === 'company' && (
            <Field label="Industry">
              <input className={inputClass} placeholder="Software" value={form.industry ?? ''} onChange={set('industry')} />
            </Field>
          )}

          {mode === 'signup' && role === 'career' && (
            <>
              <Field label="Current role">
                <input className={inputClass} placeholder="Senior Engineer" value={form.currentTitle ?? ''} onChange={set('currentTitle')} />
              </Field>
              <Field label="Years of experience">
                <input type="number" min="0" className={inputClass} value={form.yearsExperience ?? ''} onChange={set('yearsExperience')} />
              </Field>
              <Field label="Engineering major">
                <input className={inputClass} placeholder="Computer Engineering" value={form.major ?? ''} onChange={set('major')} />
              </Field>
            </>
          )}

          <Button type="submit" disabled={busy}>
            {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        {mode === 'login' && (
          <p className="text-xs text-gray-500 mt-5 text-center">
            Demo account: <code>{role}@darbi.jo</code> / <code>darbi2026</code>
          </p>
        )}
      </div>
    </div>
  );
}
