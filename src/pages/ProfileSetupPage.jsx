import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../services/auth.jsx';
import { Alert, Button, CenteredCard } from '../components/common/ui.jsx';
import { useLang } from '../i18n/index.jsx';

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
 *
 * An undergraduate additionally picks their university and major here (a
 * high schooler hasn't chosen either yet) — StudentDashboard.jsx uses that
 * to skip the "explore majors" tabs for them and go straight to their own
 * courses and jobs instead.
 */
export default function ProfileSetupPage() {
  const navigate = useNavigate();
  const { setProfile } = useAuth();
  const { t } = useLang();

  const [level, setLevel] = useState('');
  const [average, setAverage] = useState('');
  const [gpaScale, setGpaScale] = useState('4'); // '4' or '100' — some Jordanian universities grade out of 100
  const [interests, setInterests] = useState([]);
  const [location, setLocation] = useState('');
  const [universities, setUniversities] = useState([]);
  const [majors, setMajors] = useState([]);
  const [universityId, setUniversityId] = useState('');
  const [majorId, setMajorId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/universities', { auth: false }).then(setUniversities).catch(() => {});
    api('/majors', { auth: false }).then(setMajors).catch(() => {});
  }, []);

  function addInterest(value) {
    if (value && !interests.includes(value)) setInterests([...interests, value]);
  }

  function removeInterest(value) {
    setInterests(interests.filter((i) => i !== value));
  }

  function changeGpaScale(scale) {
    setGpaScale(scale);
    // A number typed under one scale is meaningless under the other (e.g.
    // 85 isn't a valid GPA out of 4) — clear it rather than silently
    // reinterpreting or submitting an out-of-range value.
    const max = scale === '100' ? 100 : 4;
    if (average !== '' && Number(average) > max) setAverage('');
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
          gpaScale,
          tawjihiAverage: value,
          universityId: universityId ? Number(universityId) : null,
          majorId: majorId ? Number(majorId) : null,
        },
      });
      setProfile(profile);
      navigate('/onboarding');
    } catch (err) {
      setError(err.message ?? t('profileSetup.saveError'));
    } finally {
      setBusy(false);
    }
  }

  const isUndergrad = level === 'undergraduate';

  return (
    <CenteredCard>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--darbi-gold)' }}>
        {t('profileSetup.step2of3')}
      </p>
      <h1 className="text-lg font-bold text-darbi-navy mt-2 mb-2">{t('profileSetup.heading')}</h1>
      <p className="text-sm text-gray-400 mb-5">
        {t('profileSetup.subheading')}
      </p>

      <Alert>{error}</Alert>

      <form onSubmit={submit} className="space-y-4 text-start">
        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            {t('profileSetup.levelLabel')}
          </span>
          <select className="darbi-input" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">{t('profileSetup.selectPlaceholder')}</option>
            <option value="highschool">{t('profileSetup.highSchool')}</option>
            <option value="undergraduate">{t('profileSetup.undergraduate')}</option>
          </select>
        </label>

        <div
          className="grid"
          style={{
            gridTemplateRows: level ? '1fr' : '0fr',
          }}
        >
          <div
            className="overflow-hidden min-h-0 space-y-4"
            style={{
              opacity: level ? 1 : 0,
              transform: level ? 'translateY(0)' : 'translateY(-6px)',
              transition: 'opacity 250ms ease-out, transform 250ms ease-out',
              willChange: 'opacity, transform',
            }}
          >
            {isUndergrad && (
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                  {t('profileSetup.gpaScaleLabel')}
                </span>
                <div
                  className="flex rounded-full p-1"
                  style={{ background: 'color-mix(in srgb, var(--darbi-bg) 55%, black 10%)', border: '1px solid var(--darbi-border)' }}
                >
                  {['4', '100'].map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => changeGpaScale(scale)}
                      className={`flex-1 text-xs font-semibold py-1.5 rounded-full transition ${
                        gpaScale === scale ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                      }`}
                      style={gpaScale === scale ? { background: 'var(--darbi-gradient)' } : undefined}
                    >
                      {t('profileSetup.outOf')(scale)}
                    </button>
                  ))}
                </div>
                <span className="block text-xs text-gray-500 mt-1">
                  {t('profileSetup.gpaScaleHint')}
                </span>
              </div>
            )}

            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                {level === 'highschool' ? t('profileSetup.averageLabel') : t('profileSetup.gpaLabel')}
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                max={level === 'highschool' ? 100 : gpaScale === '100' ? 100 : 4}
                className="darbi-input"
                value={average}
                onChange={(e) => setAverage(e.target.value)}
              />
              <span className="block text-xs text-gray-500 mt-1">
                {level === 'highschool' ? t('profileSetup.tawjihiHint') : t('profileSetup.outOf')(gpaScale)}
              </span>
            </label>

            {isUndergrad && (
              <>
                <label className="block">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                    {t('profileSetup.universityLabel')}
                  </span>
                  <select
                    className="darbi-input"
                    value={universityId}
                    onChange={(e) => setUniversityId(e.target.value)}
                  >
                    <option value="">{t('profileSetup.selectPlaceholder')}</option>
                    {universities.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                    {t('profileSetup.majorLabel')}
                  </span>
                  <select className="darbi-input" value={majorId} onChange={(e) => setMajorId(e.target.value)}>
                    <option value="">{t('profileSetup.selectPlaceholder')}</option>
                    {majors.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
        </div>

        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            {t('profileSetup.interestsLabel')}
          </span>
          <select className="darbi-input" value="" onChange={(e) => addInterest(e.target.value)}>
            <option value="">{t('profileSetup.addInterestPlaceholder')}</option>
            {INTEREST_OPTIONS.filter((o) => !interests.includes(o)).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <span className="block text-xs text-gray-500 mt-1">{t('profileSetup.interestsHint')}</span>
        </label>

        {interests.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {interests.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => removeInterest(i)}
                className="text-xs font-semibold ps-3 pe-2.5 py-1.5 rounded-full flex items-center gap-1.5 text-white transition hover:brightness-110"
                style={{ background: 'var(--darbi-gradient)' }}
              >
                {i} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}

        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            {t('profileSetup.locationLabel')}
          </span>
          <input
            className="darbi-input"
            placeholder={t('profileSetup.locationPlaceholder')}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </label>

        <div className="flex items-center justify-center pt-1">
          <Button type="submit" disabled={busy}>
            {busy ? t('profileSetup.saving') : t('profileSetup.continueBtn')}
          </Button>
        </div>
      </form>

      <button
        type="button"
        onClick={() => navigate('/onboarding')}
        disabled={busy}
        className="text-xs text-gray-500 mt-5 underline block mx-auto"
      >
        {t('profileSetup.skipForNow')}
      </button>
    </CenteredCard>
  );
}
