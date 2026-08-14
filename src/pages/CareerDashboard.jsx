import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../services/auth.jsx';
import { Card, Shell } from '../components/common/ui.jsx';

const TABS = ['overview', 'learning paths', 'training centres'];

export default function CareerDashboard() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('overview');

  return (
    <Shell
      title={`Welcome, ${profile?.name ?? 'there'} 📈`}
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
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card title="Current role">
        <p className="text-2xl font-bold" style={{ color: '#ff5722' }}>
          {profile?.current_title ?? 'Not set'}
        </p>
      </Card>
      <Card title="Experience">
        <p className="text-2xl font-bold" style={{ color: '#ff5722' }}>
          {profile?.years_experience != null ? `${profile.years_experience} years` : '—'}
        </p>
      </Card>
      <Card title="Field">
        <p className="text-2xl font-bold" style={{ color: '#ff5722' }}>
          {profile?.major ?? 'Not set'}
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
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api('/career/paths', { auth: false }).then(setPaths).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const tracks = [...new Set(paths.map((p) => p.track))];

  return (
    <>
      {loading && <Card>Loading learning paths…</Card>}
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
                    <span className="font-semibold">In Jordan: </span>{p.jordan_centers}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}
      {!loading && paths.length === 0 && <Card>No learning paths loaded.</Card>}
    </>
  );
}

function TrainingCentres() {
  const [centres, setCentres] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api('/career/centres', { auth: false }).then(setCentres).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <Card title={loading ? 'Loading training centres…' : `${centres.length} accredited centre(s) in Jordan`}>
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
