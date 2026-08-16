import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../services/auth.jsx';
import { Alert, Button, Card, EmptyState, Field, Shell, Skeleton, SkeletonLines, inputClass } from '../components/common/ui.jsx';
import { useToast } from '../components/common/toast.jsx';
import { useLang } from '../i18n/index.jsx';

const TABS = ['overview', 'jobs', 'find students'];

// The Jobs tab's own mini-tab bar — My Jobs first (what you'd check first
// on landing), Create a Job second, matching how the two were ordered as
// separate top-level tabs before they were merged under one Jobs tab.
// Values match src/i18n/dict/common.js's `tabs` map keys directly (unlike
// Shell's own tabs, which go through ui.jsx's private tabKey() helper).
const JOBS_SUBTABS = [
  { id: 'my jobs', labelKey: 'myJobs' },
  { id: 'post a job', labelKey: 'postAJob' },
];

// Display order for My Jobs' filter pills — Active, Draft, Closed, matching
// how a company actually scans postings (what's live first).
const JOB_FILTER_ORDER = ['active', 'draft', 'closed'];

const EMPLOYMENT_TYPES = [
  { value: 'Full-time', key: 'fullTime' },
  { value: 'Part-time', key: 'partTime' },
  { value: 'Internship', key: 'internship' },
  { value: 'Contract', key: 'contract' },
];

// Qualitative read on the AI Match % (server/routes/companies.js's
// computeAiMatch) — shown as "94% — Strong Match" everywhere a match score
// appears (My Jobs' applicant list, Overview's Recent Applications table),
// so the number always comes with a plain-language sense of how good it is.
function matchLabelKey(score) {
  if (score >= 90) return 'strong';
  if (score >= 75) return 'good';
  if (score >= 60) return 'fair';
  return 'weak';
}
const MATCH_LABEL_COLOR = {
  strong: 'var(--darbi-success)',
  good: 'var(--darbi-gold)',
  fair: 'var(--darbi-purple)',
  weak: 'var(--darbi-text-muted)',
};

function MatchScore({ score }) {
  const { t } = useLang();
  const key = matchLabelKey(score);
  return (
    <span className="whitespace-nowrap">
      <span style={{ color: 'var(--darbi-gold)' }} className="font-semibold">{score}%</span>
      <span className="text-gray-500"> — </span>
      <span style={{ color: MATCH_LABEL_COLOR[key] }} className="font-semibold">{t(`company.matchLabel.${key}`)}</span>
    </span>
  );
}

// Mirrors server/routes/companies.js's APPLICATION_STATUSES — kept in this
// order everywhere a status appears (the select in My Jobs, the badge in
// Overview) so the pipeline always reads left-to-right the same way.
const APPLICATION_STATUSES = ['screening', 'shortlisted', 'interview', 'hired', 'rejected'];
const STATUS_COLOR = {
  screening: 'var(--darbi-text-muted)',
  shortlisted: 'var(--darbi-purple)',
  interview: 'var(--darbi-gold)',
  hired: 'var(--darbi-success)',
  rejected: 'var(--darbi-error)',
};

function StatusBadge({ status }) {
  const { t } = useLang();
  const color = STATUS_COLOR[status] ?? STATUS_COLOR.screening;
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block whitespace-nowrap"
      style={{ color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}
    >
      {t(`company.status.${status}`)}
    </span>
  );
}

// A job posting's own lifecycle (My Jobs' Active/Draft/Closed filter) —
// distinct from APPLICATION_STATUSES above, which is one applicant's stage
// within a job. Mirrors server/routes/companies.js's JOB_STATUSES.
const JOB_STATUSES = ['draft', 'active', 'closed'];
const JOB_STATUS_COLOR = {
  draft: 'var(--darbi-text-muted)',
  active: 'var(--darbi-success)',
  closed: 'var(--darbi-error)',
};

