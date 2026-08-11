import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';

const NAVY = '#001a33';
const GOLD = '#d4af37';

/**
 * Slide 4's "visual path, not a list": study -> career -> market demand.
 *
 * Every figure is a count over seeded rows, computed server-side with no model
 * call — the card renders identically with or without API credit.
 */
export default function PathwayCard({ slug, onSave, saved, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    api(`/pathways/${slug}`, { auth: false })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [slug]);

  if (error) return <p className="text-red-700 text-sm">{error}</p>;
  if (!data) return <p className="text-gray-500 text-sm">Building your pathway…</p>;

  const { major, study, career, demand, salary } = data;

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
      <div style={{ backgroundColor: NAVY }} className="px-6 py-4 flex justify-between items-start">
        <div>
          <p className="text-xs uppercase tracking-wide" style={{ color: GOLD }}>
            Your pathway
          </p>
          <h2 className="text-2xl font-bold text-white">{major.name}</h2>
        </div>
        <div className="flex gap-2 shrink-0">
          {onSave && (
            <button
              onClick={() => onSave(major.slug)}
              disabled={saved}
              className="text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-60"
              style={{ backgroundColor: GOLD, color: NAVY }}
            >
              {saved ? 'Saved' : 'Save for later'}
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="text-gray-300 text-sm px-2" aria-label="Close">
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3">
        <Stage n="1" title="Study" arrow>
          {study.taught_at.length > 0 ? (
            <>
              <p className="text-xs text-gray-500 mb-1">Taught at</p>
              <ul className="mb-3">
                {study.taught_at.map((u) => (
                  <li key={u.code} className="text-sm">
                    <span className="font-semibold text-darbi-navy">{u.code}</span>
                    <span className="text-gray-500"> · {u.course_count} courses</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-gray-500 italic mb-3">
              No university on file yet — courses here come from training academies.
            </p>
          )}
          <p className="text-xs text-gray-500 mb-1">Start with</p>
          <ul className="space-y-1.5">
            {study.courses.slice(0, 3).map((c) => (
              <li key={c.name} className="text-sm text-gray-700">
                {c.name}
                {c.cost_raw && <span className="text-gray-500"> · {c.cost_raw} JOD</span>}
              </li>
            ))}
          </ul>
        </Stage>

        <Stage n="2" title="Career" arrow>
          {career.roles.length > 0 ? (
            <>
              <p className="text-xs text-gray-500 mb-1">Roles this leads to</p>
              <ul className="mb-3 space-y-1">
                {career.roles.slice(0, 4).map((r, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-darbi-navy font-medium">{r.title}</span>
                    <span className="text-gray-500 block text-xs">{r.company_name}</span>
                  </li>
                ))}
              </ul>
              {career.skills.length > 0 && (
                <>
                  <p className="text-xs text-gray-500 mb-1.5">Skills employers ask for</p>
                  <div className="flex flex-wrap gap-1.5">
                    {career.skills.slice(0, 6).map((s) => (
                      <span
                        key={s.skill}
                        className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700"
                      >
                        {s.skill}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500 italic">
              No listing on our board names this major yet. That is a gap in our job data, not a
              verdict on the field.
            </p>
          )}
        </Stage>

        <Stage n="3" title="Market demand">
          <div className="mb-3">
            <p className="text-4xl font-bold" style={{ color: GOLD }}>
              {demand.listings}
            </p>
            <p className="text-sm text-gray-600">
              verified listing{demand.listings === 1 ? '' : 's'} from {demand.companies}{' '}
              compan{demand.companies === 1 ? 'y' : 'ies'}
            </p>
          </div>

          <DemandBar share={demand.share_of_board} />
          <p className="text-xs text-gray-500 mb-3">
            {demand.share_of_board}% of the {demand.total_listings_on_board} listings on DARBI’s
            board
          </p>

          {demand.employers.length > 0 && (
            <>
              <p className="text-xs text-gray-500 mb-1">Hiring</p>
              <p className="text-sm text-gray-700">
                {demand.employers.slice(0, 5).join(', ')}
                {demand.employers.length > 5 && ` +${demand.employers.length - 5} more`}
              </p>
            </>
          )}
        </Stage>
      </div>

      <div className="px-6 py-3 bg-gray-50 border-t text-xs text-gray-500">
        {salary.available ? (
          <>Entry salary {salary.entry_jod} JOD/month · source: {salary.source}</>
        ) : (
          <>
            Salary bands for this major are still being verified and are deliberately not shown.
            Demand figures come from {demand.total_listings_on_board} job listings gathered from
            Jordanian sources.
          </>
        )}
      </div>
    </div>
  );
}

function Stage({ n, title, arrow, children }) {
  return (
    <div className="relative p-6 border-b md:border-b-0 md:border-r last:border-r-0">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
          style={{ backgroundColor: NAVY, color: GOLD }}
        >
          {n}
        </span>
        <h3 className="font-bold text-darbi-navy">{title}</h3>
      </div>
      {children}
      {/* The arrow that makes it read as a path rather than three columns. */}
      {arrow && (
        <span
          className="hidden md:flex absolute top-7 -right-3 w-6 h-6 rounded-full items-center justify-center text-xs z-10"
          style={{ backgroundColor: GOLD, color: NAVY }}
        >
          →
        </span>
      )}
    </div>
  );
}

function DemandBar({ share }) {
  return (
    <div className="h-2 rounded-full bg-gray-200 mb-1.5 overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(share, 2)}%`, backgroundColor: GOLD }}
      />
    </div>
  );
}
