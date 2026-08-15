import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../services/auth.jsx';
import { Alert, Button, Card, EmptyState, Field, Shell, SkeletonLines, inputClass, PhotoViewModal } from '../components/common/ui.jsx';
import { useToast } from '../components/common/toast.jsx';
import { useLang } from '../i18n/index.jsx';

const TABS = ['overview', 'users', 'companies', 'jobs', 'majors'];

/**
 * Full visibility and control over accounts, job listings, and the
 * reference catalog. Reachable by the pure-admin account (server/index.js's
 * ensureAdminAccount) and by any student/company/career account granted
 * dual-role admin access from the Users tab below (db/schema.sql's
 * users.is_admin) — server/routes/admin.js's requireAdmin accepts either.
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
      {tab === 'majors' && <Majors />}
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
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [activeSection, setActiveSection] = useState('student');
  const toast = useToast();

  useEffect(() => {
    api('/admin/users').then(setUsers).catch(() => setUsers([]));
  }, []);

  function onAdminAccessChanged(id, isAdmin) {
    setUsers((list) => list.map((u) => (u.id === id ? { ...u, is_admin: isAdmin } : u)));
  }

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

  const allSections = [
    ...USER_SECTIONS.map((sec) => ({ ...sec, users: filtered.filter((u) => u.role === sec.role) })),
    {
      role: 'other',
      icon: '🛡️',
      label: (lt) => lt('admin.users.otherSection'),
      users: filtered.filter((u) => !USER_SECTIONS.some((sec) => sec.role === u.role)),
    },
  ];
  const current = allSections.find((sec) => sec.role === activeSection) ?? allSections[0];

  return (
    <>
      <Card title={t('admin.users.accountsCount')(users.length)} accent={false}>
        <input
          className={inputClass}
          placeholder={t('admin.users.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      <Card accent={false}>
        <div className="flex flex-wrap gap-2">
          {allSections.filter((sec) => sec.users.length > 0).map((sec) => {
            const color = ROLE_COLOR[sec.role] ?? ROLE_COLOR.admin;
            return (
              <button
                key={sec.role}
                type="button"
                onClick={() => setActiveSection(sec.role)}
                className="text-sm px-4 py-2 rounded-full font-bold transition flex items-center gap-1.5"
                style={
                  activeSection === sec.role
                    ? { background: color, color: '#fff' }
                    : { border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`, color }
                }
              >
                <span aria-hidden="true">{sec.icon}</span> {sec.label(t)} ({sec.users.length})
              </button>
            );
          })}
        </div>
      </Card>

      {current.users.length === 0 ? (
        <Card><EmptyState icon="🔍" title={t('admin.users.noMatching')} /></Card>
      ) : (
        <Card accent={false}>
          <div>
            {current.users.map((u) => (
              <UserRow key={u.id} u={u} t={t} onSelect={() => setDetailId(u.id)} onRemove={() => remove(u)} />
            ))}
          </div>
        </Card>
      )}

      {detailId != null && (
        <UserDetailModal
          userId={detailId}
          onClose={() => setDetailId(null)}
          canRevokeSelf={detailId !== me?.id}
          onAdminAccessChanged={onAdminAccessChanged}
        />
      )}
    </>
  );
}

const USER_SECTIONS = [
  { role: 'student', icon: '🎓', label: (t) => t('admin.users.sections.students') },
  { role: 'career', icon: '📈', label: (t) => t('admin.users.sections.graduates') },
  { role: 'company', icon: '🏢', label: (t) => t('admin.users.sections.companies') },
];

function UserRow({ u, t, onSelect, onRemove }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-center justify-between gap-3 py-3 border-b last:border-0 text-left hover:bg-white/5 transition rounded-lg px-2 -mx-2"
      style={{ borderColor: 'var(--darbi-border)' }}
    >
      <div className="min-w-0">
        <p className="font-semibold text-white truncate">{u.name || u.username}</p>
        <p className="text-xs text-gray-500 truncate">
          {u.email} · @{u.username}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!u.email_verified && (
          <span className="text-xs" title={t('admin.users.emailNotVerified')} aria-label={t('admin.users.emailNotVerified')}>
            ✉️
          </span>
        )}
        {u.is_admin && (
          <span
            className="text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-full"
            style={{ background: 'color-mix(in srgb, var(--darbi-success) 15%, transparent)', color: 'var(--darbi-success)' }}
          >
            {t('admin.users.detail.adminBadge')}
          </span>
        )}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onRemove(); } }}
          className="text-xs text-red-400 hover:text-red-300 font-semibold"
        >
          {t('common.delete')}
        </span>
      </div>
    </button>
  );
}

function fmtDateTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * The panel behind clicking a user row — GET /api/admin/users/:id, plus the
 * grant/revoke admin-access control. Student-only fields (recommendations,
 * saved pathways, most-recommended major) show "not applicable" for
 * company/admin accounts rather than being hidden, so the panel's shape
 * doesn't jump around role to role. Career accounts are the one exception —
 * those three rows are hidden and replaced by CareerActivity below, which
 * has real data to show instead of three "not applicable"s.
 *
 * Viewing a user's photo full-size is restricted to the pure-admin owner
 * account (`me.role === 'admin'`) — accounts with dual-role admin access
 * granted from this same Users tab (`is_admin`, role still
 * student/company/career) can see the small thumbnail here like anyone
 * else, but cannot open it full-size. The owner asked for this split
 * explicitly, distinct from every other admin capability in this file,
 * which any admin-access account shares equally.
 */
