import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../services/auth.jsx';
import { Alert, Button, Card, EmptyState, Field, Shell, Skeleton, inputClass } from '../components/common/ui.jsx';
import { useToast } from '../components/common/toast.jsx';
import { useLang } from '../i18n/index.jsx';

const TABS = ['post a job', 'my jobs', 'find students'];

export default function CompanyDashboard() {
  const { profile } = useAuth();
  const { t } = useLang();
  const [tab, setTab] = useState('post a job');

  return (
    <Shell
      title={`${profile?.name ?? t('company.companyFallback')} 🏢`}
      subtitle={profile?.industry}
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
    >
      {tab === 'post a job' && <PostJob />}
      {tab === 'my jobs' && <MyJobs />}
      {tab === 'find students' && <FindStudents />}
    </Shell>
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
  const toast = useToast();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
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
        },
      });
      toast.show(t('company.postJob.posted')(job.title), { kind: 'success' });
      setForm({});
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <Card title={t('company.postJob.cardTitle')}>
        <Alert>{error}</Alert>
        <form onSubmit={submit}>
          <Field label={t('company.postJob.jobTitleLabel')}>
            <input className={inputClass} value={form.title ?? ''} onChange={set('title')} required />
          </Field>
          <Field label={t('company.postJob.majorsLabel')} hint={t('company.postJob.majorsHint')}>
            <input className={inputClass} placeholder={t('company.postJob.majorsPlaceholder')} value={form.majors ?? ''} onChange={set('majors')} />
          </Field>
          <Field label={t('company.postJob.minGpaLabel')} hint={t('company.postJob.minGpaHint')}>
            <input type="number" step="0.01" min="0" max="4" className={inputClass} value={form.minGpa ?? ''} onChange={set('minGpa')} />
          </Field>
          <Field label={t('company.postJob.salaryLabel')} hint={t('company.postJob.salaryHint')}>
            <input className={inputClass} value={form.salary ?? ''} onChange={set('salary')} />
          </Field>
          <Field label={t('company.postJob.skillsLabel')} hint={t('company.postJob.skillsHint')}>
            <input className={inputClass} placeholder={t('company.postJob.skillsPlaceholder')} value={form.skills ?? ''} onChange={set('skills')} />
          </Field>
          <Field label={t('company.postJob.locationLabel')}>
            <input className={inputClass} placeholder={t('company.postJob.locationPlaceholder')} value={form.location ?? ''} onChange={set('location')} />
          </Field>
          <Field label={t('company.postJob.descriptionLabel')}>
            <textarea rows="4" className={inputClass} value={form.description ?? ''} onChange={set('description')} />
          </Field>
          <Button type="submit">{t('company.postJob.submit')}</Button>
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

        {form.description && <p className="text-sm text-gray-300">{form.description}</p>}
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

  return (
    <>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-bold text-darbi-navy">
          {loading ? t('company.myJobs.loading') : t('company.myJobs.count')(jobs.length)}
        </h2>
      </div>

      {loading && (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} style={{ height: 140 }} />)}
        </div>
      )}

      {!loading && jobs.length === 0 && (
        <Card>
          <EmptyState icon="📋" title={t('company.myJobs.emptyTitle')} />
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {jobs.map((j) => (
          <JobPosting key={j.id} job={j} onRemove={remove} />
        ))}
      </div>
    </>
  );
}

function JobPosting({ job: j, onRemove }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [applicants, setApplicants] = useState(null);

  async function toggle() {
    if (open) return setOpen(false);
    setOpen(true);
    if (!applicants) {
      api(`/companies/me/jobs/${j.id}/applicants`).then(setApplicants).catch(() => setApplicants([]));
    }
  }

  return (
    <div className="darbi-box flex flex-col">
      <div className="flex justify-between items-start gap-2 mb-2">
        <p className="font-semibold text-darbi-navy">{j.title}</p>
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

      <button onClick={toggle} className="text-xs font-semibold mt-3 text-left" style={{ color: 'var(--darbi-purple)' }}>
        {t('company.jobPosting.applicants')(j.applicant_count)} {open ? '▲' : '▼'}
      </button>

      {open && (
        <div className="mt-2 pt-2 space-y-2" style={{ borderTop: '1px solid var(--darbi-border)' }}>
          {applicants === null && <p className="text-xs text-gray-500">{t('common.loading')}</p>}
          {applicants?.length === 0 && <p className="text-xs text-gray-500">{t('company.jobPosting.noApplicants')}</p>}
          {applicants?.map((s) => (
            <div key={s.user_id} className="text-sm">
              <p className="font-medium text-darbi-navy">{s.name}</p>
              <p className="text-xs text-gray-400">
                {s.level ?? t('company.jobPosting.levelNotStated')} · GPA {s.gpa ?? '—'} · {s.location ?? t('company.jobPosting.jordan')}
              </p>
            </div>
          ))}
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
