import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { useLang } from '../../i18n/index.jsx';

const GOLD = 'var(--darbi-gold)';
const PURPLE = 'var(--darbi-purple)';

/**
 * Slide 4's "visual path, not a list": study -> career -> market demand.
 *
 * Every figure is a count over seeded rows, computed server-side with no model
 * call — the card renders identically with or without API credit.
 */
export default function PathwayCard({ slug, onSave, onUnsave, saved, onClose }) {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    // No { auth: false } here on purpose: a signed-in student's token lets
    // the server personalize this major's course order (server/lib/
    // pathwayPersonalization.js) — a logged-out visitor still gets the
    // generic card fine, since the route tolerates a missing token.
    api(`/pathways/${slug}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [slug]);

  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (!data) return <p className="text-gray-500 text-sm">{t('student.pathways.building')}</p>;

  const { major, study, career, demand, salary, personalized } = data;

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
            {t('student.pathways.yourPathway')}
          </p>
          <h2 className="text-2xl font-bold text-white">{major.name}</h2>
        </div>
        <div className="flex gap-2 shrink-0">
          {(onSave || onUnsave) && (
            <button
              onClick={() => (saved ? onUnsave?.(major) : onSave?.(major))}
              className={`text-sm font-bold px-4 py-2 rounded-full text-white transition ${saved ? 'hover:text-red-400' : ''}`}
              style={saved ? { border: '1px solid var(--darbi-border)' } : { background: 'var(--darbi-gradient)' }}
            >
              {saved ? t('student.savedRemove') : t('student.pathways.saveForLater')}
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-white text-sm px-2 transition" aria-label={t('student.pathways.close')}>
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3">
        <Stage n="1" title={t('student.pathways.study')} arrow>
          {study.taught_at.length > 0 ? (
            <>
              <p className="text-xs text-gray-500 mb-1">{t('student.pathways.taughtAt')}</p>
              <ul className="mb-3">
                {study.taught_at.map((u) => (
                  <li key={`${u.code}-${u.program_name}`} className="text-sm">
                    <span className="font-semibold text-darbi-navy">{u.code}</span>
                    <span className="text-gray-500">
                      {' · '}
                      {u.competitive_average != null
                        ? t('student.majorExplorer.needsTawjihi')(u.competitive_average)
                        : t('student.majorExplorer.averageNotPublished')}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-gray-500 italic mb-3">
              {t('student.pathways.noUniversity')}
            </p>
          )}
          {personalized && (
            <p
              className="text-xs mb-3 px-3 py-2 rounded-lg"
              style={{
                background: 'color-mix(in srgb, var(--darbi-purple) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--darbi-purple) 25%, transparent)',
                color: 'var(--darbi-purple)',
              }}
            >
              <span className="font-bold uppercase tracking-wide" style={{ fontSize: '0.65rem' }}>
                {t('student.pathways.personalizedForYou')}
              </span>
              <br />
              {personalized.why_this_fits}
            </p>
          )}
          <p className="text-xs text-gray-500 mb-1">{t('student.pathways.startWith')}</p>
          <ul className="space-y-1.5">
            {study.courses.slice(0, 3).map((c) => (
              <li key={c.name} className="text-sm text-gray-300">
                {c.name}
                {c.cost_raw && <span className="text-gray-500"> · {c.cost_raw} JOD</span>}
              </li>
            ))}
          </ul>
        </Stage>

        <Stage n="2" title={t('student.pathways.career')} arrow>
          {career.roles.length > 0 ? (
            <>
              <p className="text-xs text-gray-500 mb-1">{t('student.pathways.rolesLeadTo')}</p>
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
                  <p className="text-xs text-gray-500 mb-1.5">{t('student.pathways.skillsEmployersAsk')}</p>
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
              {t('student.pathways.noJobListing')}
            </p>
          )}
        </Stage>

        <Stage n="3" title={t('student.pathways.marketDemand')}>
          {salary.available && (
            <div className="mb-4 pb-3" style={{ borderBottom: '1px solid var(--darbi-border)' }}>
              <p className="text-xs text-gray-500 mb-1">{t('student.pathways.salaryProgression')}</p>
              {[[t('common.stageEntry'), salary.entry], [t('student.pathways.threeYears'), salary.three_year], [t('student.pathways.fiveYears'), salary.five_year]]
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
              {t('student.pathways.verifiedListingsFrom')(demand.listings, demand.companies)}
            </p>
          </div>

          <DemandBar share={demand.share_of_board} />
          <p className="text-xs text-gray-500 mb-3">
            {t('student.pathways.shareOfBoard')(demand.share_of_board, demand.total_listings_on_board)}
          </p>

          {demand.employers.length > 0 && (
            <>
              <p className="text-xs text-gray-500 mb-1">{t('student.pathways.hiring')}</p>
              <p className="text-sm text-gray-300">
                {demand.employers.slice(0, 5).join(', ')}
                {demand.employers.length > 5 && ` ${t('student.pathways.moreEmployers')(demand.employers.length - 5)}`}
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
            {t('student.pathways.salarySourcePrefix')}{(salary.source ?? '').split('\n')[0]}
            {salary.confidence && t('student.pathways.confidenceSuffix')(salary.confidence.split('.')[0])}
          </>
        ) : (
          <>{t('student.pathways.noSalaryBand')}</>
        )}
        {' · '}{t('student.pathways.demandFromSuffix')(demand.total_listings_on_board)}
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
