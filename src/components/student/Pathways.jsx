import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { Alert, Card } from '../common/ui.jsx';
import PathwayCard from './PathwayCard.jsx';

/**
 * Pathways tab: pick a major, see its pathway, save it.
 *
 * "Saved for later" (slide 4) reuses the saved_majors table rather than adding
 * a parallel one — a saved pathway *is* a saved major; the card is derived.
 */
export default function Pathways({ initialSlug }) {
  const [majors, setMajors] = useState([]);
  const [selected, setSelected] = useState(initialSlug ?? null);
  const [savedSlugs, setSavedSlugs] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/majors', { auth: false }).then(setMajors).catch(() => {});
    loadSaved();
  }, []);

  function loadSaved() {
    api('/students/me/saved-majors')
      .then((rows) => setSavedSlugs(rows.map((r) => r.slug)))
      .catch(() => {});
  }

  async function save(slug) {
    const major = majors.find((m) => m.slug === slug);
    if (!major) return;
    try {
      await api('/students/me/saved-majors', { method: 'POST', body: { majorId: major.id } });
      loadSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  async function unsave(slug) {
    const major = majors.find((m) => m.slug === slug);
    if (!major) return;
    await api(`/students/me/saved-majors/${major.id}`, { method: 'DELETE' });
    loadSaved();
  }

  return (
    <>
      <Alert>{error}</Alert>

      <Card title="Build a pathway">
        <p className="text-gray-600 text-sm mb-4">
          Pick a major to see where it leads — what to study, the roles it opens, and how much
          demand there actually is on DARBI’s job board.
        </p>
        <div className="flex flex-wrap gap-2">
          {majors.map((m) => (
            <button
              key={m.slug}
              onClick={() => setSelected(m.slug)}
              className={`text-sm px-3.5 py-2 rounded-lg border-2 transition ${
                selected === m.slug
                  ? 'border-darbi-gold bg-yellow-50 font-semibold'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </Card>

      {selected && (
        <PathwayCard
          slug={selected}
          saved={savedSlugs.includes(selected)}
          onSave={save}
          onClose={() => setSelected(null)}
        />
      )}

      {savedSlugs.length > 0 && (
        <Card title={`Saved pathways (${savedSlugs.length})`} accent={false}>
          <div className="flex flex-wrap gap-2">
            {savedSlugs.map((slug) => {
              const major = majors.find((m) => m.slug === slug);
              return (
                <span
                  key={slug}
                  className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 flex items-center gap-2"
                >
                  <button onClick={() => setSelected(slug)} className="font-medium text-darbi-navy">
                    {major?.name ?? slug}
                  </button>
                  <button
                    onClick={() => unsave(slug)}
                    className="text-gray-400 hover:text-red-600"
                    aria-label={`Remove ${major?.name ?? slug}`}
                  >
                    ✕
                  </button>
                </span>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}
