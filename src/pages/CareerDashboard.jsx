import { useEffect, useRef, useState } from 'react';
import { api, getToken } from '../services/api.js';
import { useAuth } from '../services/auth.jsx';
import { Alert, Button, Card, EmptyState, Field, Shell, Skeleton, SkeletonLines, inputClass } from '../components/common/ui.jsx';
import { useToast } from '../components/common/toast.jsx';
import { readCvFile } from '../lib/cv.js';
import { useLang } from '../i18n/index.jsx';

const TABS = ['ai assistant', 'profile', 'career path', 'jobs', 'job recommendations', 'applications', 'learning paths', 'training centres'];

export default function CareerDashboard() {
  const { profile, setProfile } = useAuth();
  const { t } = useLang();
  const [tab, setTab] = useState('ai assistant');
  // Set by "Ask the AI Assistant" in Learning Paths — jumps to the Assistant
  // tab with the question already typed, instead of making the user retype
  // what they just picked a field to explore.
  const [assistantSeed, setAssistantSeed] = useState(null);

  function askAssistant(text) {
    setAssistantSeed(text);
    setTab('ai assistant');
  }

  return (
    <Shell
      title={t('career.welcome')(profile?.name ?? t('career.namePlaceholder'))}
      subtitle={profile?.current_title}
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
    >
      {tab === 'ai assistant' && <AiAssistant profile={profile} seed={assistantSeed} onSeedConsumed={() => setAssistantSeed(null)} />}
      {tab === 'profile' && <Profile />}
      {tab === 'career path' && <CareerPath profile={profile} setProfile={setProfile} onGoToProfile={() => setTab('profile')} />}
      {tab === 'jobs' && <Jobs />}
      {tab === 'job recommendations' && <JobMatches onGoToProfile={() => setTab('profile')} />}
      {tab === 'applications' && <Applications />}
      {tab === 'learning paths' && <LearningPaths profile={profile} onAskAssistant={askAssistant} />}
      {tab === 'training centres' && <TrainingCentres />}
    </Shell>
  );
}

/**
 * Reads the career_paths table, seeded from career_courses_ENGLISH.xlsx —
 * every Coursera / Udemy link and Jordanian centre the team verified.
 * Defaults to just the graduate's own field (career_profiles.major) rather
 * than dumping all 40 paths across every field at once; a field switcher
 * lets them explore any other field, and picking one that isn't their own
 * offers to hand the transition question straight to the AI Assistant.
 */
function LearningPaths({ profile, onAskAssistant }) {
  const { t } = useLang();
  const p = t('career.paths');
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedField, setSelectedField] = useState('');
  const [savedIds, setSavedIds] = useState(new Set());
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  useEffect(() => {
    api('/career/paths', { auth: false }).then(setPaths).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    api('/career/saved-paths').then((ids) => setSavedIds(new Set(ids))).catch(() => {});
  }, []);

  async function toggleSaved(pathId) {
    const wasSaved = savedIds.has(pathId);
    setSavedIds((s) => {
      const next = new Set(s);
      wasSaved ? next.delete(pathId) : next.add(pathId);
      return next;
    });
    try {
      if (wasSaved) await api(`/career/saved-paths/${pathId}`, { method: 'DELETE' });
      else await api('/career/saved-paths', { method: 'POST', body: { careerPathId: pathId } });
    } catch {
      // Roll back — the change didn't actually take server-side.
      setSavedIds((s) => {
        const next = new Set(s);
        wasSaved ? next.add(pathId) : next.delete(pathId);
        return next;
      });
    }
  }

  const fields = [...new Set(paths.map((p2) => p2.major_name))].sort();
  const myField = profile?.major
    ? fields.find((f) => f.toLowerCase() === profile.major.trim().toLowerCase())
      ?? fields.find((f) => f.toLowerCase().includes(profile.major.trim().toLowerCase()) || profile.major.trim().toLowerCase().includes(f.toLowerCase()))
      ?? null
    : null;
  const activeField = selectedField || myField || '';
  const exploringOtherField = Boolean(myField) && activeField && activeField !== myField;
  const shown = activeField ? paths.filter((p2) => p2.major_name === activeField) : [];
  const savedPaths = paths.filter((p2) => savedIds.has(p2.id));

  return (
    <>
      {loading && <Card><SkeletonLines lines={4} /></Card>}

      {!loading && (
        <Card accent={false}>
          <div className="flex items-center justify-between gap-3 mb-1">
            <Field label={p.exploreLabel}>
              <select
                className={inputClass}
                value={selectedField}
                onChange={(e) => setSelectedField(e.target.value)}
                disabled={showSavedOnly}
              >
                <option value="">{myField ? p.myFieldOption(myField) : p.pickField}</option>
                {fields.filter((f) => f !== myField).map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </Field>
          </div>
          {!myField && !selectedField && !showSavedOnly && <p className="text-xs text-gray-500 -mt-2 mb-3">{p.noMajorSet}</p>}
          <button
            type="button"
            onClick={() => setShowSavedOnly((s) => !s)}
            className="text-xs font-bold"
            style={{ color: showSavedOnly ? 'var(--darbi-gold)' : 'var(--darbi-purple)' }}
          >
            {showSavedOnly ? p.showingSaved : p.showSavedOnly(savedIds.size)}
          </button>
        </Card>
      )}

      {!loading && !showSavedOnly && exploringOtherField && (
        <Card accent={false}>
          <p className="font-semibold text-white">{p.switchingTitle(activeField)}</p>
          <p className="text-sm text-gray-400 mt-1 mb-3">{p.switchingBody}</p>
          <button
            type="button"
            onClick={() => onAskAssistant(p.askAssistantSeed(profile?.major, activeField))}
            className="text-xs font-bold"
            style={{ color: 'var(--darbi-purple)' }}
          >
            {p.askAssistant}
          </button>
        </Card>
      )}

      {!loading && showSavedOnly && (
        <Card title={p.savedTitle(savedPaths.length)}>
          {savedPaths.length === 0 ? (
            <p className="text-sm text-gray-500 italic">{p.noSavedPaths}</p>
          ) : (
            <div className="divide-y divide-[color:var(--darbi-border)]">
              {savedPaths.map((path) => (
                <PathRow key={path.id} path={path} p={p} t={t} saved onToggle={() => toggleSaved(path.id)} showField />
              ))}
            </div>
          )}
        </Card>
      )}

      {!loading && !showSavedOnly && activeField && (
        <Card key={activeField} title={p.forYourField(activeField)}>
          <div className="divide-y divide-[color:var(--darbi-border)]">
            {shown.map((path) => (
              <PathRow key={path.id} path={path} p={p} t={t} saved={savedIds.has(path.id)} onToggle={() => toggleSaved(path.id)} />
            ))}
          </div>
        </Card>
      )}

      {!loading && paths.length === 0 && (
        <Card><EmptyState icon="🎓" title={t('career.noLearningPaths')} /></Card>
      )}
    </>
  );
}

