import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import ChatAdvisor from '../components/student/ChatAdvisor.jsx';
import RecommendationCard from '../components/student/RecommendationCard.jsx';
import Pathways from '../components/student/Pathways.jsx';
import SavedPathways from '../components/student/SavedPathways.jsx';
import { useAuth } from '../services/auth.jsx';
import {
  Alert, Bdi, Button, Card, EmptyState, Field, LtrRange, Shell, inputClass, Salary, SkeletonLines,
} from '../components/common/ui.jsx';
import { useToast } from '../components/common/toast.jsx';
import { useLang } from '../i18n/index.jsx';
import { useTabParam } from '../lib/useTabParam.js';

/** Mirrors slugify() in scripts/convert_xlsx.py, which generated majors.slug. */
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const ALL_TABS = ['advisor', 'pathways', 'saved pathways', 'recommendations', 'profile', 'majors', 'courses', 'jobs'];
// An undergraduate already picked their major and university at profile
// setup (ProfileSetupPage.jsx) — the "explore what to study" tabs are for a
// high schooler who hasn't chosen yet, so they'd just be dead weight here.
const UNDERGRAD_TABS = ['advisor', 'profile', 'courses', 'jobs'];

export default function StudentDashboard() {
  const { profile, setProfile } = useAuth();
  const { t } = useLang();
  const tabs = profile?.level === 'undergraduate' ? UNDERGRAD_TABS : ALL_TABS;
  const [tab, setTab] = useTabParam('advisor', ALL_TABS);
  // Set when another tab sends the student to a specific pathway.
  const [pathwaySlug, setPathwaySlug] = useState(null);

  const subtitle = profile?.major_name
    ? `${profile.major_name}${profile.university_name ? ` · ${profile.university_name}` : ''}`
    : profile?.level
      ? `${profile.level} · ${profile.location ?? t('student.locationFallback')}`
      : undefined;

  return (
    <Shell
      title={t('student.welcomeTitle')(profile?.name ?? t('student.studentFallback'))}
      subtitle={subtitle}
      tabs={tabs}
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
      {tab === 'courses' && <CourseChecklist profile={profile} onGoToPathways={() => setTab('pathways')} />}
      {tab === 'jobs' && (
        <>
          <MyApplications />
          <JobBoard />
        </>
      )}
    </Shell>
  );
}

function Recommendations({ profile, onGoToProfile, onSeePathway }) {
  const { t } = useLang();
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
          ? t('student.recommendations.interestsMissingError')
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
      <Card title={t('student.recommendations.tellUsTitle')}>
        <p className="text-gray-400 mb-4 text-sm">
          {t('student.recommendations.tellUsBody')}
        </p>
        <Button onClick={onGoToProfile}>{t('student.recommendations.completeProfile')}</Button>
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
          {t('student.recommendations.fallbackWarning')}
        </Alert>
      )}

      <div className="flex items-center justify-between gap-3 mb-4 darbi-stack-mobile">
        <h2 className="text-lg font-bold text-darbi-navy">
          {t('student.recommendations.topN')(Math.min(visible.length, 3))}
        </h2>
        <Button variant="navy" onClick={() => run(true)} disabled={busy}>
          {busy ? t('student.recommendations.thinking') : t('student.recommendations.regenerate')}
        </Button>
      </div>

      {busy && !result && <Card>{t('student.recommendations.analysing')}</Card>}

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
          {showAll ? t('student.recommendations.showTop3') : t('student.recommendations.showAll')}
        </button>
      )}

      {result?.summary && (
        <Card title={t('student.recommendations.overallGuidance')} accent={false}>
          <p className="text-gray-300 text-sm">{result.summary}</p>
          <p className="text-xs text-gray-400 mt-3">{t('student.recommendations.generatedBy')(result.model)}</p>
        </Card>
      )}
    </>
  );
}

