import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../services/auth.jsx';
import { Alert, Button, Card, EmptyState, Field, Shell, SkeletonLines, inputClass } from '../components/common/ui.jsx';
import { useToast } from '../components/common/toast.jsx';
import { readCvFile } from '../lib/cv.js';
import { useLang } from '../i18n/index.jsx';

const TABS = ['overview', 'learning paths', 'training centres', 'my cv'];

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
      {tab === 'my cv' && <MyCv />}
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

  const tracks = [...new Set(paths.map((p) => p.track))];

  return (
    <>
      {loading && <Card><SkeletonLines lines={4} /></Card>}
      {tracks.map((track) => (
        <Card key={track} title={track}>
          <div className="divide-y divide-[color:var(--darbi-border)]">
            {paths.filter((p) => p.track === track).map((p) => (
              <div key={p.id} className="py-3">
                <p className="font-semibold text-darbi-navy">{p.title}</p>
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

/** The CV file itself, plus the structured profile fields shown alongside it. */
function MyCv() {
  const { profile, setProfile } = useAuth();
  return (
    <>
      <CvFileCard profile={profile} setProfile={setProfile} />
      <CvDetailsCard profile={profile} setProfile={setProfile} />
    </>
  );
}

/** Upload / view / replace / remove the actual CV file (PDF, up to 4MB). */
function CvFileCard({ profile, setProfile }) {
  const { t, lang } = useLang();
  const c = t('career.cv');
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
      toast.show(c.cvUpdated, { kind: 'success' });
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
      toast.show(c.cvRemoved, { kind: 'success' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={c.fileTitle} accent={false}>
      <Alert>{error}</Alert>
      {profile?.cv ? (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="font-semibold text-white truncate">{profile.cv_filename || 'CV.pdf'}</p>
            {profile.cv_uploaded_at && <p className="text-xs text-gray-500">{c.uploadedAt(fmtDate(profile.cv_uploaded_at))}</p>}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <a href={profile.cv} target="_blank" rel="noopener noreferrer" className="text-xs font-bold" style={{ color: 'var(--darbi-purple)' }}>
              {c.view}
            </a>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="text-xs font-bold" style={{ color: 'var(--darbi-purple)' }}>
              {c.replace}
            </button>
            <button type="button" onClick={onRemove} disabled={busy} className="text-xs font-bold text-red-400 hover:text-red-300">
              {c.remove}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-gray-400">{c.noFile}</p>
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
            {c.upload}
          </Button>
        </div>
      )}
      <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={onFileChange} />
    </Card>
  );
}

/**
 * The structured details a CV form usually asks for — starts read-only with
 * an Edit click to open it, same pattern as AccountPage's EditableRow, just
 * covering several fields saved together with one PUT /career/me.
 */
function CvDetailsCard({ profile, setProfile }) {
  const { t } = useLang();
  const c = t('career.cv');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  function startEdit() {
    setForm({
      currentTitle: profile?.current_title ?? '',
      yearsExperience: profile?.years_experience ?? '',
      major: profile?.major ?? '',
      university: profile?.university ?? '',
      yearGraduated: profile?.year_graduated ?? '',
      skills: (profile?.skills ?? []).join(', '),
    });
    setError('');
    setEditing(true);
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const updated = await api('/career/me', {
        method: 'PUT',
        body: {
          currentTitle: form.currentTitle || null,
          yearsExperience: form.yearsExperience === '' ? null : Number(form.yearsExperience),
          major: form.major || null,
          university: form.university || null,
          yearGraduated: form.yearGraduated === '' ? null : Number(form.yearGraduated),
          skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
        },
      });
      setProfile(updated);
      toast.show(c.detailsSaved, { kind: 'success' });
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    const skills = profile?.skills ?? [];
    return (
      <Card title={c.detailsTitle} accent={false}>
        <p className="text-xs text-gray-500 -mt-2 mb-4">{c.detailsHint}</p>
        <dl className="text-sm space-y-2.5 mb-5">
          <Row label={t('career.currentRole')} value={profile?.current_title || t('career.notSet')} />
          <Row
            label={c.yearsExperience}
            value={profile?.years_experience != null ? t('career.yearsExperience')(profile.years_experience) : t('career.notSet')}
          />
          <Row label={c.major} value={profile?.major || t('career.notSet')} />
          <Row label={c.university} value={profile?.university || t('career.notSet')} />
          <Row label={c.yearGraduated} value={profile?.year_graduated ?? t('career.notSet')} />
        </dl>
        <div className="mb-5">
          <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">{c.skills}</span>
          {skills.length === 0 ? (
            <p className="text-sm text-gray-500 italic">{c.skillsEmpty}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => (
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
        </div>
        <button type="button" onClick={startEdit} className="text-xs font-bold" style={{ color: 'var(--darbi-purple)' }}>
          {c.edit}
        </button>
      </Card>
    );
  }

  return (
    <Card title={c.detailsTitle} accent={false}>
      <form onSubmit={submit}>
        <Alert>{error}</Alert>
        <Field label={t('career.currentRole')}>
          <input className={inputClass} value={form.currentTitle} onChange={set('currentTitle')} />
        </Field>
        <Field label={c.yearsExperience}>
          <input type="number" min="0" className={inputClass} value={form.yearsExperience} onChange={set('yearsExperience')} />
        </Field>
        <Field label={c.major}>
          <input className={inputClass} placeholder={c.majorPlaceholder} value={form.major} onChange={set('major')} />
        </Field>
        <Field label={c.university}>
          <input className={inputClass} placeholder={c.universityPlaceholder} value={form.university} onChange={set('university')} />
        </Field>
        <Field label={c.yearGraduated}>
          <input
            type="number"
            min="1950"
            max={new Date().getFullYear() + 10}
            className={inputClass}
            value={form.yearGraduated}
            onChange={set('yearGraduated')}
          />
        </Field>
        <Field label={c.skills} hint={c.skillsHint}>
          <input className={inputClass} placeholder={c.skillsPlaceholder} value={form.skills} onChange={set('skills')} />
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? c.saving : c.save}
          </Button>
          <button type="button" onClick={() => setEditing(false)} disabled={busy} className="text-xs text-gray-400 hover:text-gray-200">
            {c.cancel}
          </button>
        </div>
      </form>
    </Card>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-white font-medium text-right">{value}</dd>
    </div>
  );
}
