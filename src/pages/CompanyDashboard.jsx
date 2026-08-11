import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../services/auth.jsx';
import { Alert, Button, Card, Field, Shell, Tabs, inputClass } from '../components/common/ui.jsx';

const TABS = ['post a job', 'my jobs', 'find students'];

export default function CompanyDashboard() {
  const { profile, logout } = useAuth();
  const [tab, setTab] = useState('post a job');

  return (
    <Shell
      title={`${profile?.name ?? 'Company'} 🏢`}
      subtitle={profile?.industry}
      onLogout={logout}
    >
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'post a job' && <PostJob />}
      {tab === 'my jobs' && <MyJobs />}
      {tab === 'find students' && <FindStudents />}
    </Shell>
  );
}

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
    <Card title="Post a job">
      <Alert>{error}</Alert>
      {status && <p className="text-green-700 mb-4">{status}</p>}
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
  );
}

function MyJobs() {
  const [jobs, setJobs] = useState([]);
  const load = () => api('/companies/me/jobs').then(setJobs).catch(() => {});
  useEffect(() => { load(); }, []);

  async function remove(id) {
    await api(`/companies/me/jobs/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <Card title={`${jobs.length} posting(s)`}>
      {jobs.length === 0 && <p className="text-gray-600">Nothing posted yet.</p>}
      <div className="divide-y">
        {jobs.map((j) => (
          <div key={j.id} className="py-3 flex justify-between items-start gap-4">
            <div>
              <p className="font-semibold text-darbi-navy">{j.title}</p>
              <p className="text-sm text-gray-500">
                {j.required_majors?.join(', ') || 'Any major'}
                {j.min_gpa && ` · min GPA ${j.min_gpa}`}
                {j.salary_raw && ` · ${j.salary_raw} JOD`}
              </p>
            </div>
            <button onClick={() => remove(j.id)} className="text-sm text-red-600 font-semibold shrink-0">
              Delete
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

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
    <Card title={`${students.length} matching student(s)`}>
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

      <div className="divide-y">
        {students.map((s) => (
          <div key={s.user_id} className="py-3">
            <p className="font-semibold text-darbi-navy">{s.name}</p>
            <p className="text-sm text-gray-600">
              {s.level ?? 'Level not stated'} · GPA {s.gpa ?? '—'} · {s.location ?? 'Jordan'}
            </p>
            {s.interests?.length > 0 && (
              <p className="text-sm text-gray-500 mt-1">Interests: {s.interests.join(', ')}</p>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Contact details are not shown here — students are contacted through the platform.
      </p>
    </Card>
  );
}
