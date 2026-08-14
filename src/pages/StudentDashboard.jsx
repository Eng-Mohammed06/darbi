import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import ChatAdvisor from '../components/student/ChatAdvisor.jsx';
import RecommendationCard from '../components/student/RecommendationCard.jsx';
import Pathways from '../components/student/Pathways.jsx';
import SavedPathways from '../components/student/SavedPathways.jsx';
import { useAuth } from '../services/auth.jsx';
import {
  Alert, Button, Card, Field, Shell, inputClass, Salary,
} from '../components/common/ui.jsx';

/** Mirrors slugify() in scripts/convert_xlsx.py, which generated majors.slug. */
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const TABS = ['advisor', 'pathways', 'saved pathways', 'recommendations', 'profile', 'majors', 'jobs'];

export default function StudentDashboard() {
  const { profile, setProfile } = useAuth();
  const [tab, setTab] = useState('advisor');
  // Set when another tab sends the student to a specific pathway.
  const [pathwaySlug, setPathwaySlug] = useState(null);

  return (
    <Shell
      title={`Welcome, ${profile?.name ?? 'student'} 🎓`}
      subtitle={profile?.level ? `${profile.level} · ${profile.location ?? 'Jordan'}` : undefined}
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
    >
      {tab === 'advisor' && (
        <ChatAdvisor student={profile} onFallback={() => setTab('recommendations')} />
      )}
      {tab === 'pathways' && <Pathways initialSlug={pathwaySlug} />}
      {tab === 'saved pathways' && <SavedPathways />}
      {tab === 'recommendations' && (
        <Recommendations
          profile={profile}
          onGoToProfile={() => setTab('profile')}
          onSeePathway={(slug) => { setPathwaySlug(slug); setTab('pathways'); }}
        />
      )}
      {tab === 'profile' && <ProfileForm profile={profile} onSaved={setProfile} />}
      {tab === 'majors' && <MajorExplorer />}
      {tab === 'jobs' && <JobBoard />}
    </Shell>
  );
}

