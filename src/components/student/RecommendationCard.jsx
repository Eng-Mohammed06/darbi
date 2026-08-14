import { Salary } from '../common/ui.jsx';

/**
 * The wireframe's results card, verbatim in structure:
 *
 *   1. SOFTWARE ENGINEERING
 *      Average Salary: 600-800 JD
 *      Universities: UJ, JUST, GJU
 *      Top Jobs: Developer, DevOps, Full Stack
 *      [LEARN MORE]  [SAVE]
 *
 * `major` is the row from /api/majors; `recommendation` is the ranked entry
 * from /api/recommend, which may be absent when browsing all majors.
 */
export default function RecommendationCard({
  rank,
  major,
  recommendation,
  saved,
  onSave,
  onUnsave,
  onLearnMore,
}) {
  if (!major) return null;

  const entry = {
    min: major.salary_entry_min_jod,
    max: major.salary_entry_max_jod,
  };

  return (
    <article className="darbi-box darbi-section" style={{ borderTop: '4px solid var(--darbi-gold)' }}>
      <header className="flex items-baseline gap-2 mb-3">
        {rank != null && (
          <span className="text-sm font-bold" style={{ color: 'var(--darbi-gold)' }}>
            {rank}.
          </span>
        )}
        <h3 className="text-lg font-bold text-darbi-navy uppercase tracking-wide">{major.name}</h3>
        {recommendation?.fit_score != null && (
          <span className="ml-auto text-sm text-gray-500 shrink-0">
            {recommendation.fit_score}% fit
          </span>
        )}
      </header>

      {recommendation?.why && <p className="text-gray-300 mb-3 text-sm">{recommendation.why}</p>}

      <dl className="text-sm space-y-1.5 mb-4">
        <Row label="Average Salary">
          <Salary band={entry} stage="Entry" confidence={major.salary_confidence} />
        </Row>

        <Row label="Universities">
          {major.universities?.length ? (
            major.universities.join(', ')
          ) : (
            <span className="text-gray-500 italic">None on file</span>
          )}
        </Row>

        <Row label="Top Jobs">
          {major.top_jobs?.length ? (
            major.top_jobs.slice(0, 3).join(', ')
          ) : (
            <span className="text-gray-500 italic">Not listed</span>
          )}
        </Row>

        {recommendation?.matching_interests?.length > 0 && (
          <Row label="Matches">{recommendation.matching_interests.join(', ')}</Row>
        )}
      </dl>

      <div className="flex flex-wrap gap-2 darbi-stack-mobile">
        <button onClick={() => onLearnMore?.(major.slug)} className="darbi-btn darbi-btn-navy text-sm">
          Learn more
        </button>
        <button
          onClick={() => (saved ? onUnsave?.(major) : onSave?.(major))}
          className={`darbi-btn text-sm ${saved ? 'darbi-btn-navy hover:!text-red-400 hover:!border-red-400/50' : ''}`}
        >
          {saved ? 'Saved — remove' : 'Save'}
        </button>
      </div>
    </article>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex gap-2">
      <dt className="font-bold text-darbi-navy shrink-0">{label}:</dt>
      <dd className="text-gray-300">{children}</dd>
    </div>
  );
}