function UserDetailModal({ userId, onClose, canRevokeSelf, onAdminAccessChanged }) {
  const { t } = useLang();
  const { user: me } = useAuth();
  const toast = useToast();
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    api(`/admin/users/${userId}`)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch(() => { if (!cancelled) onClose(); });
    return () => { cancelled = true; };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleAdminAccess() {
    if (!detail) return;
    const next = !detail.is_admin;
    setBusy(true);
    try {
      await api(`/admin/users/${userId}/admin-access`, { method: 'PATCH', body: { isAdmin: next } });
      setDetail((d) => ({ ...d, is_admin: next }));
      onAdminAccessChanged(userId, next);
    } catch (err) {
      toast.show(err.message, { kind: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const dt = t('admin.users.detail');

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl p-6 max-h-[85vh] overflow-y-auto"
        style={{ background: 'var(--darbi-surface-solid)', border: '1px solid var(--darbi-border)', borderRadius: 'var(--darbi-radius)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {!detail ? (
          <p className="text-sm text-gray-400">{dt.loading}</p>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-5">
              {me?.role === 'admin' && detail.avatar ? (
                <button
                  type="button"
                  onClick={() => setViewing(true)}
                  aria-label={dt.viewPhoto}
                  className="w-14 h-14 rounded-full overflow-hidden shrink-0"
                  style={{ background: 'var(--darbi-gradient)' }}
                >
                  <img src={detail.avatar} alt="" className="w-full h-full object-cover" />
                </button>
              ) : (
                <div
                  className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-xl font-bold text-white shrink-0"
                  style={{ background: 'var(--darbi-gradient)' }}
                >
                  {detail.avatar ? (
                    <img src={detail.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span aria-hidden="true">{(detail.name || detail.username || '?')[0].toUpperCase()}</span>
                  )}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white truncate">{detail.name || detail.username}</h2>
                <p className="text-xs text-gray-500 truncate">{detail.email} · @{detail.username}</p>
              </div>
            </div>

            <dl className="text-sm space-y-2.5 mb-5">
              <Row label={dt.joined} value={fmtDateTime(detail.created_at)} />
              <Row label={dt.lastLogin} value={fmtDateTime(detail.last_login_at) ?? dt.never} />
              <Row label={dt.emailVerified} value={detail.email_verified ? dt.yes : dt.no} />
              {detail.role !== 'career' && (
                <>
                  <Row
                    label={dt.recommendCount}
                    value={detail.recommend_count != null ? detail.recommend_count : dt.notApplicable}
                  />
                  <Row
                    label={dt.savedPathwaysCount}
                    value={detail.saved_pathways_count != null ? detail.saved_pathways_count : dt.notApplicable}
                  />
                  <Row
                    label={dt.topMajor}
                    value={
                      detail.role !== 'student'
                        ? dt.notApplicable
                        : detail.top_recommended_major
                          ? dt.topMajorValue(detail.top_recommended_major.name, detail.top_recommended_major.count)
                          : dt.none
                    }
                  />
                </>
              )}
            </dl>

            {detail.role === 'career' && <CareerActivity detail={detail} dt={dt} />}

            {detail.role !== 'admin' && (
              <div className="mb-2">
                <Button
                  type="button"
                  variant={detail.is_admin ? 'navy' : 'gold'}
                  disabled={busy || (detail.is_admin && !canRevokeSelf)}
                  onClick={toggleAdminAccess}
                  style={{ width: '100%' }}
                >
                  {detail.is_admin ? dt.revokeAdmin : dt.grantAdmin}
                </Button>
              </div>
            )}
            <button type="button" onClick={onClose} className="w-full text-xs text-gray-400 hover:text-gray-200 py-2">
              {dt.close}
            </button>

            {viewing && <PhotoViewModal src={detail.avatar} onClose={() => setViewing(false)} />}
          </>
        )}
      </div>
    </div>
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

/**
 * Everything a graduate can build in the Graduate Portal, surfaced for the
 * admin: their profile, the latest AI-generated career path, the latest job
 * match results, every application they're tracking, and their AI Assistant
 * activity. All read-only here — editing a graduate's own data stays on
 * their own dashboard, this is visibility, not a second way to change it.
 */
function CareerActivity({ detail, dt }) {
  const { t } = useLang();
  const p = detail.career_profile;
  const ladder = detail.career_ladder;
  const matches = detail.job_matches ?? [];
  const apps = detail.applications ?? [];
  const statusLabels = t('career.applications.statusLabels');

  return (
    <div className="mb-5">
      <DetailSection title={dt.sectionProfile}>
        <dl className="text-sm space-y-2 mb-3">
          <Row label={dt.currentRole} value={p?.current_title || dt.notSet} />
          <Row label={dt.yearsExperience} value={p?.years_experience ?? dt.notSet} />
          <Row label={dt.education} value={[p?.major, p?.university].filter(Boolean).join(' — ') || dt.notSet} />
          <Row label={dt.certificates} value={p?.certificates?.length ?? 0} />
          <Row label={dt.projects} value={p?.projects?.length ?? 0} />
          <Row label={dt.workExperience} value={p?.experience?.length ?? 0} />
          <Row
            label={dt.cv}
            value={
              p?.cv ? (
                <a href={p.cv} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--darbi-purple)' }}>
                  {dt.viewCv}
                </a>
              ) : (
                dt.notUploaded
              )
            }
          />
        </dl>
        <TagList label={dt.skills} values={p?.skills} />
        <TagList label={dt.careerInterests} values={p?.career_goals} />
      </DetailSection>

      <DetailSection title={dt.sectionCareerPath}>
        {ladder ? (
          <>
            <p className="text-xs text-gray-500 mb-2">{dt.generatedOn(fmtDateTime(ladder.created_at))}</p>
            <ul className="text-sm text-gray-200 space-y-1">
              {ladder.payload.rungs.map((r) => (
                <li key={r.title}>
                  {r.title} <span className="text-gray-500">· {r.typical_years}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-gray-500 italic">{dt.notGeneratedYet}</p>
        )}
      </DetailSection>

      <DetailSection title={dt.sectionJobMatches}>
        {matches.length > 0 ? (
          <ul className="text-sm text-gray-200 space-y-1.5">
            {matches.map((m) => (
              <li key={m.job_id} className="flex justify-between gap-3">
                <span className="truncate">{m.title} — {m.company_name}</span>
                <span className="shrink-0 font-semibold" style={{ color: 'var(--darbi-gold)' }}>{m.match_score}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 italic">{dt.notGeneratedYet}</p>
        )}
      </DetailSection>

      <DetailSection title={dt.sectionApplications(apps.length)}>
        {apps.length > 0 ? (
          <ul className="text-sm text-gray-200 space-y-1.5">
            {apps.map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span className="truncate">{a.title} — {a.company_name}</span>
                <span className="shrink-0 text-xs text-gray-500">{statusLabels[a.status]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 italic">{dt.none}</p>
        )}
      </DetailSection>

      <DetailSection title={dt.sectionSavedPaths((detail.saved_paths ?? []).length)}>
        {detail.saved_paths?.length > 0 ? (
          <ul className="text-sm text-gray-200 space-y-1">
            {detail.saved_paths.map((sp) => (
              <li key={sp.name}>{sp.name} <span className="text-gray-500">· {sp.major_name}</span></li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 italic">{dt.none}</p>
        )}
      </DetailSection>

      <DetailSection title={dt.sectionSavedCentres((detail.saved_centres ?? []).length)}>
        {detail.saved_centres?.length > 0 ? (
          <ul className="text-sm text-gray-200 space-y-1">
            {detail.saved_centres.map((sc) => (
              <li key={sc.name}>{sc.name} <span className="text-gray-500">· {sc.field}</span></li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 italic">{dt.none}</p>
        )}
      </DetailSection>

      <DetailSection title={dt.sectionAssistant} last>
        <dl className="text-sm space-y-2">
          <Row label={dt.messagesSent} value={detail.chat_message_count} />
          <Row label={dt.lastActive} value={fmtDateTime(detail.chat_last_at) ?? dt.never} />
        </dl>
      </DetailSection>
    </div>
  );
}

function DetailSection({ title, children, last = false }) {
  return (
    <div className={last ? 'mb-4' : 'mb-4 pb-4 border-b'} style={last ? undefined : { borderColor: 'var(--darbi-border)' }}>
      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function TagList({ label, values }) {
  if (!values?.length) return null;
  return (
    <div className="mt-2">
      <span className="block text-xs text-gray-500 mb-1">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'color-mix(in srgb, var(--darbi-purple) 15%, transparent)', color: 'var(--darbi-purple)' }}
          >
            {v}
          </span>
        ))}
      </div>
    </div>
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

// -------------------------------------------------------- reference catalog
// The majors/courses/university-entry-average CRUD tab. A deliberate,
// later exception to "reference data is regenerated from spreadsheets, never
// hand-edited" (see CLAUDE.md hard rule #5) — the project owner asked for
// full admin control here. Visually a natural evolution of the read-only
// accordion in StudentDashboard.jsx's MajorExplorer: click a major to expand
// it, but every field in the expansion is now editable.

const DATA_QUALITY = ['high', 'medium', 'low', 'pending'];
const QUALITY_COLOR = {
  high: 'var(--darbi-success)',
  medium: 'var(--darbi-gold)',
  low: 'var(--darbi-error)',
  pending: 'var(--darbi-text-muted)',
};

function Majors() {
  const { t } = useLang();
  const mt = t('admin.majorsTab');
  const [majors, setMajors] = useState(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [open, setOpen] = useState(null);
  const toast = useToast();

  useEffect(() => {
    api('/majors').then(setMajors).catch(() => setMajors([]));
  }, []);

  function created(major) {
    setMajors((list) => [major, ...(list ?? [])]);
    setShowForm(false);
    toast.show(mt.addedToast(major.name), { kind: 'success' });
  }

  function updated(id, row) {
    setMajors((list) => list.map((m) => (m.id === id ? { ...m, ...row } : m)));
  }

  // Same optimistic-remove + 5s "Undo" toast used by the Users/Jobs tabs
  // above — the row disappears immediately, the real DELETE only fires once
  // the window passes, so this is the confirm flow instead of a native
  // window.confirm().
  function remove(major) {
    setMajors((list) => list.filter((m) => m.id !== major.id));
    setOpen((o) => (o === major.id ? null : o));
    const timer = setTimeout(() => {
      api(`/admin/majors/${major.id}`, { method: 'DELETE' }).catch(() => {});
    }, 5000);
    toast.show(mt.deletedToast(major.name), {
      kind: 'info',
      duration: 5000,
      action: {
        label: t('common.undo'),
        onClick: () => { clearTimeout(timer); setMajors((list) => [major, ...list]); },
      },
    });
  }

  if (majors === null) {
    return (
      <Card title={mt.loading}>
        <SkeletonLines lines={8} />
      </Card>
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? majors.filter((m) => `${m.name} ${m.faculty ?? ''}`.toLowerCase().includes(q))
    : majors;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <input
          className={inputClass}
          style={{ maxWidth: 320 }}
          placeholder={mt.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="button" variant="navy" onClick={() => setShowForm((s) => !s)}>
          {showForm ? t('common.cancel') : mt.addMajor}
        </Button>
      </div>

      {showForm && <AddMajorForm onCreated={created} />}

      <Card title={mt.countOf(filtered.length, majors.length)} accent={false}>
        {filtered.length === 0 && <EmptyState icon="🎓" title={mt.noMatching} />}
        <div>
          {filtered.map((m) => (
            <MajorRow
              key={m.id}
              major={m}
              open={open === m.id}
              onToggle={() => setOpen((o) => (o === m.id ? null : m.id))}
              onUpdated={(row) => updated(m.id, row)}
              onDeleted={() => remove(m)}
            />
          ))}
        </div>
      </Card>
    </>
  );
}

function AddMajorForm({ onCreated }) {
  const { t } = useLang();
  const mt = t('admin.majorsTab');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const major = await api('/admin/majors', { method: 'POST', body: { name } });
      setName('');
      onCreated(major);
    } catch (err) {
      setError(err.code === 'slug_taken' ? mt.slugTakenError : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={mt.addMajor} accent>
      <Alert>{error}</Alert>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div className="flex-1" style={{ minWidth: 220 }}>
          <Field label={mt.fieldName}>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
        </div>
        <Button type="submit" disabled={busy}>{busy ? t('common.loading') : mt.addMajor}</Button>
      </form>
      <p className="text-xs text-gray-500 mt-2">{mt.addMajorHint}</p>
    </Card>
  );
}

function MajorRow({ major, open, onToggle, onUpdated, onDeleted }) {
  const { t } = useLang();
  const mt = t('admin.majorsTab');

  return (
    <div className="border-b last:border-0 py-3" style={{ borderColor: 'var(--darbi-border)' }}>
      <button type="button" onClick={onToggle} className="w-full text-left flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-white truncate">{major.name}</p>
          <p className="text-xs text-gray-500 truncate">
            {major.faculty || mt.noFaculty} · {mt.courseCount(major.course_count ?? 0)}
          </p>
        </div>
        <span
          className="text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-full shrink-0"
          style={{
            background: `color-mix(in srgb, ${QUALITY_COLOR[major.data_quality] ?? 'var(--darbi-text-muted)'} 15%, transparent)`,
            color: QUALITY_COLOR[major.data_quality] ?? 'var(--darbi-text-muted)',
          }}
        >
          {mt.dataQualityLabels[major.data_quality] ?? major.data_quality}
        </span>
      </button>

      {open && <MajorPanel major={major} onUpdated={onUpdated} onDeleted={onDeleted} />}
    </div>
  );
}

/**
 * The expanded contents of a major row — own-field edit form, its courses,
 * and its university entry-average links. Courses/universities/all-
 * universities are only fetched once the row is actually open, same as
 * MajorExplorer's toggle() in StudentDashboard.jsx.
 */
function MajorPanel({ major, onUpdated, onDeleted }) {
  const [courses, setCourses] = useState(null);
  const [universities, setUniversities] = useState(null);
  const [allUniversities, setAllUniversities] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setCourses(null);
    setUniversities(null);
    setAllUniversities(null);
    Promise.all([
      api(`/majors/${major.slug}/courses`),
      api(`/majors/${major.slug}/universities`),
      api('/universities'),
    ])
      .then(([c, u, all]) => {
        if (cancelled) return;
        setCourses(c);
        setUniversities(u);
        setAllUniversities(all);
      })
      .catch(() => {
        if (cancelled) return;
        setCourses([]);
        setUniversities([]);
        setAllUniversities([]);
      });
    return () => { cancelled = true; };
  }, [major.slug]);

  return (
    <div className="mt-3 ms-1 sm:ms-4 space-y-5">
      <MajorEditForm major={major} onUpdated={onUpdated} onDeleted={onDeleted} />
      <CoursesSection majorId={major.id} courses={courses} onCoursesChange={setCourses} />
      <UniversitiesSection
        majorId={major.id}
        universities={universities}
        allUniversities={allUniversities}
        onUniversitiesChange={setUniversities}
      />
    </div>
  );
}

function MajorEditForm({ major, onUpdated, onDeleted }) {
  const { t } = useLang();
  const mt = t('admin.majorsTab');
  const toast = useToast();
  const [form, setForm] = useState({
    name: major.name ?? '',
    faculty: major.faculty ?? '',
    durationYears: major.duration_years ?? '',
    entryRequirements: major.entry_requirements ?? '',
    topJobs: (major.top_jobs ?? []).join(', '),
    salaryEntryMin: major.salary_entry_min_jod ?? '',
    salaryEntryMax: major.salary_entry_max_jod ?? '',
    salaryEntryRaw: major.salary_entry_raw ?? '',
    salary3yrMin: major.salary_3yr_min_jod ?? '',
    salary3yrMax: major.salary_3yr_max_jod ?? '',
    salary3yrRaw: major.salary_3yr_raw ?? '',
    salary5yrMin: major.salary_5yr_min_jod ?? '',
    salary5yrMax: major.salary_5yr_max_jod ?? '',
    salary5yrRaw: major.salary_5yr_raw ?? '',
    salarySource: major.salary_source ?? '',
    salaryConfidence: major.salary_confidence ?? '',
    dataQuality: major.data_quality ?? 'pending',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const num = (v) => (v === '' || v == null ? null : Number(v));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const row = await api(`/admin/majors/${major.id}`, {
        method: 'PUT',
        body: {
          name: form.name,
          faculty: form.faculty || null,
          duration_years: num(form.durationYears),
          entry_requirements: form.entryRequirements || null,
          top_jobs: form.topJobs.split(',').map((s) => s.trim()).filter(Boolean),
          salary_entry_min_jod: num(form.salaryEntryMin),
          salary_entry_max_jod: num(form.salaryEntryMax),
          salary_entry_raw: form.salaryEntryRaw || null,
          salary_3yr_min_jod: num(form.salary3yrMin),
          salary_3yr_max_jod: num(form.salary3yrMax),
          salary_3yr_raw: form.salary3yrRaw || null,
          salary_5yr_min_jod: num(form.salary5yrMin),
          salary_5yr_max_jod: num(form.salary5yrMax),
          salary_5yr_raw: form.salary5yrRaw || null,
          salary_source: form.salarySource || null,
          salary_confidence: form.salaryConfidence || null,
          data_quality: form.dataQuality,
        },
      });
      onUpdated(row);
      toast.show(mt.savedToast(row.name), { kind: 'success' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="darbi-box" style={{ borderLeft: '4px solid var(--darbi-purple)' }}>
      <Alert>{error}</Alert>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label={mt.fieldName}>
          <input className={inputClass} value={form.name} onChange={set('name')} required />
        </Field>
        <Field label={mt.fieldFaculty}>
          <input className={inputClass} value={form.faculty} onChange={set('faculty')} />
        </Field>
        <Field label={mt.fieldDurationYears}>
          <input type="number" step="0.5" min="0" className={inputClass} value={form.durationYears} onChange={set('durationYears')} />
        </Field>
        <Field label={mt.fieldDataQuality}>
          <select className={inputClass} value={form.dataQuality} onChange={set('dataQuality')}>
            {DATA_QUALITY.map((q) => (
              <option key={q} value={q}>{mt.dataQualityLabels[q]}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={mt.fieldEntryRequirements}>
        <textarea rows="2" className={inputClass} value={form.entryRequirements} onChange={set('entryRequirements')} />
      </Field>
      <Field label={mt.fieldTopJobs} hint={mt.commaSeparated}>
        <input className={inputClass} value={form.topJobs} onChange={set('topJobs')} />
      </Field>

      <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mt-1 mb-2">{mt.salaryEntryHeading}</p>
      <div className="grid sm:grid-cols-3 gap-x-4">
        <Field label={mt.fieldSalaryMin}>
          <input type="number" className={inputClass} value={form.salaryEntryMin} onChange={set('salaryEntryMin')} />
        </Field>
        <Field label={mt.fieldSalaryMax}>
          <input type="number" className={inputClass} value={form.salaryEntryMax} onChange={set('salaryEntryMax')} />
        </Field>
        <Field label={mt.fieldSalaryRaw}>
          <input className={inputClass} value={form.salaryEntryRaw} onChange={set('salaryEntryRaw')} />
        </Field>
      </div>

      <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mt-1 mb-2">{mt.salary3yrHeading}</p>
      <div className="grid sm:grid-cols-3 gap-x-4">
        <Field label={mt.fieldSalaryMin}>
          <input type="number" className={inputClass} value={form.salary3yrMin} onChange={set('salary3yrMin')} />
        </Field>
        <Field label={mt.fieldSalaryMax}>
          <input type="number" className={inputClass} value={form.salary3yrMax} onChange={set('salary3yrMax')} />
        </Field>
        <Field label={mt.fieldSalaryRaw}>
          <input className={inputClass} value={form.salary3yrRaw} onChange={set('salary3yrRaw')} />
        </Field>
      </div>

      <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mt-1 mb-2">{mt.salary5yrHeading}</p>
      <div className="grid sm:grid-cols-3 gap-x-4">
        <Field label={mt.fieldSalaryMin}>
          <input type="number" className={inputClass} value={form.salary5yrMin} onChange={set('salary5yrMin')} />
        </Field>
        <Field label={mt.fieldSalaryMax}>
          <input type="number" className={inputClass} value={form.salary5yrMax} onChange={set('salary5yrMax')} />
        </Field>
        <Field label={mt.fieldSalaryRaw}>
          <input className={inputClass} value={form.salary5yrRaw} onChange={set('salary5yrRaw')} />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label={mt.fieldSalarySource}>
          <input className={inputClass} value={form.salarySource} onChange={set('salarySource')} />
        </Field>
        <Field label={mt.fieldSalaryConfidence}>
          <input className={inputClass} value={form.salaryConfidence} onChange={set('salaryConfidence')} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
        <Button type="submit" disabled={busy}>{busy ? t('common.loading') : t('common.save')}</Button>
        <button
          type="button"
          onClick={() => onDeleted(major)}
          className="text-xs font-semibold"
          style={{ color: 'var(--darbi-error)' }}
        >
          {mt.deleteMajor}
        </button>
      </div>
    </form>
  );
}

function CoursesSection({ majorId, courses, onCoursesChange }) {
  const { t } = useLang();
  const ct = t('admin.majorsTab.courses');
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);

  function added(course) {
    onCoursesChange((list) => [course, ...(list ?? [])]);
    setShowAdd(false);
    toast.show(ct.addedToast(course.name), { kind: 'success' });
  }

  function updated(row) {
    onCoursesChange((list) => (list ?? []).map((c) => (c.id === row.id ? row : c)));
    toast.show(ct.savedToast(row.name), { kind: 'success' });
  }

  function removed(course) {
    onCoursesChange((list) => (list ?? []).filter((c) => c.id !== course.id));
    const timer = setTimeout(() => {
      api(`/admin/courses/${course.id}`, { method: 'DELETE' }).catch(() => {});
    }, 5000);
    toast.show(ct.deletedToast(course.name), {
      kind: 'info',
      duration: 5000,
      action: {
        label: t('common.undo'),
        onClick: () => { clearTimeout(timer); onCoursesChange((list) => [course, ...(list ?? [])]); },
      },
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-400">{t('common.tabs.courses')}</h3>
        <button
          type="button"
          onClick={() => setShowAdd((s) => !s)}
          className="text-xs font-semibold"
          style={{ color: 'var(--darbi-purple)' }}
        >
          {showAdd ? t('common.cancel') : ct.addCourse}
        </button>
      </div>

      {showAdd && <CourseForm majorId={majorId} onSaved={added} onCancel={() => setShowAdd(false)} />}

      {courses === null ? (
        <SkeletonLines lines={3} />
      ) : courses.length === 0 ? (
        <p className="text-sm text-gray-500 italic">{ct.none}</p>
      ) : (
        <ul className="list-none pl-0 ps-0">
          {courses.map((c) => (
            <CourseRow key={c.id} course={c} onUpdated={updated} onDeleted={removed} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CourseForm({ majorId, initial, onSaved, onCancel }) {
  const { t } = useLang();
  const ct = t('admin.majorsTab.courses');
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    provider: initial?.provider ?? '',
    track: initial?.track ?? '',
    duration: initial?.duration ?? '',
    costRaw: initial?.cost_raw ?? '',
    costMinJod: initial?.cost_min_jod ?? '',
    costMaxJod: initial?.cost_max_jod ?? '',
    costOnlineUsd: initial?.cost_online_usd ?? '',
    whatYouLearn: initial?.what_you_learn ?? '',
    accreditation: initial?.accreditation ?? '',
    onlineAlternative: initial?.online_alternative ?? '',
    notes: initial?.notes ?? '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const num = (v) => (v === '' || v == null ? null : Number(v));
    const body = {
      name: form.name,
      provider: form.provider || null,
      track: form.track || null,
      duration: form.duration || null,
      cost_raw: form.costRaw || null,
      cost_min_jod: num(form.costMinJod),
      cost_max_jod: num(form.costMaxJod),
      cost_online_usd: form.costOnlineUsd || null,
      what_you_learn: form.whatYouLearn || null,
      accreditation: form.accreditation || null,
      online_alternative: form.onlineAlternative || null,
      notes: form.notes || null,
    };
    try {
      const row = initial
        ? await api(`/admin/courses/${initial.id}`, { method: 'PUT', body })
        : await api('/admin/courses', { method: 'POST', body: { ...body, major_id: majorId } });
      onSaved(row);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mb-3 p-3"
      style={{
        background: 'color-mix(in srgb, var(--darbi-purple) 6%, transparent)',
        border: '1px solid var(--darbi-border)',
        borderRadius: 'var(--darbi-radius)',
      }}
    >
      <Alert>{error}</Alert>
      <Field label={ct.fieldName}>
        <input className={inputClass} value={form.name} onChange={set('name')} required />
      </Field>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label={ct.fieldProvider}>
          <input className={inputClass} value={form.provider} onChange={set('provider')} />
        </Field>
        <Field label={ct.fieldTrack}>
          <input className={inputClass} value={form.track} onChange={set('track')} />
        </Field>
        <Field label={ct.fieldDuration}>
          <input className={inputClass} value={form.duration} onChange={set('duration')} />
        </Field>
        <Field label={ct.fieldCostRaw}>
          <input className={inputClass} value={form.costRaw} onChange={set('costRaw')} />
        </Field>
        <Field label={ct.fieldCostMinJod}>
          <input type="number" step="1" className={inputClass} value={form.costMinJod} onChange={set('costMinJod')} />
        </Field>
        <Field label={ct.fieldCostMaxJod}>
          <input type="number" step="1" className={inputClass} value={form.costMaxJod} onChange={set('costMaxJod')} />
        </Field>
        <Field label={ct.fieldCostOnlineUsd}>
          <input className={inputClass} value={form.costOnlineUsd} onChange={set('costOnlineUsd')} />
        </Field>
        <Field label={ct.fieldAccreditation}>
          <input className={inputClass} value={form.accreditation} onChange={set('accreditation')} />
        </Field>
        <Field label={ct.fieldOnlineAlternative}>
          <input className={inputClass} value={form.onlineAlternative} onChange={set('onlineAlternative')} />
        </Field>
      </div>
      <Field label={ct.fieldWhatYouLearn}>
        <textarea rows="2" className={inputClass} value={form.whatYouLearn} onChange={set('whatYouLearn')} />
      </Field>
      <Field label={ct.fieldNotes}>
        <textarea rows="2" className={inputClass} value={form.notes} onChange={set('notes')} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? t('common.loading') : t('common.save')}</Button>
        <Button type="button" variant="navy" onClick={onCancel}>{t('common.cancel')}</Button>
      </div>
    </form>
  );
}

function CourseRow({ course, onUpdated, onDeleted }) {
  const { t } = useLang();
  const ct = t('admin.majorsTab.courses');
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li>
        <CourseForm
          initial={course}
          onSaved={(row) => { onUpdated(row); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex items-start justify-between gap-3 py-2 border-b last:border-0" style={{ borderColor: 'var(--darbi-border)' }}>
      <div className="min-w-0">
        <p className="font-medium text-white truncate">{course.name}</p>
        <p className="text-xs text-gray-500 truncate">
          {course.provider}
          {course.track && ` · ${course.track}`}
          {course.cost_raw && ` · ${course.cost_raw} JOD`}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0 text-xs font-semibold">
        <button type="button" onClick={() => setEditing(true)} style={{ color: 'var(--darbi-purple)' }}>
          {ct.edit}
        </button>
        <button type="button" onClick={() => onDeleted(course)} style={{ color: 'var(--darbi-error)' }}>
          {t('common.delete')}
        </button>
      </div>
    </li>
  );
}

function UniversitiesSection({ majorId, universities, allUniversities, onUniversitiesChange }) {
  const { t } = useLang();
  const ut = t('admin.majorsTab.universities');
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);

  // university_majors has no surrogate id (its PK is university_id + major_id
  // + program_name), so rows are addressed by that composite key locally too.
  const keyOf = (row) => `${row.university_id}::${row.program_name ?? ''}`;

  function upsertLocal(row, uniMeta) {
    onUniversitiesChange((list) => {
      const l = list ?? [];
      const idx = l.findIndex((u) => keyOf(u) === keyOf(row));
      const merged = {
        ...row,
        name: uniMeta?.name ?? l[idx]?.name,
        code: uniMeta?.code ?? l[idx]?.code,
        website: uniMeta?.website ?? l[idx]?.website,
      };
      if (idx === -1) return [merged, ...l];
      const next = [...l];
      next[idx] = merged;
      return next;
    });
  }

  function added(row, uniMeta) {
    upsertLocal(row, uniMeta);
    setShowAdd(false);
    toast.show(ut.addedToast(uniMeta?.name ?? row.program_name ?? ''), { kind: 'success' });
  }

  function updated(row, uniMeta) {
    upsertLocal(row, uniMeta);
    toast.show(ut.savedToast(uniMeta?.name ?? row.name ?? ''), { kind: 'success' });
  }

  function removed(row) {
    onUniversitiesChange((list) => (list ?? []).filter((u) => keyOf(u) !== keyOf(row)));
    const timer = setTimeout(() => {
      api('/admin/university-majors', {
        method: 'DELETE',
        body: { universityId: row.university_id, majorId: row.major_id, programName: row.program_name ?? null },
      }).catch(() => {});
    }, 5000);
    toast.show(ut.deletedToast(row.name), {
      kind: 'info',
      duration: 5000,
      action: {
        label: t('common.undo'),
        onClick: () => { clearTimeout(timer); onUniversitiesChange((list) => [row, ...(list ?? [])]); },
      },
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-400">{ut.heading}</h3>
        <button
          type="button"
          onClick={() => setShowAdd((s) => !s)}
          className="text-xs font-semibold"
          style={{ color: 'var(--darbi-purple)' }}
        >
          {showAdd ? t('common.cancel') : ut.addLink}
        </button>
      </div>

      {showAdd && (
        <UniversityLinkForm
          majorId={majorId}
          allUniversities={allUniversities ?? []}
          onSaved={added}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {universities === null ? (
        <SkeletonLines lines={3} />
      ) : universities.length === 0 ? (
        <p className="text-sm text-gray-500 italic">{ut.none}</p>
      ) : (
        <ul className="list-none pl-0 ps-0">
          {universities.map((u) => (
            <UniversityLinkRow
              key={keyOf(u)}
              row={u}
              majorId={majorId}
              allUniversities={allUniversities ?? []}
              onUpdated={updated}
              onDeleted={removed}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function UniversityLinkForm({ majorId, initial, allUniversities, onSaved, onCancel }) {
  const { t } = useLang();
  const ut = t('admin.majorsTab.universities');
  const [form, setForm] = useState({
    universityId: initial?.university_id ?? '',
    programName: initial?.program_name ?? '',
    competitiveAverage: initial?.competitive_average ?? '',
    minimumAverage: initial?.minimum_average ?? '',
    entryYear: initial?.entry_year ?? '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.universityId) { setError(ut.selectUniversityError); return; }
    setBusy(true);
    const num = (v) => (v === '' || v == null ? null : Number(v));
    try {
      const row = await api('/admin/university-majors', {
        method: 'PUT',
        body: {
          universityId: Number(form.universityId),
          majorId,
          programName: form.programName || null,
          competitiveAverage: num(form.competitiveAverage),
          minimumAverage: num(form.minimumAverage),
          entryYear: num(form.entryYear),
        },
      });
      const uni = allUniversities.find((u) => u.id === Number(form.universityId));
      onSaved(row, uni);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mb-3 p-3"
      style={{
        background: 'color-mix(in srgb, var(--darbi-gold) 6%, transparent)',
        border: '1px solid var(--darbi-border)',
        borderRadius: 'var(--darbi-radius)',
      }}
    >
      <Alert>{error}</Alert>
      {!initial ? (
        <Field label={ut.fieldUniversity}>
          <select className={inputClass} value={form.universityId} onChange={set('universityId')} required>
            <option value="">{ut.selectUniversity}</option>
            {allUniversities.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
            ))}
          </select>
        </Field>
      ) : (
        <p className="text-sm font-semibold text-white mb-3">
          {initial.name} <span className="text-gray-500 font-normal">({initial.code})</span>
        </p>
      )}
      <Field label={ut.fieldProgramName} hint={ut.programNameHint}>
        <input className={inputClass} value={form.programName} onChange={set('programName')} />
      </Field>
      <div className="grid sm:grid-cols-3 gap-x-4">
        <Field label={ut.fieldCompetitiveAverage} hint={ut.competitiveHint}>
          <input type="number" step="0.01" min="0" max="100" className={inputClass} value={form.competitiveAverage} onChange={set('competitiveAverage')} />
        </Field>
        <Field label={ut.fieldMinimumAverage} hint={ut.minimumHint}>
          <input type="number" step="0.01" min="0" max="100" className={inputClass} value={form.minimumAverage} onChange={set('minimumAverage')} />
        </Field>
        <Field label={ut.fieldEntryYear}>
          <input type="number" step="1" className={inputClass} value={form.entryYear} onChange={set('entryYear')} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? t('common.loading') : t('common.save')}</Button>
        <Button type="button" variant="navy" onClick={onCancel}>{t('common.cancel')}</Button>
      </div>
    </form>
  );
}

function UniversityLinkRow({ row, majorId, allUniversities, onUpdated, onDeleted }) {
  const { t } = useLang();
  const ut = t('admin.majorsTab.universities');
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li>
        <UniversityLinkForm
          majorId={majorId}
          initial={row}
          allUniversities={allUniversities}
          onSaved={(r, uni) => { onUpdated(r, uni ?? row); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex items-start justify-between gap-3 py-2 border-b last:border-0" style={{ borderColor: 'var(--darbi-border)' }}>
      <div className="min-w-0">
        <p className="font-medium text-white truncate">
          {row.name} <span className="text-gray-500 font-normal">({row.code})</span>
          {row.program_name && <span className="text-gray-500"> · {row.program_name}</span>}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {row.competitive_average != null ? ut.competitiveValue(row.competitive_average) : ut.competitiveNotPublished}
          {' · '}
          {row.minimum_average != null ? ut.minimumValue(row.minimum_average) : ut.minimumNotPublished}
          {row.entry_year && ` · ${row.entry_year}`}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0 text-xs font-semibold">
        <button type="button" onClick={() => setEditing(true)} style={{ color: 'var(--darbi-purple)' }}>
          {ut.edit}
        </button>
        <button type="button" onClick={() => onDeleted(row)} style={{ color: 'var(--darbi-error)' }}>
          {t('common.delete')}
        </button>
      </div>
    </li>
  );
}
