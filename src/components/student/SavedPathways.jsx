import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { Alert, Card, Salary } from '../common/ui.jsx';
import PathwayCard from './PathwayCard.jsx';
import { useLang } from '../../i18n/index.jsx';

/**
 * Its own tab rather than a strip at the bottom of Pathways — saving a
 * pathway used to just add a chip back on the same screen you saved it from,
 * which made "saved" feel like it went nowhere.
 */
export default function SavedPathways() {
  const { t } = useLang();
  const [saved, setSaved] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  function load() {
    api('/students/me/saved-majors')
      .then(setSaved)
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function unsave(major) {
    await api(`/students/me/saved-majors/${major.id}`, { method: 'DELETE' });
    if (selected === major.slug) setSelected(null);
    load();
  }

  if (saved.length === 0) {
    return (
      <Card title={t('student.savedPathways.cardTitle')}>
        <p className="text-gray-400 text-sm">
          {t('student.savedPathways.emptyBody')}
        </p>
      </Card>
    );
  }

  return (
    <>
      <Alert>{error}</Alert>

      <Card title={t('student.savedPathways.count')(saved.length)}>
        <div className="grid sm:grid-cols-2 gap-3">
          {saved.map((m) => {
            const open = selected === m.slug;
            return (
              <div
                key={m.slug}
                className={`text-start p-4 rounded-2xl border-2 transition ${
                  open ? '' : 'border-white/10 hover:border-white/25'
                }`}
                style={
                  open
                    ? { borderColor: 'var(--darbi-purple)', background: 'color-mix(in srgb, var(--darbi-purple) 10%, transparent)' }
                    : undefined
                }
              >
                <div className="flex justify-between items-start gap-2">
                  <button
                    onClick={() => setSelected(open ? null : m.slug)}
                    className="font-semibold text-darbi-navy text-start"
                  >
                    {m.name}
                  </button>
                  <button
                    onClick={() => unsave(m)}
                    className="text-gray-500 hover:text-red-400 shrink-0"
                    aria-label={t('student.savedPathways.removeAria')(m.name)}
                  >
                    ✕
                  </button>
                </div>

                <div className="text-sm mt-1.5">
                  <Salary band={{ min: m.salary_entry_min_jod, max: m.salary_entry_max_jod }} />
                </div>

                {m.top_jobs?.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                    {m.top_jobs.slice(0, 3).join(', ')}
                  </p>
                )}

                <button
                  onClick={() => setSelected(open ? null : m.slug)}
                  className="text-xs font-semibold mt-3"
                  style={{ color: 'var(--darbi-purple)' }}
                >
                  {open ? t('student.savedPathways.hidePathway') : t('student.savedPathways.viewPathway')}
                </button>
              </div>
            );
          })}
        </div>
      </Card>

      {selected && <PathwayCard slug={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