function JobStatusBadge({ status }) {
  const { t } = useLang();
  const color = JOB_STATUS_COLOR[status] ?? JOB_STATUS_COLOR.draft;
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block whitespace-nowrap shrink-0"
      style={{ color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}
    >
      {t(`company.jobStatus.${status}`)}
    </span>
  );
}

export default function CompanyDashboard() {
  const { profile } = useAuth();
  const { t } = useLang();
  const [tab, setTab] = useState('overview');

  return (
    <Shell
      title={`${profile?.name ?? t('company.companyFallback')} 🏢`}
      subtitle={profile?.industry}
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
    >
      {tab === 'overview' && <Overview />}
      {tab === 'jobs' && <JobsTab />}
      {tab === 'find students' && <FindStudents />}
    </Shell>
  );
}

/** My Jobs and Create a Job, merged under one top-level tab as a pair of
 * mini-tabs — same pill-switcher visual as My Jobs' own Active/Draft/Closed
 * filter, one level smaller than Shell's main tab bar so the hierarchy
 * reads at a glance. */
function JobsTab() {
  const { t } = useLang();
  const [subTab, setSubTab] = useState('my jobs');

  return (
    <div>
      <div
        className="flex rounded-full p-1 mb-6 w-fit mx-auto"
        style={{ background: 'color-mix(in srgb, var(--darbi-bg) 55%, black 10%)', border: '1px solid var(--darbi-border)' }}
      >
        {JOBS_SUBTABS.map(({ id, labelKey }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition ${
              subTab === id ? 'text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
            style={subTab === id ? { background: 'var(--darbi-gradient)' } : undefined}
          >
            {t(`common.tabs.${labelKey}`)}
          </button>
        ))}
      </div>

      {subTab === 'my jobs' && <MyJobs />}
      {subTab === 'post a job' && <PostJob />}
    </div>
  );
}

/** Five stat tiles + a Recent Applications table — the company's landing
 * view, same "stat grid + table" shape as AdminDashboard's own Overview tab. */
function Overview() {
  const { t } = useLang();
  const [data, setData] = useState(null);

  useEffect(() => {
    api('/companies/me/overview').then(setData).catch(() => {});
  }, []);

  if (!data) {
    return (
      <Card title={t('company.overview.loading')}>
        <SkeletonLines lines={6} />
      </Card>
    );
  }

  const tiles = [
    { label: t('company.overview.activeJobs'), value: data.activeJobs },
    { label: t('company.overview.totalApplications'), value: data.totalApplications },
    { label: t('company.overview.shortlisted'), value: data.shortlisted },
    { label: t('company.overview.interviews'), value: data.interviews },
    { label: t('company.overview.hired'), value: data.hired },
  ];

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {tiles.map((c) => (
          <div key={c.label} className="darbi-box">
            <p className="text-3xl font-bold" style={{ color: 'var(--darbi-gold)' }}>
              {c.value}
            </p>
            <p className="text-sm text-gray-400 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <Card title={t('company.overview.recentApplicationsTitle')} accent={false}>
        {data.recentApplications.length === 0 ? (
          <EmptyState icon="📥" title={t('company.overview.emptyTitle')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs uppercase tracking-wide text-gray-500" style={{ borderBottom: '1px solid var(--darbi-border)' }}>
                  <th className="pb-2 pe-4 font-semibold">{t('company.overview.candidateHeader')}</th>
                  <th className="pb-2 pe-4 font-semibold">{t('company.overview.positionHeader')}</th>
                  <th className="pb-2 pe-4 font-semibold">{t('company.overview.aiMatchHeader')}</th>
                  <th className="pb-2 font-semibold">{t('company.overview.statusHeader')}</th>
                </tr>
              </thead>
              <tbody>
                {data.recentApplications.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--darbi-border)' }}>
                    <td className="py-2.5 pe-4 font-medium text-darbi-navy whitespace-nowrap">{a.candidateName}</td>
                    <td className="py-2.5 pe-4 text-gray-300">{a.position}</td>
                    <td className="py-2.5 pe-4"><MatchScore score={a.aiMatch} /></td>
                    <td className="py-2.5"><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

/**
 * A split view — form on the left, a live preview of the listing on the
 * right — rather than a plain stacked form. This is what makes posting a
 * job feel like a company workspace instead of a student profile form
 * wearing a different set of field labels.
 */
function PostJob() {
  const { t } = useLang();
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save(status) {
    setError('');
    setBusy(true);
    try {
      const job = await api('/companies/me/jobs', {
        method: 'POST',
        body: {
          title: form.title,
          requiredMajors: (form.majors ?? '').split(',').map((s) => s.trim()).filter(Boolean),
          minGpa: form.minGpa === '' || form.minGpa == null ? null : Number(form.minGpa),
          salaryRange: form.salary || null,
          requiredSkills: (form.skills ?? '').split(',').map((s) => s.trim()).filter(Boolean),
          location: form.location || null,
          description: form.description || null,
          responsibilities: form.responsibilities || null,
          yearsExperience: form.yearsExperience || null,
          education: form.education || null,
          employmentType: form.employmentType || null,
          status,
        },
      });
      const message = status === 'draft' ? t('company.postJob.drafted') : t('company.postJob.posted');
      toast.show(message(job.title), { kind: 'success' });
      setForm({});
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    save('active');
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <Card title={t('company.postJob.cardTitle')}>
        <Alert>{error}</Alert>
        <form onSubmit={submit}>
          <Field label={t('company.postJob.jobTitleLabel')}>
            <input className={inputClass} value={form.title ?? ''} onChange={set('title')} required />
          </Field>
          <Field label={t('company.postJob.descriptionLabel')}>
            <textarea rows="3" className={inputClass} value={form.description ?? ''} onChange={set('description')} />
          </Field>
          <Field label={t('company.postJob.responsibilitiesLabel')} hint={t('company.postJob.responsibilitiesHint')}>
            <textarea rows="3" className={inputClass} value={form.responsibilities ?? ''} onChange={set('responsibilities')} />
          </Field>
          <div className="mb-4">
            <span className="block text-gray-300 font-bold mb-1.5 text-sm">{t('company.postJob.requirementsLabel')}</span>
            <div className="space-y-3 p-3 rounded-lg" style={{ border: '1px solid var(--darbi-border)' }}>
              <label className="block">
                <span className="block text-xs font-semibold text-gray-400 mb-1">{t('company.postJob.skillsLabel')}</span>
                <input className={inputClass} placeholder={t('company.postJob.skillsPlaceholder')} value={form.skills ?? ''} onChange={set('skills')} />
                <span className="block text-xs text-gray-500 mt-1">{t('company.postJob.skillsHint')}</span>
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-gray-400 mb-1">{t('company.postJob.majorsLabel')}</span>
                <input className={inputClass} placeholder={t('company.postJob.majorsPlaceholder')} value={form.majors ?? ''} onChange={set('majors')} />
                <span className="block text-xs text-gray-500 mt-1">{t('company.postJob.majorsHint')}</span>
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-gray-400 mb-1">{t('company.postJob.yearsExperienceLabel')}</span>
                <input className={inputClass} placeholder={t('company.postJob.yearsExperiencePlaceholder')} value={form.yearsExperience ?? ''} onChange={set('yearsExperience')} />
              </label>
            </div>
          </div>
          <Field label={t('company.postJob.educationLabel')}>
            <input className={inputClass} placeholder={t('company.postJob.educationPlaceholder')} value={form.education ?? ''} onChange={set('education')} />
          </Field>
          <Field label={t('company.postJob.minGpaLabel')} hint={t('company.postJob.minGpaHint')}>
            <input type="number" step="0.01" min="0" max="4" className={inputClass} value={form.minGpa ?? ''} onChange={set('minGpa')} />
          </Field>
          <Field label={t('company.postJob.locationLabel')}>
            <input className={inputClass} placeholder={t('company.postJob.locationPlaceholder')} value={form.location ?? ''} onChange={set('location')} />
          </Field>
          <Field label={t('company.postJob.employmentTypeLabel')}>
            <select className={inputClass} value={form.employmentType ?? ''} onChange={set('employmentType')}>
              <option value="">—</option>
              {EMPLOYMENT_TYPES.map(({ value, key }) => (
                <option key={value} value={value}>
                  {t(`company.postJob.employmentTypeOptions.${key}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('company.postJob.salaryLabel')} hint={t('company.postJob.salaryHint')}>
            <input className={inputClass} value={form.salary ?? ''} onChange={set('salary')} />
          </Field>

          <div className="flex items-center gap-3 mt-2">
            <Button type="button" variant="navy" disabled={busy} onClick={() => save('draft')}>
              {t('company.postJob.saveDraftBtn')}
            </Button>
            <Button type="submit" disabled={busy}>
              {t('company.postJob.publishBtn')}
            </Button>
          </div>
        </form>
      </Card>

      <JobPreview form={form} />
    </div>
  );
}

function JobPreview({ form }) {
  const { t } = useLang();
  const majors = (form.majors ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const skills = (form.skills ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <div className="lg:sticky lg:top-6">
      <p className="text-xs uppercase tracking-wide text-gray-500 mb-2 px-1">{t('company.preview.label')}</p>
      <article className="darbi-box" style={{ borderTop: '4px solid var(--darbi-gold)' }}>
        <h3 className="text-lg font-bold text-darbi-navy uppercase tracking-wide mb-1">
          {form.title || t('company.preview.titlePlaceholder')}
        </h3>
        <p className="text-sm text-gray-500 mb-3">{form.location || t('company.preview.locationNotSet')}</p>

        <dl className="text-sm space-y-1.5 mb-4">
          <div className="flex gap-2">
            <dt className="font-bold text-darbi-navy shrink-0">{t('company.preview.salaryLabel')}</dt>
            <dd style={{ color: 'var(--darbi-gold)' }} className="font-semibold">
              {form.salary || <span className="text-gray-500 italic font-normal">{t('company.preview.salaryNotSet')}</span>}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-bold text-darbi-navy shrink-0">{t('company.preview.majorsLabel')}</dt>
            <dd className="text-gray-300">
              {majors.length ? majors.join(', ') : <span className="text-gray-500 italic">{t('company.preview.anyMajor')}</span>}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-bold text-darbi-navy shrink-0">{t('company.preview.minGpaLabel')}</dt>
            <dd className="text-gray-300">{form.minGpa || <span className="text-gray-500 italic">{t('company.preview.none')}</span>}</dd>
          </div>
          {form.employmentType && (
            <div className="flex gap-2">
              <dt className="font-bold text-darbi-navy shrink-0">{t('company.preview.employmentTypeLabel')}</dt>
              <dd className="text-gray-300">{form.employmentType}</dd>
            </div>
          )}
          {form.yearsExperience && (
            <div className="flex gap-2">
              <dt className="font-bold text-darbi-navy shrink-0">{t('company.preview.experienceLabel')}</dt>
              <dd className="text-gray-300">{form.yearsExperience}</dd>
            </div>
          )}
          {form.education && (
            <div className="flex gap-2">
              <dt className="font-bold text-darbi-navy shrink-0">{t('company.preview.educationLabel')}</dt>
              <dd className="text-gray-300">{form.education}</dd>
            </div>
          )}
        </dl>

        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {skills.map((s) => (
              <span key={s} className="text-xs px-2 py-1 rounded-full bg-white/10 text-gray-200">
                {s}
              </span>
            ))}
          </div>
        )}

        {form.description && <p className="text-sm text-gray-300 mb-3">{form.description}</p>}
        {form.responsibilities && (
          <p className="text-sm text-gray-300 whitespace-pre-line">{form.responsibilities}</p>
        )}
      </article>
    </div>
  );
}

/** A grid of posting cards, not a divided list — a company scans several
 * open roles at once, closer to an ATS dashboard than a single profile. */
function MyJobs() {
  const { t } = useLang();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const toast = useToast();
  const load = () => api('/companies/me/jobs').then(setJobs).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  // Optimistic remove + a 5s "Undo" toast, instead of a confirm dialog before
  // every delete: the row disappears immediately, and the real DELETE only
  // fires once that window passes -- Undo just cancels the pending call and
  // puts the row back, so there's nothing to "reverse" server-side.
  function remove(job) {
    setJobs((js) => js.filter((x) => x.id !== job.id));
    const timer = setTimeout(() => {
      api(`/companies/me/jobs/${job.id}`, { method: 'DELETE' }).catch(() => {});
    }, 5000);
    toast.show(t('company.myJobs.deleted')(job.title), {
      kind: 'info',
      duration: 5000,
      action: {
        label: t('common.undo'),
        onClick: () => {
          clearTimeout(timer);
          setJobs((js) => [job, ...js]);
        },
      },
    });
  }

  function updateJob(updated) {
    setJobs((js) => js.map((j) => (j.id === updated.id ? { ...j, ...updated } : j)));
  }

  const filteredJobs = jobs.filter((j) => (j.status ?? 'active') === filter);

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-lg font-bold text-darbi-navy">
          {loading ? t('company.myJobs.loading') : t('company.myJobs.count')(filteredJobs.length, t(`company.jobStatus.${filter}`))}
        </h2>
        <div
          className="flex rounded-full p-1 shrink-0"
          style={{ background: 'color-mix(in srgb, var(--darbi-bg) 55%, black 10%)', border: '1px solid var(--darbi-border)' }}
        >
          {JOB_FILTER_ORDER.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                filter === f ? 'text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
              style={filter === f ? { background: 'var(--darbi-gradient)' } : undefined}
            >
              {t(`company.jobStatus.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} style={{ height: 140 }} />)}
        </div>
      )}

      {!loading && filteredJobs.length === 0 && (
        <Card>
          <EmptyState icon="📋" title={t('company.myJobs.emptyTitle')} />
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {filteredJobs.map((j) => (
          <JobPosting key={j.id} job={j} onRemove={remove} onStatusChange={updateJob} />
        ))}
      </div>
    </>
  );
}

// Which action moves a posting forward from its current status, and the
// toast copy for it — draft's next stop is active, active's is closed,
// closed can only go back to active (no "un-close to draft").
const NEXT_JOB_STATUS = { draft: 'active', active: 'closed', closed: 'active' };
const JOB_STATUS_ACTION_LABEL = { draft: 'publish', active: 'close', closed: 'reopen' };
const JOB_STATUS_TOAST = { draft: 'published', active: 'closed', closed: 'reopened' };

function JobPosting({ job: j, onRemove, onStatusChange }) {
  const { t } = useLang();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [applicants, setApplicants] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);

  async function toggle() {
    if (open) return setOpen(false);
    setOpen(true);
    if (!applicants) {
      api(`/companies/me/jobs/${j.id}/applicants`).then(setApplicants).catch(() => setApplicants([]));
    }
  }

  async function advanceStatus() {
    const nextStatus = NEXT_JOB_STATUS[j.status ?? 'active'];
    setStatusBusy(true);
    try {
      const updated = await api(`/companies/me/jobs/${j.id}/status`, { method: 'PUT', body: { status: nextStatus } });
      onStatusChange(updated);
      toast.show(t(`company.myJobs.${JOB_STATUS_TOAST[j.status ?? 'active']}`)(j.title), { kind: 'success' });
    } catch (err) {
      toast.show(err.message ?? t('company.myJobs.jobStatusUpdateError'), { kind: 'error' });
    } finally {
      setStatusBusy(false);
    }
  }

  // Optimistic — the dropdown flips immediately, and only rolls back if the
  // PUT actually fails, same pattern as the job-delete Undo toast above.
  async function changeStatus(studentUserId, status, note) {
    const previous = applicants;
    setApplicants((list) => list.map((a) => (a.user_id === studentUserId ? { ...a, status, ...(note != null ? { company_note: note } : {}) } : a)));
    try {
      await api(`/companies/me/jobs/${j.id}/applicants/${studentUserId}`, { method: 'PUT', body: { status, note } });
      if (status === 'interview') toast.show(t('company.jobPosting.invited'), { kind: 'success' });
    } catch (err) {
      setApplicants(previous);
      toast.show(err.message ?? t('company.jobPosting.statusUpdateError'), { kind: 'error' });
    }
  }

  return (
    <div className="darbi-box flex flex-col">
      <div className="flex justify-between items-start gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-semibold text-darbi-navy truncate">{j.title}</p>
          <JobStatusBadge status={j.status ?? 'active'} />
        </div>
        <button
          onClick={() => onRemove(j)}
          className="text-xs text-red-400 hover:text-red-300 font-semibold shrink-0 transition"
        >
          {t('common.delete')}
        </button>
      </div>
      <p className="text-sm text-gray-300 mb-1">
        {j.required_majors?.join(', ') || t('company.preview.anyMajor')}
      </p>
      <p className="text-xs text-gray-500">
        {j.min_gpa && t('company.jobPosting.minGpa')(j.min_gpa)}
        {j.min_gpa && j.salary_raw && ' · '}
        {j.salary_raw && t('company.jobPosting.salary')(j.salary_raw)}
      </p>

      <div className="flex items-center justify-between gap-2 mt-3">
        <button onClick={toggle} className="text-xs font-semibold text-start" style={{ color: 'var(--darbi-purple)' }}>
          {t('company.jobPosting.applicants')(j.applicant_count)} {open ? '▲' : '▼'}
        </button>
        <button
          type="button"
          onClick={advanceStatus}
          disabled={statusBusy}
          className="text-xs font-semibold rounded-full px-3 py-1 border transition hover:brightness-110 disabled:opacity-50 shrink-0"
          style={{ borderColor: 'var(--darbi-border)', color: JOB_STATUS_COLOR[NEXT_JOB_STATUS[j.status ?? 'active']] }}
        >
          {t(`company.myJobs.${JOB_STATUS_ACTION_LABEL[j.status ?? 'active']}`)}
        </button>
      </div>

      {open && (
        <div className="mt-2 pt-2 space-y-2" style={{ borderTop: '1px solid var(--darbi-border)' }}>
          {applicants === null && <p className="text-xs text-gray-500">{t('common.loading')}</p>}
          {applicants?.length === 0 && <p className="text-xs text-gray-500">{t('company.jobPosting.noApplicants')}</p>}
          {applicants?.map((s) => (
            <ApplicantRow key={s.user_id} applicant={s} onChangeStatus={(status, note) => changeStatus(s.user_id, status, note)} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One applicant in the expanded list. Collapsed, it's the same name/level/
 * GPA/location/AI-match/status-dropdown row as before. Expanded, it adds
 * major, interests, and applied date (already returned by the applicants
 * endpoint, just not previously rendered), plus a short note the company
 * can attach when moving someone to Interview — the "send an invitation"
 * action, without building a full messaging inbox.
 */
function ApplicantRow({ applicant: s, onChangeStatus }) {
  const { t } = useLang();
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState(s.company_note ?? '');
  const [busy, setBusy] = useState(false);

  async function invite() {
    setBusy(true);
    try {
      await onChangeStatus('interview', note.trim() || null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-sm py-2" style={{ borderBottom: '1px solid var(--darbi-border)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-darbi-navy">{s.name}</p>
          <p className="text-xs text-gray-400">
            {s.level ?? t('company.jobPosting.levelNotStated')} · GPA {s.gpa ?? '—'} · {s.location ?? t('company.jobPosting.jordan')}
          </p>
          <p className="text-xs mt-0.5">
            <MatchScore score={s.ai_match} />
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={s.status}
            onChange={(e) => onChangeStatus(e.target.value)}
            className="text-xs font-semibold rounded-full px-2.5 py-1 border bg-transparent"
            style={{ borderColor: 'var(--darbi-border)', color: STATUS_COLOR[s.status] ?? STATUS_COLOR.screening }}
          >
            {APPLICATION_STATUSES.map((st) => (
              <option key={st} value={st} style={{ color: '#000' }}>
                {t(`company.status.${st}`)}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs text-gray-500 hover:text-gray-300">
            {t('company.jobPosting.details')} {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2.5 space-y-2.5">
          <p className="text-xs text-gray-400">
            <span className="font-semibold text-gray-300">{t('company.jobPosting.majorLabel')}</span>{' '}
            {s.major_name ?? t('company.jobPosting.majorNotStated')}
          </p>
          {s.interests?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {s.interests.map((i) => (
                <span
                  key={i}
                  className="text-[11px] px-2 py-0.5 rounded-full"
                  style={{ background: 'color-mix(in srgb, var(--darbi-purple) 12%, transparent)', color: 'var(--darbi-purple)' }}
                >
                  {i}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-500">
            {t('company.jobPosting.appliedOn')(new Date(s.applied_at).toLocaleDateString())}
          </p>

          <label className="block">
            <span className="block text-xs font-semibold text-gray-400 mb-1">{t('company.jobPosting.noteLabel')}</span>
            <textarea
              rows="2"
              className={inputClass}
              placeholder={t('company.jobPosting.notePlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <Button type="button" disabled={busy} onClick={invite}>
            {s.status === 'interview' ? t('company.jobPosting.updateInviteBtn') : t('company.jobPosting.inviteBtn')}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Candidate cards in a grid, closer to browsing a talent pool than reading
 * a plain list of names. */
function FindStudents() {
  const { t } = useLang();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ major: '', minGpa: '' });

  useEffect(() => {
    const q = new URLSearchParams();
    if (filters.major) q.set('major', filters.major);
    if (filters.minGpa) q.set('minGpa', filters.minGpa);
    setLoading(true);
    api(`/companies/students?${q}`).then(setStudents).catch(() => {}).finally(() => setLoading(false));
  }, [filters]);

  return (
    <>
      <Card title={loading ? t('company.findStudents.searching') : t('company.findStudents.matchCount')(students.length)} accent={false}>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label={t('company.findStudents.majorLabel')}>
            <input className={inputClass} placeholder={t('company.findStudents.majorPlaceholder')} value={filters.major}
              onChange={(e) => setFilters({ ...filters, major: e.target.value })} />
          </Field>
          <Field label={t('company.findStudents.minGpaLabel')}>
            <input type="number" step="0.1" min="0" max="4" className={inputClass} value={filters.minGpa}
              onChange={(e) => setFilters({ ...filters, minGpa: e.target.value })} />
          </Field>
        </div>
      </Card>

      {loading && (
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} style={{ height: 90 }} />)}
        </div>
      )}

      {!loading && students.length === 0 && (
        <EmptyState icon="🔍" title={t('company.findStudents.emptyTitle')} />
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {students.map((s) => (
          <div key={s.user_id} className="darbi-box">
            <p className="font-semibold text-darbi-navy mb-1">{s.name}</p>
            <p className="text-sm text-gray-300">
              {s.level ?? t('company.jobPosting.levelNotStated')} · GPA {s.gpa ?? '—'} · {s.location ?? t('company.jobPosting.jordan')}
            </p>
            {s.interests?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {s.interests.map((i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-full bg-white/10 text-gray-200">
                    {i}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500 mt-4">
        {t('company.findStudents.footerNote')}
      </p>
    </>
  );
}