function ProfileForm({ profile, onSaved }) {
  const { t } = useLang();
  const [form, setForm] = useState({
    name: profile?.name ?? '',
    level: profile?.level ?? '',
    interests: (profile?.interests ?? []).join(', '),
    gpa: profile?.gpa ?? '',
    gpaScale: profile?.gpa_scale ?? '4',
    tawjihiAverage: profile?.tawjihi_average ?? '',
    location: profile?.location ?? '',
    salaryPref: profile?.salary_pref ?? '',
    universityId: profile?.university_id ?? '',
    majorId: profile?.major_id ?? '',
    phone: profile?.phone ?? '',
    linkedinUrl: profile?.linkedin_url ?? '',
  });
  const isHighSchool = form.level === 'highschool';
  const isUndergrad = form.level === 'undergraduate';
  const [universities, setUniversities] = useState([]);
  const [majors, setMajors] = useState([]);
  const [error, setError] = useState('');
  const toast = useToast();

  useEffect(() => {
    api('/universities', { auth: false }).then(setUniversities).catch(() => {});
    api('/majors', { auth: false }).then(setMajors).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      const saved = await api('/students/me', {
        method: 'PUT',
        body: {
          name: form.name,
          level: form.level || null,
          interests: form.interests.split(/[,،]/).map((s) => s.trim()).filter(Boolean),
          gpa: form.gpa === '' ? null : Number(form.gpa),
          gpaScale: form.gpaScale,
          tawjihiAverage: form.tawjihiAverage === '' ? null : Number(form.tawjihiAverage),
          location: form.location || null,
          salaryPref: form.salaryPref || null,
          universityId: form.universityId === '' ? null : Number(form.universityId),
          majorId: form.majorId === '' ? null : Number(form.majorId),
          phone: form.phone || null,
          linkedinUrl: form.linkedinUrl || null,
        },
      });
      onSaved(saved);
      toast.show(t('student.profileForm.savedToast'), { kind: 'success' });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Card title={t('student.profileForm.cardTitle')}>
      <Alert>{error}</Alert>
      <form onSubmit={save}>
        <Field label={t('student.profileForm.fullName')}>
          <input className={inputClass} value={form.name} onChange={set('name')} />
        </Field>
        <Field label={t('student.profileForm.level')}>
          <select className={inputClass} value={form.level} onChange={set('level')}>
            <option value="">{t('student.selectPlaceholder')}</option>
            <option value="highschool">{t('student.profileForm.highSchool')}</option>
            <option value="undergraduate">{t('student.profileForm.undergraduate')}</option>
          </select>
        </Field>
        <Field label={t('student.profileForm.interests')} hint={t('student.profileForm.interestsHint')}>
          <input className={inputClass} value={form.interests} onChange={set('interests')} />
        </Field>
        {isHighSchool ? (
          <Field label={t('student.profileForm.average')} hint={t('student.profileForm.averageHint')}>
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
          <>
            <Field label={t('student.profileForm.gpaScale')}>
              <div className="flex rounded-full p-1" style={{ background: 'color-mix(in srgb, var(--darbi-bg) 55%, black 10%)', border: '1px solid var(--darbi-border)' }}>
                {['4', '100'].map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    onClick={() => setForm({ ...form, gpaScale: scale })}
                    className={`flex-1 text-xs font-semibold py-1.5 rounded-full transition ${
                      form.gpaScale === scale ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                    }`}
                    style={form.gpaScale === scale ? { background: 'var(--darbi-gradient)' } : undefined}
                  >
                    {t('student.profileForm.outOf')(scale)}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={t('student.profileForm.gpa')} hint={t('student.profileForm.outOf')(form.gpaScale)}>
              <input
                type="number"
                step="0.01"
                min="0"
                max={form.gpaScale === '100' ? 100 : 4}
                className={inputClass}
                value={form.gpa}
                onChange={set('gpa')}
              />
            </Field>
          </>
        )}
        {isUndergrad && (
          <>
            <Field label={t('student.profileForm.university')}>
              <select className={inputClass} value={form.universityId} onChange={set('universityId')}>
                <option value="">{t('student.selectPlaceholder')}</option>
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t('student.profileForm.major')}>
              <select className={inputClass} value={form.majorId} onChange={set('majorId')}>
                <option value="">{t('student.selectPlaceholder')}</option>
                {majors.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </Field>
          </>
        )}
        <Field label={t('student.profileForm.location')}>
          <input className={inputClass} value={form.location} onChange={set('location')} />
        </Field>
        <Field label={t('student.profileForm.salaryPref')}>
          <input className={inputClass} placeholder={t('student.profileForm.salaryPrefPlaceholder')} value={form.salaryPref} onChange={set('salaryPref')} />
        </Field>
        <Field label={t('student.profileForm.phone')} hint={t('student.profileForm.phoneHint')}>
          <input type="tel" className={inputClass} placeholder={t('student.profileForm.phonePlaceholder')} value={form.phone} onChange={set('phone')} />
        </Field>
        <Field label={t('student.profileForm.linkedin')} hint={t('student.profileForm.linkedinHint')}>
          <input type="url" className={inputClass} placeholder={t('student.profileForm.linkedinPlaceholder')} value={form.linkedinUrl} onChange={set('linkedinUrl')} />
        </Field>
        <Button type="submit">{t('student.profileForm.saveProfile')}</Button>
      </form>
    </Card>
  );
}

function MajorExplorer() {
  const { t } = useLang();
  const [majors, setMajors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState({ courses: [], universities: [] });
  // { [courseId]: 'completed' | 'in_progress' | 'planned' } — the checkbox
  // below only ever sets/clears 'completed'; the other two are inferred by
  // the chat advisor from what the student says (server/lib/chat.js) and
  // shown as read-only badges here.
  const [progress, setProgress] = useState({});

  useEffect(() => {
    api('/majors', { auth: false }).then(setMajors).catch(() => {}).finally(() => setLoading(false));
    loadProgress();
  }, []);

  function loadProgress() {
    api('/students/me/course-progress').then(setProgress).catch(() => {});
  }

  async function toggle(slug) {
    if (open === slug) return setOpen(null);
    setOpen(slug);
    const [courses, universities] = await Promise.all([
      api(`/majors/${slug}/courses`, { auth: false }),
      api(`/majors/${slug}/universities`, { auth: false }),
    ]);
    setDetail({ courses, universities });
    // Chat may have checked something off since this was last open.
    loadProgress();
  }

  async function toggleCompleted(courseId, checked) {
    setProgress((p) => {
      const next = { ...p };
      if (checked) next[courseId] = 'completed';
      else delete next[courseId];
      return next;
    });
    if (checked) {
      await api(`/students/me/course-progress/${courseId}`, { method: 'PUT', body: { status: 'completed' } });
    } else {
      await api(`/students/me/course-progress/${courseId}`, { method: 'DELETE' });
    }
  }

  return (
    <Card title={loading ? t('student.majorExplorer.loading') : t('student.majorExplorer.count')(majors.length)}>
      {loading && <SkeletonLines lines={6} />}
      {majors.map((m) => (
        <div key={m.slug} className="border-b last:border-0 border-[color:var(--darbi-border)] py-3">
          <button onClick={() => toggle(m.slug)} className="w-full text-start flex justify-between items-center">
            <span className="font-semibold text-darbi-navy">{m.name}</span>
            <span className="text-sm text-gray-500">{t('student.majorExplorer.courseCount')(m.course_count)}</span>
          </button>

          {open === m.slug && (
            <div className="mt-3 ms-4 text-sm">
              <p className="font-semibold text-darbi-navy mb-1.5">{t('student.majorExplorer.whereTaught')}</p>
              {detail.universities.length > 0 ? (
                <ul className="text-gray-300 space-y-1 mb-4">
                  {detail.universities.map((u) => (
                    <li key={u.code}>
                      <span className="font-medium">{u.name}</span>
                      <span className="text-gray-500">
                        {' '}
                        ({u.code}) —{' '}
                        {u.competitive_average != null
                          ? t('student.majorExplorer.needsTawjihi')(u.competitive_average)
                          : t('student.majorExplorer.averageNotPublished')}
                      </span>
                      {u.website && <span className="text-gray-500"> · {u.website}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 italic mb-4">
                  {t('student.majorExplorer.noUniversity')}
                </p>
              )}

              <p className="font-semibold text-darbi-navy mb-1.5">{t('student.majorExplorer.courses')}</p>
              {detail.courses.length > 0 ? (
                <ul className="text-gray-300 space-y-2 list-none ps-0">
                  {detail.courses.map((c) => (
                    <li key={c.id} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1 shrink-0"
                        checked={progress[c.id] === 'completed'}
                        onChange={(e) => toggleCompleted(c.id, e.target.checked)}
                        aria-label={t('student.markFinishedAria')(c.name)}
                      />
                      <label className="flex-1">
                        <span className="font-medium">{c.name}</span>
                        {c.provider && <span className="text-gray-500"> — {c.provider}</span>}
                        {c.cost_raw && <span className="text-gray-500"> · {c.cost_raw} JOD</span>}
                        {progress[c.id] === 'in_progress' && (
                          <span className="ms-2 text-xs px-2 py-0.5 rounded-full bg-white/10" style={{ color: 'var(--darbi-purple)' }}>
                            {t('student.takingNow')}
                          </span>
                        )}
                        {progress[c.id] === 'planned' && (
                          <span className="ms-2 text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
                            {t('student.considering')}
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 italic">
                  {t('student.majorExplorer.noCourses')}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}

/**
 * Course checklist, scoped to majors that actually matter to this student
 * rather than the whole 139-course catalog. A student with a declared major
 * (profile.major_id, an undergraduate picks this at profile setup) sees only
 * that major's courses — full stop, not saved pathways on top of it. A
 * student with no declared major yet (a high schooler still exploring) sees
 * whatever pathways they've saved instead, one titled row per major, since
 * that's their only way to pick what shows up here.
 */
function CourseChecklist({ profile, onGoToPathways }) {
  const { t } = useLang();
  const [savedMajors, setSavedMajors] = useState(null);
  const [courses, setCourses] = useState([]);
  const [progress, setProgress] = useState({});

  useEffect(() => {
    api('/students/me/saved-majors').then(setSavedMajors).catch(() => setSavedMajors([]));
    api('/courses', { auth: false }).then(setCourses).catch(() => {});
    api('/students/me/course-progress').then(setProgress).catch(() => {});
  }, []);

  async function toggleCompleted(courseId, checked) {
    setProgress((p) => {
      const next = { ...p };
      if (checked) next[courseId] = 'completed';
      else delete next[courseId];
      return next;
    });
    if (checked) {
      await api(`/students/me/course-progress/${courseId}`, { method: 'PUT', body: { status: 'completed' } });
    } else {
      await api(`/students/me/course-progress/${courseId}`, { method: 'DELETE' });
    }
  }

  if (savedMajors === null) {
    return (
      <Card title={t('student.courseChecklist.loading')}>
        <SkeletonLines lines={8} />
      </Card>
    );
  }

  // A declared major means "only that" -- no saved pathways mixed in. Saved
  // pathways are the fallback for a student who hasn't declared one yet.
  const rows = profile?.major_id
    ? [{ id: profile.major_id, name: profile.major_name, isProfileMajor: true }]
    : savedMajors.map((m) => ({ id: m.id, name: m.name, isProfileMajor: false }));

  if (rows.length === 0) {
    return (
      <Card title={t('student.courseChecklist.coursesTitle')} accent={false}>
        <EmptyState
          icon="⭐"
          title={
            profile?.level === 'undergraduate'
              ? t('student.courseChecklist.emptyUndergrad')
              : t('student.courseChecklist.emptyHighschool')
          }
          action={onGoToPathways && <Button onClick={onGoToPathways}>{t('student.courseChecklist.browsePathways')}</Button>}
        />
      </Card>
    );
  }

  const done = Object.values(progress).filter((s) => s === 'completed').length;

  return (
    <>
      <p className="text-sm text-gray-400 mb-5">
        {done > 0 ? t('student.courseChecklist.markedFinished')(done) : ''}
        {t('student.courseChecklist.checkOffHint')}
      </p>
      {rows.map((row) => {
        const list = courses.filter((c) => c.major_id === row.id);
        return (
          <Card
            key={row.id}
            accent
            title={
              row.isProfileMajor ? (
                <>
                  {row.name}{' '}
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full align-middle"
                    style={{ background: 'var(--darbi-gradient)', color: '#fff' }}
                  >
                    {t('student.courseChecklist.yourMajor')}
                  </span>
                </>
              ) : (
                row.name
              )
            }
          >
            {list.length > 0 ? (
              <ul className="text-gray-300 space-y-2 list-none ps-0">
                {list.map((c) => (
                  <li key={c.id} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 shrink-0"
                      checked={progress[c.id] === 'completed'}
                      onChange={(e) => toggleCompleted(c.id, e.target.checked)}
                      aria-label={t('student.markFinishedAria')(c.name)}
                    />
                    <label className="flex-1">
                      <span className="font-medium">{c.name}</span>
                      {c.provider && <span className="text-gray-500"> — {c.provider}</span>}
                      {c.cost_raw && <span className="text-gray-500"> · {c.cost_raw} JOD</span>}
                      {progress[c.id] === 'in_progress' && (
                        <span className="ms-2 text-xs px-2 py-0.5 rounded-full bg-white/10" style={{ color: 'var(--darbi-purple)' }}>
                          {t('student.takingNow')}
                        </span>
                      )}
                      {progress[c.id] === 'planned' && (
                        <span className="ms-2 text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
                          {t('student.considering')}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 italic text-sm">{t('student.courseChecklist.noCourses')}</p>
            )}
          </Card>
        );
      })}
    </>
  );
}

// Mirrors CompanyDashboard.jsx's STATUS_COLOR/APPLICATION_STATUSES — kept in
// sync manually since it's the same small map on both sides of one pipeline.
const APPLICATION_STATUS_COLOR = {
  screening: 'var(--darbi-text-muted)',
  shortlisted: 'var(--darbi-purple)',
  interview: 'var(--darbi-gold)',
  hired: 'var(--darbi-success)',
  rejected: 'var(--darbi-error)',
};

/**
 * The student's side of the company pipeline (server/routes/companies.js's
 * PUT .../applicants/:id) — shows where each application stands, and
 * surfaces the note a company attaches when moving someone to Interview
 * (the closest thing DARBI has to an interview invitation, short of a full
 * messaging inbox). Renders nothing once there are no applications yet, so
 * a student who hasn't applied anywhere doesn't see an empty section above
 * the job board.
 */
function MyApplications() {
  const { t } = useLang();
  const [apps, setApps] = useState(null);

  useEffect(() => {
    api('/students/me/applications/status').then(setApps).catch(() => setApps([]));
  }, []);

  if (!apps?.length) return null;

  return (
    <Card title={t('student.myApplications.title')}>
      <div className="divide-y divide-[color:var(--darbi-border)]">
        {apps.map((a) => (
          <div key={a.job_id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-darbi-navy truncate">{a.title}</p>
                <p className="text-sm text-gray-400 truncate">{a.company_name}</p>
              </div>
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block whitespace-nowrap shrink-0"
                style={{
                  color: APPLICATION_STATUS_COLOR[a.status] ?? APPLICATION_STATUS_COLOR.screening,
                  background: `color-mix(in srgb, ${APPLICATION_STATUS_COLOR[a.status] ?? APPLICATION_STATUS_COLOR.screening} 15%, transparent)`,
                }}
              >
                {t(`company.status.${a.status}`)}
              </span>
            </div>
            {a.status === 'interview' && a.company_note && (
              <div
                className="mt-2 text-sm rounded-lg p-3"
                style={{
                  background: 'color-mix(in srgb, var(--darbi-gold) 10%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--darbi-gold) 30%, transparent)',
                }}
              >
                <p className="font-semibold text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--darbi-gold)' }}>
                  {t('student.myApplications.interviewInviteLabel')}
                </p>
                <p className="text-gray-200">{a.company_note}</p>
              </div>
            )}
          </div>
        ))}
      </div>
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
  const { t } = useLang();
  const { profile, setProfile } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [major, setMajor] = useState('');
  const [visible, setVisible] = useState(JOBS_PAGE_SIZE);
  const [open, setOpen] = useState(null);
  const [appliedIds, setAppliedIds] = useState([]);
  const [applying, setApplying] = useState(null);
  // A job's company only sees phone/LinkedIn once the student has both on
  // file (server/routes/companies.js's applicants query) -- apply() prompts
  // for whichever is missing the first time, then every later application
  // reuses what's already saved on the profile.
  const [contactPromptFor, setContactPromptFor] = useState(null);
  const [contactDraft, setContactDraft] = useState({ phone: '', linkedinUrl: '' });
  const hasContactInfo = Boolean(profile?.phone && profile?.linkedin_url);

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
    if (!hasContactInfo) {
      setContactDraft({ phone: profile?.phone ?? '', linkedinUrl: profile?.linkedin_url ?? '' });
      setContactPromptFor(jobId);
      return;
    }
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

  async function submitContactAndApply(jobId) {
    const phone = contactDraft.phone.trim();
    const linkedinUrl = contactDraft.linkedinUrl.trim();
    if (!phone || !linkedinUrl) return;
    setApplying(jobId);
    try {
      const saved = await api('/students/me', { method: 'PUT', body: { phone, linkedinUrl } });
      setProfile(saved);
      await api('/students/me/applications', { method: 'POST', body: { jobId } });
      setAppliedIds((ids) => [...ids, jobId]);
      setContactPromptFor(null);
    } catch {
      // Same silent handling as apply() above.
    } finally {
      setApplying(null);
    }
  }

  return (
    <Card title={loading ? t('student.jobBoard.loading') : t('student.jobBoard.count')(jobs.length)}>
      <Field label={t('student.jobBoard.filterByMajor')}>
        <input className={inputClass} placeholder={t('student.jobBoard.filterPlaceholder')} value={major} onChange={(e) => setMajor(e.target.value)} />
      </Field>
      {loading && <SkeletonLines lines={5} />}
      <div className="divide-y divide-[color:var(--darbi-border)]">
        {jobs.slice(0, visible).map((j) => (
          <div key={j.id} className="py-3">
            <button onClick={() => setOpen(open === j.id ? null : j.id)} className="w-full text-start">
              <p className="font-semibold text-darbi-navy"><Bdi>{j.title}</Bdi></p>
              <p className="text-sm text-gray-300"><Bdi>{j.company_name}</Bdi></p>
              <p className="text-sm text-gray-500 mt-1">
                {j.salary_raw ? <LtrRange>{t('student.jobBoard.salaryPerMonth')(j.salary_raw)}</LtrRange> : t('student.jobBoard.salaryNotStated')}
                {j.required_majors?.length > 0 && ` · ${j.required_majors.join(', ')}`}
              </p>
              {j.source && <p className="text-xs text-gray-400 mt-1">{t('student.jobBoard.source')(j.source)}</p>}
            </button>

            {open === j.id && (
              <div className="mt-3 ms-1 text-sm space-y-1.5">
                <p className="text-gray-300">
                  <span className="font-semibold text-darbi-navy">{t('student.jobBoard.location')}</span>
                  <Bdi>{j.location ?? t('student.jobBoard.notStated')}</Bdi>
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
                  <p className="text-gray-500">{t('student.jobBoard.minGpa')(j.min_gpa_raw)}</p>
                )}

                <div className="pt-2">
                  {j.company_id ? (
                    contactPromptFor === j.id ? (
                      <div className="space-y-2 max-w-sm">
                        <p className="text-xs text-gray-500">{t('student.jobBoard.contactRequiredHint')}</p>
                        <input
                          type="tel"
                          className={inputClass}
                          placeholder={t('student.profileForm.phonePlaceholder')}
                          value={contactDraft.phone}
                          onChange={(e) => setContactDraft({ ...contactDraft, phone: e.target.value })}
                        />
                        <input
                          type="url"
                          className={inputClass}
                          placeholder={t('student.profileForm.linkedinPlaceholder')}
                          value={contactDraft.linkedinUrl}
                          onChange={(e) => setContactDraft({ ...contactDraft, linkedinUrl: e.target.value })}
                        />
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => submitContactAndApply(j.id)}
                            disabled={applying === j.id || !contactDraft.phone.trim() || !contactDraft.linkedinUrl.trim()}
                            className="darbi-btn text-sm disabled:opacity-60"
                          >
                            {applying === j.id ? t('student.jobBoard.applying') : t('student.jobBoard.submitApplication')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setContactPromptFor(null)}
                            className="text-sm text-gray-400 hover:text-gray-200"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => apply(j.id)}
                        disabled={appliedIds.includes(j.id) || applying === j.id}
                        className="darbi-btn text-sm disabled:opacity-60"
                      >
                        {appliedIds.includes(j.id)
                          ? t('student.jobBoard.applied')
                          : applying === j.id
                            ? t('student.jobBoard.applying')
                            : t('student.jobBoard.apply')}
                      </button>
                    )
                  ) : (
                    <p className="text-xs text-gray-500 italic">
                      {t('student.jobBoard.externalListing')}
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
          {t('student.jobBoard.showMore')(jobs.length - visible)}
        </button>
      )}
    </Card>
  );
}
