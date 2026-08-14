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

  async function save(major) {
    try {
      await api('/students/me/saved-majors', { method: 'POST', body: { majorId: major.id } });
      loadSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  async function unsave(major) {
    try {
      await api(`/students/me/saved-majors/${major.id}`, { method: 'DELETE' });
      loadSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Alert>{error}</Alert>

      <Card title="Build a pathway">
        <p className="text-gray-400 text-sm mb-4">
          Pick a major to see where it leads — what to study, the roles it opens, and how much
          demand there actually is on DARBI’s job board.
        </p>
        <div className="flex flex-wrap gap-2">
          {majors.map((m) => (
            <button
              key={m.slug}
              onClick={() => setSelected(m.slug)}
              className={`text-sm px-3.5 py-2 rounded-full border-2 transition ${
                selected === m.slug
                  ? 'text-white font-semibold border-transparent'
                  : 'text-gray-300 border-white/10 hover:border-white/25'
              }`}
              style={selected === m.slug ? { background: 'var(--darbi-gradient)' } : undefined}
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
          onUnsave={unsave}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
