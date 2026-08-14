import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../services/auth.jsx';
import { Card, EmptyState, Shell, SkeletonLines } from '../components/common/ui.jsx';
import { useLang } from '../i18n/index.jsx';

const TABS = ['overview', 'learning paths', 'training centres'];

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
