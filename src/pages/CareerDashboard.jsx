import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../services/auth.jsx';
import { Alert, Button, Card, EmptyState, Field, Shell, SkeletonLines, inputClass } from '../components/common/ui.jsx';
import { useToast } from '../components/common/toast.jsx';
import { readCvFile } from '../lib/cv.js';
import { useLang } from '../i18n/index.jsx';

const TABS = ['overview', 'learning paths', 'training centres', 'profile'];

export default function CareerDashboard() {
  const { profile } = useAuth();
  const { t } = useLang();
  const [tab, setTab] = useState('overview');

  return (
    <Shell
      title={t('career.welcome')(profile?.name ?? t('career.namePlaceholder'))}
      subtitle={profile?.current_title}
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
    >
      {tab === 'overview' && <Overview profile={profile} />}
      {tab === 'learning paths' && <LearningPaths />}
      {tab === 'training centres' && <TrainingCentres />}
      {tab === 'profile' && <Profile />}
    </Shell>
  );
}

function Overview({ profile }) {
  const { t } = useLang();
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card title={t('career.currentRole')}>
        <p className="text-2xl font-bold" style={{ color: 'var(--darbi-gold)' }}>
          {profile?.current_title ?? t('career.notSet')}
        </p>
      </Card>
      <Card title={t('career.experience')}>
        <p className="text-2xl font-bold" style={{ color: 'var(--darbi-gold)' }}>
          {profile?.years_experience != null ? t('career.yearsExperience')(profile.years_experience) : '—'}
        </p>
      </Card>
      <Card title={t('career.field')}>
        <p className="text-2xl font-bold" style={{ color: 'var(--darbi-gold)' }}>
          {profile?.major ?? t('career.notSet')}
        </p>
      </Card>
    </div>
  );
}

/**
 * Reads the career_paths table, seeded from career_courses_ENGLISH.xlsx —
 * every Coursera / Udemy link and Jordanian centre the team verified.
 */
function LearningPaths() {
  const { t } = useLang();
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api('/career/paths', { auth: false }).then(setPaths).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const tracks = [...new Set(paths.map((p) => p.major_name))];

  return (
    <>
      {loading && <Card><SkeletonLines lines={4} /></Card>}
      {tracks.map((track) => (
        <Card key={track} title={track}>
          <div className="divide-y divide-[color:var(--darbi-border)]">
            {paths.filter((p) => p.major_name === track).map((p) => (
              <div key={p.id} className="py-3">
                <p className="font-semibold text-darbi-navy">{p.name}</p>
                {p.skills && (
                  <p className="text-sm text-gray-300 mt-1 whitespace-pre-line">{p.skills}</p>
                )}
                {p.jordan_centers && (
                  <p className="text-xs text-gray-500 mt-2">
                    <span className="font-semibold">{t('career.inJordan')}</span>{p.jordan_centers}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}
      {!loading && paths.length === 0 && (
        <Card><EmptyState icon="🎓" title={t('career.noLearningPaths')} /></Card>
      )}
    </>
  );
}

function TrainingCentres() {
  const { t } = useLang();
  const [centres, setCentres] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api('/career/centres', { auth: false }).then(setCentres).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <Card title={loading ? t('career.loadingCentres') : t('career.centresCount')(centres.length)}>
      {loading && <SkeletonLines lines={5} />}
      {!loading && centres.length === 0 && (
        <EmptyState icon="🏫" title={t('career.noCentres')} />
      )}
      <div className="divide-y divide-[color:var(--darbi-border)]">
        {centres.map((c) => (
          <div key={c.id} className="py-3">
            <p className="font-semibold text-darbi-navy">{c.name}</p>
            <p className="text-sm text-gray-300">{c.field}{c.study_type && ` · ${c.study_type}`}</p>
            {c.details && <p className="text-sm text-gray-500 mt-1">{c.details}</p>}
            {c.contact && <p className="text-xs text-gray-400 mt-1">{c.contact}</p>}
          </div>
        ))}
      </div>
    </Card>
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