function Recommendations({ profile, onGoToProfile, onSeePathway }) {
  const [result, setResult] = useState(null);
  const [majors, setMajors] = useState([]);
  const [savedIds, setSavedIds] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const bySlug = (name) => majors.find((m) => m.name === name);

  function loadSaved() {
    api('/students/me/saved-majors').then((r) => setSavedIds(r.map((x) => x.id))).catch(() => {});
  }

  async function run(refresh = false) {
    setBusy(true);
    setError('');
    try {
      setResult(await api(`/recommend${refresh ? '?refresh=1' : ''}`, { method: 'POST' }));
    } catch (err) {
      setError(
        err.code === 'profile_incomplete'
          ? 'Add at least one interest to your profile first.'
          : err.message,
      );
    } finally {
      setBusy(false);
    }
  }

  async function save(major) {
    await api('/students/me/saved-majors', { method: 'POST', body: { majorId: major.id } });
    loadSaved();
  }

  async function unsave(major) {
    await api(`/students/me/saved-majors/${major.id}`, { method: 'DELETE' });
    loadSaved();
  }

  useEffect(() => {
    api('/majors', { auth: false }).then(setMajors).catch(() => {});
    loadSaved();
    if (profile?.interests?.length) run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile?.interests?.length) {
    return (
      <Card title="Tell us what you're interested in">
        <p className="text-gray-400 mb-4 text-sm">
          Your recommendations are built from your interests and GPA. Add them to your profile to
          get started.
        </p>
        <Button onClick={onGoToProfile}>Complete profile</Button>
      </Card>
    );
  }

  // The wireframe shows the top 3, with [SHOW ALL MAJORS] underneath.
  const ranked = result?.recommendations ?? [];
  const visible = showAll ? ranked : ranked.slice(0, 3);

  return (
    <>
      <Alert>{error}</Alert>

      {result?.source === 'fallback' && (
        <Alert kind="warn">
          AI guidance is unavailable right now, so this ranking is rule-based, built from DARBI’s
          verified course, salary and job data.
        </Alert>
      )}

      <div className="flex items-center justify-between gap-3 mb-4 darbi-stack-mobile">
        <h2 className="text-lg font-bold text-darbi-navy">
          Your top {Math.min(visible.length, 3)} major recommendations
        </h2>
        <Button variant="navy" onClick={() => run(true)} disabled={busy}>
          {busy ? 'Thinking\u2026' : 'Regenerate'}
        </Button>
      </div>

      {busy && !result && <Card>Analysing your profile\u2026</Card>}

      {visible.map((r, i) => (
        <RecommendationCard
          key={r.major}
          rank={i + 1}
          major={bySlug(r.major)}
          recommendation={r}
          saved={savedIds.includes(bySlug(r.major)?.id)}
          onSave={save}
          onUnsave={unsave}
          onLearnMore={onSeePathway}
        />
      ))}

      {ranked.length > 3 && (
        <button onClick={() => setShowAll(!showAll)} className="darbi-btn darbi-btn-navy w-full">
          {showAll ? 'Show top 3 only' : 'Show all majors'}
        </button>
      )}

      {result?.summary && (
        <Card title="Overall guidance" accent={false}>
          <p className="text-gray-300 text-sm">{result.summary}</p>
          <p className="text-xs text-gray-400 mt-3">Generated by {result.model}</p>
        </Card>
      )}
    </>
  );
}

function ProfileForm({ profile, onSaved }) {
  const [form, setForm] = useState({
    name: profile?.name ?? '',
    level: profile?.level ?? '',
    interests: (profile?.interests ?? []).join(', '),
    gpa: profile?.gpa ?? '',
    tawjihiAverage: profile?.tawjihi_average ?? '',
    location: profile?.location ?? '',
    salaryPref: profile?.salary_pref ?? '',
  });
  const isHighSchool = form.level === 'highschool';
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setError('');
    setStatus('');
    try {
      const saved = await api('/students/me', {
        method: 'PUT',
        body: {
          name: form.name,
          level: form.level || null,
          interests: form.interests.split(',').map((s) => s.trim()).filter(Boolean),
          gpa: form.gpa === '' ? null : Number(form.gpa),
          tawjihiAverage: form.tawjihiAverage === '' ? null : Number(form.tawjihiAverage),
          location: form.location || null,
          salaryPref: form.salaryPref || null,
        },
      });
      onSaved(saved);
      setStatus('Saved. Regenerate your recommendations to use the new profile.');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Card title="Your profile">
      <Alert>{error}</Alert>
      {status && <p className="text-green-400 mb-4">{status}</p>}
      <form onSubmit={save}>
        <Field label="Full name">
          <input className={inputClass} value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Level">
          <select className={inputClass} value={form.level} onChange={set('level')}>
            <option value="">Select…</option>
            <option value="highschool">High school</option>
            <option value="undergraduate">Undergraduate</option>
            <option value="graduate">Graduate</option>
          </select>
        </Field>
        <Field label="Interests" hint="Comma separated">
          <input className={inputClass} value={form.interests} onChange={set('interests')} />
        </Field>
        {isHighSchool ? (
          <Field label="Average" hint="Tawjihi average, out of 100">
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              className={inputClass}
              value={form.tawjihiAverage}
              onChange={set('tawjihiAverage')}
            />
          </Field>
        ) : (
          <Field label="GPA" hint="Out of 4">
            <input
              type="number"
              step="0.01"
              min="0"
              max="4"
              className={inputClass}
              value={form.gpa}
              onChange={set('gpa')}
            />
          </Field>
        )}
        <Field label="Location">
          <input className={inputClass} value={form.location} onChange={set('location')} />
        </Field>
        <Field label="Salary preference">
          <input className={inputClass} placeholder="800-1200 JOD" value={form.salaryPref} onChange={set('salaryPref')} />
        </Field>
        <Button type="submit">Save profile</Button>
      </form>
    </Card>
  );
}

function MajorExplorer() {
  const [majors, setMajors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState({ courses: [], universities: [] });

  useEffect(() => {
    api('/majors', { auth: false }).then(setMajors).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function toggle(slug) {
    if (open === slug) return setOpen(null);
    setOpen(slug);
    const [courses, universities] = await Promise.all([
      api(`/majors/${slug}/courses`, { auth: false }),
      api(`/majors/${slug}/universities`, { auth: false }),
    ]);
    setDetail({ courses, universities });
  }

  return (
    <Card title={loading ? 'Loading majors…' : `${majors.length} engineering majors`}>
      {majors.map((m) => (
        <div key={m.slug} className="border-b last:border-0 border-[color:var(--darbi-border)] py-3">
          <button onClick={() => toggle(m.slug)} className="w-full text-left flex justify-between items-center">
            <span className="font-semibold text-darbi-navy">{m.name}</span>
            <span className="text-sm text-gray-500">{m.course_count} courses</span>
          </button>

          {open === m.slug && (
            <div className="mt-3 ml-4 text-sm">
              <p className="font-semibold text-darbi-navy mb-1.5">Where it's taught</p>
              {detail.universities.length > 0 ? (
                <ul className="text-gray-300 space-y-1 mb-4">
                  {detail.universities.map((u) => (
                    <li key={u.code}>
                      <span className="font-medium">{u.name}</span>
                      <span className="text-gray-500">
                        {' '}
                        ({u.code}) —{' '}
                        {u.competitive_average != null
                          ? `needs ${u.competitive_average}% Tawjihi`
                          : 'average not published'}
                      </span>
                      {u.website && <span className="text-gray-500"> · {u.website}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 italic mb-4">
                  No university on file teaches this major yet — its courses come from training
                  academies. Being gathered.
                </p>
              )}

              <p className="font-semibold text-darbi-navy mb-1.5">Courses</p>
              {detail.courses.length > 0 ? (
                <ul className="text-gray-300 space-y-1.5">
                  {detail.courses.map((c) => (
                    <li key={c.id}>
                      <span className="font-medium">{c.name}</span>
                      {c.provider && <span className="text-gray-500"> — {c.provider}</span>}
                      {c.cost_raw && <span className="text-gray-500"> · {c.cost_raw} JOD</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 italic">
                  No courses catalogued for this major yet — salary and university data above are
                  still verified, this is just a gap in the course catalog.
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}

const JOBS_PAGE_SIZE = 20;

/**
 * Rendering all ~176 listings in one pass used to briefly freeze the tab —
 * enough to make a click feel like it did nothing. Reveal them a page at a
 * time instead, same pattern as [Show all majors] elsewhere in the app.
 *
 * Rows are also click-to-expand now (same accordion pattern as
 * MajorExplorer above): required_skills, location and description come back
 * from /api/jobs already but were being fetched and thrown away, so a click
 * on a listing looked like a dead end.
 */
function JobBoard() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [major, setMajor] = useState('');
  const [visible, setVisible] = useState(JOBS_PAGE_SIZE);
  const [open, setOpen] = useState(null);
  const [appliedIds, setAppliedIds] = useState([]);
  const [applying, setApplying] = useState(null);

  useEffect(() => {
    const q = major ? `?major=${encodeURIComponent(major)}` : '';
    setLoading(true);
    api(`/jobs${q}`, { auth: false }).then(setJobs).catch(() => {}).finally(() => setLoading(false));
    setVisible(JOBS_PAGE_SIZE);
  }, [major]);

  useEffect(() => {
    api('/students/me/applications').then(setAppliedIds).catch(() => {});
  }, []);

  async function apply(jobId) {
    setApplying(jobId);
    try {
      await api('/students/me/applications', { method: 'POST', body: { jobId } });
      setAppliedIds((ids) => [...ids, jobId]);
    } catch {
      // The only failure mode here is "no company account behind this
      // listing" (409), already explained inline before the button shows —
      // nothing more useful to say on a retry.
    } finally {
      setApplying(null);
    }
  }

  return (
    <Card title={loading ? 'Loading job listings…' : `${jobs.length} verified job listings`}>
      <Field label="Filter by major">
        <input className={inputClass} placeholder="Computer Science" value={major} onChange={(e) => setMajor(e.target.value)} />
      </Field>
      <div className="divide-y divide-[color:var(--darbi-border)]">
        {jobs.slice(0, visible).map((j) => (
          <div key={j.id} className="py-3">
            <button onClick={() => setOpen(open === j.id ? null : j.id)} className="w-full text-left">
              <p className="font-semibold text-darbi-navy">{j.title}</p>
              <p className="text-sm text-gray-300">{j.company_name}</p>
              <p className="text-sm text-gray-500 mt-1">
                {j.salary_raw ? `${j.salary_raw} JOD/month` : 'Salary not stated'}
                {j.required_majors?.length > 0 && ` · ${j.required_majors.join(', ')}`}
              </p>
              {j.source && <p className="text-xs text-gray-400 mt-1">Source: {j.source}</p>}
            </button>

            {open === j.id && (
              <div className="mt-3 ml-1 text-sm space-y-1.5">
                <p className="text-gray-300">
                  <span className="font-semibold text-darbi-navy">Location: </span>
                  {j.location ?? 'Not stated'}
                </p>
                {j.required_skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {j.required_skills.map((s) => (
                      <span key={s} className="text-xs px-2 py-1 rounded-full bg-white/10 text-gray-200">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {j.description && <p className="text-gray-300 pt-1">{j.description}</p>}
                {j.min_gpa_raw && j.min_gpa_raw !== 'Not stated' && (
                  <p className="text-gray-500">Min GPA: {j.min_gpa_raw}</p>
                )}

                <div className="pt-2">
                  {j.company_id ? (
                    <button
                      onClick={() => apply(j.id)}
                      disabled={appliedIds.includes(j.id) || applying === j.id}
                      className="darbi-btn text-sm disabled:opacity-60"
                    >
                      {appliedIds.includes(j.id) ? 'Applied ✓' : applying === j.id ? 'Applying…' : 'Apply'}
                    </button>
                  ) : (
                    <p className="text-xs text-gray-500 italic">
                      Applying isn't available for this listing — it's gathered from an external
                      directory, not a DARBI company account.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {visible < jobs.length && (
        <button
          onClick={() => setVisible((v) => v + JOBS_PAGE_SIZE)}
          className="darbi-btn darbi-btn-navy w-full mt-4"
        >
          Show more ({jobs.length - visible} remaining)
        </button>
      )}
    </Card>
  );
}
