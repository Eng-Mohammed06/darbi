import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';

const GOLD = '#ff5722';
const PURPLE = '#06b6d4';

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

  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (!data) return <p className="text-gray-500 text-sm">Building your pathway…</p>;

  const { major, study, career, demand, salary } = data;

  return (
    <div
      className="overflow-hidden mb-6"
      style={{ background: 'var(--darbi-surface)', border: '1px solid var(--darbi-border)', borderRadius: 'var(--darbi-radius)' }}
    >
      <div
        className="px-6 py-4 flex justify-between items-start"
        style={{ background: 'var(--darbi-surface-solid)', borderBottom: '1px solid var(--darbi-border)' }}
      >
        <div>
          <p className="text-xs uppercase tracking-wide" style={{ color: PURPLE }}>
            Your pathway
          </p>
          <h2 className="text-2xl font-bold text-white">{major.name}</h2>
        </div>
        <div className="flex gap-2 shrink-0">
          {onSave && (
            <button
              onClick={() => onSave(major.slug)}
              disabled={saved}
              className="text-sm font-bold px-4 py-2 rounded-full text-white disabled:opacity-60"
              style={{ background: 'var(--darbi-gradient)' }}
            >
              {saved ? 'Saved' : 'Save for later'}
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-white text-sm px-2 transition" aria-label="Close">
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
                  <li key={`${u.code}-${u.program_name}`} className="text-sm">
                    <span className="font-semibold text-darbi-navy">{u.code}</span>
                    <span className="text-gray-500">
                      {u.competitive_average != null
                        ? ` · needs ${u.competitive_average}% Tawjihi`
                        : ' · average not published'}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-gray-500 italic mb-3">
              No university on file for this major yet.
            </p>
          )}
          <p className="text-xs text-gray-500 mb-1">Start with</p>
          <ul className="space-y-1.5">
            {study.courses.slice(0, 3).map((c) => (
              <li key={c.name} className="text-sm text-gray-300">
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
                        className="text-xs px-2 py-1 rounded-full bg-white/10 text-gray-200"
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
          {salary.available && (
            <div className="mb-4 pb-3" style={{ borderBottom: '1px solid var(--darbi-border)' }}>
              <p className="text-xs text-gray-500 mb-1">Salary progression</p>
              {[['Entry', salary.entry], ['3 years', salary.three_year], ['5 years', salary.five_year]]
                .filter(([, b]) => b?.min != null)
                .map(([label, b]) => (
                  <p key={label} className="text-sm">
                    <span className="text-gray-500">{label}: </span>
                    <span className="font-semibold" style={{ color: GOLD }}>
                      {b.min === b.max ? b.min : `${b.min}–${b.max}`} JD
                    </span>
                  </p>
                ))}
            </div>
          )}
          <div className="mb-3">
            <p className="text-4xl font-bold" style={{ color: GOLD }}>
              {demand.listings}
            </p>
            <p className="text-sm text-gray-300">
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
              <p className="text-sm text-gray-300">
                {demand.employers.slice(0, 5).join(', ')}
                {demand.employers.length > 5 && ` +${demand.employers.length - 5} more`}
              </p>
            </>
          )}
        </Stage>
      </div>

      <div
        className="px-6 py-3 text-xs text-gray-500"
        style={{ background: 'var(--darbi-surface-solid)', borderTop: '1px solid var(--darbi-border)' }}
      >
        {salary.available ? (
          <>
            Salary source: {(salary.source ?? '').split('\n')[0]}
            {salary.confidence && ` · Confidence: ${salary.confidence.split('.')[0]}`}
          </>
        ) : (
          <>No salary band on file for this major.</>
        )}
        {' · '}Demand from {demand.total_listings_on_board} verified Jordanian listings.
      </div>
    </div>
  );
}

function Stage({ n, title, arrow, children }) {
  return (
    <div className="relative p-6 border-b md:border-b-0 md:border-r last:border-r-0 border-[color:var(--darbi-border)]">

      <div className="flex items-center gap-2 mb-3">
        <span
          className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
          style={{ background: 'var(--darbi-surface-solid)', color: PURPLE, border: '1px solid var(--darbi-border)' }}
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
          style={{ background: 'var(--darbi-gradient)', color: '#fff' }}
        >
          →
        </span>
      )}
    </div>
  );
}

function DemandBar({ share }) {
  return (
    <div className="h-2 rounded-full bg-white/10 mb-1.5 overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(share, 2)}%`, background: 'var(--darbi-gradient)' }}
      />
    </div>
  );
}
