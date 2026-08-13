import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../services/auth.jsx';
import { Alert, Button, Card, Field, Shell, inputClass } from '../components/common/ui.jsx';

const TABS = ['post a job', 'my jobs', 'find students'];

export default function CompanyDashboard() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('post a job');

  return (
    <Shell
      title={`${profile?.name ?? 'Company'} 🏢`}
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
  const [form, setForm] = useState({});
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError(''); setStatus('');
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
      setStatus(`Posted “${job.title}”.`);
      setForm({});
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <Card title="Post a job">
        <Alert>{error}</Alert>
        {status && <p className="text-green-400 mb-4">{status}</p>}
        <form onSubmit={submit}>
          <Field label="Job title">
            <input className={inputClass} value={form.title ?? ''} onChange={set('title')} required />
          </Field>
          <Field label="Required major(s)" hint="Comma separated">
            <input className={inputClass} placeholder="Computer Science, Software Engineering" value={form.majors ?? ''} onChange={set('majors')} />
          </Field>
          <Field label="Minimum GPA" hint="Out of 4 — leave blank for no requirement">
            <input type="number" step="0.01" min="0" max="4" className={inputClass} value={form.minGpa ?? ''} onChange={set('minGpa')} />
          </Field>
          <Field label="Salary range" hint="e.g. 800-1,200">
            <input className={inputClass} value={form.salary ?? ''} onChange={set('salary')} />
          </Field>
          <Field label="Required skills" hint="Comma separated">
            <input className={inputClass} placeholder="SQL, React" value={form.skills ?? ''} onChange={set('skills')} />
          </Field>
          <Field label="Location">
            <input className={inputClass} placeholder="Amman" value={form.location ?? ''} onChange={set('location')} />
          </Field>
          <Field label="Description">
            <textarea rows="4" className={inputClass} value={form.description ?? ''} onChange={set('description')} />
          </Field>
          <Button type="submit">Post job</Button>
        </form>
      </Card>

      <JobPreview form={form} />
    </div>
  );
}

function JobPreview({ form }) {
  const majors = (form.majors ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const skills = (form.skills ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <div className="lg:sticky lg:top-6">
      <p className="text-xs uppercase tracking-wide text-gray-500 mb-2 px-1">Preview — what students will see</p>
      <article className="darbi-box" style={{ borderTop: '4px solid var(--darbi-gold)' }}>
        <h3 className="text-lg font-bold text-darbi-navy uppercase tracking-wide mb-1">
          {form.title || 'Your job title'}
        </h3>
        <p className="text-sm text-gray-500 mb-3">{form.location || 'Location not set'}</p>

        <dl className="text-sm space-y-1.5 mb-4">
          <div className="flex gap-2">
            <dt className="font-bold text-darbi-navy shrink-0">Salary:</dt>
            <dd style={{ color: 'var(--darbi-gold)' }} className="font-semibold">
              {form.salary || <span className="text-gray-500 italic font-normal">Not set</span>}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-bold text-darbi-navy shrink-0">Majors:</dt>
            <dd className="text-gray-300">
              {majors.length ? majors.join(', ') : <span className="text-gray-500 italic">Any major</span>}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-bold text-darbi-navy shrink-0">Min GPA:</dt>
            <dd className="text-gray-300">{form.minGpa || <span className="text-gray-500 italic">None</span>}</dd>
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
  const [jobs, setJobs] = useState([]);
  const load = () => api('/companies/me/jobs').then(setJobs).catch(() => {});
  useEffect(() => { load(); }, []);

  async function remove(id) {
    await api(`/companies/me/jobs/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-bold text-darbi-navy">{jobs.length} active posting{jobs.length === 1 ? '' : 's'}</h2>
      </div>

      {jobs.length === 0 && <Card><p className="text-gray-400">Nothing posted yet.</p></Card>}

      <div className="grid sm:grid-cols-2 gap-4">
        {jobs.map((j) => (
          <JobPosting key={j.id} job={j} onRemove={remove} />
        ))}
      </div>
    </>
  );
}

function JobPosting({ job: j, onRemove }) {
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
        <button onClick={() => onRemove(j.id)} className="text-xs text-red-400 hover:text-red-300 font-semibold shrink-0 transition">
          Delete
        </button>
      </div>
      <p className="text-sm text-gray-300 mb-1">
        {j.required_majors?.join(', ') || 'Any major'}
      </p>
      <p className="text-xs text-gray-500">
        {j.min_gpa && `Min GPA ${j.min_gpa}`}
        {j.min_gpa && j.salary_raw && ' · '}
        {j.salary_raw && `${j.salary_raw} JOD`}
      </p>

      <button onClick={toggle} className="text-xs font-semibold mt-3 text-left" style={{ color: '#c084fc' }}>
        {j.applicant_count} applicant{j.applicant_count === 1 ? '' : 's'} {open ? '▲' : '▼'}
      </button>

      {open && (
        <div className="mt-2 pt-2 space-y-2" style={{ borderTop: '1px solid var(--darbi-border)' }}>
          {applicants === null && <p className="text-xs text-gray-500">Loading…</p>}
          {applicants?.length === 0 && <p className="text-xs text-gray-500">No applicants yet.</p>}
          {applicants?.map((s) => (
            <div key={s.user_id} className="text-sm">
              <p className="font-medium text-darbi-navy">{s.name}</p>
              <p className="text-xs text-gray-400">
                {s.level ?? 'Level not stated'} · GPA {s.gpa ?? '—'} · {s.location ?? 'Jordan'}
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
  const [students, setStudents] = useState([]);
  const [filters, setFilters] = useState({ major: '', minGpa: '' });

  useEffect(() => {
    const q = new URLSearchParams();
    if (filters.major) q.set('major', filters.major);
    if (filters.minGpa) q.set('minGpa', filters.minGpa);
    api(`/companies/students?${q}`).then(setStudents).catch(() => {});
  }, [filters]);

  return (
    <>
      <Card title={`${students.length} matching student(s)`} accent={false}>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Interest / major">
            <input className={inputClass} placeholder="Cybersecurity" value={filters.major}
              onChange={(e) => setFilters({ ...filters, major: e.target.value })} />
          </Field>
          <Field label="Minimum GPA">
            <input type="number" step="0.1" min="0" max="4" className={inputClass} value={filters.minGpa}
              onChange={(e) => setFilters({ ...filters, minGpa: e.target.value })} />
          </Field>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {students.map((s) => (
          <div key={s.user_id} className="darbi-box">
            <p className="font-semibold text-darbi-navy mb-1">{s.name}</p>
            <p className="text-sm text-gray-300">
              {s.level ?? 'Level not stated'} · GPA {s.gpa ?? '—'} · {s.location ?? 'Jordan'}
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
        Contact details are not shown here — students are contacted through the platform.
      </p>
    </>
  );
}
