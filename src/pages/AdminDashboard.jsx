import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../services/auth.jsx';
import { Alert, Button, Card, EmptyState, Field, Shell, SkeletonLines, inputClass } from '../components/common/ui.jsx';
import { useToast } from '../components/common/toast.jsx';
import { useLang } from '../i18n/index.jsx';

const TABS = ['overview', 'users', 'companies', 'jobs'];

/**
 * The one admin account (server/index.js's ensureAdminAccount) — full
 * visibility and control over accounts and job listings. Deliberately
 * doesn't offer editing the reference catalog (majors/courses/universities):
 * that's regenerated from the approved spreadsheets, never hand-edited (see
 * CLAUDE.md and server/routes/admin.js's own comment on this).
 */
export default function AdminDashboard() {
  const { t } = useLang();
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');

  return (
    <Shell title={t('admin.pageTitle')} subtitle={user?.email} tabs={TABS} activeTab={tab} onTabChange={setTab}>
      {tab === 'overview' && <Overview />}
      {tab === 'users' && <Users />}
      {tab === 'companies' && <Companies />}
      {tab === 'jobs' && <Jobs />}
    </Shell>
  );
}

function Overview() {
  const { t } = useLang();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api('/admin/stats').then(setStats).catch(() => {});
  }, []);

  if (!stats) {
    return (
      <Card title={t('admin.overview.loadingStats')}>
        <SkeletonLines lines={6} />
      </Card>
    );
  }

  const cards = [
    { label: t('admin.overview.students'), value: stats.users_by_role.student ?? 0 },
    { label: t('admin.overview.companies'), value: stats.users_by_role.company ?? 0 },
    { label: t('admin.overview.graduates'), value: stats.users_by_role.career ?? 0 },
    { label: t('admin.overview.totalJobListings'), value: stats.jobs.total },
    { label: t('admin.overview.verifiedListings'), value: stats.jobs.verified },
    { label: t('admin.overview.companyPostedListings'), value: stats.jobs.from_companies },
    { label: t('admin.overview.jobApplications'), value: stats.applications },
    { label: t('admin.overview.chatMessagesSent'), value: stats.chat_messages },
    { label: t('admin.overview.savedPathways'), value: stats.saved_majors },
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="darbi-box">
          <p className="text-3xl font-bold" style={{ color: 'var(--darbi-gold)' }}>
            {c.value}
          </p>
          <p className="text-sm text-gray-400 mt-1">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

const ROLE_COLOR = {
  student: 'var(--darbi-purple)',
  company: 'var(--darbi-gold)',
  career: 'var(--darbi-ai-feature)',
  admin: 'var(--darbi-success)',
};

function Users() {
  const { t } = useLang();
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState('');
  const toast = useToast();

  useEffect(() => {
    api('/admin/users').then(setUsers).catch(() => setUsers([]));
  }, []);

  // Same optimistic-remove + 5s "Undo" toast used for company job postings
  // (src/pages/CompanyDashboard.jsx) — the row disappears immediately, the
  // real DELETE only fires once the window passes, so Undo just cancels it.
  function remove(u) {
    setUsers((list) => list.filter((x) => x.id !== u.id));
    const timer = setTimeout(() => {
      api(`/admin/users/${u.id}`, { method: 'DELETE' }).catch(() => {});
    }, 5000);
    toast.show(t('admin.users.deletedToast')(u.name || u.username), {
      kind: 'info',
      duration: 5000,
      action: {
        label: t('common.undo'),
        onClick: () => { clearTimeout(timer); setUsers((list) => [u, ...list]); },
      },
    });
  }

  if (users === null) {
    return (
      <Card title={t('admin.users.loading')}>
        <SkeletonLines lines={8} />
      </Card>
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? users.filter((u) => [u.name, u.username, u.email].some((v) => v?.toLowerCase().includes(q)))
    : users;

  return (
    <Card title={t('admin.users.accountsCount')(users.length)} accent={false}>
      <input
        className={`${inputClass} mb-4`}
        placeholder={t('admin.users.searchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {filtered.length === 0 && <EmptyState icon="🔍" title={t('admin.users.noMatching')} />}
      <div>
        {filtered.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between gap-3 py-3 border-b last:border-0"
            style={{ borderColor: 'var(--darbi-border)' }}
          >
            <div className="min-w-0">
              <p className="font-semibold text-white truncate">{u.name || u.username}</p>
              <p className="text-xs text-gray-500 truncate">
                {u.email} · @{u.username}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {!u.email_verified && (
                <span className="text-xs" title={t('admin.users.emailNotVerified')} aria-label={t('admin.users.emailNotVerified')}>
                  ✉️
                </span>
              )}
              <span
                className="text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-full"
                style={{
                  background: `color-mix(in srgb, ${ROLE_COLOR[u.role] ?? 'var(--darbi-text-muted)'} 13%, transparent)`,
                  color: ROLE_COLOR[u.role] ?? 'var(--darbi-text-muted)',
                }}
              >
                {u.role}
              </span>
              <button
                type="button"
                onClick={() => remove(u)}
                className="text-xs text-red-400 hover:text-red-300 font-semibold"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Companies() {
  const { t } = useLang();
  const [companies, setCompanies] = useState(null);

  useEffect(() => {
    api('/admin/companies').then(setCompanies).catch(() => setCompanies([]));
  }, []);

  if (companies === null) {
    return (
      <Card title={t('admin.companies.loading')}>
        <SkeletonLines lines={6} />
      </Card>
    );
  }

  return (
    <Card title={t('admin.companies.count')(companies.length)} accent={false}>
      {companies.length === 0 && <EmptyState icon="🏢" title={t('admin.companies.none')} />}
      <div>
        {companies.map((c) => (
          <div
            key={c.user_id}
            className="flex items-center justify-between gap-3 py-3 border-b last:border-0"
            style={{ borderColor: 'var(--darbi-border)' }}
          >
            <div className="min-w-0">
              <p className="font-semibold text-white truncate">{c.name}</p>
              <p className="text-xs text-gray-500 truncate">
                {c.email}
                {c.industry && ` · ${c.industry}`}
              </p>
            </div>
            <span className="text-xs text-gray-400 shrink-0">
              {t('admin.companies.listingCount')(c.job_count)}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-4">
        {t('admin.companies.deleteHint')}
      </p>
    </Card>
  );
}

const JOBS_PAGE_SIZE = 30;

function Jobs() {
  const { t } = useLang();
  const [jobs, setJobs] = useState(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [visible, setVisible] = useState(JOBS_PAGE_SIZE);
  const toast = useToast();

  useEffect(() => {
    api('/admin/jobs').then(setJobs).catch(() => setJobs([]));
  }, []);

  async function toggleVerified(job) {
    const next = !job.verified;
    setJobs((list) => list.map((j) => (j.id === job.id ? { ...j, verified: next } : j)));
    try {
      await api(`/admin/jobs/${job.id}`, { method: 'PUT', body: { verified: next } });
    } catch {
      // Roll back — the toggle didn't actually take server-side.
      setJobs((list) => list.map((j) => (j.id === job.id ? { ...j, verified: job.verified } : j)));
    }
  }

  function remove(job) {
    setJobs((list) => list.filter((x) => x.id !== job.id));
    const timer = setTimeout(() => {
      api(`/admin/jobs/${job.id}`, { method: 'DELETE' }).catch(() => {});
    }, 5000);
    toast.show(t('admin.jobs.deletedToast')(job.title), {
      kind: 'info',
      duration: 5000,
      action: {
        label: t('common.undo'),
        onClick: () => { clearTimeout(timer); setJobs((list) => [job, ...list]); },
      },
    });
  }

  if (jobs === null) {
    return (
      <Card title={t('admin.jobs.loading')}>
        <SkeletonLines lines={8} />
      </Card>
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? jobs.filter((j) => `${j.title} ${j.company_name}`.toLowerCase().includes(q))
    : jobs;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <input
          className={inputClass}
          style={{ maxWidth: 320 }}
          placeholder={t('admin.jobs.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="button" variant="navy" onClick={() => setShowForm((s) => !s)}>
          {showForm ? t('common.cancel') : t('admin.jobs.postAJob')}
        </Button>
      </div>

      {showForm && (
        <PostAdminJob
          onPosted={(job) => {
            setJobs((list) => [job, ...list]);
            setShowForm(false);
          }}
        />
      )}

      <Card title={t('admin.jobs.countOf')(filtered.length, jobs.length)} accent={false}>
        {filtered.length === 0 && <EmptyState icon="💼" title={t('admin.jobs.noMatching')} />}
        <div>
          {filtered.slice(0, visible).map((j) => (
            <div
              key={j.id}
              className="flex items-center justify-between gap-3 py-3 border-b last:border-0"
              style={{ borderColor: 'var(--darbi-border)' }}
            >
              <div className="min-w-0">
                <p className="font-semibold text-white truncate">{j.title}</p>
                <p className="text-xs text-gray-500 truncate">
                  {j.company_name}
                  {j.location && ` · ${j.location}`}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={j.verified} onChange={() => toggleVerified(j)} />
                  {t('admin.jobs.verified')}
                </label>
                <button
                  type="button"
                  onClick={() => remove(j)}
                  className="text-xs text-red-400 hover:text-red-300 font-semibold"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
        {visible < filtered.length && (
          <button
            type="button"
            onClick={() => setVisible((v) => v + JOBS_PAGE_SIZE)}
            className="text-xs font-semibold mt-3"
            style={{ color: 'var(--darbi-purple)' }}
          >
            {t('admin.jobs.showMore')(filtered.length - visible)}
          </button>
        )}
      </Card>
    </>
  );
}

function PostAdminJob({ onPosted }) {
  const { t } = useLang();
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const toast = useToast();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const job = await api('/admin/jobs', {
        method: 'POST',
        body: {
          title: form.title,
          companyName: form.companyName,
          requiredMajors: (form.majors ?? '').split(',').map((s) => s.trim()).filter(Boolean),
          minGpa: form.minGpa === '' || form.minGpa == null ? null : Number(form.minGpa),
          salaryRange: form.salary || null,
          requiredSkills: (form.skills ?? '').split(',').map((s) => s.trim()).filter(Boolean),
          location: form.location || null,
          description: form.description || null,
        },
      });
      toast.show(t('admin.postJob.postedToast')(job.title), { kind: 'success' });
      onPosted(job);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Card title={t('admin.postJob.title')} accent>
      <Alert>{error}</Alert>
      <form onSubmit={submit}>
        <Field label={t('admin.postJob.jobTitle')}>
          <input className={inputClass} value={form.title ?? ''} onChange={set('title')} required />
        </Field>
        <Field label={t('admin.postJob.companyName')}>
          <input className={inputClass} value={form.companyName ?? ''} onChange={set('companyName')} required />
        </Field>
        <Field label={t('admin.postJob.requiredMajors')} hint={t('admin.postJob.commaSeparated')}>
          <input className={inputClass} value={form.majors ?? ''} onChange={set('majors')} />
        </Field>
        <Field label={t('admin.postJob.minGpa')} hint={t('admin.postJob.minGpaHint')}>
          <input type="number" step="0.01" min="0" max="4" className={inputClass} value={form.minGpa ?? ''} onChange={set('minGpa')} />
        </Field>
        <Field label={t('admin.postJob.salaryRange')} hint={t('admin.postJob.salaryHint')}>
          <input className={inputClass} value={form.salary ?? ''} onChange={set('salary')} />
        </Field>
        <Field label={t('admin.postJob.requiredSkills')} hint={t('admin.postJob.commaSeparated')}>
          <input className={inputClass} value={form.skills ?? ''} onChange={set('skills')} />
        </Field>
        <Field label={t('admin.postJob.location')}>
          <input className={inputClass} value={form.location ?? ''} onChange={set('location')} />
        </Field>
        <Field label={t('admin.postJob.description')}>
          <textarea rows="3" className={inputClass} value={form.description ?? ''} onChange={set('description')} />
        </Field>
        <Button type="submit">{t('admin.postJob.submit')}</Button>
      </form>
    </Card>
  );
}
