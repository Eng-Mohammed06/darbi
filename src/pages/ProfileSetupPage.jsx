import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../services/auth.jsx';
import { Alert, Button, CenteredCard } from '../components/common/ui.jsx';

/**
 * Common interests among Jordanian engineering students, spanning both
 * tech-track and traditional-engineering tracks since DARBI covers all 10
 * majors, not just CS. A fixed list (rather than free text) gives the
 * onboarding-analysis prompt (server/lib/onboarding.js) and the
 * recommendation engine consistent, comparable signal across students.
 */
const INTEREST_OPTIONS = [
  'Software Development',
  'Web Development',
  'Mobile App Development',
  'Artificial Intelligence & Machine Learning',
  'Data Science & Analytics',
  'Cybersecurity',
  'Cloud Computing',
  'Computer Networks',
  'Game Development',
  'UI/UX Design',
  'Robotics',
  'Embedded Systems & IoT',
  'Electronics',
  'Telecommunications',
  'Renewable Energy',
  'Power & Energy Systems',
  'Mechanical Design',
  'Automotive Engineering',
  'Aerospace Engineering',
  'Civil & Structural Engineering',
  'Construction & Project Management',
  'Architecture & Urban Planning',
  'Biomedical Engineering',
  'Chemical Engineering',
  'Environmental Engineering',
  'Industrial & Manufacturing Engineering',
  'Materials Science',
  '3D Printing & Prototyping',
  'Entrepreneurship & Startups',
  'Finance & FinTech',
  'Research & Academia',
  'Mathematics',
];

/**
 * Step 2 of the post-signup sequence — level, interests, and location used
 * to live on the signup form itself, but that pushed create-account behind
 * a wall of fields most people weren't ready to answer yet. Asking here,
 * right after verification, keeps signup to three fields while still
 * collecting everything the recommendation engine needs before Onboarding.
 *
 * No "Graduate" level option: a signed-up student who has already graduated
 * belongs in the separate Career/Graduate portal (/portal/career), not here.
 */
export default function ProfileSetupPage() {
  const navigate = useNavigate();
  const { setProfile } = useAuth();

  const [level, setLevel] = useState('');
  const [average, setAverage] = useState('');
  const [interests, setInterests] = useState([]);
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function addInterest(value) {
    if (value && !interests.includes(value)) setInterests([...interests, value]);
  }

  function removeInterest(value) {
    setInterests(interests.filter((i) => i !== value));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const value = average === '' ? null : Number(average);
      const profile = await api('/students/me', {
        method: 'PUT',
        body: {
          level: level || null,
          interests,
          location: location || null,
          // Only the column matching `level` actually gets written server-side
          // (server/routes/students.js) — sending both is harmless.
          gpa: value,
          tawjihiAverage: value,
        },
      });
      setProfile(profile);
      navigate('/onboarding');
    } catch (err) {
      setError(err.message ?? 'Could not save your profile. You can try again, or skip for now.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <CenteredCard>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--darbi-gold)' }}>
        Step 2 of 3
      </p>
      <h1 className="text-lg font-bold text-darbi-navy mt-2 mb-2">Tell us about you</h1>
      <p className="text-sm text-gray-400 mb-5">
        This drives your recommendations — you can always change it later from your profile.
      </p>

      <Alert>{error}</Alert>

      <form onSubmit={submit} className="space-y-4 text-left">
        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            Level
          </span>
          <select className="darbi-input" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">Select…</option>
            <option value="highschool">High school</option>
            <option value="undergraduate">Undergraduate</option>
          </select>
        </label>

        <div
          className="grid"
          style={{
            gridTemplateRows: level ? '1fr' : '0fr',
          }}
        >
          <div
            className="overflow-hidden min-h-0"
            style={{
              opacity: level ? 1 : 0,
              transform: level ? 'translateY(0)' : 'translateY(-6px)',
              transition: 'opacity 250ms ease-out, transform 250ms ease-out',
              willChange: 'opacity, transform',
            }}
          >
            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                {level === 'highschool' ? 'Average' : 'GPA'}
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                max={level === 'highschool' ? 100 : 4}
                className="darbi-input"
                value={average}
                onChange={(e) => setAverage(e.target.value)}
              />
              <span className="block text-xs text-gray-500 mt-1">
                {level === 'highschool' ? 'Tawjihi average, out of 100' : 'Out of 4'}
              </span>
            </label>
          </div>
        </div>

        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            Interests
          </span>
          <select className="darbi-input" value="" onChange={(e) => addInterest(e.target.value)}>
            <option value="">Add an interest…</option>
            {INTEREST_OPTIONS.filter((o) => !interests.includes(o)).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <span className="block text-xs text-gray-500 mt-1">These drive your recommendations — pick as many as apply.</span>
        </label>

        {interests.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {interests.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => removeInterest(i)}
                className="text-xs font-semibold pl-3 pr-2.5 py-1.5 rounded-full flex items-center gap-1.5 text-white transition hover:brightness-110"
                style={{ background: 'var(--darbi-gradient)' }}
              >
                {i} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}

        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            Location
          </span>
          <input
            className="darbi-input"
            placeholder="Amman"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </label>

        <div className="flex items-center justify-center pt-1">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Continue'}
          </Button>
        </div>
      </form>

      <button
        type="button"
        onClick={() => navigate('/onboarding')}
        disabled={busy}
        className="text-xs text-gray-500 mt-5 underline block mx-auto"
      >
        Skip for now
      </button>
    </CenteredCard>
  );
}
