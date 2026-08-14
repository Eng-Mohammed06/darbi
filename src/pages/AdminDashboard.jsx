import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../services/auth.jsx';
import { Alert, Button, Card, EmptyState, Field, Shell, SkeletonLines, inputClass } from '../components/common/ui.jsx';
import { useToast } from '../components/common/toast.jsx';

const TABS = ['overview', 'users', 'companies', 'jobs'];

/**
 * The one admin account (server/index.js's ensureAdminAccount) — full
 * visibility and control over accounts and job listings. Deliberately
 * doesn't offer editing the reference catalog (majors/courses/universities):
 * that's regenerated from the approved spreadsheets, never hand-edited (see
 * CLAUDE.md and server/routes/admin.js's own comment on this).
 */
export default function AdminDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');

  return (
    <Shell title="Darbi Admin" subtitle={user?.email} tabs={TABS} activeTab={tab} onTabChange={setTab}>
      {tab === 'overview' && <Overview />}
      {tab === 'users' && <Users />}
      {tab === 'companies' && <Companies />}
      {tab === 'jobs' && <Jobs />}
    </Shell>
  );
}

function Overview() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api('/admin/stats').then(setStats).catch(() => {});
  }, []);

  if (!stats) {
    return (
      <Card title="Loading stats…">
        <SkeletonLines lines={6} />
      </Card>
    );
  }

  const cards = [
    { label: 'Students', value: stats.users_by_role.student ?? 0 },
    { label: 'Companies', value: stats.users_by_role.company ?? 0 },
    { label: 'Graduates', value: stats.users_by_role.career ?? 0 },
    { label: 'Total job listings', value: stats.jobs.total },
    { label: 'Verified listings', value: stats.jobs.verified },
    { label: 'Company-posted listings', value: stats.jobs.from_companies },
    { label: 'Job applications', value: stats.applications },
    { label: 'Chat messages sent', value: stats.chat_messages },
    { label: 'Saved pathways', value: stats.saved_majors },
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

const ROLE_COLOR = { student: '#06b6d4', company: '#ff5722', career: '#a78bfa', admin: '#22c55e' };

function Users() {
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
    toast.show(`Deleted ${u.name || u.username}.`, {
      kind: 'info',
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => { clearTimeout(timer); setUsers((list) => [u, ...list]); },
      },
    });
  }

  if (users === null) {
    return (
      <Card title="Loading users…">
        <SkeletonLines lines={8} />
      </Card>
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? users.filter((u) => [u.name, u.username, u.email].some((v) => v?.toLowerCase().includes(q)))
    : users;

  return (
    <Card title={`${users.length} accounts`} accent={false}>
      <input
        className={`${inputClass} mb-4`}
        placeholder="Search name, username, or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {filtered.length === 0 && <EmptyState icon="🔍" title="No matching accounts." />}
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
                <span className="text-xs" title="Email not verified" aria-label="Email not verified">
                  ✉️
                </span>
              )}
              <span
                className="text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-full"
                style={{ background: `${ROLE_COLOR[u.role] ?? '#94a3b8'}22`, color: ROLE_COLOR[u.role] ?? '#94a3b8' }}
              >
                {u.role}
              </span>
              <button
                type="button"
                onClick={() => remove(u)}
                className="text-xs text-red-400 hover:text-red-300 font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Companies() {
  const [companies, setCompanies] = useState(null);

  useEffect(() => {
    api('/admin/companies').then(setCompanies).catch(() => setCompanies([]));
  }, []);

  if (companies === null) {
    return (
      <Card title="Loading companies…">
        <SkeletonLines lines={6} />
      </Card>
    );
  }

  return (
    <Card title={`${companies.length} companies`} accent={false}>
      {companies.length === 0 && <EmptyState icon="🏢" title="No company accounts yet." />}
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
              {c.job_count} listing{c.job_count === 1 ? '' : 's'}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-4">
        Delete a company account from the Users tab — it cascades to their postings too.
      </p>
    </Card>
  );
}

const JOBS_PAGE_SIZE = 30;

function Jobs() {
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
    toast.show(`Deleted "${job.title}".`, {
      kind: 'info',
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => { clearTimeout(timer); setJobs((list) => [job, ...list]); },
      },
    });
  }

  if (jobs === null) {
    return (
      <Card title="Loading jobs…">
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
          placeholder="Search title or company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="button" variant="navy" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : 'Post a job'}
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

      <Card title={`${filtered.length} of ${jobs.length} listings`} accent={false}>
        {filtered.length === 0 && <EmptyState icon="💼" title="No matching listings." />}
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
                  Verified
                </label>
                <button
                  type="button"
                  onClick={() => remove(j)}
                  className="text-xs text-red-400 hover:text-red-300 font-semibold"
                >
                  Delete
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
            Show more ({filtered.length - visible} remaining)
          </button>
        )}
      </Card>
    </>
  );
}

function PostAdminJob({ onPosted }) {
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
      toast.show(`Posted "${job.title}".`, { kind: 'success' });
      onPosted(job);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Card title="Post a job" accent>
      <Alert>{error}</Alert>
      <form onSubmit={submit}>
        <Field label="Job title">
          <input className={inputClass} value={form.title ?? ''} onChange={set('title')} required />
        </Field>
        <Field label="Company name">
          <input className={inputClass} value={form.companyName ?? ''} onChange={set('companyName')} required />
        </Field>
        <Field label="Required major(s)" hint="Comma separated">
          <input className={inputClass} value={form.majors ?? ''} onChange={set('majors')} />
        </Field>
        <Field label="Minimum GPA" hint="Out of 4 — leave blank for no requirement">
          <input type="number" step="0.01" min="0" max="4" className={inputClass} value={form.minGpa ?? ''} onChange={set('minGpa')} />
        </Field>
        <Field label="Salary range" hint="e.g. 800-1,200">
          <input className={inputClass} value={form.salary ?? ''} onChange={set('salary')} />
        </Field>
        <Field label="Required skills" hint="Comma separated">
          <input className={inputClass} value={form.skills ?? ''} onChange={set('skills')} />
        </Field>
        <Field label="Location">
          <input className={inputClass} value={form.location ?? ''} onChange={set('location')} />
        </Field>
        <Field label="Description">
          <textarea rows="3" className={inputClass} value={form.description ?? ''} onChange={set('description')} />
        </Field>
        <Button type="submit">Post job</Button>
      </form>
    </Card>
  );
}