function PathRow({ path, p, t, saved, onToggle, showField = false }) {
  return (
    <div className="py-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-darbi-navy">{path.name}</p>
          {showField && <p className="text-xs text-gray-500">{path.major_name}</p>}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="text-xs font-bold shrink-0"
          style={{ color: saved ? 'var(--darbi-gold)' : 'var(--darbi-purple)' }}
        >
          {saved ? p.saved : p.save}
        </button>
      </div>
      {path.skills && <p className="text-sm text-gray-300 mt-1 whitespace-pre-line">{path.skills}</p>}
      {path.jordan_centers && (
        <p className="text-xs text-gray-500 mt-2">
          <span className="font-semibold">{t('career.inJordan')}</span>{path.jordan_centers}
        </p>
      )}
    </div>
  );
}

/**
 * Career Path — a personalized progression ladder (POST /api/career/ladder),
 * generated from the graduate's own major/current role/skills/experience and
 * cached until that changes. Degrades to a generic template if Claude is
 * unavailable, same tier-of-degradation approach as Recommendations does for
 * students (server/lib/claude.js).
 */
function CareerPath({ profile, setProfile, onGoToProfile }) {
  const { t } = useLang();
  const l = t('career.ladder');
  const [subTab, setSubTab] = useState('suggested');
  const [ladder, setLadder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); // { code, message } | null

  function load(refresh) {
    setBusy(refresh);
    setLoading(!refresh);
    setError(null);
    api(`/career/ladder${refresh ? '?refresh=1' : ''}`, { method: 'POST' })
      .then(setLadder)
      .catch((err) => setError({ code: err.code, message: err.message }))
      .finally(() => {
        setLoading(false);
        setBusy(false);
      });
  }

  useEffect(load, []);

  async function saveGoal(targetRole) {
    const updated = await api('/career/me', { method: 'PUT', body: { targetRole } });
    setProfile(updated);
    setSubTab('suggested');
    load(true);
  }

  const subTabs = (
    <div className="flex gap-2 mb-4">
      {['suggested', 'goal'].map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => setSubTab(id)}
          className={`text-xs px-3.5 py-1.5 rounded-full font-bold transition ${
            subTab === id ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          style={subTab === id ? { background: 'var(--darbi-gradient)' } : { border: '1px solid color-mix(in srgb, var(--darbi-navy) 15%, transparent)' }}
        >
          {id === 'suggested' ? l.suggestedTabLabel : l.goalTabLabel}
        </button>
      ))}
    </div>
  );

  if (subTab === 'goal') {
    return (
      <>
        {subTabs}
        <GoalForm currentGoal={profile?.target_role} l={l} onSave={saveGoal} />
      </>
    );
  }

  if (loading) {
    return (
      <>
        {subTabs}
        <Card title={l.title}><SkeletonLines lines={6} /></Card>
      </>
    );
  }

  if (error?.code === 'profile_incomplete') {
    return (
      <>
        {subTabs}
        <Card title={l.incompleteTitle} accent={false}>
          <p className="text-sm text-gray-400 mb-4">{l.incompleteBody}</p>
          <Button type="button" onClick={onGoToProfile}>{l.goToProfile}</Button>
        </Card>
      </>
    );
  }

  if (error) {
    return (
      <>
        {subTabs}
        <Card title={l.errorTitle} accent={false}>
          <Alert>{error.message}</Alert>
          <Button type="button" onClick={() => load(false)}>{l.retry}</Button>
        </Card>
      </>
    );
  }

  return (
    <>
      {subTabs}
      <Card title={l.title} accent={false}>
        {profile?.target_role && (
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-xs font-bold" style={{ color: 'var(--darbi-gold)' }}>{l.currentGoalPrefix(profile.target_role)}</p>
            <button type="button" onClick={() => setSubTab('goal')} className="text-xs font-bold shrink-0" style={{ color: 'var(--darbi-purple)' }}>
              {l.changeGoal}
            </button>
          </div>
        )}
        <p className="text-sm text-gray-300 mb-2">{ladder.summary}</p>
        <p className="text-xs text-gray-500 mb-4">{l.cachedNote}</p>
        {ladder.source === 'fallback' && (
          <p className="text-xs mb-4" style={{ color: 'var(--darbi-gold)' }}>{l.degradedNote}</p>
        )}
        <Button type="button" onClick={() => load(true)} disabled={busy}>
          {busy ? l.regenerating : l.regenerate}
        </Button>
      </Card>

      {ladder.rungs.map((rung, i) => (
        <div key={rung.title}>
          <Card accent={false}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-bold text-white">{rung.title}</p>
                <p className="text-sm text-gray-400 mt-1">{rung.focus}</p>
              </div>
              <span
                className="text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full shrink-0"
                style={{ background: 'color-mix(in srgb, var(--darbi-gold) 15%, transparent)', color: 'var(--darbi-gold)' }}
              >
                {rung.typical_years}
              </span>
            </div>
          </Card>
          {i < ladder.rungs.length - 1 && (
            <div className="flex justify-center py-1 text-gray-500" aria-hidden="true">↓</div>
          )}
        </div>
      ))}
    </>
  );
}

/** The Career Path tab's "Set a Goal" sub-tab — a graduate's own stated target role. */
function GoalForm({ currentGoal, l, onSave }) {
  const [draft, setDraft] = useState(currentGoal ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  async function submit(e) {
    e.preventDefault();
    const targetRole = draft.trim();
    if (!targetRole) return;
    setError('');
    setBusy(true);
    try {
      await onSave(targetRole);
      toast.show(l.goalSavedToast, { kind: 'success' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={l.goalTabLabel} accent={false}>
      <form onSubmit={submit}>
        <Alert>{error}</Alert>
        <Field label={l.goalFieldLabel} hint={l.goalHint}>
          <input className={inputClass} placeholder={l.goalPlaceholder} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
        </Field>
        <Button type="submit" disabled={busy || !draft.trim()}>
          {busy ? l.goalSaving : l.goalSave}
        </Button>
      </form>
    </Card>
  );
}

/**
 * Jobs — the full public jobs catalog (GET /api/jobs, same endpoint the
 * student/company portals use), browsable and searchable rather than the
 * curated top 8-10 Job Recommendations shows. Track application here has no
 * pre-computed score, so the server fills one in automatically (same AI
 * scoring Job Recommendations uses) the moment a graduate applies.
 */
function Jobs() {
  const { t } = useLang();
  const jt = t('career.jobsTab');
  const jm = t('career.jobMatches');
  const toast = useToast();
  const [jobs, setJobs] = useState(null);
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(30);
  const [trackedIds, setTrackedIds] = useState(new Set());
  const [trackingId, setTrackingId] = useState(null);

  useEffect(() => {
    api('/jobs', { auth: false }).then(setJobs).catch(() => setJobs([]));
  }, []);
  useEffect(() => {
    api('/career/applications')
      .then((apps) => setTrackedIds(new Set(apps.filter((a) => a.job_id != null).map((a) => a.job_id))))
      .catch(() => {});
  }, []);

  async function track(job) {
    setTrackingId(job.id);
    try {
      const app = await api('/career/applications', {
        method: 'POST',
        body: { jobId: job.id, companyName: job.company_name, title: job.title },
      });
      setTrackedIds((s) => new Set(s).add(app.job_id));
      toast.show(jm.trackedToast, { kind: 'success' });
    } catch (err) {
      toast.show(err.message, { kind: 'error' });
    } finally {
      setTrackingId(null);
    }
  }

  if (jobs === null) {
    return <Card title={jt.title}><SkeletonLines lines={6} /></Card>;
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? jobs.filter((job) =>
        [job.title, job.company_name, ...(job.required_skills ?? [])].some((v) => v?.toLowerCase().includes(q)),
      )
    : jobs;
  const shown = filtered.slice(0, visible);

  return (
    <>
      <Card title={jt.count(filtered.length)} accent={false}>
        <input
          className={inputClass}
          placeholder={jt.searchPlaceholder}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setVisible(30); }}
        />
      </Card>

      {filtered.length === 0 && <Card><EmptyState icon="💼" title={jt.empty} /></Card>}

      {shown.map((job) => (
        <Card key={job.id} accent={false}>
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="min-w-0">
              <p className="font-bold text-white truncate">{job.title}</p>
              <p className="text-sm text-gray-400">
                {job.company_name}
                {job.location && ` · ${job.location}`}
                {job.salary_raw && ` · ${job.salary_raw}${job.salary_is_estimate ? ` (${jm.estimateBadge})` : ''}`}
              </p>
            </div>
          </div>
          {job.required_skills?.length > 0 && (
            <p className="text-xs text-gray-500 mb-2">{job.required_skills.join(', ')}</p>
          )}
          {trackedIds.has(job.id) ? (
            <span className="text-xs font-bold" style={{ color: 'var(--darbi-success)' }}>{jm.tracked}</span>
          ) : (
            <button type="button" onClick={() => track(job)} disabled={trackingId === job.id} className="text-xs font-bold" style={{ color: 'var(--darbi-purple)' }}>
              {jm.track}
            </button>
          )}
        </Card>
      ))}

      {visible < filtered.length && (
        <div className="flex justify-center">
          <Button type="button" onClick={() => setVisible((v) => v + 30)}>{jt.showMore}</Button>
        </div>
      )}
    </>
  );
}

/**
 * Job Recommendations — the graduate's best-fitting real job listings
 * (POST /api/career/job-matches), each with a match score and a
 * per-requirement ✅/❌ breakdown, not just a plain list. Same cache/degrade
 * pattern as Career Path.
 */
function JobMatches({ onGoToProfile }) {
  const { t } = useLang();
  const j = t('career.jobMatches');
  const toast = useToast();
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); // { code, message } | null
  const [degraded, setDegraded] = useState(false);
  const [trackedIds, setTrackedIds] = useState(new Set());

  function load(refresh) {
    setBusy(refresh);
    setLoading(!refresh);
    setError(null);
    api(`/career/job-matches${refresh ? '?refresh=1' : ''}`, { method: 'POST' })
      .then((r) => {
        setMatches(r.matches);
        setDegraded(r.source === 'fallback');
      })
      .catch((err) => setError({ code: err.code, message: err.message }))
      .finally(() => {
        setLoading(false);
        setBusy(false);
      });
  }

  useEffect(load, []);
  useEffect(() => {
    api('/career/applications')
      .then((apps) => setTrackedIds(new Set(apps.filter((a) => a.job_id != null).map((a) => a.job_id))))
      .catch(() => {});
  }, []);

  async function track(m) {
    try {
      const app = await api('/career/applications', {
        method: 'POST',
        // Already scored on this screen — send it along so the server
        // doesn't pay for a second match call to fill in the same thing.
        body: { jobId: m.job_id, companyName: m.company_name, title: m.title, matchScore: m.match_score, requirements: m.requirements, why: m.why },
      });
      setTrackedIds((s) => new Set(s).add(app.job_id));
      toast.show(j.trackedToast, { kind: 'success' });
    } catch (err) {
      toast.show(err.message, { kind: 'error' });
    }
  }

  if (loading) {
    return <Card title={j.title}><SkeletonLines lines={6} /></Card>;
  }

  if (error?.code === 'profile_incomplete') {
    return (
      <Card title={j.incompleteTitle} accent={false}>
        <p className="text-sm text-gray-400 mb-4">{j.incompleteBody}</p>
        <Button type="button" onClick={onGoToProfile}>{j.goToProfile}</Button>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title={j.errorTitle} accent={false}>
        <Alert>{error.message}</Alert>
        <Button type="button" onClick={() => load(false)}>{j.retry}</Button>
      </Card>
    );
  }

  return (
    <>
      <Card title={j.title} accent={false}>
        {degraded && <p className="text-xs mb-3" style={{ color: 'var(--darbi-gold)' }}>{j.degradedNote}</p>}
        <Button type="button" onClick={() => load(true)} disabled={busy}>
          {busy ? j.regenerating : j.regenerate}
        </Button>
      </Card>

      {matches.length === 0 && <Card><EmptyState icon="🎯" title={j.empty} /></Card>}

      {matches.map((m) => (
        <Card key={m.job_id} accent={false}>
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="min-w-0">
              <p className="font-bold text-white truncate">{m.title}</p>
              <p className="text-sm text-gray-400">
                {m.company_name}
                {m.location && ` · ${m.location}`}
                {m.salary_raw && ` · ${m.salary_raw}${m.salary_is_estimate ? ` (${j.estimateBadge})` : ''}`}
              </p>
            </div>
            <span
              className="text-sm font-extrabold px-3 py-1.5 rounded-full shrink-0"
              style={{ background: 'color-mix(in srgb, var(--darbi-gold) 18%, transparent)', color: 'var(--darbi-gold)' }}
            >
              {j.matchLabel(m.match_score)}
            </span>
          </div>
          <p className="text-sm text-gray-300 mb-3">{m.why}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
            {m.requirements.map((r) => (
              <span key={r.label} className="text-xs text-gray-300 flex items-center gap-1.5">
                <span aria-hidden="true">{r.met ? '✅' : '❌'}</span>
                {r.label}
              </span>
            ))}
          </div>
          {trackedIds.has(m.job_id) ? (
            <span className="text-xs font-bold" style={{ color: 'var(--darbi-success)' }}>{j.tracked}</span>
          ) : (
            <button type="button" onClick={() => track(m)} className="text-xs font-bold" style={{ color: 'var(--darbi-purple)' }}>
              {j.track}
            </button>
          )}
        </Card>
      ))}
    </>
  );
}

const STATUS_ORDER = ['applied', 'under_review', 'interview', 'accepted', 'rejected'];

/**
 * Applications — a graduate's own tracker of jobs they've applied to,
 * grouped by status. Populated either by "Track application" on a Job
 * Recommendations match, or logged manually here for a role found outside
 * DARBI. Status changes and removals save immediately (removal uses the
 * same optimistic-remove + 5s Undo toast pattern used elsewhere, not a
 * confirm dialog).
 */
function Applications() {
  const { t } = useLang();
  const a = t('career.applications');
  const toast = useToast();
  const [apps, setApps] = useState(null);

  useEffect(() => {
    api('/career/applications').then(setApps).catch(() => setApps([]));
  }, []);

  async function changeStatus(app, status) {
    setApps((list) => list.map((x) => (x.id === app.id ? { ...x, status } : x)));
    try {
      await api(`/career/applications/${app.id}`, { method: 'PATCH', body: { status } });
    } catch {
      // Roll back — the change didn't actually take server-side.
      setApps((list) => list.map((x) => (x.id === app.id ? { ...x, status: app.status } : x)));
    }
  }

  function remove(app) {
    setApps((list) => list.filter((x) => x.id !== app.id));
    const timer = setTimeout(() => {
      api(`/career/applications/${app.id}`, { method: 'DELETE' }).catch(() => {});
    }, 5000);
    toast.show(`${app.title} — ${app.company_name}`, {
      kind: 'info',
      duration: 5000,
      action: {
        label: t('common.undo'),
        onClick: () => { clearTimeout(timer); setApps((list) => [app, ...list]); },
      },
    });
  }

  if (apps === null) {
    return <Card title={a.title}><SkeletonLines lines={6} /></Card>;
  }

  const breakdown = STATUS_ORDER
    .map((s) => ({ s, n: apps.filter((x) => x.status === s).length }))
    .filter(({ n }) => n > 0)
    .map(({ s, n }) => `${n} ${a.statusLabels[s]}`)
    .join(', ');

  return (
    <>
      <Card title={a.title} accent={false}>
        <p className="text-sm text-gray-400">{a.subtitle}</p>
        {apps.length > 0 && (
          <p className="text-xs text-gray-500 mt-1.5">{a.summaryCount(apps.length)} · {breakdown}</p>
        )}
      </Card>

      {STATUS_ORDER.map((status) => {
        const inStatus = apps.filter((x) => x.status === status);
        if (inStatus.length === 0) return null;
        return (
          <Card key={status} title={a.statusLabels[status]} accent={false}>
            <div className="divide-y divide-[color:var(--darbi-border)]">
              {inStatus.map((app) => (
                <div key={app.id} className="py-3">
                  <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{app.title}</p>
                      <p className="text-xs text-gray-500">
                        {app.company_name}
                        {app.location && ` · ${app.location}`}
                        {app.salary_raw && ` · ${app.salary_raw}`}
                        {' · '}{a.appliedOn(fmtDate(app.applied_at))}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {app.match_score != null && (
                        <span
                          className="text-xs font-extrabold px-2.5 py-1 rounded-full"
                          style={{ background: 'color-mix(in srgb, var(--darbi-gold) 18%, transparent)', color: 'var(--darbi-gold)' }}
                        >
                          {t('career.jobMatches').matchLabel(app.match_score)}
                        </span>
                      )}
                      <select
                        className={inputClass}
                        value={app.status}
                        onChange={(e) => changeStatus(app, e.target.value)}
                        style={{ minHeight: 0, padding: '6px 10px', width: 'auto' }}
                      >
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>{a.statusLabels[s]}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => remove(app)} className="text-xs text-red-400 hover:text-red-300 font-semibold">
                        {a.remove}
                      </button>
                    </div>
                  </div>
                  {app.why && <p className="text-sm text-gray-300 mb-2">{app.why}</p>}
                  {app.requirements?.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-2">
                      {app.requirements.map((r) => (
                        <span key={r.label} className="text-xs text-gray-300 flex items-center gap-1.5">
                          <span aria-hidden="true">{r.met ? '✅' : '❌'}</span>
                          {r.label}
                        </span>
                      ))}
                    </div>
                  )}
                  {app.notes && <p className="text-xs text-gray-400">{app.notes}</p>}
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      {apps.length === 0 && <Card><EmptyState icon="📥" title={a.empty} /></Card>}
    </>
  );
}

/**
 * AI Assistant — a real Claude conversation grounded in this graduate's own
 * Profile-tab data (education, skills, certificates, projects, experience)
 * plus the verified job catalog. Deliberately its own component/table/route
 * rather than reusing the student advisor (src/components/student/ChatAdvisor.jsx,
 * server/lib/chat.js) — the two are grounded in different data and shouldn't
 * risk changing together.
 */
function AiAssistant({ profile, seed, onSeedConsumed }) {
  const { t } = useLang();
  const c = t('career.chat');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const endRef = useRef(null);

  useEffect(() => {
    api('/career/chat')
      .then((r) => {
        setMessages(r.messages);
        setConfigured(r.configured);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => {
    if (seed) {
      setDraft(seed);
      onSeedConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, streaming]);

  async function send(text) {
    const message = (text ?? draft).trim();
    if (!message || busy) return;

    setDraft('');
    setError('');
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', content: message }]);

    let assembled = '';
    try {
      const res = await fetch('/api/career/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.error) throw new Error(event.error);
          if (event.delta) {
            assembled += event.delta;
            setStreaming(assembled);
          }
        }
      }

      setMessages((m) => [...m, { role: 'assistant', content: assembled }]);
    } catch (err) {
      setError(err.message);
      if (assembled) setMessages((m) => [...m, { role: 'assistant', content: assembled }]);
    } finally {
      setStreaming('');
      setBusy(false);
    }
  }

  async function reset() {
    await api('/career/chat', { method: 'DELETE' });
    setMessages([]);
    setError('');
  }

  if (!configured) {
    return (
      <Alert kind="warn">
        {c.notConfiguredPrefix}<code>ANTHROPIC_API_KEY</code>{c.notConfiguredSuffix} {c.notConfiguredFooter}
      </Alert>
    );
  }

  return (
    <div
      className="flex flex-col overflow-hidden darbi-section"
      style={{ height: '32rem', background: 'var(--darbi-surface)', border: '1px solid var(--darbi-border)', borderRadius: 'var(--darbi-radius)' }}
    >
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--darbi-border)' }}>
        <div>
          <h2 className="font-bold text-darbi-navy">{c.title}</h2>
          <p className="text-xs text-gray-500">{c.subtitle}</p>
        </div>
        {messages.length > 0 && (
          <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-300 shrink-0">
            {c.startOver}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loadingHistory && (
          <div>
            <div className="flex justify-start mb-3"><Skeleton style={{ height: 40, width: '55%', borderRadius: 16 }} /></div>
            <div className="flex justify-end mb-3"><Skeleton style={{ height: 40, width: '40%', borderRadius: 16 }} /></div>
            <div className="flex justify-start mb-3"><Skeleton style={{ height: 40, width: '65%', borderRadius: 16 }} /></div>
          </div>
        )}

        {!loadingHistory && messages.length === 0 && !streaming && (
          <div className="text-center mt-6">
            <div className="text-4xl mb-3">🤖</div>
            <p className="text-gray-200 font-medium mb-1">
              {c.greeting(profile?.name?.split(' ')[0] ?? c.greetingNameFallback)}
            </p>
            <p className="text-sm text-gray-500 mb-5">{c.greetingBody}</p>
            <div className="flex flex-col gap-2 items-center">
              {c.openers.map((o) => (
                <button
                  key={o}
                  onClick={() => send(o)}
                  className="text-sm text-left text-gray-200 px-4 py-2 rounded-full border border-white/10 hover:border-[var(--darbi-purple)] hover:bg-white/5 transition max-w-md w-full"
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <ChatBubble key={i} role={m.role} text={m.content} />
        ))}
        {streaming && <ChatBubble role="assistant" text={streaming} />}
        {busy && !streaming && <ChatBubble role="assistant" text="…" />}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="px-5 pb-2">
          <Alert>{error}</Alert>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="px-5 py-3 flex gap-3"
        style={{ borderTop: '1px solid var(--darbi-border)' }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={c.inputPlaceholder}
          disabled={busy}
          className="darbi-input flex-1"
        />
        <Button type="submit" disabled={busy || !draft.trim()}>
          {busy ? c.sending : c.send}
        </Button>
      </form>
    </div>
  );
}

function ChatBubble({ role, text }) {
  const mine = role === 'user';
  return (
    <div className={`mb-3 flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] px-4 py-2.5 rounded-2xl whitespace-pre-wrap ${
          mine ? 'text-white rounded-br-sm' : 'bg-white/10 text-gray-100 rounded-bl-sm'
        }`}
        style={mine ? { background: 'var(--darbi-gradient)' } : undefined}
      >
        {text}
      </div>
    </div>
  );
}

function TrainingCentres() {
  const { t } = useLang();
  const p = t('career.paths');
  const [centres, setCentres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState(new Set());
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  useEffect(() => {
    api('/career/centres', { auth: false }).then(setCentres).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    api('/career/saved-centres').then((ids) => setSavedIds(new Set(ids))).catch(() => {});
  }, []);

  async function toggleSaved(centreId) {
    const wasSaved = savedIds.has(centreId);
    setSavedIds((s) => {
      const next = new Set(s);
      wasSaved ? next.delete(centreId) : next.add(centreId);
      return next;
    });
    try {
      if (wasSaved) await api(`/career/saved-centres/${centreId}`, { method: 'DELETE' });
      else await api('/career/saved-centres', { method: 'POST', body: { trainingCentreId: centreId } });
    } catch {
      setSavedIds((s) => {
        const next = new Set(s);
        wasSaved ? next.add(centreId) : next.delete(centreId);
        return next;
      });
    }
  }

  const shown = showSavedOnly ? centres.filter((c) => savedIds.has(c.id)) : centres;

  return (
    <>
      <Card title={loading ? t('career.loadingCentres') : t('career.centresCount')(centres.length)}>
        {!loading && (
          <button
            type="button"
            onClick={() => setShowSavedOnly((s) => !s)}
            className="text-xs font-bold"
            style={{ color: showSavedOnly ? 'var(--darbi-gold)' : 'var(--darbi-purple)' }}
          >
            {showSavedOnly ? p.showingSaved : p.showSavedOnly(savedIds.size)}
          </button>
        )}
      </Card>

      <Card>
        {loading && <SkeletonLines lines={5} />}
        {!loading && shown.length === 0 && (
          <EmptyState icon="🏫" title={showSavedOnly ? p.noSavedCentres : t('career.noCentres')} />
        )}
        <div className="divide-y divide-[color:var(--darbi-border)]">
          {shown.map((c) => (
            <div key={c.id} className="py-3">
              <div className="flex items-start justify-between gap-4">
                <p className="font-semibold text-darbi-navy">{c.name}</p>
                <button
                  type="button"
                  onClick={() => toggleSaved(c.id)}
                  className="text-xs font-bold shrink-0"
                  style={{ color: savedIds.has(c.id) ? 'var(--darbi-gold)' : 'var(--darbi-purple)' }}
                >
                  {savedIds.has(c.id) ? p.saved : p.save}
                </button>
              </div>
              <p className="text-sm text-gray-300">{c.field}{c.specialty && ` · ${c.specialty}`}</p>
              {c.location && <p className="text-xs text-gray-500 mt-1">{c.location}</p>}
              {c.notes && <p className="text-sm text-gray-500 mt-1">{c.notes}</p>}
              {c.website && (
                <a
                  href={c.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs underline mt-1 inline-block"
                  style={{ color: 'var(--darbi-purple)' }}
                >
                  {c.website}
                </a>
              )}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Everything a graduate can fill in about themselves: a headline, education,
 * skills, certificates, projects, work experience, career interests, and
 * the CV file itself. Each card saves independently with one
 * PUT /career/me call carrying just that section's field(s) — the route
 * COALESCEs, so saving Skills never touches Certificates, etc.
 */
function Profile() {
  const { profile, setProfile } = useAuth();
  const { t } = useLang();
  const p = t('career.profile');

  async function saveFields(body) {
    const updated = await api('/career/me', { method: 'PUT', body });
    setProfile(updated);
    return updated;
  }

  return (
    <>
      <HeadlineCard profile={profile} onSave={saveFields} p={p} />
      <EducationCard profile={profile} onSave={saveFields} p={p} />
      <TagListCard
        title={p.skillsTitle}
        value={profile?.skills ?? []}
        placeholder={p.skillsPlaceholder}
        emptyLabel={p.skillsEmpty}
        p={p}
        onSave={(skills) => saveFields({ skills })}
      />
      <EntryListEditor
        title={p.certificatesTitle}
        entries={profile?.certificates ?? []}
        emptyLabel={p.certEmpty}
        p={p}
        fields={[
          { key: 'name', label: p.certName, required: true },
          { key: 'issuer', label: p.certIssuer },
          { key: 'year', label: p.certYear, type: 'number' },
        ]}
        summarize={(e) => p.certSummary(e.name, e.issuer)}
        onSave={(certificates) => saveFields({ certificates })}
      />
      <EntryListEditor
        title={p.projectsTitle}
        entries={profile?.projects ?? []}
        emptyLabel={p.projectEmpty}
        p={p}
        fields={[
          { key: 'title', label: p.projectTitle, required: true },
          { key: 'description', label: p.projectDescription, multiline: true },
          { key: 'link', label: p.projectLink },
        ]}
        summarize={(e) => e.title}
        onSave={(projects) => saveFields({ projects })}
      />
      <EntryListEditor
        title={p.experienceTitle}
        entries={profile?.experience ?? []}
        emptyLabel={p.expEmpty}
        p={p}
        fields={[
          { key: 'title', label: p.expTitle, required: true },
          { key: 'company', label: p.expCompany },
          { key: 'period', label: p.expPeriod, placeholder: p.expPeriodPlaceholder },
          { key: 'description', label: p.expDescription, multiline: true },
        ]}
        summarize={(e) => p.expSummary(e.title, e.company)}
        onSave={(experience) => saveFields({ experience })}
      />
      <CvFileCard profile={profile} setProfile={setProfile} p={p} />
      <TagListCard
        title={p.interestsTitle}
        value={profile?.career_goals ?? []}
        placeholder={p.interestsPlaceholder}
        emptyLabel={p.interestsEmpty}
        p={p}
        onSave={(careerGoals) => saveFields({ careerGoals })}
      />
    </>
  );
}

/** Current role + years of experience — the two fields Overview also shows. */
function HeadlineCard({ profile, onSave, p }) {
  const { t } = useLang();
  const currentRoleLabel = t('career.currentRole');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  function startEdit() {
    setForm({ currentTitle: profile?.current_title ?? '', yearsExperience: profile?.years_experience ?? '' });
    setError('');
    setEditing(true);
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onSave({
        currentTitle: form.currentTitle || null,
        yearsExperience: form.yearsExperience === '' ? null : Number(form.yearsExperience),
      });
      toast.show(p.savedToast, { kind: 'success' });
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <Card title={p.headlineTitle} accent={false}>
        <dl className="text-sm space-y-2.5 mb-5">
          <RowLabelValue label={currentRoleLabel} value={profile?.current_title || p.notSet} />
          <RowLabelValue
            label={p.yearsExperience}
            value={profile?.years_experience != null ? String(profile.years_experience) : p.notSet}
          />
        </dl>
        <button type="button" onClick={startEdit} className="text-xs font-bold" style={{ color: 'var(--darbi-purple)' }}>
          {p.edit}
        </button>
      </Card>
    );
  }

  return (
    <Card title={p.headlineTitle} accent={false}>
      <form onSubmit={submit}>
        <Alert>{error}</Alert>
        <Field label={currentRoleLabel}>
          <input className={inputClass} value={form.currentTitle} onChange={(e) => setForm({ ...form, currentTitle: e.target.value })} />
        </Field>
        <Field label={p.yearsExperience}>
          <input
            type="number"
            min="0"
            className={inputClass}
            value={form.yearsExperience}
            onChange={(e) => setForm({ ...form, yearsExperience: e.target.value })}
          />
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>{busy ? p.saving : p.save}</Button>
          <button type="button" onClick={() => setEditing(false)} disabled={busy} className="text-xs text-gray-400 hover:text-gray-200">
            {p.cancel}
          </button>
        </div>
      </form>
    </Card>
  );
}

/** University, major, year graduated. */
function EducationCard({ profile, onSave, p }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  function startEdit() {
    setForm({
      university: profile?.university ?? '',
      major: profile?.major ?? '',
      yearGraduated: profile?.year_graduated ?? '',
    });
    setError('');
    setEditing(true);
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onSave({
        university: form.university || null,
        major: form.major || null,
        yearGraduated: form.yearGraduated === '' ? null : Number(form.yearGraduated),
      });
      toast.show(p.savedToast, { kind: 'success' });
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <Card title={p.educationTitle} accent={false}>
        <dl className="text-sm space-y-2.5 mb-5">
          <RowLabelValue label={p.university} value={profile?.university || p.notSet} />
          <RowLabelValue label={p.major} value={profile?.major || p.notSet} />
          <RowLabelValue label={p.yearGraduated} value={profile?.year_graduated ?? p.notSet} />
        </dl>
        <button type="button" onClick={startEdit} className="text-xs font-bold" style={{ color: 'var(--darbi-purple)' }}>
          {p.edit}
        </button>
      </Card>
    );
  }

  return (
    <Card title={p.educationTitle} accent={false}>
      <form onSubmit={submit}>
        <Alert>{error}</Alert>
        <Field label={p.university}>
          <input className={inputClass} placeholder={p.universityPlaceholder} value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} />
        </Field>
        <Field label={p.major}>
          <input className={inputClass} placeholder={p.majorPlaceholder} value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })} />
        </Field>
        <Field label={p.yearGraduated}>
          <input
            type="number"
            min="1950"
            max={new Date().getFullYear() + 10}
            className={inputClass}
            value={form.yearGraduated}
            onChange={(e) => setForm({ ...form, yearGraduated: e.target.value })}
          />
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>{busy ? p.saving : p.save}</Button>
          <button type="button" onClick={() => setEditing(false)} disabled={busy} className="text-xs text-gray-400 hover:text-gray-200">
            {p.cancel}
          </button>
        </div>
      </form>
    </Card>
  );
}

/** A simple comma-separated string list — used for Skills and Career interests. */
function TagListCard({ title, value, placeholder, emptyLabel, p, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  function startEdit() {
    setDraft(value.join(', '));
    setError('');
    setEditing(true);
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onSave(draft.split(',').map((s) => s.trim()).filter(Boolean));
      toast.show(p.savedToast, { kind: 'success' });
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <Card title={title} accent={false}>
        {value.length === 0 ? (
          <p className="text-sm text-gray-500 italic mb-4">{emptyLabel}</p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-4">
            {value.map((s) => (
              <span
                key={s}
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'color-mix(in srgb, var(--darbi-purple) 15%, transparent)', color: 'var(--darbi-purple)' }}
              >
                {s}
              </span>
            ))}
          </div>
        )}
        <button type="button" onClick={startEdit} className="text-xs font-bold" style={{ color: 'var(--darbi-purple)' }}>
          {p.edit}
        </button>
      </Card>
    );
  }

  return (
    <Card title={title} accent={false}>
      <form onSubmit={submit}>
        <Alert>{error}</Alert>
        <Field label={title} hint={p.tagsHint}>
          <input className={inputClass} placeholder={placeholder} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>{busy ? p.saving : p.save}</Button>
          <button type="button" onClick={() => setEditing(false)} disabled={busy} className="text-xs text-gray-400 hover:text-gray-200">
            {p.cancel}
          </button>
        </div>
      </form>
    </Card>
  );
}

/**
 * A list of structured entries (Certificates / Projects / Experience) —
 * each entry is a small form of its own `fields`. Adding, editing, and
 * removing an entry all save the whole list in one PUT /career/me call.
 * Removal uses the same optimistic-remove + 5s "Undo" toast pattern used
 * for company job postings and admin user deletes, instead of a confirm
 * dialog.
 */
function EntryListEditor({ title, entries, emptyLabel, fields, summarize, p, onSave }) {
  const [formIndex, setFormIndex] = useState(null); // null = closed, -1 = adding, n = editing entries[n]
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Entries mid-"Undo" window: hidden immediately, but not actually saved
  // out of `entries` until the 5s timer fires, so Undo just clears the
  // timer with nothing to re-add.
  const [pendingRemovals, setPendingRemovals] = useState(new Set());
  const toast = useToast();

  function startAdd() {
    setForm(Object.fromEntries(fields.map((f) => [f.key, ''])));
    setError('');
    setFormIndex(-1);
  }

  function startEdit(i) {
    setForm(Object.fromEntries(fields.map((f) => [f.key, entries[i][f.key] ?? ''])));
    setError('');
    setFormIndex(i);
  }

  async function submit(e) {
    e.preventDefault();
    for (const f of fields) {
      if (f.required && !String(form[f.key] ?? '').trim()) {
        setError(p.requiredField(f.label));
        return;
      }
    }
    setError('');
    setBusy(true);
    const entry = Object.fromEntries(fields.map((f) => [f.key, String(form[f.key] ?? '').trim()]));
    const next = formIndex === -1 ? [...entries, entry] : entries.map((e2, i) => (i === formIndex ? entry : e2));
    try {
      await onSave(next);
      toast.show(p.savedToast, { kind: 'success' });
      setFormIndex(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function remove(i) {
    const removed = entries[i];
    setPendingRemovals((s) => new Set(s).add(removed));
    const timer = setTimeout(() => {
      onSave(entries.filter((e) => e !== removed)).catch(() => {
        setPendingRemovals((s) => { const next = new Set(s); next.delete(removed); return next; });
      });
    }, 5000);
    toast.show(summarize(removed), {
      kind: 'info',
      duration: 5000,
      action: {
        label: p.cancel,
        onClick: () => {
          clearTimeout(timer);
          setPendingRemovals((s) => { const next = new Set(s); next.delete(removed); return next; });
        },
      },
    });
  }

  const visible = entries.filter((e) => !pendingRemovals.has(e));

  return (
    <Card title={title} accent={false}>
      <Alert>{error}</Alert>
      {visible.length === 0 && formIndex === null && <p className="text-sm text-gray-500 italic mb-4">{emptyLabel}</p>}

      {formIndex === null && visible.length > 0 && (
        <div className="divide-y divide-[color:var(--darbi-border)] mb-4">
          {entries.map((entry, i) => (
            pendingRemovals.has(entry) ? null : (
              <div key={i} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{summarize(entry)}</p>
                  {entry.period && <p className="text-xs text-gray-500">{entry.period}</p>}
                  {entry.year && !entry.period && <p className="text-xs text-gray-500">{entry.year}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button type="button" onClick={() => startEdit(i)} className="text-xs font-bold" style={{ color: 'var(--darbi-purple)' }}>
                    {p.edit}
                  </button>
                  <button type="button" onClick={() => remove(i)} className="text-xs font-bold text-red-400 hover:text-red-300">
                    {p.remove}
                  </button>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {formIndex !== null ? (
        <form onSubmit={submit}>
          {fields.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.multiline ? (
                <textarea
                  className={inputClass}
                  rows={3}
                  placeholder={f.placeholder}
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              ) : (
                <input
                  type={f.type ?? 'text'}
                  className={inputClass}
                  placeholder={f.placeholder}
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  autoFocus={f === fields[0]}
                />
              )}
            </Field>
          ))}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={busy}>{busy ? p.saving : p.save}</Button>
            <button type="button" onClick={() => setFormIndex(null)} disabled={busy} className="text-xs text-gray-400 hover:text-gray-200">
              {p.cancel}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={startAdd} className="text-xs font-bold" style={{ color: 'var(--darbi-purple)' }}>
          + {p.add}
        </button>
      )}
    </Card>
  );
}

/** Upload / view / replace / remove the actual CV file (PDF, up to 4MB). */
function CvFileCard({ profile, setProfile, p }) {
  const { lang } = useLang();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  async function onFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const dataUri = await readCvFile(file, lang);
      const updated = await api('/career/cv', { method: 'PUT', body: { file: dataUri, filename: file.name } });
      setProfile(updated);
      toast.show(p.cvUpdated, { kind: 'success' });
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
      const updated = await api('/career/cv', { method: 'DELETE' });
      setProfile(updated);
      toast.show(p.cvRemoved, { kind: 'success' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={p.fileTitle} accent={false}>
      <Alert>{error}</Alert>
      {profile?.cv ? (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="font-semibold text-white truncate">{profile.cv_filename || 'CV.pdf'}</p>
            {profile.cv_uploaded_at && <p className="text-xs text-gray-500">{p.uploadedAt(fmtDate(profile.cv_uploaded_at))}</p>}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <a href={profile.cv} target="_blank" rel="noopener noreferrer" className="text-xs font-bold" style={{ color: 'var(--darbi-purple)' }}>
              {p.view}
            </a>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="text-xs font-bold" style={{ color: 'var(--darbi-purple)' }}>
              {p.replace}
            </button>
            <button type="button" onClick={onRemove} disabled={busy} className="text-xs font-bold text-red-400 hover:text-red-300">
              {p.remove}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-gray-400">{p.noFile}</p>
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
            {p.upload}
          </Button>
        </div>
      )}
      <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={onFileChange} />
    </Card>
  );
}

function RowLabelValue({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-white font-medium text-right">{value}</dd>
    </div>
  );
}
